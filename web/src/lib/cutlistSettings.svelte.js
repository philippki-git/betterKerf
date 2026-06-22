// ── Zuschnittoptimierer-Einstellungen (global, persistent) ──────────────
// Werden im Einstellungsmenü angezeigt und bleiben über Sitzungen erhalten.
// Projekte können diese Werte beim Laden überschreiben.

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

let kerf       = $state(load('betterkerf_kerf',        3));
let mode       = $state(load('betterkerf_cutmode',     'guillotine'));
let allowRotate = $state(load('betterkerf_allowrotate', true));
let optmode    = $state(load('betterkerf_optmode',     'waste'));

export const cutlistSettings = {
  get kerf()        { return kerf; },
  set kerf(v)       { kerf = v;        save('betterkerf_kerf',        v); },
  get mode()        { return mode; },
  set mode(v)       { mode = v;        save('betterkerf_cutmode',     v); },
  get allowRotate() { return allowRotate; },
  set allowRotate(v){ allowRotate = v; save('betterkerf_allowrotate', v); },
  get optmode()     { return optmode; },
  set optmode(v)    { optmode = v;     save('betterkerf_optmode',     v); },
};
