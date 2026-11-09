import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

test('banco isola casais, limita convite e impede XP duplicado', async()=>{
 const db=new PGlite({extensions:{pgcrypto}});
 try{
 await db.exec(`set timezone='America/Sao_Paulo';create schema auth;create schema extensions;create role anon;create role authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const file of ['001_mango.sql','002_profile.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
 const ids=[1,2,3].map(n=>'00000000-0000-4000-8000-00000000000'+n);
 for(const id of ids)await db.query('insert into auth.users values($1)',[id]);
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 await as(ids[0]);
 const hid=(await db.query("select mango_create_household('Casal A',10000,current_date) id")).rows[0].id;
 const code=(await db.query('select mango_pair_code() code')).rows[0].code;
 await db.query("insert into mango_entries(household_id,title,kind,amount_cents,date,status) values($1,'Mercado','expense',500,current_date,'paid')",[hid]);
 await db.query("insert into mango_entries(household_id,title,kind,amount_cents,date,status) values($1,'Padaria','expense',100,current_date,'paid')",[hid]);
 assert.equal((await db.query('select sum(points)::int xp from mango_xp')).rows[0].xp,20);
 await assert.rejects(()=>db.query("insert into mango_xp(user_id,event_key,points) values($1,'fake',9999)",[ids[0]]));
 await as(ids[1]);await db.query('select mango_join($1)',[code]);
 assert.equal((await db.query('select count(*)::int n from mango_entries')).rows[0].n,2);
 await assert.rejects(()=>db.query('select mango_pair_code()'));
 await as(ids[2]);await assert.rejects(()=>db.query('select mango_join($1)',[code]));
 await db.query("select mango_create_household('Casal B',0,current_date)");
 assert.equal((await db.query('select count(*)::int n from mango_entries')).rows[0].n,0);
 await assert.rejects(()=>db.query("insert into mango_entries(household_id,title,kind,amount_cents,date,status) values($1,'Invasão','expense',1,current_date,'paid')",[hid]));
 assert.equal((await db.query("update mango_households set opening_cents=999 where id=$1 returning id",[hid])).rows.length,0);
 await as(ids[0]);
 for(let n=0;n<2;n++)await db.query('select mango_finish_lesson(1,array[1,0,1])');
 assert.equal((await db.query("select count(*)::int n from mango_xp where event_key='lesson:1'")).rows[0].n,1);
 await assert.rejects(()=>db.query('select mango_profile_quiz(null)'));
 }finally{await db.close();}
});
