// Reaktive Brücke: Cutlist schreibt, Kostenkalkulator liest.
let result = $state(null);

export const cutlistResult = {
  get current() { return result; },
  set(r) { result = r; }
};
