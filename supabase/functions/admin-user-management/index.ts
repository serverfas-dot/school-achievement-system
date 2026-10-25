import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase service configuration");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return response({ error: "Unauthorized" }, 401);
    }

    const token = authorization.slice("Bearer ".length);
    const { data: callerData, error: callerError } = await adminClient.auth.getUser(token);
    if (callerError || !callerData.user) {
      return response({ error: "Unauthorized" }, 401);
    }

    const { data: role, error: roleError } = await adminClient
      .from("user_role_assignments")
      .select("role")
      .eq("user_id", callerData.user.id)
      .eq("role", "super_admin")
      .eq("is_active", true)
      .maybeSingle();

    if (roleError || !role) {
      return response({ error: "Forbidden" }, 403);
    }

    if (req.method !== "POST") {
      return response({ error: "Method not allowed" }, 405);
    }

    const body = await req.json() as {
      action?: string;
      targetUserId?: string;
      email?: string;
      password?: string;
      fullName?: string;
      roles?: string[];
    };

    const email = body.email?.trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return response({ error: "Enter a valid email address" }, 400);
    }

    if (body.password !== undefined && body.password.length < 8) {
      return response({ error: "Password must be at least 8 characters" }, 400);
    }

    if (body.action === "create_user") {
      const roles = body.roles?.filter((role) => ["super_admin", "admin", "teacher"].includes(role)) || [];
      const fullName = body.fullName?.trim();
      if (!fullName || !body.password || roles.length === 0) {
        return response({ error: "Name, password, and at least one role are required" }, 400);
      }

      const { data: created, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
      });
      if (authError || !created.user) {
        return response({ error: "Could not create the staff account" }, 400);
      }

      const { error: profileError } = await adminClient.from("user_roles").insert({
        id: created.user.id,
        email,
        full_name: fullName,
        role: roles[0],
        created_by: callerData.user.id,
      });
      const { error: assignmentError } = await adminClient.from("user_role_assignments").insert(
        roles.map((role) => ({ user_id: created.user.id, role, assigned_by: callerData.user.id }))
      );

      if (profileError || assignmentError) {
        console.error("Staff profile creation failed", profileError || assignmentError);
        return response({ error: "The account was created, but staff access could not be completed" }, 500);
      }

      return response({ success: true, userId: created.user.id });
    }

    if (body.action !== "update_credentials" || !body.targetUserId || !email) {
      return response({ error: "Invalid request" }, 400);
    }

    const isSelf = body.targetUserId === callerData.user.id;
    const { data: targetRoles, error: targetRoleError } = await adminClient
      .from("user_role_assignments")
      .select("role")
      .eq("user_id", body.targetUserId)
      .eq("is_active", true);

    const canUpdateTarget = isSelf
      ? targetRoles?.some((item) => item.role === "super_admin")
      : targetRoles?.some((item) => item.role === "admin" || item.role === "teacher");

    if (targetRoleError || !canUpdateTarget) {
      return response({ error: isSelf ? "Super-admin account not found" : "Only admin or teacher accounts can be changed here" }, 400);
    }

    const update: { email: string; email_confirm: boolean; password?: string } = {
      email,
      email_confirm: true,
    };
    if (body.password) update.password = body.password;

    const { error: authError } = await adminClient.auth.admin.updateUserById(body.targetUserId, update);
    if (authError) {
      return response({ error: "Could not update account credentials" }, 400);
    }

    const { error: profileError } = await adminClient
      .from("user_roles")
      .update({ email })
      .eq("id", body.targetUserId);

    if (profileError) {
      return response({ error: "Account updated, but the staff profile email could not be synchronized" }, 500);
    }

    return response({ success: true });
  } catch (error) {
    console.error("Admin user management failed", error);
    return response({ error: "Request could not be completed" }, 500);
  }
});
