// Gespeicherte Schubladen-Projekte (localStorage), reaktiv. Schlüssel & Format
// identisch zur Legacy-App (Maße in mm gespeichert, einheitenunabhängig).
const KEY = 'betterkerf_drawer';

function load() {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

let list = $state(load());

export const drawerProjects = { get list() { return list; } };

function persist(arr) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); list = arr; return true; }
  catch { return false; }
}

export function findDrawerProject(name) { return list.find(p => p.name === name); }

export function saveDrawerProject(proj, overwrite = false) {
  const arr = [...list];
  const idx = arr.findIndex(p => p.name === proj.name);
  if (idx >= 0 && !overwrite) return 'exists';
  if (idx >= 0) arr[idx] = proj; else arr.unshift(proj);
  return persist(arr) ? 'saved' : 'error';
}

export function deleteDrawerProject(name) { return persist(list.filter(p => p.name !== name)); }
