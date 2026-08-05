(() => {
  "use strict";

  const { MIN_SPEED, MAX_SPEED, normalizeSpeed, formatSpeed, normalizeSettings, reportError } = TurboTube;

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
  let settings = normalizeSettings();
  let sendTimer = null;

  function updateProgress(speed) {
    const progress = ((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;
    elements.slider.style.setProperty("--slider-progress", `${progress}%`);
  }

  function renderSpeed(value) {
    const speed = normalizeSpeed(value);
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
    } catch (error) {
      reportError("Communication avec l’onglet YouTube impossible", error);
      setConnection(false, "Ouvrez YouTube");
      return null;
    }
  }

  async function setSpeed(value, announce = false) {
    clearTimeout(sendTimer);
    const speed = normalizeSpeed(value);
    settings.targetSpeed = speed;
    renderSpeed(speed);
    if (connected) await sendMessage({ type: "SET_SPEED", speed, announce });
  }

  async function updateSettings(patch) {
    settings = normalizeSettings({ ...settings, ...patch });
    renderSettings();
    if (connected) await sendMessage({ type: "UPDATE_SETTINGS", patch });
  }

  function bindEvents() {
    elements.slider.addEventListener("input", () => {
      const speed = normalizeSpeed(elements.slider.value);
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

    settings = normalizeSettings(state.settings);
    renderSettings();
    renderSpeed(state.currentSpeed);
    setConnection(true, "Vidéo détectée");
  }

  void init().catch((error) => {
    reportError("Initialisation de la fenêtre impossible", error);
    setConnection(false, "Extension indisponible");
  });
})();
