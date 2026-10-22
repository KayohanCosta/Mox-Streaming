import { expect, it } from 'vitest';
import { completeEpisodeList } from './episode-list';
import type { Episode } from './tmdb';
const first:Episode={id:1,episode_number:1,name:'Nome do TMDB',overview:'Sinopse',still_path:null,vote_average:8};
it('continues a single-season novela when TMDB has only the first chapter',()=>{
 const sources=[1,2,3].map(episode=>({season:null,episode,language:'pt' as const,page_url:`/observed-${episode}`}));
 const list=completeEpisodeList([first],sources,1,1);
 expect(list.map(e=>e.episode_number)).toEqual([1,2,3]);expect(list[0]).toBe(first);
});
it('does not assign absolute anime numbering to ambiguous seasons',()=>{
 const sources=[{season:null,episode:24,language:'pt' as const,page_url:'/observed'}];
 expect(completeEpisodeList([first],sources,2,3)).toEqual([first]);
});
