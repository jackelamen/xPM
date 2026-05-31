/**
 * send-workspace-invite — Supabase Edge Function
 *
 * Called by the xPM frontend when an admin invites a new member by email.
 * Creates a workspace_invites record and sends an email with the invite link.
 *
 * Request body:
 *   { workspace_id: string, email: string, role: "admin"|"member" }
 *
 * Required secrets (set via `supabase secrets set`):
 *   SUPABASE_SERVICE_ROLE_KEY  — service role key for admin DB operations
 *   APP_URL                    — production URL, e.g. https://xpm.vercel.app
 *
 * Email is sent via Supabase's built-in SMTP (free tier) or your custom SMTP
 * configured in the Supabase dashboard under Authentication → SMTP Settings.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    try {
        // Auth check — must be called by a logged-in user
        const authHeader = req.headers.get("Authorization")
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        const { workspace_id, email, role = "member" } = await req.json()

        if (!workspace_id || !email) {
            return new Response(JSON.stringify({ error: "workspace_id and email are required" }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173"

        // Admin client (service role) for DB writes
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        })

        // User client (from request JWT) to verify caller identity + admin role
        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
            global: { headers: { Authorization: authHeader } }
        })

        // Get caller identity
        const { data: { user }, error: authError } = await userClient.auth.getUser()
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        // Verify caller is an admin of this workspace
        const { data: membership } = await adminClient
            .from("workspace_members")
            .select("role")
            .eq("workspace_id", workspace_id)
            .eq("user_id", user.id)
            .single()

        if (!membership || membership.role !== "admin") {
            return new Response(JSON.stringify({ error: "Only workspace admins can send invites" }), {
                status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        // Get workspace name
        const { data: workspace } = await adminClient
            .from("workspaces")
            .select("name")
            .eq("id", workspace_id)
            .single()

        // Get inviter name
        const { data: inviterProfile } = await adminClient
            .from("profiles")
            .select("name")
            .eq("id", user.id)
            .single()

        const inviterName = inviterProfile?.name || user.email || "A teammate"

        // Check for existing pending invite
        const { data: existing } = await adminClient
            .from("workspace_invites")
            .select("id, token, expires_at")
            .eq("workspace_id", workspace_id)
            .eq("email", email.toLowerCase())
            .eq("status", "pending")
            .single()

        let token: string
        if (existing && new Date(existing.expires_at) > new Date()) {
            // Reuse existing token (resend)
            token = existing.token
        } else {
            // Create new invite
            const { data: invite, error: inviteError } = await adminClient
                .from("workspace_invites")
                .insert({
                    workspace_id,
                    invited_by: user.id,
                    email: email.toLowerCase(),
                    role,
                })
                .select("token")
                .single()

            if (inviteError) throw inviteError
            token = invite.token
        }

        const inviteLink = `${appUrl}/accept-invite?token=${token}`

        // Send email via Supabase Auth admin API (uses your configured SMTP)
        const emailPayload = {
            email: email.toLowerCase(),
            data: {
                invite_link: inviteLink,
                workspace_name: workspace?.name || "a workspace",
                inviter_name: inviterName,
                role,
            },
        }

        // Use Supabase's built-in invite email — or send a custom one via fetch to your SMTP
        // Here we use a direct fetch to Supabase Auth admin to trigger an invite email
        const emailRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${serviceRoleKey}`,
                "apikey": serviceRoleKey,
            },
            body: JSON.stringify({
                email: email.toLowerCase(),
                email_confirm: false,
                // Supabase will send a "magic link" — we override with our custom invite link below
            }),
        })

        // Whether or not the user already exists, send our custom invite email
        // via Supabase Auth's `inviteUserByEmail` behavior, or fall back to a raw email send
        const customEmailRes = await fetch(`${supabaseUrl}/auth/v1/invite`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${serviceRoleKey}`,
                "apikey": serviceRoleKey,
            },
            body: JSON.stringify({
                email: email.toLowerCase(),
                data: {
                    invite_link: inviteLink,
                    workspace_name: workspace?.name || "a workspace",
                    inviter_name: inviterName,
                },
                redirect_to: inviteLink,
            }),
        })

        // If Supabase auth invite failed, still return success since the invite record exists
        // The user can be re-invited, and the token link is valid for 7 days.
        const responseData = {
            success: true,
            invite_link: inviteLink, // Returned to frontend for manual sharing fallback
            token,
            message: customEmailRes.ok
                ? `Invite sent to ${email}`
                : `Invite created. Email delivery may be delayed — share this link manually: ${inviteLink}`,
        }

        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        })

    } catch (err) {
        console.error("send-workspace-invite error:", err)
        return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
    }
})
