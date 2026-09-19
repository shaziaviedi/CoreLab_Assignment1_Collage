// door open / close animation

import { state } from "./state.js";
import { getDoorDurationMs } from "./helpers.js";

export function doorsAreOpen() {
  return Boolean(state.elevatorEl?.classList.contains("elevator--open"));
}

function setDoorsOpen(open) {
  return new Promise((resolve) => {
    if (!state.elevatorEl || !state.leftDoorEl) {
      resolve();
      return;
    }

    const alreadyOpen = doorsAreOpen();
    if (
      open === alreadyOpen &&
      !state.elevatorEl.classList.contains("elevator--moving")
    ) {
      resolve();
      return;
    }

    state.elevatorEl.classList.add("elevator--moving");
    state.elevatorEl.classList.toggle("elevator--open", open);
    state.elevatorEl.classList.toggle("elevator--closed", !open);

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      state.elevatorEl.classList.remove("elevator--moving");
      resolve();
      return;
    }

    const durationMs = getDoorDurationMs();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      state.elevatorEl.classList.remove("elevator--moving");
      state.leftDoorEl.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(fallbackId);
      resolve();
    };

    // wait on left door transform, timeout as backup
    const onTransitionEnd = (event) => {
      if (event.target !== state.leftDoorEl) return;
      if (event.propertyName !== "transform") return;
      finish();
    };

    state.leftDoorEl.addEventListener("transitionend", onTransitionEnd);
    const fallbackId = window.setTimeout(finish, durationMs + 100);
  });
}

export function openDoors() {
  return setDoorsOpen(true);
}

export function closeDoors() {
  return setDoorsOpen(false);
}
