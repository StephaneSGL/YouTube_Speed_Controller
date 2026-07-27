(() => {
  "use strict";

  const STORAGE_KEY = "turboTubeSettings";
  const MIN_SPEED = 0.25;
  const MAX_SPEED = 16;
  const PRESET_CYCLE = [1, 1.5, 2, 2.5, 3, 4];
  const DEFAULT_SETTINGS = {
    targetSpeed: 1,
    step: 0.25,
    rememberSpeed: true,
    showBadge: true
  };

  let settings = { ...DEFAULT_SETTINGS };
  let currentVideo = null;
  let applyingSpeed = false;
  let scanScheduled = false;
  let saveTimer = null;
  let toastTimer = null;

  function clampSpeed(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, numeric));
  }

  function normalizeSpeed(value) {
    return Math.round(clampSpeed(value) * 100) / 100;
  }

  function normalizeStep(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.step;
    return Math.round(Math.min(4, Math.max(0.05, numeric)) * 100) / 100;
  }

  function formatSpeed(value) {
    return normalizeSpeed(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  function persistSettings() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      chrome.storage.sync.set({ [STORAGE_KEY]: settings });
    }, 60);
  }

  function getPlayer() {
    return currentVideo?.closest("#movie_player") || document.querySelector("#movie_player");
  }

  function updateBadge() {
    let badge = document.getElementById("turbotube-speed-badge");

    if (!settings.showBadge) {
      badge?.remove();
      return;
    }

    const controls = getPlayer()?.querySelector(".ytp-right-controls");
    if (!controls) return;

    if (!badge) {
      badge = document.createElement("button");
      badge.id = "turbotube-speed-badge";
      badge.className = "ytp-button";
      badge.type = "button";
      badge.title = "TurboTube : cliquer pour changer de vitesse";
      badge.setAttribute("aria-label", "Changer la vitesse de lecture TurboTube");
      badge.addEventListener("click", (event) => {
        event.stopPropagation();
        const current = currentVideo?.playbackRate ?? settings.targetSpeed;
        const next = PRESET_CYCLE.find((speed) => speed > current + 0.01) ?? PRESET_CYCLE[0];
        setSpeed(next, { announce: true });
      });
      controls.prepend(badge);
    }

    const speed = currentVideo?.playbackRate ?? settings.targetSpeed;
    badge.textContent = `×${formatSpeed(speed)}`;
  }

  function showToast(speed) {
    const player = getPlayer();
    if (!player) return;

    let toast = document.getElementById("turbotube-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "turbotube-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      player.append(toast);
    }

    toast.textContent = `Vitesse ×${formatSpeed(speed)}`;
    toast.classList.add("turbotube-toast--visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast?.classList.remove("turbotube-toast--visible");
    }, 1100);
  }

  function setSpeed(value, options = {}) {
    const { announce = false, persist = true } = options;
    const speed = normalizeSpeed(value);
    settings.targetSpeed = speed;

    if (currentVideo) {
      applyingSpeed = true;
      try {
        currentVideo.defaultPlaybackRate = speed;
        currentVideo.playbackRate = speed;
      } finally {
        queueMicrotask(() => {
          applyingSpeed = false;
        });
      }
    }

    if (persist) persistSettings();
    updateBadge();
    if (announce) showToast(speed);
    return speed;
  }

  function reapplyRememberedSpeed() {
    if (!settings.rememberSpeed || !currentVideo) return;
    setSpeed(settings.targetSpeed, { persist: false });
    setTimeout(() => {
      if (currentVideo && Math.abs(currentVideo.playbackRate - settings.targetSpeed) > 0.01) {
        setSpeed(settings.targetSpeed, { persist: false });
      }
    }, 350);
  }

  function handleRateChange() {
    if (!currentVideo || applyingSpeed) return;
    settings.targetSpeed = normalizeSpeed(currentVideo.playbackRate);
    persistSettings();
    updateBadge();
  }

  function attachVideo(video) {
    if (video === currentVideo) {
      updateBadge();
      return;
    }

    currentVideo?.removeEventListener("ratechange", handleRateChange);
    currentVideo?.removeEventListener("loadedmetadata", reapplyRememberedSpeed);
    currentVideo = video;

    if (!currentVideo) return;
    currentVideo.addEventListener("ratechange", handleRateChange);
    currentVideo.addEventListener("loadedmetadata", reapplyRememberedSpeed);
    reapplyRememberedSpeed();
    updateBadge();
  }

  function scanPage() {
    scanScheduled = false;
    attachVideo(document.querySelector("video.html5-main-video") || document.querySelector("video"));
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(scanPage);
  }

  function isEditableTarget(target) {
    return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
  }

  function handleKeyboard(event) {
    if (!event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) return;

    let nextSpeed = null;
    if (event.key === "ArrowUp") {
      nextSpeed = (currentVideo?.playbackRate ?? settings.targetSpeed) + settings.step;
    } else if (event.key === "ArrowDown") {
      nextSpeed = (currentVideo?.playbackRate ?? settings.targetSpeed) - settings.step;
    } else if (event.key === "0") {
      nextSpeed = 1;
    }

    if (nextSpeed === null) return;
    event.preventDefault();
    event.stopPropagation();
    setSpeed(nextSpeed, { announce: true });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return false;

    if (message.type === "GET_STATE") {
      sendResponse({
        ok: true,
        hasVideo: Boolean(currentVideo),
        currentSpeed: currentVideo?.playbackRate ?? settings.targetSpeed,
        settings
      });
      return false;
    }

    if (message.type === "SET_SPEED") {
      const speed = setSpeed(message.speed, { announce: Boolean(message.announce) });
      sendResponse({ ok: true, speed });
      return false;
    }

    if (message.type === "UPDATE_SETTINGS") {
      settings = {
        ...settings,
        ...message.patch,
        targetSpeed: normalizeSpeed(message.patch?.targetSpeed ?? settings.targetSpeed),
        step: normalizeStep(message.patch?.step ?? settings.step)
      };
      persistSettings();
      if (settings.rememberSpeed) setSpeed(settings.targetSpeed, { persist: false });
      updateBadge();
      sendResponse({ ok: true, settings });
      return false;
    }

    return false;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    const next = changes[STORAGE_KEY]?.newValue;
    if (areaName !== "sync" || !next) return;
    settings = { ...DEFAULT_SETTINGS, ...next };
    updateBadge();
  });

  async function init() {
    const stored = await chrome.storage.sync.get(STORAGE_KEY);
    settings = { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY] || {}) };
    document.addEventListener("keydown", handleKeyboard, true);
    document.addEventListener("yt-navigate-finish", () => {
      scheduleScan();
      setTimeout(reapplyRememberedSpeed, 400);
    });
    new MutationObserver(scheduleScan).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    scanPage();
  }

  init();
})();
