// mutable stuff shared across the elevator modules

export const state = {
  welcomeFlickerTimer: null,
  noteIdleTimer: null,
  destinationFloor: null,
  currentFloor: null, // null until we leave the homepage
  isTripInProgress: false,
  isHomePage: false,
  elevatorEl: null,
  leftDoorEl: null,
  musicEl: null,
  ui: null,
};
