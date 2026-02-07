// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-token",
};

interface UpdateRequest {
  user_id: string;
  role?: "secretary" | "doctor" | "admin";
  color?: string | null;
  professional?: {
    action: "link" | "unlink" | "update";
    id?: string; // professional to link
    name?: string; // update name
    specialty_id?: string | null;
    color?: string | null;
  } | null;
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(base64));
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userToken = req.headers.get("x-user-token");
    if (!userToken) {
      return jsonResponse({ success: false, error: "Missing x-user-token header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Decode JWT and validate caller
    let jwtPayload: Record<string, unknown>;
    try {
      jwtPayload = decodeJwtPayload(userToken);
    } catch {
      return jsonResponse({ success: false, error: "Invalid token format" }, 401);
    }

    const callerId = jwtPayload.sub as string;
    if (!callerId) {
      return jsonResponse({ success: false, error: "Token missing user ID" }, 401);
    }

    const exp = jwtPayload.exp as number;
    if (exp && exp < Math.floor(Date.now() / 1000)) {
      return jsonResponse({ success: false, error: "Token expired" }, 401);
    }

    // Verify caller exists
    const { data: callerData, error: callerError } =
      await supabaseAdmin.auth.admin.getUserById(callerId);
    if (callerError || !callerData.user) {
      return jsonResponse({ success: false, error: "User not found" }, 401);
    }

    // Verify caller is admin
    const { data: isAdminData, error: roleError } = await supabaseAdmin.rpc(
      "has_role",
      { _user_id: callerId, _role: "admin" }
    );
    if (roleError || !isAdminData) {
      return jsonResponse({ success: false, error: "Forbidden: Admin role required" }, 403);
    }

    // Parse body
    const body: UpdateRequest = await req.json();
    if (!body.user_id) {
      return jsonResponse({ success: false, error: "user_id is required" }, 400);
    }

    // Prevent self-demotion (admin can't change their own role)
    if (body.role && body.user_id === callerId) {
      return jsonResponse({ success: false, error: "Cannot change your own role" }, 400);
    }

    // Verify target user exists
    const { data: targetUser, error: targetError } =
      await supabaseAdmin.auth.admin.getUserById(body.user_id);
    if (targetError || !targetUser.user) {
      return jsonResponse({ success: false, error: "Target user not found" }, 404);
    }

    // Update role if requested
    if (body.role) {
      if (!["admin", "secretary", "doctor"].includes(body.role)) {
        return jsonResponse({ success: false, error: "Invalid role" }, 400);
      }

      // Delete existing role(s) and insert new one
      const { error: deleteRoleError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", body.user_id);

      if (deleteRoleError) {
        return jsonResponse({
          success: false,
          error: `Failed to update role: ${deleteRoleError.message}`,
        }, 500);
      }

      const { error: insertRoleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: body.user_id, role: body.role });

      if (insertRoleError) {
        return jsonResponse({
          success: false,
          error: `Failed to assign new role: ${insertRoleError.message}`,
        }, 500);
      }

      // If changing FROM doctor to non-doctor, unlink professional
      if (body.role !== "doctor") {
        await supabaseAdmin
          .from("professionals")
          .update({ user_id: null })
          .eq("user_id", body.user_id);
      }
    }

    // Update color in user_profiles if provided
    if (body.color !== undefined) {
      await supabaseAdmin
        .from("user_profiles")
        .upsert(
          { user_id: body.user_id, full_name: targetUser.user.email?.split("@")[0] || "", color: body.color },
          { onConflict: "user_id" }
        );
    }

    // Handle professional operations
    if (body.professional) {
      const { action } = body.professional;

      if (action === "link" && body.professional.id) {
        // Verify professional exists and is not linked
        const { data: prof } = await supabaseAdmin
          .from("professionals")
          .select("id, user_id")
          .eq("id", body.professional.id)
          .maybeSingle();

        if (!prof) {
          return jsonResponse({ success: false, error: "Professional not found" }, 404);
        }
        if (prof.user_id !== null && prof.user_id !== body.user_id) {
          return jsonResponse({
            success: false,
            error: "Professional already linked to another user",
          }, 409);
        }

        // Unlink any existing professional first
        await supabaseAdmin
          .from("professionals")
          .update({ user_id: null })
          .eq("user_id", body.user_id);

        // Link the new one
        const { error: linkError } = await supabaseAdmin
          .from("professionals")
          .update({ user_id: body.user_id })
          .eq("id", body.professional.id);

        if (linkError) {
          return jsonResponse({
            success: false,
            error: `Failed to link professional: ${linkError.message}`,
          }, 500);
        }
      } else if (action === "unlink") {
        await supabaseAdmin
          .from("professionals")
          .update({ user_id: null })
          .eq("user_id", body.user_id);
      } else if (action === "update") {
        // Update professional fields for the linked professional
        const updates: Record<string, unknown> = {};
        if (body.professional.name !== undefined) updates.name = body.professional.name;
        if (body.professional.specialty_id !== undefined) updates.specialty_id = body.professional.specialty_id;
        if (body.professional.color !== undefined) updates.color = body.professional.color;

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from("professionals")
            .update(updates)
            .eq("user_id", body.user_id);

          if (updateError) {
            return jsonResponse({
              success: false,
              error: `Failed to update professional: ${updateError.message}`,
            }, 500);
          }
        }
      }
    }

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    }, 500);
  }
});
