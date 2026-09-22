-- Heartbeat for open advisor presence so "online time today" does not keep
-- counting after the desk is abandoned. Additive only.

alter table ora_advisor_presence
  add column if not exists last_seen_at timestamptz;
