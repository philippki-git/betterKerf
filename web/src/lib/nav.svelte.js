// Modul-übergreifende Navigationsanforderung. Module können ein anderes Modul
// anfordern; App.svelte reagiert darauf und öffnet es.
let target = $state(null);

export const nav = {
  get target() { return target; },
  request(id) { target = id; },
  clear() { target = null; }
};
