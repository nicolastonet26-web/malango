-- Mango Money: esquema inicial. Executar uma vez no projeto Supabase do aplicativo.
begin;
create extension if not exists pgcrypto with schema extensions;
create table public.mango_profiles(user_id uuid primary key references auth.users(id) on delete cascade, display_name text not null check(length(display_name) between 1 and 80), financial_profile text, created_at timestamptz not null default now());
create table public.mango_households(id uuid primary key default gen_random_uuid(),name text not null default 'Nosso cantinho' check(length(name) between 1 and 80),opening_cents bigint not null default 0 check(abs(opening_cents)<=99999999999),opening_date date not null default current_date,created_by uuid not null references auth.users(id),version integer not null default 1);
create table public.mango_members(user_id uuid primary key references auth.users(id) on delete cascade,household_id uuid not null references public.mango_households(id),joined_at timestamptz not null default now());
create index mango_members_household_idx on public.mango_members(household_id);
create table public.mango_invites(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.mango_households(id),token_hash text unique not null,expires_at timestamptz not null,used_at timestamptz);
create table public.mango_entries(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.mango_households(id),title text not null check(length(title) between 1 and 160),kind text not null check(kind in ('income','expense')),amount_cents bigint not null check(amount_cents>0 and amount_cents<=99999999999),category text not null default 'Outros' check(length(category)<=80),date date not null,status text not null check(status in ('paid','planned')),responsible text not null default 'Casal' check(length(responsible)<=80),recurrence_group uuid,import_key text check(length(import_key)<=500),created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,version integer not null default 1);
create index mango_entries_household_date_idx on public.mango_entries(household_id,date);
create unique index mango_entries_import_idx on public.mango_entries(household_id,import_key) where import_key is not null and deleted_at is null;
create table public.mango_cards(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.mango_households(id),name text not null check(length(name) between 1 and 80),due_day integer not null default 10 check(due_day between 1 and 31),created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),version integer not null default 1,unique(id,household_id));
create table public.mango_bills(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.mango_households(id),card_id uuid not null,month date not null check(extract(day from month)=1),amount_cents bigint not null check(amount_cents>=0 and amount_cents<=99999999999),due_date date not null,paid_on date,created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,version integer not null default 1,foreign key(card_id,household_id) references public.mango_cards(id,household_id));
create unique index mango_bills_card_month_idx on public.mango_bills(card_id,month) where deleted_at is null;
create table public.mango_goals(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.mango_households(id),title text not null check(length(title) between 1 and 160),target_cents bigint not null check(target_cents>0 and target_cents<=99999999999),saved_cents bigint not null default 0 check(saved_cents>=0 and saved_cents<=99999999999),created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,version integer not null default 1);
create table public.mango_xp(user_id uuid not null references auth.users(id),event_key text not null,points integer not null,created_at timestamptz not null default now(),primary key(user_id,event_key));

create function public.mango_household_id() returns uuid language sql stable security definer set search_path='' as $$ select household_id from public.mango_members where user_id=(select auth.uid()) $$;
revoke all on function public.mango_household_id() from public; grant execute on function public.mango_household_id() to authenticated;
alter table public.mango_profiles enable row level security;
alter table public.mango_households enable row level security;
alter table public.mango_members enable row level security;
alter table public.mango_invites enable row level security;
alter table public.mango_entries enable row level security;
alter table public.mango_cards enable row level security;
alter table public.mango_bills enable row level security;
alter table public.mango_goals enable row level security;
alter table public.mango_xp enable row level security;
create policy profiles_read on public.mango_profiles for select to authenticated using(user_id=auth.uid() or user_id in(select user_id from public.mango_members where household_id=public.mango_household_id()));
create policy profiles_insert on public.mango_profiles for insert to authenticated with check(user_id=auth.uid());
create policy profiles_update on public.mango_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy members_read on public.mango_members for select to authenticated using(household_id=public.mango_household_id());
create policy household_read on public.mango_households for select to authenticated using(id=public.mango_household_id());
create policy household_update on public.mango_households for update to authenticated using(id=public.mango_household_id()) with check(id=public.mango_household_id());
create policy xp_read on public.mango_xp for select to authenticated using(user_id=auth.uid());
do $$ declare t text; begin foreach t in array array['mango_entries','mango_cards','mango_bills','mango_goals'] loop
 execute format('create policy member_read on public.%I for select to authenticated using(household_id=public.mango_household_id())',t);
 execute format('create policy member_insert on public.%I for insert to authenticated with check(household_id=public.mango_household_id() and created_by=auth.uid())',t);
 execute format('create policy member_update on public.%I for update to authenticated using(household_id=public.mango_household_id()) with check(household_id=public.mango_household_id())',t);
end loop; end $$;
revoke all on public.mango_profiles,public.mango_households,public.mango_members,public.mango_invites,public.mango_entries,public.mango_cards,public.mango_bills,public.mango_goals,public.mango_xp from anon;
grant select,insert,update on public.mango_profiles,public.mango_entries,public.mango_cards,public.mango_bills,public.mango_goals to authenticated;
grant select,update on public.mango_households to authenticated;
grant select on public.mango_members,public.mango_xp to authenticated;
revoke insert,update,delete on public.mango_members,public.mango_invites,public.mango_xp from authenticated;
revoke insert,delete on public.mango_households from authenticated;
revoke delete on public.mango_profiles,public.mango_entries,public.mango_cards,public.mango_bills,public.mango_goals from authenticated;

create function public.mango_row_guard() returns trigger language plpgsql set search_path='' as $$ begin
 if TG_OP='UPDATE' then
   NEW.id:=OLD.id; NEW.household_id:=OLD.household_id;NEW.created_by:=OLD.created_by;NEW.created_at:=OLD.created_at;NEW.version:=OLD.version+1;
 else NEW.created_by:=auth.uid();NEW.version:=1; end if;
 NEW.updated_at:=now();
 if TG_TABLE_NAME='mango_entries' then
   if NEW.status='paid' and NEW.date>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Lançamentos futuros devem ficar como previstos.';end if;
 end if;
 if TG_TABLE_NAME='mango_bills' then
   if NEW.paid_on>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'O pagamento não pode ter uma data futura.';end if;
 end if;
 return NEW;end $$;
do $$ declare t text; begin foreach t in array array['mango_entries','mango_cards','mango_bills','mango_goals'] loop execute format('create trigger guard before insert or update on public.%I for each row execute function public.mango_row_guard()',t);end loop;end $$;
create function public.mango_household_guard() returns trigger language plpgsql set search_path='' as $$ begin NEW.id:=OLD.id;NEW.created_by:=OLD.created_by;NEW.version:=OLD.version+1;return NEW;end $$;
create trigger household_guard before update on public.mango_households for each row execute function public.mango_household_guard();

create function public.mango_create_household(p_name text,p_opening bigint,p_date date) returns uuid language plpgsql security definer set search_path='' as $$ declare hid uuid;begin
 if auth.uid() is null then raise exception 'Entre na sua conta.';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if exists(select 1 from public.mango_members where user_id=auth.uid()) then raise exception 'Você já participa de um casal.';end if;
 if p_date>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data do saldo inicial não pode ser futura.';end if;
 insert into public.mango_households(name,opening_cents,opening_date,created_by) values(p_name,p_opening,p_date,auth.uid()) returning id into hid;
 insert into public.mango_members(user_id,household_id) values(auth.uid(),hid);return hid;end $$;
create function public.mango_pair_code() returns text language plpgsql security definer set search_path='' as $$ declare hid uuid:=public.mango_household_id();code text:=encode(extensions.gen_random_bytes(18),'hex');begin
 if hid is null then raise exception 'Crie o espaço do casal primeiro.';end if;
 perform 1 from public.mango_households where id=hid for update;
 if (select count(*) from public.mango_members where household_id=hid)>=2 then raise exception 'O casal já tem dois participantes.';end if;
 update public.mango_invites set used_at=now() where household_id=hid and used_at is null;
 insert into public.mango_invites(household_id,token_hash,expires_at) values(hid,encode(extensions.digest(code,'sha256'),'hex'),now()+interval '24 hours');return code;end $$;
create function public.mango_join(p_code text) returns uuid language plpgsql security definer set search_path='' as $$ declare inv public.mango_invites;begin
 if auth.uid() is null then raise exception 'Entre na sua conta.';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if exists(select 1 from public.mango_members where user_id=auth.uid()) then raise exception 'Você já participa de um casal.';end if;
 select * into inv from public.mango_invites where token_hash=encode(extensions.digest(trim(p_code),'sha256'),'hex') and used_at is null and expires_at>now();
 if inv.id is null then raise exception 'Código inválido ou vencido.';end if;
 perform 1 from public.mango_households where id=inv.household_id for update;
 select * into inv from public.mango_invites where id=inv.id and used_at is null and expires_at>now() for update;
 if inv.id is null then raise exception 'Código inválido ou vencido.';end if;
 if (select count(*) from public.mango_members where household_id=inv.household_id)>=2 then raise exception 'Este casal já tem dois participantes.';end if;
 insert into public.mango_members(user_id,household_id) values(auth.uid(),inv.household_id);update public.mango_invites set used_at=now() where id=inv.id;return inv.household_id;end $$;

create function public.mango_entry_xp() returns trigger language plpgsql security definer set search_path='' as $$ declare d date:=(now() at time zone 'America/Sao_Paulo')::date;u uuid:=auth.uid();begin
 if u is null or NEW.deleted_at is not null then return NEW;end if;
 if NEW.kind='expense' and NEW.status='paid' and NEW.date=d then insert into public.mango_xp values(u,'expense:'||d,20,now()) on conflict do nothing;end if;
 if NEW.kind='income' and NEW.status='paid' and date_trunc('week',NEW.date::timestamp)=date_trunc('week',d::timestamp) then insert into public.mango_xp values(u,'income:'||to_char(d,'IYYY-IW'),25,now()) on conflict do nothing;end if;
 if NEW.kind='expense' and NEW.recurrence_group is not null then insert into public.mango_xp values(u,'fixed:'||to_char(d,'YYYY-MM'),30,now()) on conflict do nothing;end if;return NEW;end $$;
create trigger entry_xp after insert or update on public.mango_entries for each row execute function public.mango_entry_xp();
create function public.mango_finish_lesson(p_lesson integer,p_answers integer[]) returns jsonb language plpgsql security definer set search_path='' as $$ declare expected integer[];score integer:=0;i integer;begin
 if auth.uid() is null then raise exception 'Entre na sua conta.';end if;
 expected:=case p_lesson when 1 then array[1,0,1] when 2 then array[1,1,1] when 3 then array[0,1,1] else null end;
 if expected is null or p_answers is null or cardinality(p_answers)<>3 then raise exception 'Responda às três perguntas.';end if;
 for i in 1..3 loop if p_answers[i]=expected[i] then score:=score+1;end if;end loop;
 if score>=2 then insert into public.mango_xp values(auth.uid(),'lesson:'||p_lesson,75,now()) on conflict do nothing;end if;
 if (select count(*) from public.mango_xp where user_id=auth.uid() and event_key like 'lesson:%')=3 then insert into public.mango_xp values(auth.uid(),'all-lessons',50,now()) on conflict do nothing;end if;
 return jsonb_build_object('score',score,'passed',score>=2);end $$;
revoke all on function public.mango_create_household(text,bigint,date),public.mango_pair_code(),public.mango_join(text),public.mango_finish_lesson(integer,integer[]) from public;
grant execute on function public.mango_create_household(text,bigint,date),public.mango_pair_code(),public.mango_join(text),public.mango_finish_lesson(integer,integer[]) to authenticated;
commit;
