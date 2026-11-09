export const money = cents => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(cents)||0)/100);
export const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const monthEnd = month => { const [y,m]=month.split('-').map(Number); return `${month}-${new Date(Date.UTC(y,m,0)).getUTCDate()}`; };
export const monthShift = (month, n) => { const [y,m]=month.split('-').map(Number); return new Date(Date.UTC(y,m-1+n,1)).toISOString().slice(0,7); };
export const displayDate = date => date?.slice(0,10).split('-').reverse().join('/') || '—';
export function isoWeek(date=today()){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const y=d.getUTCFullYear(),start=new Date(Date.UTC(y,0,1));return y+'-'+String(Math.ceil((((d-start)/86400000)+1)/7)).padStart(2,'0');}
export function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value||'') && !Number.isNaN(Date.parse(value)) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value; }
export function toCents(value) {
  if (typeof value==='number') { if (!Number.isFinite(value)) throw Error('Valor inválido.'); return Math.round(value*100); }
  let s=String(value??'').trim().replace(/R\$|\s/g,'');
  if(!s || !/^-?(?:\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?)$/.test(s)) throw Error('Informe um valor como 150,00.');
  if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
  else if(/^-?\d{1,3}(?:\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
  const n=Math.round(Number(s)*100); if(!Number.isSafeInteger(n) || Math.abs(n)>99999999999) throw Error('Valor fora do limite.'); return n;
}
export function totals(snapshot, end=monthEnd(today().slice(0,7)), now=today()) {
  const h=snapshot.household||{}, opening=Number(h.opening_cents)||0, start=h.opening_date||'1900-01-01';
  const entries=(snapshot.entries||[]).filter(e=>!e.deleted_at && e.date>=start);
  const bills=(snapshot.bills||[]).filter(b=>!b.deleted_at);
  const sign=e=>e.kind==='income'?1:-1;
  const posted=entries.filter(e=>e.status==='paid' && e.date<=now).reduce((s,e)=>s+sign(e)*Number(e.amount_cents),0);
  const paidBills=bills.filter(b=>b.paid_on && b.paid_on>=start && b.paid_on<=now).reduce((s,b)=>s+Number(b.amount_cents),0);
  const actual=opening+posted-paidBills;
  if(end<now){return {actual,projected:opening+entries.filter(e=>e.status==='paid'&&e.date<=end).reduce((s,e)=>s+sign(e)*Number(e.amount_cents),0)-bills.filter(b=>b.paid_on&&b.paid_on>=start&&b.paid_on<=end).reduce((s,b)=>s+Number(b.amount_cents),0),incoming:0,outgoing:0,overdue:0};}
  const pending=entries.filter(e=>(e.status==='planned'||e.date>now)&&e.date<=end);
  const pendingBills=bills.filter(b=>!b.paid_on && b.due_date>=start && b.due_date<=end);
  const incoming=pending.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.amount_cents),0);
  const outgoing=pending.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.amount_cents),0)+pendingBills.reduce((s,b)=>s+Number(b.amount_cents),0);
  return {actual,projected:actual+incoming-outgoing,incoming,outgoing,overdue:pending.filter(e=>e.date<now).length+pendingBills.filter(b=>b.due_date<now).length};
}
export function monthTotals(snapshot,month) {
  const entries=(snapshot.entries||[]).filter(e=>!e.deleted_at&&e.status==='paid'&&e.date.startsWith(month));
  const bills=(snapshot.bills||[]).filter(b=>!b.deleted_at&&b.paid_on?.startsWith(month));
  return {income:entries.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.amount_cents),0),expense:entries.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.amount_cents),0)+bills.reduce((s,b)=>s+Number(b.amount_cents),0)};
}
export const categories=['Mercado','Alimentação','Transporte','Moradia','Saúde','Lazer','Mango','Merlot','Assinaturas','Outros'];
export const incomeCategories=['Salário','Auxílios','Comissão','Extras','Freelas','Outros'];
export function guessCategory(text) {
 const s=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 for(const [re,cat] of [[/mango/,'Mango'],[/merlot/,'Merlot'],[/mercado|supermerc|atacadao|carrefour/,'Mercado'],[/uber|gasolina|posto|combust|estacionamento/,'Transporte'],[/ifood|restaurante|lanche|pizza|almoco|janta|comida/,'Alimentação'],[/aluguel|condominio|luz|energia|agua|internet/,'Moradia'],[/farmacia|medic|consulta|saude/,'Saúde'],[/netflix|spotify|assinatura/,'Assinaturas']]) if(re.test(s)) return cat;
 return 'Outros';
}
export function quickEntry(text) {
 const match=text.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?)/i);
 if(!match) throw Error('Inclua o valor. Exemplo: 50 reais gasolina.');
 const kind=/ganhei|recebi|sal[áa]rio|comiss[ãa]o|entrada|freela/i.test(text)?'income':'expense';
 const title=text.replace(match[0],'').replace(/\b(reais|real|gastei|paguei|recebi|ganhei)\b/gi,'').trim() || (kind==='income'?'Entrada':'Despesa');
 return {title,kind,amount_cents:toCents(match[1]),category:kind==='income'?'Outros':guessCategory(text),date:today(),status:'paid'};
}
