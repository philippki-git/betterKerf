// Reine Zuschnitt-Optimierung (ohne DOM) — von Anzeige und PDF gemeinsam genutzt.
// 1:1 portiert aus der Legacy-App (betterKerf.html). Intern wird in mm gerechnet.

// Längere Seite -> L, kürzere -> W (Reihenfolge der Eingabe egal).
export function norm(o) { const a = +o.l || 0, b = +o.w || 0; return { L: Math.max(a, b), W: Math.min(a, b) }; }

// Packt EIN Brett möglichst voll (Maximal-Rectangles-Heuristik, Best-Short-Side-Fit).
export function packBoardMaxRects(BL, BW, parts, kerf, allowRotate, mode) {
  let free = [{ x: 0, y: 0, w: BL, h: BW }];
  const placed = [];
  const remaining = parts.map((p, i) => ({ p, i }));
  const usedIdx = new Set();

  function contained(a, b) { return a.x >= b.x - 1e-6 && a.y >= b.y - 1e-6 && a.x + a.w <= b.x + b.w + 1e-6 && a.y + a.h <= b.y + b.h + 1e-6; }
  function prune() {
    for (let i = 0; i < free.length; i++) for (let j = 0; j < free.length; j++)
      if (i !== j && contained(free[i], free[j])) { free.splice(i, 1); i--; break; }
  }
  function splitFree(fr, usedW, usedH) {
    const res = [];
    if (fr.w - usedW > 1e-6) res.push({ x: fr.x + usedW, y: fr.y, w: fr.w - usedW, h: fr.h });
    if (fr.h - usedH > 1e-6) res.push({ x: fr.x, y: fr.y + usedH, w: (mode === 'guillotine' ? usedW : fr.w), h: fr.h - usedH });
    if (mode !== 'guillotine' && fr.h - usedH > 1e-6) res.push({ x: fr.x, y: fr.y + usedH, w: fr.w, h: fr.h - usedH });
    return res;
  }

  while (true) {
    let best = null;
    for (const ent of remaining) {
      if (usedIdx.has(ent.i)) continue;
      const part = ent.p;
      const orients = [{ w: part.L, h: part.W, rot: false }];
      if (allowRotate && !part.grain && part.L !== part.W) orients.push({ w: part.W, h: part.L, rot: true });
      for (const o of orients) {
        for (const fr of free) {
          const fitW = o.w <= fr.w + 1e-6, fitH = o.h <= fr.h + 1e-6;
          if (fitW && fitH) {
            const leftoverH = fr.w - o.w, leftoverV = fr.h - o.h;
            const shortSide = Math.min(leftoverH, leftoverV), longSide = Math.max(leftoverH, leftoverV);
            const score = shortSide * 1e5 + longSide * 100 + fr.y * 10 + fr.x;
            if (!best || score < best.score) best = { ent, part, o, fr, score };
          }
        }
      }
    }
    if (!best) break;
    const { ent, part, o, fr } = best;
    placed.push({ ...part, x: fr.x, y: fr.y, rotated: o.rot });
    const usedW = Math.min(o.w + kerf, fr.w), usedH = Math.min(o.h + kerf, fr.h);
    const newRects = splitFree(fr, usedW, usedH);
    free = free.filter(f => f !== fr).concat(newRects);
    prune();
    usedIdx.add(ent.i);
  }
  const leftover = remaining.filter(e => !usedIdx.has(e.i)).map(e => e.p);
  return { placed, leftover };
}

// Regal-Packer ("Shelf"): Teile in horizontale Reihen. Stark bei vielen schmalen, langen Leisten.
export function packBoardShelf(BL, BW, parts, kerf, allowRotate) {
  const items = parts.map((p, i) => ({ p, i, w: Math.max(p.L, p.W), h: Math.min(p.L, p.W) }));
  items.sort((a, b) => b.h - a.h || b.w - a.w);
  const placed = []; const used = new Set();
  let shelfY = 0;
  while (shelfY < BW && used.size < items.length) {
    const starter = items.find(it => !used.has(it.i) && shelfY + it.h <= BW + 1e-6 && it.w <= BL + 1e-6);
    if (!starter) break;
    const shelfH = starter.h;
    let x = 0, progress = true;
    while (progress) {
      progress = false;
      for (const it of items) {
        if (used.has(it.i)) continue;
        const cands = (allowRotate && !it.p.grain && it.p.L !== it.p.W) ? [[it.w, it.h, false], [it.h, it.w, true]] : [[it.w, it.h, false]];
        for (const [cw, ch, rot] of cands) {
          if (ch <= shelfH + 1e-6 && x + cw <= BL + 1e-6) {
            placed.push({ ...it.p, x, y: shelfY, rotated: rot });
            used.add(it.i); x += cw + kerf; progress = true; break;
          }
        }
        if (progress) break;
      }
    }
    shelfY += shelfH + kerf;
  }
  return { placed, leftover: items.filter(it => !used.has(it.i)).map(it => it.p) };
}

// Packt ein Brett mit der jeweils besten Methode (MaxRects-Varianten + Regal-Packer).
export function packBoardBest(BL, BW, pool, kerf, allowRotate, mode) {
  const variants = [
    pool,
    [...pool].sort((a, b) => (b.L * b.W) - (a.L * a.W)),
    [...pool].sort((a, b) => Math.max(b.L, b.W) - Math.max(a.L, a.W) || (b.L * b.W) - (a.L * a.W)),
    [...pool].sort((a, b) => b.W - a.W || b.L - a.L),
    [...pool].sort((a, b) => b.L - a.L || b.W - a.W)
  ];
  let best = null;
  for (const v of variants) {
    const r = packBoardMaxRects(BL, BW, v, kerf, allowRotate, mode);
    const area = r.placed.reduce((s, p) => s + p.L * p.W, 0);
    if (!best || area > best.area) best = { placed: r.placed, leftover: r.leftover, area };
  }
  const rs = packBoardShelf(BL, BW, pool, kerf, allowRotate);
  const areaS = rs.placed.reduce((s, p) => s + p.L * p.W, 0);
  if (areaS > best.area) best = { placed: rs.placed, leftover: rs.leftover, area: areaS };
  return best;
}

// Eine Pack-Strategie über mehrere Bretter (jeweils maximal füllen).
export function packStrategy(parts, boardsOrder, kerf, mode, allowRotate) {
  const boards = boardsOrder.map((b, i) => ({ ...b, boardIdx: i, placed: [] }));
  let pool = [...parts];
  const assignment = [];
  for (const board of boards) {
    if (!pool.length) break;
    const r = packBoardBest(board.L, board.W, pool, kerf, allowRotate, mode);
    if (r.placed.length) {
      r.placed.forEach(pp => {
        board.placed.push(pp);
        assignment.push({ part: pp, boardIdx: board.boardIdx, boardName: board.name, boardInst: board.instance, boardQty: board.qty, boardL: board.L, boardW: board.W, x: pp.x, y: pp.y, rotated: pp.rotated });
      });
      pool = r.leftover;
    }
  }
  return { boards, assignment, unplaced: pool };
}

export function usedBoardStats(sol) {
  const used = sol.boards.filter(b => b.placed.length > 0);
  let maxLeftover = 0;
  used.forEach(b => {
    const partArea = b.placed.reduce((s, p) => s + p.L * p.W, 0);
    const leftover = b.L * b.W - partArea;
    if (leftover > maxLeftover) maxLeftover = leftover;
  });
  return { count: used.length, area: used.reduce((s, b) => s + b.L * b.W, 0), maxLeftover };
}

// Vergleich zweier Lösungen. cutOptMode: 'waste' (wenigste Fläche) | 'boards' (wenigste Bretter).
export function solutionBetter(a, b, cutOptMode = 'waste') {
  if (a.unplaced.length !== b.unplaced.length) return a.unplaced.length < b.unplaced.length;
  const ua = usedBoardStats(a), ub = usedBoardStats(b);
  if (cutOptMode === 'boards') {
    if (ua.count !== ub.count) return ua.count < ub.count;
    if (ua.area !== ub.area) return ua.area < ub.area;
  } else {
    if (ua.area !== ub.area) return ua.area < ub.area;
    if (ua.count !== ub.count) return ua.count < ub.count;
  }
  if (ua.maxLeftover !== ub.maxLeftover) return ua.maxLeftover > ub.maxLeftover;
  return false;
}

// Optimierer-Fabrik: kapselt Attempt-Generator + Bestenliste. Die Zeitscheiben-
// Steuerung (setTimeout, Fortschrittsanzeige) übernimmt die Komponente.
export function createOptimizer(stockData, partsData, { kerf, mode, allowRotate, cutOptMode }) {
  const baseBoards = [];
  stockData.forEach(s => { const n = norm(s); for (let q = 0; q < (s.qty || 1); q++) baseBoards.push({ stockId: s.id, name: s.name, L: n.L, W: n.W, qty: s.qty || 1, instance: q + 1 }); });
  const baseParts = [];
  partsData.forEach(p => { const n = norm(p); for (let i = 0; i < (p.qty || 1); i++) baseParts.push({ partId: p.id, name: p.name, L: n.L, W: n.W, qty: p.qty || 1, instance: i + 1, grain: !!p.grain }); });

  const partOrders = [
    [...baseParts].sort((a, b) => (b.L * b.W) - (a.L * a.W)),
    [...baseParts].sort((a, b) => Math.max(b.L, b.W) - Math.max(a.L, a.W) || (b.L * b.W) - (a.L * a.W)),
    [...baseParts].sort((a, b) => (b.W) - (a.W) || (b.L) - (a.L)),
    [...baseParts].sort((a, b) => (b.L) - (a.L) || (b.W) - (a.W))
  ];
  const boardOrders = [
    (bs) => [...bs].sort((a, b) => (a.L * a.W) - (b.L * b.W)),
    (bs) => [...bs].sort((a, b) => (b.L * b.W) - (a.L * a.W)),
    (bs) => [...bs]
  ];
  const fillBiases = ['consolidate', 'bestfit'];
  const partsTotalArea = baseParts.reduce((s, p) => s + p.L * p.W, 0);

  const N = baseBoards.length;
  let subsetMasks = [];
  if (N <= 14) {
    for (let mask = 1; mask < (1 << N); mask++) {
      let area = 0, cnt = 0;
      for (let i = 0; i < N; i++) if (mask & (1 << i)) { area += baseBoards[i].L * baseBoards[i].W; cnt++; }
      if (area >= partsTotalArea) subsetMasks.push({ mask, area, cnt });
    }
    subsetMasks.sort((a, b) => cutOptMode === 'boards' ? (a.cnt - b.cnt) || (a.area - b.area) : (a.area - b.area) || (a.cnt - b.cnt));
    subsetMasks = subsetMasks.slice(0, 500);
  } else {
    subsetMasks = [{ mask: (1 << N) - 1, area: 0, cnt: N }];
  }
  const fullMask = (1 << N) - 1;
  if (!subsetMasks.some(s => s.mask === fullMask)) subsetMasks.unshift({ mask: fullMask, area: 0, cnt: N });

  let seed = 12345;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }

  function* attemptGen() {
    for (const sm of subsetMasks) {
      const subset = baseBoards.filter((_, i) => sm.mask & (1 << i));
      for (const po of partOrders)
        for (const ofn of boardOrders)
          for (const fb of fillBiases)
            yield { subset, parts: po, orderFn: ofn, bias: fb };
    }
    const topSubsets = subsetMasks.slice(0, Math.min(subsetMasks.length, 8));
    while (true) {
      const sm = topSubsets[Math.floor(rng() * topSubsets.length)];
      const subset = baseBoards.filter((_, i) => sm.mask & (1 << i));
      const ofn = boardOrders[Math.floor(rng() * boardOrders.length)];
      const fb = fillBiases[Math.floor(rng() * fillBiases.length)];
      yield { subset, parts: shuffle(baseParts), orderFn: ofn, bias: fb };
    }
  }
  const gen = attemptGen();

  let best = null, tries = 0, phase1Done = false;
  function evalAttempt(at) {
    const sol = packStrategy(at.parts, at.orderFn(at.subset), kerf, mode, allowRotate);
    tries++;
    if (sol.unplaced.length === 0 || !best) {
      if (!best || solutionBetter(sol, best, cutOptMode)) { best = sol; return true; }
    }
    return false;
  }

  return {
    get best() { return best; },
    get tries() { return tries; },
    get phase1Done() { return phase1Done; },
    // Eine Zeitscheibe rechnen; gibt zurück, ob sich die beste Lösung verbessert hat.
    runSlice(ms, stopOnComplete = false) {
      const end = Date.now() + ms;
      let improved = false;
      while (Date.now() < end) {
        const it = gen.next();
        if (it.done) { phase1Done = true; break; }
        if (evalAttempt(it.value)) improved = true;
        if (stopOnComplete && best && best.unplaced.length === 0) break;
      }
      return improved;
    }
  };
}
