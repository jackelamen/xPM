# xPM — Deployment Guide

## Overview

xPM deploys as a Vite SPA on Vercel, backed by a cloud Supabase project.
Local development uses a local Supabase stack (Docker). Production uses a
separate cloud Supabase project on supabase.com.

---

## Step 1 — Create a cloud Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose your organisation, give the project a name (e.g. `xpm-prod`), and set a strong database password. Save it somewhere safe.
4. Wait for the project to finish provisioning (~1–2 min).
5. Go to **Settings → API** and note:
   - **Project URL** — e.g. `https://abcdefghijkl.supabase.co`
   - **Anon/public key** — the `anon` key under "Project API keys"

---

## Step 2 — Link local Supabase to the cloud project

In your terminal from the `~/Documents/edgex-pm` directory:

```bash
# Log in to Supabase CLI (one-time)
supabase login

# Link your local project to the cloud project
# Find your project ref in the cloud project URL: https://app.supabase.com/project/YOUR_REF
supabase link --project-ref YOUR_PROJECT_REF
```

You'll be prompted for your database password (set in Step 1).

---

## Step 3 — Push all migrations to cloud

```bash
supabase db push
```

This runs all 8 migration files against the cloud database in order:
- `20260531000001_initial_schema.sql`
- `20260531000002_create_workspace_fn.sql`
- `20260531000003_improve_profile_trigger.sql`
- `20260531000004_task_links_and_milestones.sql`
- `20260531000005_crm_record_links.sql`
- `20260531000006_project_notes.sql`
- `20260531000007_task_dependencies.sql`
- `20260531000008_pulse_bridge.sql`

Verify the schema in the Supabase dashboard under **Table Editor**.

---

## Step 4 — Enable email auth in Supabase

1. In the cloud project, go to **Authentication → Providers**.
2. Make sure **Email** is enabled.
3. Under **Authentication → Email Templates**, customise the invite and confirmation emails if desired.
4. Under **Authentication → URL Configuration**, set:
   - **Site URL**: your Vercel production URL (e.g. `https://xpm.vercel.app`)
   - **Redirect URLs**: add `https://xpm.vercel.app/**` and `https://xpm.vercel.app/accept-invite`

---

## Step 5 — Deploy the Edge Function (email invites)

```bash
# Deploy the workspace invite function
supabase functions deploy send-workspace-invite --project-ref YOUR_PROJECT_REF

# Set the required secrets for the function
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key --project-ref YOUR_PROJECT_REF
supabase secrets set APP_URL=https://your-vercel-domain.vercel.app --project-ref YOUR_PROJECT_REF
```

The service role key is in **Settings → API → Service role key** (never expose in client code).

---

## Step 6 — Deploy to Vercel

### Option A — Vercel CLI (recommended for first deploy)

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# From the project root
cd ~/Documents/edgex-pm
vercel

# Follow the prompts:
# - Link to your Vercel account
# - Create a new project or link to existing
# - Framework: Vite
# - Build command: npm run build  (default)
# - Output directory: dist  (default)
```

### Option B — Vercel dashboard

1. Push your code to GitHub (see git commands below).
2. Go to [vercel.com](https://vercel.com) → **New Project**.
3. Import your GitHub repo.
4. Framework preset: **Vite**.
5. Build command: `npm run build`
6. Output directory: `dist`
7. Click **Deploy**.

---

## Step 7 — Set environment variables in Vercel

In the Vercel project dashboard → **Settings → Environment Variables**, add:

| Name | Value | Environment |
|------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://YOUR_REF.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | your anon key | Production, Preview, Development |

After adding variables, **redeploy** the project for them to take effect:

```bash
vercel --prod
```

---

## Step 8 — Verify the deployment

1. Open your Vercel production URL.
2. Sign up for a new account.
3. Create a workspace and a project.
4. Add a task and confirm it appears.
5. Navigate to `/workload`, `/crm`, and a project's Gantt tab.
6. Check the Supabase dashboard **Logs → Edge Functions** to confirm the invite function is reachable.

---

## Ongoing workflow

### Local development
```bash
# Start Docker Desktop first, then:
supabase start
npm run dev
```

### Applying new migrations locally
```bash
supabase migration up
```

### Applying new migrations to cloud
```bash
supabase db push
```

### Deploying code changes to Vercel
Vercel auto-deploys on every push to your linked branch (usually `main`). Or manually:
```bash
vercel --prod
```

---

## Git push (all current changes)

```bash
cd ~/Documents/edgex-pm && \
git add \
  src/components/ProjectGantt.jsx \
  src/components/PulseBridge.jsx \
  src/components/ProjectTasks.jsx \
  src/pages/ProjectDetails.jsx \
  supabase/migrations/20260531000007_task_dependencies.sql \
  supabase/migrations/20260531000008_pulse_bridge.sql \
  vercel.json \
  .env.production \
  .gitignore \
  DEPLOY.md && \
git commit -m "feat: Gantt view, Pulse bridge, deployment config" && \
git push origin main
```

---

## Architecture notes

- **SPA routing**: `vercel.json` rewrites all routes to `index.html` so React Router works.
- **Auth redirect**: Supabase email links redirect to your Vercel URL. Make sure the Site URL and Redirect URLs in Supabase Auth settings match your Vercel domain exactly.
- **Egress**: xPM is designed to be conservative with Supabase bandwidth. Avoid enabling Realtime subscriptions broadly. Monitor usage under **Reports → Database** in the Supabase dashboard.
- **Pulse integration**: xPM and Pulse share the same Supabase project (`mdkyijbgvxedelcqcouu` for TheEDGEx). When deploying xPM to production, point `VITE_SUPABASE_URL` at that shared project so Pulse task links work across apps.
