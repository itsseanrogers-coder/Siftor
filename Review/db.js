/* ═══ storage: IndexedDB for state, thumbnails and media; optional on-disk media folder via File System Access ═══ */
'use strict';
const DB=(()=>{
 let db=null;
 function open(){return new Promise((res,rej)=>{const r=indexedDB.open('bm-review',2);r.onupgradeneeded=()=>{const d=r.result;for(const s of ['meta','blobs','thumbs','handles'])if(!d.objectStoreNames.contains(s))d.createObjectStore(s)};r.onsuccess=()=>{db=r.result;res(db)};r.onerror=()=>rej(r.error)})}
 const tx=(store,mode,fn)=>new Promise((res,rej)=>{const t=db.transaction(store,mode);const s=t.objectStore(store);const q=fn(s);t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)});
 const get=(store,key)=>new Promise((res,rej)=>{const t=db.transaction(store,'readonly');const q=t.objectStore(store).get(key);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
 const put=(store,key,val)=>tx(store,'readwrite',s=>s.put(val,key));
 const del=(store,key)=>tx(store,'readwrite',s=>s.delete(key));
 const keys=store=>new Promise((res,rej)=>{const t=db.transaction(store,'readonly');const q=t.objectStore(store).getAllKeys();q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
 /* media folder on disk (Chrome: File System Access). Falls back to IndexedDB blobs. */
 let dir=null;
 async function dirHandle(){if(dir)return dir;try{const h=await get('handles','media');if(h){const p=await h.queryPermission({mode:'readwrite'});if(p==='granted'){dir=h;return dir}}}catch(e){}return null}
 async function pickDir(){if(!window.showDirectoryPicker)throw new Error('This browser cannot write to a folder (needs Chrome).');const h=await window.showDirectoryPicker({id:'bm-review-media',mode:'readwrite',startIn:'desktop'});await put('handles','media',h);dir=h;return h}
 async function reconnectDir(){try{const h=await get('handles','media');if(!h)return null;const p=await h.requestPermission({mode:'readwrite'});if(p==='granted'){dir=h;return h}}catch(e){}return null}
 async function saveMedia(id,file){const d=await dirHandle();if(d){try{const ext=(file.name.match(/\.[A-Za-z0-9]+$/)||[''])[0];const fh=await d.getFileHandle(id+ext,{create:true});const w=await fh.createWritable();await w.write(file);await w.close();return {where:'disk',name:id+ext}}catch(e){console.warn('disk write failed, using browser storage',e)}}await put('blobs',id,file);return {where:'idb',name:id}}
 async function loadMedia(id,ref){if(ref&&ref.where==='disk'){const d=await dirHandle();if(d){try{const fh=await d.getFileHandle(ref.name);return await fh.getFile()}catch(e){}}return null}return await get('blobs',id)}
 async function removeMedia(id,ref){if(ref&&ref.where==='disk'){const d=await dirHandle();if(d){try{await d.removeEntry(ref.name)}catch(e){}}}try{await del('blobs',id)}catch(e){}}
 return {open,get,put,del,keys,dirHandle,pickDir,reconnectDir,saveMedia,loadMedia,removeMedia,hasFS:!!window.showDirectoryPicker};
})();
