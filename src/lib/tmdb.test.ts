import {afterEach,expect,it,vi} from 'vitest';
import {fetchDetails} from './tmdb';
afterEach(()=>vi.unstubAllGlobals());
it('reuses metadata across repeated navigation and coalesces simultaneous requests',async()=>{const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:881001})});vi.stubGlobal('fetch',fetcher);const [a,b]=await Promise.all([fetchDetails(881001,'movie'),fetchDetails(881001,'movie')]);expect(a.id).toBe(881001);expect(b.id).toBe(881001);await fetchDetails(881001,'movie');expect(fetcher).toHaveBeenCalledTimes(1);});
it('does not cache a failed metadata lookup',async()=>{const fetcher=vi.fn().mockResolvedValueOnce({ok:false,status:503}).mockResolvedValueOnce({ok:true,json:async()=>({id:881002})});vi.stubGlobal('fetch',fetcher);await expect(fetchDetails(881002,'movie')).rejects.toThrow('503');expect((await fetchDetails(881002,'movie')).id).toBe(881002);expect(fetcher).toHaveBeenCalledTimes(2);});
