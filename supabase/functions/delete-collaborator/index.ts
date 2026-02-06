// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-token",
};

interface DeleteRequest {
  user_id: string;
  unlink_professional?: boolean; // if true, unlink professional but don't delete it
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
    const body: DeleteRequest = await req.json();
    if (!body.user_id) {
      return jsonResponse({ success: false, error: "user_id is required" }, 400);
    }

    // Prevent self-deletion
    if (body.user_id === callerId) {
      return jsonResponse({ success: false, error: "Cannot delete your own account" }, 400);
    }

    // Verify target user exists
    const { data: targetUser, error: targetError } =
      await supabaseAdmin.auth.admin.getUserById(body.user_id);
    if (targetError || !targetUser.user) {
      return jsonResponse({ success: false, error: "Target user not found" }, 404);
    }

    // Step 1: Unlink professional (don't delete the professional record)
    await supabaseAdmin
      .from("professionals")
      .update({ user_id: null })
      .eq("user_id", body.user_id);

    // Step 2: Delete user roles
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", body.user_id);

    // Step 3: Delete user profile if exists
    await supabaseAdmin
      .from("user_profiles")
      .delete()
      .eq("user_id", body.user_id);

    // Step 4: Delete auth user
    const { error: deleteError } =
      await supabaseAdmin.auth.admin.deleteUser(body.user_id);

    if (deleteError) {
      return jsonResponse({
        success: false,
        error: `Failed to delete user: ${deleteError.message}`,
      }, 500);
    }

    return jsonResponse({
      success: true,
      message: `User ${targetUser.user.email} deleted successfully`,
    }, 200);
  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    }, 500);
  }
});
