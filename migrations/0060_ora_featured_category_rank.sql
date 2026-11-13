create table if not exists ora_featured_rank (
  advisor_id text not null,
  category text not null,
  rank integer not null,
  primary key (advisor_id, category)
);

create unique index if not exists ora_featured_rank_cat_rank_uidx
  on ora_featured_rank (category, rank);
