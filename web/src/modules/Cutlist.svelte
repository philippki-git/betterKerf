<script>
  import Icon from '../lib/Icon.svelte';
  import { units, unitLabel, dispVal, dispUnit, toMM, inputVal } from '../lib/units.svelte.js';
  import { showConfirm, showAlert, showToast } from '../lib/dialog.svelte.js';
  import { openZoom } from '../lib/zoom.svelte.js';
  import { norm, createOptimizer } from '../lib/cutlist.js';
  import { projects, saveProject, findProject, deleteProject } from '../lib/cutlistProjects.svelte.js';
  import { cutlistSettings } from '../lib/cutlistSettings.svelte.js';
  import { cutlistInput, EXAMPLE_STOCK, EXAMPLE_PARTS } from '../lib/cutlistInput.svelte.js';
  import { loadJsPDF, svgToPng, savePDF, addLogoToDoc } from '../lib/pdf.js';
  import { handoff } from '../lib/handoff.svelte.js';
  import { cutlistResult } from '../lib/cutlistResult.svelte.js';
  import { onMount } from 'svelte';

  let tab = $state('input');       // 'input' | 'projects' | 'result' | 'steps'
  let editStock = $state(false), editParts = $state(false);
  let projName = $state('');

  let resultEl = $state(null), stepsEl = $state(null);

  // Optimierungs-Fortschritt
  let optimizing = $state(false), optDone = $state(false), optAccepted = $state(false);
  let optFrac = $state(0);
  let currentOpt = null, optTimer = null, ringTimer = null, optStart = 0;
  const TOTAL_MS = 20000, SLICE_MS = 40;
  const RING_R = 20, RING_C = 2 * Math.PI * RING_R;

  const step = $derived(units.current === 'mm' ? '1' : (units.current === 'cm' ? '0.1' : '0.001'));
  const stockCls = $derived(editStock ? 'col-stock-e' : 'col-stock');
  const partsCls = $derived(editParts && cutlistInput.grainEnabled ? 'col-parts-eg' : editParts ? 'col-parts-e' : cutlistInput.grainEnabled ? 'col-parts-g' : 'col-parts');
  const visibleTabs = $derived(['input', 'projects', ...(cutlistInput.hasResult ? ['result', 'steps'] : [])]);

  function escQ(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  // ── Farben für die Visualisierung (stabil je Teil-Name) ──
  const COLORS = ['#2E7D5E', '#5B8DB8', '#6B8F5E', '#9B6B9B', '#B85B5B', '#5B9B8D', '#9B8B5B', '#5B6B9B', '#8B9B5B', '#7B5B9B'];
  const colorMap = {}; let ci = 0;
  function getColor(n) { if (!colorMap[n]) colorMap[n] = COLORS[ci++ % COLORS.length]; return colorMap[n]; }

  // ── Eingabelisten: Bretter ──
  function setStock(id, key, val) { const b = cutlistInput.stockData.find(x => x.id === id); if (b) b[key] = val; }
  function addStock() { cutlistInput.stockData = [...cutlistInput.stockData, { id: cutlistInput.nextSId++, name: 'Brett ' + String.fromCharCode(64 + cutlistInput.stockData.length + 1), l: 1000, w: 150, qty: 1 }]; }
  function dupStock(id) { const i = cutlistInput.stockData.findIndex(x => x.id === id); if (i < 0) return; const c = { ...cutlistInput.stockData[i], id: cutlistInput.nextSId++ }; const a = [...cutlistInput.stockData]; a.splice(i + 1, 0, c); cutlistInput.stockData = a; }
  function delStock(id) { cutlistInput.stockData = cutlistInput.stockData.filter(x => x.id !== id); }

  // ── Eingabelisten: Teile ──
  function setPart(id, key, val) { const p = cutlistInput.partsData.find(x => x.id === id); if (p) p[key] = val; }
  function addPart() { cutlistInput.partsData = [...cutlistInput.partsData, { id: cutlistInput.nextPId++, name: 'Teil ' + (cutlistInput.partsData.length + 1), l: 400, w: 100, qty: 1, grain: false }]; }
  function dupPart(id) { const i = cutlistInput.partsData.findIndex(x => x.id === id); if (i < 0) return; const c = { ...cutlistInput.partsData[i], id: cutlistInput.nextPId++ }; const a = [...cutlistInput.partsData]; a.splice(i + 1, 0, c); cutlistInput.partsData = a; }
  function delPart(id) { cutlistInput.partsData = cutlistInput.partsData.filter(x => x.id !== id); }
  function toggleGrain(id) { const p = cutlistInput.partsData.find(x => x.id === id); if (p) { p.grain = !p.grain; cutlistInput.partsData = [...cutlistInput.partsData]; } }

  const isEmpty = $derived(!cutlistInput.stockData.length && !cutlistInput.partsData.length);

  function loadExample() {
    cutlistInput.stockData = JSON.parse(JSON.stringify(EXAMPLE_STOCK));
    cutlistInput.partsData = JSON.parse(JSON.stringify(EXAMPLE_PARTS));
    cutlistInput.nextSId = 20; cutlistInput.nextPId = 20;
  }

  function toggleEditStock() { editStock = !editStock; }
  function toggleEditParts() { editParts = !editParts; }
  function toggleGrainMode() { if (!cutlistInput.grainEnabled) { cutlistInput.partsData.forEach(p => p.grain = false); cutlistInput.partsData = [...cutlistInput.partsData]; } }

  // ── Drag-Sortierung (Pointer-Events, iOS + Desktop) ──
  function startDrag(e, which) {
    e.preventDefault();
    const container = which === 'stock' ? document.getElementById('cut-stock-list') : document.getElementById('cut-parts-list');
    if (!container) return;
    const handle = e.currentTarget;
    const row = handle.closest('.row');
    const rows = [...container.querySelectorAll('.row')];
    const fromIdx = rows.indexOf(row);
    row.classList.add('dragging');
    let overIdx = fromIdx;
    function onMove(ev) {
      const y = ev.clientY;
      let target = -1;
      rows.forEach((r, i) => { if (r === row) return; const rect = r.getBoundingClientRect(); if (y > rect.top && y < rect.bottom) target = i; });
      rows.forEach(r => r.classList.remove('drag-over'));
      if (target >= 0) { rows[target].classList.add('drag-over'); overIdx = target; }
      else if (rows.length) {
        const last = rows[rows.length - 1].getBoundingClientRect(); if (y >= last.bottom) overIdx = rows.length - 1;
        const first = rows[0].getBoundingClientRect(); if (y <= first.top) overIdx = 0;
      }
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      rows.forEach(r => r.classList.remove('drag-over'));
      row.classList.remove('dragging');
      if (overIdx !== fromIdx && overIdx >= 0) {
        const arr = which === 'stock' ? [...cutlistInput.stockData] : [...cutlistInput.partsData];
        const [moved] = arr.splice(fromIdx, 1);
        arr.splice(overIdx, 0, moved);
        if (which === 'stock') cutlistInput.stockData = arr; else cutlistInput.partsData = arr;
      }
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  async function resetToExample() {
    const ok = await showConfirm('Zurücksetzen?', 'Alle eingegebenen Bretter und Teile werden gelöscht. Nicht gespeicherte Änderungen gehen verloren.', { confirmLabel: 'Zurücksetzen', danger: true, icon: 'restart_alt' });
    if (!ok) return;
    cutlistInput.stockData = []; cutlistInput.partsData = [];
    cutlistInput.nextSId = 1; cutlistInput.nextPId = 1;
    cutlistSettings.kerf = 3; cutlistSettings.mode = 'guillotine'; cutlistSettings.allowRotate = true; cutlistSettings.optmode = 'waste';
    cutlistInput.grainEnabled = false; editStock = false; editParts = false;
    cutlistInput.lastResult = null; cutlistInput.hasResult = false;
    stopTimers(); optimizing = false; optDone = false;
    tab = 'input';
  }

  // ── Optimierung ──
  function stopTimers() { if (optTimer) clearTimeout(optTimer); if (ringTimer) clearTimeout(ringTimer); optTimer = ringTimer = null; }

  function calculate() {
    if (!cutlistInput.stockData.length || !cutlistInput.partsData.length) { showAlert('Bitte Bretter und Teile eingeben.', { title: 'Fehlende Eingaben', icon: 'information' }); return; }
    for (const s of cutlistInput.stockData) { const n = norm(s); if (n.L < 1 || n.W < 1) { showAlert('Alle Bretter brauchen gültige Maße.', { title: 'Ungültige Maße', icon: 'information' }); return; } }
    for (const p of cutlistInput.partsData) { const n = norm(p); if (n.L < 1 || n.W < 1) { showAlert('Alle Teile brauchen gültige Maße.', { title: 'Ungültige Maße', icon: 'information' }); return; } }

    stopTimers();
    const k = parseFloat(cutlistSettings.kerf) || 0;
    currentOpt = createOptimizer(cutlistInput.stockData, cutlistInput.partsData, { kerf: k, mode: cutlistSettings.mode, allowRotate: cutlistSettings.allowRotate, cutOptMode: cutlistSettings.optmode });
    // Erste brauchbare Lösung sofort
    currentOpt.runSlice(SLICE_MS, true);
    applyResult();
    cutlistInput.hasResult = true; tab = 'result';
    optimizing = true; optDone = false; optAccepted = false;
    optStart = Date.now(); optFrac = 0;
    tickRing();
    runStep();
  }

  function applyResult() {
    const sol = currentOpt.best;
    cutlistInput.lastResult = { expandedBoards: sol.boards, assignment: sol.assignment, unplaced: sol.unplaced, kerf: parseFloat(cutlistSettings.kerf) || 0, mode: cutlistSettings.mode, allowRotate: cutlistSettings.allowRotate };
  }

  function runStep() {
    if (!currentOpt) return;
    const improved = currentOpt.runSlice(SLICE_MS);
    if (improved) applyResult();
    if (Date.now() - optStart >= TOTAL_MS) { finishOpt(); return; }
    optTimer = setTimeout(runStep, 0);
  }
  function tickRing() {
    optFrac = Math.min(1, (Date.now() - optStart) / TOTAL_MS);
    if (optFrac < 1 && currentOpt) ringTimer = setTimeout(tickRing, 100);
  }
  function finishOpt() {
    stopTimers();
    if (currentOpt) applyResult();
    currentOpt = null;
    optimizing = false; optDone = true; optAccepted = false;
  }
  function stopOpt() {
    stopTimers();
    currentOpt = null;
    optimizing = false; optDone = true; optAccepted = true;
  }

  $effect(() => () => stopTimers()); // Aufräumen beim Verlassen des Moduls
  $effect(() => { cutlistResult.set(cutlistInput.lastResult); });

  // Vom Korpusplaner übergebene Teile übernehmen (beim Mounten)
  onMount(() => {
    const incoming = handoff.consumeCutlistParts();
    if (incoming && incoming.length) {
      cutlistInput.partsData = incoming;
      cutlistInput.nextPId = Math.max(19, ...incoming.map(p => p.id)) + 1;
      cutlistInput.grainEnabled = false;
      cutlistInput.lastResult = null; cutlistInput.hasResult = false;
      tab = 'input';
      showToast('Teile aus Korpusplaner übernommen ✓');
    }
  });

  // ── Ergebnis-HTML ──
  function woodGrain(ox, oy, w, h) { let s = ''; for (let i = 0; i < 10; i++) { const y = oy + Math.round(h / 10 * i + h / 20); s += `<line x1="${ox}" y1="${y}" x2="${ox + w}" y2="${y}" stroke="#7AB89A" stroke-width="0.5" opacity="0.3"/>`; } return s; }

  function renderResultHTML(result) {
    const { expandedBoards, assignment, unplaced, kerf } = result;
    const usedBoards = expandedBoards.filter(b => assignment.some(a => a.boardIdx === b.boardIdx));
    const totalParts = assignment.length + unplaced.length;
    const usedArea = assignment.reduce((s, a) => s + a.part.L * a.part.W, 0);
    const usedBoardsArea = usedBoards.reduce((s, b) => s + b.L * b.W, 0);
    const wasteP = usedBoardsArea ? Math.round((usedBoardsArea - usedArea) / usedBoardsArea * 100) : 0;

    let html = `<div class="stat-row">
      <div class="stat"><div class="stat-val">${usedBoards.length}</div><div class="stat-lbl">Bretter genutzt</div></div>
      <div class="stat"><div class="stat-val">${assignment.length}/${totalParts}</div><div class="stat-lbl">Teile verteilt</div></div>
      <div class="stat"><div class="stat-val">${wasteP}%</div><div class="stat-lbl">Verschnitt</div></div>
    </div>`;
    if (unplaced.length) {
      const grp = {};
      unplaced.forEach(p => { const key = p.name + '|' + p.L + '|' + p.W; grp[key] = grp[key] || { name: p.name, L: p.L, W: p.W, n: 0 }; grp[key].n++; });
      const lines = Object.values(grp).map(g => `<li><b>${g.n}×</b> ${escQ(g.name)} (${dispVal(g.L)}×${dispUnit(g.W)})</li>`).join('');
      html += `<div class="warn-box">
        <div class="warn-head">⚠️ ${unplaced.length} Teil(e) konnten nicht platziert werden</div>
        <ul class="warn-list">${lines}</ul>
        <div class="warn-hint">Es fehlt Material. Füge weitere oder größere Bretter hinzu, erhöhe die Stückzahl vorhandener Bretter, oder prüfe, ob ein Teil größer als jedes Brett ist.</div>
      </div>`;
    }

    const byType = {};
    cutlistInput.stockData.forEach(s => { byType[s.id] = { name: s.name, avail: s.qty || 1, used: 0 }; });
    usedBoards.forEach(b => { if (byType[b.stockId]) byType[b.stockId].used++; });
    html += `<div class="usage-box"><div class="usage-title">Brettverbrauch</div>
      ${Object.values(byType).map(t => `<div class="usage-row"><span class="usage-name">${escQ(t.name)}</span><span class="usage-count"><b>${t.used}</b> von ${t.avail} verwendet</span></div>`).join('')}
    </div>`;

    usedBoards.forEach(board => {
      const bA = assignment.filter(a => a.boardIdx === board.boardIdx);
      const ML = 28, MT = 24, MB = 18, MR = 18;
      const maxW = Math.min(window.innerWidth - 32, 760) - ML - MR;
      const scale = Math.min(maxW / board.L, 260 / board.W);
      const bW = Math.round(board.L * scale), bH = Math.max(30, Math.round(board.W * scale));
      const svgW = bW + ML + MR, svgH = bH + MT + MB;
      const usedB = bA.reduce((s, a) => s + a.part.L * a.part.W, 0);
      const wasteB = Math.round((board.L * board.W - usedB) / (board.L * board.W) * 100);
      const boardLabel = board.qty > 1 ? `${board.name} (${board.instance}/${board.qty})` : board.name;
      const mid = `m${board.boardIdx}`;
      const dimSVG = `<defs>
        <marker id="ah${mid}" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><polygon points="0,0 5,2.5 0,5" fill="#F2EEE8"/></marker>
        <marker id="at${mid}" markerWidth="5" markerHeight="5" refX="1" refY="2.5" orient="auto-start-reverse"><polygon points="0,0 5,2.5 0,5" fill="#F2EEE8"/></marker></defs>
        <line x1="${ML + 5}" y1="12" x2="${Math.max(ML + 5, ML + bW / 2 - 40)}" y2="12" stroke="rgba(176,173,166,.4)" stroke-width=".8" ${bW > 90 ? `marker-start="url(#at${mid})"` : ''}/>
        <line x1="${Math.min(ML + bW - 5, ML + bW / 2 + 40)}" y1="12" x2="${ML + bW - 5}" y2="12" stroke="rgba(176,173,166,.4)" stroke-width=".8" ${bW > 90 ? `marker-end="url(#ah${mid})"` : ''}/>
        <text x="${ML + bW / 2}" y="14" text-anchor="middle" font-size="10" font-weight="600" fill="#F2EEE8"><tspan dx="0">L ${dispUnit(board.L)}</tspan></text>
        <line x1="12" y1="${MT + 5}" x2="12" y2="${Math.max(MT + 5, MT + bH / 2 - 40)}" stroke="rgba(176,173,166,.4)" stroke-width=".8" ${bH > 90 ? `marker-start="url(#at${mid})"` : ''}/>
        <line x1="12" y1="${Math.min(MT + bH - 5, MT + bH / 2 + 40)}" x2="12" y2="${MT + bH - 5}" stroke="rgba(176,173,166,.4)" stroke-width=".8" ${bH > 90 ? `marker-end="url(#ah${mid})"` : ''}/>
        <text x="12" y="${MT + bH / 2}" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="600" fill="#F2EEE8" transform="rotate(-90,12,${MT + bH / 2})">B ${dispUnit(board.W)}</text>`;
      const partsSVG = bA.map(a => {
        const ex = a.rotated ? a.part.W : a.part.L, ey = a.rotated ? a.part.L : a.part.W;
        const x = ML + Math.round(a.x * scale), y = MT + Math.round(a.y * scale);
        const rw = Math.round(ex * scale), rh = Math.round(ey * scale);
        const col = getColor(a.part.name);
        const exVal = dispVal(ex), eyVal = dispVal(ey);
        const fs = 6, pad = 3, cw = fs * 0.56;
        const cx = x + rw / 2, cy = y + rh / 2;
        const canH = rw > exVal.length * cw + pad * 2 && rh > fs * 2 + pad * 2;
        const canV = rh > eyVal.length * cw + pad * 2 && rw > fs * 2 + pad * 2;
        let lbl = '';
        if (canH) lbl += `<text x="${cx}" y="${y + pad + fs}" text-anchor="middle" font-size="${fs}" fill="rgba(255,255,255,.85)">${exVal}</text>`;
        if (canV) lbl += `<text x="${x + pad + fs * 0.5}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" fill="rgba(255,255,255,.85)" transform="rotate(-90,${x + pad + fs * 0.5},${cy})">${eyVal}</text>`;
        const fw = Math.max(2, Math.min(ML + Math.round((a.x + ex + kerf) * scale) - x - 1, ML + bW - x - 1));
        const fh = Math.max(2, Math.min(MT + Math.round((a.y + ey + kerf) * scale) - y - 1, MT + bH - y - 1));
        return `<rect x="${x}" y="${y}" width="${fw}" height="${fh}" fill="${col}" opacity=".95"/>${lbl}`;
      }).join('');
      const svgMarkup = `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;height:${svgH}px;display:block" font-family="sans-serif">
          <rect x="${ML}" y="${MT}" width="${bW}" height="${bH}" fill="rgba(46,125,94,.18)"/>
          ${dimSVG}${partsSVG}
          <rect x="${ML}" y="${MT}" width="${bW}" height="${bH}" fill="none" stroke="#2E7D5E" stroke-width="1"/>
        </svg>`;
      html += `<div class="bvis">
        <div class="bvis-top"><span><b>${escQ(boardLabel)}</b> — ${dispVal(board.L)}×${dispUnit(board.W)} · ${bA.length} Teil(e)</span><span style="color:${wasteB > 40 ? '#C04848' : '#6C9B6A'}">${wasteB}% Rest</span></div>
        <div class="vis-wrap" style="cursor:zoom-in">${svgMarkup}</div>
        <div class="legend">
          ${[...new Set(bA.map(a => a.part.name))].map(n => `<div class="legend-item"><div class="legend-dot" style="background:${getColor(n)}"></div>${escQ(n)}</div>`).join('')}
        </div>
      </div>`;
    });

    html += `<div class="section" style="margin-top:6px">
      <div class="slabel">Schnittliste</div>
      <div class="cut-list">${assignment.map((a, i) => `<div class="cut-item">
        <span class="cut-num">${i + 1}</span>
        <div><div class="cut-name">${escQ(a.part.name)}${a.part.qty > 1 ? ' #' + a.part.instance : ''}${a.rotated ? ' ↻' : ''}</div>
        <div class="cut-from">${escQ(a.boardName)}${a.boardQty > 1 ? ' (Brett ' + a.boardInst + ')' : ''} — ab ${dispVal(a.x)}×${dispUnit(a.y)}</div></div>
        <span class="cut-dim">${dispVal(a.part.L)}×${dispVal(a.part.W)}</span>
      </div>`).join('')}</div>
      <div class="info-note">Kerf ${kerf} mm | Einheit: ${unitLabel()} | ↻ = 90° gedreht | L=Länge, B=Breite</div>
    </div>`;
    return html;
  }

  function renderStepsHTML(result) {
    const { expandedBoards, assignment, kerf } = result;
    const steps = [];
    expandedBoards.forEach(board => {
      const bA = assignment.filter(a => a.boardIdx === board.boardIdx);
      if (!bA.length) return;
      const lbl = board.qty > 1 ? `${board.name} (Exemplar ${board.instance}/${board.qty})` : board.name;
      steps.push({ type: 'board', text: `Brett einlegen: <b>${escQ(lbl)}</b>`, detail: `${dispVal(board.L)}×${dispUnit(board.W)} — ausrichten, Anschlag prüfen, Maserungsrichtung beachten` });
      const byY = [...bA].sort((a, b) => a.y - b.y);
      const yGroups = [];
      byY.forEach(a => { const e = yGroups.find(g => Math.abs(g.y - a.y) < kerf + 5); if (e) e.items.push(a); else yGroups.push({ y: a.y, items: [a] }); });
      yGroups.forEach((grp, gi) => {
        if (gi + 1 < yGroups.length) { const f = grp.items[0]; const ey = f.rotated ? f.part.L : f.part.W; const cutAt = Math.round(grp.y + ey + kerf); steps.push({ type: 'cut', text: `Querschnitt (entlang Breite) bei <span class="step-pill">${dispUnit(cutAt)}</span>`, detail: `Anschlag auf ${dispUnit(cutAt)} — Brett durchgehend quer sägen, Reststreifen abnehmen` }); }
        const rowItems = [...grp.items].sort((a, b) => a.x - b.x);
        const xGroups = [];
        rowItems.forEach(a => { const e = xGroups.find(g => Math.abs(g.x - a.x) < kerf + 5); if (e) e.items.push(a); else xGroups.push({ x: a.x, items: [a] }); });
        if (xGroups.length > 1) { const cuts = xGroups.slice(0, -1).map(g => { const l = g.items[g.items.length - 1]; const ex = l.rotated ? l.part.W : l.part.L; return Math.round(g.x + ex + kerf); }); steps.push({ type: 'rip', text: `Längsschnitte bei ${cuts.map(p => `<span class="step-pill">${dispUnit(p)}</span>`).join(' · ')}`, detail: `Streifen längs aufteilen → ${rowItems.map(a => escQ(a.part.name) + (a.part.qty > 1 ? ' #' + a.part.instance : '')).join(', ')}` }); }
        else { steps.push({ type: 'part', text: `Teil entnehmen: ${rowItems.map(a => `<b>${escQ(a.part.name)}${a.part.qty > 1 ? ' #' + a.part.instance : ''}${a.rotated ? ' ↻' : ''}</b>`).join(', ')}`, detail: `Maß: ${dispVal(rowItems[0].part.L)}×${dispUnit(rowItems[0].part.W)}${rowItems[0].rotated ? ' (90° gedreht einbauen)' : ''} — sofort beschriften!` }); }
      });
    });
    const colors = { board: '#5B8DB8', cut: '#2E7D5E', rip: '#9B6B9B', part: '#6B8F5E' };
    return `<div class="slabel" style="margin-bottom:14px">Schritt-für-Schritt Schnittanleitung</div>
      ${steps.map((s, i) => `<div class="step-card" style="border-left-color:${colors[s.type]}">
        <div class="step-num" style="color:${colors[s.type]}">Schritt ${i + 1}</div>
        <div class="step-action">${s.text}</div><div class="step-detail">${s.detail}</div>
      </div>`).join('')}`;
  }

  const resultHTML = $derived(cutlistInput.lastResult ? renderResultHTML(cutlistInput.lastResult) : '');
  const stepsHTML = $derived(cutlistInput.lastResult ? renderStepsHTML(cutlistInput.lastResult) : '');

  function onResultClick(e) {
    const w = e.target.closest('.vis-wrap');
    if (!w) return;
    const svg = w.querySelector('svg');
    if (!svg) return;
    const cap = w.parentElement.querySelector('.bvis-top');
    openZoom(svg.outerHTML, cap ? cap.innerText.replace(/\s+/g, ' ').trim() : 'Schnittplan');
  }

  // ── Projekte ──
  function buildProject(name) {
    return {
      name, saved: new Date().toLocaleDateString('de-DE'),
      stocks: JSON.parse(JSON.stringify(cutlistInput.stockData)),
      parts: JSON.parse(JSON.stringify(cutlistInput.partsData)),
      settings: { kerf: cutlistSettings.kerf, mode: cutlistSettings.mode, allowRotate: cutlistSettings.allowRotate, optmode: cutlistSettings.optmode }
    };
  }
  async function saveProj() {
    const name = projName.trim();
    if (!name) { showAlert('Bitte Projektnamen eingeben.', { title: 'Kein Name', icon: 'information' }); return; }
    const proj = buildProject(name);
    const res = saveProject(proj);
    if (res === 'exists') {
      const ok = await showConfirm('„' + name + '" überschreiben?', 'Das gespeicherte Projekt wird mit den aktuellen Eingaben überschrieben.', { confirmLabel: 'Überschreiben', icon: 'content_save' });
      if (!ok) return;
      saveProject(proj, true);
    }
    projName = '';
    showToast('Projekt gespeichert ✓');
  }
  async function loadProj(name) {
    const p = findProject(name);
    if (!p) return;
    const ok = await showConfirm('Projekt „' + name + '" laden?', 'Die aktuelle Eingabe (Bretter, Teile und Einstellungen) wird dabei überschrieben.', { confirmLabel: 'Laden', icon: 'folder_open' });
    if (!ok) return;
    cutlistInput.stockData = JSON.parse(JSON.stringify(p.stocks));
    cutlistInput.partsData = JSON.parse(JSON.stringify(p.parts));
    cutlistInput.partsData.forEach(x => { if (x.grain === undefined) x.grain = false; });
    cutlistInput.nextSId = Math.max(19, ...cutlistInput.stockData.map(x => x.id)) + 1;
    cutlistInput.nextPId = Math.max(19, ...cutlistInput.partsData.map(x => x.id)) + 1;
    if (p.settings) { cutlistSettings.kerf = p.settings.kerf ?? 3; cutlistSettings.mode = p.settings.mode || 'guillotine'; cutlistSettings.allowRotate = p.settings.allowRotate !== false; cutlistSettings.optmode = p.settings.optmode || 'waste'; }
    cutlistInput.grainEnabled = cutlistInput.partsData.some(x => x.grain);
    tab = 'input';
  }
  async function delProj(name) {
    const ok = await showConfirm('„' + name + '" löschen?', 'Das Projekt wird unwiderruflich gelöscht.', { confirmLabel: 'Löschen', danger: true, icon: 'delete' });
    if (!ok) return;
    deleteProject(name);
  }

  // ── PDF-Export ──
  function exportPDF() {
    if (!cutlistInput.lastResult) { showAlert('Bitte zuerst berechnen.', { title: 'Kein Ergebnis', icon: 'information' }); return; }
    loadJsPDF(() => { doExport().catch(err => { if (err?.name === 'AbortError') return; console.error(err); showAlert('PDF konnte nicht erstellt werden.', { title: 'Fehler', icon: 'alert_circle', danger: true }); }); });
  }
  async function doExport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const { expandedBoards, assignment, unplaced, kerf } = cutlistInput.lastResult;
    const usedBoards = expandedBoards.filter(b => assignment.some(a => a.boardIdx === b.boardIdx));
    let y = 15; const lm = 15, pw = 180;
    const checkY = n => { if (y + n > 272) { doc.addPage(); y = 15; } };
    const pdfTxt = t => t.replace(/→/g, '->').replace(/↻/g, '(ged.)').replace(/—/g, '-').replace(/–/g, '-').replace(/·/g, '-').replace(/[^\x00-\xFF]/g, '?');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    const titleOff = await addLogoToDoc(doc, lm, y);
    doc.text('betterKerf — Schnittplan', lm + titleOff, y); y += 9;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0);
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')} | Kerf: ${kerf} mm | Einheit: ${unitLabel()}`, lm, y); y += 11; doc.setTextColor(0);
    const usedArea = assignment.reduce((s, a) => s + a.part.L * a.part.W, 0);
    const usedBoardsArea = usedBoards.reduce((s, b) => s + b.L * b.W, 0);
    checkY(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Zusammenfassung', lm, y); y += 6;
    const wasteP = usedBoardsArea ? Math.round((usedBoardsArea - usedArea) / usedBoardsArea * 100) : 0;
    const totalParts = assignment.length + unplaced.length;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const unplacedPart = unplaced.length ? `   Nicht platziert: ${unplaced.length}` : '';
    doc.text(`Bretter genutzt: ${usedBoards.length}   Teile verteilt: ${assignment.length}/${totalParts}   Verschnitt: ${wasteP}%${unplacedPart}`, lm, y); y += 10;
    checkY(10 + cutlistInput.stockData.length * 5); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Brettverbrauch', lm, y); y += 6; doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    cutlistInput.stockData.forEach(s => { const n = { L: Math.max(s.l, s.w), W: Math.min(s.l, s.w) }; const used = usedBoards.filter(b => b.stockId === s.id).length; doc.text(`- ${pdfTxt(s.name)}: ${dispVal(n.L)} x ${dispUnit(n.W)} - ${used} von ${s.qty || 1} verwendet`, lm + 4, y); y += 5; }); y += 4;
    checkY(10 + cutlistInput.partsData.length * 5); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Benötigte Teile', lm, y); y += 6; doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    cutlistInput.partsData.forEach(p => { const n = { L: Math.max(p.l, p.w), W: Math.min(p.l, p.w) }; doc.text(`- ${pdfTxt(p.name)}: ${dispVal(n.L)} x ${dispUnit(n.W)} - ${p.qty || 1} Stück${p.grain ? ' (Faser fix)' : ''}`, lm + 4, y); y += 5; }); y += 6;

    const visBlocks = resultEl ? resultEl.querySelectorAll('.bvis') : [];
    if (visBlocks.length) {
      checkY(14); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Schnittpläne', lm, y); y += 6;
      for (const block of visBlocks) {
        const svg = block.querySelector('svg');
        if (!svg) continue;
        const topSpans = [...((block.querySelector('.bvis-top') || {}).querySelectorAll?.('span') || [])];
        const topText = topSpans.length ? topSpans.map(s => (s.innerText || s.textContent || '').trim()).join('  ') : ((block.querySelector('.bvis-top') || {}).textContent || '');
        let png = null;
        try { png = await svgToPng(svg, 3, true); } catch (e) { png = null; }
        if (png) {
          const imgW = pw, imgH = imgW * (png.h / png.w);
          checkY(imgH + 8);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
          doc.text(doc.splitTextToSize(pdfTxt(topText.replace(/\s+/g, ' ').trim()), pw), lm, y); y += 5;
          doc.addImage(png.data, 'PNG', lm, y, imgW, imgH, undefined, 'FAST');
          y += imgH + 3;
          const legendItems = [...block.querySelectorAll('.legend-item')];
          if (legendItems.length) {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
            let lx = lm;
            for (const item of legendItems) {
              const dot = item.querySelector('.legend-dot');
              const name = (item.innerText || item.textContent).trim();
              if (dot) { const rgb = dot.style.background || '#999'; doc.setFillColor(rgb); doc.rect(lx, y - 2, 3, 3, 'F'); }
              doc.setTextColor(60); doc.text(pdfTxt(name), lx + 4, y);
              lx += name.length * 3.8 + 10;
              if (lx > lm + pw - 20) { lx = lm; y += 4; }
            }
            doc.setTextColor(0); y += 6;
          }
        }
      }
      y += 2;
    }

    checkY(24); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Schnittliste', lm, y); y += 6;
    const cols = [8, 52, 26, 26, 36, 32]; const heads = ['#', 'Teil', `Länge (${unitLabel()})`, `Breite (${unitLabel()})`, 'Brett', `Position (${unitLabel()})`];
    doc.setFillColor(213, 229, 223); doc.rect(lm, y - 5, pw, 7, 'F'); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    let x = lm; heads.forEach((h, i) => { doc.text(h, x + 1, y - 1); x += cols[i]; }); y += 4; doc.setFont('helvetica', 'normal');
    assignment.forEach((a, i) => { checkY(6); if (i % 2 === 0) { doc.setFillColor(245, 249, 247); doc.rect(lm, y - 3.5, pw, 5.5, 'F'); } let xi = lm; const bn = a.boardQty > 1 ? `${a.boardName} (${a.boardInst})` : a.boardName;[String(i + 1), pdfTxt(a.part.name) + (a.part.qty > 1 ? ' #' + a.part.instance : '') + (a.rotated ? ' (gedreht)' : ''), dispVal(a.part.L), dispVal(a.part.W), pdfTxt(bn), dispVal(a.x) + ' x ' + dispVal(a.y)].forEach((v, ci) => { doc.text(String(v), xi + 1, y); xi += cols[ci]; }); y += 5.5; }); y += 8;
    checkY(22); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Schnittanleitung', lm, y); y += 6; doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const cards = stepsEl ? stepsEl.querySelectorAll('.step-card') : [];
    cards.forEach((s, i) => { const title = pdfTxt(s.querySelector('.step-action').innerText); const detail = pdfTxt(s.querySelector('.step-detail').innerText); const lines = doc.splitTextToSize(detail, pw - 6); checkY(7 + lines.length * 4 + 4); doc.setFont('helvetica', 'bold'); doc.text(`Schritt ${i + 1}: ${title}`, lm, y); y += 4.5; doc.setFont('helvetica', 'normal'); doc.setTextColor(100); doc.text(lines, lm + 4, y); y += lines.length * 4 + 4; doc.setTextColor(0); });
    // On iOS, doc.save() triggers a programmatic blob-link click which causes
    // Safari to zoom the page. Use the Web Share API instead — it opens the
    // native share/save sheet without triggering a download and thus no zoom.
    await savePDF(doc, 'betterkerf-schnittplan.pdf');
  }

  // ── Tab-Swipe (innerhalb des Moduls; linker Rand bleibt der App für „Zurück") ──
  let sx = 0, sy = 0, armed = false;
  function onTouchStart(e) { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; armed = sx > 30; }
  function onTouchEnd(e) {
    if (!armed) return; armed = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const cur = visibleTabs.indexOf(tab);
    const next = dx < 0 ? cur + 1 : cur - 1;
    if (next >= 0 && next < visibleTabs.length) tab = visibleTabs[next];
  }
</script>

<div class="screen-inner" style="flex:1;display:flex;flex-direction:column;min-height:0" ontouchstart={onTouchStart} ontouchend={onTouchEnd} role="presentation">
  <div class="tabs">
    <button class="tab" class:active={tab === 'input'} onclick={() => tab = 'input'}>Eingabe</button>
    <button class="tab" class:active={tab === 'projects'} onclick={() => tab = 'projects'}>Projekte</button>
    {#if cutlistInput.hasResult}<button class="tab" class:active={tab === 'result'} onclick={() => tab = 'result'}>Schnittplan</button>{/if}
    {#if cutlistInput.hasResult}<button class="tab" class:active={tab === 'steps'} onclick={() => tab = 'steps'}>Anleitung</button>{/if}
  </div>

  <!-- EINGABE -->
  <div class="pane" class:active={tab === 'input'}>
    <div class="section">
      <div class="slabel-row"><div class="slabel">Verfügbare Bretter</div><button class="edit-toggle" class:on={editStock} onclick={toggleEditStock}>{editStock ? 'Fertig' : 'Sortieren'}</button></div>
      <div class="hint-box">Maße in beliebiger Reihenfolge — die längere Seite wird automatisch als Länge erkannt.</div>
      {#if cutlistInput.stockData.length}
      <div class="col-hd {stockCls}">
        {#if editStock}<span></span>{/if}
        <span>Bezeichnung</span><span>Maß A {unitLabel()}</span><span>Maß B {unitLabel()}</span><span>Stk.</span>
        {#if editStock}<span></span>{/if}<span></span>
      </div>
      {/if}
      <div id="cut-stock-list">
        {#each cutlistInput.stockData as b (b.id)}
          <div class="row {stockCls}">
            {#if editStock}<div class="drag-handle" onpointerdown={(e) => startDrag(e, 'stock')} role="button" tabindex="-1" aria-label="Verschieben">≡</div>{/if}
            <input value={escQ(b.name)} oninput={(e) => setStock(b.id, 'name', e.target.value)} placeholder="Name" autocomplete="off" autocorrect="off">
            <input type="number" inputmode="decimal" {step} value={inputVal(b.l)} min="0" oninput={(e) => setStock(b.id, 'l', toMM(e.target.value))}>
            <input type="number" inputmode="decimal" {step} value={inputVal(b.w)} min="0" oninput={(e) => setStock(b.id, 'w', toMM(e.target.value))}>
            <input type="number" inputmode="numeric" value={b.qty || 1} min="1" max="99" oninput={(e) => setStock(b.id, 'qty', +e.target.value)}>
            {#if editStock}<button class="dup-btn" onclick={() => dupStock(b.id)} title="Duplizieren">⧉</button>{/if}
            <button class="del-btn" onclick={() => delStock(b.id)}>×</button>
          </div>
        {/each}
      </div>
      <button class="add-btn" onclick={addStock}>+ Brett hinzufügen</button>
    </div>

    <div class="section">
      <div class="slabel-row"><div class="slabel">Benötigte Teile</div><button class="edit-toggle" class:on={editParts} onclick={toggleEditParts}>{editParts ? 'Fertig' : 'Sortieren'}</button></div>
      {#if cutlistInput.partsData.length}
      <div class="col-hd {partsCls}">
        {#if editParts}<span></span>{/if}
        <span>Bezeichnung</span><span>Maß A {unitLabel()}</span><span>Maß B {unitLabel()}</span><span>Stk.</span>
        {#if cutlistInput.grainEnabled}<span>Faser</span>{/if}{#if editParts}<span></span>{/if}<span></span>
      </div>
      {/if}
      <div id="cut-parts-list">
        {#each cutlistInput.partsData as p (p.id)}
          <div class="row {partsCls}">
            {#if editParts}<div class="drag-handle" onpointerdown={(e) => startDrag(e, 'parts')} role="button" tabindex="-1" aria-label="Verschieben">≡</div>{/if}
            <input value={escQ(p.name)} oninput={(e) => setPart(p.id, 'name', e.target.value)} placeholder="Name" autocomplete="off" autocorrect="off">
            <input type="number" inputmode="decimal" {step} value={inputVal(p.l)} min="0" oninput={(e) => setPart(p.id, 'l', toMM(e.target.value))}>
            <input type="number" inputmode="decimal" {step} value={inputVal(p.w)} min="0" oninput={(e) => setPart(p.id, 'w', toMM(e.target.value))}>
            <input type="number" inputmode="numeric" value={p.qty || 1} min="1" max="99" oninput={(e) => setPart(p.id, 'qty', +e.target.value)}>
            {#if cutlistInput.grainEnabled}<button class="grain-btn{p.grain ? ' locked' : ''}" onclick={() => toggleGrain(p.id)} title={p.grain ? 'Maserung fixiert – keine Drehung' : 'Maserung egal – Drehung erlaubt'}>{p.grain ? '↕' : '⤢'}</button>{/if}
            {#if editParts}<button class="dup-btn" onclick={() => dupPart(p.id)} title="Duplizieren">⧉</button>{/if}
            <button class="del-btn" onclick={() => delPart(p.id)}>×</button>
          </div>
        {/each}
      </div>
      <button class="add-btn" onclick={addPart}>+ Teil hinzufügen</button>
      {#if isEmpty}<button class="example-btn" onclick={loadExample}>Beispieldaten laden</button>{/if}
      {#if cutlistInput.partsData.length}
      <div class="srow" style="margin-top:10px"><div><div class="srow-label">Maserungsrichtung beachten</div><div class="srow-hint">Pro Teil festlegen, ob es gedreht werden darf</div></div><input type="checkbox" class="toggle" bind:checked={cutlistInput.grainEnabled} onchange={toggleGrainMode}></div>
      {/if}
    </div>

    <button class="calc-btn" onclick={calculate}>▶ Zuschnitt berechnen</button>
    <button class="action-btn" onclick={resetToExample}><Icon name="restart_alt" size={16} /> Zurücksetzen</button>
  </div>

  <!-- PROJEKTE -->
  <div class="pane" class:active={tab === 'projects'}>
    <div class="slabel">Projekt speichern</div>
    <div class="save-row"><input bind:value={projName} placeholder="Projektname eingeben…" autocomplete="off" autocorrect="off"><button class="save-btn" onclick={saveProj}>Speichern</button></div>
    <div class="slabel" style="margin-top:18px">Gespeicherte Projekte</div>
    <div>
      {#if !projects.list.length}
        <div class="empty-proj">Noch keine Projekte gespeichert.<br>Daten bleiben lokal auf diesem Gerät.</div>
      {:else}
        {#each projects.list as p (p.name)}
          <div class="proj-item">
            <div><div class="proj-name">{p.name}</div><div class="proj-meta">{p.saved} · {p.stocks.length} Brett-Typ(en) · {p.parts.length} Teil(e)</div></div>
            <div class="proj-btns"><button class="btn-load" onclick={() => loadProj(p.name)}>Laden</button><button class="btn-del" onclick={() => delProj(p.name)}>×</button></div>
          </div>
        {/each}
      {/if}
    </div>
    <div class="info-note">Projekte werden lokal auf diesem Gerät gespeichert und bleiben auch offline verfügbar.</div>
  </div>

  <!-- SCHNITTPLAN -->
  <div class="pane" class:active={tab === 'result'}>
    {#if optimizing}
      <div class="opt-panel">
        <div class="opt-ring-wrap">
          <svg class="opt-ring" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r={RING_R} fill="none" stroke="var(--border2)" stroke-width="4" />
            <circle cx="24" cy="24" r={RING_R} fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-dasharray={RING_C.toFixed(1)} stroke-dashoffset={(RING_C * (1 - optFrac)).toFixed(1)} transform="rotate(-90 24 24)" />
          </svg>
        </div>
        <div class="opt-text">Optimierung läuft …</div>
        <button class="opt-stop" onclick={stopOpt}>Jetzt übernehmen</button>
      </div>
    {:else if optDone}
      <div class="opt-done">✓ {optAccepted ? 'Übernommen' : 'Optimierung abgeschlossen'}</div>
    {/if}
    <div bind:this={resultEl} onclick={onResultClick} role="presentation">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html resultHTML}
    </div>
    {#if cutlistInput.hasResult}
      <button class="action-btn" onclick={exportPDF}><Icon name="download" size={16} /> Als PDF exportieren</button>
    {/if}
  </div>

  <!-- ANLEITUNG -->
  <div class="pane" class:active={tab === 'steps'}>
    <div bind:this={stepsEl}>
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html stepsHTML}
    </div>
    {#if cutlistInput.hasResult}
      <button class="action-btn" onclick={exportPDF}><Icon name="download" size={16} /> Als PDF exportieren</button>
    {/if}
  </div>
</div>
