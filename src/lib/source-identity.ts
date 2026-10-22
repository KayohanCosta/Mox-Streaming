import { searchMulti, type MediaItem } from './tmdb';
import type { CatalogTitle } from './source-catalog';
export function sourceIdentityQuery(title: string) {
 const years=[...title.matchAll(/[-–]\s*((?:19|20)\d{2})(?=\s*[-–]|\s*$)/g)];
 const year=years.at(-1)?.[1];
 const name=title.replace(/\s*\((?:dublado|legendado|nacional)\).*$/i,'').replace(/\s*[-–]\s*(?:dublado|legendado|nacional|lista de epis[oó]dios|lista de cap[ií]tulos).*$/i,'').replace(/\s*[-–]\s*(?:19|20)\d{2}\s*[-–].*$/,'').trim();
 return {name,year};
}
function fold(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');}
export function matchSourceIdentity(item: CatalogTitle, candidates:MediaItem[]) {
 if(!['title','series'].includes(item.kind))return null;
 const {name,year}=sourceIdentityQuery(item.title);const type=item.kind==='series'?'tv':'movie';
 if(!name || (type==='movie'&&!year))return null;
 const matches=candidates.filter(candidate=>candidate.media_type===type&&[candidate.title,candidate.name,candidate.original_title,candidate.original_name].some(title=>title&&fold(title)===fold(name))&&(!year||(candidate.release_date||candidate.first_air_date||'').slice(0,4)===year));
 const unique=[...new Map(matches.map(x=>[x.id,x])).values()];return unique.length===1?unique[0]:null;
}
export async function resolveSourceIdentity(item: CatalogTitle){const query=sourceIdentityQuery(item.title);if(!query.name)return null;return matchSourceIdentity(item,(await searchMulti(query.name)).results);}
