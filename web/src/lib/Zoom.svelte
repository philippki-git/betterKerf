<script>
  import { zoomState, closeZoom } from './zoom.svelte.js';

  let scale = $state(1);
  let panX = $state(0), panY = $state(0);

  // Reset transform whenever a new image opens
  $effect(() => { if (zoomState.current) { scale = 1; panX = 0; panY = 0; } });

  // ── Scroll-Wheel-Zoom (Desktop) ──
  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.max(1, Math.min(8, scale * factor));
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    panX = cx - (cx - panX) * (newScale / scale);
    panY = cy - (cy - panY) * (newScale / scale);
    scale = newScale;
  }

  // ── Pinch + Drag (Touch / Pointer) ──
  const ptrs = new Map();
  let lastDist = 0;
  let dragRef = null;
  let didDrag = false;

  function ptrDown(e) {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (ptrs.size === 1) { dragRef = { x: e.clientX, y: e.clientY }; didDrag = false; }
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; lastDist = Math.hypot(b.x - a.x, b.y - a.y); }
  }

  function ptrMove(e) {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (lastDist) {
        const newScale = Math.max(1, Math.min(8, scale * d / lastDist));
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = mid.x - rect.left - rect.width / 2;
        const cy = mid.y - rect.top - rect.height / 2;
        panX = cx - (cx - panX) * (newScale / scale);
        panY = cy - (cy - panY) * (newScale / scale);
        scale = newScale;
      }
      lastDist = d;
    } else if (ptrs.size === 1 && dragRef) {
      const dx = e.clientX - dragRef.x, dy = e.clientY - dragRef.y;
      if (Math.hypot(dx, dy) > 4) didDrag = true;
      panX += dx; panY += dy;
      dragRef = { x: e.clientX, y: e.clientY };
    }
  }

  function ptrUp(e) {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) lastDist = 0;
    if (ptrs.size === 0) dragRef = null;
  }

  function onClick(e) {
    if (!didDrag && e.target === e.currentTarget) closeZoom();
  }
</script>

<div class="zoom-overlay" class:show={!!zoomState.current} role="presentation">
  {#if zoomState.current}
    <div class="zoom-bar">
      <span>{zoomState.current.caption}</span>
      <button class="zoom-close" onclick={closeZoom} aria-label="Schließen">×</button>
    </div>
    <div
      class="zoom-stage"
      style="touch-action:none;cursor:{scale > 1 ? 'grab' : 'default'}"
      onwheel={onWheel}
      onpointerdown={ptrDown}
      onpointermove={ptrMove}
      onpointerup={ptrUp}
      onpointercancel={ptrUp}
      onclick={onClick}
      role="presentation"
    >
      <div style="transform:translate({panX}px,{panY}px) scale({scale});transform-origin:center center;transition:none;will-change:transform">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html zoomState.current.svg}
      </div>
    </div>
  {/if}
</div>
