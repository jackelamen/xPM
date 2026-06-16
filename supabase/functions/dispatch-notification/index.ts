/**
 * dispatch-notification — Supabase Edge Function
 *
 * Invoked by the `notifications_dispatch` Postgres trigger (via pg_net) with
 * `{ notification_id }`. Loads the notification, the recipient's prefs and push
 * subscriptions, then delivers email (Resend) and Web Push (VAPID) per prefs.
 *
 * Required secrets (supabase secrets set ...):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (auto-provided in the platform)
 *   RESEND_API_KEY        — Resend transactional email API key
 *   EMAIL_FROM            — e.g. "xPM <notify@your-domain.com>"
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@domain.com)
 *   APP_URL               — e.g. https://xpm.vercel.app  (deep links in messages)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "npm:web-push@3.6.7"

const PREF_COLUMNS: Record<string, { email: string; push: string }> = {
    TASK_ASSIGNED:  { email: "task_assigned_email",  push: "task_assigned_push" },
    TASK_COMPLETED: { email: "task_completed_email", push: "task_completed_push" },
    TASK_DUE:       { email: "task_due_email",       push: "task_due_push" },
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

    try {
        const { notification_id } = await req.json()
        if (!notification_id) return json({ error: "notification_id required" }, 400)

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173"
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        })

        // Load notification + recipient profile
        const { data: n, error: nErr } = await admin
            .from("notifications")
            .select("*, recipient:recipient_id(id, email, name)")
            .eq("id", notification_id)
            .single()
        if (nErr || !n) return json({ error: "notification not found" }, 404)

        const prefCol = PREF_COLUMNS[n.type]
        if (!prefCol) return json({ error: `unknown type ${n.type}` }, 400)

        // Prefs (default to enabled if no row exists)
        const { data: prefs } = await admin
            .from("notification_prefs")
            .select("*")
            .eq("user_id", n.recipient_id)
            .maybeSingle()
        const wantEmail = prefs ? prefs[prefCol.email] !== false : true
        const wantPush = prefs ? prefs[prefCol.push] !== false : true

        const taskUrl = n.task_id ? `${appUrl}/tasks/${n.task_id}` : appUrl
        const results: Record<string, unknown> = {}

        // ---- Email via Resend ----
        const resendKey = Deno.env.get("RESEND_API_KEY")
        if (wantEmail && resendKey && n.recipient?.email && !n.email_sent_at) {
            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${resendKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: Deno.env.get("EMAIL_FROM") || "xPM <onboarding@resend.dev>",
                    to: [n.recipient.email],
                    subject: n.title,
                    html: emailHtml(n.title, n.body ?? "", taskUrl),
                }),
            })
            results.email = res.ok ? "sent" : `error ${res.status}`
            if (res.ok) {
                await admin.from("notifications")
                    .update({ email_sent_at: new Date().toISOString() })
                    .eq("id", n.id)
            }
        } else {
            results.email = wantEmail ? "skipped" : "disabled"
        }

        // ---- Web Push via VAPID ----
        const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")
        const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")
        if (wantPush && vapidPublic && vapidPrivate && !n.push_sent_at) {
            webpush.setVapidDetails(
                Deno.env.get("VAPID_SUBJECT") || "mailto:notify@example.com",
                vapidPublic,
                vapidPrivate,
            )
            const { data: subs } = await admin
                .from("push_subscriptions")
                .select("*")
                .eq("user_id", n.recipient_id)

            const payload = JSON.stringify({
                title: n.title,
                body: n.body ?? "",
                url: taskUrl,
                type: n.type,
            })

            let pushed = 0
            for (const s of subs ?? []) {
                try {
                    await webpush.sendNotification(
                        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                        payload,
                    )
                    pushed++
                } catch (e: any) {
                    // 404/410 = expired subscription; clean it up.
                    if (e?.statusCode === 404 || e?.statusCode === 410) {
                        await admin.from("push_subscriptions").delete().eq("id", s.id)
                    }
                }
            }
            results.push = `sent ${pushed}/${subs?.length ?? 0}`
            if (pushed > 0) {
                await admin.from("notifications")
                    .update({ push_sent_at: new Date().toISOString() })
                    .eq("id", n.id)
            }
        } else {
            results.push = wantPush ? "skipped" : "disabled"
        }

        return json({ ok: true, results })
    } catch (err: any) {
        console.error("dispatch-notification error:", err)
        return json({ error: err?.message || "Internal error" }, 500)
    }
})

function emailHtml(title: string, body: string, url: string): string {
    return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
        <tr><td style="padding:24px 28px">
          <h1 style="margin:0 0 8px;font-size:18px;color:#111827">${escapeHtml(title)}</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#374151">${escapeHtml(body)}</p>
          <a href="${escapeHtml(url)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">View task</a>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #f0f0f0">
          <p style="margin:0;font-size:12px;color:#9ca3af">You're receiving this from xPM. Manage notifications in Settings.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
    ))
}
