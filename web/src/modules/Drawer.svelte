<script>
  import Icon from '../lib/Icon.svelte';
  import InfoSheet from '../lib/InfoSheet.svelte';
  import { units, UNITS, unitLabel, dispVal, toMM, inputVal } from '../lib/units.svelte.js';
  import { showConfirm, showAlert, showToast } from '../lib/dialog.svelte.js';
  import { openZoom } from '../lib/zoom.svelte.js';
  import { loadJsPDF, svgToPng } from '../lib/pdf.js';
  import { DR_PRESETS, drawerGeometry, drawerGuide, drawerSketch, bestStd } from '../lib/drawer.js';
  import { drawerProjects, saveDrawerProject, findDrawerProject, deleteDrawerProject } from '../lib/drawerProjects.svelte.js';
  import { handoff } from '../lib/handoff.svelte.js';
  import { nav } from '../lib/nav.svelte.js';

  // ── Segment-Zustände ──
  let sys = $state('ball');           // ball | under | wood | none
  let boxConstr = $state('sides');    // sides | frontback
  let bottomMount = $state('groove'); // groove | under
  let frontType = $state('overlay');  // overlay | inset
  let handleN = $state(1);            // 1 | 2

  // ── Togggle-Felder ──
  let hasFront = $state(false);
  let hasHandle = $state(false);

  // ── Eingaben in der aktuellen Anzeigeeinheit ──
  let OW = $state(inputVal(500));
  let OH = $state(inputVal(150));
  let CD = $state(inputVal(500));
  let zt = $state(inputVal(13));
  let bt = $state(inputVal(5));
  let boxH = $state(inputVal(100));
  let slideLen = $state(inputVal(450));
  let frontGap = $state(inputVal(0));
  let handleBc = $state(inputVal(128));
  let handleDia = $state(inputVal(5));

  // ── Eingaben immer in mm (keine Einheitenumrechnung) ──
  let clr = $state(DR_PRESETS.ball.clr);
  let goff = $state(10);
  let gdepth = $state(6);

  // ── UI-Zustand ──
  let tab = $state('input');
  let projName = $state('');
  let slideInfoOpen = $state(false);
  let boxInfoOpen = $state(false);
  let sketchEl = $state(null);

  // Auszug-System setzen (synchronisiert clr mit Preset-Default)
  function setSys(newSys) {
    sys = newSys;
    clr = DR_PRESETS[newSys]?.clr ?? 0;
  }

  // ── Berechnung (rein reaktiv) ──
  const calc = $derived.by(() => {
    const OWmm = toMM(OW), OHmm = toMM(OH), CDmm = toMM(CD);
    const ztmm = toMM(zt), btmm = toMM(bt), boxHmm = toMM(boxH);
    const slideLenMm = toMM(slideLen);
    if (OWmm <= 0 || OHmm <= 0 || CDmm <= 0 || boxHmm <= 0 || ztmm <= 0 || slideLenMm <= 0)
      return { state: 'empty' };
    if (OWmm - 2 * clr <= 2 * ztmm)
      return { state: 'warn', head: '⚠️ Maße prüfen', hint: 'Die Öffnung ist für diese Luft und Zargenstärke zu schmal — es bleibt keine sinnvolle Schubkastenbreite übrig.' };
    const frontGapMm = toMM(frontGap);
    const handleBcMm = toMM(handleBc);
    const handleDiaMm = toMM(handleDia);
    const o = {
      sys, OW: OWmm, OH: OHmm, CD: CDmm, clr, slideLen: slideLenMm,
      zt: ztmm, bt: btmm, boxH: boxHmm, goff, gdepth,
      boxConstr, bottomMount, hasFront, frontType, frontGap: frontGapMm,
      hasHandle: hasFront && hasHandle, handleN, handleBc: handleBcMm, handleDia: handleDiaMm
    };
    const geo = drawerGeometry(o);
    const sketch = drawerSketch(o, geo);
    const guide = drawerGuide(o, geo);
    const preset = DR_PRESETS[sys];
    const u = unitLabel();
    const warns = [];
    if (slideLenMm > CDmm) {
      const best = bestStd(sys, CDmm);
      warns.push(`${preset.hasSlide ? 'Nennlänge' : 'Schubkastentiefe'} (${dispVal(slideLenMm)} ${u}) ist größer als die Korpustiefe (${dispVal(CDmm)} ${u}).${preset.hasSlide && best ? ` Größte passende Nennlänge: ${dispVal(best)} ${u}.` : ''}`);
    } else if (preset.hasSlide && CDmm - slideLenMm < 10) {
      warns.push(`Zwischen Schiene und Rückwand bleiben nur ${dispVal(CDmm - slideLenMm)} ${u}. Etwa 10 mm Luft einplanen.`);
    }
    if (preset.hasSlide && geo.BW < 150) warns.push(`Schubkastenbreite (${dispVal(geo.BW)} ${u}) ist sehr gering — viele Schienen brauchen mind. ~150 mm Korpus-Innenbreite.`);
    if (bottomMount === 'groove' && gdepth >= ztmm) warns.push(`Nuttiefe (${gdepth} mm) ist ≥ Zargenstärke (${dispVal(ztmm)} ${u}) — die Nut schwächt die Wand zu stark.`);
    if (boxHmm >= OHmm) warns.push(`Zargenhöhe (${dispVal(boxHmm)} ${u}) ist ≥ lichte Höhe (${dispVal(OHmm)} ${u}). Plane oben/unten etwas Luft ein.`);
    if (sys === 'under') warns.push('Unterflur: Boden meist zurückgesetzt und Rückwand niedriger/ausgeklinkt — Herstellerangaben des Beschlags beachten.');
    const totalPieces = geo.parts.reduce((a, p) => a + p.qty, 0);
    const totalArea = (geo.parts.reduce((a, p) => a + p.l * p.w * p.qty, 0) / 1e6).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return { state: 'ok', o, geo, sketch, guide, warns, totalPieces, totalArea };
  });

  const hasGuide = $derived(calc.state === 'ok');
  const visibleTabs = $derived(['input', 'projects', ...(hasGuide ? ['guide'] : [])]);
  const lenChips = $derived.by(() => {
    const preset = DR_PRESETS[sys];
    if (!preset?.hasSlide || !preset?.std) return [];
    const cur = toMM(slideLen);
    return preset.std.map(L => ({ L, active: Math.abs(cur - L) < 0.5 }));
  });
  const preset = $derived(DR_PRESETS[sys]);
  const slideLenLabel = $derived(preset?.lenLabel ?? 'Schubkasten-Tiefe');
  const slideLenHint = $derived(preset?.lenHint ?? '');
  const fgapLabel = $derived(frontType === 'overlay' ? 'Überstand je Seite' : 'Fugenmaß je Seite');
  const fgapHint = $derived(frontType === 'overlay' ? 'Wie weit die Front je Seite über die Öffnung steht' : 'Luftspalt rundum zwischen Front und Öffnung');

  // Wenn Anleitungs-Tab wegfällt, zurück zu Eingabe
  $effect(() => { if (tab === 'guide' && !hasGuide) tab = 'input'; });

  // ── Einheitenwechsel: unit-abhängige Felder umrechnen ──
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
    OW = conv(OW); OH = conv(OH); CD = conv(CD);
    zt = conv(zt); bt = conv(bt); boxH = conv(boxH);
    slideLen = conv(slideLen); frontGap = conv(frontGap);
    handleBc = conv(handleBc); handleDia = conv(handleDia);
    prevU = u;
  });

  // ── Reset ──
  async function drawerReset() {
    const ok = await showConfirm('Schubladenplaner zurücksetzen?', 'Alle Eingaben werden auf die Standardwerte zurückgesetzt.', { confirmLabel: 'Zurücksetzen', danger: true, icon: 'restart_alt' });
    if (!ok) return;
    setSys('ball'); boxConstr = 'sides'; bottomMount = 'groove'; frontType = 'overlay'; handleN = 1;
    hasFront = false; hasHandle = false;
    OW = inputVal(500); OH = inputVal(150); CD = inputVal(500);
    zt = inputVal(13); bt = inputVal(5); boxH = inputVal(100);
    slideLen = inputVal(450); goff = 10; gdepth = 6;
    frontGap = inputVal(0); handleBc = inputVal(128); handleDia = inputVal(5);
    tab = 'input';
  }

  // ── Projekte ──
  function buildProject(name) {
    return {
      name, saved: new Date().toLocaleDateString('de-DE'),
      dims: {
        OW: toMM(OW), OH: toMM(OH), CD: toMM(CD),
        zt: toMM(zt), bt: toMM(bt), boxH: toMM(boxH),
        slideLen: toMM(slideLen), frontGap: toMM(frontGap),
        handleBc: toMM(handleBc), handleDia: toMM(handleDia)
      },
      opts: { sys, clr, goff, gdepth, boxConstr, bottomMount, hasFront, frontType, hasHandle, handleN }
    };
  }
  async function saveProj() {
    const name = projName.trim();
    if (!name) { showAlert('Bitte Projektnamen eingeben.', { title: 'Kein Name', icon: 'information' }); return; }
    if (!toMM(OW) || !toMM(OH) || !toMM(CD)) { showAlert('Bitte zuerst gültige Maße eingeben.', { title: 'Fehlende Maße', icon: 'information' }); return; }
    const proj = buildProject(name);
    const res = saveDrawerProject(proj);
    if (res === 'exists') {
      const ok = await showConfirm('„' + name + '" überschreiben?', 'Das gespeicherte Projekt wird mit den aktuellen Eingaben überschrieben.', { confirmLabel: 'Überschreiben', icon: 'content_save' });
      if (!ok) return;
      saveDrawerProject(proj, true);
    }
    projName = '';
    showToast('Projekt gespeichert ✓');
  }
  async function loadProj(name) {
    const p = findDrawerProject(name); if (!p) return;
    const ok = await showConfirm('Projekt „' + name + '" laden?', 'Die aktuelle Eingabe wird dabei überschrieben.', { confirmLabel: 'Laden', icon: 'folder_open' });
    if (!ok) return;
    const d = p.dims || {}, opt = p.opts || {};
    OW = d.OW ? inputVal(d.OW) : '';
    OH = d.OH ? inputVal(d.OH) : '';
    CD = d.CD ? inputVal(d.CD) : '';
    zt = d.zt ? inputVal(d.zt) : '';
    bt = d.bt ? inputVal(d.bt) : '';
    boxH = d.boxH ? inputVal(d.boxH) : '';
    slideLen = d.slideLen ? inputVal(d.slideLen) : '';
    frontGap = d.frontGap != null ? inputVal(d.frontGap) : inputVal(0);
    handleBc = d.handleBc ? inputVal(d.handleBc) : inputVal(128);
    handleDia = d.handleDia ? inputVal(d.handleDia) : inputVal(5);
    sys = opt.sys || 'ball';
    clr = opt.clr != null ? opt.clr : DR_PRESETS[sys].clr;
    goff = opt.goff != null ? opt.goff : 10;
    gdepth = opt.gdepth != null ? opt.gdepth : 6;
    boxConstr = opt.boxConstr || 'sides';
    bottomMount = opt.bottomMount || 'groove';
    hasFront = !!opt.hasFront;
    frontType = opt.frontType || 'overlay';
    hasHandle = !!opt.hasHandle;
    handleN = opt.handleN || 1;
    tab = 'input';
  }
  async function delProj(name) {
    const ok = await showConfirm('„' + name + '" löschen?', 'Das Projekt wird unwiderruflich gelöscht.', { confirmLabel: 'Löschen', danger: true, icon: 'delete' });
    if (!ok) return;
    deleteDrawerProject(name);
  }
  function projDesc(p) {
    const s = p.opts?.sys;
    const lbl = s ? (DR_PRESETS[s]?.label?.split('/')[0]?.trim() || '') : '';
    return `${dispVal(p.dims.OW)}×${dispVal(p.dims.OH)}×${dispVal(p.dims.CD)} ${unitLabel()}${lbl ? ' · ' + lbl : ''}`;
  }

  // ── An Zuschnitt-Optimierer übergeben ──
  function toCutlist() {
    if (calc.state !== 'ok') { showAlert('Bitte zuerst gültige Maße eingeben.', { title: 'Fehlende Maße', icon: 'information' }); return; }
    let id = 1;
    const parts = calc.geo.parts.map(p => ({
      id: id++, name: p.name,
      l: Math.round(p.l * 10) / 10, w: Math.round(p.w * 10) / 10,
      qty: p.qty, grain: p.name === 'Frontblende'
    }));
    handoff.sendToCutlist(parts);
    nav.request('cutlist');
  }

  // ── Griffbohrung an Bohrlochplaner ──
  function toHoles() {
    if (calc.state !== 'ok' || !hasFront || !hasHandle) {
      showAlert('Aktiviere zuerst Frontblende und Griffbohrung.', { title: 'Keine Griffbohrung', icon: 'information' }); return;
    }
    const W = calc.geo.frontW;
    let start, end;
    if (handleN === 2) { start = (W - toMM(handleBc)) / 2; end = start; }
    else { start = W / 2; end = W / 2; }
    handoff.sendToHoles({ length: W, start, end, count: handleN, useMargin: true, sym: true, width: calc.geo.frontH, dia: toMM(handleDia) });
    nav.request('holes');
  }

  // ── Skizze zoomen ──
  function onSketchClick() {
    if (calc.state === 'ok') openZoom(calc.sketch.svg, 'Schubkasten-Skizze');
  }

  // ── PDF ──
  function drawerPDF() {
    if (calc.state !== 'ok') { showAlert('Bitte zuerst gültige Maße eingeben.', { title: 'Fehlende Maße', icon: 'information' }); return; }
    loadJsPDF(() => { drawerDoPDF().catch(e => { console.error(e); showAlert('PDF konnte nicht erstellt werden.', { title: 'Fehler', icon: 'alert_circle', danger: true }); }); });
  }
  async function drawerDoPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const u = unitLabel();
    let y = 15; const lm = 15, pw = 180;
    const checkY = k => { if (y + k > 278) { doc.addPage(); y = 15; } };
    const { o, geo, guide, totalPieces, totalArea } = calc;
    const pr = DR_PRESETS[sys];

    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('betterKerf — Schubkasten', lm, y); y += 9;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 110, 100);
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')}  |  Einheit: ${u}`, lm, y); y += 11; doc.setTextColor(0);
    doc.setFillColor(245, 237, 214); doc.rect(lm, y - 5, pw, 12, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(`Oeffnung: ${dispVal(o.OW)} x ${dispVal(o.OH)} x ${dispVal(o.CD)} ${u}   Kasten: ${dispVal(geo.BW)} x ${dispVal(geo.BD)} ${u}`, lm + 3, y + 3); y += 15; doc.setTextColor(0);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    const constrTxt = o.boxConstr === 'sides' ? 'Seiten durchgehend' : 'Front/Rueck durchgehend';
    const bottomTxt = o.bottomMount === 'groove' ? `Boden eingenutet (Nut ${o.gdepth} mm, ${o.goff} mm v. unten)` : 'Boden untergeschraubt';
    const cfg = `Auszug: ${pr.label}${pr.hasSlide ? ` (Nennlaenge ${dispVal(o.slideLen)} ${u})` : ''}  Luft je Seite ${o.clr} mm  Zarge ${dispVal(o.zt)} ${u}  ${constrTxt}  ${bottomTxt}`;
    const cfgLines = doc.splitTextToSize(cfg, pw); doc.text(cfgLines, lm, y); y += cfgLines.length * 5 + 1;
    if (o.hasFront) {
      const ft = o.frontType === 'overlay' ? 'ueberfaelzt' : 'eingelassen';
      let frTxt = `Frontblende: ${dispVal(geo.frontW)} x ${dispVal(geo.frontH)} ${u} (${ft}, ${dispVal(o.frontGap)} ${u} je Seite)`;
      if (o.hasHandle) frTxt += `  Griff: ${o.handleN === 2 ? dispVal(o.handleBc) + ' ' + u + ' Lochabstand' : '1 Loch mittig'}, O ${dispVal(o.handleDia)} ${u}`;
      const frLines = doc.splitTextToSize(frTxt, pw); doc.text(frLines, lm, y); y += frLines.length * 5;
    }
    if (pr.hasSlide) { doc.setFont('helvetica', 'bold'); doc.text(`Beschlaege: 1 Paar ${pr.label}, Nennlaenge ${dispVal(o.slideLen)} ${u}.`, lm, y); y += 6; doc.setFont('helvetica', 'normal'); }
    y += 4;
    const svgEl = sketchEl?.querySelector('svg');
    if (svgEl) {
      try {
        const png = await svgToPng(svgEl, 3);
        const maxW = pw, maxH = 72; let iw = png.w, ih = png.h;
        const r = Math.min(maxW / iw, maxH / ih); iw *= r; ih *= r;
        checkY(ih + 8); doc.addImage(png.data, 'PNG', lm + (pw - iw) / 2, y, iw, ih); y += ih + 8;
      } catch (e) { /* Skizze optional */ }
    }
    checkY(16); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Zuschnittliste', lm, y); y += 6;
    const cols = [96, 54, 30]; const heads = ['Bauteil', `Mas (${u})`, 'Anzahl'];
    doc.setFillColor(245, 237, 214); doc.rect(lm, y - 5, pw, 7, 'F'); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    let hx = lm; heads.forEach((h, i) => { doc.text(h, hx + 1, y - 1); hx += cols[i]; }); y += 4; doc.setFont('helvetica', 'normal');
    geo.parts.forEach((pp, i) => {
      checkY(6); if (i % 2 === 0) { doc.setFillColor(252, 250, 246); doc.rect(lm, y - 3.5, pw, 5.5, 'F'); }
      let x = lm; [pp.name, `${dispVal(pp.l)} x ${dispVal(pp.w)}`, `${pp.qty}x`].forEach((v, ci) => { doc.text(String(v), x + 1, y); x += cols[ci]; }); y += 5.5;
    });
    y += 2; doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(`Gesamt: ${totalPieces} Teile  ${totalArea} m2 Plattenflaeche`, lm, y); y += 10; doc.setFont('helvetica', 'normal');
    checkY(14); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Bau-Anleitung', lm, y); y += 7; doc.setFontSize(9.5);
    guide.forEach((g, i) => {
      const lines = doc.splitTextToSize(g, pw - 9);
      checkY(lines.length * 4.6 + 3);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(46, 125, 94); doc.text(`${i + 1}.`, lm, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40); doc.text(lines, lm + 7, y);
      y += lines.length * 4.6 + 3;
    });
    doc.setTextColor(0);
    doc.setFontSize(8); doc.setTextColor(150, 140, 130); doc.text('Masse als Zuschnittmasse der Einzelteile. Schienen-/Beschlagabzuege nach Herstellerangabe pruefen.', lm, 289);
    doc.save('betterkerf-schubkasten.pdf');
  }

  // ── Info-Sheet-Inhalte ──
  const slideInfoItems = [
    { title: 'Kugel-/Teleskopauszug (Seitenmontage)', html: 'Die häufigste Schiene: wird seitlich zwischen Korpuswand und Schubkasten montiert. Sie braucht pro Seite Luft — üblich sind <strong>12,5 mm</strong>, sodass der Schubkasten 25 mm schmaler als die lichte Öffnung wird. Nennlängen in 50er-Schritten (250–600 mm), passend zur Korpustiefe wählen.' },
    { title: 'Unterflur-/Vollauszug', html: 'Unsichtbar unter dem Schubkasten montierte Schiene (z. B. Blum Tandem/Movento). Sehr hohe Tragkraft, schlanke Optik. Der Schubkasten wird stärker abgezogen (ca. 42 mm gesamt). <strong>Wichtig:</strong> Boden meist zurückgesetzt, Rückwand niedriger/ausgeklinkt — Herstellerangaben beachten.' },
    { title: 'Holzläufer / klassisch', html: 'Traditionelle Holzführung: läuft direkt auf Leisten im Korpus. Minimale Luft (ca. 1–2 mm), Tiefe frei wählbar. Beschlagfreie Lösung, erfordert sauberes Arbeiten.' },
    { title: 'Ohne Schiene', html: 'Reine Maßberechnung ohne Führung — z. B. für Einsätze oder lose eingelegte Boxen. Standardmäßig kein Abzug; Luft je Seite bei Bedarf selbst eintragen.' }
  ];
  const boxInfoItems = [
    { title: 'Seiten durchgehend', html: 'Die beiden Seiten laufen über die volle Tiefe; Front und Rückwand sitzen dazwischen — klassische Bauweise bei Seitenmontage.' },
    { title: 'Front/Rück durchgehend', html: 'Front und Rückwand laufen über die volle Breite, die Seiten sitzen dazwischen. Von der Seite sind Stirnkanten von Front/Rückwand sichtbar.' },
    { title: 'Front überfälzt (aufliegend)', html: 'Die Frontblende liegt vor dem Korpus und deckt die Öffnung ab — wird größer als die Öffnung, der Überstand gilt je Seite.' },
    { title: 'Front eingelassen', html: 'Die Front sitzt bündig in der Öffnung — wird kleiner als die Öffnung, das Fugenmaß gilt rundum je Seite.' }
  ];

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
      <div class="slabel">Korpusöffnung (lichte Maße)</div>
      <div class="hint-box">Die lichten Innenmaße der Öffnung, in die der Schubkasten eingebaut wird.</div>
      <div class="kp-dims">
        <div class="kp-field"><label for="dr-ow">Lichte Breite <span class="ku">{unitLabel()}</span></label><input id="dr-ow" type="number" inputmode="decimal" bind:value={OW} placeholder="0"></div>
        <div class="kp-field"><label for="dr-oh">Lichte Höhe <span class="ku">{unitLabel()}</span></label><input id="dr-oh" type="number" inputmode="decimal" bind:value={OH} placeholder="0"></div>
        <div class="kp-field"><label for="dr-cd">Korpustiefe <span class="ku">{unitLabel()}</span></label><input id="dr-cd" type="number" inputmode="decimal" bind:value={CD} placeholder="0"></div>
      </div>
    </div>

    <div class="section">
      <div class="slabel-row"><div class="slabel">Auszugssystem</div><button class="info-btn" onclick={() => slideInfoOpen = true} aria-label="Erklärung der Auszugssysteme">ⓘ</button></div>
      <div class="kp-seg-label">Führung des Schubkastens</div>
      <div class="cost-seg kp-seg kp-seg-4">
        <button class:on={sys === 'ball'}  onclick={() => setSys('ball')}>Kugelauszug</button>
        <button class:on={sys === 'under'} onclick={() => setSys('under')}>Unterflur</button>
        <button class:on={sys === 'wood'}  onclick={() => setSys('wood')}>Holzläufer</button>
        <button class:on={sys === 'none'}  onclick={() => setSys('none')}>ohne</button>
      </div>
      <div class="srow"><div><div class="srow-label">Luft je Seite</div><div class="srow-hint">Abzug je Seite für die Schiene — immer in mm</div></div><div class="nm"><input type="number" inputmode="decimal" bind:value={clr} min="0" step="0.5"><span>mm</span></div></div>
      <div class="srow" style="margin-top:4px"><div><div class="srow-label">{slideLenLabel}</div><div class="srow-hint">{slideLenHint}</div></div><div class="nm"><input type="number" inputmode="decimal" bind:value={slideLen} placeholder="0"><span>{unitLabel()}</span></div></div>
      {#if lenChips.length > 0}
        <div class="unit-chips" style="flex-wrap:wrap;margin-top:8px">
          {#each lenChips as chip}
            <button class="unit-chip" class:active={chip.active} onclick={() => slideLen = inputVal(chip.L)}>{dispVal(chip.L)}</button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="section">
      <div class="slabel">Schubkasten-Material</div>
      <div class="kp-dims">
        <div class="kp-field"><label for="dr-zt">Zargenstärke <span class="ku">{unitLabel()}</span></label><input id="dr-zt" type="number" inputmode="decimal" bind:value={zt} placeholder="13"></div>
        <div class="kp-field"><label for="dr-bt">Bodenstärke <span class="ku">{unitLabel()}</span></label><input id="dr-bt" type="number" inputmode="decimal" bind:value={bt} placeholder="5"></div>
        <div class="kp-field"><label for="dr-boxh">Zargenhöhe <span class="ku">{unitLabel()}</span></label><input id="dr-boxh" type="number" inputmode="decimal" bind:value={boxH} placeholder="0"></div>
      </div>
    </div>

    <div class="section">
      <div class="slabel-row"><div class="slabel">Bauart</div><button class="info-btn" onclick={() => boxInfoOpen = true} aria-label="Erklärung zu Bauart & Front">ⓘ</button></div>
      <div class="kp-seg-label">Eckverbindung des Schubkastens</div>
      <div class="cost-seg kp-seg">
        <button class:on={boxConstr === 'sides'}     onclick={() => boxConstr = 'sides'}>Seiten durchgehend</button>
        <button class:on={boxConstr === 'frontback'} onclick={() => boxConstr = 'frontback'}>Front/Rück durchgehend</button>
      </div>
      <div class="kp-seg-label">Bodenmontage</div>
      <div class="cost-seg kp-seg">
        <button class:on={bottomMount === 'groove'} onclick={() => bottomMount = 'groove'}>eingenutet</button>
        <button class:on={bottomMount === 'under'}  onclick={() => bottomMount = 'under'}>untergeschraubt</button>
      </div>
      {#if bottomMount === 'groove'}
        <div class="kp-dims kp-dims-2" style="margin-top:8px">
          <div class="kp-field"><label for="dr-goff">Nutabstand v. unten</label><input id="dr-goff" type="number" inputmode="decimal" bind:value={goff} min="0" step="0.5"><span style="font-size:11px;color:var(--text3);margin-top:2px">mm</span></div>
          <div class="kp-field"><label for="dr-gdepth">Nuttiefe</label><input id="dr-gdepth" type="number" inputmode="decimal" bind:value={gdepth} min="0" step="0.5"><span style="font-size:11px;color:var(--text3);margin-top:2px">mm</span></div>
        </div>
        <div class="srow-hint" style="margin-top:6px">Nutmaße immer in mm. Der Boden wird um die Nuttiefe je Seite größer berechnet.</div>
      {/if}
    </div>

    <div class="section">
      <div class="srow"><div><div class="srow-label">Sichtbare Frontblende</div><div class="srow-hint">Separate Front auf den Schubkasten — mit Maßen und Griffbohrung</div></div><input type="checkbox" class="toggle" bind:checked={hasFront}></div>
      {#if hasFront}
        <div class="kp-seg-label" style="margin-top:8px">Frontart</div>
        <div class="cost-seg kp-seg">
          <button class:on={frontType === 'overlay'} onclick={() => frontType = 'overlay'}>überfälzt (aufliegend)</button>
          <button class:on={frontType === 'inset'}   onclick={() => frontType = 'inset'}>eingelassen</button>
        </div>
        <div class="srow"><div><div class="srow-label">{fgapLabel}</div><div class="srow-hint">{fgapHint}</div></div><div class="nm"><input type="number" inputmode="decimal" bind:value={frontGap} min="0"><span>{unitLabel()}</span></div></div>
        <div class="srow" style="margin-top:8px"><div><div class="srow-label">Griffbohrung</div><div class="srow-hint">Bohrungen für Griff/Knopf in der Front vorsehen</div></div><input type="checkbox" class="toggle" bind:checked={hasHandle}></div>
        {#if hasHandle}
          <div class="kp-seg-label" style="margin-top:6px">Anzahl Bohrungen</div>
          <div class="cost-seg kp-seg">
            <button class:on={handleN === 1} onclick={() => handleN = 1}>1 (Knopf)</button>
            <button class:on={handleN === 2} onclick={() => handleN = 2}>2 (Bügelgriff)</button>
          </div>
          <div class="kp-dims kp-dims-2">
            {#if handleN === 2}
              <div class="kp-field"><label for="dr-hbc">Lochabstand <span class="ku">{unitLabel()}</span></label><input id="dr-hbc" type="number" inputmode="decimal" bind:value={handleBc} min="0" placeholder="0"></div>
            {/if}
            <div class="kp-field"><label for="dr-hdia">Bohrer-Ø <span class="ku">{unitLabel()}</span></label><input id="dr-hdia" type="number" inputmode="decimal" bind:value={handleDia} min="0" placeholder="0"></div>
          </div>
        {/if}
      {/if}
    </div>

    <div style="margin-top:6px">
      {#if calc.state === 'warn'}
        <div class="warn-box"><div class="warn-head">{calc.head}</div><div class="warn-hint">{calc.hint}</div></div>
      {:else if calc.state === 'ok'}
        <div class="section">
          <div class="bvis-top"><b>Schubkasten-Skizze</b></div>
          <div class="kp-sketch" bind:this={sketchEl} onclick={onSketchClick} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSketchClick(); }} style="cursor:zoom-in" role="button" tabindex="0">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html calc.sketch.svg}
          </div>
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html calc.sketch.legend}
          <div class="srow-hint" style="text-align:center;margin-top:6px">Antippen zum Vergrößern</div>
        </div>
        <div class="section">
          <div class="slabel">Zuschnittliste</div>
          <div class="kp-cut-head"><span>Bauteil</span><span>Maß ({unitLabel()})</span><span>Anz.</span></div>
          {#each calc.geo.parts as p}
            <div class="kp-cut-row"><span class="kp-cut-name">{p.name}</span><span class="kp-cut-dim">{dispVal(p.l)} × {dispVal(p.w)}</span><span class="kp-cut-qty">{p.qty}×</span></div>
          {/each}
        </div>
        <div class="stat-row">
          <div class="stat"><div class="stat-val">{dispVal(calc.geo.BW)}×{dispVal(calc.geo.BD)}</div><div class="stat-lbl">Kasten B×T {unitLabel()}</div></div>
          <div class="stat"><div class="stat-val">{calc.totalPieces}</div><div class="stat-lbl">Teile</div></div>
          <div class="stat"><div class="stat-val">{calc.totalArea} m²</div><div class="stat-lbl">Plattenfläche</div></div>
        </div>
        {#if preset.hasSlide}
          <div class="info-note" style="margin-top:8px">🔩 Beschläge: 1 Paar {preset.label}, Nennlänge {dispVal(calc.o.slideLen)} {unitLabel()}.</div>
        {/if}
        {#if calc.warns.length}
          <div class="warn-box" style="margin-top:12px"><div class="warn-head">⚠️ Hinweise</div><div class="warn-hint">{calc.warns.map(w => '• ' + w).join('\n')}</div></div>
        {/if}
        <button class="calc-btn" style="margin-top:14px" onclick={toCutlist}>→ An Zuschnitt-Optimierer übergeben</button>
        {#if hasFront && hasHandle}
          <button class="action-btn" onclick={toHoles}><Icon name="adjust" size={16} /> Griffbohrung an Bohrlochplaner</button>
        {/if}
        <button class="action-btn" onclick={drawerPDF}><Icon name="download" size={16} /> Als PDF exportieren</button>
      {/if}
    </div>

    <button class="action-btn" style="margin-top:14px" onclick={drawerReset}><Icon name="restart_alt" size={16} /> Zurücksetzen</button>
  </div>

  <!-- ANLEITUNG -->
  <div class="pane" class:active={tab === 'guide'}>
    {#if hasGuide}
      <div class="section"><div class="slabel">Bau-Anleitung</div>
        <div class="kp-guide">
          {#each calc.guide as g, i}
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
      {#if !drawerProjects.list.length}
        <div class="empty-proj">Noch keine Schubladen-Projekte gespeichert.<br>Daten bleiben lokal auf diesem Gerät.</div>
      {:else}
        {#each drawerProjects.list as p (p.name)}
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

<InfoSheet bind:open={slideInfoOpen} title="Auszugssysteme" items={slideInfoItems} />
<InfoSheet bind:open={boxInfoOpen} title="Bauart & Front" items={boxInfoItems} />
