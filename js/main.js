// entry point — wires up the page then starts the elevator

import { ARRIVAL_RENDER_WAIT_MS, STORAGE } from "./config.js";
import { state } from "./state.js";
import {
  consumePendingArrival,
  ensureElevatorGraphicsReady,
  getPageFloor,
  wait,
} from "./helpers.js";
import { openDoors } from "./doors.js";
import {
  startStickyNoteIdleTimer,
  startWelcomeFlicker,
} from "./notes.js";
import {
  markDestinationSelection,
  setDisplayFloor,
} from "./controls.js";
import { goHomeFromNote, handleArrival, runFloorTrip } from "./travel.js";

async function initPage() {
  state.isHomePage = document.body.dataset.page === "home";
  state.elevatorEl = document.querySelector(".elevator");
  state.leftDoorEl = document.querySelector(
    ".elevator__door--left, .left-door",
  );
  state.musicEl = document.getElementById("elevator-music");

  state.ui = {
    floorNumberEl: document.getElementById("floor-number"),
    floorDisplayEl: document.getElementById("floor-display"),
    panelImage: document.getElementById("button-panel-image"),
    buttons: document.querySelectorAll(".elevator__button"),
  };

  if (state.elevatorEl) {
    state.elevatorEl.classList.add("elevator--closed");
    state.elevatorEl.classList.remove("elevator--open");
  }

  // wait for doors/frame etc before showing the stage
  await ensureElevatorGraphicsReady();

  const pageFloor = getPageFloor();
  const pendingDestination = consumePendingArrival();

  if (
    pendingDestination != null &&
    pageFloor != null &&
    pendingDestination === pageFloor
  ) {
    await handleArrival(pendingDestination);
  } else if (pageFloor != null) {
    // direct load / refresh on a floor page
    state.currentFloor = pageFloor;
    sessionStorage.setItem(STORAGE.currentFloor, String(pageFloor));
    markDestinationSelection(
      pageFloor,
      state.ui.buttons,
      state.ui.panelImage,
    );
    setDisplayFloor(
      pageFloor,
      state.ui.floorNumberEl,
      state.ui.floorDisplayEl,
    );
    await wait(ARRIVAL_RENDER_WAIT_MS);
    await openDoors();
    startStickyNoteIdleTimer();
  } else {
    // homepage start
    state.currentFloor = null;
    sessionStorage.setItem(STORAGE.currentFloor, "0");
    if (state.ui.floorNumberEl) {
      state.ui.floorNumberEl.textContent = "";
    }
    startWelcomeFlicker();
    startStickyNoteIdleTimer();
  }

  state.ui.buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const floor = Number(button.dataset.floor);
      runFloorTrip(floor);
    });
  });

  // HOME? note — close doors then back to index
  const stickyNote = document.getElementById("sticky-note");
  if (stickyNote && stickyNote.classList.contains("elevator__note--home-link")) {
    stickyNote.addEventListener("click", () => {
      goHomeFromNote();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initPage();
});
