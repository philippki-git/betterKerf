// Modul-Registry. Migrierte Module besitzen eine `component`; noch nicht
// portierte stehen auf status:'soon', bis sie an die Reihe kommen.
import Holes from '../modules/Holes.svelte';
import Cutlist from '../modules/Cutlist.svelte';
import Korpus from '../modules/Korpus.svelte';

export const MODULES = [
  {
    id: 'cutlist', title: 'Zuschnitt-Optimierer', sub: 'Plattenzuschnitt & Schnittplan', icon: 'carpenter',
    desc: 'Optimaler Zuschnitt aus Brettern mit minimalem Verschnitt, Schnittplan und Anleitung.',
    status: 'ready', component: Cutlist
  },
  {
    id: 'korpus', title: 'Korpusplaner', sub: 'Schränke & Möbel planen', icon: 'shelves',
    desc: 'Aus Außenmaßen automatisch die Zuschnittliste für Korpusteile (Seiten, Boden, Deckel, Rückwand) berechnen.',
    status: 'ready', component: Korpus
  },
  {
    id: 'drawer', title: 'Schubladenplaner', sub: 'Schubkästen & Auszüge planen', icon: 'drawer',
    desc: 'Aus Korpusöffnung und Auszugssystem automatisch die Zuschnittmaße eines Schubkastens berechnen.',
    status: 'soon'
  },
  {
    id: 'holes', title: 'Bohrlochplaner', sub: 'Bohrungen gleichmäßig verteilen', icon: 'adjust',
    desc: 'Abstände für eine Reihe oder ein Raster von Bohrungen nach Anzahl und Materialmaß berechnen.',
    status: 'ready', component: Holes
  },
  {
    id: 'rest', title: 'Reststück-Lager', sub: 'Verschnitt wiederverwenden', icon: 'recycling',
    desc: 'Nutzbare Reststücke speichern und in Folgeprojekten automatisch mit einplanen.',
    status: 'soon'
  },
  {
    id: 'cost', title: 'Kostenkalkulator', sub: 'Preis & Verschnittwert', icon: 'calculate',
    desc: 'Kosten pro Teil und Geldwert des Verschnitts aus dem Plattenpreis berechnen.',
    status: 'soon'
  }
];
