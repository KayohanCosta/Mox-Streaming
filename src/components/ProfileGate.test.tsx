import {afterEach,beforeEach,expect,it} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import ProfileGate from './ProfileGate';
import {activeProfileId,getProfiles} from '@/lib/profiles';
function mount(){return render(<MemoryRouter><ProfileGate><h1>Catálogo MOX</h1></ProfileGate></MemoryRouter>);}
beforeEach(()=>{localStorage.clear();sessionStorage.clear();});afterEach(cleanup);
it('requires a profile selection before mounting the catalog',()=>{
 mount();expect(screen.queryByText('Catálogo MOX')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Assistir como Você'}));expect(screen.getByText('Catálogo MOX')).toBeInTheDocument();expect(activeProfileId()).toBe('default');
});
it('creates a named profile and selects it after saving',()=>{
 mount();fireEvent.click(screen.getByRole('button',{name:'Adicionar perfil'}));fireEvent.change(screen.getByLabelText('Nome do perfil'),{target:{value:'Costa'}});fireEvent.click(screen.getByRole('button',{name:'Azul'}));fireEvent.click(screen.getByRole('button',{name:'Salvar perfil'}));expect(getProfiles()).toHaveLength(2);fireEvent.click(screen.getByRole('button',{name:'Assistir como Costa'}));expect(screen.getByText('Catálogo MOX')).toBeInTheDocument();expect(activeProfileId()).toBe(getProfiles()[1].id);
});
