import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import DeviceNavigation from './DeviceNavigation';
afterEach(()=>{vi.restoreAllMocks();delete document.documentElement.dataset.input;});
it('moves focus with remote arrows and leaves search editing intact',()=>{
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 render(<MemoryRouter><DeviceNavigation/><a href="/">Início</a><button>Filmes</button><input aria-label="Busca"/></MemoryRouter>);
 const home=screen.getByRole('link');const films=screen.getByRole('button');const search=screen.getByRole('textbox');
 [home,films,search].forEach((el,i)=>{vi.spyOn(el,'getBoundingClientRect').mockReturnValue({x:i*150,y:10,width:100,height:44,left:i*150,top:10,right:i*150+100,bottom:54,toJSON:()=>({})});el.scrollIntoView=vi.fn();});
 home.focus();fireEvent.keyDown(home,{key:'ArrowRight'});expect(films).toHaveFocus();
 fireEvent.keyDown(films,{key:'ArrowLeft'});expect(home).toHaveFocus();
 search.focus();fireEvent.keyDown(search,{key:'ArrowLeft'});expect(search).toHaveFocus();
});
it('remote back closes the active episode dialog',()=>{
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{});const close=vi.fn();
 render(<MemoryRouter><DeviceNavigation/><section role="dialog" aria-modal="true"><button aria-label="Fechar episódios" onClick={close}>Fechar</button></section></MemoryRouter>);
 fireEvent.keyDown(document.body,{key:'BrowserBack'});expect(close).toHaveBeenCalledOnce();
});
