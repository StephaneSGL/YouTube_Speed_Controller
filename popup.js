(() => {
  "use strict";

  const STORAGE_KEY = "turboTubeSettings";
  const MIN_SPEED = 0.25;
  const MAX_SPEED = 16;
  const DEFAULT_SETTINGS = {
    targetSpeed: 1,
    step: 0.25,
    rememberSpeed: true,
    showBadge: true
  };

  const elements = {
    slider: document.getElementById("speed-slider"),
    input: document.getElementById("speed-input"),
    presets: document.getElementById("presets"),
    step: document.getElementById("step-select"),
    remember: document.getElementById("remember-toggle"),
    badge: document.getElementById("badge-toggle"),
    status: document.getElementById("status"),
    dot: document.getElementById("connection-dot")
  };

  let activeTabId = null;
  let connected = false;
  let settings = { ...DEFAULT_SETTINGS };
  let sendTimer = null;

  function clampSpeed(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, numeric)) * 100) / 100;
  }

  function formatSpeed(value) {
    return clampSpeed(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  function updateProgress(speed) {
    const progress = ((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;
    elements.slider.style.setProperty("--slider-progress", `${progress}%`);
  }

  function renderSpeed(value) {
    const speed = clampSpeed(value);
    elements.slider.value = String(speed);
    elements.input.value = formatSpeed(speed);
    updateProgress(speed);
    elements.presets.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-active", Math.abs(Number(button.dataset.speed) - speed) < 0.01);
    });
  }

  function renderSettings() {
    elements.step.value = String(settings.step);
    elements.remember.checked = Boolean(settings.rememberSpeed);
    elements.badge.checked = Boolean(settings.showBadge);
  }

  function setConnection(isConnected, text) {
    connected = isConnected;
    elements.status.textContent = text;
    elements.status.classList.toggle("status--error", !isConnected);
    elements.dot.classList.toggle("connection-dot--active", isConnected);
    elements.dot.title = isConnected ? "Connecté à la vidéo" : "Aucune vidéo détectée";
    document.querySelectorAll("button, input, select").forEach((control) => {
      control.disabled = !isConnected;
    });
  }

  async function sendMessage(message) {
    if (!activeTabId || typeof chrome === "undefined" || !chrome.tabs?.sendMessage) return null;
    try {
      return await chrome.tabs.sendMessage(activeTabId, message);
    } catch {
      setConnection(false, "Ouvrez YouTube");
      return null;
    }
  }

  async function setSpeed(value, announce = false) {
    clearTimeout(sendTimer);
    const speed = clampSpeed(value);
    settings.targetSpeed = speed;
    renderSpeed(speed);
    if (typeof chrome !== "undefined" && chrome.storage?.sync) {
      await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
    }
    if (connected) await sendMessage({ type: "SET_SPEED", speed, announce });
  }

  async function updateSettings(patch) {
    settings = { ...settings, ...patch };
    renderSettings();
    if (typeof chrome !== "undefined" && chrome.storage?.sync) {
      await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
    }
    if (connected) await sendMessage({ type: "UPDATE_SETTINGS", patch });
  }

  function bindEvents() {
    elements.slider.addEventListener("input", () => {
      const speed = clampSpeed(elements.slider.value);
      renderSpeed(speed);
      clearTimeout(sendTimer);
      sendTimer = setTimeout(() => setSpeed(speed), 55);
    });

    elements.input.addEventListener("change", () => setSpeed(elements.input.value, true));
    elements.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        setSpeed(elements.input.value, true);
        elements.input.blur();
      }
    });

    elements.presets.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-speed]");
      if (button) setSpeed(button.dataset.speed, true);
    });

    elements.step.addEventListener("change", () => updateSettings({ step: Number(elements.step.value) }));
    elements.remember.addEventListener("change", () => updateSettings({ rememberSpeed: elements.remember.checked }));
    elements.badge.addEventListener("change", () => updateSettings({ showBadge: elements.badge.checked }));
  }

  async function init() {
    bindEvents();
    renderSpeed(settings.targetSpeed);
    renderSettings();

    if (typeof chrome === "undefined" || !chrome.tabs?.query) {
      setConnection(true, "Mode aperçu");
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id ?? null;
    const state = await sendMessage({ type: "GET_STATE" });

    if (!state?.ok || !state.hasVideo) {
      setConnection(false, "Ouvrez une vidéo");
      return;
    }

    settings = { ...DEFAULT_SETTINGS, ...state.settings };
    renderSettings();
    renderSpeed(state.currentSpeed);
    setConnection(true, "Vidéo détectée");
  }

  init();
})();
