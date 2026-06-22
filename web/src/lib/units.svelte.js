// ── Einheiten (global) ──────────────────────────────────────────────────
// Intern wird IMMER in mm gerechnet. Nur Ein-/Ausgabe wird konvertiert.
// In Svelte 5 ist `current` ein $state — jede Template-Stelle, die dispVal()
// & Co. nutzt, aktualisiert sich automatisch beim Einheitenwechsel.

export const UNITS = {
  mm: { f: 1, dec: 0, label: 'mm' },
  cm: { f: 10, dec: 1, label: 'cm' },
  m:  { f: 1000, dec: 3, label: 'm' }
};

function load() {
  try { return localStorage.getItem('betterkerf_unit') || 'cm'; }
  catch { return 'cm'; }
}

let current = $state(load());

export const units = {
  get current() { return current; },
  set current(u) {
    if (!UNITS[u] || u === current) return;
    current = u;
    try { localStorage.setItem('betterkerf_unit', u); } catch {}
  }
};

export function unitLabel() { return UNITS[current].label; }

// mm -> Anzeigewert (Zahl in aktueller Einheit)
export function dispNum(mm) { return mm / UNITS[current].f; }

// mm -> formatierter String (ohne Einheit-Suffix), mit deutscher Komma-Notation
export function dispVal(mm) {
  const v = mm / UNITS[current].f;
  const dec = UNITS[current].dec;
  let s = v.toFixed(dec);
  if (dec > 0) s = s.replace(/\.?0+$/, ''); // trailing zeros weg
  return s.replace('.', ',');
}

// mm -> formatierter String inkl. Einheit
export function dispUnit(mm) { return dispVal(mm) + ' ' + unitLabel(); }

// Anzeigewert (aktuelle Einheit, akzeptiert Komma) -> mm
export function toMM(val) {
  return (parseFloat(String(val).replace(',', '.')) || 0) * UNITS[current].f;
}

// Eingabefeld-Wert: mm als Zahl in aktueller Einheit, schön gerundet
export function inputVal(mm) {
  const v = mm / UNITS[current].f;
  const dec = UNITS[current].dec;
  return parseFloat(v.toFixed(dec + 2)); // etwas Reserve gegen Rundungsdrift
}
