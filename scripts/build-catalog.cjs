const fs=require('node:fs/promises');const {decodePage,extractRealms,extractGroup}=require('../electron/catalog.cjs');
const definitions=[
{"id": "01khex4s28kws7dj5kfxq8n5he", "label": "Vanilla archive", "expansion": "Vanilla"},
{"id": "01kheyc93grkebt88qgkafah58", "label": "The Burning Crusade archive", "expansion": "The Burning Crusade"},
{"id": "01kheypdcbgvnhy6xyz1cxf481", "label": "Wrath of the Lich King archive", "expansion": "Wrath of the Lich King"},
{"id": "01kheyv44659kzyfbncds7b3jw", "label": "Cataclysm archive", "expansion": "Cataclysm"},
{"id": "01khez12yrwrvqyn81hres0jvq", "label": "Mists of Pandaria archive", "expansion": "Mists of Pandaria"},
{"id": "01khez321xp52643h1gaj3crpp", "label": "Warlords of Draenor archive", "expansion": "Warlords of Draenor"},
{"id": "01khez4m19ykab5avjjz502yyb", "label": "Legion archive", "expansion": "Legion"},
{"id": "01khez6qre79cqse2gv4etx9rn", "label": "Battle for Azeroth archive", "expansion": "Battle for Azeroth"},
{"id": "01khez9chxnkys625ypxn1hpnz", "label": "Shadowlands archive", "expansion": "Shadowlands"},
{"id": "01khezat6vaaw97btk2fkz2bpj", "label": "Dragonflight archive", "expansion": "Dragonflight"},
{"id": "01khg3t07zwyq7a7sywkdbgdvp", "label": "The War Within archive", "expansion": "The War Within"},
 {id:'01jcgntn2bfex88c2ee14d2kc8',label:'Mounts'},
 {id:'01jd2ca5ch2zpkww9t8s5m2wtb',label:'Patterns & Plans'},
 {id:'01jd2bwgbazypbwh57b5bsa6rr',label:'Materials'},
 {id:'01jd2bt542dg79x84jp071th9h',label:'Consumables'},
 {id:'01kbrjv3xtw55x8dy2cfmrdjrq',label:'Housing decor'},
 {id:'01jd2chew74etqnn5fhbpjy71x',label:'Legacy transmog A–C'},
 {id:'01kk7errk2d4a3rwjsbd65fppw',label:'Midnight expansion archive',expansion:'Midnight'}
];
async function page(url){const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`${url}: ${response.status}`);return decodePage(await response.text());}
(async()=>{const realms=extractRealms(await page('https://tradeskillmaster.com/public-data'));await fs.writeFile('electron/catalog/realms.json',JSON.stringify(realms));const groups=[];let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<definitions.length){const d=definitions[cursor++];const g=extractGroup(await page(`https://tradeskillmaster.com/retail/groups/${d.id}`),d);groups.push(g);process.stdout.write(`${g.name}: ${g.items.length} items\n`);}}));groups.sort((a,b)=>definitions.findIndex(d=>d.id===a.id)-definitions.findIndex(d=>d.id===b.id));await fs.writeFile('electron/catalog/groups.json.gz',require('node:zlib').gzipSync(JSON.stringify(groups)));console.log(`${realms.length} Retail realms saved`);})().catch(e=>{console.error(e);process.exitCode=1;});
