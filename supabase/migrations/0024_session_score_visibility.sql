alter table quiz_sessions add column scores_visible boolean not null default false;
alter table teams add column attendance_mode text not null default 'REMOTE' check (attendance_mode in ('IN_PERSON', 'REMOTE'));
