begin;
create function public.mango_profile_quiz(p_answers integer[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare score integer:=0;tier text;answer integer;begin
 if auth.uid() is null then raise exception 'Entre na sua conta.';end if;
 if p_answers is null or cardinality(p_answers)<>5 then raise exception 'Responda às cinco perguntas.';end if;
 foreach answer in array p_answers loop
  if answer is null or answer<0 or answer>2 then raise exception 'Resposta inválida.';end if;
  score:=score+2-answer;
 end loop;
 tier:=case when score>=8 then 'Organizado' when score>=5 then 'Em evolução' else 'Começando' end;
 update public.mango_profiles set financial_profile=tier where user_id=auth.uid();
 insert into public.mango_xp values(auth.uid(),'profile-quiz',40,now()) on conflict do nothing;
 return jsonb_build_object('tier',tier,'level',case when score>=8 then 3 when score>=5 then 2 else 1 end);
end $$;
revoke all on function public.mango_profile_quiz(integer[]) from public;
grant execute on function public.mango_profile_quiz(integer[]) to authenticated;
alter table public.mango_households add constraint opening_not_future check(opening_date<=(now() at time zone 'America/Sao_Paulo')::date);
commit;

do $$ declare f record; begin
for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'mango_%' loop
execute format('revoke execute on function %s from public, anon',f.signature);
end loop; end $$;
revoke execute on function public.mango_entry_xp(),public.mango_row_guard(),public.mango_household_guard() from authenticated;
