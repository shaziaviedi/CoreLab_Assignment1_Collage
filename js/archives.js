// floor 2 archives
// marquee idea from https://codefronts.com/motion/css-infinite-marquee/draggable-marquee-inertia/

const CRUISE_PX_PER_SEC = 28;
const FRICTION = 0.965;
const DRAG_SCALE = 0.55;
const WHEEL_SCALE = 0.42;
const THROW_BOOST = 1.35;
const VELOCITY_SAMPLES = 5;
const HOVER_DELAY_MS = 700;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function waitForImages(root) {
  const imgs = [...root.querySelectorAll("img")];
  return Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    }),
  );
}

function cloneSetsForLoop() {
  // clone only after images are loaded so both sets match width
  document.querySelectorAll("[data-gallery-set]").forEach((set) => {
    if (set.hasAttribute("data-gallery-clone")) return;
    const track = set.parentElement;
    if (!track || track.querySelector("[data-gallery-clone]")) return;

    const clone = set.cloneNode(true);
    clone.setAttribute("data-gallery-clone", "true");
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("[tabindex], a, button").forEach((el) => {
      el.setAttribute("tabindex", "-1");
    });
    track.appendChild(clone);
  });
}

function setupRow(row) {
  const track = row.querySelector(".gallery-track");
  const set = track?.querySelector("[data-gallery-set]");
  if (!track || !set) return;

  const goingLeft = row.classList.contains("gallery-row--top");
  const cruise = prefersReducedMotion()
    ? 0
    : goingLeft
      ? CRUISE_PX_PER_SEC
      : -CRUISE_PX_PER_SEC;

  let x = 0;
  let vel = cruise;
  let loopW = 0;
  let dragging = false;
  let lastX = 0;
  let lastT = 0;
  let prev = performance.now();
  let hoverReadyAt = 0;
  let hoverDelayTimer = null;
  const recent = [];

  function measure() {
    // use layout sizes (offset*), NOT getBoundingClientRect —
    // the stage is scaled, so rect width would desync the loop seam
    const sets = track.querySelectorAll("[data-gallery-set]");
    if (sets.length >= 2) {
      loopW = sets[1].offsetLeft - sets[0].offsetLeft;
    } else {
      loopW = set.offsetWidth;
    }
  }

  function wrap(value) {
    if (loopW <= 1) return 0;
    let v = value % loopW;
    if (v < 0) v += loopW;
    return v;
  }

  function apply() {
    x = wrap(x);
    track.style.transform = `translate3d(${-x}px, 0, 0)`;
  }

  function armHoverDelay() {
    hoverReadyAt = performance.now() + HOVER_DELAY_MS;
    row.classList.add("is-hover-blocked");
    window.clearTimeout(hoverDelayTimer);
    hoverDelayTimer = window.setTimeout(() => {
      row.classList.remove("is-hover-blocked");
    }, HOVER_DELAY_MS);
  }

  function setScrolling(on) {
    const wasScrolling = row.classList.contains("is-scrolling");
    row.classList.toggle("is-scrolling", on);
    row.classList.toggle("is-interacting", on);
    if (on) {
      window.clearTimeout(hoverDelayTimer);
      row.classList.add("is-hover-blocked");
    } else if (wasScrolling) {
      armHoverDelay();
    }
  }

  function isInspecting() {
    if (row.classList.contains("is-scrolling")) return false;
    if (performance.now() < hoverReadyAt) return false;
    return (
      row.matches(":has(.artwork__media img:hover)") ||
      row.matches(":has(.artwork:focus-within)")
    );
  }

  function sampleVelocity(dx, dtMs) {
    if (dtMs <= 0) return;
    recent.push((dx / dtMs) * 1000);
    if (recent.length > VELOCITY_SAMPLES) recent.shift();
  }

  function releaseVelocity() {
    if (!recent.length) return cruise;
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    recent.length = 0;
    return avg;
  }

  function settleTowardCruise() {
    if (Math.abs(vel) > Math.abs(cruise) + 0.8) {
      vel *= FRICTION;
      if (Math.abs(vel) < Math.abs(cruise)) vel = cruise;
      if (cruise !== 0 && Math.sign(vel) !== Math.sign(cruise)) vel = cruise;
    } else {
      vel = cruise;
      setScrolling(false);
    }
  }

  function frame(now) {
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;

    if (loopW <= 1) {
      measure();
      x = 0;
      apply();
      requestAnimationFrame(frame);
      return;
    }

    if (!dragging) {
      settleTowardCruise();
      if (!isInspecting()) x += vel * dt;
    }

    apply();
    requestAnimationFrame(frame);
  }

  row.addEventListener(
    "wheel",
    (event) => {
      if (loopW <= 1) return;
      const delta = event.deltaX !== 0 ? event.deltaX : event.deltaY;
      if (delta === 0) return;
      event.preventDefault();
      setScrolling(true);
      x += delta * WHEEL_SCALE;
      vel = cruise + delta * WHEEL_SCALE * 28;
      apply();
    },
    { passive: false },
  );

  row.addEventListener("pointerdown", (event) => {
    if (loopW <= 1) return;
    dragging = true;
    lastX = event.clientX;
    lastT = performance.now();
    recent.length = 0;
    vel = 0;
    setScrolling(true);
    row.setPointerCapture(event.pointerId);
  });

  row.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = (event.clientX - lastX) * DRAG_SCALE;
    const dtMs = now - lastT;
    lastX = event.clientX;
    lastT = now;
    x -= dx;
    sampleVelocity(-dx, dtMs);
    apply();
  });

  function endDrag(event) {
    if (!dragging) return;
    dragging = false;
    try {
      row.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
    vel = releaseVelocity() * THROW_BOOST;
    if (Math.abs(vel) < Math.abs(cruise) * 0.6) {
      vel = cruise;
      setScrolling(false);
    } else {
      setScrolling(true);
    }
  }

  row.addEventListener("pointerup", endDrag);
  row.addEventListener("pointercancel", endDrag);

  const ro = new ResizeObserver(() => {
    const prevW = loopW;
    measure();
    // only correct position if the set width actually changed
    if (prevW > 1 && loopW > 1 && Math.abs(loopW - prevW) > 0.5) {
      x = (x / prevW) * loopW;
    }
    apply();
  });
  ro.observe(set);

  measure();
  x = 0;
  apply();
  requestAnimationFrame(frame);
}

function markMissingImages() {
  document.querySelectorAll(".artwork__media img").forEach((img) => {
    if (img.complete && img.naturalWidth === 0) {
      img.classList.add("is-missing");
      return;
    }
    img.addEventListener("error", () => {
      img.classList.add("is-missing");
    });
  });
}

function setupGalleryMusic() {
  const audio = document.getElementById("gallery-music");
  const elevator = document.querySelector(".elevator");
  if (!audio || !elevator) return;

  audio.loop = true;
  audio.volume = 0.4;
  // kick off download right away so play isnt waiting on art loads
  try {
    audio.load();
  } catch (_) {
    /* ignore */
  }

  function sync() {
    if (elevator.classList.contains("elevator--open")) {
      const playAttempt = audio.play();
      if (playAttempt !== undefined) {
        playAttempt.catch(() => {
          // wait for a user gesture if the browser blocks it
        });
      }
    } else {
      audio.pause();
    }
  }

  const observer = new MutationObserver(sync);
  observer.observe(elevator, { attributes: true, attributeFilter: ["class"] });

  // if play isnt ready yet, retry once it can
  audio.addEventListener("canplay", sync, { once: true });
  sync();
}

async function initArchives() {
  if (!document.querySelector(".archives__doorway")) return;

  // music first — dont wait on image loads
  setupGalleryMusic();

  const gallery = document.querySelector(".archives__gallery");
  const rows = document.querySelectorAll("[data-gallery-row]");

  // load art first, then clone — keeps both sets the same width
  if (gallery) await waitForImages(gallery);
  cloneSetsForLoop();
  markMissingImages();

  // one more frame so layout settles after cloning
  requestAnimationFrame(() => {
    rows.forEach((row) => setupRow(row));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initArchives();
  });
} else {
  initArchives();
}
