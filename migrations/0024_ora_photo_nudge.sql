-- One-time customer profile-picture reminder.
-- Additive only. Does not alter wallets, membership, loyalty, chat, or payments.
-- The customer photo itself stays on Better Auth "user".image (existing identity).

alter table ora_profiles add column if not exists photo_nudge_started_at timestamptz;
alter table ora_profiles add column if not exists photo_nudge_dismissed_at timestamptz;
