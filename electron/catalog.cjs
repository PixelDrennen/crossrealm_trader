const fs=require('node:fs/promises');const path=require('node:path');
// Decode inert JSON references emitted by React Router; never evaluate website JavaScript.
function decodePage(html){
 const match=html.match(/streamController\.enqueue\(("(?:[^"\\]|\\.)*")\)/);if(!match)throw Error('TSM page format changed: no page data');
 const data=JSON.parse(JSON.parse(match[1]));const memo=new Map();
 function read(index){if(index<0)return null;if(memo.has(index))return memo.get(index);const v=data[index];if(v===undefined)throw Error('Invalid TSM page reference');
  if(Array.isArray(v)){const out=[];memo.set(index,out);for(const n of v)out.push(typeof n==='number'?read(n):n);return out;}
  if(v&&typeof v==='object'){const out=Object.create(null);memo.set(index,out);for(const [k,n] of Object.entries(v))out[k.startsWith('_')?read(Number(k.slice(1))):k]=read(n);return out;}return v;
 }return read(0).loaderData;
}
function extractRealms(loader){const list=loader.root.realmAuctionHouses.filter(x=>x.realm.gameType==='retail'&&x.realm.region.gameVersionType==='retail'&&['us','eu','kr','tw'].includes(x.realm.region.slug)).map(x=>({key:`${x.realm.region.slug}:${x.slug}`,region:x.realm.region.slug,slug:x.slug,name:x.realm.name,auctionHouseId:x.auctionHouse.id}));return [...new Map(list.map(x=>[x.key,x])).values()].sort((a,b)=>a.region.localeCompare(b.region)||a.name.localeCompare(b.name));}
function extractGroup(loader,definition){const route=Object.values(loader).find(x=>x?.publishedGroup&&x?.group);if(!route)throw Error('No public TSM group found');const records=new Map();const paths=[];
 function walk(group,ancestors=[]){const parts=[...ancestors,group.name];paths.push(parts.join(' / '));for(const item of group.items||[]){if(item.type!=='item')continue;const id=String(item.id);const previous=records.get(id);const record=previous||{id,quality:item.quality,icon:item.icon,craftingTier:item.craftingTier||0,name:item.names?.en_US||item.names?.en_GB||`Item ${id}`,paths:[]};record.paths.push(parts.join(' / '));records.set(id,record);}for(const child of group.subGroups||[])walk(child,parts);}
 walk(route.group);return {...definition,name:route.publishedGroup.name,author:route.publishedGroup.author.name,source:`https://tradeskillmaster.com/retail/groups/${definition.id}`,updatedAt:new Date().toISOString(),items:[...records.values()],paths};
}
function normalizeState(s){const region=s.region||'us';const realms=[...new Set((s.realms||['gurubashi']).map(r=>r.includes(':')?r:`${region}:${r}`))];let home=s.defaultRealm||realms[0];if(!home.includes(':'))home=`${region}:${home}`;return {...s,realms,defaultRealm:realms.includes(home)?home:realms[0]};}
const realmPattern=/^(us|eu|kr|tw):[a-z0-9-]+$/;
function validState(s){return Array.isArray(s.realms)&&s.realms.length>0&&s.realms.every(x=>typeof x==='string'&&realmPattern.test(x))&&s.realms.includes(s.defaultRealm);}
class CatalogService{
 constructor(dir,fetcher=fetch){this.dir=dir;this.fetcher=fetcher;this.pending=new Map();this.presentations=new Map();this.bundle=null;}
 async page(url){const r=await this.fetcher(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`TSM website HTTP ${r.status}`);return decodePage(await r.text());}
 async get(){let realms=require('./catalog/realms.json');let issue=null;const cache=path.join(this.dir,'realm-directory.json');try{const cached=JSON.parse(await fs.readFile(cache,'utf8'));if(Date.now()-cached.savedAt<86400000)realms=cached.realms;else throw Error('Expired');}catch{try{realms=extractRealms(await this.page('https://tradeskillmaster.com/public-data'));if(!realms.length)throw Error('No Retail realms');await fs.mkdir(this.dir,{recursive:true});await fs.writeFile(cache,JSON.stringify({savedAt:Date.now(),realms}));}catch(e){issue=`Using bundled realm directory: ${e.message}`;}}
 const groups=JSON.parse(require('node:zlib').gunzipSync(require('node:fs').readFileSync(path.join(__dirname,'catalog/groups.json.gz'))));return {realms,groups,issue};}
 async presentation(id,full=false){
 if(!/^\d+$/.test(String(id)))throw Error('Invalid item ID');id=String(id);
 if(!this.bundle){const groups=JSON.parse(require('node:zlib').gunzipSync(require('node:fs').readFileSync(path.join(__dirname,'catalog/groups.json.gz'))));this.bundle=new Map();for(const g of groups)for(const i of g.items){const old=this.bundle.get(i.id)||{};this.bundle.set(i.id,{...old,...i,paths:[...new Set([...(old.paths||[]),...i.paths])]});}}
 const known=this.bundle.get(id)||{};let data=this.presentations.get(id);
 if(!data){try{const cached=JSON.parse(await fs.readFile(path.join(this.dir,`presentation-${id}.json`),'utf8'));if(Date.now()-cached.savedAt<14*86400000)data=cached.data;}catch{}}
 if(!data&&(full||!known.icon)){try{const response=await this.fetcher(`https://nether.wowhead.com/tooltip/item/${id}`,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Crossrealm-Trader'}});if(!response.ok)throw Error(`HTTP ${response.status}`);data=await response.json();await fs.mkdir(this.dir,{recursive:true});await fs.writeFile(path.join(this.dir,`presentation-${id}.json`),JSON.stringify({savedAt:Date.now(),data}));this.presentations.set(id,data);}catch(e){return {...known,id,unavailable:e.message};}}
 const q=['POOR','COMMON','UNCOMMON','RARE','EPIC','LEGENDARY','ARTIFACT','HEIRLOOM'];const icon=String(data?.icon||known.icon||'').replace(/\.(jpg|png)$/i,'');return {...known,id,name:data?.name||known.name,quality:typeof data?.quality==='number'?q[data.quality]:known.quality,iconURL:/^[a-z0-9_-]+$/i.test(icon)?`https://wow.zamimg.com/images/wow/icons/small/${icon}.jpg`:null,tooltip:data?.tooltip||null};
 }
 async item(id){if(!/^\d+$/.test(String(id)))throw Error('Invalid item ID');if(this.pending.has(id))return this.pending.get(id);
 const task=(async()=>{await fs.mkdir(this.dir,{recursive:true});const file=path.join(this.dir,`item-${id}.json`);try{const cached=JSON.parse(await fs.readFile(file,'utf8'));if(Date.now()-cached.savedAt<30*86400000)return cached.item;}catch{}
 const loader=await this.page(`https://tradeskillmaster.com/retail/us/items/${id}`);const route=Object.values(loader).find(x=>x?.item?.id&&x.item.type==='item');if(!route)throw Error(`No TSM metadata for item ${id}`);const x=route.item;const tooltip=route.wowheadTooltip||'';
 const binding=/Binds when equipped/i.test(tooltip)?'BOE':/Binds when picked up/i.test(tooltip)?'BOP':/Binds when used/i.test(tooltip)?'BOU':/Warbound|Binds to.*(?:account|Warband)/i.test(tooltip)?'ACCOUNT':/<!--bo-->/.test(tooltip)?'NONE':null;
 const item={id:String(id),icon:x.iconImage,craftingTier:x.craftingQualityTier||0,quality:x.quality,level:x.level??null,requiredLevel:x.requiredLevel??null,category:x.className||null,subCategory:x.subClassName||null,binding,source:`https://tradeskillmaster.com/retail/us/items/${id}`,fetchedAt:new Date().toISOString()};await fs.writeFile(file,JSON.stringify({savedAt:Date.now(),item}));return item;})();this.pending.set(id,task);try{return await task;}finally{this.pending.delete(id);}
 }
}
module.exports={decodePage,extractRealms,extractGroup,normalizeState,validState,CatalogService};
