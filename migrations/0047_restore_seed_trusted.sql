-- The automatic window refresh used to clear ora_advisors.trusted for anyone
-- outside the Top 10, which removed the original featured badges. Restore only
-- the four demo advisors from 0004. It does not assign manual ranks.
update ora_advisors
set trusted = true
where id in ('adv_mira', 'adv_rowan', 'adv_imani', 'adv_soren');
