import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import SearchPage from './SearchPage';
import {searchMulti,type MediaItem} from '@/lib/tmdb';
vi.mock('@/components/Navbar',()=>({default:()=>null}));vi.mock('@/components/SiteFooter',()=>({default:()=>null}));vi.mock('@/components/MediaCard',()=>({default:({item}:{item:MediaItem})=><h2>{item.title}</h2>}));vi.mock('@/lib/tmdb',()=>({searchMulti:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('ignores an old response when a new query is submitted',async()=>{
 let old!:(data:{results:MediaItem[];total_pages:number})=>void;
 vi.mocked(searchMulti).mockImplementationOnce(()=>new Promise(resolve=>{old=resolve;})).mockResolvedValueOnce({results:[{id:2,title:'Dark',media_type:'tv',poster_path:'/x',backdrop_path:null,overview:'',vote_average:8,popularity:1}],total_pages:1});
 render(<MemoryRouter initialEntries={['/search?q=loki']}><SearchPage/></MemoryRouter>);fireEvent.change(screen.getByLabelText('Pesquisar no catálogo'),{target:{value:'dark'}});fireEvent.click(screen.getByRole('button',{name:'Pesquisar'}));expect(await screen.findByRole('heading',{name:'Dark'})).toBeInTheDocument();
 await act(async()=>{old({results:[{id:1,title:'Loki',media_type:'tv',poster_path:'/y',backdrop_path:null,overview:'',vote_average:8,popularity:1}],total_pages:1});});expect(screen.queryByRole('heading',{name:'Loki'})).not.toBeInTheDocument();
});
it('shows a recoverable error instead of claiming there are no matches',async()=>{
 vi.mocked(searchMulti).mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({results:[],total_pages:1});render(<MemoryRouter initialEntries={['/search?q=filme']}><SearchPage/></MemoryRouter>);expect(await screen.findByRole('alert')).toHaveTextContent('Não conseguimos buscar');expect(screen.queryByText('Essa busca ainda não encontrou sua história.')).not.toBeInTheDocument();fireEvent.click(screen.getByText('Tentar novamente'));await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});
