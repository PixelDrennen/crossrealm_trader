const {app,BrowserWindow,ipcMain,dialog,clipboard,shell}=require('electron');
const {autoUpdater}=require('electron-updater');
const fs=require('node:fs/promises');const path=require('node:path');
const {DataService,parseGroup,exportGroup,parseCSV}=require('./data.cjs');
let win,service;let updateStatus={message:'Checking for updates…',ready:false};
const statePath=()=>path.join(app.getPath('userData'),'settings.json');
const defaults={region:'us',realms:['gurubashi','area-52','stormrage'],defaultRealm:'gurubashi',favorites:[],lists:[]};
async function readState(){try{return {...defaults,...JSON.parse(await fs.readFile(statePath(),'utf8'))};}catch{return structuredClone(defaults);}}
function update(message,ready=false){updateStatus={message,ready};win?.webContents.send('update-status',updateStatus);}
app.whenReady().then(async()=>{
 service=new DataService(path.join(app.getPath('userData'),'cache'));
 ipcMain.handle('state:get',readState);
 ipcMain.handle('state:save',async(_,state)=>{if(!['us','eu','kr','tw'].includes(state.region)||!Array.isArray(state.realms)||!state.realms.length||state.realms.some(r=>! /^[a-z0-9-]+$/.test(r))||!state.realms.includes(state.defaultRealm))throw Error('Invalid settings');const tmp=statePath()+'.tmp';await fs.writeFile(tmp,JSON.stringify(state,null,2));await fs.rename(tmp,statePath());return true;});
 ipcMain.handle('data:load',(_,region,realm,force)=>service.load(region,realm,!!force));
 ipcMain.handle('group:parse',(_,text)=>parseGroup(text));
 ipcMain.handle('group:copy',(_,ids)=>{clipboard.writeText(exportGroup(ids));return true;});
 ipcMain.handle('ledger:import',async()=>{const result=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'TSM ledger CSV',extensions:['csv']}]});if(result.canceled)return null;const rows=parseCSV(await fs.readFile(result.filePaths[0],'utf8'));if(!rows.length)throw Error('CSV has no rows');await fs.writeFile(path.join(app.getPath('userData'),'ledger.json'),JSON.stringify(rows));return rows;});
 ipcMain.handle('ledger:get',async()=>{try{return JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'ledger.json'),'utf8'));}catch{return [];}});
 ipcMain.handle('update:get',()=>updateStatus);
 ipcMain.handle('update:check',async()=>{if(!app.isPackaged)return update('Updates available in the installed AppImage');return autoUpdater.checkForUpdates().then(()=>updateStatus);});
 ipcMain.handle('update:install',()=>{if(updateStatus.ready)autoUpdater.quitAndInstall();});
 ipcMain.handle('release:open',()=>shell.openExternal('https://github.com/PixelDrennen/crossrealm_trader/releases/latest'));
 win=new BrowserWindow({width:1430,height:920,minWidth:1080,minHeight:680,backgroundColor:'#131513',title:'Crossrealm Trader',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());await win.loadFile(path.join(__dirname,'../src/index.html'));
 autoUpdater.autoDownload=true;autoUpdater.autoInstallOnAppQuit=true;
 autoUpdater.on('checking-for-update',()=>update('Checking for updates…'));
 autoUpdater.on('update-available',i=>update(`Downloading ${i.version}…`));
 autoUpdater.on('update-not-available',()=>update('You have the latest version'));
 autoUpdater.on('download-progress',p=>update(`Downloading update · ${Math.round(p.percent)}%`));
 autoUpdater.on('update-downloaded',()=>update('Update ready · restart to install',true));
 autoUpdater.on('error',e=>update(`Update check failed: ${e.message}`));
 const check=()=>{if(app.isPackaged&&process.env.APPIMAGE)autoUpdater.checkForUpdates().catch(()=>{});else update('Automatic updates use the AppImage · RPM updates on Releases');};check();setInterval(check,4*60*60*1000).unref();
});
app.on('window-all-closed',()=>app.quit());
