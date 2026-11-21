-- Run this in the Supabase SQL Editor for your project.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  prompt text not null,
  image_path text not null,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Users can read their own projects"
on public.projects for select
using (auth.uid() = user_id);

create policy "Users can insert their own projects"
on public.projects for insert
with check (auth.uid() = user_id);

create policy "Users can delete their own projects"
on public.projects for delete
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('thumbnatior-thumbnails', 'thumbnatior-thumbnails', false)
on conflict (id) do nothing;

create policy "Users can read their own thumbnail files"
on storage.objects for select
using (
  bucket_id = 'thumbnatior-thumbnails'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload their own thumbnail files"
on storage.objects for insert
with check (
  bucket_id = 'thumbnatior-thumbnails'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own thumbnail files"
on storage.objects for delete
using (
  bucket_id = 'thumbnatior-thumbnails'
  and (storage.foldername(name))[1] = auth.uid()::text
);
