const fs = require('node:fs/promises');
const path = require('node:path');
const BASE = 'https://public-data.tradeskillmaster.com/retail';
function parseCSV(text) {
  const rows=[]; let row=[],field='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) { const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"'){field+='"';i++;}else quoted=!quoted; }
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw Error('Unclosed CSV quote');
  if(field||row.length){row.push(field);rows.push(row);}
  const headers=rows.shift()||[];
  return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??''])));
}
function number(v){return v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);}
function merge(region, realm, commodities) {
  const r=new Map(region.map(x=>[x.itemId,x])); const local=new Map(realm.map(x=>[x.itemId,{...x,scope:'Realm'}]));
  for(const x of commodities)local.set(x.itemId,{...x,scope:'Region commodity'});
  return [...new Set([...r.keys(),...local.keys()])].map(id=>{const a=r.get(id)||{},b=local.get(id)||{};return {id:`i:${id}`,itemId:id,name:a.name||b.name||`Item ${id}`,minBuyout:number(b.minBuyout),quantity:number(b.quantity),marketValue:number(b.marketValue),historical:number(b.historical),recent:number(b.recent),regionMarketValue:number(a.marketValue),regionHistorical:number(a.historical),saleAvg:number(a.avgSalePrice),saleRate:number(a.saleRate),soldPerDay:number(a.soldPerDay),scope:b.scope||'No realm listing',realmUpdatedAt:b.updatedAt||null,regionUpdatedAt:a.updatedAt||null};});
}
function parseGroup(text){
 if(text.trim().startsWith('!TSM'))throw Error('Compressed !TSM strings are not supported yet. Use a plain TSM item string (i:123,i:456) or item IDs.');
 const tokens=text.split(/[\s,;]+/).filter(Boolean); const ids=[];
 for(const t of tokens){if(t.startsWith('group:'))continue;if(/^\d+$/.test(t))ids.push(`i:${t}`);else if(/^i:\d+(?::\d+)*$/.test(t))ids.push(t);else throw Error(`Unsupported item token: ${t.slice(0,60)}. Use item IDs or plain i: item strings.`);}
 if(!ids.length)throw Error('No item IDs found');return [...new Set(ids)];
}
function exportGroup(ids){return ids.join(',');}
class DataService {
 constructor(dir,fetcher=fetch){this.dir=dir;this.fetcher=fetcher;this.inflight=new Map();}
 async file(region,suffix,force=false){
  if(!/^(us|eu|kr|tw)$/.test(region)||! /^(region\/items|commodities|realm\/[a-z0-9-]+\/items)\.csv$/.test(suffix))throw Error('Invalid data source');
  const key=`${region}-${suffix.replaceAll('/','-')}`;if(this.inflight.has(key))return this.inflight.get(key);
  const work=(async()=>{await fs.mkdir(this.dir,{recursive:true});const p=path.join(this.dir,key+'.json');let cached;
   try{cached=JSON.parse(await fs.readFile(p,'utf8'));}catch{}
   if(cached&&!force&&Date.now()-cached.fetchedAt<60*60*1000)return {...cached,offline:false};
   try {const response=await this.fetcher(`${BASE}/${region}/${suffix}`,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const rows=parseCSV(await response.text());if(!rows.length||!('itemId' in rows[0])||!('updatedAt' in rows[0]))throw Error('Unexpected TSM CSV schema');const result={rows,fetchedAt:Date.now()};await fs.writeFile(p,JSON.stringify(result));return {...result,offline:false};}
   catch(error){if(cached)return {...cached,offline:true,error:error.message};throw Error(`TSM ${suffix}: ${error.message}`);}
  })();this.inflight.set(key,work);try{return await work;}finally{this.inflight.delete(key);}
 }
 async load(region,realm,force){const sources=await Promise.all([this.file(region,'region/items.csv',force),this.file(region,`realm/${realm}/items.csv`,force),this.file(region,'commodities.csv',force)]);return {items:merge(...sources.map(s=>s.rows)),offline:sources.some(s=>s.offline),errors:sources.filter(s=>s.error).map(s=>s.error),fetchedAt:Math.min(...sources.map(s=>s.fetchedAt))};}
}
module.exports={parseCSV,merge,parseGroup,exportGroup,DataService};
