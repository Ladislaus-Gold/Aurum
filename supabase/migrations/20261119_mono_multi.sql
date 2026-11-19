-- Несколько подключений Monobank (свой токен и токен жены) и несколько карт.
-- Старые таблицы mono_settings и mono_state не удаляются: прежняя версия функции продолжает работать (откат).

create table if not exists public.mono_connections (
  id bigint generated always as identity primary key,
  label text not null default 'Monobank',
  token text not null unique,
  webhook_secret text not null unique,
  client_name text,
  connected_at timestamptz not null default now()
);
alter table public.mono_connections enable row level security; -- без политик: доступна только функции (service role)

insert into public.mono_connections (label, token, webhook_secret, client_name, connected_at)
select 'Monobank', s.token, s.webhook_secret, s.client_name, coalesce(s.connected_at, now())
from public.mono_settings s
where s.id = 1 and s.token is not null and s.webhook_secret is not null
on conflict (token) do nothing;

alter table public.accounts
  add column if not exists mono_conn_id bigint references public.mono_connections(id) on delete set null,
  add column if not exists mono_type text,
  add column if not exists mono_mask text;

update public.accounts a
set mono_conn_id = (select id from public.mono_connections order by id limit 1),
    mono_mask = (select card_mask from public.mono_settings where id = 1)
where a.mono_account_id is not null and a.mono_conn_id is null;

create table if not exists public.mono_card_state (
  mono_account_id text primary key,
  balance_kop bigint,
  credit_limit_kop bigint not null default 0,
  updated_at timestamptz not null default now(),
  source text,
  polled_at timestamptz
);
alter table public.mono_card_state enable row level security;
drop policy if exists "owner only" on public.mono_card_state;
create policy "owner only" on public.mono_card_state for all to authenticated
  using (auth.uid() = '87c04c71-67ca-4fc4-bfb4-c9c3cf451ae9'::uuid)
  with check (auth.uid() = '87c04c71-67ca-4fc4-bfb4-c9c3cf451ae9'::uuid);

insert into public.mono_card_state (mono_account_id, balance_kop, credit_limit_kop, updated_at, source)
select a.mono_account_id, ms.balance_kop, coalesce(ms.credit_limit_kop, 0), ms.updated_at, ms.source
from public.accounts a, public.mono_state ms
where a.mono_account_id is not null and ms.id = 1
on conflict (mono_account_id) do nothing;

-- Остатки: живой баланс берётся по каждой карте отдельно
create or replace view public.account_balances as
 WITH calc AS (
         SELECT a_1.id,
            COALESCE(sum(
                CASE
                    WHEN (t.action = ANY (ARRAY['INCOME'::text, 'RETURN'::text])) AND t.account_id = a_1.id THEN t.amount
                    WHEN t.action = 'EXPENSE'::text AND t.account_id = a_1.id THEN - t.amount
                    WHEN t.action = 'TRANSFER'::text AND t.to_account_id = a_1.id THEN COALESCE(t.to_amount, t.amount)
                    WHEN t.action = 'TRANSFER'::text AND t.from_account_id = a_1.id THEN - t.amount
                    ELSE 0::numeric
                END), 0::numeric)::numeric(14,2) AS balance
           FROM accounts a_1
             LEFT JOIN transactions t ON a_1.id = t.account_id OR a_1.id = t.from_account_id OR a_1.id = t.to_account_id
          GROUP BY a_1.id
        )
 SELECT a.id,
    a.name,
    a.currency,
    a.is_monobank,
        CASE
            WHEN a.is_monobank AND ms.balance_kop IS NOT NULL THEN round((ms.balance_kop - ms.credit_limit_kop)::numeric / 100.0, 2)
            ELSE c.balance
        END::numeric(14,2) AS balance,
    a.is_monobank AND ms.balance_kop IS NOT NULL AS live,
        CASE
            WHEN a.is_monobank THEN ms.updated_at
            ELSE NULL::timestamp with time zone
        END AS live_at,
        CASE
            WHEN a.is_monobank AND ms.balance_kop IS NOT NULL THEN round(ms.balance_kop::numeric / 100.0, 2)
            ELSE NULL::numeric
        END AS available,
        CASE
            WHEN a.is_monobank AND ms.balance_kop IS NOT NULL THEN round(ms.credit_limit_kop::numeric / 100.0, 2)
            ELSE NULL::numeric
        END AS credit_limit,
    a.is_foreign
   FROM accounts a
     JOIN calc c ON c.id = a.id
     LEFT JOIN mono_card_state ms ON ms.mono_account_id = a.mono_account_id;

-- Расписание: секрет берём из первого подключения
create or replace function public.mono_enable_polling(function_url text)
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $function$
begin
  perform cron.unschedule(jobname) from cron.job where jobname in ('mono-poll', 'mono-balance');
  perform cron.schedule('mono-poll', '*/2 * * * *', format(
    $cmd$ select net.http_get(
            url := %L || '?action=poll&secret=' || (select webhook_secret from public.mono_connections order by id limit 1),
            timeout_milliseconds := 20000) $cmd$, function_url));
  perform cron.schedule('mono-balance', '*/30 * * * *', format(
    $cmd$ select net.http_get(
            url := %L || '?action=balance&secret=' || (select webhook_secret from public.mono_connections order by id limit 1),
            timeout_milliseconds := 20000) $cmd$, function_url));
end
$function$;

-- Удалять нельзя только карту, которая сейчас подключена к банку
create or replace function public.delete_account(p_id bigint, p_to bigint default null)
returns void language plpgsql set search_path to 'public' as $function$
declare
  a public.accounts%rowtype;
  t public.accounts%rowtype;
  n integer;
begin
  select * into a from public.accounts where id = p_id;
  if not found then raise exception 'Счёт не найден'; end if;
  if a.mono_account_id is not null then
    raise exception 'Карту Monobank нельзя удалить, пока она подключена: отключи её в Ещё → Monobank';
  end if;

  select count(*) into n from public.transactions
    where account_id = p_id or from_account_id = p_id or to_account_id = p_id;

  if n > 0 or p_to is not null then
    if p_to is null or p_to = p_id then raise exception 'Выберите счёт для переноса'; end if;
    select * into t from public.accounts where id = p_to;
    if not found then raise exception 'Счёт для переноса не найден'; end if;
    if t.is_foreign is distinct from a.is_foreign or (a.is_foreign and t.currency is distinct from a.currency) then
      raise exception 'Перенос возможен только на счёт той же валюты';
    end if;
    update public.transactions set account_id = p_to where account_id = p_id;
    update public.transactions set from_account_id = p_to where from_account_id = p_id;
    update public.transactions set to_account_id = p_to where to_account_id = p_id;
  end if;

  update public.rules set from_account_id = p_to where from_account_id = p_id;
  update public.rules set to_account_id = p_to where to_account_id = p_id;
  update public.categories set target_account_id = p_to where target_account_id = p_id;
  update public.recurring_payments set account_id = p_to where account_id = p_id;
  if a.is_budget_source then
    update public.accounts set is_budget_source = false where id = p_id;
    if p_to is not null then update public.accounts set is_budget_source = true where id = p_to; end if;
  end if;
  delete from public.accounts where id = p_id;
end;
$function$;
