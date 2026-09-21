// small helpers — timing, storage, preload

import {
  ELEVATOR_GRAPHICS,
  STORAGE,
  TRAVEL_MS_FAR_DEFAULT,
  TRAVEL_MS_INITIAL_DEFAULT,
  TRAVEL_MS_NEAR_DEFAULT,
} from "./config.js";
import { state } from "./state.js";

export function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function readDurationMs(name, fallbackMs) {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!raw) return fallbackMs;
  if (raw.endsWith("ms")) return Number.parseFloat(raw);
  if (raw.endsWith("s")) return Number.parseFloat(raw) * 1000;
  return Number.parseFloat(raw) || fallbackMs;
}

export function getTravelDurationMs(fromFloor, toFloor) {
  // treat lobby as floor 0 for travel time
  const from = fromFloor ?? 0;
  const diff = Math.abs(toFloor - from);
  if (diff <= 0) return 0;
  if (diff === 1) {
    return readDurationMs("--travel-duration-near", TRAVEL_MS_NEAR_DEFAULT);
  }
  return readDurationMs("--travel-duration-far", TRAVEL_MS_FAR_DEFAULT);
}

export function getInitialTravelMs() {
  return readDurationMs("--travel-duration-initial", TRAVEL_MS_INITIAL_DEFAULT);
}

export function getDoorDurationMs() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--door-duration")
    .trim();
  if (!raw) return 1750;
  if (raw.endsWith("ms")) return Number.parseFloat(raw);
  if (raw.endsWith("s")) return Number.parseFloat(raw) * 1000;
  return Number.parseFloat(raw) || 1750;
}

export function getPageFloor() {
  const value = Number(document.body.dataset.floor);
  if (Number.isFinite(value) && value >= 1 && value <= 3) return value;
  return null;
}

export function readStoredFloor(key) {
  const raw = sessionStorage.getItem(key);
  if (raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function saveTripForNavigation(fromFloor, toFloor) {
  sessionStorage.setItem(STORAGE.fromFloor, String(fromFloor ?? 0));
  sessionStorage.setItem(STORAGE.destinationFloor, String(toFloor));
  sessionStorage.setItem(STORAGE.currentFloor, String(fromFloor ?? 0));
  sessionStorage.setItem(STORAGE.pendingArrival, "true");
}

export function consumePendingArrival() {
  const pending = sessionStorage.getItem(STORAGE.pendingArrival) === "true";
  const destination = readStoredFloor(STORAGE.destinationFloor);
  sessionStorage.removeItem(STORAGE.pendingArrival);
  return pending ? destination : null;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    img.onload = done;
    img.onerror = done; // dont block forever on a missing file
    img.src = src;
    if (img.complete) done();
  });
}

async function preloadElevatorGraphics() {
  const urls = new Set(ELEVATOR_GRAPHICS);

  // only chrome — not floor collage art (those made floor2 sit on black forever)
  document
    .querySelectorAll(
      ".elevator__door[src], .elevator__frame[src], .elevator__closed-shot[src], .elevator__display[src], .elevator__panel-image[src], .elevator__welcome[src]",
    )
    .forEach((img) => {
      const src = img.getAttribute("src");
      if (src) urls.add(src);
    });

  await Promise.all([...urls].map(loadImage));

  const critical = document.querySelectorAll(
    ".elevator__door, .elevator__frame, .elevator__closed-shot, .elevator__display, .elevator__panel-image",
  );
  await Promise.all(
    [...critical].map((img) =>
      typeof img.decode === "function"
        ? img.decode().catch(() => {})
        : Promise.resolve(),
    ),
  );
}

export async function ensureElevatorGraphicsReady() {
  // short timeout so we dont flash a long black screen
  await Promise.race([preloadElevatorGraphics(), wait(1500)]);
  if (state.elevatorEl) {
    state.elevatorEl.classList.add("elevator--ready");
  }
}
