(function (global) {
  'use strict';

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    return { h, s, v: max };
  }

  function classifyPixel(r, g, b) {
    const { h, s, v } = rgbToHsv(r, g, b);
    const warmHue = (h <= 45 || h >= 350);
    if (warmHue && s >= 0.30 && v >= 0.45) return 'WARM';
    if (s <= 0.14 && v >= 0.70 && v <= 0.91) return 'TRACK';
    return 'OTHER';
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function fillRatioToIV(warm, track) {
    const total = warm + track;
    if (total === 0) return null;
    return clamp(Math.round((warm / total) * 15), 0, 15);
  }

  function median(arr) {
    const a = arr.slice().sort((x, y) => x - y);
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
  }

  function buildMasks(img) {
    const { data, width, height } = img;
    const warm = new Uint8Array(width * height);
    const track = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const c = classifyPixel(data[i], data[i + 1], data[i + 2]);
      if (c === 'WARM') warm[p] = 1;
      else if (c === 'TRACK') track[p] = 1;
    }
    return { warm, track, width, height };
  }

  function detectBars(img) {
    const masks = buildMasks(img);
    const { warm, track, width, height } = masks;
    const xLo = Math.floor(width * 0.03);
    const xHi = Math.floor(width * 0.55);
    const minRun = Math.floor(width * 0.25);
    const maxGap = Math.floor(width * 0.05); // tolera gaps de segmento

    // por linha: maior run contiguo de (warm||track) na janela esquerda
    const rows = [];
    for (let y = 0; y < height; y++) {
      let best = null, start = -1, end = -1, gap = 0;
      for (let x = xLo; x < xHi; x++) {
        const p = y * width + x;
        const on = warm[p] || track[p];
        if (on) { if (start < 0) start = x; end = x; gap = 0; }
        else if (start >= 0) {
          gap++;
          if (gap > maxGap) {
            const len = end - start + 1;
            if (!best || len > best.len) best = { x0: start, x1: end, len };
            start = -1; end = -1; gap = 0;
          }
        }
      }
      if (start >= 0) {
        const len = end - start + 1;
        if (!best || len > best.len) best = { x0: start, x1: end, len };
      }
      if (best && best.len >= minRun) rows.push({ y, x0: best.x0, x1: best.x1 });
    }
    if (rows.length < 3) return { ok: false, motivo: 'nao achei barras suficientes' };

    // agrupa linhas consecutivas em bandas
    const groups = [];
    let cur = [rows[0]];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].y - rows[i - 1].y <= 2) cur.push(rows[i]);
      else { groups.push(cur); cur = [rows[i]]; }
    }
    groups.push(cur);

    // resume cada banda
    const bands = groups.map(g => {
      const ys = g.map(r => r.y);
      return {
        y0: ys[0], y1: ys[ys.length - 1],
        x0: median(g.map(r => r.x0)), x1: median(g.map(r => r.x1)),
        h: ys.length
      };
    }).map(b => ({ ...b, w: b.x1 - b.x0 }));

    // forma de barra: larga e baixa
    const cand = bands.filter(b => b.w / Math.max(b.h, 1) >= 4 && b.w >= minRun);
    if (cand.length < 3) return { ok: false, motivo: 'poucas barras candidatas' };

    cand.sort((a, b) => a.y0 - b.y0); // topo -> baixo

    // escolhe o trio com espacamento regular + x0/largura parecidos
    let bestTriple = null, bestScore = Infinity;
    for (let i = 0; i < cand.length - 2; i++)
      for (let j = i + 1; j < cand.length - 1; j++)
        for (let k = j + 1; k < cand.length; k++) {
          const a = cand[i], b = cand[j], c = cand[k];
          const yA = (a.y0 + a.y1) / 2, yB = (b.y0 + b.y1) / 2, yC = (c.y0 + c.y1) / 2;
          const spacing = Math.abs((yB - yA) - (yC - yB));
          const xdev = Math.abs(a.x0 - b.x0) + Math.abs(b.x0 - c.x0);
          const wdev = Math.abs(a.w - b.w) + Math.abs(b.w - c.w);
          const score = spacing + xdev * 0.5 + wdev * 0.5;
          if (score < bestScore) { bestScore = score; bestTriple = [a, b, c]; }
        }
    if (!bestTriple) return { ok: false, motivo: 'sem trio regular' };

    const bandsOut = bestTriple
      .sort((a, b) => a.y0 - b.y0)
      .map(b => ({ y0: b.y0, y1: b.y1, x0: b.x0, x1: b.x1 }));
    return { ok: true, masks, bands: bandsOut };
  }

  const api = { rgbToHsv, classifyPixel, fillRatioToIV, detectBars };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.IVReader = api;
})(typeof window !== 'undefined' ? window : globalThis);
