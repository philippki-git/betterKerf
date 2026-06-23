<script>
  import { onMount } from 'svelte';
  import Icon from '../lib/Icon.svelte';
  import { units, UNITS, unitLabel, dispVal, dispUnit, toMM, inputVal } from '../lib/units.svelte.js';
  import { showConfirm, showAlert, showToast } from '../lib/dialog.svelte.js';
  import { openZoom } from '../lib/zoom.svelte.js';
  import { computeHoles, axisEdgeIssues, widthEdgeIssue } from '../lib/holes.js';
  import { loadJsPDF, svgToPng } from '../lib/pdf.js';
  import { handoff } from '../lib/handoff.svelte.js';

  let mode = $state('row');

  // ── Eingaben (Werte in der aktuellen Anzeigeeinheit) ──
  // Reihe
  let hLen = $state(inputVal(1000));
  let hCount = $state(5);
  let hUseMargin = $state(false);
  let hStart = $state(inputVal(50));
  let hEnd = $state(inputVal(50));
  let hSym = $state(true);
  let hWidth = $state('');
  let hDia = $state('');
  // Raster
  let gWid = $state(inputVal(800));
  let gHei = $state(inputVal(400));
  let gCols = $state(4);
  let gRows = $state(3);
  let gUseMargin = $state(false);
  let gMx = $state(inputVal(50));
  let gMy = $state(inputVal(50));
  let gDia = $state('');

  let result = $state(null); // {kind, error?, top, svg, caption, bottom, copyText, data}
  let visWrap = $state(null);

  // Beim Einheitenwechsel die Eingabefelder umrechnen.
  let prevU = units.current;
  $effect(() => {
    const u = units.current;
    if (u === prevU) return;
    const oldF = UNITS[prevU].f;
    const conv = v => {
      if (v === '' || v == null) return v;
      const mm = (parseFloat(String(v).replace(',', '.')) || 0) * oldF;
      return mm ? inputVal(mm) : '';
    };
    hLen = conv(hLen); hStart = conv(hStart); hEnd = conv(hEnd);
    hWidth = conv(hWidth); hDia = conv(hDia);
    gWid = conv(gWid); gHei = conv(gHei); gMx = conv(gMx); gMy = conv(gMy); gDia = conv(gDia);
    prevU = u;
    result = null; // Ergebnis verwirft sich beim Wechsel (wie in der Legacy-App)
  });

  function setMode(m) { mode = m; result = null; }

  function edgeWarningBox(messages) {
    if (!messages.length) return '';
    return `<div class="warn-box"><div class="warn-head">⚠️ Löcher nahe am Rand</div><ul class="warn-list">${messages.map(m => `<li>${m}</li>`).join('')}</ul><div class="warn-hint">Faustregel: Lochmitte mindestens Lochradius + 3 mm von der Kante entfernt halten, um Ausreißen/Splittern beim Bohren zu vermeiden.</div></div>`;
  }

  // ── Reihe berechnen ──
  function holesCalc() {
    const L = toMM(hLen);
    const n = parseInt(hCount) || 0;
    const width = toMM(hWidth);
    const dia = toMM(hDia);
    if (L < 1) { result = { kind: 'error', msg: 'Bitte eine gültige Länge eingeben.' }; return; }
    if (n < 1) { result = { kind: 'error', msg: 'Bitte mindestens 1 Loch angeben.' }; return; }

    let startM = null, endM = null;
    if (hUseMargin) {
      startM = toMM(hStart);
      endM = hSym ? startM : toMM(hEnd);
      if (startM + endM >= L && n > 1) { result = { kind: 'error', msg: 'Die Randabstände sind größer als die Länge. Bitte anpassen.' }; return; }
      if (startM > L) { result = { kind: 'error', msg: 'Der Randabstand ist größer als die Länge.' }; return; }
    }
    const { centers, gaps } = computeHoles(L, n, startM, endM);
    const u = unitLabel();
    const equalGap = gaps.length ? gaps.every(g => Math.abs(g - gaps[0]) < 0.05) : false;

    let top = `<div class="stat-row">
      <div class="stat"><div class="stat-val">${n}</div><div class="stat-lbl">Löcher</div></div>
      <div class="stat"><div class="stat-val">${gaps.length ? dispVal(gaps[0]) : '–'}</div><div class="stat-lbl">Abstand ${u}</div></div>
      <div class="stat"><div class="stat-val">${dispVal(L)}</div><div class="stat-lbl">Länge ${u}</div></div>
    </div>`;

    if (dia > 0) {
      const msgs = [];
      const li = axisEdgeIssues(centers, L, dia);
      if (li) li.forEach(is => msgs.push(`${is.side === 'start' ? 'Erstes' : 'Letztes'} Loch nur ${dispVal(is.dist)} ${u} vom ${is.side === 'start' ? 'Anfang' : 'Ende'} entfernt (empfohlen mind. ${dispVal(is.req)} ${u}).`));
      const wi = widthEdgeIssue(width, dia);
      if (wi) {
        if (wi.tooBig) msgs.push(`Lochdurchmesser (${dispVal(dia)} ${u}) ist größer als die Werkstückbreite (${dispVal(width)} ${u}).`);
        else msgs.push(`Quer zur Reihe bleiben bei mittiger Lage nur ${dispVal(wi.edge)} ${u} bis zur Kante (empfohlen mind. ${dispVal(wi.req)} ${u}).`);
      }
      top += edgeWarningBox(msgs);
    }

    let bottom = `<div class="section" style="margin-top:16px"><div class="slabel">Lochmittelpunkte (ab linker Kante)</div>
      <div class="cut-list">${centers.map((c, i) => `<div class="cut-item">
        <span class="cut-num">${i + 1}</span>
        <div><div class="cut-name">Loch ${i + 1}</div>${i > 0 ? `<div class="cut-from">Abstand zum vorigen: ${dispUnit(gaps[i - 1])}</div>` : '<div class="cut-from">erstes Loch</div>'}</div>
        <span class="cut-dim">${dispUnit(c)}</span>
      </div>`).join('')}</div>
    </div>`;
    if (gaps.length) {
      bottom += `<div class="usage-box"><div class="usage-title">Abstände zwischen den Löchern</div>
        ${equalGap ? `<div class="usage-row"><span class="usage-name">Gleichmäßiger Abstand</span><span class="usage-count"><b>${dispVal(gaps[0])}</b> ${u}</span></div>` : gaps.map((g, i) => `<div class="usage-row"><span class="usage-name">Loch ${i + 1} → ${i + 2}</span><span class="usage-count"><b>${dispVal(g)}</b> ${u}</span></div>`).join('')}
      </div>`;
    }
    bottom += `<div class="info-note">Alle Maße als Lochmitte, gemessen von der linken Kante. ${centers.length ? `Erstes Loch: ${dispUnit(centers[0])} · Letztes Loch: ${dispUnit(centers[centers.length - 1])} (${dispUnit(L - centers[centers.length - 1])} von rechter Kante).` : ''}</div>`;

    const copyText = `Bohrlochplaner — ${n} Löcher auf ${dispVal(L)} ${u}\n\n` + centers.map((c, i) => `Loch ${i + 1}: ${dispVal(c)} ${u}`).join('\n');

    result = { kind: 'row', top, svg: holesSVG(L, centers), caption: 'Bohrschablone', bottom, copyText, data: { L, n, centers, gaps, width: toMM(hWidth), dia: toMM(hDia) } };
  }

  function holesSVG(L, centers) {
    const ML = 14, MR = 14, MT = 30, MB = 34, H = 70;
    const innerW = Math.min(window.innerWidth - 32, 420) - ML - MR;
    const scale = innerW / L;
    const barY = MT, barH = H;
    const svgW = innerW + ML + MR, svgH = H + MT + MB;
    const holeR = Math.max(3, Math.min(7, innerW / L * 8));
    let dots = '', labels = '';
    centers.forEach((c, i) => {
      const x = ML + c * scale, cy = barY + barH / 2;
      dots += `<circle cx="${x}" cy="${cy}" r="${holeR}" fill="#1A1510" stroke="#5B8DB8" stroke-width="1.5"/><circle cx="${x}" cy="${cy}" r="1.5" fill="#5B8DB8"/>`;
      const lblY = barY - 8;
      labels += `<line x1="${x}" y1="${barY}" x2="${x}" y2="${lblY + 3}" stroke="#7A7268" stroke-width=".5" stroke-dasharray="2,2"/><text x="${x}" y="${lblY}" text-anchor="middle" font-size="8" fill="#B8AF9E" font-weight="600">${dispVal(c)}</text>`;
      labels += `<text x="${x}" y="${barY + barH + 12}" text-anchor="middle" font-size="8" fill="#7A7268">#${i + 1}</text>`;
    });
    const dims = `<text x="${ML}" y="${barY + barH + 26}" font-size="8" fill="#7A7268">0</text><text x="${ML + L * scale}" y="${barY + barH + 26}" text-anchor="end" font-size="8" fill="#7A7268">${dispVal(L)}</text>`;
    let grid = '';
    for (let i = 0; i < 8; i++) { const yy = barY + barH / 8 * i + barH / 16; grid += `<line x1="${ML}" y1="${yy}" x2="${ML + L * scale}" y2="${yy}" stroke="#D4C4A0" stroke-width="0.5" opacity="0.3"/>`; }
    return `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;height:${svgH}px;display:block">
      <rect x="${ML}" y="${barY}" width="${L * scale}" height="${barH}" rx="4" fill="#F5EDD6"/>
      ${grid}
      <rect x="${ML}" y="${barY}" width="${L * scale}" height="${barH}" rx="4" fill="none" stroke="#4A4740" stroke-width="1"/>
      ${dots}${labels}${dims}
    </svg>`;
  }

  // ── Raster berechnen ──
  function gridCalc() {
    const W = toMM(gWid), H = toMM(gHei);
    const cols = parseInt(gCols) || 0, rows = parseInt(gRows) || 0;
    const dia = toMM(gDia);
    if (W < 1 || H < 1) { result = { kind: 'error', msg: 'Bitte gültige Plattenmaße eingeben.' }; return; }
    if (cols < 1 || rows < 1) { result = { kind: 'error', msg: 'Bitte mindestens 1 Spalte und 1 Reihe angeben.' }; return; }

    let mx = null, my = null;
    if (gUseMargin) {
      mx = toMM(gMx); my = toMM(gMy);
      if (cols > 1 && 2 * mx >= W) { result = { kind: 'error', msg: 'Horizontaler Rand ist größer als die Breite.' }; return; }
      if (rows > 1 && 2 * my >= H) { result = { kind: 'error', msg: 'Vertikaler Rand ist größer als die Höhe.' }; return; }
    }
    const xs = computeHoles(W, cols, mx, mx).centers;
    const ys = computeHoles(H, rows, my, my).centers;
    const pts = [];
    ys.forEach((y, r) => xs.forEach((x, c) => pts.push({ x, y, row: r + 1, col: c + 1 })));
    const g = { W, H, cols, rows, xs, ys, pts, dia };
    const u = unitLabel();
    const xGap = xs.length > 1 ? xs[1] - xs[0] : 0;
    const yGap = ys.length > 1 ? ys[1] - ys[0] : 0;

    let top = `<div class="stat-row">
      <div class="stat"><div class="stat-val">${pts.length}</div><div class="stat-lbl">Löcher</div></div>
      <div class="stat"><div class="stat-val">${cols}×${rows}</div><div class="stat-lbl">Spalten×Reihen</div></div>
      <div class="stat"><div class="stat-val">${xGap ? dispVal(xGap) : '–'}</div><div class="stat-lbl">X-Abstand ${u}</div></div>
    </div>`;
    if (dia > 0) {
      const msgs = [];
      const xi = axisEdgeIssues(xs, W, dia);
      if (xi) xi.forEach(is => msgs.push(`Spalte ${is.side === 'start' ? 1 : cols} liegt nur ${dispVal(is.dist)} ${u} von der ${is.side === 'start' ? 'linken' : 'rechten'} Kante entfernt (empfohlen mind. ${dispVal(is.req)} ${u}).`));
      const yi = axisEdgeIssues(ys, H, dia);
      if (yi) yi.forEach(is => msgs.push(`Reihe ${is.side === 'start' ? 1 : rows} liegt nur ${dispVal(is.dist)} ${u} von der ${is.side === 'start' ? 'oberen' : 'unteren'} Kante entfernt (empfohlen mind. ${dispVal(is.req)} ${u}).`));
      top += edgeWarningBox(msgs);
    }

    let bottom = `<div class="usage-box"><div class="usage-title">Spalten-Positionen (X, ab linker Kante)</div>
      ${xs.map((x, i) => `<div class="usage-row"><span class="usage-name">Spalte ${i + 1}</span><span class="usage-count"><b>${dispVal(x)}</b> ${u}</span></div>`).join('')}
    </div>`;
    bottom += `<div class="usage-box"><div class="usage-title">Reihen-Positionen (Y, ab oberer Kante)</div>
      ${ys.map((y, i) => `<div class="usage-row"><span class="usage-name">Reihe ${i + 1}</span><span class="usage-count"><b>${dispVal(y)}</b> ${u}</span></div>`).join('')}
    </div>`;
    bottom += `<div class="section" style="margin-top:16px"><div class="slabel">Alle Bohrpunkte (X / Y)</div>
      <div class="cut-list">${pts.map((p, i) => `<div class="cut-item">
        <span class="cut-num">${i + 1}</span>
        <div><div class="cut-name">R${p.row} · S${p.col}</div></div>
        <span class="cut-dim">${dispVal(p.x)} / ${dispVal(p.y)} ${u}</span>
      </div>`).join('')}</div>
    </div>`;
    bottom += `<div class="info-note">X = ab linker Kante, Y = ab oberer Kante. ${xGap ? `Abstand X: ${dispUnit(xGap)}` : ''}${xGap && yGap ? ' · ' : ''}${yGap ? `Abstand Y: ${dispUnit(yGap)}` : ''}</div>`;

    const copyText = `Lochraster — ${cols}×${rows} auf ${dispVal(W)}×${dispVal(H)} ${u}\n\n` + pts.map((p, i) => `${i + 1}. R${p.row} S${p.col}: X=${dispVal(p.x)} Y=${dispVal(p.y)} ${u}`).join('\n');

    result = { kind: 'grid', top, svg: gridSVG(g), caption: 'Lochraster', bottom, copyText, data: { W, H, cols, rows, xs, ys, pts, dia: toMM(gDia) } };
  }

  function gridSVG(g) {
    const ML = 24, MR = 16, MT = 22, MB = 24;
    const availW = Math.min(window.innerWidth - 32, 420) - ML - MR;
    const aspect = g.H / g.W;
    let drawW = availW, drawH = drawW * aspect;
    const maxH = 300;
    if (drawH > maxH) { drawH = maxH; drawW = drawH / aspect; }
    const sx = drawW / g.W, sy = drawH / g.H;
    const svgW = drawW + ML + MR, svgH = drawH + MT + MB;
    const holeR = Math.max(2.5, Math.min(6, Math.min(drawW / g.cols, drawH / g.rows) / 4));
    let dots = '';
    g.pts.forEach(p => {
      const cx = ML + p.x * sx, cy = MT + p.y * sy;
      dots += `<circle cx="${cx}" cy="${cy}" r="${holeR}" fill="#1A1510" stroke="#5B8DB8" stroke-width="1.3"/><circle cx="${cx}" cy="${cy}" r="1.2" fill="#5B8DB8"/>`;
    });
    let guides = '';
    g.xs.forEach(x => { const gx = ML + x * sx; guides += `<line x1="${gx}" y1="${MT}" x2="${gx}" y2="${MT + drawH}" stroke="#7A7268" stroke-width=".4" stroke-dasharray="2,3" opacity=".5"/>`; });
    g.ys.forEach(y => { const gy = MT + y * sy; guides += `<line x1="${ML}" y1="${gy}" x2="${ML + drawW}" y2="${gy}" stroke="#7A7268" stroke-width=".4" stroke-dasharray="2,3" opacity=".5"/>`; });
    const labels = `<text x="${ML}" y="${MT - 7}" font-size="8" fill="#7A7268">0</text>
      <text x="${ML + drawW}" y="${MT - 7}" text-anchor="end" font-size="8" fill="#B8AF9E" font-weight="600">${dispUnit(g.W)} (X)</text>
      <text x="${ML - 6}" y="${MT + drawH + 12}" font-size="8" fill="#B8AF9E" font-weight="600" transform="rotate(-90,${ML - 6},${MT + drawH + 12})">${dispUnit(g.H)} (Y)</text>`;
    return `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;height:${svgH}px;display:block">
      <rect x="${ML}" y="${MT}" width="${drawW}" height="${drawH}" rx="4" fill="#F5EDD6"/>
      ${guides}
      <rect x="${ML}" y="${MT}" width="${drawW}" height="${drawH}" rx="4" fill="none" stroke="#4A4740" stroke-width="1"/>
      ${dots}${labels}
    </svg>`;
  }

  function copyResult() {
    if (!result || !result.copyText) return;
    const txt = result.copyText;
    const ok = () => showToast(result.kind === 'grid' ? 'Koordinaten kopiert ✓' : 'Positionen kopiert ✓');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(ok).catch(() => fallbackCopy(txt, ok));
    } else fallbackCopy(txt, ok);
  }
  function fallbackCopy(text, ok) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); ok(); }
    catch { showAlert('Kopieren nicht möglich.', { title: 'Fehler', icon: 'alert_circle', danger: true }); }
    document.body.removeChild(ta);
  }

  // ── PDF ──
  function holesPDF() {
    if (!result || result.kind !== 'row') return;
    loadJsPDF(() => { holesDoExport().catch(e => { if (e?.name === 'AbortError') return; console.error(e); showAlert('PDF konnte nicht erstellt werden.', { title: 'Fehler', icon: 'alert_circle', danger: true }); }); });
  }

  async function holesDoExport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const { L, n, centers, gaps } = result.data;
    const u = unitLabel();
    let y = 15; const lm = 15, pw = 180;
    const checkY = k => { if (y + k > 272) { doc.addPage(); y = 15; } };
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text('betterKerf — Bohrlochplaner (Reihe)', lm, y); y += 9;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 110, 100);
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')} | Einheit: ${u}`, lm, y); y += 11; doc.setTextColor(0);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('\xdcbersicht', lm, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(`L\xe4nge: ${dispVal(L)} ${u}   L\xf6cher: ${n}   ${gaps.length ? 'Abstand: ' + dispVal(gaps[0]) + ' ' + u : ''}`, lm, y); y += 10;
    const svgEl = visWrap && visWrap.querySelector('svg');
    if (svgEl) { try { const png = await svgToPng(svgEl, 3); const iw = pw, ih = iw * (png.h / png.w); checkY(ih + 8); doc.addImage(png.data, 'PNG', lm, y, iw, ih, undefined, 'FAST'); y += ih + 8; } catch (e) { /* skip image on error */ } }
    checkY(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('Lochmittelpunkte', lm, y); y += 6;
    const colW = [14, 70, 70];
    const heads = ['#', `Position (${u})`, `Abstand zum vorigen (${u})`];
    doc.setFillColor(245, 237, 214); doc.rect(lm, y - 5, pw, 7, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    let x = lm; heads.forEach((h, i) => { doc.text(h, x + 1, y - 1); x += colW[i]; }); y += 4;
    doc.setFont('helvetica', 'normal');
    centers.forEach((c, i) => {
      checkY(6);
      if (i % 2 === 0) { doc.setFillColor(252, 250, 246); doc.rect(lm, y - 3.5, pw, 5.5, 'F'); }
      let xi = lm;
      [String(i + 1), dispVal(c), i > 0 ? dispVal(gaps[i - 1]) : '–'].forEach((v, ci) => { doc.text(String(v), xi + 1, y); xi += colW[ci]; });
      y += 5.5;
    });
    const filename = 'betterkerf-lochabstaende.pdf';
    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
    } else {
      doc.save(filename);
    }
  }

  function gridPDF() {
    if (!result || result.kind !== 'grid') return;
    loadJsPDF(() => { gridDoExport().catch(e => { if (e?.name === 'AbortError') return; console.error(e); showAlert('PDF konnte nicht erstellt werden.', { title: 'Fehler', icon: 'alert_circle', danger: true }); }); });
  }

  async function gridDoExport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const { W, H, cols, rows, xs, ys, pts } = result.data;
    const u = unitLabel();
    let y = 15; const lm = 15, pw = 180;
    const checkY = k => { if (y + k > 272) { doc.addPage(); y = 15; } };
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text('betterKerf — Lochraster', lm, y); y += 9;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 110, 100);
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')} | Einheit: ${u}`, lm, y); y += 11; doc.setTextColor(0);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('\xdcbersicht', lm, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(`Platte: ${dispVal(W)} \xd7 ${dispVal(H)} ${u}   Raster: ${cols} \xd7 ${rows}   L\xf6cher: ${pts.length}`, lm, y); y += 10;
    const svgEl = visWrap && visWrap.querySelector('svg');
    if (svgEl) { try { const png = await svgToPng(svgEl, 3); const iw = pw, ih = iw * (png.h / png.w); checkY(ih + 8); doc.addImage(png.data, 'PNG', lm, y, iw, ih, undefined, 'FAST'); y += ih + 8; } catch (e) { /* skip image on error */ } }
    checkY(16); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Spalten-Positionen (X)', lm, y); y += 5; doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(xs.map((v, i) => `S${i + 1}: ${dispVal(v)}`).join('   '), lm, y, { maxWidth: pw }); y += 8;
    checkY(10); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Reihen-Positionen (Y)', lm, y); y += 5; doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(ys.map((v, i) => `R${i + 1}: ${dispVal(v)}`).join('   '), lm, y, { maxWidth: pw }); y += 10;
    checkY(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(`Alle Bohrpunkte (${u})`, lm, y); y += 6;
    const tc = [14, 40, 55, 55]; const heads = ['#', 'Punkt', 'X', 'Y'];
    doc.setFillColor(245, 237, 214); doc.rect(lm, y - 5, pw, 7, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    let x = lm; heads.forEach((h, i) => { doc.text(h, x + 1, y - 1); x += tc[i]; }); y += 4;
    doc.setFont('helvetica', 'normal');
    pts.forEach((p, i) => {
      checkY(6);
      if (i % 2 === 0) { doc.setFillColor(252, 250, 246); doc.rect(lm, y - 3.5, pw, 5.5, 'F'); }
      let xi = lm;
      [String(i + 1), `R${p.row} S${p.col}`, dispVal(p.x), dispVal(p.y)].forEach((v, ci) => { doc.text(String(v), xi + 1, y); xi += tc[ci]; });
      y += 5.5;
    });
    const filename = 'betterkerf-lochraster.pdf';
    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
    } else {
      doc.save(filename);
    }
  }

  // ── 1:1-Bohrschablone ──
  function eps2(v) { return Math.max(0.01, v * 0.0005); }

  function planTemplateLayout(contentW, contentH, printW, printH) {
    const eps = 0.01, bandGap = 7;
    const tilesX = Math.max(1, Math.ceil((contentW - eps) / printW));
    const tilesY = Math.max(1, Math.ceil((contentH - eps) / printH));
    if (tilesX <= 1 && tilesY <= 1) {
      return { mode: 'single', pages: [{ bands: [{ x0: 0, x1: contentW, y0: 0, y1: contentH, px: 0, py: 0, seg: 0 }] }], totalSegs: 1 };
    }
    if (tilesY <= 1) {
      const bandH = contentH;
      const bandsPerPage = Math.max(1, Math.floor((printH + bandGap) / (bandH + bandGap)));
      const totalSegs = tilesX; const pages = [];
      for (let p = 0; p * bandsPerPage < totalSegs; p++) {
        const bands = [];
        for (let b = 0; b < bandsPerPage; b++) {
          const seg = p * bandsPerPage + b;
          if (seg >= totalSegs) break;
          const x0 = seg * printW, x1 = Math.min(contentW, x0 + printW);
          bands.push({ x0, x1, y0: 0, y1: contentH, px: 0, py: b * (bandH + bandGap), seg });
        }
        pages.push({ bands });
      }
      return { mode: 'stackV', pages, totalSegs, bandGap, bandH, bandsPerPage };
    }
    if (tilesX <= 1) {
      const bandW = contentW;
      const bandsPerPage = Math.max(1, Math.floor((printW + bandGap) / (bandW + bandGap)));
      const totalSegs = tilesY; const pages = [];
      for (let p = 0; p * bandsPerPage < totalSegs; p++) {
        const bands = [];
        for (let b = 0; b < bandsPerPage; b++) {
          const seg = p * bandsPerPage + b;
          if (seg >= totalSegs) break;
          const y0 = seg * printH, y1 = Math.min(contentH, y0 + printH);
          bands.push({ x0: 0, x1: contentW, y0, y1, px: b * (bandW + bandGap), py: 0, seg });
        }
        pages.push({ bands });
      }
      return { mode: 'stackH', pages, totalSegs, bandGap, bandW, bandsPerPage };
    }
    const pages = []; let seg = 0;
    for (let ty = 0; ty < tilesY; ty++) for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * printW, x1 = Math.min(contentW, x0 + printW);
      const y0 = ty * printH, y1 = Math.min(contentH, y0 + printH);
      pages.push({ bands: [{ x0, x1, y0, y1, px: 0, py: 0, seg, tx, ty }] }); seg++;
    }
    return { mode: 'grid', pages, totalSegs: seg, tilesX, tilesY };
  }

  function chooseTemplateOrientation(contentW, contentH, M, headerH) {
    const variants = [{ name: 'portrait', PW: 210, PH: 297 }, { name: 'landscape', PW: 297, PH: 210 }].map(v => {
      const printW = v.PW - 2 * M, printH = v.PH - headerH - M;
      const layout = planTemplateLayout(contentW, contentH, printW, printH);
      return { ...v, printW, printH, layout, pages: layout.pages.length };
    });
    variants.sort((a, b) => a.pages - b.pages);
    if (variants[0].pages === variants[1].pages) {
      return contentW >= contentH ? variants.find(v => v.name === 'landscape') : variants.find(v => v.name === 'portrait');
    }
    return variants[0];
  }

  function buildTemplate(points, sheetW, sheetH, titleText, holeDiameterMM) {
    const { jsPDF } = window.jspdf;
    const M = 8, headerH = 20;
    const choice = chooseTemplateOrientation(sheetW, sheetH, M, headerH);
    const { PW, PH, layout } = choice;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: choice.name });
    const totalPages = layout.pages.length;
    const hasDia = holeDiameterMM > 0;
    const drawR = hasDia ? Math.max(1.2, holeDiameterMM / 2) : 3;
    const chL = hasDia ? drawR + 4 : 5;

    layout.pages.forEach((page, pageIdx) => {
      if (pageIdx > 0) doc.addPage('a4', choice.name);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
      doc.text(`${titleText} — Seite ${pageIdx + 1}/${totalPages}`, M, 7);
      if (hasDia) { doc.setFontSize(9); doc.text(`Ø ${holeDiameterMM} mm`, PW - M, 7, { align: 'right' }); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120);
      doc.text('1:1 drucken: Skalierung 100 % / "Tats\xe4chliche Gr\xf6\xdfe" — NICHT "An Seite anpassen".', M, 10.6);
      if (totalPages > 1) doc.text('Mehrere Seiten/Abschnitte? An den markierten Nahtstellen ausschneiden und zusammenf\xfcgen.', M, 13.6);
      doc.setDrawColor(210); doc.setLineWidth(0.2); doc.line(M, headerH - 4, PW - M, headerH - 4);
      doc.setTextColor(0);

      page.bands.forEach((band, bandIdx) => {
        const ox = M + band.px, oy = headerH + band.py;
        const bw = band.x1 - band.x0, bh = band.y1 - band.y0;
        doc.setDrawColor(180); doc.setLineWidth(0.15);
        doc.rect(ox, oy, bw, bh);
        doc.setDrawColor(120); doc.setLineWidth(0.3); const ml = 3.5;
        [[ox, oy], [ox + bw, oy], [ox, oy + bh], [ox + bw, oy + bh]].forEach(([cx, cy]) => {
          doc.line(cx - ml, cy, cx + ml, cy); doc.line(cx, cy - ml, cx, cy + ml);
        });
        doc.setDrawColor(150, 120, 60); doc.setLineWidth(0.45);
        if (band.y0 <= eps2(sheetH)) doc.line(ox, oy, ox + bw, oy);
        if (band.y1 >= sheetH - eps2(sheetH)) doc.line(ox, oy + bh, ox + bw, oy + bh);
        if (band.x0 <= eps2(sheetW)) doc.line(ox, oy, ox, oy + bh);
        if (band.x1 >= sheetW - eps2(sheetW)) doc.line(ox + bw, oy, ox + bw, oy + bh);
        doc.setDrawColor(0); doc.setLineWidth(0.3);
        points.forEach((p, i) => {
          if (p.x < band.x0 - 0.5 || p.x > band.x1 + 0.5 || p.y < band.y0 - 0.5 || p.y > band.y1 + 0.5) return;
          const px = ox + (p.x - band.x0), py = oy + (p.y - band.y0);
          doc.setDrawColor(60, 110, 180); doc.setLineWidth(0.25);
          doc.circle(px, py, drawR);
          doc.line(px - chL, py, px + chL, py); doc.line(px, py - chL, px, py + chL);
          doc.setFillColor(60, 110, 180); doc.circle(px, py, 0.5, 'F');
          doc.setFontSize(6); doc.setTextColor(60, 110, 180);
          doc.text(String(i + 1), px + drawR + 0.6, py - drawR - 0.6);
          doc.setTextColor(0);
        });

        if (layout.totalSegs > 1) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(130);
          doc.text(`Abschnitt ${band.seg + 1}/${layout.totalSegs}`, ox + 1.8, oy + 4.2);
          if (bandIdx === 0 && pageIdx > 0 && band.seg > 0) {
            doc.setFontSize(6); doc.setTextColor(46, 125, 94);
            doc.text(`<- Anschluss von Abschnitt ${band.seg} (Seite ${pageIdx})`, ox + 1.8, oy + 7.6);
          }
          doc.setTextColor(0); doc.setFont('helvetica', 'normal');
        } else if (layout.mode === 'grid') {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(130);
          doc.text(`Kachel ${band.tx + 1}/${layout.tilesX} x ${band.ty + 1}/${layout.tilesY}`, ox + 1.8, oy + 4.2);
          doc.setTextColor(0); doc.setFont('helvetica', 'normal');
        }

        const nextOnPage = page.bands[bandIdx + 1];
        if (layout.mode === 'stackV' || layout.mode === 'stackH') {
          if (nextOnPage) {
            doc.setDrawColor(46, 125, 94); doc.setLineWidth(0.4);
            if (layout.mode === 'stackV') {
              const segY = oy + bh + layout.bandGap / 2;
              doc.setLineDashPattern([1.2, 1], 0);
              doc.line(ox, segY, ox + bw, segY);
              doc.setLineDashPattern([], 0);
              doc.setFontSize(6.3); doc.setTextColor(46, 125, 94);
              doc.text(`Naht: Abschnitt ${band.seg + 1} -> ${band.seg + 2} hier zusammenf\xfcgen`, ox + 1.8, segY + 2.0);
            } else {
              const segX = ox + bw + layout.bandGap / 2;
              doc.setLineDashPattern([1.2, 1], 0);
              doc.line(segX, oy, segX, oy + bh);
              doc.setLineDashPattern([], 0);
              doc.setFontSize(6.3); doc.setTextColor(46, 125, 94);
              doc.text(`Naht ${band.seg + 1}->${band.seg + 2}`, segX - 9, oy - 0.8 < headerH ? oy + 4.2 : oy - 0.8);
            }
            doc.setTextColor(0);
          } else if (band.seg < layout.totalSegs - 1) {
            doc.setFontSize(6.3); doc.setTextColor(46, 125, 94);
            const noteY = oy + bh + 4.5;
            if (noteY < PH - 4) doc.text(`-> Fortsetzung: Abschnitt ${band.seg + 2} auf Seite ${pageIdx + 2}`, ox + 1.8, noteY);
            doc.setTextColor(0);
          }
        }
      });
    });
    return doc;
  }

  function holesTemplate() {
    if (!result || result.kind !== 'row') return;
    loadJsPDF(() => { holesTemplateExport().catch(e => { if (e?.name === 'AbortError') return; console.error(e); showAlert('Schablone konnte nicht erstellt werden.', { title: 'Fehler', icon: 'alert_circle', danger: true }); }); });
  }
  async function holesTemplateExport() {
    const { L, centers, width, dia } = result.data;
    const stripH = (width && width > 0) ? width : Math.min(40, Math.max(20, L * 0.05));
    const pts = centers.map(c => ({ x: c, y: stripH / 2 }));
    const doc = buildTemplate(pts, L, stripH, 'Bohrschablone Reihe', dia > 0 ? dia : 0);
    const filename = 'betterkerf-schablone-reihe.pdf';
    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
    } else {
      doc.save(filename);
    }
  }

  function gridTemplate() {
    if (!result || result.kind !== 'grid') return;
    loadJsPDF(() => { gridTemplateExport().catch(e => { if (e?.name === 'AbortError') return; console.error(e); showAlert('Schablone konnte nicht erstellt werden.', { title: 'Fehler', icon: 'alert_circle', danger: true }); }); });
  }
  async function gridTemplateExport() {
    const { W, H, pts, dia } = result.data;
    const doc = buildTemplate(pts.map(p => ({ x: p.x, y: p.y })), W, H, 'Bohrschablone Raster', dia > 0 ? dia : 0);
    const filename = 'betterkerf-schablone-raster.pdf';
    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
    } else {
      doc.save(filename);
    }
  }

  async function holesReset() {
    const ok = await showConfirm('Zurücksetzen?', 'Die Eingaben werden auf die Standardwerte zurückgesetzt.', { confirmLabel: 'Zurücksetzen', danger: true, icon: 'restart_alt' });
    if (!ok) return;
    hLen = inputVal(1000); hCount = 5; hUseMargin = false; hStart = inputVal(50); hEnd = inputVal(50); hSym = true; hWidth = ''; hDia = '';
    result = null;
  }
  async function gridReset() {
    const ok = await showConfirm('Zurücksetzen?', 'Die Eingaben werden auf die Standardwerte zurückgesetzt.', { confirmLabel: 'Zurücksetzen', danger: true, icon: 'restart_alt' });
    if (!ok) return;
    gWid = inputVal(800); gHei = inputVal(400); gCols = 4; gRows = 3; gUseMargin = false; gMx = inputVal(50); gMy = inputVal(50); gDia = '';
    result = null;
  }

  // Symmetrie: Endabstand spiegelt Anfang
  $effect(() => { if (hSym) hEnd = hStart; });

  // Handoff vom Schubladenplaner (Griffbohrung)
  onMount(() => {
    const d = handoff.consumeHolesData();
    if (!d) return;
    mode = 'row';
    hLen = inputVal(d.length); hCount = d.count;
    hUseMargin = d.useMargin; hSym = d.sym;
    hStart = inputVal(d.start); hEnd = inputVal(d.end);
    if (d.width > 0) hWidth = inputVal(d.width);
    if (d.dia > 0) hDia = inputVal(d.dia);
    holesCalc();
  });
</script>

<div class="pane active" style="display:block">
  <div class="hsub-tabs">
    <button class="hsub-tab" class:active={mode === 'row'} onclick={() => setMode('row')}>
      <Icon name="adjust" size={14} /> Reihe
    </button>
    <button class="hsub-tab" class:active={mode === 'grid'} onclick={() => setMode('grid')}>
      <Icon name="calculate" size={14} /> Raster
    </button>
  </div>

  {#if mode === 'row'}
    <div class="section">
      <div class="slabel">Maße & Anzahl</div>
      <div class="hint-box">Gib die Strecke an, auf der die Löcher verteilt werden sollen, und wie viele Lochmittelpunkte du brauchst.</div>
      <div class="srow"><div><div class="srow-label">Gesamtlänge</div><div class="srow-hint">Strecke, auf der verteilt wird</div></div><div class="nm"><input type="number" inputmode="decimal" bind:value={hLen} min="0"><span>{unitLabel()}</span></div></div>
      <div class="srow"><div><div class="srow-label">Anzahl Löcher</div><div class="srow-hint">Anzahl der Lochmittelpunkte</div></div><div class="nm"><input type="number" inputmode="numeric" bind:value={hCount} min="1" max="200"><span>×</span></div></div>
    </div>
    <div class="section">
      <div class="slabel">Werkstück &amp; Bohrung</div>
      <div class="hint-box">Optional, für eine maßstäblich realistische 1:1-Schablone. Die Löcher werden mittig über die Werkstückbreite platziert.</div>
      <div class="srow"><div><div class="srow-label">Werkstückbreite</div><div class="srow-hint">Breite quer zur Lochreihe</div></div><div class="nm"><input type="number" inputmode="decimal" bind:value={hWidth} placeholder="optional" min="0"><span>{unitLabel()}</span></div></div>
      <div class="srow"><div><div class="srow-label">Lochdurchmesser</div><div class="srow-hint">Für maßstäbliche Darstellung &amp; Randwarnung</div></div><div class="nm"><input type="number" inputmode="decimal" bind:value={hDia} placeholder="optional" min="0"><span>{unitLabel()}</span></div></div>
    </div>
    <div class="section">
      <div class="slabel">Randabstand</div>
      <div class="srow"><div><div class="srow-label">Eigener Randabstand</div><div class="srow-hint">Sonst gleichmäßig inkl. Kantenabstand</div></div><input type="checkbox" class="toggle" bind:checked={hUseMargin}></div>
      {#if hUseMargin}
        <div class="srow"><div><div class="srow-label">Abstand am Anfang</div><div class="srow-hint">Erste Lochmitte ab linker Kante</div></div><div class="nm"><input type="number" inputmode="decimal" bind:value={hStart} min="0"><span>{unitLabel()}</span></div></div>
        <div class="srow"><div><div class="srow-label">Abstand am Ende</div><div class="srow-hint">Letzte Lochmitte ab rechter Kante</div></div><div class="nm"><input type="number" inputmode="decimal" bind:value={hEnd} min="0" disabled={hSym}><span>{unitLabel()}</span></div></div>
        <div class="srow"><div><div class="srow-label">Beide gleich (symmetrisch)</div><div class="srow-hint">Endabstand = Anfangsabstand</div></div><input type="checkbox" class="toggle" bind:checked={hSym}></div>
      {/if}
    </div>
    <button class="calc-btn" onclick={holesCalc}>▶ Bohrlochplaner berechnen</button>
    <button class="action-btn" onclick={holesReset}><Icon name="restart_alt" size={16} /> Zurücksetzen</button>
  {:else}
    <div class="section">
      <div class="slabel">Plattenmaße</div>
      <div class="hint-box">Löcher werden als gleichmäßiges Raster über die Fläche verteilt — getrennt in Breite (X) und Höhe (Y).</div>
      <div class="srow"><div><div class="srow-label">Breite (X)</div><div class="srow-hint">Horizontale Ausdehnung</div></div><div class="nm"><input type="number" inputmode="decimal" bind:value={gWid} min="0"><span>{unitLabel()}</span></div></div>
      <div class="srow"><div><div class="srow-label">Höhe (Y)</div><div class="srow-hint">Vertikale Ausdehnung</div></div><div class="nm"><input type="number" inputmode="decimal" bind:value={gHei} min="0"><span>{unitLabel()}</span></div></div>
    </div>
    <div class="section">
      <div class="slabel">Anzahl Löcher</div>
      <div class="srow"><div><div class="srow-label">Spalten (in X)</div><div class="srow-hint">Löcher pro Reihe</div></div><div class="nm"><input type="number" inputmode="numeric" bind:value={gCols} min="1" max="100"><span>×</span></div></div>
      <div class="srow"><div><div class="srow-label">Reihen (in Y)</div><div class="srow-hint">Anzahl der Reihen</div></div><div class="nm"><input type="number" inputmode="numeric" bind:value={gRows} min="1" max="100"><span>×</span></div></div>
    </div>
    <div class="section">
      <div class="slabel">Bohrung</div>
      <div class="hint-box">Optional, für eine maßstäblich realistische 1:1-Schablone und eine Randabstands-Warnung.</div>
      <div class="srow"><div><div class="srow-label">Lochdurchmesser</div><div class="srow-hint">Für maßstäbliche Darstellung &amp; Randwarnung</div></div><div class="nm"><input type="number" inputmode="decimal" bind:value={gDia} placeholder="optional" min="0"><span>{unitLabel()}</span></div></div>
    </div>
    <div class="section">
      <div class="slabel">Randabstand</div>
      <div class="srow"><div><div class="srow-label">Eigener Randabstand</div><div class="srow-hint">Sonst gleichmäßig inkl. Kantenabstand</div></div><input type="checkbox" class="toggle" bind:checked={gUseMargin}></div>
      {#if gUseMargin}
        <div class="srow"><div><div class="srow-label">Rand horizontal (X)</div><div class="srow-hint">Abstand links &amp; rechts</div></div><div class="nm"><input type="number" inputmode="decimal" bind:value={gMx} min="0"><span>{unitLabel()}</span></div></div>
        <div class="srow"><div><div class="srow-label">Rand vertikal (Y)</div><div class="srow-hint">Abstand oben &amp; unten</div></div><div class="nm"><input type="number" inputmode="decimal" bind:value={gMy} min="0"><span>{unitLabel()}</span></div></div>
      {/if}
    </div>
    <button class="calc-btn" onclick={gridCalc}>▶ Raster berechnen</button>
    <button class="action-btn" onclick={gridReset}><Icon name="restart_alt" size={16} /> Zurücksetzen</button>
  {/if}

  {#if result}
    <div style="margin-top:18px">
      {#if result.kind === 'error'}
        <div class="err">{result.msg}</div>
      {:else}
        <!-- eslint-disable svelte/no-at-html-tags -->
        {@html result.top}
        <div class="vis-wrap" bind:this={visWrap} onclick={() => openZoom(result.svg, result.caption)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') openZoom(result.svg, result.caption); }} style="cursor:zoom-in" role="button" tabindex="0">
          {@html result.svg}
        </div>
        {@html result.bottom}
        <button class="action-btn" onclick={copyResult}><Icon name="content_copy" size={16} /> {result.kind === 'grid' ? 'Koordinaten' : 'Positionen'} kopieren</button>
        <button class="action-btn" onclick={result.kind === 'row' ? holesPDF : gridPDF}><Icon name="download" size={16} /> Als PDF exportieren</button>
        <button class="action-btn" onclick={result.kind === 'row' ? holesTemplate : gridTemplate}><Icon name="straighten" size={16} /> 1:1-Bohrschablone (PDF)</button>
      {/if}
    </div>
  {/if}
</div>
