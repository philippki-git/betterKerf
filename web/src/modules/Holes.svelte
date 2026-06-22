<script>
  import Icon from '../lib/Icon.svelte';
  import { units, UNITS, unitLabel, dispVal, dispUnit, toMM, inputVal } from '../lib/units.svelte.js';
  import { showConfirm, showAlert, showToast } from '../lib/dialog.svelte.js';
  import { openZoom } from '../lib/zoom.svelte.js';
  import { computeHoles, axisEdgeIssues, widthEdgeIssue } from '../lib/holes.js';

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

  let result = $state(null); // {kind, error?, top, svg, caption, bottom, copyText, list}

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

    result = { kind: 'row', top, svg: holesSVG(L, centers), caption: 'Bohrschablone', bottom, copyText };
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

    result = { kind: 'grid', top, svg: gridSVG(g), caption: 'Lochraster', bottom, copyText };
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

  function pdfTodo() {
    showAlert('Der PDF-Export wird gerade auf die neue App-Version migriert und ist in Kürze wieder verfügbar.', { title: 'PDF-Export folgt', icon: 'information' });
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
        <div class="vis-wrap" onclick={() => openZoom(result.svg, result.caption)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') openZoom(result.svg, result.caption); }} style="cursor:zoom-in" role="button" tabindex="0">
          {@html result.svg}
        </div>
        {@html result.bottom}
        <button class="action-btn" onclick={copyResult}><Icon name="content_copy" size={16} /> {result.kind === 'grid' ? 'Koordinaten' : 'Positionen'} kopieren</button>
        <button class="action-btn" onclick={pdfTodo}><Icon name="download" size={16} /> Als PDF exportieren</button>
        <button class="action-btn" onclick={pdfTodo}><Icon name="straighten" size={16} /> 1:1-Bohrschablone (PDF)</button>
      {/if}
    </div>
  {/if}
</div>
