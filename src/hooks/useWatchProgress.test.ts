import {beforeEach,describe,expect,it} from "vitest";
import {getWatchProgress,getWatchProgressList,saveWatchProgress,removeWatchProgress} from "./useWatchProgress";
const base={id:84958,type:"tv" as const,title:"Loki",poster_path:null};
beforeEach(()=>localStorage.clear());
describe("watch progress",()=>{
 it("persists seconds, season, episode and language independently for each episode",()=>{
  saveWatchProgress({...base,season:1,episode:1,currentTime:123,duration:1200,language:"en",progress:0});
  saveWatchProgress({...base,season:1,episode:2,currentTime:22,duration:1300,language:"pt",progress:0});
  expect(getWatchProgress(84958,"tv")?.episode).toBe(2);
  expect(getWatchProgress(84958,"tv",1,1)).toMatchObject({currentTime:123,duration:1200,language:"en",progress:10.25});
  expect(getWatchProgress(84958,"tv",1,2)?.currentTime).toBe(22);
 });
 it("keeps completion and clears both resume and episode history on reset",()=>{
  saveWatchProgress({...base,season:1,episode:1,currentTime:1200,duration:1200,completed:true,progress:0});
  expect(getWatchProgress(84958,"tv",1,1)?.progress).toBe(100);
  removeWatchProgress(84958,"tv");expect(getWatchProgressList()).toEqual([]);expect(getWatchProgress(84958,"tv",1,1)).toBeUndefined();
 });
 it("ignores malformed old storage rather than breaking the page",()=>{
  localStorage.setItem("watch_progress",JSON.stringify({invalid:true}));
  expect(getWatchProgressList()).toEqual([]);
 });
});
