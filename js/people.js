// floor 1 people

const REACTION_SOUNDS = [
  "assets/audio/hi.mp3",
  "assets/audio/bye.mp3",
  "assets/audio/huh.mp3",
  "assets/audio/angry.mp3",
];

const HOP_MS = 550;
const ALT_HOLD_MS = 800;
const ALPHA_MIN = 16;

let reactionAudio = null;

// alpha hit-test canvases
const canvasCache = new WeakMap();

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function playRandomReaction() {
  const pick =
    REACTION_SOUNDS[Math.floor(Math.random() * REACTION_SOUNDS.length)];

  if (!reactionAudio) {
    reactionAudio = new Audio();
    reactionAudio.volume = 0.55;
  }

  try {
    reactionAudio.pause();
    reactionAudio.currentTime = 0;
  } catch {
    // ignore
  }

  reactionAudio.src = pick;
  const playAttempt = reactionAudio.play();
  if (playAttempt !== undefined) {
    playAttempt.catch(() => {
      // autoplay blocked or missing file — ignore
    });
  }
}

function preloadAlts() {
  document.querySelectorAll(".person[data-alt]").forEach((person) => {
    const alt = person.getAttribute("data-alt");
    if (!alt) return;
    const img = new Image();
    img.src = alt;
  });
}

function markMissing(img) {
  if (img.complete && img.naturalWidth === 0) {
    img.classList.add("is-missing");
  }
  img.addEventListener("error", () => {
    img.classList.add("is-missing");
  });
}

function invalidateCanvas(img) {
  canvasCache.delete(img);
}

function ensureCanvas(img) {
  if (!img.complete || img.naturalWidth === 0) return null;

  const cached = canvasCache.get(img);
  if (cached && cached.src === img.currentSrc) return cached.canvas;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(img, 0, 0);
    ctx.getImageData(0, 0, 1, 1); // fail early if canvas is tainted
  } catch {
    return null;
  }

  canvasCache.set(img, { canvas, src: img.currentSrc });
  return canvas;
}

// viewport → natural pixel (object-fit contain)
function mapPointToImagePixel(img, clientX, clientY) {
  const rect = img.getBoundingClientRect();
  if (
    clientX < rect.left ||
    clientX >= rect.right ||
    clientY < rect.top ||
    clientY >= rect.bottom
  ) {
    return null;
  }

  const dispW = rect.width;
  const dispH = rect.height;
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (dispW <= 0 || dispH <= 0 || natW <= 0 || natH <= 0) return null;

  const scale = Math.min(dispW / natW, dispH / natH);
  const drawW = natW * scale;
  const drawH = natH * scale;
  const offsetX = (dispW - drawW) / 2;
  const offsetY = dispH - drawH; // object-position: center bottom

  const x = clientX - rect.left - offsetX;
  const y = clientY - rect.top - offsetY;
  if (x < 0 || y < 0 || x >= drawW || y >= drawH) return null;

  return {
    px: Math.min(natW - 1, Math.max(0, Math.floor((x / drawW) * natW))),
    py: Math.min(natH - 1, Math.max(0, Math.floor((y / drawH) * natH))),
  };
}

function isOpaqueAt(img, clientX, clientY) {
  const mapped = mapPointToImagePixel(img, clientX, clientY);
  if (!mapped) return false;

  const canvas = ensureCanvas(img);
  if (!canvas) return false;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  const alpha = ctx.getImageData(mapped.px, mapped.py, 1, 1).data[3];
  return alpha > ALPHA_MIN;
}

function peopleFrontFirst(crowd) {
  return [...crowd.querySelectorAll(".person")].sort((a, b) => {
    const za = Number(getComputedStyle(a).zIndex) || 0;
    const zb = Number(getComputedStyle(b).zIndex) || 0;
    const boost = (el) =>
      (el.classList.contains("is-reacting") ? 1000 : 0) +
      (el.classList.contains("is-aimed") ? 50 : 0);
    return zb + boost(b) - (za + boost(a));
  });
}

function personAtPoint(crowd, clientX, clientY) {
  for (const person of peopleFrontFirst(crowd)) {
    const img = person.querySelector(".person__image");
    if (!img || img.classList.contains("is-missing")) continue;
    if (isOpaqueAt(img, clientX, clientY)) return person;
  }
  return null;
}

function setAimed(crowd, person) {
  crowd.querySelectorAll(".person.is-aimed").forEach((el) => {
    if (el !== person) el.classList.remove("is-aimed");
  });
  if (person) {
    person.classList.add("is-aimed");
    crowd.classList.add("is-over-person");
  } else {
    crowd.classList.remove("is-over-person");
  }
}

function reactPerson(person) {
  if (person.classList.contains("is-reacting")) return;

  const img = person.querySelector(".person__image");
  const primary =
    person.getAttribute("data-primary") || img?.getAttribute("src");
  const alt = person.getAttribute("data-alt");

  person.classList.add("is-reacting");
  playRandomReaction();

  // swap to -2 png if they have one
  if (alt && img) {
    invalidateCanvas(img);
    img.src = alt;
  }

  const hopDone = prefersReducedMotion() ? 350 : HOP_MS;
  const restoreAt = Math.max(hopDone, ALT_HOLD_MS);

  window.setTimeout(() => {
    person.classList.remove("is-reacting");
  }, hopDone);

  window.setTimeout(() => {
    if (alt && img && primary) {
      invalidateCanvas(img);
      img.src = primary;
    }
  }, restoreAt);
}

function setupPeople() {
  const crowd = document.querySelector(".people-crowd");
  if (!crowd) return;

  preloadAlts();

  crowd.querySelectorAll(".person").forEach((person) => {
    const img = person.querySelector(".person__image");
    if (img) {
      markMissing(img);
      img.addEventListener("load", () => invalidateCanvas(img));
    }

    const primary = person.getAttribute("data-primary");
    if (primary && img && !img.getAttribute("src")) {
      img.src = primary;
    }

    // keyboard skips pixel test
    person.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        reactPerson(person);
      }
    });
  });

  // only opaque pixels count as hits
  crowd.addEventListener("pointermove", (event) => {
    const hit = personAtPoint(crowd, event.clientX, event.clientY);
    setAimed(crowd, hit);
  });

  crowd.addEventListener("pointerleave", () => {
    setAimed(crowd, null);
  });

  crowd.addEventListener("click", (event) => {
    const hit = personAtPoint(crowd, event.clientX, event.clientY);
    if (hit) reactPerson(hit);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupPeople);
} else {
  setupPeople();
}
