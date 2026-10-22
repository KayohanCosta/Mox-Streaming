import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,expect,it,vi } from 'vitest';
import CategoryPage from './CategoryPage';
import { fetchCategory } from '@/lib/tmdb';
vi.mock('@/components/Navbar',()=>({default:()=>null}));
vi.mock('@/lib/tmdb',async original=>({...await original<typeof import('@/lib/tmdb')>(),fetchCategory:vi.fn(async()=>({results:[],total_pages:75}))}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('allows navigation beyond page twenty and resets pagination when filtering by year',async()=>{
 render(<MemoryRouter initialEntries={['/category/movies']}><Routes><Route path="/category/:category" element={<CategoryPage/>}/></Routes></MemoryRouter>);
 await screen.findByText('Página 1 de 75');
 for(let page=2;page<=21;page++){await waitFor(()=>expect(screen.getByRole('button',{name:'Próxima página'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Próxima página'}));await screen.findByText(`Página ${page} de 75`);}
 await waitFor(()=>expect(fetchCategory).toHaveBeenLastCalledWith(expect.any(String),21));
 fireEvent.change(screen.getByLabelText('Ano de lançamento'),{target:{value:'2025'}});
 await waitFor(()=>expect(fetchCategory).toHaveBeenLastCalledWith(expect.stringContaining('primary_release_year=2025'),1));expect(screen.getByText('Página 1 de 75')).toBeInTheDocument();
});
