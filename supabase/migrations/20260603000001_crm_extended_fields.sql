-- CRM extended fields for contacts and companies

-- Contacts
ALTER TABLE public.contacts
    ADD COLUMN IF NOT EXISTS name_other text,
    ADD COLUMN IF NOT EXISTS last_contacted_at date,
    ADD COLUMN IF NOT EXISTS photo_url text;

-- Companies
ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS brand_names text,
    ADD COLUMN IF NOT EXISTS phone text,
    ADD COLUMN IF NOT EXISTS address text,
    ADD COLUMN IF NOT EXISTS city text,
    ADD COLUMN IF NOT EXISTS province text,
    ADD COLUMN IF NOT EXISTS country text,
    ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS connection_strength smallint DEFAULT 0 CHECK (connection_strength >= 0 AND connection_strength <= 10),
    ADD COLUMN IF NOT EXISTS photo_url text;
