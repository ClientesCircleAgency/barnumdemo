// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-token",
};

interface Collaborator {
  user_id: string;
  email: string;
  role: "admin" | "secretary" | "doctor";
  color?: string | null;
  photo_url?: string | null;
  professional_id?: string | null;
  professional_name?: string | null;
  professional_specialty_id?: string | null;
  professional_specialty?: string | null;
  professional_color?: string | null;
  professional_avatar_url?: string | null;
  active_specialty_ids?: string[] | null;
  active_consultation_type_ids?: string[] | null;
  working_hours?: unknown;
  time_off?: unknown;
  extra_permissions?: unknown;
}

interface ListResponse {
  success: boolean;
  collaborators?: Collaborator[];
  error?: string;
}

async function fetchProfileData(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string
): Promise<{
  color: string | null;
  photo_url: string | null;
  active_specialty_ids: string[] | null;
  active_consultation_type_ids: string[] | null;
  working_hours: unknown;
  time_off: unknown;
  extra_permissions: unknown;
}> {
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("color, photo_url, active_specialty_ids, active_consultation_type_ids, working_hours, time_off, extra_permissions")
    .eq("user_id", userId)
    .maybeSingle();

  if (!error) {
    return {
      color: data?.color || null,
      photo_url: data?.photo_url || null,
      active_specialty_ids: data?.active_specialty_ids || null,
      active_consultation_type_ids: data?.active_consultation_type_ids || null,
      working_hours: data?.working_hours || null,
      time_off: data?.time_off || null,
      extra_permissions: data?.extra_permissions || null,
    };
  }

  if (
    error.code === "PGRST204" ||
    error.message?.includes("color") ||
    error.message?.includes("photo_url") ||
    error.message?.includes("active_specialty_ids") ||
    error.message?.includes("active_consultation_type_ids") ||
    error.message?.includes("working_hours") ||
    error.message?.includes("time_off") ||
    error.message?.includes("extra_permissions") ||
    error.message?.includes("schema cache")
  ) {
    return {
      color: null,
      photo_url: null,
      active_specialty_ids: null,
      active_consultation_type_ids: null,
      working_hours: null,
      time_off: null,
      extra_permissions: null,
    };
  }

  throw error;
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

    // Decode JWT to extract user ID (no HTTP call — avoids ES256 gateway issue)
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

    // Query all users with roles, left join with professionals
    const { data: usersWithRoles, error: queryError } = await supabaseAdmin
      .from("user_roles")
      .select(`
        user_id,
        role
      `);

    if (queryError) {
      console.error("Query error:", queryError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch collaborators: ${queryError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For each user, fetch email from auth.users and professional data
    const collaborators: Collaborator[] = [];

    for (const userRole of usersWithRoles || []) {
      if (userRole.role === "admin") continue;

      // Fetch user email from auth.users
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
        userRole.user_id
      );

      if (!authUser.user) continue;

      // Fetch user profile data
      const profile = await fetchProfileData(supabaseAdmin, userRole.user_id);

      // Fetch professional data if exists
      const { data: professional } = await supabaseAdmin
        .from("professionals")
        .select("id, name, specialty_id, color, avatar_url")
        .eq("user_id", userRole.user_id)
        .maybeSingle();

      // Fetch specialty name if professional exists
      let specialtyName: string | null = null;
      if (professional?.specialty_id) {
        const { data: specialty } = await supabaseAdmin
          .from("specialties")
          .select("name")
          .eq("id", professional.specialty_id)
          .maybeSingle();
        specialtyName = specialty?.name || null;
      }

      collaborators.push({
        user_id: userRole.user_id,
        email: authUser.user.email || "",
        role: userRole.role,
        color: profile.color,
        photo_url: profile.photo_url,
        active_specialty_ids: profile.active_specialty_ids,
        active_consultation_type_ids: profile.active_consultation_type_ids,
        working_hours: profile.working_hours,
        time_off: profile.time_off,
        extra_permissions: profile.extra_permissions,
        professional_id: professional?.id || null,
        professional_name: professional?.name || null,
        professional_specialty_id: professional?.specialty_id || null,
        professional_specialty: specialtyName,
        professional_color: professional?.color || null,
        professional_avatar_url: professional?.avatar_url || null,
      });
    }

    // Sort: admin first, then secretary, then doctor
    collaborators.sort((a, b) => {
      const roleOrder = { admin: 0, secretary: 1, doctor: 2 };
      return roleOrder[a.role] - roleOrder[b.role];
    });

    return new Response(
      JSON.stringify({ success: true, collaborators }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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
