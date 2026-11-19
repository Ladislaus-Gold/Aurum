-- Одно имя счёта в нескольких валютах (Fund · USD, Fund · EUR) и блоки счетов
alter table public.accounts drop constraint if exists accounts_name_key;
create unique index if not exists accounts_name_cur_key on public.accounts (name, coalesce(currency, 'UAH'));

-- Блок на экране «Счета»: card = «Карта и наличные», env = «Конверты». Валютные определяются автоматически.
alter table public.accounts add column if not exists block text check (block in ('card','env'));
update public.accounts set block = case
  when is_monobank or is_budget_source or icon in ('wallet','card') then 'card' else 'env' end
where block is null and not coalesce(is_foreign, false);
