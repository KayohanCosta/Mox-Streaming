import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TrailerDialog from './TrailerDialog';
afterEach(cleanup);
it('loads the embedded trailer only after play and supports closing by Escape',()=>{
 const close=vi.fn();const {container}=render(<TrailerDialog title="Uma história" videoKey="abc123" onClose={close}/>);
 expect(screen.getByRole('dialog',{name:'Uma história'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Fechar trailer'})).toHaveFocus();expect(container.querySelector('iframe')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Reproduzir trailer'}));expect(screen.getByTitle('Trailer de Uma história')).toHaveAttribute('src','https://www.youtube.com/embed/abc123?autoplay=1&rel=0');
 fireEvent.keyDown(document,{key:'Escape'});expect(close).toHaveBeenCalledOnce();
});
