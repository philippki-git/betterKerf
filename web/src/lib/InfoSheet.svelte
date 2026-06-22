<script>
  // Bottom-Sheet zur Erklärung von Optionen. items: [{title, html}]
  let { open = $bindable(false), title = '', items = [] } = $props();
  function close() { open = false; }
</script>

<div class="sheet-overlay" class:show={open}>
  <div class="sheet-backdrop" onclick={close} role="presentation"></div>
  <div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><span>{title}</span><button class="zoom-close" onclick={close} aria-label="Schließen">×</button></div>
    <div class="sheet-body">
      {#each items as it}
        <div class="info-item">
          <div class="info-item-title">{it.title}</div>
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <div class="info-item-txt">{@html it.html}</div>
        </div>
      {/each}
    </div>
  </div>
</div>
