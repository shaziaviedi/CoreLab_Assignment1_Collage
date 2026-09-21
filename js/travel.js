// floor trips & arrival (homepage and between floors)

import { ARRIVAL_RENDER_WAIT_MS, FLOOR_PAGES, STORAGE } from "./config.js";
import { state } from "./state.js";
import {
  getInitialTravelMs,
  getTravelDurationMs,
  saveTripForNavigation,
  wait,
} from "./helpers.js";
import { closeDoors, doorsAreOpen, openDoors } from "./doors.js";
import {
  clearNoteIdleTimer,
  flyAwayStickyNote,
  flyAwayWelcomeSign,
  startStickyNoteIdleTimer,
} from "./notes.js";
import {
  animateFloorDisplay,
  buildFloorPath,
  markDestinationSelection,
  setControlsBusy,
  setDisplayFloor,
  startElevatorMusic,
  stopElevatorMusic,
} from "./controls.js";

// swap closed photo for layered doors (already closed so no jump)
function activateInteractiveElevator() {
  const interactive = document.querySelector(".elevator__interactive");
  if (interactive) {
    interactive.hidden = false;
  }

  if (state.elevatorEl) {
    state.elevatorEl.classList.remove("elevator--home");
    state.elevatorEl.classList.add("elevator--closed");
    state.elevatorEl.classList.remove("elevator--open");
  }

  // door was inside the hidden block so re-query it
  state.leftDoorEl = document.querySelector(
    ".elevator__door--left, .left-door",
  );
}

async function runHomepageTrip(floor, href) {
  markDestinationSelection(floor, state.ui.buttons, state.ui.panelImage);

  // fly off sign & note while we swap to layered elevator
  const flyPromise = Promise.all([flyAwayWelcomeSign(), flyAwayStickyNote()]);
  activateInteractiveElevator();

  const travelMs = getInitialTravelMs();
  const path = buildFloorPath(null, floor);

  console.log(`homepage → floor ${floor} | initial travel ${travelMs}ms`);

  startElevatorMusic();
  await Promise.all([
    flyPromise,
    animateFloorDisplay(
      path,
      travelMs,
      state.ui.floorNumberEl,
      state.ui.floorDisplayEl,
    ),
  ]);
  stopElevatorMusic();

  saveTripForNavigation(null, floor);
  window.location.href = href || FLOOR_PAGES[floor];
}

export async function runFloorTrip(floor, href) {
  if (state.isTripInProgress) return;
  if (!FLOOR_PAGES[floor]) return;

  const targetHref = href || FLOOR_PAGES[floor];

  setControlsBusy(true, state.ui.buttons);

  // homepage first ride is always 3s, skip floor-diff math
  if (state.isHomePage && state.currentFloor == null) {
    try {
      await runHomepageTrip(floor, targetHref);
    } catch (error) {
      console.warn("homepage trip failed", error);
      stopElevatorMusic();
      setControlsBusy(false, state.ui.buttons);
    }
    return;
  }

  markDestinationSelection(floor, state.ui.buttons, state.ui.panelImage);

  // already here — just reopen doors if needed
  if (state.currentFloor === floor) {
    try {
      setDisplayFloor(floor, state.ui.floorNumberEl, state.ui.floorDisplayEl);
      if (!doorsAreOpen()) await openDoors();
    } finally {
      setControlsBusy(false, state.ui.buttons);
    }
    return;
  }

  await flyAwayStickyNote();

  const fromFloor = state.currentFloor;
  const travelMs = getTravelDurationMs(fromFloor, floor);
  const path = buildFloorPath(fromFloor, floor);

  console.log(
    `trip ${fromFloor ?? "lobby"} → ${floor} | ${travelMs}ms then go to ${targetHref}`,
  );

  try {
    if (fromFloor != null) {
      setDisplayFloor(
        fromFloor,
        state.ui.floorNumberEl,
        state.ui.floorDisplayEl,
      );
    }

    // close doors before travel / page change
    if (doorsAreOpen()) {
      await closeDoors();
    } else if (state.elevatorEl) {
      state.elevatorEl.classList.add("elevator--closed");
      state.elevatorEl.classList.remove("elevator--open");
    }

    if (travelMs > 0) {
      startElevatorMusic();
      await animateFloorDisplay(
        path,
        travelMs,
        state.ui.floorNumberEl,
        state.ui.floorDisplayEl,
      );
      stopElevatorMusic();
    } else {
      setDisplayFloor(floor, state.ui.floorNumberEl, state.ui.floorDisplayEl);
    }

    saveTripForNavigation(fromFloor, floor);
    window.location.href = targetHref;
  } catch (error) {
    console.warn("trip failed", error);
    stopElevatorMusic();
    setControlsBusy(false, state.ui.buttons);
  }
}

export async function handleArrival(destination) {
  setControlsBusy(true, state.ui.buttons);

  // land closed, then open after a short wait
  if (state.elevatorEl) {
    state.elevatorEl.classList.add("elevator--closed");
    state.elevatorEl.classList.remove("elevator--open");
  }

  markDestinationSelection(destination, state.ui.buttons, state.ui.panelImage);
  setDisplayFloor(destination, state.ui.floorNumberEl, state.ui.floorDisplayEl);

  state.currentFloor = destination;
  sessionStorage.setItem(STORAGE.currentFloor, String(destination));
  sessionStorage.setItem(STORAGE.destinationFloor, String(destination));

  await wait(ARRIVAL_RENDER_WAIT_MS);
  await openDoors();

  setControlsBusy(false, state.ui.buttons);
  startStickyNoteIdleTimer();
  console.log(`arrived floor ${destination}, doors open`);
}

export async function goHomeFromNote(href) {
  if (state.isTripInProgress) return;
  state.isTripInProgress = true;
  setControlsBusy(true, state.ui.buttons);
  clearNoteIdleTimer();

  try {
    await flyAwayStickyNote();
    if (doorsAreOpen()) {
      await closeDoors();
    }
    sessionStorage.setItem(STORAGE.currentFloor, "0");
    sessionStorage.removeItem(STORAGE.pendingArrival);
    window.location.href = href || "index.html";
  } catch (error) {
    console.warn("home trip failed", error);
    state.isTripInProgress = false;
    setControlsBusy(false, state.ui.buttons);
  }
}
