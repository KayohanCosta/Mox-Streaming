import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import SourceCatalogPage from './SourceCatalogPage';
afterEach(cleanup);
it('keeps the incomplete raw source catalog out of the product and uses the established movies page',()=>{
 render(<MemoryRouter initialEntries={['/catalog']}><Routes><Route path="/catalog" element={<SourceCatalogPage/>}/><Route path="/category/movies" element={<h1>Filmes MOX</h1>}/></Routes></MemoryRouter>);
 expect(screen.getByText('Filmes MOX')).toBeInTheDocument();expect(document.querySelector('img[src*="redecanais"]')).toBeNull();
});
