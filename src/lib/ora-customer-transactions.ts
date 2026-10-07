import type { LedgerRow, PaymentHistoryRow } from "./ora.ts";

export const CUSTOMER_TXN_PREVIEW = 3;

export type CustomerTxn =
  | { key: string; at: string; kind: "payment"; payment: PaymentHistoryRow }
  | { key: string; at: string; kind: "ledger"; ledger: LedgerRow };

function stamp(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

/** Newest first. Display only — this does not drop rows from the account. */
export function customerTransactions(payments: PaymentHistoryRow[], ledger: LedgerRow[]): CustomerTxn[] {
  const rows: CustomerTxn[] = [
    ...payments.map((payment) => ({
      key: `payment:${payment.id}`,
      at: payment.paidAt || payment.createdAt,
      kind: "payment" as const,
      payment,
    })),
    ...ledger.map((row) => ({
      key: `ledger:${row.id}`,
      at: row.createdAt,
      kind: "ledger" as const,
      ledger: row,
    })),
  ];
  return rows.sort((a, b) => stamp(b.at) - stamp(a.at) || (a.key < b.key ? 1 : -1));
}

/** Sitting charges belong on Reading History, not the wallet transaction list. */
export function isSittingLedger(row: Pick<LedgerRow, "kind">) {
  const kind = row.kind.trim().toLowerCase();
  return kind === "reading" || kind === "session";
}

export function walletTransactions(payments: PaymentHistoryRow[], ledger: LedgerRow[]) {
  return customerTransactions(
    payments,
    ledger.filter((row) => !isSittingLedger(row)),
  );
}

export function previewRows<T>(rows: T[], expanded: boolean, limit = CUSTOMER_TXN_PREVIEW) {
  return { visible: expanded ? rows : rows.slice(0, limit), canToggle: rows.length > limit };
}

export function visibleCustomerTransactions(rows: CustomerTxn[], expanded: boolean) {
  return previewRows(rows, expanded);
}
