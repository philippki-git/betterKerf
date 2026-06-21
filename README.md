# betterKerf

**betterKerf** ist ein mobiler Werkstatt-Rechner für die Holzbearbeitung — als Progressive Web App (PWA) konzipiert, läuft komplett offline und speichert alle Daten lokal auf dem Gerät. Keine Anmeldung, keine Cloud, keine Abhängigkeiten.

➡️ **[Zur App](https://philippki-git.github.io/betterKerf/)**

---

## Inhaltsverzeichnis

- [Nutzung und Installation auf dem iPhone](#nutzung-und-installation-auf-dem-iphone)
- [Module](#module)
  - [📐 Zuschnitt-Optimierer](#-zuschnitt-optimierer)
  - [🗄️ Korpusplaner](#️-korpusplaner)
  - [🧰 Schubladenplaner](#-schubladenplaner)
  - [🎯 Bohrlochplaner](#-bohrlochplaner)
  - [💰 Kostenkalkulator](#-kostenkalkulator)
- [Wie die Module zusammenarbeiten](#wie-die-module-zusammenarbeiten)
- [Einstellungen](#einstellungen)
- [Technisch](#technisch)

---

## 📲 Nutzung und Installation auf dem iPhone

betterKerf läuft direkt im Browser — einfach den Link öffnen und loslegen. Für den besten Komfort empfiehlt sich die Installation als App auf dem iPhone: Sie läuft dann vollständig offline, startet ohne Browser-Oberfläche und ist jederzeit direkt vom Home-Bildschirm erreichbar.

**Im Browser nutzen:** Link in Safari öffnen — fertig.

**Als App installieren (empfohlen):**

1. Safari öffnen und die Seite aufrufen
2. Teilen-Menü öffnen — entweder:
   - auf das Teilen-Symbol **⬆** in der unteren Symbolleiste tippen, **oder**
   - auf neueren iPhones (iOS 17+): die **Webseitenadresse in der URL-Leiste lange gedrückt halten**
3. **„Zum Home-Bildschirm"** antippen
4. Die App erscheint als Icon und läuft danach komplett offline

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

### 🗄️ Korpusplaner
Berechnet aus den Außenmaßen eines Korpus automatisch alle Zuschnittmaße für die Einzelteile.

- Eingabe: Höhe, Breite, Tiefe, Plattenstärke, Rückwandstärke
- Konstruktionsart wählbar: **Seiten durchgehend** oder **Boden/Deckel durchgehend**
- Vier Rückwand-Varianten: eingenutet, eingelassen, aufgesetzt oder keine
- Trennwände (Mittelseiten) und Einlegeböden konfigurierbar
- Ausgabe: vollständige Zuschnittliste aller Teile mit Maßen und Stückzahl
- Projekte lokal speichern und wieder laden

### 🧰 Schubladenplaner
Berechnet aus den lichten Maßen einer Korpusöffnung und dem gewählten Auszugssystem automatisch die Zuschnittmaße eines kompletten Schubkastens.

- Eingabe: lichte Breite, Höhe und Korpustiefe der Öffnung
- Auszugssystem wählbar: **Kugel-/Teleskopauszug** (Seitenmontage), **Unterflur-/Vollauszug**, **Holzläufer** oder **ohne Schiene** — mit passenden Luftmaßen je System (editierbar) und Erklärungen
- Normierte Auszugslängen per Schnellwahl, automatische Warnung wenn die Schiene nicht in die Korpustiefe passt (inkl. Vorschlag der größten passenden Nennlänge)
- Schubkasten-Bauart (Seiten durchgehend / Front+Rückwand durchgehend) und Bodenmontage (eingenutet / untergeschraubt) konfigurierbar
- Optionale sichtbare Frontblende (überfälzt oder eingelassen) inklusive Griffbohrung
- Ausgabe: maßstäbliche Skizze (Vorder- und Draufsicht), vollständige Zuschnittliste, Schienen-Einkaufsliste und kontextabhängige Bau-Anleitung
- Übernahme in den Zuschnitt-Optimierer, Übergabe der Griffbohrung an den Bohrlochplaner, PDF-Export und lokale Projekte

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

> **Geplant — ♻️ Reststück-Lager:** Nutzbare Reststücke aus Projekten speichern und in Folgeprojekten automatisch mit einplanen.

---

## Wie die Module zusammenarbeiten

Die Module sind bewusst miteinander verknüpft:

1. **Korpusplaner → Zuschnitt-Optimierer:** Die Zuschnittliste aus dem Korpusplaner kann direkt in den Zuschnitt-Optimierer übernommen werden — mit einem Klick werden alle Teile als Eingabe übertragen.

2. **Schubladenplaner → Zuschnitt-Optimierer:** Auch die Schubkasten-Teile (Seiten, Front, Rückwand, Boden und optionale Frontblende) lassen sich mit einem Klick als Zuschnittliste übernehmen.

3. **Schubladenplaner → Bohrlochplaner:** Die Griffbohrung der Frontblende kann direkt an den Bohrlochplaner übergeben werden — Lochabstand und Position werden vorbelegt und als 1:1-Schablone ausgegeben.

4. **Zuschnitt-Optimierer → Kostenkalkulator:** Nach einer Berechnung im Zuschnitt-Optimierer können die verwendeten Bretter automatisch in den Kostenkalkulator übernommen werden, um den Materialpreis sofort zu kalkulieren.

5. **Globale Einheit:** Die gewählte Maßeinheit (mm, cm, m) gilt für alle Module gleichzeitig. Intern wird immer in Millimetern gerechnet; die Umrechnung erfolgt nur in der Anzeige. Die Sägeblattbreite (Kerf) bleibt immer in mm.

---

## Einstellungen

- **Maßeinheit:** mm, cm oder m — wird auf dem Gerät gespeichert
- **Schnittbreite (Kerf):** Materialverlust pro Schnitt in mm
- **Schnittmodus:** Guillotine (Tischkreissäge) oder freie Schnitte (CNC)
- **Automatische Drehung:** Teile werden bei Platzeinsparung um 90° gedreht (mit ↻ markiert)
- **Optimierungsziel:** wenigster Verschnitt oder wenigste Bretter

---

## Technisch

> ⚠️ **v0.9.0 — In aktiver Entwicklung.** Die App ist funktionsfähig, aber noch nicht feature-complete. Feedback und Issues sind willkommen.

- Reines HTML/CSS/JavaScript — keine Frameworks, keine Build-Tools
- PWA mit Service Worker (Offline-Nutzung)
- Alle Daten lokal via `localStorage`
- Optimiert für iOS Safari (iPhone)

> **Hinweis PDF-Export:** Beim allerersten PDF-Export wird die Bibliothek [jsPDF](https://github.com/parallax/jsPDF) einmalig aus dem Internet nachgeladen (~300 KB). Danach steht der Export vollständig offline zur Verfügung.
