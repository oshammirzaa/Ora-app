alter table ora_applications add column if not exists listing_categories text not null default '';
alter table ora_advisors add column if not exists listing_categories text not null default '';
