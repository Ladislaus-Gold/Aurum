// ============================================================
// AURUM — Monobank → Supabase (Edge Function "mono", версия 6: несколько токенов и карт)
//
// ИЗ ПРИЛОЖЕНИЯ (нужен вход, JWT пользователя):
//   { action: "accounts", token }                         карты по токену (ничего не сохраняет)
//   { action: "connect", token, label, clientName, cards } подключение токена и выбранных карт
//   { action: "import", accountId }                       загрузка 31 дня по одной карте
//   { action: "status" }                                  подключения, карты, проверка вебхука
//   { action: "label", connectionId, label }              название подключения
//   { action: "sync", accountId }                         обновить карту (48 часов) и балансы токена
//   { action: "webhook", connectionId }                   заново включить вебхук
//   { action: "disconnect", connectionId }                отключить токен вместе с картами
// ДЛЯ БАНКА И РАСПИСАНИЯ (секрет в адресе):
//   POST ?secret=...  вебхук;  GET ?action=poll|balance|status&secret=...
// Лимит банка: 1 запрос в минуту на токен, поэтому опрос берёт по одной карте на токен за круг.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL: string = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY: string = Deno.env.get("MONO_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ENV_SECRET: string = Deno.env.get("MONO_WEBHOOK_SECRET") ?? "";
const MONO_API = "https://api.monobank.ua/personal";
const MAX_STATEMENT_SECONDS = 31 * 24 * 3600;
const CORS: any = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, GET, OPTIONS",
};
const TYPE_NAME: any = { black: "Black", white: "White", platinum: "Platinum", iron: "Iron", fop: "ФОП", yellow: "Yellow", eAid: "єПідтримка" };

const db: any = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });
}
function coded(code: string, message: string, status: number): any {
  const e: any = new Error(message);
  e.code = code;
  e.httpStatus = status;
  return e;
}
function failFrom(e: any): Response {
  if (e && e.code && e.httpStatus) return json({ ok: false, error: e.code, message: String(e.message) }, e.httpStatus);
  console.error("[MONO]", e && e.message ? e.message : e);
  return json({ ok: false, error: "INTERNAL_ERROR", message: String(e && e.message ? e.message : e) }, 500);
}
function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
function randomSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b: number) => b.toString(16).padStart(2, "0")).join("");
}
function stripFx(value: any): string {
  return String(value ?? "").replace(/\s*\(FX[^)]*\)\s*$/i, "").trim();
}
function noteKey(value: any): string {
  return stripFx(value).toLowerCase().replace(/\s+/g, " ");
}
function currencyFromCode(code: any): string {
  const n = Number(code);
  if (n === 980) return "UAH";
  if (n === 840) return "USD";
  if (n === 978) return "EUR";
  return "ISO-" + String(code);
}
function isSupportedCurrency(code: any): boolean {
  return ["UAH", "USD", "EUR"].indexOf(currencyFromCode(code)) >= 0;
}

// ------------------------------------------------------------
// Правила и разбор операции (без изменений)
// ------------------------------------------------------------
function buildRulesMap(rules: any): any {
  const map = new Map();
  (rules || []).forEach((rule: any) => {
    const key = String(rule.action) + "::" + noteKey(rule.note);
    if (!map.has(key)) map.set(key, rule);
  });
  return map;
}
function resolveRule(rulesMap: any, bankAction: string, note: string): any {
  const key = noteKey(note);
  if (!key) return null;
  const candidates = bankAction === "EXPENSE" ? ["EXPENSE", "TRANSFER"] : ["INCOME", "RETURN", "TRANSFER"];
  for (const action of candidates) {
    const rule = rulesMap.get(action + "::" + key);
    if (rule) return rule;
  }
  return null;
}
function buildTransactionRow(item: any, binding: any, ctx: any): any {
  const monoOpId = String(item?.id ?? "").trim();
  if (!monoOpId) throw new Error("statementItem.id is missing");
  const raw = Number(item.amount);
  if (!isFinite(raw)) throw new Error("statementItem.amount is invalid");
  if (raw === 0) return { skip: "ZERO_AMOUNT", monoOpId };
  const date = new Date(Number(item.time) * 1000);
  if (isNaN(date.getTime())) throw new Error("statementItem.time is invalid");

  const bankAction = raw < 0 ? "EXPENSE" : "INCOME";
  const note = stripFx(String(item.description ?? "").trim());
  const rule = resolveRule(ctx.rulesMap, bankAction, note);

  let action = bankAction;
  let categoryId: any = null;
  let accountId: any = binding.id;
  let fromId: any = null;
  let toId: any = null;
  if (rule && rule.action === "TRANSFER") {
    action = "TRANSFER";
    fromId = rule.from_account_id;
    toId = rule.to_account_id;
    accountId = null;
  } else if (rule) {
    action = rule.action;
    categoryId = rule.category_id;
  } else if (bankAction === "EXPENSE") {
    categoryId = ctx.uncategorizedExpenseId;
  }
  return {
    monoOpId,
    matched: Boolean(rule),
    row: {
      date: date.toISOString(), action, amount: Math.abs(raw) / 100, category_id: categoryId,
      account_id: accountId, from_account_id: fromId, to_account_id: toId,
      currency: binding.currency, note, mono_op_id: monoOpId,
    },
  };
}

// ------------------------------------------------------------
// База данных
// ------------------------------------------------------------
async function loadContext(): Promise<any> {
  const rulesRes = await db.from("rules").select("id,action,category_id,from_account_id,to_account_id,note").order("id");
  if (rulesRes.error) throw rulesRes.error;
  const catRes = await db.from("categories").select("id,name,type");
  if (catRes.error) throw catRes.error;
  const uncategorized = (catRes.data || []).filter((c: any) => c.type === "EXPENSE" && /^Uncategorized/i.test(String(c.name)))[0];
  return {
    rulesMap: buildRulesMap(rulesRes.data),
    uncategorizedExpenseId: uncategorized ? uncategorized.id : null,
    rulesCount: (rulesRes.data || []).length,
  };
}

async function connections(): Promise<any[]> {
  const r = await db.from("mono_connections").select("id,label,token,webhook_secret,client_name,connected_at").order("id");
  if (r.error) throw r.error;
  return r.data || [];
}
async function cards(): Promise<any[]> {
  const r = await db.from("accounts")
    .select("id,name,currency,is_foreign,mono_account_id,mono_conn_id,mono_type,mono_mask")
    .not("mono_account_id", "is", null).order("id");
  if (r.error) throw r.error;
  return r.data || [];
}
async function secretMatches(secret: any): Promise<boolean> {
  if (typeof secret !== "string" || !secret) return false;
  for (const c of await connections()) if (c.webhook_secret && safeEqual(secret, c.webhook_secret)) return true;
  return Boolean(ENV_SECRET) && safeEqual(secret, ENV_SECRET);
}
async function bindingByMonoId(monoAccountId: string): Promise<any> {
  const r = await db.from("accounts").select("id,name,currency,mono_account_id,mono_conn_id").eq("mono_account_id", monoAccountId).limit(1);
  if (r.error) throw r.error;
  return (r.data || [])[0] || null;
}
async function bindingByAccountId(id: any): Promise<any> {
  const r = await db.from("accounts").select("id,name,currency,mono_account_id,mono_conn_id").eq("id", Number(id)).limit(1);
  if (r.error) throw r.error;
  const row = (r.data || [])[0] || null;
  if (!row || !row.mono_account_id) throw coded("NOT_BOUND", "Эта карта не подключена к Monobank.", 400);
  return row;
}
async function connectionById(id: any): Promise<any> {
  const r = await db.from("mono_connections").select("id,label,token,webhook_secret,client_name").eq("id", Number(id)).limit(1);
  if (r.error) throw r.error;
  const c = (r.data || [])[0];
  if (!c) throw coded("NOT_CONNECTED", "Подключение не найдено.", 400);
  return c;
}
async function baseCurrency(): Promise<string> {
  const r = await db.from("app_settings").select("base_currency").eq("id", 1).limit(1);
  return (!r.error && r.data && r.data[0] && r.data[0].base_currency) || "UAH";
}

async function ingestItem(item: any, binding: any, ctx: any): Promise<any> {
  const built = buildTransactionRow(item, binding, ctx);
  if (built.skip) return { skipped: true, reason: built.skip };
  const res = await db.from("transactions").upsert(built.row, { onConflict: "mono_op_id", ignoreDuplicates: true }).select("id");
  if (res.error) throw res.error;
  const created = (res.data || []).length > 0;
  return { created, duplicate: !created, action: built.row.action, ruleMatched: built.matched };
}
async function ingestMany(items: any[], binding: any, ctx: any): Promise<any> {
  const out = { received: items.length, created: 0, duplicates: 0, skipped: 0, errors: 0, firstError: "" };
  const rows: any[] = [];
  for (const item of items) {
    try {
      const built = buildTransactionRow(item, binding, ctx);
      if (built.skip) out.skipped++;
      else rows.push(built.row);
    } catch (e: any) {
      out.errors++;
      if (!out.firstError) out.firstError = String(e && e.message ? e.message : e);
    }
  }
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const res = await db.from("transactions").upsert(chunk, { onConflict: "mono_op_id", ignoreDuplicates: true }).select("id");
    if (res.error) throw res.error;
    const n = (res.data || []).length;
    out.created += n;
    out.duplicates += chunk.length - n;
  }
  return out;
}

// Баланс и лимит карты (balance — «доступно», вместе с кредитным лимитом)
async function saveCard(monoAccountId: string, balanceKop: any, creditLimitKop: any, source: string): Promise<void> {
  const row: any = { mono_account_id: monoAccountId, balance_kop: Math.round(Number(balanceKop)), updated_at: new Date().toISOString(), source };
  if (creditLimitKop !== null && creditLimitKop !== undefined) row.credit_limit_kop = Math.round(Number(creditLimitKop));
  const res = await db.from("mono_card_state").upsert(row, { onConflict: "mono_account_id" });
  if (res.error) throw res.error;
}

// ------------------------------------------------------------
// Monobank API
// ------------------------------------------------------------
async function monoFetch(path: string, init: any): Promise<any> {
  const res = await fetch(MONO_API + path, init);
  const text = await res.text();
  if (res.status === 429) {
    const e = coded("RATE_LIMITED", "Monobank просит подождать минуту (лимит запросов).", 429);
    e.rateLimited = true;
    throw e;
  }
  if (res.status === 403) throw coded("INVALID_TOKEN", "Monobank не принял токен. Получи новый на api.monobank.ua и вставь заново.", 400);
  if (res.status !== 200) throw coded("MONOBANK_ERROR", "Monobank API: HTTP " + res.status + " " + text.slice(0, 200), 502);
  return text ? JSON.parse(text) : {};
}
const monoGet = (path: string, token: string) => monoFetch(path, { headers: { "X-Token": token } });
const monoPost = (path: string, body: any, token: string) =>
  monoFetch(path, { method: "POST", headers: { "X-Token": token, "content-type": "application/json" }, body: JSON.stringify(body) });

function functionBaseUrl(req: Request): string {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  return SUPABASE_URL + "/functions/v1/" + (parts.length ? parts[parts.length - 1] : "mono");
}
async function registerWebhook(req: Request, token: string, secret: string): Promise<void> {
  try {
    await monoPost("/webhook", { webHookUrl: functionBaseUrl(req) + "?secret=" + encodeURIComponent(secret) }, token);
  } catch (e: any) {
    if (e && e.rateLimited) throw e;
    throw coded("WEBHOOK_FAILED", "Не удалось зарегистрировать вебхук в банке. Ответ банка: " + String(e && e.message ? e.message : e), 502);
  }
}

async function runStatement(binding: any, token: string, seconds: number): Promise<any> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - Math.min(Math.floor(seconds), MAX_STATEMENT_SECONDS);
  const items = await monoGet("/statement/" + encodeURIComponent(binding.mono_account_id) + "/" + from + "/" + to, token);
  if (!Array.isArray(items)) throw coded("MONOBANK_ERROR", "Monobank statement: неожиданный ответ", 502);
  const ctx = await loadContext();
  const ordered = items.slice().sort((a: any, b: any) => Number(a.time) - Number(b.time));
  const out = await ingestMany(ordered, binding, ctx);
  return { ...out, newest: ordered.length ? ordered[ordered.length - 1] : null };
}

// Один запрос client-info обновляет балансы всех карт этого токена
async function refreshConnection(conn: any): Promise<any> {
  const info = await monoGet("/client-info", conn.token);
  const mine = (await cards()).filter((c: any) => c.mono_conn_id === conn.id);
  let n = 0;
  for (const c of mine) {
    const a = (info.accounts || []).filter((x: any) => x.id === c.mono_account_id)[0];
    if (!a) continue;
    await saveCard(a.id, a.balance, a.creditLimit || 0, "client-info");
    n++;
  }
  return { updated: n, webHookUrl: String(info.webHookUrl || "") };
}

async function enablePolling(req: Request): Promise<boolean> {
  try {
    const left = await connections();
    if (!left.length) { await db.rpc("mono_disable_polling"); return false; }
    const r = await db.rpc("mono_enable_polling", { function_url: functionBaseUrl(req) });
    if (r.error) throw r.error;
    return true;
  } catch (_e) {
    return false;
  }
}

// ------------------------------------------------------------
// Вебхук банка
// ------------------------------------------------------------
async function handleWebhook(body: any, url: URL): Promise<Response> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "INVALID_BODY" }, 400);
  const secret = url.searchParams.get("secret") ?? (typeof body.secret === "string" ? body.secret : "");
  if (!(await secretMatches(secret))) {
    if (!(await connections()).length && !ENV_SECRET) return json({ ok: false, error: "SERVICE_NOT_CONFIGURED" }, 500);
    return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }
  const payload = body.message && body.message.payload ? body.message.payload : body;
  if (!payload || payload.type !== "StatementItem" || !payload.data) return json({ ok: true, skipped: true, reason: "UNSUPPORTED_PAYLOAD" });

  const monoAccountId = String(payload.data.account ?? "").trim();
  const item = payload.data.statementItem;
  if (!monoAccountId || !item) return json({ ok: false, error: "STATEMENT_ITEM_REQUIRED" }, 400);
  try {
    const binding = await bindingByMonoId(monoAccountId);
    if (!binding) return json({ ok: true, skipped: true, reason: "UNBOUND_ACCOUNT" });
    const result = await ingestItem(item, binding, await loadContext());
    if (typeof item.balance === "number") await saveCard(monoAccountId, item.balance, null, "webhook");
    return json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[MONO][WEBHOOK]", e && e.message ? e.message : e);
    return json({ ok: false, error: "INTERNAL_ERROR", message: String(e && e.message ? e.message : e) }, 500);
  }
}

// ------------------------------------------------------------
// Действия по секрету (расписание)
// ------------------------------------------------------------
async function handleSecretAction(action: string, url: URL, req: Request): Promise<Response> {
  if (!(await secretMatches(url.searchParams.get("secret")))) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  if (action === "poll") return await actionPoll(url);
  if (action === "balance") return await actionBalance();
  if (action === "status") return json(await buildStatus());
  return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
}

// По одной карте на токен за круг: берём ту, которую опрашивали давнее всех
async function actionPoll(url: URL): Promise<Response> {
  let hours = Number(url.searchParams.get("hours") ?? 3);
  if (!isFinite(hours) || hours <= 0) hours = 3;
  const seconds = Math.min(Math.floor(hours * 3600), MAX_STATEMENT_SECONDS);

  const conns = await connections();
  if (!conns.length) return json({ ok: false, error: "NOT_BOUND", message: "Карта ещё не привязана." }, 400);
  const all = await cards();
  const st = await db.from("mono_card_state").select("mono_account_id,polled_at");
  const polled = new Map((st.data || []).map((r: any) => [r.mono_account_id, r.polled_at ? new Date(r.polled_at).getTime() : 0]));

  const report: any[] = [];
  const ctx = await loadContext();
  for (const conn of conns) {
    const mine = all.filter((c: any) => c.mono_conn_id === conn.id).sort((a: any, b: any) => (polled.get(a.mono_account_id) || 0) - (polled.get(b.mono_account_id) || 0));
    const binding = mine[0];
    if (!binding) continue;
    try {
      const to = Math.floor(Date.now() / 1000);
      const items = await monoGet("/statement/" + encodeURIComponent(binding.mono_account_id) + "/" + (to - seconds) + "/" + to, conn.token);
      await db.from("mono_card_state").update({ polled_at: new Date().toISOString() }).eq("mono_account_id", binding.mono_account_id);
      if (!Array.isArray(items)) continue;
      const ordered = items.filter((i: any) => i && Number(i.amount) !== 0).sort((a: any, b: any) => Number(a.time) - Number(b.time));
      if (!ordered.length) { report.push({ card: binding.id, missing: 0 }); continue; }
      const exist = await db.from("transactions").select("mono_op_id").in("mono_op_id", ordered.map((i: any) => String(i.id)));
      if (exist.error) throw exist.error;
      const have = new Set((exist.data || []).map((r: any) => String(r.mono_op_id)));
      const missing = ordered.filter((i: any) => !have.has(String(i.id)));
      if (!missing.length) { report.push({ card: binding.id, missing: 0 }); continue; }
      const out = await ingestMany(missing, binding, ctx);
      if (out.created > 0) {
        const newest = ordered[ordered.length - 1];
        if (typeof newest.balance === "number") await saveCard(binding.mono_account_id, newest.balance, null, "poll");
      }
      report.push({ card: binding.id, missing: missing.length, ...out });
    } catch (e: any) {
      if (e && e.rateLimited) { report.push({ card: binding.id, rateLimited: true }); continue; }
      report.push({ card: binding.id, error: String(e && e.message ? e.message : e) });
    }
  }
  return json({ ok: !report.some((r: any) => r.error), cards: report });
}

async function actionBalance(): Promise<Response> {
  const out: any[] = [];
  for (const conn of await connections()) {
    try { out.push({ connection: conn.id, ...(await refreshConnection(conn)) }); }
    catch (e: any) { out.push({ connection: conn.id, rateLimited: Boolean(e && e.rateLimited), error: e && e.rateLimited ? undefined : String(e && e.message ? e.message : e) }); }
  }
  return json({ ok: true, connections: out });
}

// ------------------------------------------------------------
// Состояние для приложения
// ------------------------------------------------------------
async function buildStatus(req?: Request): Promise<any> {
  const conns = await connections();
  const all = await cards();
  const st = await db.from("mono_card_state").select("mono_account_id,balance_kop,credit_limit_kop,updated_at,source");
  const state = new Map((st.data || []).map((r: any) => [r.mono_account_id, r]));

  let polling: any = null;
  try {
    const r = await db.rpc("mono_polling_status");
    if (!r.error) polling = Boolean(r.data);
  } catch (_e) { /* расписание недоступно */ }

  const out: any[] = [];
  for (const c of conns) {
    let webhook: any = "unknown";
    if (req) {
      try {
        const info = await monoGet("/client-info", c.token);
        const current = String(info.webHookUrl || "");
        if (!current) webhook = "missing";
        else if (current.indexOf(functionBaseUrl(req)) === 0 && current.indexOf(encodeURIComponent(c.webhook_secret)) >= 0) webhook = "active";
        else webhook = "other";
        // заодно обновляем балансы карт этого токена: запрос уже сделан
        for (const card of all.filter((x: any) => x.mono_conn_id === c.id)) {
          const a = (info.accounts || []).filter((x: any) => x.id === card.mono_account_id)[0];
          if (a) { await saveCard(a.id, a.balance, a.creditLimit || 0, "client-info"); state.set(a.id, { mono_account_id: a.id, balance_kop: a.balance, credit_limit_kop: a.creditLimit || 0, updated_at: new Date().toISOString(), source: "client-info" }); }
        }
      } catch (_e) { /* лимит запросов или нет связи */ }
    }
    out.push({
      id: c.id, label: c.label, clientName: c.client_name, connectedAt: c.connected_at, webhook,
      cards: all.filter((x: any) => x.mono_conn_id === c.id).map((x: any) => {
        const s: any = state.get(x.mono_account_id) || {};
        return {
          accountId: x.id, name: x.name, currency: x.currency, foreign: x.is_foreign, type: x.mono_type, mask: x.mono_mask,
          balanceKop: s.balance_kop ?? null, creditLimitKop: s.credit_limit_kop ?? 0, updatedAt: s.updated_at ?? null, source: s.source ?? null,
        };
      }),
    });
  }
  const ctx = await loadContext();
  return { ok: true, connected: conns.length > 0, connections: out, polling, rules: ctx.rulesCount, uncategorizedCategory: ctx.uncategorizedExpenseId !== null };
}

// ------------------------------------------------------------
// Действия из приложения
// ------------------------------------------------------------
async function handleAppAction(req: Request, body: any): Promise<Response> {
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!jwt) return json({ ok: false, error: "UNAUTHORIZED", message: "Войди в приложение заново." }, 401);
  const who = await db.auth.getUser(jwt);
  if (who.error || !who.data || !who.data.user) return json({ ok: false, error: "UNAUTHORIZED", message: "Войди в приложение заново." }, 401);

  const action = String(body.action || "").toLowerCase();
  if (action === "accounts") return await appAccounts(body);
  if (action === "connect") return await appConnect(req, body);
  if (action === "import") return await appImport(body);
  if (action === "status") return json(await buildStatus(req));
  if (action === "label") return await appLabel(body);
  if (action === "webhook") return await appWebhook(req, body);
  if (action === "sync") return await appSync(body);
  if (action === "disconnect") return await appDisconnect(req, body);
  return json({ ok: false, error: "UNKNOWN_ACTION", message: "Неизвестное действие." }, 400);
}

function cleanToken(value: any): string {
  const token = String(value ?? "").trim();
  if (token.length < 20 || /\s/.test(token)) throw coded("INVALID_TOKEN", "Это не похоже на токен Monobank. Скопируй его целиком с api.monobank.ua.", 400);
  return token;
}

// Шаг 1: карты по токену (ничего не сохраняем)
async function appAccounts(body: any): Promise<Response> {
  const token = cleanToken(body.token);
  const info = await monoGet("/client-info", token);
  const list: any[] = (Array.isArray(info.accounts) ? info.accounts : []).filter((a: any) => isSupportedCurrency(a.currencyCode));
  if (!list.length) return json({ ok: false, error: "NO_ACCOUNTS", message: "В этом аккаунте Monobank нет счетов в UAH, USD или EUR." }, 400);
  const bound = await db.from("accounts").select("id,name,mono_account_id").in("mono_account_id", list.map((a: any) => a.id));
  const byMono = new Map((bound.data || []).map((r: any) => [r.mono_account_id, r]));
  const known = (await connections()).filter((c: any) => c.token === token)[0];
  return json({
    ok: true,
    clientName: info.name || "",
    connectionId: known ? known.id : null,
    label: known ? known.label : "",
    accounts: list.map((a: any) => ({
      id: a.id, type: a.type, currencyCode: a.currencyCode, currency: currencyFromCode(a.currencyCode),
      maskedPan: a.maskedPan || [], balance: Number(a.balance || 0), creditLimit: Number(a.creditLimit || 0),
      accountId: byMono.get(a.id) ? (byMono.get(a.id) as any).id : null,
      name: byMono.get(a.id) ? (byMono.get(a.id) as any).name : "",
    })),
  });
}

// Шаг 2: подключаем токен и выбранные карты (по одной карте — свой счёт в приложении)
async function appConnect(req: Request, body: any): Promise<Response> {
  const token = cleanToken(body.token);
  const picked: any[] = Array.isArray(body.cards) ? body.cards : [];
  if (!picked.length) throw coded("ACCOUNT_REQUIRED", "Выбери хотя бы одну карту.", 400);
  for (const c of picked) {
    if (!c || typeof c.id !== "string" || !c.id || !isSupportedCurrency(c.currencyCode)) throw coded("ACCOUNT_REQUIRED", "Карта выбрана неверно.", 400);
  }
  const label = String(body.label || "").trim() || "Monobank";

  // подключение: тот же токен обновляем, новый создаём
  let conn = (await connections()).filter((c: any) => c.token === token)[0];
  if (conn) {
    const u = await db.from("mono_connections").update({ label, client_name: String(body.clientName || conn.client_name || "") }).eq("id", conn.id);
    if (u.error) throw u.error;
  } else {
    const ins = await db.from("mono_connections")
      .insert({ label, token, webhook_secret: randomSecret(), client_name: String(body.clientName || "") })
      .select("id,label,token,webhook_secret").limit(1);
    if (ins.error) throw ins.error;
    conn = (ins.data || [])[0];
  }

  const base = await baseCurrency();
  const made: any[] = [];
  for (const c of picked) {
    const currency = currencyFromCode(c.currencyCode);
    const mask = Array.isArray(c.maskedPan) && c.maskedPan.length ? String(c.maskedPan[0]) : "";
    const last4 = mask.replace(/\D/g, "").slice(-4);
    const foreign = currency !== base;

    let acc: any = (await db.from("accounts").select("id,name").eq("mono_account_id", c.id).limit(1)).data?.[0];
    if (!acc) {
      // самая первая карта занимает прежний счёт «Monobank», если он ещё не привязан
      const legacy = (await db.from("accounts").select("id,name").eq("is_monobank", true).is("mono_account_id", null).order("id").limit(1)).data?.[0];
      if (legacy && !foreign) acc = legacy;
    }
    const patch: any = { mono_account_id: c.id, mono_conn_id: conn.id, mono_type: c.type || null, mono_mask: mask || null, is_monobank: true, currency };
    if (acc) {
      const u = await db.from("accounts").update(patch).eq("id", acc.id).select("id,name");
      if (u.error) throw u.error;
    } else {
      const nm = String(c.name || "").trim() || [label, TYPE_NAME[c.type] || "", foreign ? currency : ""].filter(Boolean).join(" ");
      for (const name of [nm, nm + " " + last4, nm + " " + c.id.slice(0, 4)]) {
        const ins = await db.from("accounts").insert({ ...patch, name, is_foreign: foreign, icon: foreign ? "coin" : "card" }).select("id,name").limit(1);
        if (!ins.error) { acc = (ins.data || [])[0]; break; }
        if (!String(ins.error.message).includes("duplicate")) throw ins.error;
      }
      if (!acc) throw coded("ACCOUNT_EXISTS", "Не удалось придумать название счёта: переименуй карту и повтори.", 400);
    }
    await saveCard(c.id, c.balance || 0, c.creditLimit || 0, "client-info");
    made.push({ accountId: acc.id, name: acc.name, currency, mask });
  }

  // вебхук один на токен: банк пришлёт операции по всем картам
  await registerWebhook(req, token, conn.webhook_secret);
  const polling = await enablePolling(req);

  // первая карта грузится сразу, остальные приложение запросит по очереди (лимит банка — 1 запрос в минуту)
  let imported: any = null;
  let importNote = "";
  try {
    const first = await bindingByAccountId(made[0].accountId);
    const r = await runStatement(first, token, MAX_STATEMENT_SECONDS);
    imported = { received: r.received, created: r.created, duplicates: r.duplicates, skipped: r.skipped, errors: r.errors };
  } catch (e: any) {
    importNote = String(e && e.message ? e.message : e);
  }
  return json({ ok: true, connectionId: conn.id, cards: made, pending: made.slice(1).map((m: any) => m.accountId), polling, imported, importNote });
}

async function appImport(body: any): Promise<Response> {
  const binding = await bindingByAccountId(body.accountId);
  const conn = await connectionById(binding.mono_conn_id);
  const r = await runStatement(binding, conn.token, MAX_STATEMENT_SECONDS);
  return json({ ok: true, received: r.received, created: r.created, duplicates: r.duplicates, skipped: r.skipped, errors: r.errors });
}

async function appLabel(body: any): Promise<Response> {
  const label = String(body.label || "").trim();
  if (!label) throw coded("LABEL_REQUIRED", "Введи название.", 400);
  const u = await db.from("mono_connections").update({ label }).eq("id", Number(body.connectionId));
  if (u.error) throw u.error;
  return json({ ok: true });
}

async function appWebhook(req: Request, body: any): Promise<Response> {
  const conn = await connectionById(body.connectionId);
  await registerWebhook(req, conn.token, conn.webhook_secret);
  return json({ ok: true, webhook: "active" });
}

// «Обновить»: выписка по карте за 48 часов; балансы всех карт этого токена одним запросом
async function appSync(body: any): Promise<Response> {
  const binding = await bindingByAccountId(body.accountId);
  const conn = await connectionById(binding.mono_conn_id);
  const r = await runStatement(binding, conn.token, 48 * 3600);
  let balances: any = null;
  try { balances = await refreshConnection(conn); } catch (_e) { /* не критично */ }
  return json({ ok: r.errors === 0, received: r.received, created: r.created, duplicates: r.duplicates, skipped: r.skipped, errors: r.errors, firstError: r.firstError, balances });
}

async function appDisconnect(req: Request, body: any): Promise<Response> {
  const conn = await connectionById(body.connectionId);
  let webhookRemoved = false;
  try { await monoPost("/webhook", { webHookUrl: "" }, conn.token); webhookRemoved = true; } catch (_e) { /* вебхук без секрета всё равно перестанет работать */ }

  const mine = (await cards()).filter((c: any) => c.mono_conn_id === conn.id);
  if (mine.length) {
    const del = await db.from("mono_card_state").delete().in("mono_account_id", mine.map((c: any) => c.mono_account_id));
    if (del.error) throw del.error;
  }
  const unbind = await db.from("accounts").update({ mono_account_id: null, mono_conn_id: null, mono_type: null, mono_mask: null, is_monobank: false }).eq("mono_conn_id", conn.id);
  if (unbind.error) throw unbind.error;
  const rm = await db.from("mono_connections").delete().eq("id", conn.id);
  if (rm.error) throw rm.error;
  await db.from("mono_settings").delete().eq("token", conn.token); // остаток прежней версии
  await enablePolling(req);
  return json({ ok: true, webhookRemoved });
}

// ------------------------------------------------------------
// Точка входа
// ------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    const url = new URL(req.url);
    const queryAction = (url.searchParams.get("action") || "").toLowerCase();
    if (req.method === "GET") {
      if (!queryAction) return new Response("ok", { status: 200, headers: CORS });
      return await handleSecretAction(queryAction, url, req);
    }
    if (req.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
    let body: any = null;
    try { body = await req.json(); } catch (_e) { return json({ ok: false, error: "INVALID_JSON" }, 400); }
    if (queryAction) return await handleSecretAction(queryAction, url, req);
    if (body && typeof body.action === "string") return await handleAppAction(req, body);
    return await handleWebhook(body, url);
  } catch (e: any) {
    return failFrom(e);
  }
});
