import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {MemoryRouter,Route,Routes} from "react-router-dom";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import DetailsPage from "./DetailsPage";
import {resolveEpisodeStream} from "@/lib/redecanais";
import {getWatchProgress} from "@/hooks/useWatchProgress";
vi.mock("@/components/Navbar",()=>({default:()=>null}));
vi.mock("@/components/ContentRow",()=>({default:()=>null}));
vi.mock("@/lib/tmdb",async importOriginal=>({...await importOriginal<typeof import("@/lib/tmdb")>(),
 fetchDetails:vi.fn(async()=>({id:84958,name:"Loki",original_name:"Loki",first_air_date:"2021-01-01",poster_path:null,backdrop_path:null,overview:"",vote_average:8,genres:[],credits:{crew:[],cast:[]},seasons:[{season_number:1,episode_count:2},{season_number:2,episode_count:1}]})),
 fetchSeasonEpisodes:vi.fn(async(_id:number,s:number)=>(s===1?[1,2]:[1]).map(e=>({id:s*10+e,episode_number:e,name:`Episódio ${e}`,overview:"",still_path:null,vote_average:8}))),
 fetchVideos:vi.fn(async()=>[]),fetchSimilar:vi.fn(async()=>[]),fetchCertification:vi.fn(async()=>"14")
}));
vi.mock("@/lib/redecanais",()=>({fetchMovieSources:vi.fn(),resolveMovieStream:vi.fn(),
 prepareEpisodeStream:vi.fn(async()=>"/prepared.mp4"),prepareMovieStream:vi.fn(async()=>"/prepared.mp4"),
 fetchSeriesSources:vi.fn(async()=>({tmdb_id:84958,episodes:[{season:1,episode:1,language:"pt"},{season:1,episode:2,language:"pt"},{season:2,episode:1,language:"pt"}]})),
 resolveEpisodeStream:vi.fn(async(_id:number,s:number,e:number)=>`/s${s}e${e}.mp4`)
}));
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();vi.spyOn(HTMLMediaElement.prototype,"play").mockResolvedValue(undefined);vi.spyOn(HTMLMediaElement.prototype,"pause").mockImplementation(()=>{});vi.spyOn(HTMLMediaElement.prototype,"load").mockImplementation(()=>{});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it("resumes seconds and advances across episodes and seasons, then stops at the end",async()=>{
 const {container}=render(<MemoryRouter initialEntries={["/details/tv/84958"]}><Routes><Route path="/details/:type/:id" element={<DetailsPage/>}/></Routes></MemoryRouter>);
 fireEvent.click(await screen.findByRole("button",{name:"Assistir"}));
 const video=async(src:string)=>{await waitFor(()=>expect(container.querySelector("video")?.getAttribute("src")).toBe(src));const v=container.querySelector("video")!;Object.defineProperty(v,"duration",{value:100,configurable:true});fireEvent.loadedMetadata(v);return v;};
 let v=await video("/s1e1.mp4");v.currentTime=55;fireEvent.pause(v);expect(getWatchProgress(84958,"tv",1,1)?.currentTime).toBe(55);
 fireEvent.click(screen.getByRole("button",{name:"Voltar"}));fireEvent.click(screen.getByRole("button",{name:"Continuar Assistindo"}));
 v=await video("/s1e1.mp4");expect(v.currentTime).toBe(55);
 const reusedVideo=v;
 v.currentTime=100;fireEvent.ended(v);v=await video("/s1e2.mp4");expect(v).toBe(reusedVideo);expect(v.currentTime).toBe(0);expect(getWatchProgress(84958,"tv",1,1)?.completed).toBe(true);
 v.currentTime=100;fireEvent.ended(v);v=await video("/s2e1.mp4");expect(v.currentTime).toBe(0);
 const calls=vi.mocked(resolveEpisodeStream).mock.calls.length;v.currentTime=100;fireEvent.ended(v);
 await waitFor(()=>expect(getWatchProgress(84958,"tv",2,1)?.completed).toBe(true));expect(vi.mocked(resolveEpisodeStream).mock.calls.length).toBe(calls);
});
it("opens the episode drawer and selects an episode while retaining the video element",async()=>{
 const {container}=render(<MemoryRouter initialEntries={["/details/tv/84958"]}><Routes><Route path="/details/:type/:id" element={<DetailsPage/>}/></Routes></MemoryRouter>);
 fireEvent.click(await screen.findByRole("button",{name:"Assistir"}));
 await waitFor(()=>expect(container.querySelector("video")?.getAttribute("src")).toBe("/s1e1.mp4"));
 const video=container.querySelector("video");
 fireEvent.click(screen.getByRole("button",{name:"Abrir episódios"}));
 expect(screen.getByRole("dialog",{name:"Lista de episódios"})).toBeInTheDocument();
 fireEvent.click(await screen.findByRole("button",{name:"Episódio 2: Episódio 2"}));
 await waitFor(()=>expect(video?.getAttribute("src")).toBe("/s1e2.mp4"));
 expect(container.querySelector("video")).toBe(video);
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it('advances a novela using observed chapters when TMDB lists just one episode',async()=>{
 const tmdb=await import('@/lib/tmdb');const api=await import('@/lib/redecanais');
 const original=await tmdb.fetchDetails(84958,'tv');
 vi.mocked(tmdb.fetchDetails).mockResolvedValueOnce({...original,seasons:[{...original.seasons![0],season_number:1,episode_count:1}]});
 vi.mocked(tmdb.fetchSeasonEpisodes).mockResolvedValueOnce([{id:11,episode_number:1,name:'Episódio 1',overview:'',still_path:null,vote_average:8}]);
 vi.mocked(api.fetchSeriesSources).mockResolvedValueOnce({tmdb_id:84958,title:'Loki',numbering:'absolute',episodes:[1,2].map(episode=>({season:null,episode,language:'pt',page_url:`https://redecanais.by/chapter-${episode}.html`}))});
 const {container}=render(<MemoryRouter initialEntries={['/details/tv/84958']}><Routes><Route path="/details/:type/:id" element={<DetailsPage/>}/></Routes></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'Assistir'}));
 await waitFor(()=>expect(container.querySelector('video')?.getAttribute('src')).toBe('/s1e1.mp4'));
 const video=container.querySelector('video')!;Object.defineProperty(video,'duration',{value:100,configurable:true});fireEvent.loadedMetadata(video);video.currentTime=100;fireEvent.ended(video);
 await waitFor(()=>expect(container.querySelector('video')?.getAttribute('src')).toBe('/s1e2.mp4'));
});
it('opens Continue Watching directly at the saved episode and second',async()=>{
 localStorage.setItem('watch_progress',JSON.stringify([{id:84958,type:'tv',title:'Loki',poster_path:null,season:1,episode:2,currentTime:321,progress:32,language:'pt',updatedAt:Date.now()}]));
 const {container}=render(<MemoryRouter initialEntries={['/details/tv/84958?resume=1']}><Routes><Route path="/details/:type/:id" element={<DetailsPage/>}/></Routes></MemoryRouter>);
 await waitFor(()=>expect(container.querySelector('video')?.getAttribute('src')).toBe('/s1e2.mp4'));
 const video=container.querySelector('video')!;Object.defineProperty(video,'duration',{value:1000,configurable:true});fireEvent.loadedMetadata(video);expect(video.currentTime).toBe(321);
});
