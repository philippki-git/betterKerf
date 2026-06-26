let _hasResult = $state(false);
let _result = $state(null);
let _tab = $state('input');

export const holesState = {
  get hasResult() { return _hasResult; },
  set hasResult(v) { _hasResult = v; },
  get result()    { return _result; },
  set result(v)   { _result = v; },
  get tab()       { return _tab; },
  set tab(v)      { _tab = v; },
};
