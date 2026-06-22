// Daten-Übergabe zwischen Modulen (z. B. Korpus → Zuschnitt-Optimierer).
// Das Zielmodul holt die Daten beim Mounten ab und leert den Puffer.
let cutlistParts = null;

export const handoff = {
  sendToCutlist(parts) { cutlistParts = parts; },
  consumeCutlistParts() { const p = cutlistParts; cutlistParts = null; return p; }
};
