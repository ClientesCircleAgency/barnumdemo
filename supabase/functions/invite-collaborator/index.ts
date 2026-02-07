// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-token",
};

interface InviteRequest {
  email: string;
  role: "secretary" | "doctor";
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

// Decode JWT payload without verification (gateway already validated the request)
function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const payload = JSON.parse(atob(base64));
  return payload;
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

    // Decode JWT to extract user ID
    let jwtPayload: Record<string, unknown>;
    try {
      jwtPayload = decodeJwtPayload(userToken);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token format" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = jwtPayload.sub as string;
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Token missing user ID" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check token expiry
    const exp = jwtPayload.exp as number;
    if (exp && exp < Math.floor(Date.now() / 1000)) {
      return new Response(
        JSON.stringify({ success: false, error: "Token expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user exists via admin API (uses service role, no gateway JWT issue)
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = userData.user;

    // Validate user is admin
    const { data: isAdminData, error: roleError } = await supabaseAdmin.rpc(
      "has_role",
      { _user_id: user.id, _role: "admin" }
    );

    if (roleError || !isAdminData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Forbidden: Admin role required",
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
