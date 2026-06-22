<script>
  import { zoomState, closeZoom } from './zoom.svelte.js';
</script>

<div class="zoom-overlay" class:show={!!zoomState.current}>
  {#if zoomState.current}
    <div class="zoom-bar">
      <span>{zoomState.current.caption}</span>
      <button class="zoom-close" onclick={closeZoom} aria-label="Schließen">×</button>
    </div>
    <div class="zoom-stage">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html zoomState.current.svg}
    </div>
  {/if}
</div>
