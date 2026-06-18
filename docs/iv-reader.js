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

  const api = { rgbToHsv, classifyPixel, fillRatioToIV };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.IVReader = api;
})(typeof window !== 'undefined' ? window : globalThis);
