// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Collaborator {
  user_id: string;
  email: string;
  role: "admin" | "secretary" | "doctor";
  professional_id?: string | null;
  professional_name?: string | null;
  professional_specialty?: string | null;
  professional_color?: string | null;
}

interface ListResponse {
  success: boolean;
  collaborators?: Collaborator[];
  error?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client with user's JWT (for auth validation)
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Service role client (for querying auth.users)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate user is admin
    const { data: isAdminData, error: roleError } = await supabaseUser.rpc(
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
      // Fetch user email from auth.users
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
        userRole.user_id
      );

      if (!authUser.user) continue;

      // Fetch professional data if exists
      const { data: professional } = await supabaseAdmin
        .from("professionals")
        .select("id, name, specialty_id, color")
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
        professional_id: professional?.id || null,
        professional_name: professional?.name || null,
        professional_specialty: specialtyName,
        professional_color: professional?.color || null,
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
