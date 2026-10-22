import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {toggleSavedTitle,useSavedTitles} from './useSavedTitles';
const item={id:41,title:'Uma história',poster_path:null,backdrop_path:null,overview:'',popularity:0,vote_average:8,release_date:'2026-01-01'};
function Library(){const saved=useSavedTitles();return <><output aria-label="Salvos">{saved.map(x=>x.type).join(',')||'vazia'}</output><button onClick={()=>toggleSavedTitle(item,'movie')}>Filme</button><button onClick={()=>toggleSavedTitle(item,'tv')}>Série</button></>}
beforeEach(()=>{localStorage.clear();});afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('persists saved titles, separates movie and TV IDs, and removes only the selected title',async()=>{
 const view=render(<Library/>);await waitFor(()=>expect(screen.getByLabelText('Salvos')).toHaveTextContent('vazia'));
 fireEvent.click(screen.getByText('Filme'));fireEvent.click(screen.getByText('Série'));expect(screen.getByLabelText('Salvos')).toHaveTextContent('tv,movie');expect(JSON.parse(localStorage.getItem('mox.saved.v1')!)).toHaveLength(2);
 view.unmount();render(<Library/>);expect(screen.getByLabelText('Salvos')).toHaveTextContent('tv,movie');fireEvent.click(screen.getByText('Filme'));expect(screen.getByLabelText('Salvos')).toHaveTextContent('tv');
});
it('refreshes changes from another tab and does not fake a save on storage failure',async()=>{
 render(<Library/>);await waitFor(()=>expect(screen.getByLabelText('Salvos')).toHaveTextContent('vazia'));
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});fireEvent.click(screen.getByText('Filme'));expect(screen.getByLabelText('Salvos')).toHaveTextContent('vazia');vi.restoreAllMocks();
 localStorage.setItem('mox.saved.v1',JSON.stringify([{...item,type:'movie',year:'2026',savedAt:1}]));act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'mox.saved.v1'})));expect(screen.getByLabelText('Salvos')).toHaveTextContent('movie');
});
