-- Free-minute streak and referral rewards. Additive only.
-- Does not change coin prices, commission, welcome minutes, or existing balances.

alter table ora_wallets add column if not exists streak_seconds integer not null default 0;
alter table ora_wallets add column if not exists referral_seconds integer not null default 0;

alter table ora_readings add column if not exists streak_used integer not null default 0;
alter table ora_readings add column if not exists referral_used integer not null default 0;

alter table ora_daily_reward_claims add column if not exists minutes integer not null default 0;

alter table ora_referrals add column if not exists referrer_minutes integer not null default 0;
alter table ora_referrals add column if not exists referred_minutes integer not null default 0;
alter table ora_referrals add column if not exists fraud_status text not null default '';
alter table ora_referrals add column if not exists fraud_reason text not null default '';
alter table ora_referrals add column if not exists referrer_ip_hash text not null default '';
alter table ora_referrals add column if not exists referred_ip_hash text not null default '';
alter table ora_referrals add column if not exists referrer_device_hash text not null default '';
alter table ora_referrals add column if not exists referred_device_hash text not null default '';
