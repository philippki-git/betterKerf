<script>
  import Icon from './Icon.svelte';
  import { MODULES } from './modules.js';
  let { onopen } = $props();
</script>

<div class="screen active">
  <div class="home-wrap">
    <div class="home-intro">Eine Sammlung von Rechnern für die Holzbearbeitung. Wähle ein Modul, um zu starten.</div>
    <div class="module-grid">
      {#each MODULES as m}
        {@const ready = m.status === 'ready'}
        <button class="module-card" class:disabled={!ready} onclick={() => ready && onopen(m.id)}>
          <div class="mc-icon"><Icon name={m.icon} size={26} /></div>
          <div class="mc-body">
            <div class="mc-title">{m.title}{#if !ready}<span class="mc-soon">Bald</span>{/if}</div>
            <div class="mc-desc">{m.desc}</div>
          </div>
          {#if ready}<div class="mc-arrow">›</div>{/if}
        </button>
      {/each}
    </div>
    <div class="home-foot">betterKerf · läuft offline · Daten bleiben auf diesem Gerät</div>
  </div>
</div>
