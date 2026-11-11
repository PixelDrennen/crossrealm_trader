const {validState}=require('./catalog.cjs');
function numeric(v,fallback=0){if(v===''||v===null||v===undefined)return fallback;const n=Number(v);if(!Number.isFinite(n)||n<0)throw Error('Deal limits must be non-negative numbers');return n;}
function normalizeConfig(input={}){const c={...input};for(const key of ['minPrice','maxPrice','minProfit','minMargin','minDiscount','minRate','minSold','maxAge','minLevel','maxLevel','minRequired','maxRequired','maxBuyPct','maxSellPct'])c[key]=numeric(c[key]);c.fee=numeric(c.fee,5);if(c.fee>=100||c.minRate>100||c.minDiscount>100)throw Error('Percent values are out of range');for(const [min,max] of [['minPrice','maxPrice'],['minLevel','maxLevel'],['minRequired','maxRequired']])if(c[max]&&c[min]>c[max])throw Error('Minimum cannot exceed maximum');if(c.reference==='home'&&(!c.realms?.includes(c.home)))throw Error('Include the default realm in the search');if(!['cross','home','region'].includes(c.reference))throw Error('Choose a valid comparison benchmark');if(!Array.isArray(c.realms)||!c.realms.length||!validState({realms:c.realms,defaultRealm:c.realms[0]}))throw Error('Select at least one realm');return c;}
function itemIndex(groups){const map=new Map();for(const g of groups)for(const i of g.items){let item=map.get(i.id);if(!item){item={...i,paths:[],groups:[],expansions:[]};map.set(i.id,item);}item.paths.push(...i.paths);item.groups.push(g.id);if(g.expansion)item.expansions.push(g.expansion);for(const p of i.paths){for(const part of p.split(' / ')){if(['Vanilla','The Burning Crusade','Wrath of the Lich King','Cataclysm','Mists of Pandaria','Warlords of Draenor','Legion','Battle for Azeroth','Shadowlands','Dragonflight','The War Within','Midnight'].includes(part))item.expansions.push(part);}}}return map;}
function catalogueMatch(item,c,index){const m=index.get(item.itemId);if(c.itemIds?.length&&!c.itemIds.includes(item.id))return false;if(c.groupIds?.length&&!c.groupIds.some(g=>m?.groups.includes(g)))return false;if(c.expansion&&!(m?.expansions.includes(c.expansion)))return false;if(c.path&&!m?.paths.some(p=>p.toLowerCase().includes(c.path.toLowerCase())))return false;if(c.name&&!item.name.toLowerCase().includes(c.name.toLowerCase()))return false;return true;}
function metadataMatch(meta,c){if(c.qualities?.length&&!c.qualities.includes(meta?.quality))return false;for(const [field,min,max] of [['level','minLevel','maxLevel'],['requiredLevel','minRequired','maxRequired']]){if(c[min]||c[max]){if(meta?.[field]==null)return false;if(meta[field]<c[min]||(c[max]&&meta[field]>c[max]))return false;}}if(c.category&&meta?.category!==c.category)return false;if(c.subCategory&&!meta?.subCategory?.toLowerCase().includes(c.subCategory.toLowerCase()))return false;if(c.binding&&meta?.binding!==c.binding)return false;return true;}
function needMetadata(meta,c){return !!(c.minLevel||c.maxLevel||c.minRequired||c.maxRequired||c.category||c.subCategory||c.binding||(c.qualities?.length&&!meta?.quality));}
function findCandidates(snapshots,c,directory,groups,now=Date.now()){
 const idx=itemIndex(groups);const realms=new Map(directory.map(r=>[r.key,r]));const byItem=new Map();const warnings=[];
 const fresh=(i)=>{const age=now-Date.parse(i.realmUpdatedAt);return !c.maxAge||(Number.isFinite(age)&&age<=c.maxAge*3600000);};
 for(const {key,data} of snapshots){if(data.offline&&!c.allowOffline){warnings.push(`${key}: offline cache excluded`);continue;}for(const i of data.items){if(!(i.minBuyout>0)||!fresh(i))continue;if(!catalogueMatch(i,c,idx))continue;if(c.scope==='realm'&&i.scope==='Region commodity'||c.scope==='commodity'&&i.scope!=='Region commodity')continue;const id=key.split(':')[0]+':'+i.itemId;if(!byItem.has(id))byItem.set(id,[]);byItem.get(id).push({...i,realm:key});}}
 const results=[];const seenCommodities=new Set();
 for(const entries of byItem.values())for(const buy of entries){
  if(c.maxBuyPct&&(!(buy.saleAvg>0)||buy.minBuyout>buy.saleAvg*c.maxBuyPct/100))continue;
  if(c.minPrice&&buy.minBuyout<c.minPrice*10000||c.maxPrice&&buy.minBuyout>c.maxPrice*10000)continue;
  if(c.minRate&&(buy.saleRate==null||buy.saleRate*100<c.minRate)||c.minSold&&(buy.soldPerDay==null||buy.soldPerDay<c.minSold))continue;
  let targets=[];
  if(c.reference==='region'){if(buy.saleAvg>0)targets=[{...buy,realm:'region',minBuyout:buy.saleAvg}];}
  else if(buy.scope!=='Region commodity'){targets=entries.filter(sell=>sell.realm!==buy.realm&&sell.realm.split(':')[0]===buy.realm.split(':')[0]&&(!realms.get(sell.realm)||!realms.get(buy.realm)||realms.get(sell.realm).auctionHouseId!==realms.get(buy.realm).auctionHouseId)&&(c.reference!=='home'||sell.realm===c.home));}
  if(c.maxSellPct)targets=targets.filter(sell=>buy.saleAvg>0&&sell.minBuyout<=buy.saleAvg*c.maxSellPct/100);
  targets.sort((a,b)=>b.minBuyout-a.minBuyout);const sell=targets[0];if(!sell)continue;
  const profit=sell.minBuyout*(1-c.fee/100)-buy.minBuyout;const margin=profit/buy.minBuyout*100;const discount=(1-buy.minBuyout/sell.minBuyout)*100;
  if(profit<=0||profit<c.minProfit*10000||margin<c.minMargin||discount<c.minDiscount)continue;
  if(buy.scope==='Region commodity'){const k=buy.realm.split(':')[0]+':'+buy.id;if(seenCommodities.has(k))continue;seenCommodities.add(k);}
  results.push({...buy,buyRealm:buy.realm,sellRealm:sell.realm,sellUpdatedAt:sell.realmUpdatedAt,referencePrice:sell.minBuyout,profit,margin,discount,benchmark:c.reference,offline:!!snapshots.find(s=>s.key===buy.realm)?.data.offline});
 }
 results.sort((a,b)=>b.profit-a.profit);return {results,warnings,index:idx};
}
class DealScanner{
 constructor(data,catalog,send){this.data=data;this.catalog=catalog;this.send=send;this.cancelled=false;this.running=false;}
 cancel(){this.cancelled=true;}
 async scan(input){if(this.running)throw Error('A deal search is already running');const c=normalizeConfig(input);this.running=true;this.cancelled=false;try{
 const catalog=await this.catalog.get();const known=new Set(catalog.realms.map(r=>r.key));if(c.realms.some(r=>!known.has(r)))throw Error('Unknown realm in deal search');
 const snapshots=[],failures=[];const houses=new Set();const targets=[...c.realms].sort((a,b)=>a===c.home?-1:b===c.home?1:0).filter(key=>{const realm=catalog.realms.find(r=>r.key===key);const house=realm.region+':'+realm.auctionHouseId;if(houses.has(house)){failures.push(`${key}: skipped duplicate connected auction house`);return false;}houses.add(house);return true;});let cursor=0,completed=0;const report=message=>this.send({message,completed,total:targets.length});
 await Promise.all(Array.from({length:Math.min(2,targets.length)},async()=>{while(cursor<targets.length&&!this.cancelled){const key=targets[cursor++];report(`Loading ${key}…`);try{const [region,slug]=key.split(':');snapshots.push({key,data:await this.data.load(region,slug,false)});}catch(e){failures.push(`${key}: ${e.message}`);}completed++;report(`Loaded ${completed} of ${targets.length} auction houses`);}}));
 if(this.cancelled)return {cancelled:true,results:[],warnings:failures,scanned:snapshots.map(s=>s.key)};
 const found=findCandidates(snapshots,c,catalog.realms,catalog.groups);const results=[],metadata=new Map();const ids=[...new Set(found.results.map(i=>i.itemId))];cursor=0;completed=0;let unknown=0;
 await Promise.all(Array.from({length:Math.min(3,ids.length)},async()=>{while(cursor<ids.length&&!this.cancelled){const id=ids[cursor++];let meta=found.index.get(id);if(needMetadata(meta,c)){this.send({message:`Checking item filters · ${completed+1} / ${ids.length}`,completed,total:ids.length});try{meta={...meta,...await this.catalog.item(id)};}catch(e){unknown++;meta=null;}}metadata.set(id,meta);completed++;}}));
 for(const i of found.results)if(metadataMatch(metadata.get(i.itemId),c))results.push({...i,metadata:metadata.get(i.itemId)||null});
 return {results,cancelled:this.cancelled,warnings:[...failures,...found.warnings,...(catalog.issue?[catalog.issue]:[]),...(unknown?[`${unknown} items excluded because required metadata could not be loaded`]:[])],scanned:snapshots.map(s=>s.key),config:c,finishedAt:new Date().toISOString()};
 }finally{this.running=false;}}
}
module.exports={normalizeConfig,itemIndex,catalogueMatch,metadataMatch,needMetadata,findCandidates,DealScanner};
