// Schubladenplaner — reine Geometrie, Skizze und Bau-Anleitung (DOM-frei).
// Alle Maße intern in mm. dispVal / unitLabel kommen aus units.svelte.js,
// werden aber erst beim Aufruf aus einem $derived-Kontext reaktiv.

import { dispVal, unitLabel } from './units.svelte.js';

export const DR_PRESETS = {
  ball:  { label: 'Kugel-/Teleskopauszug', clr: 12.5, hasSlide: true,  std: [250,300,350,400,450,500,550,600], lenLabel: 'Auszugslänge (Nennlänge)', lenHint: 'Nennlänge der Schiene — passend zur Korpustiefe' },
  under: { label: 'Unterflur-/Vollauszug',  clr: 21,   hasSlide: true,  std: [250,300,350,400,450,500,550],     lenLabel: 'Auszugslänge (Nennlänge)', lenHint: 'Nennlänge der Unterflurschiene — Herstellerangabe beachten' },
  wood:  { label: 'Holzläufer',             clr: 1.5,  hasSlide: false, lenLabel: 'Schubkasten-Tiefe',         lenHint: 'Tiefe des Schubkastens (max. Korpustiefe)' },
  none:  { label: 'Ohne Schiene',           clr: 0,    hasSlide: false, lenLabel: 'Schubkasten-Tiefe',         lenHint: 'Tiefe des Schubkastens (max. Korpustiefe)' }
};

// Größte Norm-Nennlänge, die noch in die Korpustiefe passt (≈10 mm Luft).
export function bestStd(sys, cdMM) {
  const std = DR_PRESETS[sys]?.std;
  if (!std) return 0;
  let best = 0;
  std.forEach(L => { if (L <= cdMM - 10 && L > best) best = L; });
  return best;
}

// Kernberechnung: liefert {parts, BW, BD, innerW, innerD, frontW, frontH}.
// o enthält alle Eingaben in mm (sys, OW, OH, CD, clr, slideLen, zt, bt, boxH,
// goff, gdepth, boxConstr, bottomMount, hasFront, frontType, frontGap,
// hasHandle, handleN, handleBc, handleDia).
export function drawerGeometry(o) {
  const parts = [];
  const add = (name, l, w, qty) => { if (qty > 0 && l > 0.1 && w > 0.1) parts.push({ name, l, w, qty }); };
  const BW = o.OW - 2 * o.clr;
  const BD = o.slideLen;
  if (o.boxConstr === 'sides') {
    add('Schubkasten-Seite',    BD,            o.boxH, 2);
    add('Schubkasten-Front',    BW - 2 * o.zt, o.boxH, 1);
    add('Schubkasten-Rückwand', BW - 2 * o.zt, o.boxH, 1);
  } else {
    add('Schubkasten-Front',    BW,            o.boxH, 1);
    add('Schubkasten-Rückwand', BW,            o.boxH, 1);
    add('Schubkasten-Seite',    BD - 2 * o.zt, o.boxH, 2);
  }
  const innerW = BW - 2 * o.zt, innerD = BD - 2 * o.zt;
  if (o.bottomMount === 'groove') add('Schubkasten-Boden', innerW + 2 * o.gdepth, innerD + 2 * o.gdepth, 1);
  else                            add('Schubkasten-Boden', BW,                    BD,                    1);
  let frontW = 0, frontH = 0;
  if (o.hasFront) {
    if (o.frontType === 'overlay') { frontW = o.OW + 2 * o.frontGap; frontH = o.OH + 2 * o.frontGap; }
    else                           { frontW = o.OW - 2 * o.frontGap; frontH = o.OH - 2 * o.frontGap; }
    add('Frontblende', frontW, frontH, 1);
  }
  return { parts, BW, BD, innerW, innerD, frontW, frontH };
}

// Maßstäbliche Skizze: Vorderansicht (B×H) + Draufsicht (B×T).
// Gibt {svg, legend} zurück — svg = SVG-Markup-String, legend = HTML-String.
export function drawerSketch(o, geo) {
  const BW = geo.BW, boxH = o.boxH, BD = geo.BD, zt = o.zt;
  const frontW = o.hasFront ? geo.frontW : 0;
  const frontH = o.hasFront ? geo.frontH : 0;
  const pad = 24, gap = 44, topLabel = 16;
  const refW = Math.max(BW, frontW, 1), refH = Math.max(boxH, BD, frontH, 1);
  const scale = Math.min(190 / refW, 150 / refH);
  const t = Math.max(2, zt * scale);
  const fW = BW * scale, fH = boxH * scale, dH = BD * scale;
  const frW = frontW * scale, frH = frontH * scale;
  const colW = Math.max(fW, frW);
  const oy = pad + topLabel;
  const ox = pad + (colW - fW) / 2;
  const cx = pad + colW / 2;
  const sx = pad + colW + gap;
  const blockH = Math.max(fH, frH, dH);
  const svgW = pad * 2 + colW + gap + fW;
  const svgH = oy + blockH + 26;
  const col = { body: '#2E7D5E', bodyFill: 'rgba(46,125,94,.18)', bottom: '#2E7D5E', front: '#C07A2E', txt: '#F2EEE8' };
  let p = '';
  if (o.hasFront) {
    const frx = cx - frW / 2, fry = oy + (blockH - frH) / 2;
    p += `<rect x="${frx.toFixed(1)}" y="${fry.toFixed(1)}" width="${frW.toFixed(1)}" height="${frH.toFixed(1)}" fill="rgba(192,122,46,.10)" stroke="${col.front}" stroke-width="1" stroke-dasharray="4 3"/>`;
  }
  const boxY = oy + (blockH - fH) / 2;
  p += `<rect x="${ox.toFixed(1)}" y="${boxY.toFixed(1)}" width="${fW.toFixed(1)}" height="${fH.toFixed(1)}" fill="${col.bodyFill}" stroke="${col.body}" stroke-width="1.2"/>`;
  if (o.bottomMount === 'groove' && o.goff > 0 && boxH > 0) {
    const gy = boxY + fH - o.goff * scale;
    if (gy > boxY + 2 && gy < boxY + fH - 1)
      p += `<line x1="${ox.toFixed(1)}" y1="${gy.toFixed(1)}" x2="${(ox + fW).toFixed(1)}" y2="${gy.toFixed(1)}" stroke="${col.bottom}" stroke-width="1" stroke-dasharray="3 2"/>`;
  }
  if (o.hasHandle && frH > 0) {
    const hy = oy + (blockH - frH) / 2 + frH * 0.3;
    const r = Math.max(1.6, (o.handleDia * scale) / 2);
    if (o.handleN === 2) {
      const half = (o.handleBc * scale) / 2;
      p += `<circle cx="${(cx - half).toFixed(1)}" cy="${hy.toFixed(1)}" r="${r.toFixed(1)}" fill="${col.front}"/>`;
      p += `<circle cx="${(cx + half).toFixed(1)}" cy="${hy.toFixed(1)}" r="${r.toFixed(1)}" fill="${col.front}"/>`;
    } else {
      p += `<circle cx="${cx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${r.toFixed(1)}" fill="${col.front}"/>`;
    }
  }
  p += `<text x="${cx.toFixed(1)}" y="${(oy + blockH + 16).toFixed(1)}" text-anchor="middle" font-size="10" fill="${col.txt}">Vorderansicht</text>`;
  p += `<text x="${cx.toFixed(1)}" y="${(oy - 5).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="${col.txt}">B ${dispVal(BW)}</text>`;
  p += `<text x="${(ox - 7).toFixed(1)}" y="${(boxY + fH / 2).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="${col.txt}" transform="rotate(-90 ${(ox - 7).toFixed(1)} ${(boxY + fH / 2).toFixed(1)})">H ${dispVal(boxH)}</text>`;
  const ty = oy + (blockH - dH) / 2;
  p += `<rect x="${sx.toFixed(1)}" y="${ty.toFixed(1)}" width="${fW.toFixed(1)}" height="${dH.toFixed(1)}" fill="${col.bodyFill}" stroke="${col.body}" stroke-width="1.2"/>`;
  p += `<rect x="${(sx + t).toFixed(1)}" y="${(ty + t).toFixed(1)}" width="${(fW - 2 * t).toFixed(1)}" height="${(dH - 2 * t).toFixed(1)}" fill="rgba(46,125,94,.14)"/>`;
  if (o.boxConstr === 'sides') {
    p += `<rect x="${sx.toFixed(1)}" y="${ty.toFixed(1)}" width="${t.toFixed(1)}" height="${dH.toFixed(1)}" fill="${col.body}" opacity=".55"/>`;
    p += `<rect x="${(sx + fW - t).toFixed(1)}" y="${ty.toFixed(1)}" width="${t.toFixed(1)}" height="${dH.toFixed(1)}" fill="${col.body}" opacity=".55"/>`;
    p += `<rect x="${(sx + t).toFixed(1)}" y="${ty.toFixed(1)}" width="${(fW - 2 * t).toFixed(1)}" height="${t.toFixed(1)}" fill="${col.body}" opacity=".55"/>`;
    p += `<rect x="${(sx + t).toFixed(1)}" y="${(ty + dH - t).toFixed(1)}" width="${(fW - 2 * t).toFixed(1)}" height="${t.toFixed(1)}" fill="${col.body}" opacity=".55"/>`;
  } else {
    p += `<rect x="${sx.toFixed(1)}" y="${ty.toFixed(1)}" width="${fW.toFixed(1)}" height="${t.toFixed(1)}" fill="${col.body}" opacity=".55"/>`;
    p += `<rect x="${sx.toFixed(1)}" y="${(ty + dH - t).toFixed(1)}" width="${fW.toFixed(1)}" height="${t.toFixed(1)}" fill="${col.body}" opacity=".55"/>`;
    p += `<rect x="${sx.toFixed(1)}" y="${(ty + t).toFixed(1)}" width="${t.toFixed(1)}" height="${(dH - 2 * t).toFixed(1)}" fill="${col.body}" opacity=".55"/>`;
    p += `<rect x="${(sx + fW - t).toFixed(1)}" y="${(ty + t).toFixed(1)}" width="${t.toFixed(1)}" height="${(dH - 2 * t).toFixed(1)}" fill="${col.body}" opacity=".55"/>`;
  }
  p += `<text x="${(sx + fW / 2).toFixed(1)}" y="${(oy + blockH + 16).toFixed(1)}" text-anchor="middle" font-size="10" fill="${col.txt}">Draufsicht (vorne unten)</text>`;
  p += `<text x="${(sx + fW + 7).toFixed(1)}" y="${(ty + dH / 2).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="${col.txt}" transform="rotate(-90 ${(sx + fW + 7).toFixed(1)} ${(ty + dH / 2).toFixed(1)})">T ${dispVal(BD)}</text>`;
  const svg = `<svg viewBox="0 0 ${Math.ceil(svgW)} ${Math.ceil(svgH)}" width="100%" preserveAspectRatio="xMidYMid meet" font-family="sans-serif">${p}</svg>`;
  let legend = `<div class="kp-legend"><span class="kp-leg"><i style="background:${col.body}"></i>Schubkasten</span><span class="kp-leg"><i style="background:${col.bottom}"></i>Boden</span>`;
  if (o.hasFront) legend += `<span class="kp-leg"><i style="background:${col.front}"></i>Frontblende</span>`;
  legend += `</div>`;
  return { svg, legend };
}

// Kontextabhängige Bau-Anleitung.
export function drawerGuide(o, geo) {
  const u = unitLabel();
  const preset = DR_PRESETS[o.sys] || DR_PRESETS.ball;
  const steps = [];
  steps.push('Alle Teile gemäß Zuschnittliste sauber und rechtwinklig zuschneiden. Maße noch einmal gegen Öffnung und Schiene prüfen.');
  if (o.bottomMount === 'groove')
    steps.push(`Für den Boden eine umlaufende Nut in Seiten, Front und Rückwand fräsen: ${o.gdepth} mm tief, Breite passend zur Bodenstärke (${dispVal(o.bt)} ${u}), Unterkante ca. ${o.goff} mm über der Zargen-Unterkante.`);
  if (o.boxConstr === 'sides')
    steps.push('Schubkasten verleimen: Front und Rückwand zwischen die durchgehenden Seiten setzen. Eckverbindung nach Wahl (Zinken, Dübel, Domino oder Schrauben).');
  else
    steps.push('Schubkasten verleimen: Die Seiten zwischen die durchgehende Front und Rückwand setzen. Eckverbindung nach Wahl (Zinken, Dübel, Domino oder Schrauben).');
  if (o.bottomMount === 'groove')
    steps.push('Boden vor dem letzten Verleimen in die Nut einschieben — er hält den Kasten rechtwinklig. Nicht verleimen, damit das Holz arbeiten kann.');
  else
    steps.push('Boden von unten bündig auf den verleimten Rahmen schrauben (ggf. mit Leim). Der Boden steift den Kasten aus — auf Rechtwinkligkeit achten.');
  steps.push('Rechtwinkligkeit prüfen (Diagonalen messen — beide gleich = rechtwinklig) und Leim abbinden lassen.');
  if (preset.hasSlide) {
    if (o.sys === 'under')
      steps.push(`Unterflur-Auszüge (Nennlänge ${dispVal(o.slideLen)} ${u}) am Korpusboden montieren und den Schubkasten einhängen. Boden-Rücksprung und Rückwand-Ausklinkung gemäß Beschlaganleitung beachten.`);
    else
      steps.push(`Auszüge (Nennlänge ${dispVal(o.slideLen)} ${u}) montieren: Korpusteil an die Korpuswand, Laufteil an die Schubkasten-Seite — beidseitig ${o.clr} mm Luft, auf gleicher Höhe und parallel ausrichten.`);
  } else if (o.sys === 'wood') {
    steps.push('Holzläufer/Leisten im Korpus montieren und den Schubkasten einpassen. Laufflächen leicht wachsen, damit er gut gleitet.');
  }
  steps.push('Probelauf: Schubkasten einsetzen, Leichtgängigkeit und Spaltmaße prüfen, bei Bedarf nachjustieren.');
  if (o.hasFront) {
    if (o.frontType === 'overlay')
      steps.push(`Frontblende (${dispVal(geo.frontW)} × ${dispVal(geo.frontH)} ${u}) aufsetzen — sie liegt mit ${dispVal(o.frontGap)} ${u} Überstand je Seite vor dem Korpus. Mit Verstellbeschlägen ausrichten und gleichmäßige Fugen einstellen.`);
    else
      steps.push(`Frontblende (${dispVal(geo.frontW)} × ${dispVal(geo.frontH)} ${u}) bündig in die Öffnung einpassen — ${dispVal(o.frontGap)} ${u} Fuge rundum für sauberen Lauf.`);
    if (o.hasHandle) {
      const sp = o.handleN === 2 ? `2 Löcher, Lochabstand ${dispVal(o.handleBc)} ${u}` : '1 Loch mittig';
      steps.push(`Griffbohrung anzeichnen und bohren (${sp}, Ø ${dispVal(o.handleDia)} ${u}). Tipp: Im Bohrlochplaner als maßstäbliche 1:1-Schablone ausgeben.`);
    }
  }
  steps.push('Oberfläche endbehandeln und Beschläge final justieren.');
  return steps;
}
