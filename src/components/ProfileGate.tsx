import { type ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { activeProfileId, getProfiles, lastProfileId, PROFILE_COLORS, PROFILE_EVENT, removeProfile, selectProfile, updateProfiles, type Profile } from '@/lib/profiles';

export function ProfileAvatar({ profile, small = false }: { profile: Profile; small?: boolean }) {
  return <span className={`profile-avatar${small ? ' profile-avatar-small' : ''}`} style={{ '--profile-color': PROFILE_COLORS[profile.color] } as React.CSSProperties} aria-hidden="true"><span className="profile-avatar-shape"/><span className="profile-initial">{Array.from(profile.name.trim())[0]?.toLocaleUpperCase('pt-BR')}</span></span>;
}
export default function ProfileGate({ children }: { children: ReactNode }) {
  const location = useLocation(); const navigate = useNavigate();
  const [profiles, setProfiles] = useState(getProfiles);
  const [active, setActive] = useState(activeProfileId);
  const [managing, setManaging] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const refresh = () => { setProfiles(getProfiles()); setActive(activeProfileId()); };
    window.addEventListener(PROFILE_EVENT, refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(PROFILE_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const choosing = !active || location.pathname === '/profiles';
  useEffect(() => { if (choosing) document.title = 'Quem está assistindo? | MOX'; }, [choosing]);
  if (!choosing) return <div key={active}>{children}</div>;
  const choose = (profile: Profile) => {
    if (managing) { setEditing({ ...profile }); setDeleting(false); return; }
    try { selectProfile(profile.id); if (location.pathname === '/profiles') navigate('/', { replace: true }); }
    catch { toast.error('Permita o armazenamento do navegador para selecionar um perfil.'); }
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault(); if (!editing) return;
    try {
      const exists = profiles.some(p => p.id === editing.id);
      updateProfiles(exists ? profiles.map(p => p.id === editing.id ? editing : p) : [...profiles, editing]);
      setEditing(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o perfil.'); }
  };
  return <main className="profile-screen">
    <header className="profile-header"><span className="brand-wordmark">mox<span>•</span></span>{active && <button className="profile-back" onClick={() => navigate('/')}><ChevronLeft size={18}/>Voltar ao início</button>}</header>
    <section className="profile-stage" aria-labelledby="profiles-title">
      {editing ? <form className="profile-editor" onSubmit={save}>
        <p className="profile-eyebrow">SEU ESPAÇO NA MOX</p><h1 id="profiles-title">{profiles.some(p => p.id === editing.id) ? 'Editar perfil' : 'Um novo olhar.'}</h1>
        <ProfileAvatar profile={editing}/>
        <label htmlFor="profile-name">Nome do perfil</label><input id="profile-name" autoFocus autoComplete="off" maxLength={24} required value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Como podemos te chamar?"/>
        <fieldset className="profile-colors"><legend>Escolha sua cor</legend>{PROFILE_COLORS.map((color, i) => <button type="button" key={color} aria-label={['Roxo', 'Azul', 'Coral', 'Verde', 'Dourado'][i]} aria-pressed={editing.color === i} style={{ background: color }} onClick={() => setEditing({ ...editing, color: i })}>{editing.color === i && <Check size={18}/>}</button>)}</fieldset>
        <div className="profile-editor-actions"><button type="button" className="profile-secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="profile-primary" type="submit" disabled={!editing.name.trim()}>Salvar perfil</button></div>
        {profiles.length > 1 && profiles.some(p => p.id === editing.id) && (deleting ? <div className="profile-delete-confirm"><p>Excluir este perfil e seu histórico neste navegador?</p><button type="button" className="profile-danger" onClick={() => { try { removeProfile(editing.id); setEditing(null); } catch { toast.error('Não foi possível excluir o perfil.'); } }}>Sim, excluir perfil</button><button type="button" className="profile-secondary" onClick={() => setDeleting(false)}>Manter perfil</button></div> : <button type="button" className="profile-delete" onClick={() => setDeleting(true)}><Trash2 size={15}/>Excluir perfil</button>)}
      </form> : <>
        <p className="profile-eyebrow">CADA PERFIL, UM UNIVERSO.</p><h1 id="profiles-title">{managing ? 'Do seu jeito.' : 'Quem está assistindo?'}</h1><p className="profile-subtitle">{managing ? 'Um nome, uma cor e histórias para chamar de suas.' : 'Escolha seu perfil. Sua próxima história está aqui.'}</p>
        <div className="profile-options">{profiles.map(profile => <button key={profile.id} className="profile-option" onClick={() => choose(profile)} aria-label={`${managing ? 'Editar' : 'Assistir como'} ${profile.name}`}>
          <span className="profile-avatar-wrap"><ProfileAvatar profile={profile}/>{managing && <span className="profile-pencil"><Pencil size={20}/></span>}</span><span className="profile-name">{profile.name}</span>{!managing && lastProfileId() === profile.id && <span className="profile-last">Último acesso</span>}
        </button>)}{profiles.length < 5 && <button className="profile-option profile-add" onClick={() => { setEditing({ id: crypto.randomUUID(), name: '', color: profiles.length % PROFILE_COLORS.length }); setDeleting(false); }}><span className="profile-avatar profile-avatar-add"><Plus size={38} strokeWidth={1.3}/></span><span className="profile-name">Adicionar perfil</span></button>}</div>
        <button className={`profile-manage ${managing ? 'profile-primary' : 'profile-secondary'}`} onClick={() => setManaging(!managing)}>{managing ? <><Check size={17}/>Concluir</> : <><Pencil size={16}/>Gerenciar perfis</>}</button>
        <p className="profile-device-note">Perfis, sua lista e histórico salvos neste navegador.</p>
      </>}
    </section><footer className="profile-footer"><span>MOX</span><span>Histórias para todos os seus momentos.</span></footer>
  </main>;
}
