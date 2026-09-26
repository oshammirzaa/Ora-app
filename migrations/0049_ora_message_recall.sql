-- Recall / unsend. Hides a sent message from both people in the chat.
-- Does not refund coins, change reading timers, or rewrite notification rows.

alter table ora_messages add column if not exists recalled_at timestamptz;
alter table ora_advisor_inbox_messages add column if not exists recalled_at timestamptz;
