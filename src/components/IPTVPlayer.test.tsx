import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import IPTVPlayer from "./IPTVPlayer";
beforeEach(()=>{
 vi.spyOn(HTMLMediaElement.prototype,"play").mockResolvedValue(undefined);
 vi.spyOn(HTMLMediaElement.prototype,"pause").mockImplementation(()=>{});
 vi.spyOn(HTMLMediaElement.prototype,"load").mockImplementation(()=>{});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe("movie language switching",()=>{
 it("starts in Portuguese and changes the source while restoring the playback position",async()=>{
  const resolve=vi.fn(async (_s:string,_a?:number,_b?:number,language="pt")=>"/movie-"+language+".mp4");
  const {container}=render(<IPTVPlayer contentTitle="Filme" source="movie" getStreamUrl={resolve}/>);
  await waitFor(()=>expect(container.querySelector("video")?.getAttribute("src")).toBe("/movie-pt.mp4"));
  const video=container.querySelector("video")!;Object.defineProperty(video,"duration",{value:7200,configurable:true});
  fireEvent.loadedMetadata(video);video.currentTime=120;fireEvent.timeUpdate(video);
  fireEvent.click(screen.getByRole("button",{name:"Faixa de áudio"}));
  fireEvent.click(screen.getByRole("button",{name:"English (Legendado)"}));
  await waitFor(()=>expect(video.getAttribute("src")).toBe("/movie-en.mp4"));
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(120);
  expect(resolve.mock.calls[0][3]).toBe("pt");expect(resolve.mock.calls[1][3]).toBe("en");
 });
 it("disables a version which the origin does not offer",async()=>{
  const options=[{id:"pt" as const,label:"Português (Dublado)",available:true,version:"dublado" as const,audio_language:"pt"},{id:"en" as const,label:"English (Legendado)",available:false,version:"legendado" as const,audio_language:"en"}];
  render(<IPTVPlayer contentTitle="Filme" source="movie" getStreamUrl={async()=>"/movie.mp4"} audioOptions={options}/>);
  await waitFor(()=>expect(screen.queryByText("Preparando o filme")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button",{name:"Faixa de áudio"}));
  expect(screen.getByRole("button",{name:/English.*Indisponível/})).toBeDisabled();
 });
});

describe("episode playback lifecycle",()=>{
 it("restores seconds, checkpoints pause and close, and advances only once on ended",async()=>{
  const progress=vi.fn(),ended=vi.fn();
  const {container,unmount}=render(<IPTVPlayer contentTitle="Série" source="series" season={2} episode={3} initialTime={321} initialLanguage="en" getStreamUrl={async()=>"/episode.mp4"} onProgress={progress} onEnded={ended}/>);
  await waitFor(()=>expect(container.querySelector("video")?.getAttribute("src")).toBe("/episode.mp4"));
  const video=container.querySelector("video")!;Object.defineProperty(video,"duration",{value:1200,configurable:true});fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(321);video.currentTime=350;fireEvent.pause(video);
  expect(progress).toHaveBeenLastCalledWith({currentTime:350,duration:1200,language:"en",completed:false});
  fireEvent.ended(video);fireEvent.ended(video);expect(ended).toHaveBeenCalledTimes(1);
  unmount();expect(progress.mock.calls.at(-1)?.[0].completed).toBe(true);
 });
 it("does not overwrite saved progress while a source has no loaded metadata",async()=>{
  const progress=vi.fn();const {unmount}=render(<IPTVPlayer contentTitle="Série" source="series" initialTime={100} getStreamUrl={async()=>"/episode.mp4"} onProgress={progress}/>);
  await waitFor(()=>expect(document.querySelector("video")).not.toBeNull());unmount();expect(progress).not.toHaveBeenCalled();
 });
});

describe("startup and end detection",()=>{
 it("shows only a delayed spinner while waiting, without loading cards or progress text",async()=>{
  const {unmount}=render(<IPTVPlayer contentTitle="Série" source="series" getStreamUrl={()=>new Promise(()=>{})}/>);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(await screen.findByRole("status",{name:"Carregando vídeo"})).toBeInTheDocument();
  expect(screen.queryByText(/Carregando filme|Preparando o filme|Reconectando ao sinal|Aguardando dados/)).not.toBeInTheDocument();
  unmount();
 });
 it("advances once at the final frame even if ended arrives late",async()=>{
  const ended=vi.fn();const {container}=render(<IPTVPlayer contentTitle="Série" source="series" getStreamUrl={async()=>"/episode.mp4"} onEnded={ended}/>);
  await waitFor(()=>expect(container.querySelector("video")?.getAttribute("src")).toBe("/episode.mp4"));
  const video=container.querySelector("video")!;Object.defineProperty(video,"duration",{value:100,configurable:true});Object.defineProperty(video,"paused",{value:false,configurable:true});
  fireEvent.loadedMetadata(video);video.currentTime=99.95;fireEvent.timeUpdate(video);fireEvent.ended(video);
  expect(ended).toHaveBeenCalledTimes(1);
 });
 it("keeps the next-episode action hidden until the final thirty seconds",async()=>{
  const {container}=render(<IPTVPlayer contentTitle="Série" source="series" getStreamUrl={async()=>"/episode.mp4"} nextEpisode={{season:1,episode:2,name:"Seguinte"}} onSelectEpisode={()=>{}}/>);
  await waitFor(()=>expect(container.querySelector("video")?.getAttribute("src")).toBe("/episode.mp4"));
  const video=container.querySelector("video")!;Object.defineProperty(video,"duration",{value:100,configurable:true});fireEvent.loadedMetadata(video);
  expect(screen.queryByRole("button",{name:"Próximo episódio T1 Ep.2"})).not.toBeInTheDocument();
  video.currentTime=75;fireEvent.timeUpdate(video);expect(screen.getByRole("button",{name:"Próximo episódio T1 Ep.2"})).toBeInTheDocument();
  video.currentTime=10;fireEvent.timeUpdate(video);expect(screen.queryByRole("button",{name:"Próximo episódio T1 Ep.2"})).not.toBeInTheDocument();
 });
});
it('keeps the current movie running while another language resolves and resumes at commit time',async()=>{
 let ready!:(url:string)=>void;const alternate=new Promise<string>(resolve=>{ready=resolve;});
 const resolver=vi.fn(async()=>'/current.mp4');const prepare=vi.fn(()=>alternate);
 const {container}=render(<IPTVPlayer contentTitle="Filme" source="movie" getStreamUrl={resolver} onPrepareLanguage={prepare}/>);
 await waitFor(()=>expect(container.querySelector('video')?.getAttribute('src')).toBe('/current.mp4'));
 const video=container.querySelector('video')!;Object.defineProperty(video,'duration',{value:7200,configurable:true});fireEvent.loadedMetadata(video);video.currentTime=120;fireEvent.timeUpdate(video);
 const pause=vi.mocked(HTMLMediaElement.prototype.pause);pause.mockClear();
 fireEvent.click(screen.getByRole('button',{name:'Faixa de áudio'}));fireEvent.click(screen.getByRole('button',{name:'English (Legendado)'}));
 expect(video.getAttribute('src')).toBe('/current.mp4');expect(pause).not.toHaveBeenCalled();
 video.currentTime=135;fireEvent.timeUpdate(video);ready('/alternate.mp4');
 await waitFor(()=>expect(video.getAttribute('src')).toBe('/alternate.mp4'));fireEvent.loadedMetadata(video);expect(video.currentTime).toBe(135);expect(resolver).toHaveBeenCalledTimes(1);
});
it('does not stop the current movie if alternative language preparation fails',async()=>{
 const {container}=render(<IPTVPlayer contentTitle="Filme" source="movie" getStreamUrl={async()=>'/current.mp4'} onPrepareLanguage={async()=>{throw Error('Origem indisponível');}}/>);
 await waitFor(()=>expect(container.querySelector('video')?.getAttribute('src')).toBe('/current.mp4'));
 const pause=vi.mocked(HTMLMediaElement.prototype.pause);pause.mockClear();
 fireEvent.click(screen.getByRole('button',{name:'Faixa de áudio'}));fireEvent.click(screen.getByRole('button',{name:'English (Legendado)'}));
 expect(await screen.findByText('Origem indisponível')).toBeInTheDocument();expect(container.querySelector('video')?.getAttribute('src')).toBe('/current.mp4');expect(pause).not.toHaveBeenCalled();
});
