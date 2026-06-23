<script>
  import Icon from '../lib/Icon.svelte';
  import InfoSheet from '../lib/InfoSheet.svelte';
  import { units, UNITS, unitLabel, dispVal, toMM, inputVal } from '../lib/units.svelte.js';
  import { showConfirm, showAlert, showToast } from '../lib/dialog.svelte.js';
  import { loadJsPDF, svgToPng } from '../lib/pdf.js';
  import { korpusGeometry, korpusGuide, korpusSketch, computeShelfPositions, computeDivPositions } from '../lib/korpus.js';
  import { korpusProjects, saveKorpusProject, findKorpusProject, deleteKorpusProject } from '../lib/korpusProjects.svelte.js';
  import { handoff } from '../lib/handoff.svelte.js';
  import { nav } from '../lib/nav.svelte.js';
  import { openZoom } from '../lib/zoom.svelte.js';
  import { korpusInput } from '../lib/korpusInput.svelte.js';

  const ki = korpusInput;

  let tab = $state('input');          // 'input' | 'projects' | 'guide'
  let projName = $state('');
  let showBackInfo = $state(false), showConstrInfo = $state(false);
  let sketchEl = $state(null);

  // ── Maße in mm ──
  const H = $derived(toMM(ki.kpH)), B = $derived(toMM(ki.kpB)), T = $derived(toMM(ki.kpT));
  const s = $derived(toMM(ki.kpS) || 18), sr = $derived(toMM(ki.kpSr) || 5), nut = $derived((toMM(ki.kpSr) || 5) + 1);
  const shelvesN = $derived(Math.max(0, parseInt(ki.shelves) || 0));
  const dividersN = $derived(Math.max(0, parseInt(ki.dividers) || 0));
  const innerH = $derived(Math.max(0, H - 2 * s));
  const innerW = $derived(Math.max(0, B - 2 * s));

  // Custom-Status-Arrays an die Anzahl anpassen
  $effect(() => {
    if (shelvesN === 0) { if (ki.kpShelfCustom) ki.kpShelfCustom = false; if (ki.kpShelfStates.length) ki.kpShelfStates = []; return; }
    if (ki.kpShelfCustom && ki.kpShelfStates.length !== shelvesN + 1) {
      const old = ki.kpShelfStates;
      ki.kpShelfStates = Array.from({ length: shelvesN + 1 }, (_, i) => old[i] || { fixed: false, posMM: 0, disp: '' });
    }
  });
  $effect(() => {
    if (dividersN === 0) { if (ki.kpDivCustom) ki.kpDivCustom = false; if (ki.kpDivStates.length) ki.kpDivStates = []; return; }
    if (ki.kpDivCustom && ki.kpDivStates.length !== dividersN + 1) {
      const old = ki.kpDivStates;
      ki.kpDivStates = Array.from({ length: dividersN + 1 }, (_, i) => old[i] || { fixed: false, posMM: 0, disp: '' });
    }
  });

  const shelfComputed = $derived(ki.kpShelfStates.length ? computeShelfPositions(ki.kpShelfStates, innerH, s) : []);
  const divComputed = $derived(ki.kpDivStates.length ? computeDivPositions(ki.kpDivStates, innerW, s) : []);
  const shelfPos = $derived(ki.kpShelfCustom && ki.kpShelfStates.length > 0 ? shelfComputed : null);
  const divPos = $derived(ki.kpDivCustom && ki.kpDivStates.length > 0 ? divComputed : null);

  // ── Berechnung (rein reaktiv) ──
  const calc = $derived.by(() => {
    if (H <= 0 || B <= 0 || T <= 0) return { state: 'empty' };
    if (2 * s >= B || 2 * s >= H) return { state: 'warn', head: '⚠️ Maße prüfen', hint: 'Die Plattenstärke ist zu groß für die angegebenen Außenmaße. Bitte Werte korrigieren.' };
    if (dividersN > 0 && (B - 2 * s - dividersN * s) / (dividersN + 1) < 10) return { state: 'warn', head: '⚠️ Zu viele Trennwände', hint: `Bei dieser Breite bleibt für ${dividersN + 1} Fächer kein sinnvoller Platz. Reduziere die Anzahl der Trennwände oder vergrößere die Breite.` };
    return { state: 'ok', parts: korpusGeometry(H, B, T, s, sr, ki.kpConstr, ki.kpBack, nut, shelvesN, dividersN) };
  });
  const kpParts = $derived(calc.state === 'ok' ? calc.parts : []);
  const hasGuide = $derived(calc.state === 'ok');
  const sketchHTML = $derived(calc.state === 'ok' ? korpusSketch(H, B, T, s, sr, ki.kpConstr, ki.kpBack, nut, shelvesN, dividersN, shelfPos, divPos) : '');
  const guideSteps = $derived(calc.state === 'ok' ? korpusGuide(ki.kpConstr, ki.kpBack, nut, shelvesN, dividersN, shelfPos, ki.kpShelfCustom, ki.kpShelfStates) : []);
  const totalPieces = $derived(kpParts.reduce((a, p) => a + p.qty, 0));
  const totalAreaStr = $derived((kpParts.reduce((a, p) => a + p.l * p.w * p.qty, 0) / 1e6).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  const shelvesLabel = $derived(dividersN > 0 ? 'Einlegeböden je Fach' : 'Einlegeböden');
  const shelvesHint = $derived(dividersN > 0 ? `Pro Fach — bei ${dividersN + 1} Fächern ergibt das ${shelvesN * (dividersN + 1)} Böden` : 'Anzahl loser Böden im Korpus');
  const visibleTabs = $derived(['input', 'projects', ...(hasGuide ? ['guide'] : [])]);

  // Wenn der Anleitungs-Tab verschwindet, nicht darauf hängen bleiben
  $effect(() => { if (tab === 'guide' && !hasGuide) tab = 'input'; });

  // ── Einheitenwechsel: Eingaben umrechnen ──
  let prevU = units.current;
  $effect(() => {
    const u = units.current;
    if (u === prevU) return;
    const oldF = UNITS[prevU].f;
    const conv = v => { if (v === '' || v == null) return v; const mm = (parseFloat(String(v).replace(',', '.')) || 0) * oldF; return mm ? inputVal(mm) : ''; };
    ki.kpH = conv(ki.kpH); ki.kpB = conv(ki.kpB); ki.kpT = conv(ki.kpT); ki.kpS = conv(ki.kpS); ki.kpSr = conv(ki.kpSr);
    ki.kpShelfStates.forEach(st => { if (st.fixed) st.disp = st.posMM ? String(inputVal(st.posMM)) : ''; });
    ki.kpDivStates.forEach(st => { if (st.fixed) st.disp = st.posMM ? String(inputVal(st.posMM)) : ''; });
    prevU = u;
  });

  // ── Custom-Positionen: Lock-Umschalten & Eingabe ──
  function toggleShelfFixed(i) {
    const st = ki.kpShelfStates[i]; if (!st) return;
    if (!st.fixed) { const c = computeShelfPositions(ki.kpShelfStates, innerH, s); st.fixed = true; st.posMM = c[i]; st.disp = String(inputVal(c[i])); }
    else { st.fixed = false; st.posMM = 0; st.disp = ''; }
  }
  function setShelfPos(i, val) { const st = ki.kpShelfStates[i]; if (st) { st.disp = val; st.posMM = toMM(val); } }
  function toggleDivFixed(i) {
    const st = ki.kpDivStates[i]; if (!st) return;
    if (!st.fixed) { const c = computeDivPositions(ki.kpDivStates, innerW, s); st.fixed = true; st.posMM = c[i]; st.disp = String(inputVal(c[i])); }
    else { st.fixed = false; st.posMM = 0; st.disp = ''; }
  }
  function setDivPos(i, val) { const st = ki.kpDivStates[i]; if (st) { st.disp = val; st.posMM = toMM(val); } }

  const backInfoItems = [
    { title: 'Eingenutet', html: 'Die Rückwand sitzt in einer umlaufenden Nut, die in Seiten, Boden und Deckel gefräst wird. Sie ist von außen unsichtbar und der Korpus wirkt rundum geschlossen. Etwas aufwändiger in der Fertigung, da die Nut exakt sitzen muss. <strong>Die Nuttiefe wird automatisch berechnet: Rückwandstärke + 1 mm.</strong>' },
    { title: 'Eingelassen', html: 'Wie eingenutet, aber ohne Nut: Die Rückwand wird bündig zwischen Seiten, Boden und Deckel eingesetzt und dort verleimt oder verschraubt. Einfacher zu bauen als die genutete Variante, bei loser Befestigung aber etwas weniger formstabil.' },
    { title: 'Aufgesetzt', html: 'Die Rückwand wird von hinten auf den fertigen Korpus aufgeschraubt oder genagelt und deckt die komplette Außenfläche ab. Am einfachsten zu fertigen und gleichzeitig sehr formstabil, da sie den Korpus wie eine Diagonal-Aussteifung stabilisiert. Von hinten ist die Plattenkante sichtbar.' },
    { title: 'Keine', html: 'Der Korpus bleibt hinten offen — etwa für Raumteiler, offene Regale oder wenn die Rückwand separat (z. B. aus einem anderen Material) ergänzt wird. Ohne Rückwand fehlt die Aussteifung gegen Verschieben; bei freistehenden Möbeln meist nicht empfehlenswert.' }
  ];
  const constrInfoItems = [
    { title: 'Seiten durchgehend', html: 'Die beiden Seitenteile laufen über die volle Korpushöhe. Boden und Deckel sitzen dazwischen und werden entsprechend schmaler zugeschnitten. Diese Bauweise ist die klassische Regal- und Schrankkonstruktion — von der Seite sind Boden und Deckel als Stirnkante sichtbar.' },
    { title: 'Boden/Deckel durchgehend', html: 'Boden und Deckel laufen über die volle Korpusbreite, die Seitenteile sitzen dazwischen und werden entsprechend kürzer zugeschnitten. Von vorne sind Boden- und Deckelkante sichtbar, dafür wirkt der Korpus oben und unten durchgängig — praktisch z. B. bei Sideboards mit sichtbarer Deckplatte.' }
  ];

  // ── Reset ──
  async function korpusReset() {
    const ok = await showConfirm('Korpusplaner zurücksetzen?', 'Alle eingegebenen Maße werden auf die Standardwerte zurückgesetzt.', { confirmLabel: 'Zurücksetzen', danger: true, icon: 'restart_alt' });
    if (!ok) return;
    ki.reset();
    tab = 'input';
  }

  // ── Projekte ──
  function buildProject(name) {
    return {
      name, saved: new Date().toLocaleDateString('de-DE'),
      dims: { H: toMM(ki.kpH), B: toMM(ki.kpB), T: toMM(ki.kpT), s: toMM(ki.kpS), sr: toMM(ki.kpSr) },
      shelves: parseInt(ki.shelves) || 0, dividers: parseInt(ki.dividers) || 0,
      constr: ki.kpConstr, back: ki.kpBack,
      shelfCustom: ki.kpShelfCustom, shelfStates: ki.kpShelfCustom ? ki.kpShelfStates.map(st => ({ fixed: st.fixed, posMM: st.posMM })) : [],
      divCustom: ki.kpDivCustom, divStates: ki.kpDivCustom ? ki.kpDivStates.map(st => ({ fixed: st.fixed, posMM: st.posMM })) : []
    };
  }
  async function saveProj() {
    const name = projName.trim();
    if (!name) { showAlert('Bitte Projektnamen eingeben.', { title: 'Kein Name', icon: 'information' }); return; }
    const proj = buildProject(name);
    if (!proj.dims.H || !proj.dims.B || !proj.dims.T) { showAlert('Bitte zuerst gültige Außenmaße eingeben.', { title: 'Fehlende Maße', icon: 'information' }); return; }
    const res = saveKorpusProject(proj);
    if (res === 'exists') {
      const ok = await showConfirm('„' + name + '" überschreiben?', 'Das gespeicherte Projekt wird mit den aktuellen Eingaben überschrieben.', { confirmLabel: 'Überschreiben', icon: 'content_save' });
      if (!ok) return;
      saveKorpusProject(proj, true);
    }
    projName = '';
    showToast('Projekt gespeichert ✓');
  }
  async function loadProj(name) {
    const p = findKorpusProject(name); if (!p) return;
    const ok = await showConfirm('Projekt „' + name + '" laden?', 'Die aktuelle Eingabe wird dabei überschrieben.', { confirmLabel: 'Laden', icon: 'folder_open' });
    if (!ok) return;
    ki.kpH = p.dims.H ? inputVal(p.dims.H) : ''; ki.kpB = p.dims.B ? inputVal(p.dims.B) : ''; ki.kpT = p.dims.T ? inputVal(p.dims.T) : '';
    ki.kpS = p.dims.s ? inputVal(p.dims.s) : ''; ki.kpSr = p.dims.sr ? inputVal(p.dims.sr) : '';
    ki.shelves = p.shelves || 0; ki.dividers = p.dividers || 0;
    ki.kpConstr = p.constr || 'sides'; ki.kpBack = p.back || 'inset';
    ki.kpShelfCustom = p.shelfCustom || false;
    ki.kpShelfStates = (p.shelfStates || []).map(st => ({ fixed: !!st.fixed, posMM: st.posMM || 0, disp: st.fixed && st.posMM ? String(inputVal(st.posMM)) : '' }));
    ki.kpDivCustom = p.divCustom || false;
    ki.kpDivStates = (p.divStates || []).map(st => ({ fixed: !!st.fixed, posMM: st.posMM || 0, disp: st.fixed && st.posMM ? String(inputVal(st.posMM)) : '' }));
    tab = 'input';
  }
  async function delProj(name) {
    const ok = await showConfirm('„' + name + '" löschen?', 'Das Projekt wird unwiderruflich gelöscht.', { confirmLabel: 'Löschen', danger: true, icon: 'delete' });
    if (!ok) return;
    deleteKorpusProject(name);
  }

  function projDesc(p) {
    return `${dispVal(p.dims.H)}×${dispVal(p.dims.B)}×${dispVal(p.dims.T)} ${unitLabel()}` + (p.dividers ? ` · ${p.dividers} Trennw.` : '') + (p.shelves ? ` · ${p.shelves} Böden` : '');
  }

  // ── An Zuschnitt-Optimierer übergeben ──
  function toCutlist() {
    if (!kpParts.length) { showAlert('Bitte zuerst gültige Außenmaße eingeben.', { title: 'Fehlende Maße', icon: 'information' }); return; }
    let id = 1;
    const parts = kpParts.map(p => ({ id: id++, name: p.name, l: Math.round(p.l * 10) / 10, w: Math.round(p.w * 10) / 10, qty: p.qty, grain: false }));
    handoff.sendToCutlist(parts);
    nav.request('cutlist');
  }

  // ── PDF ──
  function korpusPDF() {
    if (!kpParts.length) { showAlert('Bitte zuerst gültige Außenmaße eingeben.', { title: 'Fehlende Maße', icon: 'information' }); return; }
    loadJsPDF(() => { korpusDoPDF().catch(e => { console.error(e); showAlert('PDF konnte nicht erstellt werden.', { title: 'Fehler', icon: 'alert_circle', danger: true }); }); });
  }
  async function korpusDoPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const u = unitLabel();
    let y = 15; const lm = 15, pw = 180;
    const checkY = k => { if (y + k > 278) { doc.addPage(); y = 15; } };
    const pdfTxt = t => String(t).replace(/→/g, '->').replace(/—/g, '-').replace(/–/g, '-').replace(/·/g, '-').replace(/×/g, 'x').replace(/[^\x00-\xFF]/g, '?');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('betterKerf — Korpus', lm, y); y += 9;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 110, 100);
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')}  |  Einheit: ${u}`, lm, y); y += 11; doc.setTextColor(0);

    doc.setFillColor(245, 237, 214); doc.rect(lm, y - 5, pw, 12, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(`Außenmaße: ${dispVal(H)} x ${dispVal(B)} x ${dispVal(T)} ${u}  (HxBxT)`, lm + 3, y + 3);
    y += 15; doc.setTextColor(0);

    const constrTxt = ki.kpConstr === 'sides' ? 'Seiten durchgehend' : 'Boden/Deckel durchgehend';
    const backTxt = { inset: 'eingenutet', framed: 'eingelassen', overlay: 'aufgesetzt', none: 'keine' }[ki.kpBack];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    const cfg = `Plattenstärke ${dispVal(s)} ${u}  -  Konstruktion: ${constrTxt}  -  Rückwand: ${backTxt}${ki.kpBack !== 'none' ? ` (${dispVal(sr)} ${u}` + (ki.kpBack === 'inset' ? `, Nut ${dispVal(nut)} ${u} (auto)` : '') + ')' : ''}`;
    const cfgLines = doc.splitTextToSize(cfg, pw);
    doc.text(cfgLines, lm, y); y += 5 + (cfgLines.length > 1 ? 4 : 0);
    if (dividersN > 0 || shelvesN > 0) {
      let shelfTxt = `Trennwände: ${dividersN}  -  Einlegeböden: ${shelvesN * (dividersN + 1)}${dividersN > 0 ? ` (${shelvesN} je Fach)` : ''}`;
      if (shelfPos && ki.kpShelfStates.some(st => st.fixed)) {
        const fixedParts = ki.kpShelfStates.map((st, i) => st.fixed ? `B${i + 1}=${dispVal(shelfPos[i])}` : '').filter(Boolean);
        shelfTxt += `  -  Individuell: ${fixedParts.join(', ')} ${u}`;
      }
      const shelfLines = doc.splitTextToSize(shelfTxt, pw);
      doc.text(shelfLines, lm, y); y += shelfLines.length * 5;
    }
    y += 5;

    const svgEl = sketchEl ? sketchEl.querySelector('svg') : null;
    if (svgEl) {
      try {
        const png = await svgToPng(svgEl, 3);
        const maxW = pw, maxH = 80;
        let iw = png.w, ih = png.h; const r = Math.min(maxW / iw, maxH / ih); iw *= r; ih *= r;
        checkY(ih + 8);
        doc.addImage(png.data, 'PNG', lm + (pw - iw) / 2, y, iw, ih);
        y += ih + 8;
      } catch (e) { /* Skizze optional */ }
    }

    checkY(16);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Zuschnittliste', lm, y); y += 6;
    const cols = [96, 54, 30]; const heads = ['Bauteil', `Maß (${u})`, 'Anzahl'];
    doc.setFillColor(245, 237, 214); doc.rect(lm, y - 5, pw, 7, 'F'); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    let x = lm; heads.forEach((h, i) => { doc.text(h, x + 1, y - 1); x += cols[i]; }); y += 4; doc.setFont('helvetica', 'normal');
    kpParts.forEach((p, i) => {
      checkY(6); if (i % 2 === 0) { doc.setFillColor(252, 250, 246); doc.rect(lm, y - 3.5, pw, 5.5, 'F'); }
      let xi = lm;[pdfTxt(p.name), `${dispVal(p.l)} x ${dispVal(p.w)}`, `${p.qty}x`].forEach((v, ci) => { doc.text(String(v), xi + 1, y); xi += cols[ci]; }); y += 5.5;
    });
    y += 2; doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(`Gesamt: ${totalPieces} Teile  -  ${totalAreaStr} m² Plattenfläche`, lm, y); y += 10;
    doc.setFont('helvetica', 'normal');

    const guide = korpusGuide(ki.kpConstr, ki.kpBack, nut, shelvesN, dividersN, shelfPos, ki.kpShelfCustom, ki.kpShelfStates);
    checkY(14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Bau-Anleitung', lm, y); y += 7;
    doc.setFontSize(9.5);
    guide.forEach((g, i) => {
      const lines = doc.splitTextToSize(pdfTxt(g), pw - 9);
      checkY(lines.length * 4.6 + 3);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(46, 125, 94); doc.text(`${i + 1}.`, lm, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40);
      doc.text(lines, lm + 7, y);
      y += lines.length * 4.6 + 3;
    });
    doc.setTextColor(0);
    doc.setFontSize(8); doc.setTextColor(150, 140, 130);
    doc.text('Maße als Zuschnittmaße der Einzelteile. Verbindungsmittel (Dübel, Lamello o.ä.) nach eigener Konstruktion.', lm, 289);
    doc.save('betterkerf-korpus.pdf');
  }

  // ── Tab-Swipe ──
  let sxv = 0, syv = 0, armed = false;
  function onTouchStart(e) { const t = e.touches[0]; sxv = t.clientX; syv = t.clientY; armed = sxv > 30; }
  function onTouchEnd(e) {
    if (!armed) return; armed = false;
    const dx = e.changedTouches[0].clientX - sxv, dy = e.changedTouches[0].clientY - syv;
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
    {#if hasGuide}<button class="tab" class:active={tab === 'guide'} onclick={() => tab = 'guide'}>Anleitung</button>{/if}
  </div>

  <!-- EINGABE -->
  <div class="pane" class:active={tab === 'input'}>
    <div class="section">
      <div class="slabel">Außenmaße</div>
      <div class="hint-box">Die fertigen Außenmaße des Korpus. Die App berechnet daraus die Zuschnittmaße der Einzelteile.</div>
      <div class="kp-dims">
        <div class="kp-field"><label for="kp-h">Höhe <span class="ku">{unitLabel()}</span></label><input id="kp-h" type="number" inputmode="decimal" bind:value={ki.kpH} placeholder="0"></div>
        <div class="kp-field"><label for="kp-b">Breite <span class="ku">{unitLabel()}</span></label><input id="kp-b" type="number" inputmode="decimal" bind:value={ki.kpB} placeholder="0"></div>
        <div class="kp-field"><label for="kp-t">Tiefe <span class="ku">{unitLabel()}</span></label><input id="kp-t" type="number" inputmode="decimal" bind:value={ki.kpT} placeholder="0"></div>
      </div>
    </div>

    <div class="section">
      <div class="slabel">Material</div>
      <div class="kp-dims kp-dims-2">
        <div class="kp-field"><label for="kp-s">Plattenstärke <span class="ku">{unitLabel()}</span></label><input id="kp-s" type="number" inputmode="decimal" bind:value={ki.kpS} placeholder="18"></div>
        <div class="kp-field"><label for="kp-sr">Rückwandstärke <span class="ku">{unitLabel()}</span></label><input id="kp-sr" type="number" inputmode="decimal" bind:value={ki.kpSr} placeholder="5"></div>
      </div>
    </div>

    <div class="section">
      <div class="slabel-row"><div class="slabel">Konstruktion</div><button class="info-btn" onclick={() => showConstrInfo = true} aria-label="Erklärung zur Konstruktionsart">ⓘ</button></div>
      <div class="kp-seg-label">Verbindung Seiten / Boden &amp; Deckel</div>
      <div class="cost-seg kp-seg">
        <button class:on={ki.kpConstr === 'sides'} onclick={() => ki.kpConstr = 'sides'}>Seiten durchgehend</button>
        <button class:on={ki.kpConstr === 'topbot'} onclick={() => ki.kpConstr = 'topbot'}>Boden/Deckel durchgehend</button>
      </div>
    </div>

    <div class="section">
      <div class="slabel-row"><div class="slabel">Rückwand</div><button class="info-btn" onclick={() => showBackInfo = true} aria-label="Erklärung zu den Rückwand-Varianten">ⓘ</button></div>
      <div class="kp-seg-label">Befestigung &amp; Einbauart der Rückwand</div>
      <div class="cost-seg kp-seg kp-seg-4">
        <button class:on={ki.kpBack === 'inset'} onclick={() => ki.kpBack = 'inset'}>eingenutet</button>
        <button class:on={ki.kpBack === 'framed'} onclick={() => ki.kpBack = 'framed'}>eingelassen</button>
        <button class:on={ki.kpBack === 'overlay'} onclick={() => ki.kpBack = 'overlay'}>aufgesetzt</button>
        <button class:on={ki.kpBack === 'none'} onclick={() => ki.kpBack = 'none'}>keine</button>
      </div>
      {#if ki.kpBack === 'inset'}<div class="srow-hint" style="margin-top:6px">Nuttiefe = Rückwandstärke + 1 mm (wird automatisch berechnet)</div>{/if}
    </div>

    <div class="section">
      <div class="srow"><div><div class="srow-label">Trennwände</div><div class="srow-hint">Senkrechte Trennwände teilen den Korpus in Fächer</div></div><div class="nm"><input type="number" inputmode="numeric" bind:value={ki.dividers} min="0" max="20"><span>Stk</span></div></div>
      {#if dividersN > 0}
        <div class="srow" style="margin-top:4px"><div><div class="srow-label">Fachbreiten</div><div class="srow-hint">Lichte Breite jedes Fachs selbst festlegen</div></div><input type="checkbox" class="toggle" bind:checked={ki.kpDivCustom}></div>
        {#if ki.kpDivCustom}
          <div style="margin-top:8px">
            {#each ki.kpDivStates as st, i (i)}
              <div class="srow">
                <div><div class="srow-label">Fach {i + 1}{i === ki.kpDivStates.length - 1 ? ' (rechts)' : ''}</div>
                  {#if st.fixed}<div class="srow-hint">{i === ki.kpDivStates.length - 1 ? 'Rechtestes Fach · Fachbreite individuell' : 'Fachbreite individuell · lichtes Maß'}</div>
                  {:else}<div class="srow-hint">Auto · Fachbreite: {dispVal(divComputed[i])} {unitLabel()}</div>{/if}
                </div>
                <div style="display:flex;align-items:center;gap:6px">
                  <button class="grain-btn{st.fixed ? ' locked' : ''}" onclick={() => toggleDivFixed(i)} title={st.fixed ? 'Zurück zu Auto' : 'Individuell festlegen'} style="font-size:17px;flex-shrink:0">{st.fixed ? '●' : '○'}</button>
                  <div class="nm">
                    {#if st.fixed}<input type="number" inputmode="decimal" value={st.disp} min="1" oninput={(e) => setDivPos(i, e.target.value)}>
                    {:else}<input type="number" inputmode="decimal" value={inputVal(divComputed[i])} disabled style="opacity:.45">{/if}
                    <span>{unitLabel()}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
      <div class="srow"><div><div class="srow-label">{shelvesLabel}</div><div class="srow-hint">{shelvesHint}</div></div><div class="nm"><input type="number" inputmode="numeric" bind:value={ki.shelves} min="0" max="50"><span>Stk</span></div></div>
      {#if shelvesN > 0}
        <div class="srow" style="margin-top:4px"><div><div class="srow-label">Fachhöhen</div><div class="srow-hint">Lichte Höhe jedes Fachs selbst festlegen</div></div><input type="checkbox" class="toggle" bind:checked={ki.kpShelfCustom}></div>
        {#if ki.kpShelfCustom}
          <div style="margin-top:8px">
            {#each ki.kpShelfStates as st, i (i)}
              <div class="srow">
                <div><div class="srow-label">Fach {i + 1}{i === ki.kpShelfStates.length - 1 ? ' (oben)' : ''}</div>
                  {#if st.fixed}<div class="srow-hint">{i === ki.kpShelfStates.length - 1 ? 'Oberstes Fach · Fachhöhe individuell' : 'Fachhöhe individuell · lichtes Maß'}</div>
                  {:else}<div class="srow-hint">Auto · Fachhöhe: {dispVal(shelfComputed[i])} {unitLabel()}</div>{/if}
                </div>
                <div style="display:flex;align-items:center;gap:6px">
                  <button class="grain-btn{st.fixed ? ' locked' : ''}" onclick={() => toggleShelfFixed(i)} title={st.fixed ? 'Zurück zu Auto' : 'Individuell festlegen'} style="font-size:17px;flex-shrink:0">{st.fixed ? '●' : '○'}</button>
                  <div class="nm">
                    {#if st.fixed}<input type="number" inputmode="decimal" value={st.disp} min="1" oninput={(e) => setShelfPos(i, e.target.value)}>
                    {:else}<input type="number" inputmode="decimal" value={inputVal(shelfComputed[i])} disabled style="opacity:.45">{/if}
                    <span>{unitLabel()}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>

    <div style="margin-top:6px">
      {#if calc.state === 'warn'}
        <div class="warn-box"><div class="warn-head">{calc.head}</div><div class="warn-hint">{calc.hint}</div></div>
      {:else if calc.state === 'ok'}
        <div class="section"><div class="slabel">Skizze</div>
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <div bind:this={sketchEl} style="cursor:zoom-in" role="button" tabindex="0" aria-label="Skizze vergrößern"
            onclick={() => { const svg = sketchEl?.querySelector('svg'); if (svg) { const c = svg.cloneNode(true); c.removeAttribute('width'); c.setAttribute('style', 'width:min(90vw,600px);height:auto'); openZoom(c.outerHTML, 'Korpus-Skizze'); } }}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { const svg = sketchEl?.querySelector('svg'); if (svg) { const c = svg.cloneNode(true); c.removeAttribute('width'); c.setAttribute('style', 'width:min(90vw,600px);height:auto'); openZoom(c.outerHTML, 'Korpus-Skizze'); } } }}
          >{@html sketchHTML}</div>
        </div>
        <div class="section"><div class="slabel">Zuschnittliste</div>
          <div class="kp-cut-head"><span>Bauteil</span><span>Maß ({unitLabel()})</span><span>Anz.</span></div>
          {#each kpParts as p}
            <div class="kp-cut-row"><span class="kp-cut-name">{p.name}</span><span class="kp-cut-dim">{dispVal(p.l)} × {dispVal(p.w)}</span><span class="kp-cut-qty">{p.qty}×</span></div>
          {/each}
        </div>
        <div class="stat-row">
          <div class="stat"><div class="stat-val">{totalPieces}</div><div class="stat-lbl">Teile</div></div>
          <div class="stat"><div class="stat-val">{totalAreaStr} m²</div><div class="stat-lbl">Plattenfläche</div></div>
        </div>
        <button class="calc-btn" style="margin-top:14px" onclick={toCutlist}>→ An Zuschnitt-Optimierer übergeben</button>
        <button class="action-btn" onclick={korpusPDF}><Icon name="download" size={16} /> Als PDF exportieren</button>
      {/if}
    </div>

    <button class="action-btn" style="margin-top:14px" onclick={korpusReset}><Icon name="restart_alt" size={16} /> Zurücksetzen</button>
  </div>

  <!-- ANLEITUNG -->
  <div class="pane" class:active={tab === 'guide'}>
    {#if hasGuide}
      <div class="section"><div class="slabel">Bau-Anleitung</div>
        <div class="kp-guide">
          {#each guideSteps as g, i}
            <div class="kp-step"><span class="kp-step-num">{i + 1}</span><span class="kp-step-txt">{g}</span></div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- PROJEKTE -->
  <div class="pane" class:active={tab === 'projects'}>
    <div class="slabel">Projekt speichern</div>
    <div class="save-row"><input bind:value={projName} placeholder="Projektname eingeben…" autocomplete="off" autocorrect="off"><button class="save-btn" onclick={saveProj}>Speichern</button></div>
    <div class="slabel" style="margin-top:18px">Gespeicherte Projekte</div>
    <div>
      {#if !korpusProjects.list.length}
        <div class="empty-proj">Noch keine Korpus-Projekte gespeichert.<br>Daten bleiben lokal auf diesem Gerät.</div>
      {:else}
        {#each korpusProjects.list as p (p.name)}
          <div class="proj-item">
            <div><div class="proj-name">{p.name}</div><div class="proj-meta">{p.saved} · {projDesc(p)}</div></div>
            <div class="proj-btns"><button class="btn-load" onclick={() => loadProj(p.name)}>Laden</button><button class="btn-del" onclick={() => delProj(p.name)}>×</button></div>
          </div>
        {/each}
      {/if}
    </div>
    <div class="info-note">Projekte werden lokal auf diesem Gerät gespeichert und bleiben auch offline verfügbar.</div>
  </div>
</div>

<InfoSheet bind:open={showBackInfo} title="Rückwand-Varianten" items={backInfoItems} />
<InfoSheet bind:open={showConstrInfo} title="Konstruktionsarten" items={constrInfoItems} />
