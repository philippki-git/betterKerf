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

// PDF speichern: Web Share API auf iOS (verhindert Zoom-Bug), direkter
// Download per <a> auf allen anderen Plattformen.
export async function savePDF(doc, filename) {
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  if (isIOS) {
    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  }
  doc.save(filename);
}

// App-Logo links neben den Titel zeichnen. x/y = Titelbasislinie (wie doc.text).
// Gibt den x-Offset zurück, den der Titeltext nach rechts einrücken soll.
export const LOGO_MM = 7;      // Quadratgröße in mm
export const LOGO_GAP = 2.5;   // Abstand Logo → Text in mm
export function addLogoToDoc(doc, x, y) {
  return new Promise(resolve => {
    const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="#1B1A1C"/>
      <rect x="76" y="76" width="242" height="242" rx="18" fill="#2E7D5E"/>
      <rect x="334" y="76" width="102" height="242" rx="14" fill="#3E9E74" opacity=".55"/>
      <rect x="76" y="334" width="360" height="102" rx="14" fill="#3E9E74" opacity=".45"/>
    </svg>`;
    const size = 128;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      c.getContext('2d').drawImage(img, 0, 0, size, size);
      // Logo oben an der Titelbasislinie ausrichten (Basislinie ≈ Unterkante)
      doc.addImage(c.toDataURL('image/png'), 'PNG', x, y - LOGO_MM, LOGO_MM, LOGO_MM);
      resolve(LOGO_MM + LOGO_GAP);
    };
    img.onerror = () => resolve(0);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SVG);
  });
}

// Helle App-Textfarben → druckbare Dunkelfarben für PDF-Rendering auf weißem Grund.
const PDF_COLOR_MAP = [
  ['#F2EEE8', '#1A1A1A'],
  ['#B0ADA6', '#555555'],
  [/rgba\(176,173,166,[^)]+\)/g, 'rgba(60,60,60,.5)'],
];

// Ein Inline-<svg> in eine PNG-Data-URL rastern (sf = Auflösungsfaktor).
// forPDF=true tauscht helle App-Textfarben gegen druckbare Dunkelfarben.
export function svgToPng(svgEl, sf = 3, forPDF = false) {
  return new Promise((resolve, reject) => {
    try {
      const clone = svgEl.cloneNode(true);
      const vb = (svgEl.getAttribute('viewBox') || '').split(/\s+/).map(Number);
      const w = vb[2] || svgEl.clientWidth || 300;
      const h = vb[3] || svgEl.clientHeight || 150;
      clone.setAttribute('width', w); clone.setAttribute('height', h);
      let xml = new XMLSerializer().serializeToString(clone);
      if (forPDF) PDF_COLOR_MAP.forEach(([from, to]) => { xml = xml.replaceAll(from, to); });
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
