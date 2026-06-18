# betterKerf

**betterKerf** ist ein mobiler Werkstatt-Rechner für die Holzbearbeitung — als Progressive Web App (PWA) konzipiert, läuft komplett offline und speichert alle Daten lokal auf dem Gerät. Keine Anmeldung, keine Cloud, keine Abhängigkeiten.

🌐 **Live:** [philippki-git.github.io/betterKerf](https://philippki-git.github.io/betterKerf/)

---

## Inhaltsverzeichnis

- [Module](#module)
  - [📐 Zuschnitt-Optimierer](#-zuschnitt-optimierer)
  - [🎯 Bohrlochplaner](#-bohrlochplaner)
  - [💰 Kostenkalkulator](#-kostenkalkulator)
  - [🗄️ Korpusplaner](#️-korpusplaner)
  - [♻️ Reststück-Lager](#️-reststück-lager)
- [Wie die Module zusammenarbeiten](#wie-die-module-zusammenarbeiten)
- [Installation auf dem iPhone](#installation-auf-dem-iphone)
- [Einstellungen](#einstellungen)
- [Status](#status)
- [Technisch](#technisch)

---

## Module

### 📐 Zuschnitt-Optimierer
Berechnet den optimalen Zuschnittplan aus vorhandenen Brettern für eine Liste benötigter Teile — mit minimalem Materialverlust.

- Bretter und Teile mit Namen, Maßen und Stückzahl erfassen
- Maserungsrichtung pro Teil festlegbar (verhindert ungewollte Drehung)
- Zwei Schnittmodi: **Guillotinenschnitte** (Tischkreissäge) oder **freie Schnitte** (CNC)
- Optimierungsziel wählbar: wenigster Verschnitt oder wenigste Bretter
- Ergebnis als visueller Schnittplan mit Zoom-Ansicht
- Schritt-für-Schritt-Anleitung für die Ausführung am Sägetisch
- Projekte lokal speichern und später wieder laden

### 🎯 Bohrlochplaner
Berechnet gleichmäßige Bohrungsabstände für eine Lochreihe oder ein Lochraster.

- **Reihenmodus:** Anzahl Löcher auf einer definierten Strecke gleichmäßig verteilen — mit optionalem Randabstand (symmetrisch oder individuell)
- **Rastermodus:** 2D-Bohrungsraster auf einer Platte berechnen (Spalten × Reihen), mit separatem Rand in X und Y
- Optionaler Lochdurchmesser für maßstäbliche Darstellung und Randabstands-Warnung
- Ausgabe als 1:1-Schablone (SVG), die man direkt auf dem Gerät ansehen oder zoomen kann

### 💰 Kostenkalkulator
Berechnet den Materialpreis pro Projekt und den Geldwert des anfallenden Verschnitts.

- Preis pro Brett als Stückpreis oder pro m² eingeben
- Unterstützt mehrere Bretter mit unterschiedlichen Preisen
- Preisliste für häufig verwendete Materialien speicherbar
- Hochrechnung für Kleinserien: Multiplikator für Stückzahl
- Kann direkt aus dem Zuschnitt-Optimierer befüllt werden — die Bretter aus dem Schnittplan werden übernommen

### 🗄️ Korpusplaner
Berechnet aus den Außenmaßen eines Korpus automatisch alle Zuschnittmaße für die Einzelteile.

- Eingabe: Höhe, Breite, Tiefe, Plattenstärke, Rückwandstärke
- Konstruktionsart wählbar: **Seiten durchgehend** oder **Boden/Deckel durchgehend**
- Vier Rückwand-Varianten: eingenutet, eingelassen, aufgesetzt oder keine
- Trennwände (Mittelseiten) und Einlegeböden konfigurierbar
- Ausgabe: vollständige Zuschnittliste aller Teile mit Maßen und Stückzahl
- Projekte lokal speichern und wieder laden

### ♻️ Reststück-Lager
> ⏳ **In Entwicklung** — noch nicht verfügbar.

Speichert nutzbare Reststücke aus Projekten und plant sie in Folgeprojekten automatisch mit ein.

---

## Wie die Module zusammenarbeiten

Die Module sind bewusst miteinander verknüpft:

1. **Korpusplaner → Zuschnitt-Optimierer:** Die Zuschnittliste aus dem Korpusplaner kann direkt in den Zuschnitt-Optimierer übernommen werden — mit einem Klick werden alle Teile als Eingabe übertragen.

2. **Zuschnitt-Optimierer → Kostenkalkulator:** Nach einer Berechnung im Zuschnitt-Optimierer können die verwendeten Bretter automatisch in den Kostenkalkulator übernommen werden, um den Materialpreis sofort zu kalkulieren.

3. **Globale Einheit:** Die gewählte Maßeinheit (mm, cm, m) gilt für alle Module gleichzeitig. Intern wird immer in Millimetern gerechnet; die Umrechnung erfolgt nur in der Anzeige. Die Sägeblattbreite (Kerf) bleibt immer in mm.

---

## Installation auf dem iPhone

1. Safari öffnen und [philippki-git.github.io/betterKerf](https://philippki-git.github.io/betterKerf/) aufrufen
2. Teilen-Symbol antippen → **"Zum Home-Bildschirm"**
3. Die App erscheint als Icon und läuft danach komplett offline

---

## Einstellungen

- **Maßeinheit:** mm, cm oder m — wird auf dem Gerät gespeichert
- **Schnittbreite (Kerf):** Materialverlust pro Schnitt in mm
- **Schnittmodus:** Guillotine (Tischkreissäge) oder freie Schnitte (CNC)
- **Automatische Drehung:** Teile werden bei Platzeinsparung um 90° gedreht (mit ↻ markiert)
- **Optimierungsziel:** wenigster Verschnitt oder wenigste Bretter

---

## Status

> ⚠️ **v0.9.0 — In aktiver Entwicklung.** Die App ist funktionsfähig, aber noch nicht feature-complete. Feedback und Issues sind willkommen.

---

## Technisch

- Reines HTML/CSS/JavaScript — keine Frameworks, keine Build-Tools
- PWA mit Service Worker (Offline-Nutzung)
- Alle Daten lokal via `localStorage`
- Optimiert für iOS Safari (iPhone)

> **Hinweis PDF-Export:** Beim allerersten PDF-Export wird die Bibliothek [jsPDF](https://github.com/parallax/jsPDF) einmalig aus dem Internet nachgeladen (~300 KB). Danach steht der Export vollständig offline zur Verfügung.
