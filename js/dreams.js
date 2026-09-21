// floor 3 dreams

const REVEAL_DURATION_MS = 5000;

function setupDreamsMusic() {
  const audio = document.getElementById("dreams-music");
  const elevator = document.querySelector(".elevator");
  if (!audio || !elevator) return;

  audio.loop = true;
  audio.volume = 0.45;

  function sync() {
    if (elevator.classList.contains("elevator--open")) {
      const playAttempt = audio.play();
      if (playAttempt !== undefined) {
        playAttempt.catch(() => {});
      }
    } else {
      audio.pause();
    }
  }

  const observer = new MutationObserver(sync);
  observer.observe(elevator, { attributes: true, attributeFilter: ["class"] });
  sync();
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function markMissingImages(root) {
  root.querySelectorAll("img").forEach((img) => {
    if (img.complete && img.naturalWidth === 0) {
      img.classList.add("is-missing");
    }
    img.addEventListener("error", () => {
      img.classList.add("is-missing");
    });
  });
}

// use offset* so sparkles line up even when the elevator is scaled
function spawnSparkles(portal, originX, originY) {
  const count = prefersReducedMotion() ? 4 : 6 + Math.floor(Math.random() * 7);

  for (let i = 0; i < count; i++) {
    const particle = document.createElement("span");
    particle.className = i % 3 === 0 ? "sparkle sparkle--star" : "sparkle";

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const distance = 28 + Math.random() * 48;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;

    particle.style.left = `${originX}px`;
    particle.style.top = `${originY}px`;
    particle.style.setProperty("--dx", `${dx.toFixed(1)}px`);
    particle.style.setProperty("--dy", `${dy.toFixed(1)}px`);
    particle.style.animationDelay = `${(Math.random() * 0.08).toFixed(3)}s`;

    portal.appendChild(particle);

    particle.addEventListener(
      "animationend",
      () => {
        particle.remove();
      },
      { once: true },
    );

    window.setTimeout(() => {
      particle.remove();
    }, 1000);
  }
}

function hideDream(star, reveal) {
  if (reveal) {
    reveal.classList.remove("is-visible");
    window.setTimeout(() => {
      if (!reveal.classList.contains("is-visible")) {
        reveal.hidden = true;
      }
    }, 700);
  }

  star.classList.remove("is-gone");
  star.disabled = false;
  star.removeAttribute("aria-hidden");
  star.tabIndex = 0;
  star._revealTimer = null;
}

function revealDream(star) {
  if (star.classList.contains("is-gone") || star.disabled) return;

  const portal = star.closest(".dream-portal");
  const key = star.getAttribute("data-reveal");
  if (!portal || !key) return;

  const reveal = portal.querySelector(`.dream-reveal[data-reveal="${key}"]`);

  const originX = star.offsetLeft + star.offsetWidth / 2;
  const originY = star.offsetTop + star.offsetHeight / 2;
  spawnSparkles(portal, originX, originY);

  star.classList.add("is-gone");
  star.disabled = true;
  star.setAttribute("aria-hidden", "true");
  star.tabIndex = -1;

  if (reveal) {
    reveal.hidden = false;
    void reveal.offsetWidth;
    reveal.classList.add("is-visible");
  }

  if (star._revealTimer) {
    window.clearTimeout(star._revealTimer);
  }

  star._revealTimer = window.setTimeout(() => {
    hideDream(star, reveal);
  }, REVEAL_DURATION_MS);
}

function setupStarReveals() {
  const field = document.querySelector(".dream-field");
  if (!field) return;

  markMissingImages(field);

  field.querySelectorAll(".star").forEach((star) => {
    star.addEventListener("click", (event) => {
      event.preventDefault();
      revealDream(star);
    });
  });
}

function initDreams() {
  if (!document.querySelector(".dreams-doorway")) return;
  setupDreamsMusic();
  setupStarReveals();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDreams);
} else {
  initDreams();
}
