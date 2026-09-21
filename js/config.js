// shared constants for index & floor pages

export const FLOOR_PAGES = {
  1: "floor1.html",
  2: "floor2.html",
  3: "floor3.html",
};

export const PANEL_IMAGES = {
  idle: "assets/elevator-images/button-panel.png",
  1: "assets/elevator-images/button-lit1.png",
  2: "assets/elevator-images/button-lit2.png",
  3: "assets/elevator-images/button-lit3.png",
};

export const PANEL_ALTS = {
  idle: "Elevator button panel with floors 3, 2, and 1 from top to bottom",
  1: "Elevator button panel with floor 1 selected and lit",
  2: "Elevator button panel with floor 2 selected and lit",
  3: "Elevator button panel with floor 3 selected and lit",
};

export const STORAGE = {
  currentFloor: "elevator.currentFloor",
  destinationFloor: "elevator.destinationFloor",
  fromFloor: "elevator.fromFloor",
  pendingArrival: "elevator.pendingArrival",
};

export const TRAVEL_MS_NEAR_DEFAULT = 3000;
export const TRAVEL_MS_FAR_DEFAULT = 5000;
export const TRAVEL_MS_INITIAL_DEFAULT = 3000; // first trip from homepage
export const ARRIVAL_RENDER_WAIT_MS = 80;

export const WELCOME_SIGN_ON = "assets/homepage-images/welcome-sign.png";
export const WELCOME_SIGN_FLICKER =
  "assets/homepage-images/welcome-sign-flicker.png";

// core elevator art — preload so collage doesnt show thru first
export const ELEVATOR_GRAPHICS = [
  "assets/elevator-images/elevator.png",
  "assets/elevator-images/elevator-door-left.png",
  "assets/elevator-images/elevator-door-right.png",
  "assets/elevator-images/elevator-doors-removed.png",
  "assets/elevator-images/elevator-screen.png",
  "assets/elevator-images/button-panel.png",
  "assets/elevator-images/button-lit1.png",
  "assets/elevator-images/button-lit2.png",
  "assets/elevator-images/button-lit3.png",
  "assets/homepage-images/note.png",
  WELCOME_SIGN_ON,
  WELCOME_SIGN_FLICKER,
];
