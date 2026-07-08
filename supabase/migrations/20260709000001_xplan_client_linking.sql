-- xPlan: optional contact info for new-client pushes, and explicit linking to
-- an existing xPortal client (a space can front more than one xPortal client,
-- so xpm_space_id auto-matching alone isn't always enough to disambiguate).
alter table public.roadmap_initiatives
    add column contact_name text,
    add column contact_email text,
    add column xportal_client_id text;
