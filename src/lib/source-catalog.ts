import { CONTENT_UNAVAILABLE_MESSAGE } from './redecanais';
const CLOUD=(import.meta.env.VITE_CATALOG_API_URL||'https://bqkthfboqvlboglodiyz.supabase.co/functions/v1/mox-api').replace(/\/$/,'');
export interface CatalogTitle {id:string;title:string;kind:string;url:string;image_url?:string|null;playback_validated:false}
export interface CatalogPage {items:CatalogTitle[];page:number;per_page:number;total:number;total_pages:number;complete_catalog:false}
async function read(path:string,signal?:AbortSignal){const r=await fetch(CLOUD+path,{signal});const data=await r.json();if(!r.ok)throw Error(data.error?.message||'Não foi possível consultar o catálogo.');return data;}
export function fetchSourceCatalog(query:string,kind:string,page:number,signal?:AbortSignal):Promise<CatalogPage>{return read('/v1/catalog?'+new URLSearchParams({site:'vod',kind,q:query,page:String(page),per_page:'40'}),signal);}
export async function fetchSourceTitle(id:string,signal?:AbortSignal):Promise<CatalogTitle>{if(!/^[a-f0-9]{24}$/.test(id))throw Error(CONTENT_UNAVAILABLE_MESSAGE);return (await read('/v1/items/'+id,signal)).item;}
