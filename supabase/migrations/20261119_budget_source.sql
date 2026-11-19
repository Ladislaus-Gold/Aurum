-- Счёт для распределения бюджета выбирается в настройках (Aurum 0.26.0). Cash больше не особый.
create or replace function public.set_budget_source(p_id bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare a public.accounts%rowtype;
begin
  select * into a from public.accounts where id = p_id;
  if not found then raise exception 'Счёт не найден'; end if;
  if a.is_foreign then raise exception 'Валютный счёт нельзя сделать источником бюджета'; end if;
  update public.accounts set is_budget_source = false where is_budget_source;
  update public.accounts set is_budget_source = true where id = p_id;
end;
$$;
grant execute on function public.set_budget_source(bigint) to authenticated;

-- Удаление счёта: защищены только счета Monobank; если удаляется источник бюджета, им становится счёт, на который перенесли остаток
create or replace function public.delete_account(p_id bigint, p_to bigint default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  a public.accounts%rowtype;
  t public.accounts%rowtype;
  n integer;
begin
  select * into a from public.accounts where id = p_id;
  if not found then raise exception 'Счёт не найден'; end if;
  if a.is_monobank then
    raise exception 'Счёт Monobank нельзя удалить, пока он подключён';
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
$$;
grant execute on function public.delete_account(bigint, bigint) to authenticated;
