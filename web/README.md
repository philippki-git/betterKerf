# betterKerf — Svelte-Version (in Migration)

Schrittweise Neuimplementierung von betterKerf mit **Svelte 5 + Vite**.
Die bestehende Single-File-App im Repo-Root (`betterKerf.html`) bleibt
unverändert live, bis diese Version Funktionsparität erreicht hat.

## Entwicklung

```bash
cd web
npm install      # einmalig
npm run dev      # Dev-Server mit Hot-Reload → http://localhost:5173
npm run build    # Produktions-Build nach dist/
npm run preview  # gebauten Stand lokal testen
```

## Struktur

```
web/
  index.html              Vite-Einstiegspunkt (mountet #app)
  src/
    main.js               Bootstrap (mount App)
    app.css               Design-Tokens & Komponenten-CSS (1:1 aus Legacy-App)
    App.svelte            Shell: Header, Routing, Swipe-Back
    lib/
      units.svelte.js     Globale Einheiten (mm/cm/m), reaktiv
      icons.js / Icon.svelte   Material-Design-Icon-Pfade
      dialog.svelte.js    showAlert / showConfirm / showToast
      Dialog/Toast/Zoom.svelte Overlays
      zoom.svelte.js      Zoom-Steuerung für SVG-Schablonen
      modules.js          Modul-Registry (status: 'ready' | 'soon')
      Home.svelte         Startseite (Modul-Grid)
      Settings.svelte     Einstellungen + Rechtliches
      holes.js            Reine Bohrloch-Mathematik (DOM-frei)
      cutlist.js          Reine Zuschnitt-Optimierung (Bin-Packing, DOM-frei)
      cutlistProjects.svelte.js  Gespeicherte Projekte (localStorage, reaktiv)
      korpus.js           Reine Korpus-Geometrie, Skizze & Bau-Anleitung (DOM-frei)
      korpusProjects.svelte.js   Gespeicherte Korpus-Projekte (localStorage, reaktiv)
      pdf.js              jsPDF lazy laden + SVG→PNG (gemeinsam genutzt)
      nav.svelte.js       Modul-übergreifende Navigationsanforderung
      handoff.svelte.js   Daten-Übergabe zwischen Modulen (Korpus → Zuschnitt)
      InfoSheet.svelte    Wiederverwendbares Info-Bottom-Sheet
    modules/
      Holes.svelte        Modul „Bohrlochplaner" (migriert)
      Cutlist.svelte      Modul „Zuschnitt-Optimierer" (migriert)
      Korpus.svelte       Modul „Korpusplaner" (migriert)
```

## Migrationsstand

| Modul | Status |
|-------|--------|
| 📐 Zuschnitt-Optimierer | ✅ migriert (Optimierung, Projekte, PDF) |
| 🎯 Bohrlochplaner | ✅ migriert (Reihe + Raster, PDF & 1:1-Schablone) |
| 🗄️ Korpusplaner | ✅ migriert (Skizze, Anleitung, Projekte, PDF, Übergabe) |
| 🧰 Schubladenplaner | ⏳ offen |
| 💰 Kostenkalkulator | ⏳ offen |
| ♻️ Reststück-Lager | 💡 geplant |

### Noch offen
- Schubladenplaner und Kostenkalkulator portieren
- PWA-Assets (`manifest.json`, `icons/`, Service Worker) in `web/public/` übernehmen
- GitHub-Pages-Deploy auf den Build-Output umstellen (Cutover)

### Hinweis: Optimierer-Einstellungen
Kerf, Schnittmodus, Rotation und Optimierungsziel liegen in der Svelte-Version
direkt im Modul (Tab „Eingabe") statt im globalen Einstellungs-Screen wie in der
Legacy-App — so ist alles zum Zuschnitt an einem Ort und wird mit dem Projekt
gespeichert.
