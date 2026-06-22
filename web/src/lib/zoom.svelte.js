// Steuerung des Zoom-Overlays für Plan-/Schablonen-SVGs.
let zoom = $state(null); // {svg, caption}

export const zoomState = { get current() { return zoom; } };
export function openZoom(svg, caption = 'Ansicht') { zoom = { svg, caption }; }
export function closeZoom() { zoom = null; }
