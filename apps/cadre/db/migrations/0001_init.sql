-- Cadre phase 0: shops, members, connections, agent settings, events and the audit log.
--
-- Two roles:
--   * the migration owner (Neon's default role) owns every table and runs this file;
--   * cadre_app is what the web app connects as. It is subject to row-level security,
--     so every query only sees rows for the shop set with set_config('app.org_id', ...).

do $$
begin
  create role cadre_app nologin;
exception when duplicate_object then null;
end $$;

grant usage on schema public to cadre_app;

-- The shop the current transaction is acting for, or null when none is set.
create function current_org_id() returns uuid
language sql stable
as $$ select nullif(current_setting('app.org_id', true), '')::uuid $$;

-- Shops -----------------------------------------------------------------------

create table orgs (
  id uuid primary key default gen_random_uuid(),
  clerk_org_id text not null unique,
  name text not null check (length(name) between 1 and 120),
  town text check (length(town) <= 80),
  timezone text not null default 'Africa/Nairobi',
  plan text not null default 'free' check (plan in ('free', 'paid')),
  daily_ai_budget_cents integer not null default 0 check (daily_ai_budget_cents >= 0),
  inbound_email_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orgs enable row level security;
create policy orgs_isolation on orgs
  using (id = current_org_id())
  with check (id = current_org_id());
grant select, update (name, town, timezone, updated_at) on orgs to cadre_app;

create table members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id) on delete cascade,
  clerk_user_id text not null,
  role text not null check (role in ('owner', 'manager', 'viewer')),
  display_name text,
  whatsapp_phone text,
  phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, clerk_user_id)
);

alter table members enable row level security;
create policy members_isolation on members
  using (org_id = current_org_id())
  with check (org_id = current_org_id());
grant select, insert, update on members to cadre_app;

-- Connections (M-Pesa, bank, email, WhatsApp) -------------------------------

create table integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id) on delete cascade,
  kind text not null check (kind in (
    'whatsapp', 'daraja_paybill', 'daraja_till', 'sms_forward', 'statement', 'email_forward', 'jenga'
  )),
  label text not null default '',
  status text not null default 'pending' check (status in ('pending', 'active', 'error', 'disabled')),
  config jsonb not null default '{}',
  credential_ref uuid,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, kind, label)
);

alter table integrations enable row level security;
create policy integrations_isolation on integrations
  using (org_id = current_org_id())
  with check (org_id = current_org_id());
grant select, insert, update, delete on integrations to cadre_app;

-- Which agents are on, and their settings -----------------------------------

create table agent_settings (
  org_id uuid not null references orgs (id) on delete cascade,
  agent text not null check (agent in (
    'chief', 'finance', 'inbox', 'operations', 'people', 'marketing', 'legal'
  )),
  enabled boolean not null default false,
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (org_id, agent)
);

alter table agent_settings enable row level security;
create policy agent_settings_isolation on agent_settings
  using (org_id = current_org_id())
  with check (org_id = current_org_id());
grant select, insert, update on agent_settings to cadre_app;

-- Everything that happened, stored once --------------------------------------

create table events (
  id bigint generated always as identity primary key,
  org_id uuid not null references orgs (id) on delete cascade,
  type text not null,
  source text not null,
  source_ref text not null,
  payload jsonb not null default '{}',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (org_id, source, source_ref)
);

create index events_unprocessed on events (org_id, received_at) where processed_at is null;

alter table events enable row level security;
create policy events_isolation on events
  using (org_id = current_org_id())
  with check (org_id = current_org_id());
grant select, insert, update (processed_at) on events to cadre_app;

-- Audit log: append-only and hash-chained per shop --------------------------
--
-- Each row's hash covers the previous row's hash and the row's own content, so an
-- edited or deleted row breaks the chain. seq is assigned under a per-shop lock, so
-- the chain order never depends on which transaction committed first.

create table audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references orgs (id) on delete cascade,
  seq bigint not null,
  actor_type text not null check (actor_type in ('member', 'agent', 'system')),
  actor_id text not null default '',
  action text not null,
  target text not null default '',
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  prev_hash text,
  hash text not null,
  unique (org_id, seq)
);

create function audit_log_row_hash(
  p_prev_hash text, p_org_id uuid, p_seq bigint, p_actor_type text, p_actor_id text,
  p_action text, p_target text, p_data jsonb, p_created_at timestamptz
) returns text
language sql immutable
as $$
  select encode(sha256(convert_to(concat_ws(E'\x1f',
    coalesce(p_prev_hash, ''), p_org_id::text, p_seq::text, p_actor_type, p_actor_id,
    p_action, p_target, p_data::text,
    to_char(p_created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  ), 'UTF8')), 'hex')
$$;

create function audit_log_chain() returns trigger
language plpgsql
as $$
declare
  last_seq bigint;
  last_hash text;
begin
  perform pg_advisory_xact_lock(hashtextextended('audit_log:' || new.org_id::text, 0));
  select seq, hash into last_seq, last_hash
    from audit_log where org_id = new.org_id
    order by seq desc limit 1;
  new.seq := coalesce(last_seq, 0) + 1;
  new.prev_hash := last_hash;
  new.created_at := now();
  new.hash := audit_log_row_hash(new.prev_hash, new.org_id, new.seq, new.actor_type, new.actor_id,
                                 new.action, new.target, new.data, new.created_at);
  return new;
end $$;

create trigger audit_log_chain before insert on audit_log
  for each row execute function audit_log_chain();

create function audit_log_append_only() returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end $$;

create trigger audit_log_append_only before update or delete on audit_log
  for each row execute function audit_log_append_only();

alter table audit_log enable row level security;
create policy audit_log_isolation on audit_log
  using (org_id = current_org_id())
  with check (org_id = current_org_id());
grant select, insert on audit_log to cadre_app;

-- Checks the current shop's chain. Returns the first broken seq, or null if intact.
create function audit_log_verify()
returns table (checked bigint, first_bad_seq bigint)
language plpgsql stable
as $$
declare
  r record;
  expected_prev text := null;
  n bigint := 0;
begin
  for r in select * from audit_log where org_id = current_org_id() order by seq loop
    n := n + 1;
    if r.seq <> n
       or r.prev_hash is distinct from expected_prev
       or r.hash <> audit_log_row_hash(r.prev_hash, r.org_id, r.seq, r.actor_type, r.actor_id,
                                       r.action, r.target, r.data, r.created_at) then
      checked := n; first_bad_seq := r.seq;
      return next; return;
    end if;
    expected_prev := r.hash;
  end loop;
  checked := n; first_bad_seq := null;
  return next;
end $$;

grant execute on function current_org_id() to cadre_app;
grant execute on function audit_log_verify() to cadre_app;

-- Creating a shop -----------------------------------------------------------
--
-- The app can't see a shop's row until it knows the shop's id, so finding or creating
-- it from a Clerk organisation id runs with the owner's rights. It also turns on the
-- default agents and records the creation in the audit log, all in one transaction.

create function ensure_org(p_clerk_org_id text, p_name text, p_actor_id text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id from orgs where clerk_org_id = p_clerk_org_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into orgs (clerk_org_id, name)
    values (p_clerk_org_id, p_name)
    on conflict (clerk_org_id) do nothing
    returning id into v_id;

  if v_id is null then
    -- Another request created it first.
    select id into v_id from orgs where clerk_org_id = p_clerk_org_id;
    return v_id;
  end if;

  insert into agent_settings (org_id, agent, enabled)
    select v_id, a, a in ('chief', 'finance', 'inbox')
    from unnest(array['chief', 'finance', 'inbox', 'operations', 'people', 'marketing', 'legal']) as a;

  insert into audit_log (org_id, actor_type, actor_id, action, target, data)
    values (v_id, 'member', coalesce(p_actor_id, ''), 'shop.created', v_id::text,
            jsonb_build_object('name', p_name));

  return v_id;
end $$;

revoke all on function ensure_org(text, text, text) from public;
grant execute on function ensure_org(text, text, text) to cadre_app;

-- Looks a shop up without creating it. Returns null for an unknown Clerk organisation.
create function org_id_for_clerk(p_clerk_org_id text)
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$ select id from orgs where clerk_org_id = p_clerk_org_id $$;

revoke all on function org_id_for_clerk(text) from public;
grant execute on function org_id_for_clerk(text) to cadre_app;
