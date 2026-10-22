import {beforeEach, describe, expect, it} from 'vitest';
import {activeProfileId, getProfiles, profileStorageKey, removeProfile, selectProfile, updateProfiles} from './profiles';
import {getWatchProgress, saveWatchProgress} from '@/hooks/useWatchProgress';

beforeEach(()=>{localStorage.clear();sessionStorage.clear();});
describe('viewer profiles',()=>{
 it('keeps the existing viewer history on the default profile and isolates new viewers',()=>{
  saveWatchProgress({id:41,type:'movie',title:'Um filme',poster_path:null,progress:10,currentTime:60,duration:600});
  selectProfile('default');expect(getWatchProgress(41,'movie')?.currentTime).toBe(60);
  updateProfiles([...getProfiles(),{id:'second',name:'Costa',color:1}]);selectProfile('second');
  expect(getWatchProgress(41,'movie')).toBeUndefined();
  saveWatchProgress({id:41,type:'movie',title:'Um filme',poster_path:null,progress:30,currentTime:180,duration:600});
  expect(getWatchProgress(41,'movie')?.currentTime).toBe(180);
  selectProfile('default');expect(getWatchProgress(41,'movie')?.currentTime).toBe(60);
 });
 it('deletes only the selected profile data and refuses deleting the last profile',()=>{
  updateProfiles([...getProfiles(),{id:'second',name:'Costa',color:1}]);selectProfile('second');
  const key=profileStorageKey('mox.saved.v1');localStorage.setItem(key,'[1]');
  removeProfile('second');expect(localStorage.getItem(key)).toBeNull();expect(activeProfileId()).toBeNull();
  expect(getProfiles()).toHaveLength(1);expect(()=>removeProfile('default')).toThrow();
 });
 it('limits profiles to five and rejects selecting an unknown profile',()=>{
  expect(()=>updateProfiles(Array.from({length:6},(_,i)=>({id:String(i),name:'Pessoa',color:0})))).toThrow();
  expect(()=>selectProfile('missing')).toThrow();
 });
});
