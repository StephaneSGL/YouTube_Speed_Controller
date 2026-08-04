(() => {
  "use strict";

  const STORAGE_KEY = "turboTubeSettings";
  const MIN_SPEED = 0.25;
  const MAX_SPEED = 16;
  const DEFAULT_SETTINGS = Object.freeze({ targetSpeed: 1, step: 0.25, rememberSpeed: true, showBadge: true });

  function normalize(value, fallback, min, max) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(Math.min(max, Math.max(min, numeric)) * 100) / 100 : fallback;
  }

  const normalizeSpeed = (value) => normalize(value, DEFAULT_SETTINGS.targetSpeed, MIN_SPEED, MAX_SPEED);
  const normalizeStep = (value) => normalize(value, DEFAULT_SETTINGS.step, 0.05, 4);
  const formatSpeed = (value) => normalizeSpeed(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");

  function normalizeSettings(value = {}) {
    const merged = { ...DEFAULT_SETTINGS, ...value };
    return {
      targetSpeed: normalizeSpeed(merged.targetSpeed),
      step: normalizeStep(merged.step),
      rememberSpeed: merged.rememberSpeed !== false,
      showBadge: merged.showBadge !== false
    };
  }

  globalThis.TurboTube = Object.freeze({ STORAGE_KEY, MIN_SPEED, MAX_SPEED, normalizeSpeed, formatSpeed, normalizeSettings });
})();
