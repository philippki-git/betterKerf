// Gemeinsame PDF-Helfer: jsPDF lazy laden + SVG → PNG für scharfen Druck.
import { showAlert } from './dialog.svelte.js';

// jsPDF wird erst bei Bedarf nachgeladen (UMD-Bundle aus public/).
export function loadJsPDF(cb) {
  if (window.jspdf && window.jspdf.jsPDF) { cb(); return; }
  const s = document.createElement('script');
  s.src = './jspdf.umd.min.js';
  s.onload = cb;
  s.onerror = () => showAlert('jsPDF konnte nicht geladen werden.', { title: 'Fehler', icon: 'alert_circle', danger: true });
  document.body.appendChild(s);
}

// Ein Inline-<svg> in eine PNG-Data-URL rastern (sf = Auflösungsfaktor).
export function svgToPng(svgEl, sf = 3) {
  return new Promise((resolve, reject) => {
    try {
      const clone = svgEl.cloneNode(true);
      const vb = (svgEl.getAttribute('viewBox') || '').split(/\s+/).map(Number);
      const w = vb[2] || svgEl.clientWidth || 300;
      const h = vb[3] || svgEl.clientHeight || 150;
      clone.setAttribute('width', w); clone.setAttribute('height', h);
      const xml = new XMLSerializer().serializeToString(clone);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w * sf; canvas.height = h * sf;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ data: canvas.toDataURL('image/png'), w, h });
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    } catch (e) { reject(e); }
  });
}
