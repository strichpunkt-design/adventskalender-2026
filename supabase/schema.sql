-- Strichpunkt Advent 2026: shared wall.
-- Run once in Supabase → SQL editor. Then put the anon key into config.js.

create table if not exists public.posts (
  id uuid primary key,
  door int not null check (door between 1 and 24),
  name text not null check (char_length(name) between 1 and 24),
  kind text not null default 'text' check (kind in ('text','link','image','vote','score','open','recipe')),
  -- Recipes need room for ingredients and steps; everything else stays short.
  body text not null default '' check (char_length(body) <= case when kind = 'recipe' then 2000 else 280 end),
  url text not null default '' check (char_length(url) <= 300 and (url = '' or url like 'https://%')),
  image text check (image is null or image like 'https://%'),
  token text not null,
  created_at timestamptz not null default now()
);
create index if not exists posts_door on public.posts (door, created_at desc);

alter table public.posts enable row level security;
create policy "anyone reads" on public.posts for select to anon using (true);
create policy "anyone adds" on public.posts for insert to anon with check (true);

-- The token column proves ownership and is never readable.
revoke all on public.posts from anon;
grant insert on public.posts to anon;
grant select (id, door, name, kind, body, url, image, created_at) on public.posts to anon;

-- People can delete only their own posts.
create or replace function public.delete_post(p_id uuid, p_token text) returns void
language sql security definer set search_path = public as
$$ delete from posts where id = p_id and token = p_token $$;
grant execute on function public.delete_post(uuid, text) to anon;

-- Live updates.
alter publication supabase_realtime add table public.posts;

-- Uploads: public bucket. Photos are shrunk to JPEG in the browser; GIFs and short videos (memes) up to 8 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wall', 'wall', true, 8388608, array['image/jpeg','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "wall upload" on storage.objects for insert to anon with check (bucket_id = 'wall');
create policy "wall read" on storage.objects for select to anon using (bucket_id = 'wall');
