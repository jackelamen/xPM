-- Update the handle_new_user function to also capture display name from metadata
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, email, name)
    values (
        new.id,
        new.email,
        coalesce(
            new.raw_user_meta_data->>'name',
            new.raw_user_meta_data->>'full_name',
            split_part(new.email, '@', 1)
        )
    )
    on conflict (id) do update
        set email = excluded.email,
            name = coalesce(excluded.name, public.profiles.name),
            updated_at = now();
    return new;
end;
$$ language plpgsql security definer;
