import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureChatMediaColumns } from "@/lib/ora-chat-media";
import { getSql } from "@/lib/db";
import {
  RECALL_INBOX_SQL,
  RECALL_READING_SQL,
  RECALLED_THREAD_PREVIEW,
  REFRESH_INBOX_PREVIEW_SQL,
} from "./ora-message-recall-rules.ts";

export {
  RECALL_INBOX_SQL,
  RECALL_READING_SQL,
  RECALLED_THREAD_PREVIEW,
  REFRESH_INBOX_PREVIEW_SQL,
  publicMessageContent,
  recallSqlChangesMoneyOrAlerts,
  applyLocalRecalls,
} from "./ora-message-recall-rules.ts";

export const recallInboxMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { messageId?: string }) => ({
    messageId: String(input?.messageId || "").slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    if (!data.messageId) throw new Error("That message can't be recalled.");
    const { assertOwnerViewIsReadOnly } = await import("./ora-view-as");
    await assertOwnerViewIsReadOnly(context.userId);
    await ensureChatMediaColumns();
    const sql = await getSql();
    const rows = await sql.query<{ id: string; thread_id: string }>(RECALL_INBOX_SQL, [data.messageId, context.userId]);
    if (!rows.length) throw new Error("That message can't be recalled.");
    await sql.query(REFRESH_INBOX_PREVIEW_SQL, [rows[0].thread_id, RECALLED_THREAD_PREVIEW, rows[0].id]);
    return { ok: true as const };
  });

export const recallReadingMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { messageId?: string }) => ({
    messageId: String(input?.messageId || "").slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    if (!data.messageId) throw new Error("That message can't be recalled.");
    const { assertOwnerViewIsReadOnly } = await import("./ora-view-as");
    await assertOwnerViewIsReadOnly(context.userId);
    await ensureChatMediaColumns();
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(RECALL_READING_SQL, [data.messageId, context.userId]);
    if (!rows.length) throw new Error("That message can't be recalled.");
    return { ok: true as const };
  });
