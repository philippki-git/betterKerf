// Daten-Übergabe zwischen Modulen (z. B. Korpus → Zuschnitt, Schublade → Bohrloch).
// Das Zielmodul holt die Daten beim Mounten ab und leert den Puffer.
let cutlistParts = null;
let holesData = null;

export const handoff = {
  sendToCutlist(parts) { cutlistParts = parts; },
  consumeCutlistParts() { const p = cutlistParts; cutlistParts = null; return p; },
  sendToHoles(data) { holesData = data; },
  consumeHolesData() { const d = holesData; holesData = null; return d; }
};
