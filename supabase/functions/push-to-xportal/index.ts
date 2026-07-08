/**
 * push-to-xportal — Supabase Edge Function
 *
 * Pushes an xPlan initiative's client plan (phases, milestones, KPIs) to
 * xPortal through its xPM bridge. Always sends the idempotent `space.link`
 * action: first push creates the portal client + project, re-pushes upsert
 * by xpm_project_id. Manual-only — fired from the initiative drawer.
 *
 * Request body: { initiative_id: string }
 *
 * Required secrets (set via `supabase secrets set`):
 *   XPORTAL_BRIDGE_URL      — e.g. https://xportal-vert.vercel.app/api/bridge/xpm
 *   XPM_API_BRIDGE_SECRET   — must match xPortal's XPM_API_BRIDGE_SECRET
 *   SUPABASE_SERVICE_ROLE_KEY (provided by platform)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

    try {
        const authHeader = req.headers.get("Authorization")
        if (!authHeader) return json({ error: "Unauthorized" }, 401)

        const { initiative_id } = await req.json()
        if (!initiative_id) return json({ error: "initiative_id is required" }, 400)

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!
        const bridgeUrl = Deno.env.get("XPORTAL_BRIDGE_URL")
        const bridgeSecret = Deno.env.get("XPM_API_BRIDGE_SECRET")
        if (!bridgeUrl || !bridgeSecret) {
            return json({ error: "XPORTAL_BRIDGE_URL / XPM_API_BRIDGE_SECRET secrets are not configured" }, 500)
        }

        // Caller identity via their JWT; RLS on this client enforces workspace
        // membership, so if the initiative comes back the caller may push it.
        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
            global: { headers: { Authorization: authHeader } },
        })

        const { data: initiative, error: initErr } = await userClient
            .from("roadmap_initiatives")
            .select("*, space:spaces(id, name, company_id)")
            .eq("id", initiative_id)
            .maybeSingle()
        if (initErr) return json({ error: initErr.message }, 500)
        if (!initiative) return json({ error: "Initiative not found (or no access)" }, 404)
        if (!initiative.space) {
            return json({ error: "Link the initiative to a Space first — xPortal needs a client to attach the plan to." }, 400)
        }

        const [{ data: phases }, { data: milestones }, { data: kpis }] = await Promise.all([
            userClient.from("xplan_phases").select("*").eq("initiative_id", initiative_id).order("sort_order"),
            userClient.from("xplan_milestones").select("*").eq("initiative_id", initiative_id).order("sort_order"),
            userClient.from("xplan_kpis").select("*").eq("initiative_id", initiative_id).order("sort_order"),
        ])

        // Contact for a brand-new client: prefer what's on the initiative
        // itself, else fall back to a CRM contact on the space's company.
        // If neither is set, fabricate a placeholder so linkSpace can still
        // create the client — the operator fixes the real contact in
        // xPortal's admin panel before the client ever logs in. Skipped
        // entirely when xportal_client_id targets an existing client.
        let contacts: { name: string; email: string }[] = []
        if (!initiative.xportal_client_id) {
            if (initiative.contact_email) {
                contacts = [{ name: initiative.contact_name || "Client contact", email: initiative.contact_email }]
            } else if (initiative.space.company_id) {
                const { data } = await userClient
                    .from("contacts")
                    .select("name, email")
                    .eq("company_id", initiative.space.company_id)
                    .not("email", "is", null)
                contacts = (data || []).filter((c) => c.email)
            }
            if (contacts.length === 0) {
                contacts = [{
                    name: "New client — update in xPortal admin",
                    email: `new-client-${initiative.id.slice(0, 8)}@placeholder.xportal.cloud`,
                }]
            }
        }

        const activePhase = (phases || []).find((p) => p.status === "active")

        const payload = {
            action: "space.link",
            xpm_space_id: initiative.space.id,
            space_name: initiative.space.name,
            xportal_client_id: initiative.xportal_client_id || undefined,
            contacts,
            projects: [{
                // Stable dedupe key on the portal side: the linked xPM project
                // if the initiative has one, otherwise the initiative itself.
                xpm_project_id: initiative.xpm_project_id || initiative.id,
                title: initiative.title,
                description: initiative.description || undefined,
                current_phase: activePhase?.title,
                target_date: initiative.end_date || undefined,
                phases: (phases || []).map((p) => ({
                    title: p.title, starts_on: p.starts_on, ends_on: p.ends_on, status: p.status,
                })),
                milestones: (milestones || []).map((m) => ({
                    title: m.title, starts_on: m.starts_on, status: m.status,
                })),
                kpis: (kpis || []).map((k) => ({
                    name: k.name, kind: k.kind, target_value: k.target_value,
                    current_value: k.current_value, unit: k.unit, direction: k.direction,
                })),
            }],
        }

        const res = await fetch(bridgeUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-XPM-Bridge-Secret": bridgeSecret,
            },
            body: JSON.stringify(payload),
        })
        const result = await res.json().catch(() => ({}))
        if (!res.ok) {
            return json({ error: result?.error || `xPortal bridge responded ${res.status}` }, 502)
        }

        // Stamp the push (service role — last_pushed_at is server-owned).
        const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
            auth: { autoRefreshToken: false, persistSession: false },
        })
        await adminClient
            .from("roadmap_initiatives")
            .update({ last_pushed_at: new Date().toISOString() })
            .eq("id", initiative_id)

        return json({ ok: true, portal_url: result.portal_url, projects: result.projects })
    } catch (err) {
        return json({ error: (err as Error).message }, 500)
    }
})
