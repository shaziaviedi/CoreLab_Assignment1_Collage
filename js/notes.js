// sticky note & welcome sign stuff

import { WELCOME_SIGN_FLICKER, WELCOME_SIGN_ON } from "./config.js";
import { state } from "./state.js";
import { readDurationMs } from "./helpers.js";

export function stopWelcomeFlicker() {
  if (state.welcomeFlickerTimer != null) {
    window.clearTimeout(state.welcomeFlickerTimer);
    state.welcomeFlickerTimer = null;
  }
}

function getNoteIdleMs() {
  return readDurationMs("--note-idle-ms", 10000);
}

export function clearNoteIdleTimer() {
  if (state.noteIdleTimer != null) {
    window.clearTimeout(state.noteIdleTimer);
    state.noteIdleTimer = null;
  }
}

function showStickyNote() {
  const note = document.getElementById("sticky-note");
  if (!note || note.classList.contains("elevator__note--fly-away")) return;
  note.classList.add("is-visible");
}

export function startStickyNoteIdleTimer() {
  const note = document.getElementById("sticky-note");
  if (!note) return;

  clearNoteIdleTimer();
  note.classList.remove("is-visible");
  note.classList.remove("elevator__note--fly-away");

  state.noteIdleTimer = window.setTimeout(() => {
    state.noteIdleTimer = null;
    if (state.isTripInProgress) return;
    showStickyNote();
  }, getNoteIdleMs());
}

export function flyAwayStickyNote() {
  const note = document.getElementById("sticky-note");
  clearNoteIdleTimer();
  if (!note) return Promise.resolve();

  // note never faded in, nothing to animate
  if (!note.classList.contains("is-visible")) {
    note.classList.remove("is-visible");
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      note.removeEventListener("animationend", onEnd);
      window.clearTimeout(fallbackId);
      note.classList.remove("is-visible");
      resolve();
    };

    const onEnd = (event) => {
      if (event.target !== note) return;
      finish();
    };

    note.addEventListener("animationend", onEnd);
    note.classList.add("elevator__note--fly-away");

    // fallback in case animationend doesnt fire
    const ms = readDurationMs("--note-fly-duration", 1100);
    const fallbackId = window.setTimeout(finish, ms + 80);
  });
}

// swap lit / dim pngs for the welcome flicker
export function startWelcomeFlicker() {
  const sign = document.querySelector(".elevator__welcome");
  if (!sign) return;

  const preload = new Image();
  preload.src = WELCOME_SIGN_FLICKER;

  stopWelcomeFlicker();
  let showingFlicker = false;

  const tick = () => {
    if (sign.classList.contains("elevator__welcome--fly-away")) {
      stopWelcomeFlicker();
      return;
    }

    showingFlicker = !showingFlicker;
    sign.src = showingFlicker ? WELCOME_SIGN_FLICKER : WELCOME_SIGN_ON;

    // random delays so it doesnt look too regular
    let delay;
    if (showingFlicker) {
      delay = 60 + Math.random() * 140;
    } else {
      delay =
        Math.random() < 0.35
          ? 120 + Math.random() * 280
          : 700 + Math.random() * 1800;
    }

    state.welcomeFlickerTimer = window.setTimeout(tick, delay);
  };

  state.welcomeFlickerTimer = window.setTimeout(
    tick,
    400 + Math.random() * 900,
  );
}

export function flyAwayWelcomeSign() {
  const sign = document.querySelector(".elevator__welcome");
  if (!sign) return Promise.resolve();

  stopWelcomeFlicker();
  sign.src = WELCOME_SIGN_ON;

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      sign.removeEventListener("animationend", onEnd);
      window.clearTimeout(fallbackId);
      resolve();
    };

    const onEnd = (event) => {
      if (event.target !== sign) return;
      finish();
    };

    sign.addEventListener("animationend", onEnd);
    sign.classList.add("elevator__welcome--fly-away");

    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--welcome-fly-duration")
      .trim();
    let ms = 1100;
    if (raw.endsWith("ms")) ms = Number.parseFloat(raw);
    else if (raw.endsWith("s")) ms = Number.parseFloat(raw) * 1000;

    const fallbackId = window.setTimeout(finish, ms + 80);
  });
}
