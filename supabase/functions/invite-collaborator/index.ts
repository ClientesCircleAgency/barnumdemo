// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  role: "secretary" | "doctor";
  professional?: {
    mode: "create" | "link";
    id?: string; // when mode="link"
    name?: string; // when mode="create"
    specialty_id?: string | null;
    color?: string | null;
  } | null;
}

interface InviteResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
  };
  role?: string;
  professional?: {
    id: string;
  };
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

    // Service role client (for admin operations)
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

    // If role is doctor, professional config must be provided
    if (body.role === "doctor" && !body.professional) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Professional configuration required for doctor role",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate professional mode
    if (body.professional) {
      if (!["create", "link"].includes(body.professional.mode)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid professional mode. Must be 'create' or 'link'",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (body.professional.mode === "link" && !body.professional.id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "professional.id required when mode='link'",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (body.professional.mode === "create" && !body.professional.name) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "professional.name required when mode='create'",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    let professionalId: string | undefined;

    // Step 3: Handle professional linking/creation (only for doctors)
    if (body.role === "doctor" && body.professional) {
      if (body.professional.mode === "link") {
        // Link to existing professional
        const targetProfessionalId = body.professional.id!;

        // Validate professional exists and user_id is null
        const { data: existingProf, error: profCheckError } =
          await supabaseAdmin
            .from("professionals")
            .select("id, user_id")
            .eq("id", targetProfessionalId)
            .maybeSingle();

        if (profCheckError || !existingProf) {
          // Cleanup
          await supabaseAdmin.auth.admin.deleteUser(invitedUserId);
          await supabaseAdmin
            .from("user_roles")
            .delete()
            .eq("user_id", invitedUserId);
          return new Response(
            JSON.stringify({
              success: false,
              error: "Professional not found",
            }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (existingProf.user_id !== null) {
          // Cleanup
          await supabaseAdmin.auth.admin.deleteUser(invitedUserId);
          await supabaseAdmin
            .from("user_roles")
            .delete()
            .eq("user_id", invitedUserId);
          return new Response(
            JSON.stringify({
              success: false,
              error: "Professional already linked to another user",
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update professional.user_id
        const { error: linkError } = await supabaseAdmin
          .from("professionals")
          .update({ user_id: invitedUserId })
          .eq("id", targetProfessionalId);

        if (linkError) {
          console.error("Professional link error:", linkError);
          // Cleanup
          await supabaseAdmin.auth.admin.deleteUser(invitedUserId);
          await supabaseAdmin
            .from("user_roles")
            .delete()
            .eq("user_id", invitedUserId);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Failed to link professional: ${linkError.message}`,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        professionalId = targetProfessionalId;
      } else if (body.professional.mode === "create") {
        // Create new professional
        const { data: newProf, error: createProfError } = await supabaseAdmin
          .from("professionals")
          .insert({
            name: body.professional.name!,
            specialty_id: body.professional.specialty_id || null,
            color: body.professional.color || "#6366f1",
            user_id: invitedUserId,
          })
          .select("id")
          .single();

        if (createProfError || !newProf) {
          console.error("Professional creation error:", createProfError);
          // Cleanup
          await supabaseAdmin.auth.admin.deleteUser(invitedUserId);
          await supabaseAdmin
            .from("user_roles")
            .delete()
            .eq("user_id", invitedUserId);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Failed to create professional: ${createProfError?.message}`,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        professionalId = newProf.id;
      }
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

    if (professionalId) {
      response.professional = { id: professionalId };
    }

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
