begin;
create table public.clara_bank_connections (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 bank_id text not null check(bank_id in ('falabella','bchile','santander','bci','bestado','itau','scotiabank','bice','edwards')),
 label text not null check(char_length(label) between 1 and 80),
 masked_rut text not null check(char_length(masked_rut)<=24),
 identity_key text not null check(char_length(identity_key)=64),
 status text not null default 'pending' check(status in ('pending','queued','syncing','connected','requires_action','error')),
 message text not null default '',
 error_code text,
 product_id text,
 account_id text,
 snapshot jsonb,
 last_synced_at timestamptz,
 last_attempt_at timestamptz,
 next_attempt_at timestamptz,
 request_id uuid,
 consent_version text not null,
 consented_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,user_id),
 unique(user_id,identity_key),
 unique(user_id,account_id),
 check(snapshot is null or (jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<1500000))
);
create index clara_bank_connections_owner on public.clara_bank_connections(user_id);
alter table public.clara_bank_connections enable row level security;
create policy clara_bank_connections_own_select on public.clara_bank_connections for select to authenticated using ((select auth.uid())=user_id);
create policy clara_bank_connections_own_insert on public.clara_bank_connections for insert to authenticated with check ((select auth.uid())=user_id);
create policy clara_bank_connections_own_update on public.clara_bank_connections for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy clara_bank_connections_own_delete on public.clara_bank_connections for delete to authenticated using ((select auth.uid())=user_id);
revoke all on public.clara_bank_connections from anon,public;
grant select,insert,update,delete on public.clara_bank_connections to authenticated;
create table public.clara_bank_credentials (
 connection_id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 ciphertext text not null check(char_length(ciphertext) between 30 and 4000),
 updated_at timestamptz not null default now(),
 foreign key(connection_id,user_id) references public.clara_bank_connections(id,user_id) on delete cascade
);
create index clara_bank_credentials_owner on public.clara_bank_credentials(user_id);
alter table public.clara_bank_credentials enable row level security;
create policy clara_bank_credentials_own_select on public.clara_bank_credentials for select to authenticated using ((select auth.uid())=user_id);
create policy clara_bank_credentials_own_insert on public.clara_bank_credentials for insert to authenticated with check ((select auth.uid())=user_id);
create policy clara_bank_credentials_own_update on public.clara_bank_credentials for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy clara_bank_credentials_own_delete on public.clara_bank_credentials for delete to authenticated using ((select auth.uid())=user_id);
revoke all on public.clara_bank_credentials from anon,public;
grant select,insert,update,delete on public.clara_bank_credentials to authenticated;
comment on table public.clara_bank_credentials is 'AES-256-GCM ciphertext only; key lives solely in Clara Bank API runtime. Never store bank passwords, sessions, or OTPs in plaintext.';
commit;
