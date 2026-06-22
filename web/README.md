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
    modules/
      Holes.svelte        Modul „Bohrlochplaner" (migriert)
```

## Migrationsstand

| Modul | Status |
|-------|--------|
| 🎯 Bohrlochplaner | ✅ migriert (Reihe + Raster, ohne PDF-Export) |
| 📐 Zuschnitt-Optimierer | ⏳ offen |
| 🗄️ Korpusplaner | ⏳ offen |
| 🧰 Schubladenplaner | ⏳ offen |
| 💰 Kostenkalkulator | ⏳ offen |
| ♻️ Reststück-Lager | 💡 geplant |

### Noch offen
- PDF-Export & 1:1-Schablonen-PDF (jsPDF) für den Bohrlochplaner
- PWA-Assets (`manifest.json`, `icons/`, Service Worker) in `web/public/` übernehmen
- GitHub-Pages-Deploy auf den Build-Output umstellen (Cutover)
