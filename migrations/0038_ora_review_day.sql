alter table ora_reviews add column if not exists review_day text;

create unique index if not exists ora_reviews_client_advisor_day_idx
  on ora_reviews (client_id, advisor_id, review_day)
  where review_day is not null and review_day <> '';
