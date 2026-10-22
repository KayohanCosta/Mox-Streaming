export type Profile = { id: string; name: string; color: number };
export const PROFILE_COLORS = ['#9d55f5', '#3983e8', '#e66b63', '#28a993', '#d59b39'];
export const PROFILE_EVENT = 'mox-profile-changed';
const KEY = 'mox.profiles.v1';
const ACTIVE = 'mox.active-profile.v1';
const LAST = 'mox.last-profile.v1';
const DEFAULT: Profile = { id: 'default', name: 'Você', color: 0 };
export function getProfiles(): Profile[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(list)) {
      const valid = list.filter((p): p is Profile => !!p && typeof p.id === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(p.id) && typeof p.name === 'string' && !!p.name.trim() && p.name.length <= 24 && Number.isInteger(p.color) && p.color >= 0 && p.color < PROFILE_COLORS.length);
      if (valid.length) return valid.slice(0, 5);
    }
  } catch { /* Use the existing viewer's profile if local storage is unavailable. */ }
  return [DEFAULT];
}
export function activeProfileId() {
  try { const id = sessionStorage.getItem(ACTIVE); return getProfiles().some(p => p.id === id) ? id : null; }
  catch { return null; }
}
export function lastProfileId() { try { return localStorage.getItem(LAST); } catch { return null; } }
export function profileStorageKey(base: string) {
  const id = activeProfileId();
  return !id || id === 'default' ? base : `${base}:profile:${id}`;
}
export function selectProfile(id: string) {
  if (!getProfiles().some(p => p.id === id)) throw Error('Perfil não encontrado.');
  sessionStorage.setItem(ACTIVE, id);
  try { localStorage.setItem(LAST, id); } catch { /* Selection remains in this tab. */ }
  window.dispatchEvent(new Event(PROFILE_EVENT));
}
export function updateProfiles(profiles: Profile[]) {
  if (!profiles.length || profiles.length > 5) throw Error('Você pode ter de 1 a 5 perfis.');
  if (profiles.some(p => !p.name.trim() || p.name.trim().length > 24)) throw Error('Use um nome de até 24 caracteres.');
  localStorage.setItem(KEY, JSON.stringify(profiles.map(p => ({ ...p, name: p.name.trim() }))));
  window.dispatchEvent(new Event(PROFILE_EVENT));
}
export function removeProfile(id: string) {
  const profiles = getProfiles();
  if (profiles.length === 1) throw Error('Mantenha pelo menos um perfil.');
  updateProfiles(profiles.filter(p => p.id !== id));
  const bases = ['watch_progress', 'watch_episode_progress', 'mox.saved.v1'];
  for (const base of bases) localStorage.removeItem(id === 'default' ? base : `${base}:profile:${id}`);
  if (sessionStorage.getItem(ACTIVE) === id) sessionStorage.removeItem(ACTIVE);
  window.dispatchEvent(new Event(PROFILE_EVENT));
}
