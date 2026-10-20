// @ts-expect-error: Deno resolves remote imports at deployment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error: Deno resolves remote imports at deployment
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-token",
};

interface InviteRequest {
  email: string;
  role: "secretary" | "doctor";
  color?: string | null;
  specialty_id?: string | null; // required for doctors
}

interface InviteResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
  };
  role?: string;
  error?: string;
}

async function upsertUserProfile(
  supabaseAdmin: ReturnType<typeof createClient>,
  payload: { user_id: string; full_name: string; color?: string | null }
) {
  const { error } = await supabaseAdmin
    .from("user_profiles")
    .upsert(payload, { onConflict: "user_id" });

  if (!error) return;

  if (
    error.code === "PGRST204" ||
    error.message?.includes("color") ||
    error.message?.includes("schema cache")
  ) {
    const { error: fallbackError } = await supabaseAdmin
      .from("user_profiles")
      .upsert(
        { user_id: payload.user_id, full_name: payload.full_name },
        { onConflict: "user_id" }
      );

    if (fallbackError) throw fallbackError;
    return;
  }

  throw error;
}


serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get user token from custom header (avoids ES256/HS256 gateway conflict)
    const userToken = req.headers.get("x-user-token");
    if (!userToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing x-user-token header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase admin client (service role for all operations)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the complete user token with Auth, including its signature and expiry.
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(userToken);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = userData.user;

    // Validate user can manage staff
    const { data: isAdminData, error: adminRoleError } = await supabaseAdmin.rpc(
      "has_role",
      { _user_id: user.id, _role: "admin" }
    );
    const { data: isSecretaryData, error: secretaryRoleError } = await supabaseAdmin.rpc(
      "has_role",
      { _user_id: user.id, _role: "secretary" }
    );

    if (adminRoleError || secretaryRoleError || (!isAdminData && !isSecretaryData)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Forbidden: Staff manager role required",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: InviteRequest = await req.json();

    // Validate input
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["secretary", "doctor"].includes(body.role)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid role. Must be 'secretary' or 'doctor'",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate specialty_id for doctors
    if (body.role === "doctor" && !body.specialty_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "specialty_id is required for doctor role",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Invite user via Supabase Auth
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(body.email, {
        redirectTo: `${Deno.env.get("SITE_URL")}/admin/login`,
      });

    if (inviteError) {
      console.error("Invite error:", inviteError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to invite user: ${inviteError.message}`,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invitedUserId = inviteData.user.id;

    // Step 2: Insert role into user_roles
    const { error: roleInsertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: invitedUserId, role: body.role });

    if (roleInsertError) {
      console.error("Role insert error:", roleInsertError);
      // Attempt cleanup: delete invited user
      await supabaseAdmin.auth.admin.deleteUser(invitedUserId);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to assign role: ${roleInsertError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Create professional entry for doctors
    if (body.role === "doctor") {
      const professionalName = body.email.split("@")[0]; // default name from email
      const { error: profError } = await supabaseAdmin
        .from("professionals")
        .insert({
          name: professionalName,
          specialty_id: body.specialty_id,
          color: body.color || "#6366f1",
          user_id: invitedUserId,
        });

      if (profError) {
        console.error("Professional creation error:", profError);
        // Cleanup on failure
        await supabaseAdmin.auth.admin.deleteUser(invitedUserId);
        await supabaseAdmin.from("user_roles").delete().eq("user_id", invitedUserId);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to create professional: ${profError.message}`,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 4: Create user_profiles entry with color
    const profileColor = body.color || "#6366f1";
    await upsertUserProfile(supabaseAdmin, {
      user_id: invitedUserId,
      full_name: body.email.split("@")[0],
      color: profileColor,
    });

    // Success response
    const response: InviteResponse = {
      success: true,
      user: {
        id: invitedUserId,
        email: body.email,
      },
      role: body.role,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
