// Reine Berechnungslogik des Bohrlochplaners — frei von DOM/UI.
// 1:1 portiert aus der Legacy-App.

export function round2(v) { return Math.round(v * 100) / 100; }

export function gapsOf(c) {
  const g = [];
  for (let i = 1; i < c.length; i++) g.push(round2(c[i] - c[i - 1]));
  return g;
}

// Kern: verteilt n Löcher auf Länge L, optional mit Randabständen.
export function computeHoles(L, n, startMargin, endMargin) {
  if (n < 1) return { centers: [], gaps: [] };
  if (n === 1) {
    const c = (startMargin != null) ? startMargin : L / 2;
    return { centers: [round2(c)], gaps: [] };
  }
  let first, last;
  if (startMargin != null) {
    first = startMargin;
    last = (endMargin != null) ? (L - endMargin) : (L - startMargin);
  } else {
    const gap = L / (n + 1);
    const centers = Array.from({ length: n }, (_, i) => round2((i + 1) * gap));
    return { centers, gaps: gapsOf(centers) };
  }
  const step = (last - first) / (n - 1);
  const centers = Array.from({ length: n }, (_, i) => round2(first + i * step));
  return { centers, gaps: gapsOf(centers) };
}

// ── Randabstands-Prüfung (Faustregel: Lochradius + 3 mm Sicherheitsabstand) ──
export function edgeReq(dia) { return dia && dia > 0 ? dia / 2 + 3 : 0; }

export function axisEdgeIssues(positions, total, dia) {
  if (!dia || dia <= 0 || !positions || !positions.length) return null;
  const req = edgeReq(dia);
  const first = positions[0], last = total - positions[positions.length - 1];
  const issues = [];
  if (first < req) issues.push({ side: 'start', dist: first, req });
  if (last < req) issues.push({ side: 'end', dist: last, req });
  return issues.length ? issues : null;
}

export function widthEdgeIssue(width, dia) {
  if (!width || width <= 0 || !dia || dia <= 0) return null;
  if (dia > width) return { tooBig: true };
  const req = edgeReq(dia), edge = width / 2;
  return edge < req ? { edge, req } : null;
}
