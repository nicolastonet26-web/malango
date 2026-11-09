import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured=Boolean(url&&key);
export const db=configured?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export function unwrap(result){if(result.error)throw result.error;return result.data;}
async function allRows(table){const rows=[];for(let offset=0;offset<100000;offset+=500){let query=db.from('mango_'+table).select('*').order(['profiles','xp','members'].includes(table)?'user_id':'id');if(table==='xp')query=query.order('event_key');const page=unwrap(await query.range(offset,offset+499));rows.push(...page);if(page.length<500)return rows;}throw Error('A consulta excedeu o limite de segurança. Nenhum saldo parcial será exibido.');}
export async function loadSnapshot(user){
 if(!db)throw Error('O banco do aplicativo ainda está sendo configurado.');
 let profile=unwrap(await db.from('mango_profiles').select('*').eq('user_id',user.id).maybeSingle());
 if(!profile)profile=unwrap(await db.from('mango_profiles').insert({user_id:user.id,display_name:user.user_metadata?.display_name||user.email.split('@')[0]}).select().single());
 const [households,members,entries,cards,bills,goals,xp,profiles]=await Promise.all(['households','members','entries','cards','bills','goals','xp','profiles'].map(allRows));
 return {household:households[0]||null,members,entries,cards,bills,goals,xp,profiles,profile};
}
export async function saveRecord(table,record,existing){
 if(existing){const {id,version}=existing;const data=unwrap(await db.from('mango_'+table).update(record).eq('id',id).eq('version',version).select());if(!data.length)throw Error('Este registro mudou em outro aparelho. Atualize a tela antes de tentar novamente.');return data[0];}
 return unwrap(await db.from('mango_'+table).insert(record).select().single());
}
export async function insertEntries(entries){return unwrap(await db.from('mango_entries').insert(entries).select());}
export async function rpc(name,args){return unwrap(await db.rpc('mango_'+name,args));}
export const authMessage=e=>({'Invalid login credentials':'E-mail ou senha incorretos.','Email not confirmed':'Confirme seu e-mail antes de entrar.','User already registered':'Este e-mail já está cadastrado.','Email rate limit exceeded':'Limite de e-mails atingido. Aguarde alguns minutos.','Failed to fetch':'Não foi possível conectar. Confira sua internet.'}[e?.message]||e?.message||'Não foi possível concluir. Tente novamente.');
