import { inputVal } from './units.svelte.js';

let _kpH = $state(inputVal(900));
let _kpB = $state(inputVal(600));
let _kpT = $state(inputVal(600));
let _kpS = $state(inputVal(18));
let _kpSr = $state(inputVal(5));
let _shelves = $state(0);
let _dividers = $state(0);
let _kpConstr = $state('sides');
let _kpBack = $state('inset');
let _kpShelfCustom = $state(false);
let _kpShelfStates = $state([]);
let _kpDivCustom = $state(false);
let _kpDivStates = $state([]);

export const korpusInput = {
  get kpH()            { return _kpH; },            set kpH(v)            { _kpH = v; },
  get kpB()            { return _kpB; },            set kpB(v)            { _kpB = v; },
  get kpT()            { return _kpT; },            set kpT(v)            { _kpT = v; },
  get kpS()            { return _kpS; },            set kpS(v)            { _kpS = v; },
  get kpSr()           { return _kpSr; },           set kpSr(v)           { _kpSr = v; },
  get shelves()        { return _shelves; },         set shelves(v)        { _shelves = v; },
  get dividers()       { return _dividers; },        set dividers(v)       { _dividers = v; },
  get kpConstr()       { return _kpConstr; },        set kpConstr(v)       { _kpConstr = v; },
  get kpBack()         { return _kpBack; },          set kpBack(v)         { _kpBack = v; },
  get kpShelfCustom()  { return _kpShelfCustom; },   set kpShelfCustom(v)  { _kpShelfCustom = v; },
  get kpShelfStates()  { return _kpShelfStates; },   set kpShelfStates(v)  { _kpShelfStates = v; },
  get kpDivCustom()    { return _kpDivCustom; },     set kpDivCustom(v)    { _kpDivCustom = v; },
  get kpDivStates()    { return _kpDivStates; },     set kpDivStates(v)    { _kpDivStates = v; },

  reset() {
    _kpH = inputVal(900); _kpB = inputVal(600); _kpT = inputVal(600);
    _kpS = inputVal(18);  _kpSr = inputVal(5);
    _shelves = 0; _dividers = 0;
    _kpConstr = 'sides'; _kpBack = 'inset';
    _kpShelfCustom = false; _kpShelfStates = [];
    _kpDivCustom = false;   _kpDivStates = [];
  },
};
