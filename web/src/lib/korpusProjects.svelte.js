// Gespeicherte Korpus-Projekte (localStorage), reaktiv. Schlüssel & Format
// identisch zur Legacy-App (Maße in mm gespeichert, einheitenunabhängig).
const KEY = 'betterkerf_korpus';

function load() {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

let list = $state(load());

export const korpusProjects = { get list() { return list; } };

function persist(arr) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); list = arr; return true; }
  catch { return false; }
}

export function findKorpusProject(name) { return list.find(p => p.name === name); }

export function saveKorpusProject(proj, overwrite = false) {
  const arr = [...list];
  const idx = arr.findIndex(p => p.name === proj.name);
  if (idx >= 0 && !overwrite) return 'exists';
  if (idx >= 0) arr[idx] = proj; else arr.unshift(proj);
  return persist(arr);
}

export function deleteKorpusProject(name) { return persist(list.filter(p => p.name !== name)); }
