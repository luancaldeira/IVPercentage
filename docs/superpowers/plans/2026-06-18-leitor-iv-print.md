# Leitor de IV por print — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar à interface web a função de enviar um print da tela de appraisal do Pokémon GO e ler automaticamente os 3 IVs (medindo o preenchimento das barras), preenchendo os sliders existentes e mostrando a % + mensagem.

**Architecture:** Detector 100% client-side em JavaScript puro (sem libs), isolado em `docs/iv-reader.js`. O núcleo opera sobre `ImageData` (`{data,width,height}`), o que permite testes unitários determinísticos em Node com imagens sintéticas. A integração contra os 15 prints reais roda no navegador via Playwright MCP. A UI de upload liga a saída do detector aos sliders `s-atk/s-def/s-sta` já existentes, que servem de confirmação/ajuste.

**Tech Stack:** JavaScript (Canvas 2D, sem dependências). Testes unitários: `node --test` (Node 24, sem deps). Testes de integração: Playwright MCP no navegador. Flask só ganha uma rota estática para servir o JS.

---

## Estrutura de arquivos

- `docs/iv-reader.js` (criar) — módulo detector. Funções puras + glue de canvas. Export duplo: `module.exports` (Node) e `window.IVReader` (browser).
- `test/iv-reader.test.js` (criar) — testes unitários Node sobre funções puras e `ImageData` sintético.
- `samples/iv-test.html` (criar) — harness de integração no navegador: roda o detector nos 15 prints, compara com `samples/expected.json`, expõe `window.__ivTestSummary`.
- `samples/expected.json` (criar) — gabarito (truth) dos 15 prints. Semeado com estimativas, finalizado na calibração com o usuário.
- `docs/index.html` (modificar) — UI de upload + `<script src="iv-reader.js">` + ligação aos sliders.
- `templates/index.html` (modificar) — espelho da UI (versão Flask).
- `app.py` (modificar) — rota `/iv-reader.js` servindo `docs/iv-reader.js`.
- `README.md` (modificar) — documentar a função.

### Contrato do módulo `IVReader`

```
rgbToHsv(r,g,b)                 -> {h:0..360, s:0..1, v:0..1}
classifyPixel(r,g,b)            -> "WARM" | "TRACK" | "OTHER"
fillRatioToIV(warm, track)      -> int 0..15  (null se warm+track===0)
detectBars(imageData)           -> {ok:true, masks, bands:[bandTop,bandMid,bandBot]} | {ok:false, motivo}
lerIVdeImageData(imageData)     -> {ok:true, atk, def, sta} | {ok:false, motivo}
lerIVdoCanvas(canvas)           -> lerIVdeImageData(canvas.getContext('2d').getImageData(...))
```

`band` = `{y0, y1, x0, x1}` (limites inteiros inclusivos). Ordem topo→baixo = Ataque, Defesa, Vida.

---

## Task 1: Scaffold do módulo + rgbToHsv + classifyPixel

**Files:**
- Create: `docs/iv-reader.js`
- Test: `test/iv-reader.test.js`

- [ ] **Step 1: Escrever os testes que falham**

`test/iv-reader.test.js`:

```js
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test`
Expected: FAIL — `Cannot find module '../docs/iv-reader.js'`.

- [ ] **Step 3: Implementação mínima**

`docs/iv-reader.js`:

```js
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

  const api = { rgbToHsv, classifyPixel };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.IVReader = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add docs/iv-reader.js test/iv-reader.test.js
git commit -m "feat: rgbToHsv e classifyPixel do leitor de IV"
```

---

## Task 2: fillRatioToIV

**Files:**
- Modify: `docs/iv-reader.js`
- Test: `test/iv-reader.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `test/iv-reader.test.js`:

```js
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test`
Expected: FAIL — `IV.fillRatioToIV is not a function`.

- [ ] **Step 3: Implementação mínima**

Adicionar a função antes de `const api` em `docs/iv-reader.js`:

```js
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function fillRatioToIV(warm, track) {
    const total = warm + track;
    if (total === 0) return null;
    return clamp(Math.round((warm / total) * 15), 0, 15);
  }
```

E incluir no export: `const api = { rgbToHsv, classifyPixel, fillRatioToIV };`

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test`
Expected: PASS (12 testes).

- [ ] **Step 5: Commit**

```bash
git add docs/iv-reader.js test/iv-reader.test.js
git commit -m "feat: fillRatioToIV (razao de preenchimento -> IV 0-15)"
```

---

## Task 3: detectBars (geometria) sobre ImageData sintético

**Files:**
- Modify: `docs/iv-reader.js`
- Test: `test/iv-reader.test.js`

Helper de teste: gera um `ImageData`-like (`{width,height,data}`) com 3 barras horizontais.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `test/iv-reader.test.js`:

```js
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test`
Expected: FAIL — `IV.detectBars is not a function`.

- [ ] **Step 3: Implementação mínima**

Adicionar em `docs/iv-reader.js` (antes de `const api`):

```js
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
```

Incluir no export: `const api = { rgbToHsv, classifyPixel, fillRatioToIV, detectBars };`

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test`
Expected: PASS (15 testes).

- [ ] **Step 5: Commit**

```bash
git add docs/iv-reader.js test/iv-reader.test.js
git commit -m "feat: detectBars (acha as 3 barras de appraisal)"
```

---

## Task 4: lerIVdeImageData (pipeline completo) sobre sintético

**Files:**
- Modify: `docs/iv-reader.js`
- Test: `test/iv-reader.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `test/iv-reader.test.js` (reusa `makeAppraisal`):

```js
test('lerIVdeImageData: hundo 15/15/15', () => {
  const r = IV.lerIVdeImageData(makeAppraisal([15, 15, 15]));
  assert.strictEqual(r.ok, true, r.motivo);
  assert.deepStrictEqual([r.atk, r.def, r.sta], [15, 15, 15]);
});

test('lerIVdeImageData: ataque zero', () => {
  const r = IV.lerIVdeImageData(makeAppraisal([0, 8, 11]));
  assert.strictEqual(r.ok, true, r.motivo);
  assert.strictEqual(r.atk, 0);
  assert.ok(Math.abs(r.def - 8) <= 1, `def ${r.def}`);
  assert.ok(Math.abs(r.sta - 11) <= 1, `sta ${r.sta}`);
});

test('lerIVdeImageData: valores variados dentro de +-1', () => {
  const truth = [13, 7, 2];
  const r = IV.lerIVdeImageData(makeAppraisal(truth));
  assert.strictEqual(r.ok, true, r.motivo);
  [r.atk, r.def, r.sta].forEach((v, i) =>
    assert.ok(Math.abs(v - truth[i]) <= 1, `stat ${i}: ${v} vs ${truth[i]}`));
});

test('lerIVdeImageData: imagem invalida = ok:false', () => {
  const width = 200, height = 200;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const r = IV.lerIVdeImageData({ width, height, data });
  assert.strictEqual(r.ok, false);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test`
Expected: FAIL — `IV.lerIVdeImageData is not a function`.

- [ ] **Step 3: Implementação mínima**

Adicionar em `docs/iv-reader.js` (antes de `const api`):

```js
  function measureFill(masks, band) {
    const { warm, track, width } = masks;
    let w = 0, t = 0;
    for (let y = band.y0; y <= band.y1; y++)
      for (let x = band.x0; x <= band.x1; x++) {
        const p = y * width + x;
        if (warm[p]) w++;
        else if (track[p]) t++;
      }
    return { w, t };
  }

  function lerIVdeImageData(img) {
    const det = detectBars(img);
    if (!det.ok) return { ok: false, motivo: det.motivo };
    const [a, d, s] = det.bands.map(band => {
      const { w, t } = measureFill(det.masks, band);
      return fillRatioToIV(w, t);
    });
    if (a === null || d === null || s === null)
      return { ok: false, motivo: 'barra vazia de pixels' };
    return { ok: true, atk: a, def: d, sta: s };
  }
```

Incluir no export: `const api = { rgbToHsv, classifyPixel, fillRatioToIV, detectBars, lerIVdeImageData };`

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test`
Expected: PASS (19 testes).

- [ ] **Step 5: Commit**

```bash
git add docs/iv-reader.js test/iv-reader.test.js
git commit -m "feat: lerIVdeImageData (pipeline completo barras -> IVs)"
```

---

## Task 5: Glue de canvas + harness de integração + gabarito semeado

**Files:**
- Modify: `docs/iv-reader.js` (adicionar `lerIVdoCanvas`)
- Create: `samples/expected.json`
- Create: `samples/iv-test.html`

- [ ] **Step 1: Adicionar `lerIVdoCanvas` ao módulo**

Em `docs/iv-reader.js`, antes de `const api`:

```js
  function lerIVdoCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return lerIVdeImageData(img);
  }
```

Export final:

```js
  const api = { rgbToHsv, classifyPixel, fillRatioToIV, detectBars, lerIVdeImageData, lerIVdoCanvas };
```

- [ ] **Step 2: Criar o gabarito semeado**

`samples/expected.json` — TRUTH confirmada pelo usuário (gabarito final). A regra do teste é computada: stats com valor **0 ou 15 são exatos** (barra vazia/cheia, inequívoca); os demais aceitam **±1**.

```json
{
  "715d7122-c859-43e0-8500-6cfc6a827e6b.jpg": { "name": "PAIMON",     "atk": 15, "def": 15, "sta": 15 },
  "9ba07c6d-24b5-4a63-a482-398dc980a6f8.jpg": { "name": "DEUS",       "atk": 15, "def": 15, "sta": 15 },
  "a6894d7c-1b08-49e3-bb7b-6ca2fc61c131.jpg": { "name": "ASMODEUS",   "atk": 15, "def": 15, "sta": 15 },
  "e7ba3a76-8c6b-451c-aa2c-f64361f1686e.jpg": { "name": "Annihilape", "atk": 15, "def": 13, "sta": 15 },
  "4646d5fe-4de8-4e2e-a184-d19576fdd5c0.jpg": { "name": "Lugia",      "atk": 15, "def": 13, "sta": 15 },
  "d3cd0650-91ec-44cc-905d-aacaa405dc0b.jpg": { "name": "Arcanine",   "atk": 13, "def": 14, "sta": 15 },
  "27e7dd1a-91a9-4888-a313-5ee447eb9e96.jpg": { "name": "Dialga",     "atk": 7,  "def": 9,  "sta": 15 },
  "e38ea907-af42-4316-80e6-fc43cf32f1b2.jpg": { "name": "Dratini185", "atk": 0,  "def": 2,  "sta": 11 },
  "20014c0e-597e-4648-b5bd-7f86149bfb81.jpg": { "name": "Scizor",     "atk": 14, "def": 13, "sta": 15 },
  "b626a058-5010-42f4-8574-d63c5d2e02fb.jpg": { "name": "Dragonite",  "atk": 14, "def": 14, "sta": 12 },
  "992d1a41-b617-4cff-9bc2-f3e730e6454a.jpg": { "name": "Zekrom",     "atk": 13, "def": 13, "sta": 11 },
  "b25d1196-85c0-4ab5-82f9-0d065c28b8a9.jpg": { "name": "Beldum",     "atk": 14, "def": 14, "sta": 5  },
  "97523db4-2719-4e1a-bee4-0f0a827f7845.jpg": { "name": "Muk",        "atk": 9,  "def": 13, "sta": 10 },
  "87a578c3-20e2-45be-a858-c74fe155ea44.jpg": { "name": "Dratini583", "atk": 14, "def": 5,  "sta": 9  },
  "3eb996b1-1aac-4fa1-801d-f1c25897c595.jpg": { "name": "Zorua",      "atk": 13, "def": 3,  "sta": 3  }
}
```

- [ ] **Step 3: Criar o harness de integração**

`samples/iv-test.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>IV Reader — teste integração</title>
<style>
body{font-family:monospace;background:#0b0e16;color:#dbe7ff;padding:16px}
table{border-collapse:collapse;width:100%}
td,th{border:1px solid #2a3550;padding:4px 8px;text-align:center}
img{height:120px;display:block}
.pass{color:#37e29a}.fail{color:#ff5d6c}
</style></head>
<body>
<h1>IV Reader — integração</h1>
<div id="summary">carregando…</div>
<table id="tbl"><thead><tr>
<th>print</th><th>nome</th><th>esperado A/D/H</th><th>lido A/D/H</th><th>status</th>
</tr></thead><tbody></tbody></table>
<script src="../docs/iv-reader.js"></script>
<script>
const TOL = 1;
async function loadImg(src){
  return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=src;});
}
function toCanvas(im){
  const W=750, H=Math.round(im.height*(750/im.width));
  const c=document.createElement('canvas');c.width=W;c.height=H;
  c.getContext('2d').drawImage(im,0,0,W,H);return c;
}
(async ()=>{
  const expected=await fetch('expected.json').then(r=>r.json());
  const tbody=document.querySelector('#tbl tbody');
  let pass=0, fail=0; const rows=[];
  for(const [file,exp] of Object.entries(expected)){
    let lido={ok:false};
    try{ lido=IVReader.lerIVdoCanvas(toCanvas(await loadImg(file))); }catch(e){ lido={ok:false,motivo:String(e)}; }
    let ok=lido.ok;
    if(ok){
      for(const k of ['atk','def','sta']){
        const diff=Math.abs(lido[k]-exp[k]);
        const hard=(exp[k]===0||exp[k]===15); // barra vazia/cheia: exato
        if(hard ? diff!==0 : diff>TOL) ok=false;
      }
    }
    ok?pass++:fail++;
    rows.push({file,name:exp.name,exp:[exp.atk,exp.def,exp.sta],got:lido.ok?[lido.atk,lido.def,lido.sta]:lido.motivo,ok});
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><img src="${file}"></td><td>${exp.name}</td>
      <td>${exp.atk}/${exp.def}/${exp.sta}</td>
      <td>${lido.ok?`${lido.atk}/${lido.def}/${lido.sta}`:('—'+(lido.motivo||''))}</td>
      <td class="${ok?'pass':'fail'}">${ok?'PASS':'FAIL'}</td>`;
    tbody.appendChild(tr);
  }
  const total=pass+fail;
  document.getElementById('summary').textContent=`${pass}/${total} PASS, ${fail} FAIL`;
  window.__ivTestSummary={pass,fail,total,rows};
  window.__ivTestReady=true;
})();
</script>
</body></html>
```

- [ ] **Step 4: Verificar o JS no Node (regressão dos unitários)**

Run: `node --test`
Expected: PASS (todos, incluindo os 19 anteriores). `lerIVdoCanvas` não é exercido no Node (só no browser), mas o require não pode quebrar.

- [ ] **Step 5: Commit**

```bash
git add docs/iv-reader.js samples/expected.json samples/iv-test.html
git commit -m "feat: glue de canvas + harness de integracao + gabarito"
```

---

## Task 6: Calibração contra os 15 prints reais (Playwright)

**Files:**
- Modify: `docs/iv-reader.js` (ajuste de limiares, se preciso)

> **Quem roda:** a sessão principal (orquestradora), que tem o Playwright MCP. Os subagents de implementação podem não ter.
> O gabarito (`samples/expected.json`) já é a TRUTH confirmada pelo usuário — não precisa re-confirmar.

- [ ] **Step 1: Rodar o harness no navegador**

Via Playwright MCP:
- `browser_navigate` para `file:///C:/Users/luanm/OneDrive/Documentos/IVPercentage/.claude/worktrees/xenodochial-babbage-8c1ae1/samples/iv-test.html`
- esperar `window.__ivTestReady === true`
- `browser_evaluate`: `() => window.__ivTestSummary`

- [ ] **Step 2: Calibrar até passar**

Se algum print falhar (valor 0/15 não-exato, ou parcial fora de ±1), ajustar os limiares em `classifyPixel` (faixas de hue/sat/val do WARM e TRACK) e/ou as tolerâncias de geometria em `detectBars` (`xLo/xHi`, `minRun`, `maxGap`, filtros de forma). Reexecutar Node (`node --test`, não pode regredir nos sintéticos) e o harness no navegador. Repetir até `__ivTestSummary.fail === 0`.

Critério de aceite: **todos os 15 PASS** — stats 0/15 exatos, parciais dentro de ±1 do gabarito — e `node --test` verde.

- [ ] **Step 4: Commit**

```bash
git add docs/iv-reader.js samples/expected.json
git commit -m "test: calibracao do leitor contra os 15 prints reais"
```

---

## Task 7: UI de upload no `docs/index.html`

**Files:**
- Modify: `docs/index.html`

- [ ] **Step 1: Incluir o módulo**

Logo antes do `<script>` principal (perto da linha 269), adicionar:

```html
<script src="iv-reader.js"></script>
```

- [ ] **Step 2: Adicionar o controle de upload na UI**

Dentro de `.search` ou logo após (antes de `<section class="readout">`, ~linha 217), adicionar:

```html
  <div class="scan-print">
    <label class="scan-btn">
      📷 Ler print da appraisal
      <input id="file" type="file" accept="image/*" hidden>
    </label>
    <span id="scan-msg" class="scan-msg"></span>
    <img id="scan-preview" class="scan-preview" alt="" hidden>
  </div>
```

Adicionar ao `<style>` (perto dos outros, antes de `</style>`):

```css
.scan-print{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.scan-btn{display:inline-flex;align-items:center;gap:8px;cursor:pointer;
  background:rgba(39,224,232,.1);border:1px solid rgba(39,224,232,.4);color:var(--ink);
  font-family:"Chakra Petch",sans-serif;letter-spacing:.04em;padding:12px 18px;border-radius:11px;
  transition:border-color .25s,box-shadow .25s}
.scan-btn:hover{border-color:rgba(39,224,232,.7);box-shadow:0 0 0 4px rgba(39,224,232,.08)}
.scan-msg{font-size:12px;color:var(--muted);letter-spacing:.04em}
.scan-msg.err{color:var(--poor)}
.scan-preview{height:64px;border-radius:8px;border:1px solid var(--line)}
```

- [ ] **Step 3: Ligar o upload ao detector e aos sliders**

No fim do `<script>` principal (antes de `render();` na linha ~377), adicionar:

```js
// ---- ler IV de print ----
function aplicarIV(atk, def, sta){
  $("s-atk").value = atk; $("s-def").value = def; $("s-sta").value = sta;
  $("readout").classList.add("live");
  render();
}
$("file").addEventListener("change", e => {
  const f = e.target.files[0];
  if(!f) return;
  const msg = $("scan-msg"); msg.classList.remove("err");
  msg.textContent = "Lendo print…";
  const url = URL.createObjectURL(f);
  const im = new Image();
  im.onload = () => {
    const W = 750, H = Math.round(im.height * (750 / im.width));
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    c.getContext("2d").drawImage(im, 0, 0, W, H);
    const r = IVReader.lerIVdoCanvas(c);
    const prev = $("scan-preview"); prev.src = url; prev.hidden = false;
    if(r.ok){
      aplicarIV(r.atk, r.def, r.sta);
      msg.textContent = `Lido: ${r.atk}/${r.def}/${r.sta} — confira nos controles.`;
    } else {
      msg.classList.add("err");
      msg.textContent = "Não consegui ler o print. Ajusta manual nos controles.";
    }
  };
  im.onerror = () => { msg.classList.add("err"); msg.textContent = "Imagem inválida."; };
  im.src = url;
});
```

- [ ] **Step 4: Verificar no navegador (Playwright, sessão principal)**

`browser_navigate` para o `docs/index.html` via `file://`; usar `browser_file_upload` (ou avaliar JS que injeta um sample) com `samples/715d7122-...jpg`; confirmar que os sliders vão pra 15/15/15, a gauge mostra 100% e o tier "HUNDO". Repetir com `e38ea907-...jpg` (Ataque deve ir a 0).

Expected: sliders e % refletem os IVs lidos; mensagem "Lido: …".

- [ ] **Step 5: Commit**

```bash
git add docs/index.html
git commit -m "feat: UI de upload de print no app web (docs)"
```

---

## Task 8: Espelhar no Flask (`templates/index.html` + rota)

**Files:**
- Modify: `app.py`
- Modify: `templates/index.html`

- [ ] **Step 1: Adicionar rota que serve o detector**

Em `app.py`, importar `send_from_directory` e adicionar a rota. Trocar a linha de import do Flask (linha 11):

```python
from flask import Flask, jsonify, render_template, send_from_directory
```

E adicionar antes de `if __name__` (após a rota `api_calc`, ~linha 67):

```python
@app.route("/iv-reader.js")
def iv_reader_js():
    """Serve o detector (fonte única, compartilhada com o build estático)."""
    return send_from_directory(os.path.join(BASE, "docs"), "iv-reader.js",
                               mimetype="application/javascript")
```

- [ ] **Step 2: Aplicar a mesma mudança de UI no template**

Replicar EXATAMENTE os Steps 1–3 da Task 7 em `templates/index.html`, com uma diferença: o `<script src>` aponta pra rota absoluta do Flask. Em vez de `<script src="iv-reader.js"></script>`, usar:

```html
<script src="/iv-reader.js"></script>
```

Os blocos de CSS (`.scan-print` etc.), o HTML do `.scan-print` e o JS de ligação (`aplicarIV` + listener do `#file`) são idênticos aos da Task 7.

- [ ] **Step 3: Verificar o Flask**

```bash
python app.py
```

Em outro terminal:

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://127.0.0.1:5000/iv-reader.js
```

Expected: `200 application/javascript`. Parar o servidor (Ctrl+C) depois.

- [ ] **Step 4: Commit**

```bash
git add app.py templates/index.html
git commit -m "feat: espelhar leitor de print no app Flask"
```

---

## Task 9: Documentação

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Documentar a função**

Adicionar uma seção após o bloco "Cálculo" (após a linha ~26 do README):

```markdown
## Ler IV por print

Na interface web dá pra clicar em **📷 Ler print da appraisal** e enviar um
screenshot da tela de avaliação do Pokémon GO. O programa mede o preenchimento
das 3 barras (Ataque/Defesa/Vida) — mesmo sem os números aparecerem na tela — e
preenche os controles automaticamente. Os sliders servem de conferência: ajuste
se a leitura sair errada.

Detalhes técnicos: leitura 100% no navegador (`docs/iv-reader.js`), sem servidor
nem upload pra lugar nenhum. Testes em `test/iv-reader.test.js` (`node --test`) e
`samples/iv-test.html` (integração contra prints reais em `samples/`).
```

- [ ] **Step 2: Atualizar a árvore de estrutura**

No bloco "Estrutura" do README, adicionar as linhas:

```
├── docs/iv-reader.js  # leitor de IV por print (client-side)
├── samples/           # prints reais + gabarito p/ teste
├── test/              # testes unitarios (node --test)
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: documentar leitor de IV por print"
```

---

## Notas de execução

- **Testes unitários (Node):** rodam sem dependências (`node --test`). Cada Task de núcleo (1–4) é TDD puro e rápido.
- **Testes de integração (browser):** Tasks 6 e 7 usam Playwright MCP — rode na sessão principal, não num subagent sem MCP.
- **Gabarito:** os valores SOFT em `expected.json` são estimativas visuais; viram TRUTH só após a confirmação do usuário na Task 6.
- **`.gitignore`:** confirmar que `samples/` NÃO está ignorado (não está hoje). Os prints são fixtures de teste — devem ser commitados.
- **Adiado (YAGNI):** colar (Ctrl+V) e arrastar-soltar a imagem — o spec listou como progressive enhancement opcional de desktop. O alvo é mobile (galeria via `<input type=file>`), então fica de fora desta entrega. Fácil de somar depois reusando `IVReader.lerIVdoCanvas`.
