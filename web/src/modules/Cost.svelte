<script>
  import Icon from '../lib/Icon.svelte';
  import { unitLabel, dispVal, toMM, inputVal } from '../lib/units.svelte.js';
  import { showAlert, showConfirm } from '../lib/dialog.svelte.js';
  import { cutlistResult } from '../lib/cutlistResult.svelte.js';
  import { loadJsPDF, savePDF, addLogoToDoc } from '../lib/pdf.js';
  import { nav } from '../lib/nav.svelte.js';

  // ── State ──
  let costBoards = $state([{ id: 1, name: '', L: 0, W: 0, count: 1, priceMode: 'piece', price: 0 }]);
  let nextId = $state(2);
  let linkedResult = $state(null);
  let qty = $state(1);
  let lastCost = $state(null);
  let pricesOpen = $state(false);
  let priceMemory = $state({});

  // ── Derived ──
  const cutResult = $derived(cutlistResult.current);
  const hasCut = $derived(!!(cutResult && cutResult.assignment && cutResult.assignment.length));
  const isTaken = $derived(!!(linkedResult && linkedResult === cutResult));
  const u = $derived(unitLabel());
  const priceNames = $derived(Object.keys(priceMemory).sort((a, b) => a.localeCompare(b, 'de')));

  // ── Init ──
  loadMemory();

  // ── Price memory ──
  function loadMemory() {
    try { priceMemory = JSON.parse(localStorage.getItem('betterkerf_prices') || '{}'); }
    catch { priceMemory = {}; }
  }
  function saveMemoryEntry(name, priceMode, price) {
    if (!name) return;
    try {
      const m = { ...priceMemory, [name]: { priceMode, price } };
      localStorage.setItem('betterkerf_prices', JSON.stringify(m));
      priceMemory = m;
    } catch {}
  }
  function deleteMemoryEntry(name) {
    try {
      const m = { ...priceMemory };
      delete m[name];
      localStorage.setItem('betterkerf_prices', JSON.stringify(m));
      priceMemory = m;
    } catch {}
  }
  async function clearAllPrices() {
    const ok = await showConfirm('Alle gemerkten Preise löschen?', 'Die aktuell eingegebenen Bretter bleiben erhalten — nur die gespeicherten Preise werden entfernt.', { confirmLabel: 'Alle löschen', danger: true, icon: 'delete' });
    if (!ok) return;
    try { localStorage.removeItem('betterkerf_prices'); priceMemory = {}; } catch {}
  }
  async function delPriceEntry(name) {
    const ok = await showConfirm('Preis für „' + name + '" löschen?', 'Dieser gemerkte Preis wird unwiderruflich entfernt.', { confirmLabel: 'Löschen', danger: true, icon: 'delete' });
    if (!ok) return;
    deleteMemoryEntry(name);
  }
  function usePriceEntry(name) {
    const e = priceMemory[name];
    if (!e) return;
    const idx = costBoards.findIndex(x => x.name === name);
    if (idx < 0) {
      costBoards = [...costBoards, { id: nextId++, name, L: 0, W: 0, count: 1, priceMode: e.priceMode, price: e.price }];
    } else {
      costBoards[idx].priceMode = e.priceMode;
      costBoards[idx].price = e.price;
    }
  }

  // ── Board management ──
  function addBoard() {
    costBoards = [...costBoards, { id: nextId++, name: '', L: 0, W: 0, count: 1, priceMode: 'piece', price: 0 }];
  }
  function delBoard(id) { costBoards = costBoards.filter(x => x.id !== id); }
  function setBoard(id, field, val) {
    const b = costBoards.find(x => x.id === id);
    if (!b) return;
    if (field === 'name') b.name = val;
    else if (field === 'L') b.L = toMM(val);
    else if (field === 'W') b.W = toMM(val);
    else if (field === 'count') b.count = Math.max(1, parseInt(val) || 1);
    else if (field === 'price') b.price = parseFloat(String(val).replace(',', '.')) || 0;
    else if (field === 'priceMode') { b.priceMode = val; costBoards = [...costBoards]; }
    if (field === 'name' || field === 'price' || field === 'priceMode')
      saveMemoryEntry(b.name, b.priceMode, b.price);
  }

  // ── From cutlist ──
  function costFromCutlist() {
    const r = cutResult;
    if (!r || !r.expandedBoards || !r.assignment.length) {
      showAlert('Berechne zuerst im Modul „Zuschnitt-Optimierer" einen Plan, dann kannst du ihn hier übernehmen.', { title: 'Kein Zuschnitt-Ergebnis', icon: 'information' });
      return;
    }
    const used = r.expandedBoards.filter(b => b.placed.length > 0);
    const groups = {};
    used.forEach(b => {
      const key = b.name + '|' + b.L + '|' + b.W;
      groups[key] = groups[key] || { name: b.name, L: b.L, W: b.W, count: 0 };
      groups[key].count++;
    });
    const prices = priceMemory;
    costBoards = Object.values(groups).map(g => {
      const saved = prices[g.name] || {};
      return { id: nextId++, name: g.name, L: g.L, W: g.W, count: g.count, priceMode: saved.priceMode || 'piece', price: saved.price || 0 };
    });
    linkedResult = r;
    if (costBoards.some(b => b.price > 0)) costCalc(); else lastCost = null;
  }

  // ── Calculation ──
  function boardUnitPrice(b) {
    if (b.priceMode === 'area') return b.price * (b.L * b.W) / 1e6;
    return b.price;
  }
  function fmtEur(v) { return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

  function costCompute() {
    const q = Math.max(1, qty);
    let total1 = 0, totalCount1 = 0;
    const byType = costBoards.map(b => {
      const unit = boardUnitPrice(b);
      const sum = unit * b.count;
      total1 += sum; totalCount1 += b.count;
      return { name: b.name || '(ohne Name)', count: b.count, unit, sum, priceMode: b.priceMode, L: b.L, W: b.W };
    });
    const linked = linkedResult;
    const linkValid = !!(linked && linked.assignment && linked.assignment.length);
    let perPart = null, wasteValue1 = 0, wasteFrac = 0;
    if (linkValid) {
      const priceByKey = {};
      costBoards.forEach(b => { priceByKey[b.name + '|' + b.L + '|' + b.W] = boardUnitPrice(b); });
      const usedBoards = linked.expandedBoards.filter(b => b.placed.length > 0);
      let placedPartArea = 0, usedBoardArea = 0, matchedCost = 0;
      usedBoards.forEach(b => {
        usedBoardArea += b.L * b.W;
        placedPartArea += b.placed.reduce((s, p) => s + p.L * p.W, 0);
        const price = priceByKey[b.name + '|' + b.L + '|' + b.W];
        if (price != null) matchedCost += price;
      });
      const partCost = {};
      usedBoards.forEach(b => {
        const price = priceByKey[b.name + '|' + b.L + '|' + b.W]; if (price == null) return;
        const boardPartArea = b.placed.reduce((s, p) => s + p.L * p.W, 0) || 1;
        b.placed.forEach(p => {
          const share = (p.L * p.W) / boardPartArea * price;
          partCost[p.name] = partCost[p.name] || { cost: 0, count: 0 };
          partCost[p.name].cost += share; partCost[p.name].count++;
        });
      });
      perPart = partCost;
      wasteFrac = usedBoardArea ? (usedBoardArea - placedPartArea) / usedBoardArea : 0;
      wasteValue1 = matchedCost * wasteFrac;
    }
    const total = total1 * q;
    const totalCount = totalCount1 * q;
    const wasteValue = wasteValue1 * q;
    const materialValue = total - wasteValue;
    const byTypeScaled = byType.map(b => ({ ...b, count: b.count * q, sum: b.sum * q }));
    let perPartScaled = null;
    if (perPart) {
      perPartScaled = {};
      Object.entries(perPart).forEach(([n, d]) => {
        perPartScaled[n] = { cost: d.cost * q, count: d.count * q, unit: d.cost / d.count };
      });
    }
    return { qty: q, total, totalCount, byType: byTypeScaled, linkValid, perPart: perPartScaled, wasteFrac, wasteValue, materialValue };
  }

  function costCalc() {
    if (!costBoards.length) { showAlert('Bitte mindestens ein Brett eingeben.', { title: 'Fehlende Eingaben', icon: 'information' }); return; }
    lastCost = costCompute();
  }

  async function costReset() {
    const ok = await showConfirm('Kostenkalkulator zurücksetzen?', 'Alle eingegebenen Bretter und Preise werden gelöscht.', { confirmLabel: 'Zurücksetzen', danger: true, icon: 'restart_alt' });
    if (!ok) return;
    linkedResult = null; lastCost = null; qty = 1;
    costBoards = [{ id: nextId++, name: '', L: 0, W: 0, count: 1, priceMode: 'piece', price: 0 }];
  }

  // ── PDF ──
  function exportPDF() {
    if (!lastCost) { showAlert('Bitte zuerst die Kosten berechnen.', { title: 'Kein Ergebnis', icon: 'information' }); return; }
    loadJsPDF(() => { doPDF().catch(e => { if (e?.name === 'AbortError') return; console.error(e); showAlert('PDF konnte nicht erstellt werden.', { title: 'Fehler', icon: 'alert_circle', danger: true }); }); });
  }
  async function doPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const c = lastCost; const ul = unitLabel();
    let y = 15; const lm = 15, pw = 180;
    const checkY = k => { if (y + k > 272) { doc.addPage(); y = 15; } };
    const eur = v => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR';
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    const titleOff = await addLogoToDoc(doc, lm, y);
    doc.text('betterKerf - Kostenkalkulator', lm + titleOff, y); y += 9;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0);
    doc.text('Erstellt: ' + new Date().toLocaleDateString('de-DE') + (c.qty > 1 ? '  |  Hochrechnung: ' + c.qty + ' Sets' : ''), lm, y);
    y += 11; doc.setTextColor(0);
    doc.setFillColor(213, 229, 223); doc.rect(lm, y - 5, pw, 12, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Gesamtkosten' + (c.qty > 1 ? ' (' + c.qty + 'x)' : ''), lm + 3, y + 3);
    doc.text(eur(c.total), lm + pw - 3, y + 3, { align: 'right' }); y += 15; doc.setTextColor(0);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Bretter & Preise', lm, y); y += 6;
    const cols = [14, 86, 40, 40]; const heads = ['Anz.', 'Brett', 'Einzelpreis', 'Summe'];
    doc.setFillColor(213, 229, 223); doc.rect(lm, y - 5, pw, 7, 'F'); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    let x0 = lm; heads.forEach((h, i) => { doc.text(h, x0 + 1, y - 1); x0 += cols[i]; }); y += 4; doc.setFont('helvetica', 'normal');
    c.byType.forEach((b, i) => {
      checkY(6);
      if (i % 2 === 0) { doc.setFillColor(245, 249, 247); doc.rect(lm, y - 3.5, pw, 5.5, 'F'); }
      let xi = lm;
      const dim = b.L && b.W ? ' (' + dispVal(b.L) + 'x' + dispVal(b.W) + ' ' + ul + ')' : '';
      [String(b.count), b.name + dim, eur(b.unit), eur(b.sum)].forEach((v, ci) => { doc.text(String(v), xi + 1, y); xi += cols[ci]; });
      y += 5.5;
    }); y += 8;
    if (c.linkValid) {
      checkY(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text('Kosten pro Teil (anteilig nach Flaeche)', lm, y); y += 6;
      const tc = [100, 40, 40]; const th = ['Teil', 'Anzahl', 'je Stueck'];
      doc.setFillColor(213, 229, 223); doc.rect(lm, y - 5, pw, 7, 'F'); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      let x2 = lm; th.forEach((h, i) => { doc.text(h, x2 + 1, y - 1); x2 += tc[i]; }); y += 4; doc.setFont('helvetica', 'normal');
      Object.entries(c.perPart).forEach(([name, d], i) => {
        checkY(6);
        if (i % 2 === 0) { doc.setFillColor(245, 249, 247); doc.rect(lm, y - 3.5, pw, 5.5, 'F'); }
        let x3 = lm; [name, d.count + 'x', eur(d.unit)].forEach((v, ci) => { doc.text(String(v), x3 + 1, y); x3 += tc[ci]; }); y += 5.5;
      }); y += 8;
      checkY(30);
      const matPct = c.total ? Math.round(c.materialValue / c.total * 100) : 0;
      const wastePct = 100 - matPct;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Materialwert vs. Verschnitt', lm, y); y += 5;
      const barW = pw, barH = 7; const matW = barW * matPct / 100;
      doc.setFillColor(107, 143, 94); doc.rect(lm, y, matW, barH, 'F');
      doc.setFillColor(46, 125, 94); doc.rect(lm + matW, y, barW - matW, barH, 'F'); y += barH + 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.setTextColor(107, 143, 94); doc.text('Verbaut: ' + eur(c.materialValue) + ' (' + matPct + ' %)', lm, y);
      doc.setTextColor(46, 125, 94); doc.text('Verschnitt: ' + eur(c.wasteValue) + ' (' + wastePct + ' %)', lm + pw, y, { align: 'right' });
      doc.setTextColor(0); y += 8;
    }
    doc.setFontSize(8); doc.setTextColor(90, 130, 110);
    doc.text('Alle Preise in EUR. Teil-Preise anteilig nach Flaeche; Verschnittwert separat.', lm, 287);
    await savePDF(doc, 'betterkerf-materialkosten.pdf');
  }
</script>

<div class="pane active" role="presentation">
  <!-- Zuschnitt-Quelle -->
  {#if isTaken}
    {@const nBoards = new Set(cutResult.expandedBoards.filter(b => b.placed.length).map(b => b.boardIdx)).size}
    <div class="cost-state cost-state-ok">
      <div class="cost-state-icon">✓</div>
      <div class="cost-state-body">
        <div class="cost-state-title">Zuschnitt übernommen</div>
        <div class="cost-state-sub">{nBoards} Brett(er) · {cutResult.assignment.length} Teile · {costBoards.length} Brett-Typ(en) geladen</div>
      </div>
      <button class="cost-state-btn" onclick={costFromCutlist}>Neu laden</button>
    </div>
  {:else if hasCut}
    {@const nBoards = new Set(cutResult.expandedBoards.filter(b => b.placed.length).map(b => b.boardIdx)).size}
    {@const stale = !!(linkedResult && linkedResult !== cutResult)}
    <div class="cost-state cost-state-info">
      <div class="cost-state-icon"><Icon name="lightbulb" size={22} /></div>
      <div class="cost-state-body">
        <div class="cost-state-title">{stale ? 'Neues Zuschnitt-Ergebnis verfügbar' : 'Zuschnitt-Ergebnis verfügbar'}</div>
        <div class="cost-state-sub">{nBoards} Brett(er) · {cutResult.assignment.length} Teile{stale ? ' — übernommene Daten sind veraltet' : ''}</div>
      </div>
      <button class="cost-state-btn accent" onclick={costFromCutlist}>Übernehmen</button>
    </div>
  {:else}
    <div class="cost-state cost-state-hint">
      <div class="cost-state-icon"><Icon name="lightbulb" size={22} /></div>
      <div class="cost-state-body">
        <div class="cost-state-title">Tipp: Zuschnitt zuerst berechnen</div>
        <div class="cost-state-sub">Erstelle im Modul „Zuschnitt-Optimierer" einen Plan — dann kannst du ihn hier mit einem Tippen übernehmen und bekommst automatisch Brettmengen, Kosten pro Teil und den Verschnittwert. Ohne Zuschnitt kannst du Bretter auch manuell eintragen.</div>
        <button class="cost-state-link" onclick={() => nav.request('cutlist')}>Zum Zuschnitt-Optimierer</button>
      </div>
    </div>
  {/if}

  <!-- Bretter & Preise -->
  <div class="section">
    <div class="slabel-row"><div class="slabel">Bretter & Preise</div></div>
    <div class="hint-box">Gib pro Brett den Preis ein — wahlweise als Stückpreis oder pro m².</div>
    {#each costBoards as b (b.id)}
      <div class="cost-row">
        <div class="cost-row-top">
          <input class="cost-name" value={b.name} oninput={(e) => setBoard(b.id, 'name', e.target.value)} placeholder="Brett-Name" autocomplete="off" autocorrect="off">
          <button class="del-btn" onclick={() => delBoard(b.id)}>×</button>
        </div>
        {#if b.priceMode === 'area'}
          <div class="cost-row-grid">
            <div class="cost-field"><label for="cb-l-{b.id}">Länge {u}</label><input id="cb-l-{b.id}" type="number" inputmode="decimal" value={b.L ? inputVal(b.L) : ''} placeholder="0" oninput={(e) => setBoard(b.id, 'L', e.target.value)}></div>
            <div class="cost-field"><label for="cb-w-{b.id}">Breite {u}</label><input id="cb-w-{b.id}" type="number" inputmode="decimal" value={b.W ? inputVal(b.W) : ''} placeholder="0" oninput={(e) => setBoard(b.id, 'W', e.target.value)}></div>
            <div class="cost-field"><label for="cb-c-{b.id}">Anzahl</label><input id="cb-c-{b.id}" type="number" inputmode="numeric" value={b.count} min="1" oninput={(e) => setBoard(b.id, 'count', e.target.value)}></div>
          </div>
        {:else}
          <div class="cost-row-grid cost-row-grid-1">
            <div class="cost-field"><label for="cb-c-{b.id}">Anzahl</label><input id="cb-c-{b.id}" type="number" inputmode="numeric" value={b.count} min="1" oninput={(e) => setBoard(b.id, 'count', e.target.value)}></div>
          </div>
        {/if}
        <div class="cost-row-grid">
          <div class="cost-field cost-pricemode">
            <span class="cost-field-lbl">Preisart</span>
            <div class="cost-seg">
              <button class:on={b.priceMode === 'piece'} onclick={() => setBoard(b.id, 'priceMode', 'piece')}>pro Brett</button>
              <button class:on={b.priceMode === 'area'} onclick={() => setBoard(b.id, 'priceMode', 'area')}>pro m²</button>
            </div>
          </div>
          <div class="cost-field"><label for="cb-p-{b.id}">Preis € {b.priceMode === 'area' ? '/ m²' : '/ Brett'}</label><input id="cb-p-{b.id}" type="number" inputmode="decimal" step="0.01" value={b.price || ''} placeholder="0,00" oninput={(e) => setBoard(b.id, 'price', e.target.value)}></div>
        </div>
      </div>
    {/each}
    <button class="add-btn" onclick={addBoard}>+ Brett hinzufügen</button>
  </div>

  <!-- Gemerkte Preise -->
  <div class="section">
    <div class="slabel-row">
      <div class="slabel">Gemerkte Preise</div>
      <button class="edit-toggle" class:on={pricesOpen} onclick={() => pricesOpen = !pricesOpen}>{pricesOpen ? 'Verbergen' : 'Anzeigen'}</button>
    </div>
    {#if pricesOpen}
      {#if !priceNames.length}
        <div class="empty-proj" style="margin-top:0">Noch keine Preise gemerkt.<br>Eingetragene Brett-Preise werden hier automatisch gespeichert.</div>
      {:else}
        {#each priceNames as name (name)}
          {@const e = priceMemory[name]}
          <div class="price-item">
            <div class="price-info">
              <div class="price-name">{name}</div>
              <div class="price-val">{e.priceMode === 'area' ? fmtEur(e.price) + ' / m²' : fmtEur(e.price) + ' / Brett'}</div>
            </div>
            <div class="price-btns">
              <button class="price-use" onclick={() => usePriceEntry(name)}>Übernehmen</button>
              <button class="price-del" onclick={() => delPriceEntry(name)}>×</button>
            </div>
          </div>
        {/each}
        <button class="action-btn danger" onclick={clearAllPrices}><Icon name="delete" size={16} /> Alle gemerkten Preise löschen</button>
      {/if}
    {/if}
  </div>

  <!-- Anzahl Sets -->
  <div class="section">
    <div class="srow">
      <div><div class="srow-label">Anzahl Projekte / Sets</div><div class="srow-hint">Hochrechnung für Kleinserien — Material &amp; Kosten werden multipliziert</div></div>
      <div class="nm">
        <input type="number" inputmode="numeric" bind:value={qty} min="1" max="999" oninput={() => { if (lastCost) costCalc(); }}>
        <span>×</span>
      </div>
    </div>
  </div>

  <button class="calc-btn" onclick={costCalc}>▶ Kosten berechnen</button>
  <button class="action-btn" onclick={costReset}><Icon name="restart_alt" size={16} /> Zurücksetzen</button>

  <!-- Ergebnis -->
  {#if lastCost}
    {@const c = lastCost}
    <div style="margin-top:18px">
      <div class="stat-row" style="grid-template-columns:1fr 1fr">
        <div class="stat"><div class="stat-val">{fmtEur(c.total)}</div><div class="stat-lbl">Gesamt{c.qty > 1 ? ` (${c.qty}×)` : ''}</div></div>
        <div class="stat"><div class="stat-val">{c.totalCount}</div><div class="stat-lbl">Bretter</div></div>
      </div>

      <div class="usage-box">
        <div class="usage-title">Kosten pro Brett-Typ{c.qty > 1 ? ` · ${c.qty} Sets` : ''}</div>
        {#each c.byType as b}
          <div class="usage-row">
            <span class="usage-name">{b.count}× {b.name}{b.priceMode === 'area' ? ` · ${fmtEur(b.unit)}/Stk` : ''}</span>
            <span class="usage-count"><b>{fmtEur(b.sum)}</b></span>
          </div>
        {/each}
      </div>

      {#if c.linkValid}
        {@const matPct = c.total ? Math.round(c.materialValue / c.total * 100) : 0}
        {@const wastePct = 100 - matPct}
        <div class="usage-box">
          <div class="usage-title">Materialwert vs. Verschnitt</div>
          <div class="cost-split-bar">
            <div class="cost-split-mat" style="width:{matPct}%"></div>
            <div class="cost-split-waste" style="width:{wastePct}%"></div>
          </div>
          <div class="cost-split-legend">
            <div class="cost-split-item"><span class="cost-dot" style="background:var(--green)"></span>Verbaut {fmtEur(c.materialValue)} ({matPct}%)</div>
            <div class="cost-split-item"><span class="cost-dot" style="background:var(--accent)"></span>Verschnitt {fmtEur(c.wasteValue)} ({wastePct}%)</div>
          </div>
        </div>

        <div class="usage-box">
          <div class="usage-title">Kosten pro Teil (anteilig nach Fläche)</div>
          {#each Object.entries(c.perPart) as [name, d]}
            <div class="usage-row">
              <span class="usage-name">{name} ({d.count}×)</span>
              <span class="usage-count"><b>{fmtEur(d.unit)}</b> / Stück</span>
            </div>
          {/each}
        </div>
        <div class="info-note">Der Teil-Preis verteilt den jeweiligen Brettpreis anteilig nach Fläche. Der Verschnittwert zeigt, wie viel des Materialpreises im Abfall landet.</div>
      {:else}
        <div class="info-note">Für „Kosten pro Teil", die Verschnitt-Aufteilung und den Verschnittwert übernimm zuerst ein Ergebnis aus dem Zuschnitt-Optimierer (Button „Aus Zuschnitt").</div>
      {/if}

      <button class="action-btn" onclick={exportPDF}><Icon name="download" size={16} /> Kosten als PDF exportieren</button>
    </div>
  {/if}
</div>

<style>
  .cost-state{display:flex;align-items:flex-start;gap:11px;border-radius:12px;padding:12px 13px;margin-bottom:14px;border:.5px solid var(--border)}
  .cost-state-info{background:rgba(91,141,184,.12);border-color:rgba(91,141,184,.4)}
  .cost-state-ok{background:rgba(46,125,94,.13);border-color:rgba(46,125,94,.45)}
  .cost-state-hint{background:var(--bg2)}
  .cost-state-icon{font-size:20px;line-height:1.3;flex-shrink:0;color:var(--text2)}
  .cost-state-body{flex:1;min-width:0}
  .cost-state-title{font-size:15px;font-weight:600;color:var(--text);margin-bottom:2px}
  .cost-state-sub{font-size:13px;color:var(--text2);line-height:1.5}
  .cost-state-btn{flex-shrink:0;align-self:center;border:.5px solid var(--border2);background:var(--bg3);color:var(--text2);font-size:13px;font-family:inherit;padding:8px 12px;border-radius:9px;cursor:pointer;white-space:nowrap}
  .cost-state-btn.accent{border-color:var(--accent);background:rgba(46,125,94,.18);color:var(--accent2);font-weight:600}
  .cost-state-btn:active{opacity:.8}
  .cost-state-link{display:block;margin-top:10px;border:.5px solid var(--accent);background:rgba(46,125,94,.18);color:var(--accent2);font-size:13px;font-weight:600;font-family:inherit;padding:9px 14px;border-radius:9px;cursor:pointer}
  .cost-state-link:active{opacity:.8}

  .cost-row{background:var(--bg2);border:.5px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px}
  .cost-row-top{display:flex;gap:8px;align-items:center;margin-bottom:9px}
  .cost-name{flex:1;font-size:15px;height:40px;padding:0 11px;border:.5px solid var(--border2);border-radius:9px;background:var(--bg3);color:var(--text);font-family:inherit;-webkit-appearance:none}
  .cost-row-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:9px}
  .cost-row-grid:last-child{margin-bottom:0;grid-template-columns:1fr 1fr}
  .cost-row-grid-1{grid-template-columns:1fr!important}
  .cost-field{display:flex;flex-direction:column;gap:4px;min-width:0}
  .cost-field label,.cost-field-lbl{font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
  .cost-field input{font-size:15px;height:38px;padding:0 10px;border:.5px solid var(--border2);border-radius:9px;background:var(--bg3);color:var(--text);font-family:'Menlo',monospace;width:100%;-webkit-appearance:none}
  .cost-seg{display:flex;border:.5px solid var(--border2);border-radius:9px;overflow:hidden;height:38px}
  .cost-seg button{flex:1;border:none;background:var(--bg3);color:var(--text3);font-size:13px;font-family:inherit;cursor:pointer;padding:0 4px}
  .cost-seg button.on{background:var(--accent);color:#fff}

  .price-item{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--bg2);border:.5px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px}
  .price-info{min-width:0}
  .price-name{font-size:13px;color:var(--text);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .price-val{font-size:11px;color:var(--text3);margin-top:2px}
  .price-btns{display:flex;gap:6px;flex-shrink:0}
  .price-use{border:.5px solid var(--border2);background:var(--bg3);color:var(--text2);font-size:13px;font-family:inherit;padding:7px 11px;border-radius:8px;cursor:pointer}
  .price-use:active{background:var(--bg2)}
  .price-del{border:.5px solid var(--border2);background:var(--bg3);color:var(--text3);font-size:13px;padding:7px 9px;border-radius:8px;cursor:pointer}
  .price-del:active{background:#3A1818;color:var(--danger)}

  .cost-split-bar{display:flex;height:22px;border-radius:7px;overflow:hidden;margin:4px 0 12px;background:var(--bg3)}
  .cost-split-mat{background:var(--green);min-width:2px}
  .cost-split-waste{background:var(--accent);min-width:2px}
  .cost-split-legend{display:flex;flex-direction:column;gap:6px}
  .cost-split-item{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2)}
  .cost-dot{width:11px;height:11px;border-radius:3px;flex-shrink:0}

  .empty-proj{color:var(--text3);font-size:13px;line-height:1.6;padding:10px 0}
</style>
