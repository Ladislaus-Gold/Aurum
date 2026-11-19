-- Валютные счета и обмен (Aurum 0.25.0). Только добавляет: существующие данные не меняются.
alter table public.accounts add column if not exists is_foreign boolean not null default false;
comment on column public.accounts.is_foreign is 'Валютный счёт: вне бюджета, не входит в итоги и доходы/расходы';

alter table public.transactions add column if not exists to_amount numeric check (to_amount is null or to_amount > 0);
alter table public.transactions add column if not exists rate numeric check (rate is null or rate > 0);
comment on column public.transactions.to_amount is 'Для перевода между разными валютами: сумма, зачисленная на счёт-получатель (в его валюте); NULL = равна amount';
comment on column public.transactions.rate is 'Курс, указанный пользователем: если одна сторона в основной валюте, то основная за 1 валютную; иначе валюта получателя за 1 валюту отправителя';

create table if not exists public.app_settings (
  id integer primary key default 1 check (id = 1),
  base_currency text not null default 'UAH',
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "owner only" on public.app_settings;
create policy "owner only" on public.app_settings for all
  using (auth.uid() = '87c04c71-67ca-4fc4-bfb4-c9c3cf451ae9'::uuid)
  with check (auth.uid() = '87c04c71-67ca-4fc4-bfb4-c9c3cf451ae9'::uuid);
insert into public.app_settings (id, base_currency) values (1, 'UAH') on conflict (id) do nothing;

-- Баланс: при переводе между валютами на счёт-получатель зачисляется to_amount
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
     LEFT JOIN mono_state ms ON ms.id = 1;

-- Итоги месяца: операции по валютным счетам в бюджет не попадают
create or replace function public.month_summary(p_month date)
 returns jsonb language sql stable
as $function$
  with bounds as (
    select
      (date_trunc('month', p_month::timestamp)                       at time zone 'Europe/Kyiv') as s,
      (date_trunc('month', p_month::timestamp) + interval '1 month') at time zone 'Europe/Kyiv'  as e
  ),
  tx as (
    select t.action, sum(t.amount) as amt
    from transactions t, bounds b
    where t.date >= b.s and t.date < b.e
      and not exists (select 1 from accounts a where a.id = t.account_id and a.is_foreign)
    group by t.action
  ),
  bud as (
    select coalesce(sum(bg.amount), 0) as amt
    from budgets bg
    join categories c on c.id = bg.category_id
    where bg.month = date_trunc('month', p_month::timestamp)::date
      and c.type = 'EXPENSE'
  )
  select jsonb_build_object(
    'income',  coalesce((select amt from tx where action = 'INCOME'),  0),
    'expense', coalesce((select amt from tx where action = 'EXPENSE'), 0),
    'returns', coalesce((select amt from tx where action = 'RETURN'),  0),
    'budget',  (select amt from bud)
  );
$function$;

create or replace function public.month_category_totals(p_month date)
 returns table(category_id bigint, action text, total numeric)
 language sql stable
as $function$
  with tx as (
    select t.id, t.category_id, t.action, t.amount
    from transactions t
    where t.date >= (date_trunc('month', p_month::timestamp) at time zone 'Europe/Kyiv')
      and t.date <  ((date_trunc('month', p_month::timestamp) + interval '1 month') at time zone 'Europe/Kyiv')
      and t.action in ('EXPENSE', 'INCOME', 'RETURN')
      and not exists (select 1 from accounts a where a.id = t.account_id and a.is_foreign)
  )
  select s.category_id, tx.action, sum(s.amount) as total
  from tx join transaction_splits s on s.transaction_id = tx.id
  group by s.category_id, tx.action
  union all
  select tx.category_id, tx.action, sum(tx.amount) as total
  from tx
  where not exists (select 1 from transaction_splits s where s.transaction_id = tx.id)
  group by tx.category_id, tx.action;
$function$;
