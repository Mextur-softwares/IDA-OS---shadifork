-- IDA custom account + cloud state backend for the Supabase project.
-- Run this migration in the Supabase SQL Editor as the project owner.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ida_accounts (
  account_id uuid primary key default gen_random_uuid(),
  display_name text not null,
  name_key text not null unique,
  password_hash text not null,
  session_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ida_states (
  account_id uuid primary key references public.ida_accounts(account_id) on delete cascade,
  state jsonb not null default '{"version":1,"keys":{}}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint ida_states_state_shape check (
    jsonb_typeof(state) = 'object'
    and state->>'version' = '1'
    and jsonb_typeof(state->'keys') = 'object'
  )
);

alter table public.ida_accounts enable row level security;
alter table public.ida_states enable row level security;

revoke all on public.ida_accounts from anon, authenticated;
revoke all on public.ida_states from anon, authenticated;

create or replace function public.ida_create_account(p_name text, p_password text)
returns table(account_id uuid, session_token text, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_name_key text := lower(btrim(p_name));
  v_account_id uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if v_name is null or length(v_name) < 2 or length(v_name) > 40 then
    raise exception 'Name must be between 2 and 40 characters.';
  end if;
  if v_name_key !~ '^[a-z0-9_ -]+$' then
    raise exception 'Name may only contain letters, numbers, spaces, underscores, and hyphens.';
  end if;
  if p_password is null or length(p_password) < 8 or length(p_password) > 128 then
    raise exception 'Password must be between 8 and 128 characters.';
  end if;

  insert into public.ida_accounts(display_name, name_key, password_hash, session_token_hash)
  values (v_name, v_name_key, extensions.crypt(p_password, extensions.gen_salt('bf')), extensions.crypt(v_token, extensions.gen_salt('bf')))
  returning public.ida_accounts.account_id into v_account_id;

  return query select v_account_id, v_token, v_name;
exception
  when unique_violation then
    raise exception 'That IDA name is already taken.';
end;
$$;

create or replace function public.ida_sign_in(p_name text, p_password text)
returns table(account_id uuid, session_token text, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.ida_accounts%rowtype;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select a.* into v_account
  from public.ida_accounts a
  where a.name_key = lower(btrim(p_name));

  if not found or p_password is null
     or v_account.password_hash <> extensions.crypt(p_password, v_account.password_hash) then
    raise exception 'Incorrect name or password.';
  end if;

  update public.ida_accounts
  set session_token_hash = extensions.crypt(v_token, extensions.gen_salt('bf')),
      updated_at = now()
  where ida_accounts.account_id = v_account.account_id;

  return query select v_account.account_id, v_token, v_account.display_name;
end;
$$;

create or replace function public.ida_save_state(p_account_id uuid, p_session_token text, p_state jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object'
     or p_state->>'version' <> '1'
     or jsonb_typeof(p_state->'keys') <> 'object' then
    raise exception 'Invalid IDA state payload.';
  end if;

  if not exists (
    select 1 from public.ida_accounts a
    where a.account_id = p_account_id
      and p_session_token is not null
      and a.session_token_hash = extensions.crypt(p_session_token, a.session_token_hash)
  ) then
    raise exception 'IDA session is invalid. Please sign in again.';
  end if;

  insert into public.ida_states(account_id, state, updated_at)
  values (p_account_id, p_state, now())
  on conflict (account_id) do update
    set state = excluded.state, updated_at = now();

  update public.ida_accounts set updated_at = now() where ida_accounts.account_id = p_account_id;
  return true;
end;
$$;

create or replace function public.ida_load_state(p_account_id uuid, p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state jsonb;
begin
  if not exists (
    select 1 from public.ida_accounts a
    where a.account_id = p_account_id
      and p_session_token is not null
      and a.session_token_hash = extensions.crypt(p_session_token, a.session_token_hash)
  ) then
    raise exception 'IDA session is invalid. Please sign in again.';
  end if;

  select s.state into v_state from public.ida_states s where s.account_id = p_account_id;
  return coalesce(v_state, '{"version":1,"keys":{}}'::jsonb);
end;
$$;

revoke all on function public.ida_create_account(text, text) from public;
revoke all on function public.ida_sign_in(text, text) from public;
revoke all on function public.ida_save_state(uuid, text, jsonb) from public;
revoke all on function public.ida_load_state(uuid, text) from public;

grant execute on function public.ida_create_account(text, text) to anon, authenticated;
grant execute on function public.ida_sign_in(text, text) to anon, authenticated;
grant execute on function public.ida_save_state(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.ida_load_state(uuid, text) to anon, authenticated;
