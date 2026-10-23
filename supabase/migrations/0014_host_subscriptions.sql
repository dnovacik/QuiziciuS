-- Host subscriptions, set by hand by a super admin (one price, no plans; no payment provider yet).
-- A host may launch quiz nights while `subscribed_until` (inclusive, a Slovak calendar day) has not
-- passed, or forever when `subscription_forever` is set. Super admins are always subscribed.
-- `subscription_trial` marks the automatic 14-day trial a new host gets; it is cleared as soon as a
-- super admin sets a date.
alter table profiles add column subscribed_until date;
alter table profiles add column subscription_forever boolean not null default false;
alter table profiles add column subscription_trial boolean not null default false;

-- Hosts that exist today start their trial now.
update profiles
set subscribed_until = (now() at time zone 'Europe/Bratislava')::date + 14,
    subscription_trial = true
where role = 'HOST' and subscribed_until is null;
