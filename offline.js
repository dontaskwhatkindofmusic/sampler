'use strict';
let offlineRegistration=null,offlineBusy=false;
function waitForOfflineWorker(worker){return new Promise((resolve,reject)=>{if(!worker){reject(Error('Offline install did not start. Try again while online.'));return}const check=()=>{if(['installed','activated'].includes(worker.state)){cleanup();resolve(worker)}else if(worker.state==='redundant'){cleanup();reject(Error('Offline download failed. Check your connection and try again.'))}};const timeout=setTimeout(()=>{cleanup();reject(Error('Offline download timed out. Try again while online.'))},30000);const cleanup=()=>{clearTimeout(timeout);worker.removeEventListener('statechange',check)};worker.addEventListener('statechange',check);check()})}
function checkOfflineCache(worker,type='CHECK_OFFLINE'){return new Promise((resolve,reject)=>{const channel=new MessageChannel();const timeout=setTimeout(()=>{channel.port1.close();reject(Error('Could not verify the offline copy. Try again.'))},type==='REPAIR_OFFLINE'?30000:5000);channel.port1.onmessage=({data})=>{clearTimeout(timeout);channel.port1.close();data?.ready?resolve():reject(Error('Offline copy is incomplete. Reconnect and save it again.'))};worker.postMessage({type},[channel.port2])})}
async function enableOffline(){
 if(offlineBusy)return;offlineBusy=true;$('offlineRetry').disabled=true;$('offlineStatus').textContent='Saving the instrument for offline use…';
 try{
 if(!('serviceWorker' in navigator)||!window.isSecureContext)throw Error('Offline saving needs HTTPS and a browser with service workers.');
 const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});offlineRegistration=registration;
 try{if(!registration.installing)await registration.update()}catch(error){if(!registration.active)throw error}
 const worker=registration.installing||registration.waiting||registration.active;
 await waitForOfflineWorker(worker);try{await checkOfflineCache(worker)}catch{await checkOfflineCache(worker,'REPAIR_OFFLINE')}
 $('offlineRefresh').hidden=!registration.waiting;
 $('offlineStatus').textContent=registration.waiting?'Offline update downloaded. Stop playback, then reload the update.':'Ready offline. Open this page or its Home Screen icon without a connection. Keep exported backups; device storage can be cleared.';
 $('offlineOpen').textContent=mobileUI?'offline + Home Screen':'offline + Home Screen [shift+h]';
 }catch(error){$('offlineStatus').textContent=error.message||'Offline saving failed. Connect to the internet and try again.'}
 finally{offlineBusy=false;$('offlineRetry').disabled=false}
}
$('offlineOpen').onclick=()=>{$('offlineDialog').showModal();enableOffline()};
$('offlineRetry').onclick=enableOffline;$('offlineClose').onclick=()=>$('offlineDialog').close();
$('offlineRefresh').onclick=()=>{
 if(playing||recorder||importing){$('offlineStatus').textContent='Stop playback and finish recording/importing before reloading.';return}
 if(!offlineRegistration?.waiting)return;
 navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
 offlineRegistration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
};
// Existing opt-in installs check for updates; first-time visitors are not enrolled.
if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.getRegistration('./').then(registration=>{if(!registration)return;offlineRegistration=registration;return registration.update()}).catch(()=>{});
