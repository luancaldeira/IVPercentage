const test = require('node:test');
const assert = require('node:assert');
const IV = require('../docs/iv-reader.js');

test('rgbToHsv: branco', () => {
  const { h, s, v } = IV.rgbToHsv(255, 255, 255);
  assert.ok(Math.abs(v - 1) < 1e-6);
  assert.ok(Math.abs(s - 0) < 1e-6);
});

test('rgbToHsv: laranja appraisal ~#e8932e', () => {
  const { h, s, v } = IV.rgbToHsv(232, 147, 46);
  assert.ok(h > 20 && h < 45, `hue ${h}`);
  assert.ok(s > 0.6, `sat ${s}`);
});

test('classifyPixel: laranja preenchido = WARM', () => {
  assert.strictEqual(IV.classifyPixel(232, 147, 46), 'WARM');
});

test('classifyPixel: vermelho/salmão (stat 15) = WARM', () => {
  assert.strictEqual(IV.classifyPixel(232, 123, 123), 'WARM');
});

test('classifyPixel: cinza do trilho = TRACK', () => {
  assert.strictEqual(IV.classifyPixel(212, 212, 212), 'TRACK');
});

test('classifyPixel: branco do card = OTHER', () => {
  assert.strictEqual(IV.classifyPixel(250, 250, 250), 'OTHER');
});

test('classifyPixel: gradiente amarelo claro do card = OTHER', () => {
  assert.strictEqual(IV.classifyPixel(245, 240, 216), 'OTHER');
});

test('fillRatioToIV: tudo preenchido = 15', () => {
  assert.strictEqual(IV.fillRatioToIV(300, 0), 15);
});

test('fillRatioToIV: tudo vazio = 0', () => {
  assert.strictEqual(IV.fillRatioToIV(0, 300), 0);
});

test('fillRatioToIV: metade ~ 7 ou 8', () => {
  const v = IV.fillRatioToIV(150, 150);
  assert.ok(v === 7 || v === 8, `got ${v}`);
});

test('fillRatioToIV: sem pixels de barra = null', () => {
  assert.strictEqual(IV.fillRatioToIV(0, 0), null);
});

test('fillRatioToIV: nunca passa de 15', () => {
  assert.strictEqual(IV.fillRatioToIV(1000, 0), 15);
});

// ---- helper: pinta um appraisal sintético ----
const WARM = [232, 147, 46];     // laranja preenchido
const TRACK = [212, 212, 212];   // cinza vazio
const WHITE = [250, 250, 250];   // card

function makeAppraisal(fills /* [atk,def,sta] em 0..15 */, opts = {}) {
  const width = opts.width || 750;
  const height = opts.height || 1600;
  const data = new Uint8ClampedArray(width * height * 4);
  // fundo branco (card)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = WHITE[0]; data[i + 1] = WHITE[1]; data[i + 2] = WHITE[2]; data[i + 3] = 255;
  }
  function px(x, y, c) {
    const p = (y * width + x) * 4;
    data[p] = c[0]; data[p + 1] = c[1]; data[p + 2] = c[2]; data[p + 3] = 255;
  }
  // 3 barras: x de 0.10W a 0.45W, 3 segmentos com gaps; y centrais 0.78/0.84/0.90 H
  const x0 = Math.floor(width * 0.10);
  const x1 = Math.floor(width * 0.45);
  const barW = x1 - x0;
  const segGap = Math.floor(barW * 0.03);
  const segW = Math.floor((barW - 2 * segGap) / 3);
  const barH = Math.floor(height * 0.012);
  const ys = [0.78, 0.84, 0.90].map(f => Math.floor(height * f));
  fills.forEach((iv, idx) => {
    const filledPx = Math.round((iv / 15) * (segW * 3)); // pixels preenchidos no total dos 3 seg
    const yc = ys[idx];
    let painted = 0;
    for (let seg = 0; seg < 3; seg++) {
      const sx = x0 + seg * (segW + segGap);
      for (let dx = 0; dx < segW; dx++) {
        const filled = painted < filledPx;
        painted++;
        for (let dy = -barH; dy <= barH; dy++) px(sx + dx, yc + dy, filled ? WARM : TRACK);
      }
    }
  });
  return { width, height, data };
}

test('detectBars: acha 3 bandas em ordem topo->baixo', () => {
  const img = makeAppraisal([15, 10, 5]);
  const r = IV.detectBars(img);
  assert.strictEqual(r.ok, true, r.motivo);
  assert.strictEqual(r.bands.length, 3);
  assert.ok(r.bands[0].y0 < r.bands[1].y0);
  assert.ok(r.bands[1].y0 < r.bands[2].y0);
});

test('detectBars: barra zerada (toda TRACK) ainda e detectada', () => {
  const img = makeAppraisal([0, 8, 8]);
  const r = IV.detectBars(img);
  assert.strictEqual(r.ok, true, r.motivo);
  assert.strictEqual(r.bands.length, 3);
});

test('detectBars: imagem sem barras = ok:false', () => {
  const width = 300, height = 300;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const r = IV.detectBars({ width, height, data });
  assert.strictEqual(r.ok, false);
});
