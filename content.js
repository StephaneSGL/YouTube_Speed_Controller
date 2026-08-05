(() => {
  "use strict";

  const { STORAGE_KEY, normalizeSpeed, formatSpeed, normalizeSettings, reportError } = TurboTube;
  const PRESET_CYCLE = [1, 1.5, 2, 2.5, 3, 4];
  const PLAYER_PART_SELECTOR = "video, .ytp-right-controls";

  let settings = normalizeSettings();
  let currentVideo = null;
  let applyingSpeed = false;
  let scanScheduled = false;
  let saveTimer = null;
  let toastTimer = null;

  function persistSettings() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void Promise.resolve()
        .then(() => chrome.storage.sync.set({ [STORAGE_KEY]: settings }))
        .catch((error) => {
          reportError("Enregistrement des réglages impossible", error);
        });
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

  function pageNeedsScan(mutations) {
    if (currentVideo && !currentVideo.isConnected) return true;
    return mutations.some(({ addedNodes }) => [...addedNodes].some((node) =>
      node instanceof Element && (node.matches(PLAYER_PART_SELECTOR) || node.querySelector(PLAYER_PART_SELECTOR))
    ));
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
      settings = normalizeSettings({ ...settings, ...message.patch });
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
    settings = normalizeSettings(next);
    updateBadge();
  });

  async function init() {
    try {
      const stored = await chrome.storage.sync.get(STORAGE_KEY);
      settings = normalizeSettings(stored[STORAGE_KEY]);
    } catch (error) {
      reportError("Chargement des réglages impossible, valeurs par défaut utilisées", error);
    }
    document.addEventListener("keydown", handleKeyboard, true);
    document.addEventListener("yt-navigate-finish", () => {
      scheduleScan();
      setTimeout(reapplyRememberedSpeed, 400);
    });
    new MutationObserver((mutations) => {
      if (pageNeedsScan(mutations)) scheduleScan();
    }).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    scanPage();
  }

  void init().catch((error) => {
    reportError("Initialisation du script vidéo impossible", error);
  });
})();
