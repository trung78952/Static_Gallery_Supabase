-- Memory Atlas Supabase setup
-- Run this entire script in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  type text not null check (type in ('image', 'video')),
  url text not null,
  storage_path text,
  location text not null,
  date date not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.media_items add column if not exists storage_path text;

create index if not exists idx_media_items_date on public.media_items(date desc);
create index if not exists idx_media_items_owner on public.media_items(owner_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_media_items_updated_at on public.media_items;
create trigger trg_media_items_updated_at
before update on public.media_items
for each row
execute function public.set_updated_at();

alter table public.media_items enable row level security;

-- Explicit grants to avoid permission ambiguity between anon/authenticated roles.
grant usage on schema public to anon, authenticated;
grant select on public.media_items to anon;
grant select, insert, update, delete on public.media_items to authenticated;

-- Public can read gallery.
drop policy if exists media_items_select_all on public.media_items;
create policy media_items_select_all
on public.media_items
for select
using (true);

-- Logged-in users can insert only their own rows.
drop policy if exists media_items_insert_owner on public.media_items;
create policy media_items_insert_owner
on public.media_items
for insert
to authenticated
with check (owner_id = auth.uid());

-- Logged-in users can update only their own rows.
drop policy if exists media_items_update_owner on public.media_items;
create policy media_items_update_owner
on public.media_items
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Logged-in users can delete only their own rows.
drop policy if exists media_items_delete_owner on public.media_items;
create policy media_items_delete_owner
on public.media_items
for delete
to authenticated
using (owner_id = auth.uid());

-- Storage bucket for gallery uploads.
insert into storage.buckets (id, name, public)
values ('gallery-media', 'gallery-media', true)
on conflict (id) do nothing;

-- Public can read objects from gallery-media bucket.
drop policy if exists storage_gallery_read_public on storage.objects;
create policy storage_gallery_read_public
on storage.objects
for select
using (bucket_id = 'gallery-media');

-- Authenticated users can upload only into their own folder.
-- NOTE: Supabase co 2 phien ban: cu dung 'owner', moi dung 'owner_id'.
-- Neu gap loi "column owner_id does not exist", doi owner_id thanh owner.
drop policy if exists storage_gallery_insert_owner on storage.objects;
create policy storage_gallery_insert_owner
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'gallery-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can update only their own objects.
drop policy if exists storage_gallery_update_owner on storage.objects;
create policy storage_gallery_update_owner
on storage.objects
for update
to authenticated
using (
  bucket_id = 'gallery-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'gallery-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can delete only their own objects.
drop policy if exists storage_gallery_delete_owner on storage.objects;
create policy storage_gallery_delete_owner
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'gallery-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Force PostgREST to refresh schema cache immediately.
notify pgrst, 'reload schema';
