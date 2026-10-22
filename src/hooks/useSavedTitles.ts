import { profileStorageKey, PROFILE_EVENT } from "@/lib/profiles";
import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { getTitle, getYear, type MediaItem } from '@/lib/tmdb';
export interface SavedTitle { id:number; type:'movie'|'tv'; title:string; year:string; poster_path:string|null; backdrop_path:string|null; vote_average:number; savedAt:number }
const KEY='mox.saved.v1';const listeners=new Set<()=>void>();let cache:SavedTitle[]|undefined;let cacheKey='';
function load():SavedTitle[]{try{const data:unknown=JSON.parse(localStorage.getItem(profileStorageKey(KEY))||'[]');if(!Array.isArray(data))return[];return data.filter((x):x is SavedTitle=>!!x&&Number.isSafeInteger(x.id)&&x.id>0&&['movie','tv'].includes(x.type)&&typeof x.title==='string'&&typeof x.savedAt==='number');}catch{return[];}}
function read(){const key=profileStorageKey(KEY);if(cacheKey!==key){cacheKey=key;cache=undefined;}return cache??(cache=load());}
function notify(){for(const fn of listeners)fn();}
function storage(event:StorageEvent){if(event.key===profileStorageKey(KEY)||event.key===null){cache=load();notify();}}
function profileChanged(){cache=undefined;cacheKey='';notify();}
function subscribe(fn:()=>void){listeners.add(fn);if(listeners.size===1){const fresh=load();if(JSON.stringify(cache)!==JSON.stringify(fresh))cache=fresh;window.addEventListener('storage',storage);window.addEventListener(PROFILE_EVENT,profileChanged);}return()=>{listeners.delete(fn);if(!listeners.size)window.removeEventListener('storage',storage);window.removeEventListener(PROFILE_EVENT,profileChanged);};}
const empty:SavedTitle[]=[];
export function useSavedTitles(){return useSyncExternalStore(subscribe,read,()=>empty);}
function write(items:SavedTitle[]){try{localStorage.setItem(profileStorageKey(KEY),JSON.stringify(items));cache=items;notify();return true;}catch{toast.error('Não foi possível salvar neste navegador. Verifique o espaço e as permissões.');return false;}}
export function toggleSavedTitle(item:MediaItem,type:'movie'|'tv'){
 const originKey=profileStorageKey(KEY);const current=read();const old=current.find(x=>x.id===item.id&&x.type===type);
 if(old){if(write(current.filter(x=>x!==old)))toast('Título removido da sua lista',{action:{label:'Desfazer',onClick:()=>{if(profileStorageKey(KEY)!==originKey)return;if(!read().some(x=>x.id===old.id&&x.type===old.type))write([old,...read()]);}}});return;}
 const entry:SavedTitle={id:item.id,type,title:getTitle(item),year:getYear(item),poster_path:item.poster_path,backdrop_path:item.backdrop_path,vote_average:item.vote_average||0,savedAt:Date.now()};
 if(write([entry,...current]))toast.success('Adicionado à sua lista');
}
export function savedAsMedia(item:SavedTitle):MediaItem{return{id:item.id,title:item.title,poster_path:item.poster_path,backdrop_path:item.backdrop_path,overview:'',popularity:0,vote_average:item.vote_average,media_type:item.type,release_date:item.type==='movie'?item.year:undefined,first_air_date:item.type==='tv'?item.year:undefined};}
