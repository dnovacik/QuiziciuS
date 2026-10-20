-- Roster names are captain-managed; players have no accounts.
create table registered_team_players (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references registered_teams(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 1 and 60),
 created_at timestamptz not null default now()
);
create unique index registered_team_players_name_idx on registered_team_players(team_id, lower(btrim(name)));
create index registered_team_players_team_idx on registered_team_players(team_id);
alter table registered_team_players enable row level security;

-- Lock parent row to serialize concurrent inserts and guarantee max 6.
create or replace function add_registered_team_player(p_team uuid,p_captain uuid,p_name text)
returns registered_team_players language plpgsql security definer set search_path=public as $$
declare v_player registered_team_players;
begin
 perform 1 from registered_teams where id=p_team and captain_id=p_captain for update;
 if not found then raise exception 'Not team captain' using errcode='42501'; end if;
 if length(btrim(p_name)) not between 1 and 60 then raise exception 'Invalid player name' using errcode='22023'; end if;
 if (select count(*) from registered_team_players where team_id=p_team)>=6 then
   raise exception 'Roster full' using errcode='22023';
 end if;
 insert into registered_team_players(team_id,name) values(p_team,btrim(p_name)) returning * into v_player;
 return v_player;
end $$;
revoke all on function add_registered_team_player(uuid,uuid,text) from public,anon,authenticated;
grant execute on function add_registered_team_player(uuid,uuid,text) to service_role;
