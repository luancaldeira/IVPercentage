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
