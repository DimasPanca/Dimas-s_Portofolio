-- Portfolio backend (PRD §10, Appendix C). RLS-first: anonymous visitors can only read published rows;
-- every write needs the single owner account AND a completed MFA challenge (aal2).

create extension if not exists pgcrypto;

create type public.content_status as enum ('draft', 'published', 'archived');

-- ---------------------------------------------------------------- owner + helpers
create table public.owner (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.owner enable row level security;
create policy owner_self_read on public.owner for select to authenticated using (user_id = auth.uid());

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from public.owner o where o.user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

create or replace function public.before_write() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

-- ------------------------------------------------------------------------ media
create table public.media (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,                 -- object path inside the "media" bucket
  width int not null,
  height int not null,
  blurhash text,
  alt jsonb not null,                        -- {"en": "...", "id": "..."}
  mime text not null default 'image/webp',
  bytes int,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------- content
-- Cross-links use slugs (project_slug, achievement_slug) so rows can be seeded and edited in any order.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  status public.content_status not null default 'draft',
  is_placeholder boolean not null default false,
  needs_review boolean not null default false,
  sort_order int not null default 0,
  title jsonb not null,
  role jsonb,
  year int,
  summary jsonb,
  body jsonb,
  stack text[] not null default '{}',
  links jsonb not null default '[]',
  cover_media_id uuid references public.media (id) on delete set null,
  gallery_media_ids uuid[] not null default '{}',
  featured boolean not null default false,
  linked_achievement_slug text,
  link_confirmed boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  status public.content_status not null default 'draft',
  is_placeholder boolean not null default false,
  needs_review boolean not null default false,
  sort_order int not null default 0,
  featured boolean not null default false,
  rank_label jsonb not null,
  rank_tier smallint,
  title jsonb not null,
  type_label jsonb,
  category text not null check (category in ('essay', 'business', 'hackathon', 'ai-ml', 'research', 'certification', 'other')),
  organizer text not null,
  scope text check (scope in ('international', 'national', 'regional', 'campus')),
  location text,
  achieved_on date not null,
  date_precision text not null default 'month' check (date_precision in ('year', 'month', 'day')),
  entry_type text check (entry_type in ('individual', 'team')),
  summary jsonb,
  highlights jsonb not null default '[]',
  tags text[] not null default '{}',
  cover_media_id uuid references public.media (id) on delete set null,
  proofs jsonb not null default '[]',        -- [{kind, label?, url?, mediaId?}] — added later by the owner
  gallery_media_ids uuid[] not null default '{}',
  project_slug text,
  link_confirmed boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  status public.content_status not null default 'draft',
  is_placeholder boolean not null default false,
  needs_review boolean not null default false,
  sort_order int not null default 0,
  kind text not null check (kind in ('work', 'organization')),
  organization text not null,
  role jsonb not null,
  location text,
  start_on date not null,
  end_on date,
  is_current boolean not null default false,
  date_precision text not null default 'month' check (date_precision in ('year', 'month', 'day')),
  summary jsonb,
  highlights jsonb not null default '[]',
  featured_highlights int not null default 3,
  project_slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.education (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  status public.content_status not null default 'draft',
  is_placeholder boolean not null default false,
  needs_review boolean not null default false,
  sort_order int not null default 0,
  institution text not null,
  location text,
  program jsonb not null,
  start_on date not null,
  end_on date,
  is_expected boolean not null default false,
  gpa numeric(3, 2),
  gpa_scale numeric(3, 2) not null default 4.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  status public.content_status not null default 'draft',
  is_placeholder boolean not null default false,
  needs_review boolean not null default false,
  sort_order int not null default 0,
  group_key text not null check (group_key in ('ai', 'web', 'iot', 'tools', 'stack', 'leadership')),
  kind text not null check (kind in ('hard', 'soft')),
  label jsonb not null,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  status public.content_status not null default 'draft',
  is_placeholder boolean not null default false,
  needs_review boolean not null default false,
  sort_order int not null default 0,
  media_id uuid references public.media (id) on delete set null,
  caption jsonb,
  album text,
  event text,
  taken_on date,
  achievement_slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

-- Singleton. Everything in it is shown on the public site (no private notes here).
create table public.site_settings (
  id int primary key default 1 check (id = 1),
  general jsonb not null default '{"defaultLocale": "en", "locales": ["en", "id"]}',
  profile jsonb not null,
  hero jsonb not null,
  availability jsonb,
  credo jsonb,
  socials jsonb not null default '[]',
  contact jsonb not null default '{}',       -- {"email": "...", "whatsappNumber": null | "62...", "whatsappVisible": true}
  seo jsonb not null default '{}',
  cv_path text,                              -- object path inside the "docs" bucket
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------------------- private
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  topic text not null default 'other',
  message text not null,
  locale text,
  ip_hash text,
  user_agent text,
  status text not null default 'new' check (status in ('new', 'read', 'archived', 'spam')),
  created_at timestamptz not null default now()
);
create index messages_rate_idx on public.messages (ip_hash, created_at desc);

create table public.events (
  name text not null,
  day date not null,
  hits int not null default 0,
  primary key (name, day)
);

create table public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid,
  table_name text not null,
  row_id text,
  action text not null,
  old_row jsonb,
  new_row jsonb
);

create table public.publish_runs (
  id uuid primary key default gen_random_uuid(),
  triggered_by uuid,
  triggered_at timestamptz not null default now(),
  note text,
  status text not null default 'triggered',
  placeholders_count int not null default 0,
  summary jsonb
);

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor, table_name, row_id, action, old_row, new_row)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id'),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

-- Daily event counter used by the `track` function (service role only).
create or replace function public.increment_event(event_name text) returns void
language sql security definer set search_path = public as $$
  insert into public.events (name, day, hits) values (event_name, current_date, 1)
  on conflict (name, day) do update set hits = public.events.hits + 1;
$$;
revoke all on function public.increment_event(text) from public, anon, authenticated;

-- Messages are kept for 90 days (PRD §11). Call from a scheduled job, e.g. pg_cron:
--   select cron.schedule('purge-messages', '17 3 * * *', 'select public.purge_old_messages()');
create or replace function public.purge_old_messages() returns int
language plpgsql security definer set search_path = public as $$
declare removed int;
begin
  delete from public.messages where created_at < now() - interval '90 days';
  get diagnostics removed = row_count;
  return removed;
end $$;
revoke all on function public.purge_old_messages() from public, anon, authenticated;

-- ------------------------------------------------------------------ RLS + triggers
do $$
declare t text;
begin
  foreach t in array array['projects', 'achievements', 'experiences', 'education', 'skills', 'gallery_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (status = ''published'' or public.is_owner())', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_owner())', t || '_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_owner()) with check (public.is_owner())', t || '_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_owner())', t || '_del', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.before_write()', t || '_bw', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', t || '_audit', t);
  end loop;
end $$;

alter table public.media enable row level security;
create policy media_read on public.media for select to anon, authenticated using (true);
create policy media_write on public.media for all to authenticated using (public.is_owner()) with check (public.is_owner());

alter table public.site_settings enable row level security;
create policy settings_read on public.site_settings for select to anon, authenticated using (true);
create policy settings_write on public.site_settings for all to authenticated using (public.is_owner()) with check (public.is_owner());
create trigger site_settings_audit after insert or update on public.site_settings
  for each row execute function public.audit_row();

-- Private tables: owner only. Rows are inserted by Edge Functions with the service role (bypasses RLS).
alter table public.messages enable row level security;
create policy messages_owner on public.messages for all to authenticated using (public.is_owner()) with check (public.is_owner());
alter table public.audit_log enable row level security;
create policy audit_owner_read on public.audit_log for select to authenticated using (public.is_owner());
alter table public.publish_runs enable row level security;
create policy publish_owner_read on public.publish_runs for select to authenticated using (public.is_owner());
alter table public.events enable row level security;
create policy events_owner_read on public.events for select to authenticated using (public.is_owner());

-- ---------------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', true, 5242880, array['image/webp', 'image/avif', 'image/jpeg', 'image/png']),
  ('docs', 'docs', true, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy storage_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('media', 'docs') and public.is_owner());
create policy storage_owner_update on storage.objects for update to authenticated
  using (bucket_id in ('media', 'docs') and public.is_owner())
  with check (bucket_id in ('media', 'docs') and public.is_owner());
create policy storage_owner_delete on storage.objects for delete to authenticated
  using (bucket_id in ('media', 'docs') and public.is_owner());
