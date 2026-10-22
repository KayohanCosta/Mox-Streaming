import { Check, Plus } from 'lucide-react';
import { type MediaItem, getTitle } from '@/lib/tmdb';
import { toggleSavedTitle, useSavedTitles } from '@/hooks/useSavedTitles';
export default function SaveTitleButton({item,type,compact=false}:{item:MediaItem;type:'movie'|'tv';compact?:boolean}){
 const saved=useSavedTitles().some(x=>x.id===item.id&&x.type===type);
 return <button type="button" className={`${compact?'card-save':'detail-save'} ${saved?'is-saved':''}`} aria-pressed={saved} aria-label={`${saved?'Remover':'Salvar'} ${getTitle(item)} ${saved?'da':'na'} minha lista`} title={saved?'Remover da minha lista':'Salvar na minha lista'} onClick={()=>toggleSavedTitle(item,type)}>{saved?<Check size={compact?15:18}/>:<Plus size={compact?15:18}/>} {!compact&&<span>{saved?'Na minha lista':'Minha lista'}</span>}</button>;
}
