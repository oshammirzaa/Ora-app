-- Optional customer gender for King / Queen / neutral crown badges.
-- Additive only. Lifetime spend is still derived at read time from
-- ora_payments where status = 'succeeded' (refunded rows leave that set).
-- Does not alter wallets, payments, refunds, membership, or readings.

alter table ora_profiles add column if not exists gender text not null default '';
