// screen readout, button panel, music, busy state

import { PANEL_ALTS, PANEL_IMAGES } from "./config.js";
import { state } from "./state.js";
import { wait } from "./helpers.js";

export function startElevatorMusic() {
  if (!state.musicEl) return;
  state.musicEl.currentTime = 0;
  const playAttempt = state.musicEl.play();
  if (playAttempt !== undefined) {
    playAttempt.catch((error) => {
      console.warn("Could not play elevator music:", error);
    });
  }
}

export function stopElevatorMusic() {
  if (!state.musicEl) return;
  state.musicEl.pause();
  state.musicEl.currentTime = 0;
}

export function setDisplayFloor(floor, floorNumberEl, floorDisplayEl) {
  if (floorNumberEl) {
    floorNumberEl.textContent = String(floor);
  }

  if (floorDisplayEl) {
    floorDisplayEl.setAttribute("aria-label", `Floor ${floor}`);
  }

  if (state.elevatorEl) {
    state.elevatorEl.dataset.displayFloor = String(floor);
  }
}

export function markDestinationSelection(floor, buttons, panelImage) {
  state.destinationFloor = floor;

  buttons.forEach((button) => {
    const isSelected = Number(button.dataset.floor) === floor;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-current", isSelected ? "page" : "false");
  });

  if (panelImage) {
    panelImage.src = PANEL_IMAGES[floor] || PANEL_IMAGES.idle;
    panelImage.alt = PANEL_ALTS[floor] || PANEL_ALTS.idle;
  }

  if (state.elevatorEl) {
    state.elevatorEl.dataset.destinationFloor = String(floor);
  }
}

export function buildFloorPath(fromFloor, toFloor) {
  const start = fromFloor ?? 0;

  if (start === toFloor) {
    return [toFloor];
  }

  // from lobby (0) step up to destination
  if (start === 0) {
    const path = [];
    const step = toFloor > 0 ? 1 : -1;
    for (
      let floor = step;
      step > 0 ? floor <= toFloor : floor >= toFloor;
      floor += step
    ) {
      path.push(floor);
    }
    return path.length ? path : [toFloor];
  }

  const path = [];
  const step = toFloor > start ? 1 : -1;
  for (
    let floor = start;
    step > 0 ? floor <= toFloor : floor >= toFloor;
    floor += step
  ) {
    path.push(floor);
  }
  return path;
}

export async function animateFloorDisplay(
  path,
  totalMs,
  floorNumberEl,
  floorDisplayEl,
) {
  if (!path.length) return;

  // split total travel time evenly across floors in the path
  const stepMs = totalMs > 0 ? totalMs / path.length : 0;

  for (let i = 0; i < path.length; i += 1) {
    setDisplayFloor(path[i], floorNumberEl, floorDisplayEl);
    if (stepMs > 0) await wait(stepMs);
  }
}

export function setControlsBusy(busy, buttons) {
  state.isTripInProgress = busy;
  buttons.forEach((button) => {
    button.classList.toggle("is-busy", busy);
    button.setAttribute("aria-disabled", String(busy));
    if (busy) {
      button.setAttribute("tabindex", "-1");
    } else {
      button.removeAttribute("tabindex");
    }
  });

  const homeLink = document.querySelector(".elevator__note--home-link");
  if (homeLink) {
    homeLink.classList.toggle("is-busy", busy);
    homeLink.setAttribute("aria-disabled", String(busy));
  }

  if (state.elevatorEl) {
    state.elevatorEl.classList.toggle("elevator--traveling", busy);
  }
}
