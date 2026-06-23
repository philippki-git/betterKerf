let _stock = $state.raw([]);
let _parts = $state.raw([]);
let _nextSId = $state(1);
let _nextPId = $state(1);
let _grainEnabled = $state(false);
let _lastResult = $state(null);
let _hasResult = $state(false);

export const cutlistInput = {
  get stockData()    { return _stock; },
  set stockData(v)   { _stock = v; },
  get partsData()    { return _parts; },
  set partsData(v)   { _parts = v; },
  get nextSId()      { return _nextSId; },
  set nextSId(v)     { _nextSId = v; },
  get nextPId()      { return _nextPId; },
  set nextPId(v)     { _nextPId = v; },
  get grainEnabled() { return _grainEnabled; },
  set grainEnabled(v){ _grainEnabled = v; },
  get lastResult()   { return _lastResult; },
  set lastResult(v)  { _lastResult = v; },
  get hasResult()    { return _hasResult; },
  set hasResult(v)   { _hasResult = v; },
};

export const EXAMPLE_STOCK = [
  { id: 1, name: 'Brett A', l: 2000, w: 620, qty: 3 }
];
export const EXAMPLE_PARTS = [
  { id: 1, name: 'Seite',         l: 900, w: 600, qty: 2, grain: false },
  { id: 2, name: 'Boden / Deckel',l: 564, w: 600, qty: 2, grain: false },
  { id: 3, name: 'Rückwand',      l: 876, w: 576, qty: 1, grain: false },
];
