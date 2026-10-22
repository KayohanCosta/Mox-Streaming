import {describe,expect,it} from 'vitest';
import {matchSourceIdentity,sourceIdentityQuery} from './source-identity';
import type {CatalogTitle} from './source-catalog';
const source:CatalogTitle={id:'a'.repeat(24),title:'180 (Dublado) - 2026 - 1080p',kind:'title',url:'https://redecanais.by/180_123456789.html',playback_validated:false};
const movie={id:41,title:'180',media_type:'movie',release_date:'2026-04-01',poster_path:'/tmdb.jpg',backdrop_path:null,vote_average:7,overview:'Uma história',popularity:1};
describe('source identity verification',()=>{
 it('preserves titles containing parentheses and extracts source language and year',()=>{expect(sourceIdentityQuery('(Des)controle (Nacional) - 2026 - 1080p')).toEqual({name:'(Des)controle',year:'2026'});});
 it('uses the canonical TMDB identity only for an exact title and year',()=>{expect(matchSourceIdentity(source,[movie])?.id).toBe(41);expect(matchSourceIdentity(source,[{...movie,release_date:'2024-01-01'}])).toBeNull();expect(matchSourceIdentity(source,[{...movie,title:'Outro título'}])).toBeNull();});
 it('refuses ambiguous remakes, people and episode pages rather than showing unrelated artwork',()=>{expect(matchSourceIdentity(source,[movie,{...movie,id:42}])).toBeNull();expect(matchSourceIdentity(source,[{...movie,media_type:'person'}])).toBeNull();expect(matchSourceIdentity({...source,kind:'episode'},[movie])).toBeNull();});
});
