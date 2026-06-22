<script>
  import { units, UNITS } from './units.svelte.js';
  import { cutlistSettings } from './cutlistSettings.svelte.js';
  let legal = $state(null); // 'privacy' | 'disclaimer' | null
</script>

<div class="screen active">
  <div class="home-wrap">
    <div class="section">
      <div class="slabel">Maßeinheit</div>
      <div class="hint-box">Gilt für alle Module. Intern wird in Millimetern gerechnet; nur Ein- und Ausgabe werden umgerechnet. Die Sägeblattbreite (Kerf) bleibt immer in mm.</div>
      <div class="unit-bar">
        <span class="unit-bar-label">Einheit</span>
        <div class="unit-chips">
          {#each Object.keys(UNITS) as u}
            <button class="unit-chip" class:active={u === units.current} onclick={() => units.current = u}>{UNITS[u].label}</button>
          {/each}
        </div>
      </div>
      <div class="info-note">Die gewählte Einheit wird auf diesem Gerät gespeichert und bleibt nach dem Schließen erhalten.</div>
    </div>

    <div class="section" style="margin-top:22px">
      <div class="slabel">Zuschnittoptimierer</div>
      <div class="hint-box">Diese Einstellungen gelten für alle Berechnungen im Zuschnittoptimierer und werden auf diesem Gerät gespeichert. Beim Laden eines Projekts werden sie durch die gespeicherten Projektwerte überschrieben.</div>
      <div class="srow"><div><div class="srow-label">Schnittbreite (Kerf)</div><div class="srow-hint">Materialverlust pro Schnitt — immer in mm</div></div><div class="nm"><input type="number" bind:value={cutlistSettings.kerf} min="0" max="10" step="0.5"><span>mm</span></div></div>
      <div class="srow srow-col" style="margin-top:6px">
        <div class="srow-label">Schnittmodus</div>
        <div class="radio-group">
          <label class="radio-lbl"><input type="radio" name="cut-mode" value="guillotine" bind:group={cutlistSettings.mode}> Guillotinenschnitte (Tischkreissäge)</label>
          <label class="radio-lbl"><input type="radio" name="cut-mode" value="free" bind:group={cutlistSettings.mode}> Freie Schnitte (CNC)</label>
        </div>
        <div class="srow-hint" style="margin-top:0">Guillotine = durchgehende gerade Schnitte, kein Umsetzen nötig</div>
      </div>
      <div class="srow" style="margin-top:6px"><div><div class="srow-label">Teile automatisch drehen</div><div class="srow-hint">90°-Rotation wenn platzsparender — mit ↻ markiert</div></div><input type="checkbox" class="toggle" bind:checked={cutlistSettings.allowRotate}></div>
      <div class="srow srow-col" style="margin-top:6px">
        <div class="srow-label">Optimierungsziel</div>
        <div class="radio-group">
          <label class="radio-lbl"><input type="radio" name="cut-optmode" value="waste" bind:group={cutlistSettings.optmode}> Wenigster Verschnitt</label>
          <label class="radio-lbl"><input type="radio" name="cut-optmode" value="boards" bind:group={cutlistSettings.optmode}> Wenigste Bretter</label>
        </div>
        <div class="srow-hint" style="margin-top:0">Verschnitt = kleinste genutzte Materialfläche. Wenigste Bretter = lieber ein großes Brett statt mehrerer kleiner, auch wenn etwas mehr Verschnitt entsteht.</div>
      </div>
    </div>

    <div class="section" style="margin-top:22px">
      <div class="slabel">Rechtliches</div>
      <button class="module-card" style="border-radius:12px" onclick={() => legal = 'privacy'}>
        <div class="mc-body">
          <div class="mc-title">Datenschutzerklärung</div>
          <div class="mc-desc">Wie diese App mit deinen Daten umgeht</div>
        </div>
        <div class="mc-arrow">›</div>
      </button>
      <button class="module-card" style="border-radius:12px;margin-top:8px" onclick={() => legal = 'disclaimer'}>
        <div class="mc-body">
          <div class="mc-title">Haftungsausschluss</div>
          <div class="mc-desc">Hinweise zur Nutzung der Berechnungen</div>
        </div>
        <div class="mc-arrow">›</div>
      </button>
    </div>
  </div>
</div>

{#if legal}
  <div class="legal-overlay open" onclick={(e) => { if (e.target === e.currentTarget) legal = null; }} role="presentation">
    <div class="legal-sheet">
      <div class="legal-header">
        <h2>{legal === 'privacy' ? 'Datenschutzerklärung' : 'Haftungsausschluss'}</h2>
        <button class="legal-close" onclick={() => legal = null}>×</button>
      </div>
      <div class="legal-body">
        {#if legal === 'disclaimer'}
          <p>Die Berechnungen dieser App — einschließlich Schnittoptimierung, Maße, Materialmengen und Kostenabschätzungen — dienen ausschließlich als Planungshilfe.</p>
          <p>Ergebnisse können je nach Material, Maschine, Sägeblatt und handwerklicher Ausführung abweichen. Die tatsächliche Effizienz eines Schnitts hängt von zahlreichen Faktoren ab, die die App nicht kennt.</p>
          <p>Alle Angaben sind vor der Umsetzung eigenverantwortlich zu prüfen. Eine Haftung für Schäden materieller oder anderer Art, die aus der Nutzung oder Nichtnutzung der bereitgestellten Informationen entstehen, wird ausgeschlossen, soweit gesetzlich zulässig.</p>
        {:else}
          <h3>1. Allgemeines</h3>
          <p>betterKerf ist eine Progressive Web App (PWA) für Berechnungen in der Holzbearbeitung. Die App verarbeitet keine personenbezogenen Daten und sendet keine Nutzerdaten an externe Server.</p>
          <h3>2. Lokale Datenspeicherung</h3>
          <p>Die App speichert Projektdaten sowie Einstellungen ausschließlich im <strong>localStorage</strong> deines Browsers auf deinem Gerät. Diese Daten verlassen dein Gerät nicht und sind nur für dich zugänglich. Du kannst sie jederzeit über die Browsereinstellungen löschen.</p>
          <h3>3. Hosting & Server-Logs</h3>
          <p>betterKerf wird über <strong>GitHub Pages</strong> bereitgestellt. Beim Aufruf protokolliert GitHub automatisch technische Zugriffsdaten (u.&nbsp;a. IP-Adresse, Zeitstempel, aufgerufene Seite). Darauf haben wir keinen Einfluss.</p>
          <h3>4. Cookies</h3>
          <p>Die App setzt keine Cookies.</p>
        {/if}
      </div>
    </div>
  </div>
{/if}
