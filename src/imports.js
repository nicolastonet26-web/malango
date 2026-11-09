import {toCents,validDate,guessCategory} from './finance.js';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function dateValue(s) { s=String(s||'').trim(); const m=s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/); const iso=m?`${m[3]}-${m[2]}-${m[1]}`:s.slice(0,10); return validDate(iso)?iso:null; }
function row(date,title,amount,source_id='') { return {date,title:String(title||'Lançamento do extrato').trim().slice(0,160),amount_cents:Math.abs(amount),kind:amount<0?'expense':'income',category:guessCategory(title||''),source_id}; }
export function parseCSV(text) {
 const first=text.replace(/^\uFEFF/,'').split(/\r?\n/)[0];
 const delimiter=first.includes(';')?';':first.includes('\t')?'\t':',';
 const rows=[];let line=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===delimiter||c==='\n')){line.push(cell.trim());cell='';if(c==='\n'){if(line.some(Boolean))rows.push(line);line=[];}}else if(c!=='\r')cell+=c;}
 line.push(cell.trim());if(line.some(Boolean))rows.push(line);
 if(quoted)throw Error('O CSV contém aspas incompletas. Exporte o arquivo novamente.');
 if(rows.length<2)throw Error('O arquivo não contém lançamentos.');
 const headers=rows.shift().map(normalize), col=names=>headers.findIndex(h=>names.includes(h));
 const di=col(['data','date','data lancamento','data de lancamento','data da transacao']),ti=col(['descricao','description','historico','lancamento','titulo','title']),ai=col(['valor','amount','valor (r$)','valor da transacao']),ki=col(['tipo','type','natureza']),id=col(['id','identificador','fitid']);
 if(di<0||ai<0||ti<0)throw Error('Use um CSV com as colunas Data, Descrição e Valor. Despesas devem ter valor negativo ou Tipo = débito.');
 const warnings=[],data=[];
 rows.forEach((r,i)=>{try {const date=dateValue(r[di]);if(!date)throw Error('data inválida');let amount=toCents(r[ai]);if(ki>=0&&/debito|saida|despesa|debit|expense/.test(normalize(r[ki])))amount=-Math.abs(amount);if(!amount) return;if(/^saldo\b/i.test(r[ti]))return;data.push(row(date,r[ti],amount,id>=0?r[id]:''));}catch(e){warnings.push(`Linha ${i+2}: ${e.message}`);}});
 return {rows:data,warnings};
}
export function parseOFX(text) {
 const data=[],warnings=[];const blocks=[...text.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi)];
 const field=(s,name)=>(s.match(new RegExp('<'+name+'>([^<\r\n]+)','i'))?.[1]||'').trim();
 blocks.forEach((m,i)=>{const d=field(m[1],'DTPOSTED');const date=`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;const amount=Number(field(m[1],'TRNAMT'));if(!validDate(date)||!Number.isFinite(amount)){warnings.push(`Lançamento ${i+1}: data ou valor inválido.`);return;}if(amount!==0)data.push(row(date,[field(m[1],'NAME'),field(m[1],'MEMO')].filter(Boolean).join(' · '),Math.round(amount*100),field(m[1],'FITID')));});
 if(!blocks.length)throw Error('Nenhuma movimentação encontrada no OFX.'); return {rows:data,warnings};
}
export function parsePDFLines(lines) {
 const data=[],warnings=[];
 for(const line of lines){const m=line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?\s?(?:R\$\s*)?\d[\d.]*,\d{2})(?:\s*([DC]))?$/i);if(!m)continue;try{let amount=toCents(m[3].replace(/\s/g,''));if(m[4]?.toUpperCase()==='D')amount=-Math.abs(amount);const date=dateValue(m[1]);if(date&&!/^saldo\b/i.test(m[2])) data.push(row(date,m[2],amount));}catch{warnings.push('Uma linha do PDF não pôde ser interpretada.');}}
 if(!data.length)throw Error('Não consegui reconhecer os lançamentos deste PDF. Use CSV/OFX ou um PDF com texto selecionável, data completa e valor por linha.');
 warnings.unshift('PDF: confira cada linha. Layouts diferentes podem omitir lançamentos; a leitura não garante a totalidade do extrato.');return {rows:data,warnings};
}
export function markDuplicates(rows,existing=[]) {
 const counts=new Map(), keys=new Set(existing.filter(e=>!e.deleted_at).map(e=>e.import_key).filter(Boolean));
 const fingerprint=e=>`${e.date}|${e.kind}|${e.amount_cents}|${normalize(e.title)}`;
 const existingCounts=new Map();for(const e of existing.filter(e=>!e.deleted_at)){const k=fingerprint(e);existingCounts.set(k,(existingCounts.get(k)||0)+1);}
 return rows.map(r=>{const fp=fingerprint(r),occ=(counts.get(fp)||0)+1;counts.set(fp,occ);const import_key=r.source_id?`ofx:${r.source_id}`:`row:${fp}|${occ}`;return {...r,import_key,duplicate:keys.has(import_key)||(existingCounts.get(fp)||0)>=occ,selected:!(keys.has(import_key)||(existingCounts.get(fp)||0)>=occ)};});
}
export function analyzeRows(rows){const expense=rows.filter(r=>r.kind==='expense'),income=rows.filter(r=>r.kind==='income');const cats={};expense.forEach(r=>cats[r.category]=(cats[r.category]||0)+r.amount_cents);return {income:income.reduce((s,r)=>s+r.amount_cents,0),expense:expense.reduce((s,r)=>s+r.amount_cents,0),categories:Object.entries(cats).sort((a,b)=>b[1]-a[1]),largest:[...expense].sort((a,b)=>b.amount_cents-a.amount_cents).slice(0,3)};}
