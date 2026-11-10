/** Admin transaction list. Reads stored session fields. Does not bill or invent coins. */

export type ChatType = "free" | "paid" | "mixed";
export type TransactionKind = "chat" | "message" | "request";
export type TransactionStatus = "Live" | "Completed" | "Cancelled" | "Pending";

export type AdminTransaction = {
  key: string;
  kind: TransactionKind;
  id: string;
  clientId: string;
  clientName: string;
  advisorId: string;
  advisorName: string;
  at: string;
  endedAt: string;
  seconds: number;
  freeSeconds: number;
  paidSeconds: number;
  bonusSeconds: number;
  weeklySeconds: number;
  coins: number;
  advisorEarnings: number;
  platformFee: number;
  status: string;
  statusLabel: TransactionStatus;
  chatType: ChatType | "message" | "request";
  chatTypeLabel: string;
  rateCoins: number;
  endReason: string;
};

export type TransactionFilters = {
  client?: string;
  advisor?: string;
  from?: string;
  to?: string;
  type?: "all" | ChatType | "message";
  status?: "all" | "completed" | "cancelled" | "live" | "historical";
  minCoins?: number | null;
  maxCoins?: number | null;
};

export type TransactionStats = {
  chatsToday: number;
  freeToday: number;
  paidToday: number;
  chatSeconds: number;
  coins: number;
  advisorEarnings: number;
  platformFee: number;
  active: number;
  paidMessages: number;
  paidMessageCoins: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function whole(value: unknown) {
  const n = Math.floor(Number(value) || 0);
  return n > 0 ? n : 0;
}

function signed(value: unknown) {
  const n = Math.trunc(Number(value) || 0);
  return Number.isFinite(n) ? n : 0;
}

function coinBound(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(value);
}

export function durationLabel(seconds: number) {
  const n = whole(seconds);
  const minutes = Math.floor(n / 60);
  const rest = n % 60;
  if (minutes === 0) return `${rest} sec`;
  if (rest === 0) return `${minutes} min`;
  return `${minutes} min ${rest} sec`;
}

export function utcDay(iso: string) {
  const stamp = Date.parse(String(iso || ""));
  if (!Number.isFinite(stamp)) return "";
  return new Date(stamp).toISOString().slice(0, 10);
}

/** Stored included seconds and stored coins. Paid time is the remainder, never a new charge. */
export function classifyChat(input: {
  seconds?: unknown;
  bonusUsed?: unknown;
  weeklyUsed?: unknown;
  coinsSpent?: unknown;
}) {
  const seconds = whole(input.seconds);
  const bonusSeconds = whole(input.bonusUsed);
  const weeklySeconds = whole(input.weeklyUsed);
  const freeSeconds = bonusSeconds + weeklySeconds;
  const paidSeconds = Math.max(0, seconds - freeSeconds);
  const coins = whole(input.coinsSpent);
  const chatType: ChatType = freeSeconds > 0 && coins > 0 ? "mixed" : coins > 0 ? "paid" : "free";
  return { seconds, bonusSeconds, weeklySeconds, freeSeconds, paidSeconds, coins, chatType };
}

export function chatTypeLabel(type: AdminTransaction["chatType"]) {
  if (type === "free") return "Free";
  if (type === "paid") return "Paid";
  if (type === "mixed") return "Mixed";
  if (type === "message") return "Paid message";
  return "Request";
}

export function transactionStatusLabel(kind: TransactionKind, status: string): TransactionStatus {
  const name = String(status || "").trim().toLowerCase();
  if (kind === "message") return name === "pending" ? "Pending" : "Completed";
  if (kind === "request") return "Cancelled";
  if (name === "live") return "Live";
  if (name === "cancelled" || name === "canceled") return "Cancelled";
  if (name === "ended" || name === "completed") return "Completed";
  return "Pending";
}

export function profileName(value: unknown, fallback: string) {
  const name = String(value || "").trim();
  return name || fallback;
}

export function buildChatTransaction(input: {
  id: string;
  clientId: string;
  clientName: string;
  advisorId: string;
  advisorName: string;
  at: string;
  endedAt?: string;
  seconds?: unknown;
  bonusUsed?: unknown;
  weeklyUsed?: unknown;
  coinsSpent?: unknown;
  advisorEarnings?: unknown;
  platformFee?: unknown;
  status?: string;
  rateCoins?: unknown;
  endReason?: string;
}): AdminTransaction {
  const bill = classifyChat(input);
  const status = String(input.status || "");
  const chatType = bill.chatType;
  return {
    key: `chat:${input.id}`,
    kind: "chat",
    id: input.id,
    clientId: input.clientId,
    clientName: profileName(input.clientName, "Unnamed client"),
    advisorId: input.advisorId,
    advisorName: profileName(input.advisorName, "Unknown advisor"),
    at: String(input.at || ""),
    endedAt: String(input.endedAt || ""),
    seconds: bill.seconds,
    freeSeconds: bill.freeSeconds,
    paidSeconds: bill.paidSeconds,
    bonusSeconds: bill.bonusSeconds,
    weeklySeconds: bill.weeklySeconds,
    coins: bill.coins,
    advisorEarnings: signed(input.advisorEarnings),
    platformFee: signed(input.platformFee),
    status,
    statusLabel: transactionStatusLabel("chat", status),
    chatType,
    chatTypeLabel: chatTypeLabel(chatType),
    rateCoins: whole(input.rateCoins),
    endReason: String(input.endReason || "").trim(),
  };
}

export function buildMessageTransaction(input: {
  id: string;
  clientId: string;
  clientName: string;
  advisorId: string;
  advisorName: string;
  at: string;
  coins?: unknown;
  advisorEarnings?: unknown;
  platformFee?: unknown;
  credited?: boolean;
}): AdminTransaction {
  const coins = whole(input.coins);
  return {
    key: `message:${input.id}`,
    kind: "message",
    id: input.id,
    clientId: input.clientId,
    clientName: profileName(input.clientName, "Unnamed client"),
    advisorId: input.advisorId,
    advisorName: profileName(input.advisorName, "Unknown advisor"),
    at: String(input.at || ""),
    endedAt: "",
    seconds: 0,
    freeSeconds: 0,
    paidSeconds: 0,
    bonusSeconds: 0,
    weeklySeconds: 0,
    coins,
    advisorEarnings: signed(input.advisorEarnings),
    platformFee: signed(input.platformFee),
    status: input.credited === false ? "pending" : "completed",
    statusLabel: input.credited === false ? "Pending" : "Completed",
    chatType: "message",
    chatTypeLabel: "Paid message",
    rateCoins: 0,
    endReason: "",
  };
}

export function buildRequestTransaction(input: {
  id: string;
  clientId: string;
  clientName: string;
  advisorId: string;
  advisorName: string;
  at: string;
  status?: string;
}): AdminTransaction {
  const status = String(input.status || "");
  const reason =
    status.toLowerCase() === "expired"
      ? "Request expired before a chat started"
      : status.toLowerCase() === "declined"
        ? "Request declined before a chat started"
        : "Request cancelled before a chat started";
  return {
    key: `request:${input.id}`,
    kind: "request",
    id: input.id,
    clientId: input.clientId,
    clientName: profileName(input.clientName, "Unnamed client"),
    advisorId: input.advisorId,
    advisorName: profileName(input.advisorName, "Unknown advisor"),
    at: String(input.at || ""),
    endedAt: "",
    seconds: 0,
    freeSeconds: 0,
    paidSeconds: 0,
    bonusSeconds: 0,
    weeklySeconds: 0,
    coins: 0,
    advisorEarnings: 0,
    platformFee: 0,
    status,
    statusLabel: "Cancelled",
    chatType: "request",
    chatTypeLabel: "Request",
    rateCoins: 0,
    endReason: reason,
  };
}

function includesText(value: string, query: string) {
  return value.toLowerCase().includes(query);
}

export function filterTransactions(rows: AdminTransaction[], filters: TransactionFilters) {
  const client = String(filters.client || "").trim().toLowerCase();
  const advisor = String(filters.advisor || "").trim().toLowerCase();
  const from = DAY.test(String(filters.from || "")) ? String(filters.from) : "";
  const to = DAY.test(String(filters.to || "")) ? String(filters.to) : "";
  const type = filters.type || "all";
  const status = filters.status || "all";
  const minCoins = coinBound(filters.minCoins);
  const maxCoins = coinBound(filters.maxCoins);
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.key)) return false;
    seen.add(row.key);
    if (client && !includesText(`${row.clientName} ${row.clientId}`, client)) return false;
    if (advisor && !includesText(`${row.advisorName} ${row.advisorId}`, advisor)) return false;
    const day = utcDay(row.at);
    if (from && (!day || day < from)) return false;
    if (to && (!day || day > to)) return false;
    if (type === "message" && row.kind !== "message") return false;
    if (type === "free" || type === "paid" || type === "mixed") {
      if (row.kind !== "chat" || row.chatType !== type) return false;
    }
    if (status === "completed" && row.statusLabel !== "Completed") return false;
    if (status === "cancelled" && row.statusLabel !== "Cancelled") return false;
    if (status === "live" && row.statusLabel !== "Live") return false;
    if (status === "historical" && row.statusLabel === "Live") return false;
    if (minCoins != null && Number.isFinite(minCoins) && row.coins < minCoins) return false;
    if (maxCoins != null && Number.isFinite(maxCoins) && row.coins > maxCoins) return false;
    return true;
  });
}

export function summarizeTransactions(rows: AdminTransaction[], now = new Date()): TransactionStats {
  const today = now.toISOString().slice(0, 10);
  const chats = rows.filter((row) => row.kind === "chat");
  const todayChats = chats.filter((row) => utcDay(row.at) === today);
  const messages = rows.filter((row) => row.kind === "message");
  return {
    chatsToday: todayChats.length,
    freeToday: todayChats.filter((row) => row.chatType === "free").length,
    paidToday: todayChats.filter((row) => row.chatType === "paid" || row.chatType === "mixed").length,
    chatSeconds: chats.reduce((sum, row) => sum + row.seconds, 0),
    coins: chats.reduce((sum, row) => sum + row.coins, 0),
    advisorEarnings: chats.reduce((sum, row) => sum + row.advisorEarnings, 0),
    platformFee: chats.reduce((sum, row) => sum + row.platformFee, 0),
    active: chats.filter((row) => row.statusLabel === "Live").length,
    paidMessages: messages.length,
    paidMessageCoins: messages.reduce((sum, row) => sum + row.coins, 0),
  };
}

export function paginateTransactions<T>(rows: T[], page: number, pageSize = 25) {
  const size = Math.min(100, Math.max(1, Math.floor(pageSize) || 25));
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size) || 1);
  const current = Math.min(pages, Math.max(1, Math.floor(page) || 1));
  const start = (current - 1) * size;
  return { rows: rows.slice(start, start + size), page: current, pages, total, pageSize: size };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function transactionsCsv(rows: AdminTransaction[]) {
  const header = [
    "Client name",
    "Client ID",
    "Advisor name",
    "Advisor ID",
    "Date",
    "Type",
    "Duration",
    "Free seconds",
    "Paid seconds",
    "Coins charged",
    "Advisor earnings",
    "Ora commission",
    "Status",
    "Ending reason",
  ];
  const lines = rows.map((row) =>
    [
      row.clientName,
      row.clientId,
      row.advisorName,
      row.advisorId,
      row.at,
      row.chatTypeLabel,
      row.kind === "chat" ? durationLabel(row.seconds) : "",
      row.kind === "chat" ? row.freeSeconds : "",
      row.kind === "chat" ? row.paidSeconds : "",
      row.coins,
      row.advisorEarnings,
      row.platformFee,
      row.statusLabel,
      row.endReason,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export type TransactionSql = {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export async function ensureReadingEndTable(sql: TransactionSql) {
  await sql.query(
    `create table if not exists ora_reading_ends (
      reading_id text primary key,
      reason text not null default '',
      recorded_at timestamptz not null default now()
    )`,
  );
}

export async function loadAdminTransactions(sql: TransactionSql): Promise<AdminTransaction[]> {
  await ensureReadingEndTable(sql);
  const chats = await sql<{
    id: string;
    client_id: string;
    client_name: string;
    advisor_id: string;
    advisor_name: string;
    started_at: string;
    ended_at: string | null;
    seconds: number;
    bonus_used: number;
    weekly_used: number;
    coins_spent: number;
    advisor_earned: number;
    platform_fee: number;
    status: string;
    rate_coins: number;
    end_reason: string;
  }>`
    select r.id, r.client_id, coalesce(nullif(p.display_name, ''), '') as client_name,
           r.advisor_id, coalesce(a.name, '') as advisor_name,
           r.started_at::text as started_at, r.ended_at::text as ended_at,
           coalesce(r.seconds, 0)::int as seconds,
           coalesce(r.bonus_used, 0)::int as bonus_used,
           coalesce(r.weekly_used, 0)::int as weekly_used,
           coalesce(r.coins_spent, 0)::int as coins_spent,
           coalesce(r.advisor_earned, 0)::int as advisor_earned,
           coalesce(r.platform_fee, 0)::int as platform_fee,
           r.status, coalesce(r.rate_coins, 0)::int as rate_coins,
           coalesce(e.reason, '') as end_reason
    from ora_readings r
    left join ora_advisors a on a.id = r.advisor_id
    left join ora_profiles p on p.user_id = r.client_id
    left join ora_reading_ends e on e.reading_id = r.id
  `;
  const messages = await sql<{
    id: string;
    customer_id: string;
    client_name: string;
    advisor_id: string;
    advisor_name: string;
    created_at: string;
    coins: number;
    advisor_share_coins: number;
    ora_share_coins: number;
    credited: boolean;
  }>`
    select m.id, m.customer_id, coalesce(nullif(p.display_name, ''), '') as client_name,
           m.advisor_id, coalesce(a.name, '') as advisor_name, m.created_at::text as created_at,
           coalesce(m.coins, 0)::int as coins,
           coalesce(m.advisor_share_coins, 0)::int as advisor_share_coins,
           coalesce(m.ora_share_coins, 0)::int as ora_share_coins,
           coalesce(m.credited, true) as credited
    from ora_paid_messages m
    left join ora_advisors a on a.id = m.advisor_id
    left join ora_profiles p on p.user_id = m.customer_id
  `.catch(() => []);
  const requests = await sql<{
    id: string;
    client_id: string;
    client_name: string;
    advisor_id: string;
    advisor_name: string;
    created_at: string;
    status: string;
  }>`
    select c.id, c.client_id, coalesce(nullif(p.display_name, ''), '') as client_name,
           c.advisor_id, coalesce(a.name, '') as advisor_name, c.created_at::text as created_at, c.status
    from ora_chat_requests c
    left join ora_advisors a on a.id = c.advisor_id
    left join ora_profiles p on p.user_id = c.client_id
    where coalesce(c.reading_id, '') = ''
      and lower(c.status) in ('declined', 'expired', 'cancelled', 'canceled')
  `.catch(() => []);
  const rows = [
    ...chats.map((row) =>
      buildChatTransaction({
        id: row.id,
        clientId: row.client_id,
        clientName: row.client_name,
        advisorId: row.advisor_id,
        advisorName: row.advisor_name,
        at: String(row.started_at || ""),
        endedAt: row.ended_at ? String(row.ended_at) : "",
        seconds: row.seconds,
        bonusUsed: row.bonus_used,
        weeklyUsed: row.weekly_used,
        coinsSpent: row.coins_spent,
        advisorEarnings: row.advisor_earned,
        platformFee: row.platform_fee,
        status: row.status,
        rateCoins: row.rate_coins,
        endReason: row.end_reason,
      }),
    ),
    ...messages.map((row) =>
      buildMessageTransaction({
        id: row.id,
        clientId: row.customer_id,
        clientName: row.client_name,
        advisorId: row.advisor_id,
        advisorName: row.advisor_name,
        at: String(row.created_at || ""),
        coins: row.coins,
        advisorEarnings: row.advisor_share_coins,
        platformFee: row.ora_share_coins,
        credited: row.credited !== false,
      }),
    ),
    ...requests.map((row) =>
      buildRequestTransaction({
        id: row.id,
        clientId: row.client_id,
        clientName: row.client_name,
        advisorId: row.advisor_id,
        advisorName: row.advisor_name,
        at: String(row.created_at || ""),
        status: row.status,
      }),
    ),
  ];
  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id));
}

export type TransactionDetail = {
  row: AdminTransaction;
  adjustments: { id: string; coins: number; kind: string; note: string; at: string }[];
  earning: { id: string; status: string; gross: number; commission: number; net: number } | null;
  ledger: { id: string; kind: string; coins: number; note: string; at: string }[];
};

export async function loadAdminTransactionDetail(sql: TransactionSql, kind: string, id: string): Promise<TransactionDetail | null> {
  const rows = await loadAdminTransactions(sql);
  const row = rows.find((item) => item.kind === kind && item.id === id);
  if (!row) return null;
  if (row.kind !== "chat") return { row, adjustments: [], earning: null, ledger: [] };
  const adjustments = await sql<{ id: string; coins: number; kind: string; note: string; created_at: string }>`
    select id, coins, kind, note, created_at::text as created_at
    from ora_adjustments
    where reading_id = ${id}
    order by created_at desc
  `.catch(() => []);
  const earnings = await sql<{ id: string; status: string; gross_coins: number; commission_coins: number; net_coins: number }>`
    select id, status, gross_coins, commission_coins, net_coins
    from ora_earnings
    where reading_id = ${id}
    limit 1
  `.catch(() => []);
  const ledger = await sql<{ id: string; kind: string; amount_coins: number; note: string; created_at: string }>`
    select id, kind, amount_coins, note, created_at::text as created_at
    from ora_ledger
    where ref_id = ${id}
    order by created_at desc
  `.catch(() => []);
  const earning = earnings[0];
  return {
    row,
    adjustments: adjustments.map((item) => ({
      id: item.id,
      coins: Number(item.coins) || 0,
      kind: item.kind,
      note: item.note || "",
      at: String(item.created_at || ""),
    })),
    earning: earning
      ? {
          id: earning.id,
          status: earning.status,
          gross: Number(earning.gross_coins) || 0,
          commission: Number(earning.commission_coins) || 0,
          net: Number(earning.net_coins) || 0,
        }
      : null,
    ledger: ledger.map((item) => ({
      id: item.id,
      kind: item.kind,
      coins: Number(item.amount_coins) || 0,
      note: item.note || "",
      at: String(item.created_at || ""),
    })),
  };
}
