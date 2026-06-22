// Reine Korpus-Geometrie & -Skizze (DOM-frei). Maße intern in mm.
import { dispVal, unitLabel } from './units.svelte.js';

// Zuschnittteile aus den Außenmaßen ableiten. Liefert [{name,l,w,qty}] in mm.
// dividers = senkrechte Trennwände; teilt den Innenraum in (dividers+1) Fächer.
// shelves = Einlegeböden JE FACH.
export function korpusGeometry(H, B, T, s, sr, constr, back, nut, shelves, dividers) {
  const parts = [];
  const add = (name, l, w, qty) => { if (qty > 0 && l > 0.1 && w > 0.1) parts.push({ name, l, w, qty }); };
  const n = Math.max(0, dividers || 0);
  if (constr === 'sides') {
    add('Seite', H, T, 2);
    add('Boden / Deckel', B - 2 * s, T, 2);
  } else {
    add('Boden / Deckel', B, T, 2);
    add('Seite', H - 2 * s, T, 2);
  }
  if (n > 0) add('Trennwand', H - 2 * s, T, n);
  const innerW = B - 2 * s;
  const compW = (innerW - n * s) / (n + 1);
  if (shelves > 0 && compW > 0.1) {
    const sw = compW - 2;
    const sd = T - 10 - ((back === 'inset' || back === 'framed') ? sr : 0);
    add('Einlegeboden', sw, sd, shelves * (n + 1));
  }
  if (back === 'overlay') add('Rückwand', B, H, 1);
  else if (back === 'inset') add('Rückwand', (B - 2 * s) + 2 * nut, (H - 2 * s) + 2 * nut, 1);
  else if (back === 'framed') add('Rückwand', B - 2 * s, H - 2 * s, 1);
  return parts;
}

// Fachhöhen (lichte Höhe je Fach). Fixierte Böden behalten ihre Position,
// auto-Böden verteilen sich gleichmäßig in der Restlücke.
export function computeShelfPositions(states, innerH, s) {
  const numBoards = states.length - 1;
  const fixedFH = states.map(st => st && st.fixed ? (st.posMM || 0) : null);
  const totalFixedFH = fixedFH.reduce((a, v) => a + (v !== null ? v : 0), 0);
  const autoCount = fixedFH.filter(v => v === null).length;
  const freeH = Math.max(0, innerH - numBoards * s - totalFixedFH);
  const autoFH = autoCount > 0 ? freeH / autoCount : 0;
  return fixedFH.map(v => Math.round(v !== null ? v : autoFH));
}

// Fachbreiten (lichte Breite je Fach) analog zu den Fachhöhen.
export function computeDivPositions(states, innerW, s) {
  const numDividers = states.length - 1;
  const fixedFB = states.map(st => st && st.fixed ? (st.posMM || 0) : null);
  const totalFixed = fixedFB.reduce((a, v) => a + (v !== null ? v : 0), 0);
  const autoCount = fixedFB.filter(v => v === null).length;
  const freeW = Math.max(0, innerW - numDividers * s - totalFixed);
  const autoFB = autoCount > 0 ? freeW / autoCount : 0;
  return fixedFB.map(v => Math.round(v !== null ? v : autoFB));
}

// Kontextabhängige Bau-Anleitung als Schritt-Array.
export function korpusGuide(constr, back, nut, shelves, dividers, shelfPos, shelfCustom, shelfStates) {
  const steps = [];
  steps.push('Alle Teile gemäß Zuschnittliste zuschneiden. Auf rechtwinklige, saubere Kanten achten — besonders bei den Korpusteilen, da sich Ungenauigkeiten sonst aufsummieren.');
  steps.push('Sichtbare Kanten nach Wunsch bekanten (Umleimer) oder verschleifen. Das geht vor dem Zusammenbau am leichtesten.');
  if (back === 'inset') {
    steps.push(`Für die Rückwand eine umlaufende Nut fräsen: ${dispVal(nut)} ${unitLabel()} tief, passend zur Rückwandstärke. Die Nut etwas von der hinteren Kante einrücken. In Seiten, Boden und Deckel (bei Trennwänden auch dort) jeweils auf gleicher Höhe.`);
  }
  if (constr === 'sides') {
    steps.push('Korpus verleimen: Boden und Deckel werden zwischen die durchgehenden Seitenteile gesetzt. Die Seiten laufen also über die volle Höhe, Boden und Deckel stoßen stumpf (oder per Dübel/Lamello/Domino) dazwischen. Verbindungen vorbohren bzw. ausrichten.');
  } else {
    steps.push('Korpus verleimen: Die Seitenteile werden zwischen den durchgehenden Boden und Deckel gesetzt. Boden und Deckel laufen also über die volle Breite, die Seiten stoßen stumpf (oder per Dübel/Lamello/Domino) dazwischen.');
  }
  if (dividers > 0) {
    const tw = dividers === 1 ? 'Trennwand' : 'Trennwände';
    steps.push(`${dividers} ${tw} gleichmäßig einsetzen, sodass ${dividers + 1} gleich große Fächer entstehen. Positionen vorher anzeichnen und rechtwinklig zwischen Boden und Deckel verleimen/verdübeln.`);
  }
  steps.push('Korpus mit Zwingen verspannen und auf Rechtwinkligkeit prüfen (Diagonalen messen — beide gleich lang = rechtwinklig). Leim abbinden lassen.');
  if (back === 'overlay') {
    steps.push('Rückwand von hinten aufsetzen (deckt die volle Außenfläche ab) und verschrauben oder nageln. Sie sorgt zusätzlich für die Aussteifung des Korpus.');
  } else if (back === 'inset') {
    steps.push('Rückwand vor dem endgültigen Verleimen des letzten Teils in die Nut einschieben — sie wird beim Zusammenbau eingefasst. Sie sitzt unsichtbar in der umlaufenden Nut.');
  } else if (back === 'framed') {
    steps.push('Rückwand bündig in den hinteren Innenraum einsetzen (zwischen Seiten, Boden und Deckel eingerahmt) und mit Leim/Schrauben oder Leisten fixieren.');
  }
  if (shelves > 0) {
    const total = shelves * ((dividers || 0) + 1);
    let posHint = '';
    if (shelfCustom && shelfPos && shelfStates && shelfStates.some(st => st.fixed)) {
      const u = unitLabel();
      const fixedParts = shelfStates.map((st, i) => st.fixed ? `Fach ${i + 1}: ${dispVal(shelfPos[i])} ${u}` : null).filter(Boolean);
      const autoCount = shelfStates.filter(st => !st.fixed).length;
      posHint = ` Individuelle Fachhöhen: ${fixedParts.join(', ')}.${autoCount > 0 ? ` ${autoCount === 1 ? '1 Fach verteilt sich' : 'Restliche Fächer verteilen sich'} automatisch gleichmäßig.` : ''}`;
    } else {
      posHint = ` Höhe nach Bedarf wählen${dividers > 0 ? ' (pro Fach)' : ''}.`;
    }
    steps.push(`Bohrungen für die Bodenträger setzen und die ${total} losen Einlegeböden einlegen.${posHint}`);
  }
  steps.push('Oberfläche endbehandeln (Öl, Lack oder Wachs) und Beschläge montieren.');
  return steps;
}

// Maßstäbliche Skizze (Vorderansicht + Seitenansicht) als HTML-String (SVG + Legende).
export function korpusSketch(H, B, T, s, sr, constr, back, nut, shelves, dividers, shelfPosMM, divPosMM) {
  const n = Math.max(0, dividers || 0);
  const pad = 22, gap = 50;
  const maxFrontW = 200;
  const maxH = 180;
  const scale = Math.min(maxFrontW / B, maxH / H);
  const fW = B * scale, fH = H * scale;
  const sd = T * scale;
  const t = Math.max(2, s * scale);
  const tr = Math.max(1.5, sr * scale);
  const svgW = pad * 2 + fW + gap + sd;
  const svgH = pad * 2 + fH + 28;
  const ox = pad, oy = pad;
  const sx = pad + fW + gap;

  const col = { body: '#5B8DB8', bodyFill: 'rgba(91,141,184,.18)', back: '#9B6B9B', backFill: 'rgba(155,107,155,.28)', shelf: '#2E7D5E', div: '#C07A2E', line: '#7A7268', txt: '#B8AF9E' };
  let p = '';
  p += `<rect x="${ox}" y="${oy}" width="${fW}" height="${fH}" fill="${col.bodyFill}" stroke="${col.body}" stroke-width="1.2"/>`;
  if (constr === 'sides') {
    p += `<rect x="${ox}" y="${oy}" width="${t}" height="${fH}" fill="${col.body}" opacity=".55"/>`;
    p += `<rect x="${ox + fW - t}" y="${oy}" width="${t}" height="${fH}" fill="${col.body}" opacity=".55"/>`;
    p += `<rect x="${ox + t}" y="${oy}" width="${fW - 2 * t}" height="${t}" fill="${col.body}" opacity=".55"/>`;
    p += `<rect x="${ox + t}" y="${oy + fH - t}" width="${fW - 2 * t}" height="${t}" fill="${col.body}" opacity=".55"/>`;
  } else {
    p += `<rect x="${ox}" y="${oy}" width="${fW}" height="${t}" fill="${col.body}" opacity=".55"/>`;
    p += `<rect x="${ox}" y="${oy + fH - t}" width="${fW}" height="${t}" fill="${col.body}" opacity=".55"/>`;
    p += `<rect x="${ox}" y="${oy + t}" width="${t}" height="${fH - 2 * t}" fill="${col.body}" opacity=".55"/>`;
    p += `<rect x="${ox + fW - t}" y="${oy + t}" width="${t}" height="${fH - 2 * t}" fill="${col.body}" opacity=".55"/>`;
  }
  const innerLeft = ox + t, innerRight = ox + fW - t, innerW = innerRight - innerLeft;
  const innerTop = oy + t, innerBot = oy + fH - t, innerH = innerBot - innerTop;
  const availCompW = innerW - n * t;
  const compEdges = [], compWidths = [], compWidths_mm = [];
  let cx = innerLeft;
  if (divPosMM && divPosMM.length === n + 1) {
    const totalFB = divPosMM.reduce((a, v) => a + v, 0);
    const scW = totalFB > 0 ? availCompW / totalFB : 1;
    for (let i = 0; i <= n; i++) {
      const cW = divPosMM[i] * scW;
      compEdges.push(cx); compWidths.push(cW); compWidths_mm.push(divPosMM[i]);
      if (i < n) p += `<rect x="${(cx + cW).toFixed(1)}" y="${innerTop}" width="${t}" height="${innerH}" fill="${col.div}" opacity=".7"/>`;
      cx += cW + t;
    }
  } else {
    const cW = availCompW / (n + 1);
    const cW_mm = (B - 2 * s - n * s) / (n + 1);
    for (let i = 0; i <= n; i++) {
      compEdges.push(cx); compWidths.push(cW); compWidths_mm.push(cW_mm);
      if (i < n) p += `<rect x="${(cx + cW).toFixed(1)}" y="${innerTop}" width="${t}" height="${innerH}" fill="${col.div}" opacity=".7"/>`;
      cx += cW + t;
    }
  }
  const tiH_mm = Math.max(0, H - 2 * s);
  let _shelfPos = null;
  if (shelves > 0 && tiH_mm > 0) {
    const fhFull = shelfPosMM && shelfPosMM.length > 0 ? shelfPosMM : new Array(shelves + 1).fill(Math.max(0, (tiH_mm - shelves * s) / (shelves + 1)));
    const fhArr = fhFull.slice(0, shelves);
    _shelfPos = [];
    let cum = 0;
    for (const fh of fhArr) { cum += fh; if (cum >= 0 && cum + s <= tiH_mm) _shelfPos.push(cum); cum += s; }
    if (!_shelfPos.length) _shelfPos = null;
  }
  if (_shelfPos) {
    compEdges.forEach((left, ci) => {
      const cW = compWidths[ci];
      _shelfPos.forEach(pos => {
        const yy = innerBot - (pos + s / 2) / tiH_mm * innerH;
        p += `<rect x="${left}" y="${yy - t / 2}" width="${cW.toFixed(1)}" height="${t}" fill="${col.shelf}" opacity=".7"/>`;
      });
    });
  }
  p += `<text x="${ox + fW / 2}" y="${oy + fH + 22}" text-anchor="middle" font-size="10" fill="${col.txt}">Vorderansicht</text>`;

  p += `<rect x="${sx}" y="${oy}" width="${sd}" height="${fH}" fill="${col.bodyFill}" stroke="${col.body}" stroke-width="1.2"/>`;
  p += `<rect x="${sx}" y="${oy}" width="${sd}" height="${t}" fill="${col.body}" opacity=".55"/>`;
  p += `<rect x="${sx}" y="${oy + fH - t}" width="${sd}" height="${t}" fill="${col.body}" opacity=".55"/>`;
  if (back === 'overlay') {
    p += `<rect x="${sx + sd}" y="${oy}" width="${tr}" height="${fH}" fill="${col.backFill}" stroke="${col.back}" stroke-width="1"/>`;
  } else if (back === 'inset') {
    const inset = Math.max(1.5, nut * scale);
    p += `<rect x="${sx + sd - tr - inset}" y="${oy + t}" width="${tr}" height="${fH - 2 * t}" fill="${col.backFill}" stroke="${col.back}" stroke-width="1"/>`;
  } else if (back === 'framed') {
    p += `<rect x="${sx + sd - tr}" y="${oy + t}" width="${tr}" height="${fH - 2 * t}" fill="${col.backFill}" stroke="${col.back}" stroke-width="1"/>`;
  }
  p += `<text x="${sx + sd / 2}" y="${oy + fH + 22}" text-anchor="middle" font-size="10" fill="${col.txt}">Seite</text>`;

  const _sYC = [], _sMM = [];
  if (_shelfPos) {
    _shelfPos.forEach(pos => { _sYC.push(innerBot - (pos + s / 2) / tiH_mm * innerH); _sMM.push(pos); });
    const _pr = _sYC.map((y, i) => [y, _sMM[i]]).sort((a, b) => a[0] - b[0]);
    _sYC.length = 0; _sMM.length = 0; _pr.forEach(([y, m]) => { _sYC.push(y); _sMM.push(m); });
  }
  const _hG = [];
  if (_sYC.length === 0) { if (tiH_mm > 0) _hG.push([innerTop, innerBot, tiH_mm]); }
  else {
    _hG.push([innerTop, _sYC[0] - t / 2, tiH_mm - _sMM[0] - s]);
    for (let i = 0; i < _sYC.length - 1; i++) _hG.push([_sYC[i] + t / 2, _sYC[i + 1] - t / 2, _sMM[i] - _sMM[i + 1] - s]);
    _hG.push([_sYC[_sYC.length - 1] + t / 2, innerBot, _sMM[_sMM.length - 1]]);
  }
  if (tiH_mm > 0) {
    const dX = ox + fW + 9, dC = col.line;
    p += `<line x1="${dX}" y1="${innerTop}" x2="${dX}" y2="${innerBot}" stroke="${dC}" stroke-width="0.7"/>`;
    const _bY = [innerTop];
    _sYC.forEach(y => { _bY.push(y - t / 2); _bY.push(y + t / 2); });
    _bY.push(innerBot);
    _bY.forEach(by => p += `<line x1="${(dX - 3).toFixed(1)}" y1="${by.toFixed(1)}" x2="${(dX + 4).toFixed(1)}" y2="${by.toFixed(1)}" stroke="${dC}" stroke-width="0.7"/>`);
    _hG.forEach(([y1, y2, mm]) => {
      if (y2 - y1 < 8) return;
      p += `<text x="${(dX + 7).toFixed(1)}" y="${((y1 + y2) / 2).toFixed(1)}" font-size="7.5" fill="${dC}" text-anchor="start" dominant-baseline="middle">${dispVal(mm)}</text>`;
    });
  }
  if (compWidths.length > 0 && tiH_mm > 0) {
    const wY = (oy + fH + 10).toFixed(1);
    compEdges.forEach((ex, ci) => {
      const cW = compWidths[ci];
      if (cW < 15) return;
      p += `<text x="${(ex + cW / 2).toFixed(1)}" y="${wY}" font-size="7.5" fill="${col.line}" text-anchor="middle" dominant-baseline="middle">${dispVal(compWidths_mm[ci])}</text>`;
    });
  }

  p += `<text x="${ox + fW / 2}" y="${oy - 7}" text-anchor="middle" font-size="10" fill="${col.txt}">B ${dispVal(B)}</text>`;
  p += `<text x="${ox - 7}" y="${oy + fH / 2}" text-anchor="middle" font-size="10" fill="${col.txt}" transform="rotate(-90 ${ox - 7} ${oy + fH / 2})">H ${dispVal(H)}</text>`;
  p += `<text x="${sx + sd / 2}" y="${oy - 7}" text-anchor="middle" font-size="10" fill="${col.txt}">T ${dispVal(T)}</text>`;

  let legend = `<div class="kp-legend"><span class="kp-leg"><i style="background:${col.body}"></i>Korpus</span>`;
  if (n > 0) legend += `<span class="kp-leg"><i style="background:${col.div}"></i>Trennwand</span>`;
  if (shelves > 0) legend += `<span class="kp-leg"><i style="background:${col.shelf}"></i>Einlegeboden</span>`;
  if (back !== 'none') legend += `<span class="kp-leg"><i style="background:${col.back}"></i>Rückwand</span>`;
  legend += `</div>`;

  return `<div class="kp-sketch"><svg viewBox="0 0 ${svgW.toFixed(0)} ${svgH.toFixed(0)}" width="100%" preserveAspectRatio="xMidYMid meet">${p}</svg></div>${legend}`;
}
