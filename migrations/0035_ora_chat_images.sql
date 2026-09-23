alter table ora_advisor_inbox_messages add column if not exists image_url text;
alter table ora_messages add column if not exists image_url text;
