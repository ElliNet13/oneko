// ==UserScript==
// @name            Oneko
// @namespace       https://ellinet13.github.io
// @match           *://*/*
// @version         1.9
// @author          ElliNet13
// @description     cat follow mouse
// @downloadURL     https://ellinet13.github.io/oneko/oneko.js
// @updateURL       https://ellinet13.github.io/oneko/oneko.js
// @homepageURL		  https://ellinet13.github.io/oneko/
// @grant GM_info
// @noframes
// ==/UserScript==

// oneko.js: https://github.com/adryd325/oneko.js

(async function oneko() {
  function isUserscript() {
    return (
      typeof GM_info !== "undefined" ||
      typeof GM !== "undefined" ||
      typeof unsafeWindow !== "undefined"
    );
  }

  let isReducedMotion =
    window.matchMedia(`(prefers-reduced-motion: reduce)`) === true ||
    window.matchMedia(`(prefers-reduced-motion: reduce)`).matches === true;
  
  if (isUserscript()) isReducedMotion = false;

  if (isReducedMotion) return;

  if (typeof window.onekoInterval !== "undefined") return // Will only exist if oneko is already running, we do not want to run it twice

  if (document.documentElement.__onekoRunning__) return // Second check if oneko is already running that will work better in userscript

  document.documentElement.__onekoRunning__ = true

  const nekoEl = document.createElement("div");
  let nekoPosX = 32,
    nekoPosY = 32,
    mousePosX = 0,
    mousePosY = 0,
    // keep last-known client coordinates so we can recalc page coords on scroll
    lastMouseClientX = 0,
    lastMouseClientY = 0,
    frameCount = 0,
    idleTime = 0,
    idleAnimation = null,
    idleAnimationFrame = 0,
    forceSleep = false,
    grabbing = false,
    grabStop = true,
    nudge = false,
    kuroNeko = false,
    variant = "classic",
    // document bounds (page coordinates) where the neko is allowed to roam
    maxX = window.innerWidth - 16,
    maxY = window.innerHeight - 16;

  function parseLocalStorage(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(`oneko:${key}`));
      return typeof value === typeof fallback ? value : fallback;
    } catch (e) {
      console.error(e);
      return fallback;
    }
  }

  const nekoSpeed = 10,
    variants = [
      ["classic", "Classic"],
      ["dog", "Dog"],
      ["tora", "Tora"],
      ["maia", "Maia (maia.crimew.gay)"],
      ["vaporwave", "Vaporwave (nya.rest)"],
    ],
    spriteSets = {
      idle: [[-3, -3]],
      alert: [[-7, -3]],
      scratchSelf: [
        [-5, 0],
        [-6, 0],
        [-7, 0],
      ],
      scratchWallN: [
        [0, 0],
        [0, -1],
      ],
      scratchWallS: [
        [-7, -1],
        [-6, -2],
      ],
      scratchWallE: [
        [-2, -2],
        [-2, -3],
      ],
      scratchWallW: [
        [-4, 0],
        [-4, -1],
      ],
      tired: [[-3, -2]],
      sleeping: [
        [-2, 0],
        [-2, -1],
      ],
      N: [
        [-1, -2],
        [-1, -3],
      ],
      NE: [
        [0, -2],
        [0, -3],
      ],
      E: [
        [-3, 0],
        [-3, -1],
      ],
      SE: [
        [-5, -1],
        [-5, -2],
      ],
      S: [
        [-6, -3],
        [-7, -2],
      ],
      SW: [
        [-5, -3],
        [-6, -1],
      ],
      W: [
        [-4, -2],
        [-4, -3],
      ],
      NW: [
        [-1, 0],
        [-1, -1],
      ],
    }, // Get keys with 2 or more sprites
    keys = Object.keys(spriteSets).filter((key) => spriteSets[key].length > 1),
    usedKeys = new Set();

  function sleep() {
    forceSleep = !forceSleep;
    nudge = false;
    localStorage.setItem("oneko:forceSleep", forceSleep);
    if (!forceSleep) {
      resetIdleAnimation();
      return;
    }
  }

  function create() {
    variant = parseLocalStorage("variant", "classic");
    kuroNeko = parseLocalStorage("kuroneko", false);
    nekoPosX = parseLocalStorage("nekoPosX", 32);
    nekoPosY = parseLocalStorage("nekoPosY", 32);
    forceSleep = parseLocalStorage("forceSleep", false);

    if (!variants.some((v) => v[0] === variant)) {
      variant = "classic";
    }

    nekoEl.id = "oneko";
    nekoEl.style.width = "32px";
    nekoEl.style.height = "32px";
    // use absolute positioning so the cat is part of the document flow
    // and will move when the page scrolls
    nekoEl.style.position = "absolute";
    // nekoEl.style.pointerEvents = "none";
    nekoEl.style.backgroundImage = `url('https://raw.githubusercontent.com/ElliNet13/oneko/main/assets/oneko/oneko-${variant}.gif')`;
    nekoEl.style.imageRendering = "pixelated";
    nekoEl.style.left = `${nekoPosX - 16}px`;
    nekoEl.style.top = `${nekoPosY - 16}px`;
    nekoEl.style.filter = kuroNeko ? "invert(100%)" : "none";
    // Render Oneko below Spicetify's Popup Modal
    nekoEl.style.zIndex = "99";

    document.body.appendChild(nekoEl);

    mousePosX = nekoPosX;
    mousePosY = nekoPosY;

    window.addEventListener("mousemove", (e) => {
      if (forceSleep) return;

      // remember last client coordinates so we can recompute page coordinates later
      lastMouseClientX = e.clientX;
      lastMouseClientY = e.clientY;
      mousePosX = e.clientX + window.scrollX;
      mousePosY = e.clientY + window.scrollY;
    });

    // When the page scrolls the mouse pointer stays in the same viewport
    // position but its document coordinates change.  Update mousePos to the
    // new page coordinates so the cat will chase the cursor after scrolling.
    window.addEventListener("scroll", () => {
      mousePosX = lastMouseClientX + window.scrollX;
      mousePosY = lastMouseClientY + window.scrollY;
    });

    // track document size changes so the cat's roam area is updated
    function recalcBounds() {
      // scrollWidth/Height give the full size of the document
      maxX = Math.max(16, document.documentElement.scrollWidth - 16);
      maxY = Math.max(16, document.documentElement.scrollHeight - 16);
      // if the cat is now outside the permitted area, pull it back in
      if (nekoPosX > maxX) nekoPosX = maxX;
      if (nekoPosY > maxY) nekoPosY = maxY;
      nekoEl.style.left = `${nekoPosX - 16}px`;
      nekoEl.style.top = `${nekoPosY - 16}px`;
    }

    // compute initial bounds on creation
    recalcBounds();

    // update once DOM content is available
    document.addEventListener("DOMContentLoaded", recalcBounds);

    // also observe size changes (e.g. dynamic content)
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(recalcBounds);
      ro.observe(document.documentElement);
    } else {
      // fallback: use mutation observer as a catch-all
      const mo = new MutationObserver(recalcBounds);
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }

    window.addEventListener("resize", () => {
      if (forceSleep) {
        forceSleep = false;
        sleep();
      }
      recalcBounds();
    });

    // Handle dragging of the cat
    nekoEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      grabbing = true;
      // determine offset between pointer and cat in page coords
      const pageX0 = e.clientX + window.scrollX;
      const pageY0 = e.clientY + window.scrollY;
      dragOffsetX = nekoPosX - pageX0;
      dragOffsetY = nekoPosY - pageY0;
      let grabInterval;

      function movePointer(pageX, pageY) {
        nekoPosX = pageX + dragOffsetX;
        nekoPosY = pageY + dragOffsetY;
        nekoEl.style.left = `${nekoPosX - 16}px`;
        nekoEl.style.top = `${nekoPosY - 16}px`;
        localStorage.setItem("oneko:nekoPosX", nekoPosX);
        localStorage.setItem("oneko:nekoPosY", nekoPosY);
      }

      const onscrollDrag = () => {
        const pageX = lastMouseClientX + window.scrollX;
        const pageY = lastMouseClientY + window.scrollY;
        movePointer(pageX, pageY);
      };
      window.addEventListener("scroll", onscrollDrag, { passive: true });

      const mousemove = (e) => {
        const pageX = e.clientX + window.scrollX;
        const pageY = e.clientY + window.scrollY;
        const deltaX = pageX - pageX0;
        const deltaY = pageY - pageY0;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        // Scratch animation
        if (absDeltaX > absDeltaY && absDeltaX > 10) {
          setSprite(deltaX > 0 ? "scratchWallW" : "scratchWallE", frameCount);
        } else if (absDeltaY > absDeltaX && absDeltaY > 10) {
          setSprite(deltaY > 0 ? "scratchWallN" : "scratchWallS", frameCount);
        }

        if (
          grabStop ||
          absDeltaX > 10 ||
          absDeltaY > 10 ||
          Math.sqrt(deltaX ** 2 + deltaY ** 2) > 10
        ) {
          grabStop = false;
          clearTimeout(grabInterval);
          grabInterval = setTimeout(() => {
            grabStop = true;
            nudge = false;
          }, 150);
        }

        movePointer(pageX, pageY);
      };

      const mouseup = () => {
        grabbing = false;
        nudge = true;
        resetIdleAnimation();
        window.removeEventListener("mousemove", mousemove);
        window.removeEventListener("mouseup", mouseup);
        window.removeEventListener("scroll", onscrollDrag);
      };

      window.addEventListener("mousemove", mousemove);
      window.addEventListener("mouseup", mouseup);
    });

    nekoEl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      kuroNeko = !kuroNeko;
      localStorage.setItem("oneko:kuroneko", kuroNeko);
      nekoEl.style.filter = kuroNeko ? "invert(100%)" : "none";
    });

    nekoEl.addEventListener("dblclick", sleep);

    window.onekoInterval = setInterval(frame, 100);

    // Watch for when the neko element is removed from the DOM
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check if our element was removed
        if (mutation.type === "childList") {
          if (!document.body.contains(nekoEl)) {
            // Try to reattach it
            if (document.body) {
              document.body.appendChild(nekoEl);
            }
          }
        }
      }
    });

    // Observe the body for child changes
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: false });
    }

    // Also listen for body element replacement by observing the documentElement
    const rootObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          // Check if body was removed/replaced
          if (!document.body.contains(nekoEl) && document.body) {
            document.body.appendChild(nekoEl);
          }
        }
      }
    });

    rootObserver.observe(document.documentElement, { childList: true, subtree: false });
  }

  function getSprite(name, frame) {
    return spriteSets[name][frame % spriteSets[name].length];
  }

  function setSprite(name, frame) {
    const sprite = getSprite(name, frame);
    nekoEl.style.backgroundPosition = `${sprite[0] * 32}px ${sprite[1] * 32}px`;
  }

  function resetIdleAnimation() {
    idleAnimation = null;
    idleAnimationFrame = 0;
  }

  function idle() {
    idleTime += 1;

    // every ~ 20 seconds
    if (idleTime > 10 && Math.floor(Math.random() * 200) == 0 && idleAnimation == null) {
      let avalibleIdleAnimations = ["sleeping", "scratchSelf"];
      if (nekoPosX < 32) {
        avalibleIdleAnimations.push("scratchWallW");
      }
      if (nekoPosY < 32) {
        avalibleIdleAnimations.push("scratchWallN");
      }
      if (nekoPosX > window.innerWidth - 32) {
        avalibleIdleAnimations.push("scratchWallE");
      }
      if (nekoPosY > window.innerHeight - 32) {
        avalibleIdleAnimations.push("scratchWallS");
      }
      idleAnimation = avalibleIdleAnimations[Math.floor(Math.random() * avalibleIdleAnimations.length)];
    }

    if (forceSleep) {
      avalibleIdleAnimations = ["sleeping"];
      idleAnimation = "sleeping";
    }

    switch (idleAnimation) {
      case "sleeping":
        if (idleAnimationFrame < 8 && nudge && forceSleep) {
          setSprite("idle", 0);
          break;
        } else if (nudge) {
          nudge = false;
          resetIdleAnimation();
        }
        if (idleAnimationFrame < 8) {
          setSprite("tired", 0);
          break;
        }
        setSprite("sleeping", Math.floor(idleAnimationFrame / 4));
        if (idleAnimationFrame > 192 && !forceSleep) {
          resetIdleAnimation();
        }
        break;
      case "scratchWallN":
      case "scratchWallS":
      case "scratchWallE":
      case "scratchWallW":
      case "scratchSelf":
        setSprite(idleAnimation, idleAnimationFrame);
        if (idleAnimationFrame > 9) {
          resetIdleAnimation();
        }
        break;
      default:
        setSprite("idle", 0);
        return;
    }
    idleAnimationFrame += 1;
  }

  function frame() {
    frameCount += 1;

    // Check if the element was removed from the DOM, if so, recreate it
    if (!document.body.contains(nekoEl)) {
      if (document.body) {
        document.body.appendChild(nekoEl);
      } else {
        // Wait for body to exist
        return;
      }
    }

    // if the cat is completely outside the current viewport edges, push it back
    // onto the nearest edge so the user can see it
    function ensureVisible() {
      const left = window.scrollX + 16;
      const top = window.scrollY + 16;
      const right = window.scrollX + window.innerWidth - 16;
      const bottom = window.scrollY + window.innerHeight - 16;

      let moved = false;
      if (nekoPosX < left) {
        nekoPosX = left;
        moved = true;
      } else if (nekoPosX > right) {
        nekoPosX = right;
        moved = true;
      }
      if (nekoPosY < top) {
        nekoPosY = top;
        moved = true;
      } else if (nekoPosY > bottom) {
        nekoPosY = bottom;
        moved = true;
      }
      if (moved) {
        nekoEl.style.left = `${nekoPosX - 16}px`;
        nekoEl.style.top = `${nekoPosY - 16}px`;
      }
    }

    ensureVisible();

    if (grabbing) {
      grabStop && setSprite("alert", 0);
      return;
    }

    const diffX = nekoPosX - mousePosX;
    const diffY = nekoPosY - mousePosY;
    const distance = Math.sqrt(diffX ** 2 + diffY ** 2);

    // Cat has to sleep on top of the progress bar
    if (forceSleep && Math.abs(diffY) < nekoSpeed && Math.abs(diffX) < nekoSpeed) {
      // Make the cat sleep exactly on the top of the progress bar
      nekoPosX = mousePosX;
      nekoPosY = mousePosY;
      nekoEl.style.left = `${nekoPosX - 16}px`;
      nekoEl.style.top = `${nekoPosY - 16}px`;

      idle();
      return;
    }

    if ((distance < nekoSpeed || distance < 48) && !forceSleep) {
      idle();
      return;
    }

    idleAnimation = null;
    idleAnimationFrame = 0;

    if (idleTime > 1) {
      setSprite("alert", 0);
      // count down after being alerted before moving
      idleTime = Math.min(idleTime, 7);
      idleTime -= 1;
      return;
    }

    let direction = "";
    direction = diffY / distance > 0.5 ? "N" : "";
    direction += diffY / distance < -0.5 ? "S" : "";
    direction += diffX / distance > 0.5 ? "W" : "";
    direction += diffX / distance < -0.5 ? "E" : "";
    setSprite(direction, frameCount);

    nekoPosX -= (diffX / distance) * nekoSpeed;
    nekoPosY -= (diffY / distance) * nekoSpeed;

    // confine to the current document bounds (not just viewport)
    nekoPosX = Math.min(Math.max(16, nekoPosX), maxX);
    nekoPosY = Math.min(Math.max(16, nekoPosY), maxY);

    nekoEl.style.left = `${nekoPosX - 16}px`;
    nekoEl.style.top = `${nekoPosY - 16}px`;
    localStorage.setItem("oneko:nekoPosX", nekoPosX);
    localStorage.setItem("oneko:nekoPosY", nekoPosY);
  }

  create();

  function getRandomSprite() {
    let unusedKeys = keys.filter((key) => !usedKeys.has(key));
    if (unusedKeys.length === 0) {
      usedKeys.clear();
      unusedKeys = keys;
    }
    const index = Math.floor(Math.random() * unusedKeys.length);
    const key = unusedKeys[index];
    usedKeys.add(key);
    return [getSprite(key, 0), getSprite(key, 1)];
  }

  function setVariant(arr) {
    console.log(arr);

    variant = arr[0];
    localStorage.setItem("oneko:variant", `"${variant}"`);
    nekoEl.style.backgroundImage = `url('https://raw.githubusercontent.com/ElliNet13/oneko/main/assets/oneko/oneko-${variant}.gif')`;
  }

  // Popup modal to choose variant
  function pickerModal() {
    const container = document.createElement("div");
    container.className = "oneko-variant-container";

    const style = document.createElement("style");
    // Each variant is a 64x64 sprite
    style.innerHTML = `
      .oneko-variant-container {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
      }
      .oneko-variant-button {
        width: 64px;
        height: 64px;
        margin: 8px;
        cursor: pointer;
        background-size: 800%;
        border-radius: 25%;
        transition: background-color 0.2s ease-in-out;
        background-position: var(--idle-x) var(--idle-y);
        image-rendering: pixelated;
      }
      .oneko-variant-button:hover, .oneko-variant-button-selected {
        background-color: var(--spice-main-elevated);
      }
      .oneko-variant-button:hover {
        background-position: var(--active-x) var(--active-y);
      }
    `;
    container.appendChild(style);

    const [idle, active] = getRandomSprite();

    function variantButton(variantEnum) {
      const div = document.createElement("div");

      div.className = "oneko-variant-button";
      div.id = variantEnum[0];
      div.style.backgroundImage = `url('https://raw.githubusercontent.com/ElliNet13/oneko/main/assets/oneko/oneko-${variantEnum[0]}.gif')`;
      div.style.setProperty("--idle-x", `${idle[0] * 64}px`);
      div.style.setProperty("--idle-y", `${idle[1] * 64}px`);
      div.style.setProperty("--active-x", `${active[0] * 64}px`);
      div.style.setProperty("--active-y", `${active[1] * 64}px`);

      div.onclick = () => {
        setVariant(variantEnum);
        document.querySelector(".oneko-variant-button-selected")?.classList.remove("oneko-variant-button-selected");
        div.classList.add("oneko-variant-button-selected");
      };

      if (variantEnum[0] === variant) {
        div.classList.add("oneko-variant-button-selected");
      }

      // Use native tooltip via title attribute instead of Spicetify.Tippy
      div.title = variantEnum[1];

      return div;
    }

    for (const variant of variants) {
      container.appendChild(variantButton(variant));
    }

    return container;
  }

    // Simple popup modal replacement for Spicetify.PopupModal
    function showPopupModal(opts) {
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.left = "0";
      overlay.style.top = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.background = "rgba(0,0,0,0.4)";
      overlay.style.zIndex = "9999";

      const modal = document.createElement("div");
      modal.style.background = "white";
      modal.style.color = "black";
      modal.style.borderRadius = "8px";
      modal.style.padding = "12px";
      modal.style.minWidth = "320px";
      modal.style.maxWidth = "90%";
      modal.style.maxHeight = "80%";
      modal.style.overflow = "auto";

      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";

      const title = document.createElement("div");
      title.textContent = opts.title || "";
      title.style.fontWeight = "600";

      const close = document.createElement("button");
      close.textContent = "×";
      close.style.border = "none";
      close.style.background = "transparent";
      close.style.fontSize = "20px";
      close.style.cursor = "pointer";

      header.appendChild(title);
      header.appendChild(close);

      const body = document.createElement("div");
      if (opts.content) body.appendChild(opts.content);

      modal.appendChild(header);
      modal.appendChild(body);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      function cleanup() {
        window.removeEventListener("keydown", onKey);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }

      function onKey(e) {
        if (e.key === "Escape") cleanup();
      }

      close.addEventListener("click", cleanup);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) cleanup();
      });
      window.addEventListener("keydown", onKey);

      return { close: cleanup };
    }

    // Keyboard sequence listener: listens for the sequence "oneko"
    (function () {
      const seq = [];
      const target = "oneko";
      function onKeydown(e) {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;
        const k = e.key.length === 1 ? e.key.toLowerCase() : null;
        if (!k) return;
        seq.push(k);
        if (seq.length > target.length) seq.shift();
        if (seq.join("") === target) {
          showPopupModal({ title: "Choose your neko", content: pickerModal() });
        }
      }
      window.addEventListener("keydown", onKeydown);
    })();

  if (parseLocalStorage("forceSleep", false)) {
    while (!document.querySelector(".main-nowPlayingBar-center .playback-progressbar")) {
      await new Promise((r) => setTimeout(r, 100));
    }
    sleep();
  }
})();
