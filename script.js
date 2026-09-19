// elevator controls: doors, floor buttons, and travel music
// TODO: navigate to floor1/2/3.html after the doors open

const FLOOR_PAGES = {
  1: "floor1.html",
  2: "floor2.html",
  3: "floor3.html",
};

const PANEL_IMAGES = {
  idle: "assets/elevator-images/button-panel.png",
  1: "assets/elevator-images/button-lit1.png",
  2: "assets/elevator-images/button-lit2.png",
  3: "assets/elevator-images/button-lit3.png",
};

const PANEL_ALTS = {
  idle: "Elevator button panel with floors 3, 2, and 1 from top to bottom",
  1: "Elevator button panel with floor 1 selected and lit",
  2: "Elevator button panel with floor 2 selected and lit",
  3: "Elevator button panel with floor 3 selected and lit",
};

// fallbacks if the css vars do not load
const TRAVEL_MS_NEAR_DEFAULT = 3000;
const TRAVEL_MS_FAR_DEFAULT = 5000;

function readDurationMs(name, fallbackMs) {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!raw) return fallbackMs;
  // css duration can be "3s" or "3000ms"
  if (raw.endsWith("ms")) return Number.parseFloat(raw);
  if (raw.endsWith("s")) return Number.parseFloat(raw) * 1000;
  return Number.parseFloat(raw) || fallbackMs;
}

function getTravelDurationMs(fromFloor, toFloor) {
  // treat lobby as floor 0 for distance math
  const from = fromFloor ?? 0;
  const diff = Math.abs(toFloor - from);
  if (diff <= 0) return 0;
  // 1 floor away = 3s, 2 or more = 5s
  if (diff === 1)
    return readDurationMs("--travel-duration-near", TRAVEL_MS_NEAR_DEFAULT);
  return readDurationMs("--travel-duration-far", TRAVEL_MS_FAR_DEFAULT);
}

let destinationFloor = null;
let currentFloor = null; // null means still at the entrance / lobby
let isTripInProgress = false;

let elevatorEl = null;
let leftDoorEl = null;
let musicEl = null;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function doorsAreOpen() {
  return Boolean(elevatorEl?.classList.contains("elevator--open"));
}

function setDoorsOpen(open) {
  return new Promise((resolve) => {
    if (!elevatorEl || !leftDoorEl) {
      resolve();
      return;
    }

    const alreadyOpen = doorsAreOpen();
    // skip restarting the animation if already in that state
    if (
      open === alreadyOpen &&
      !elevatorEl.classList.contains("elevator--moving")
    ) {
      resolve();
      return;
    }

    elevatorEl.classList.add("elevator--moving");
    elevatorEl.classList.toggle("elevator--open", open);
    elevatorEl.classList.toggle("elevator--closed", !open);

    // skip door animation when reduced motion is preferred
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      elevatorEl.classList.remove("elevator--moving");
      resolve();
      return;
    }

    const durationMs = getDoorDurationMs();
    let settled = false;

    const finish = () => {
      // guard so transitionend and timeout do not both resolve
      if (settled) return;
      settled = true;
      elevatorEl.classList.remove("elevator--moving");
      leftDoorEl.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(fallbackId);
      resolve();
    };

    const onTransitionEnd = (event) => {
      if (event.target !== leftDoorEl) return;
      if (event.propertyName !== "transform") return;
      finish();
    };

    leftDoorEl.addEventListener("transitionend", onTransitionEnd);
    // fallback if transitionend never fires
    const fallbackId = window.setTimeout(finish, durationMs + 100);
  });
}

function getDoorDurationMs() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--door-duration")
    .trim();
  if (!raw) return 1750;
  if (raw.endsWith("ms")) return Number.parseFloat(raw);
  if (raw.endsWith("s")) return Number.parseFloat(raw) * 1000;
  return Number.parseFloat(raw) || 1750;
}

function openDoors() {
  return setDoorsOpen(true);
}

function closeDoors() {
  return setDoorsOpen(false);
}

function startElevatorMusic() {
  if (!musicEl) return;
  musicEl.currentTime = 0;
  const playAttempt = musicEl.play();
  if (playAttempt !== undefined) {
    playAttempt.catch((error) => {
      // some browsers block play() until a user gesture finishes
      console.warn("Could not play elevator music:", error);
    });
  }
}

function stopElevatorMusic() {
  if (!musicEl) return;
  musicEl.pause();
  musicEl.currentTime = 0;
}

function setDisplayFloor(floor, floorNumberEl, floorDisplayEl) {
  if (floorNumberEl) {
    floorNumberEl.textContent = String(floor);
  }

  if (floorDisplayEl) {
    floorDisplayEl.setAttribute("aria-label", `Floor ${floor}`);
  }

  if (elevatorEl) {
    elevatorEl.dataset.displayFloor = String(floor);
  }
}

// light the selected button; screen updates during travel
function markDestinationSelection(floor, buttons, panelImage) {
  destinationFloor = floor;

  buttons.forEach((button) => {
    const isSelected = Number(button.dataset.floor) === floor;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  if (panelImage) {
    panelImage.src = PANEL_IMAGES[floor] || PANEL_IMAGES.idle;
    panelImage.alt = PANEL_ALTS[floor] || PANEL_ALTS.idle;
  }

  if (elevatorEl) {
    elevatorEl.dataset.destinationFloor = String(floor);
    elevatorEl.classList.add("is-awaiting-transition");
  }
}

// eg going from 1 to 3 returns [1, 2, 3]
function buildFloorPath(fromFloor, toFloor) {
  const start = fromFloor ?? 0;

  if (start === toFloor) {
    return [toFloor];
  }

  // from lobby, count up starting at 1
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

// split travel time evenly across each floor on the path
// destination stays on screen for a full step before doors open
async function animateFloorDisplay(
  path,
  totalMs,
  floorNumberEl,
  floorDisplayEl,
) {
  if (!path.length) return;

  const stepMs = totalMs > 0 ? totalMs / path.length : 0;

  for (let i = 0; i < path.length; i += 1) {
    setDisplayFloor(path[i], floorNumberEl, floorDisplayEl);
    if (stepMs > 0) await wait(stepMs);
  }
}

function setControlsBusy(busy, buttons) {
  isTripInProgress = busy;
  buttons.forEach((button) => {
    button.disabled = busy;
  });
  if (elevatorEl) {
    elevatorEl.classList.toggle("elevator--traveling", busy);
  }
}

async function runFloorTrip(floor, ui) {
  if (isTripInProgress) return;
  if (!FLOOR_PAGES[floor]) return;

  setControlsBusy(true, ui.buttons);
  markDestinationSelection(floor, ui.buttons, ui.panelImage);

  // already on this floor — just make sure doors are open
  if (currentFloor === floor) {
    console.log(`Already on floor ${floor}.`);
    try {
      setDisplayFloor(floor, ui.floorNumberEl, ui.floorDisplayEl);
      if (!doorsAreOpen()) await openDoors();
    } finally {
      setControlsBusy(false, ui.buttons);
    }
    return;
  }

  const fromFloor = currentFloor;
  const travelMs = getTravelDurationMs(fromFloor, floor);
  const path = buildFloorPath(fromFloor, floor);

  console.log(
    `Selected floor: ${floor} → ${FLOOR_PAGES[floor]} | from ${fromFloor ?? "lobby"} | path [${path.join(", ")}] | travel ${travelMs}ms`,
  );

  try {
    // keep the current floor on screen until counting starts
    if (fromFloor != null) {
      setDisplayFloor(fromFloor, ui.floorNumberEl, ui.floorDisplayEl);
    }

    if (doorsAreOpen()) {
      await closeDoors();
    } else if (elevatorEl) {
      elevatorEl.classList.add("elevator--closed");
      elevatorEl.classList.remove("elevator--open");
    }

    if (travelMs > 0) {
      startElevatorMusic();
      await animateFloorDisplay(
        path,
        travelMs,
        ui.floorNumberEl,
        ui.floorDisplayEl,
      );
      stopElevatorMusic();
    } else {
      setDisplayFloor(floor, ui.floorNumberEl, ui.floorDisplayEl);
    }

    // destination number should already be showing
    await openDoors();
    currentFloor = floor;

    if (elevatorEl) {
      elevatorEl.dataset.currentFloor = String(floor);
    }

    // TODO: navigate to the floor page here later
    console.log(
      `Arrived at floor ${floor}. Doors open. (Navigation not wired yet.)`,
    );
  } finally {
    stopElevatorMusic();
    setControlsBusy(false, ui.buttons);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  elevatorEl = document.querySelector(".elevator");
  leftDoorEl = document.querySelector(".elevator__door--left, .left-door");
  musicEl = document.getElementById("elevator-music");

  const floorNumberEl = document.getElementById("floor-number");
  const floorDisplayEl = document.getElementById("floor-display");
  const panelImage = document.getElementById("button-panel-image");
  const buttons = document.querySelectorAll(".elevator__button");

  const ui = { buttons, floorNumberEl, floorDisplayEl, panelImage };

  if (elevatorEl && !elevatorEl.classList.contains("elevator--open")) {
    elevatorEl.classList.add("elevator--closed");
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const floor = Number(button.dataset.floor);
      runFloorTrip(floor, ui);
    });
  });
});
