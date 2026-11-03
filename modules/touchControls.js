import * as THREE from "three";
import { touchInput } from "./movement.js";
import { showMenu } from "./menu.js";
import { openPaintingAt } from "./clickHandling.js";

const STORAGE_KEY = "touchControls"; // remembers the manual on/off override from the menu
const LOOK_SPEED = 0.005; // radians the camera turns per pixel dragged
const DEAD_ZONE = 0.15; // joystick pushes smaller than this (0 to 1) are ignored
const ARROW_THRESHOLD = 0.35; // how far toward a direction the joystick must be pushed to light its arrow
const TAP_MAX_MOVE = 10; // pixels a finger can drift and still count as a tap
const TAP_MAX_TIME = 300; // milliseconds a finger can stay down and still count as a tap
const ROTATE_TOAST_TIME = 6000; // milliseconds the "turn your phone sideways" reminder stays up

const euler = new THREE.Euler(0, 0, 0, "YXZ"); // same rotation order PointerLockControls uses

let enabled = false;
let joystickPointerId = null;
let lookPointer = null;
let choseManually = false; // the visitor used the menu's TOUCH CONTROLS button during this visit

// Phone and tablet sized screens get the joystick, whatever the browser says about itself
const TOUCH_SIZED_SCREEN = window.matchMedia("(max-width: 1024px)");

// Phones and tablets report a coarse (finger) pointer; laptops with a touchscreen still report a fine one.
// Some browsers and device emulators (e.g. Safari's Responsive Design Mode) report a fine pointer even
// for a phone, so a phone or tablet user agent, a touch screen that can't hover, or a phone or tablet
// sized window counts too.
const isTouchDevice = () =>
  TOUCH_SIZED_SCREEN.matches ||
  window.matchMedia("(pointer: coarse)").matches ||
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 0 && window.matchMedia("(hover: none)").matches);

const readOverride = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const saveOverride = (on) => {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // storage blocked (private mode etc.), the choice just won't be remembered
  }
};

// Touch controls only react while the gallery is being explored, not while the menu is open
const isActive = () => enabled && document.body.classList.contains("exploring");

// Lights the joystick's forward/back/left/right arrows that match the current push
const highlightArrows = () => {
  const pushed = {
    forward: touchInput.forward > ARROW_THRESHOLD,
    back: touchInput.forward < -ARROW_THRESHOLD,
    left: touchInput.right < -ARROW_THRESHOLD,
    right: touchInput.right > ARROW_THRESHOLD,
  };
  document.querySelectorAll(".joystick-arrows path").forEach((arrow) => {
    arrow.classList.toggle("active", pushed[arrow.dataset.direction]);
  });
};

export const resetTouchInput = () => {
  joystickPointerId = null;
  lookPointer = null;
  touchInput.forward = 0;
  touchInput.right = 0;
  document.getElementById("joystick-knob").style.transform = "";
  highlightArrows();
};

const setTouchMode = (on) => {
  enabled = on;
  document.body.classList.toggle("touch-mode", on);
  document.getElementById("touch_toggle").innerText = `TOUCH CONTROLS: ${on ? "ON" : "OFF"}`;
  resetTouchInput();
};

// Joystick (bottom centre): walk forward/back and strafe, pushing further walks faster.
// Pointer events, so a finger, a pen or a mouse (e.g. a phone-sized desktop window) can all drive it.
const setupJoystick = () => {
  const base = document.getElementById("joystick");
  const knob = document.getElementById("joystick-knob");

  const moveKnob = (pointer) => {
    const rect = base.getBoundingClientRect();
    const maxDistance = rect.width / 2;
    let dx = pointer.clientX - (rect.left + maxDistance);
    let dy = pointer.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    if (distance > maxDistance) {
      // keep the knob inside the base
      dx *= maxDistance / distance;
      dy *= maxDistance / distance;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;

    const strength = Math.min(distance / maxDistance, 1);
    touchInput.right = strength < DEAD_ZONE ? 0 : dx / maxDistance;
    touchInput.forward = strength < DEAD_ZONE ? 0 : -dy / maxDistance; // screen y points down
    highlightArrows();
  };

  base.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (joystickPointerId !== null) return;
    joystickPointerId = event.pointerId;
    base.setPointerCapture(event.pointerId); // keeps the moves coming after the finger slides off the joystick
    moveKnob(event);
  });

  base.addEventListener("pointermove", (event) => {
    if (event.pointerId === joystickPointerId) moveKnob(event);
  });

  const release = (event) => {
    if (event.pointerId === joystickPointerId) {
      resetTouchInput();
    }
  };
  base.addEventListener("pointerup", release);
  base.addEventListener("pointercancel", release);
};

// Dragging anywhere on the scene looks around, a quick tap opens the painting under the finger
const setupLook = (canvas, camera, paintings) => {
  canvas.addEventListener("pointerdown", (event) => {
    if (!isActive() || lookPointer || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    lookPointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
    };
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!isActive() || event.pointerId !== lookPointer?.id) return;

    euler.setFromQuaternion(camera.quaternion);
    euler.y -= (event.clientX - lookPointer.x) * LOOK_SPEED;
    euler.x -= (event.clientY - lookPointer.y) * LOOK_SPEED;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x)); // don't flip over the top
    camera.quaternion.setFromEuler(euler);

    lookPointer.x = event.clientX;
    lookPointer.y = event.clientY;
  });

  canvas.addEventListener("pointerup", (event) => {
    if (event.pointerId !== lookPointer?.id) return;

    const moved = Math.hypot(event.clientX - lookPointer.startX, event.clientY - lookPointer.startY);
    const duration = performance.now() - lookPointer.startTime;
    if (isActive() && moved < TAP_MAX_MOVE && duration < TAP_MAX_TIME) {
      openPaintingAt(event.clientX, event.clientY, paintings);
    }
    lookPointer = null;
  });

  canvas.addEventListener("pointercancel", (event) => {
    if (event.pointerId === lookPointer?.id) lookPointer = null;
  });

  // Taps are handled above, so the click that follows must not reach clickHandling.js: it would open the
  // painting a second time, or open one at the end of a drag
  window.addEventListener(
    "click",
    (event) => {
      if (enabled && event.target === canvas) event.stopImmediatePropagation();
    },
    true
  );
};

export const setupTouchControls = (renderer, camera, paintings) => {
  setupJoystick();
  setupLook(renderer.domElement, camera, paintings);

  // Remind upright phones to turn sideways each time exploring starts; it hides itself after a while
  const rotateToast = document.getElementById("rotate-toast");
  let rotateToastTimer;
  const hideRotateToast = () => rotateToast.classList.remove("show");
  document.getElementById("play_button").addEventListener("click", () => {
    if (!enabled || !window.matchMedia("(orientation: portrait)").matches) return;
    rotateToast.classList.add("show");
    clearTimeout(rotateToastTimer);
    rotateToastTimer = setTimeout(hideRotateToast, ROTATE_TOAST_TIME);
  });
  document.getElementById("close-rotate-toast").addEventListener("click", hideRotateToast);

  document.getElementById("touch-menu-button").addEventListener("click", () => {
    resetTouchInput();
    showMenu();
  });

  document.getElementById("touch_toggle").addEventListener("click", () => {
    choseManually = true;
    setTouchMode(!enabled);
    saveOverride(enabled);
  });

  // Phones and tablets always start with the joystick: without a keyboard there's no other way to walk.
  // A remembered "on" still turns it on for desktops; turning it off on a phone lasts for this visit only.
  const detectTouchMode = () => setTouchMode(isTouchDevice() || readOverride() === "on");
  detectTouchMode();

  // Resizing a desktop window down to phone or tablet size (or back) switches the joystick on (or off),
  // unless the visitor already picked with the menu button
  TOUCH_SIZED_SCREEN.addEventListener("change", () => {
    if (!choseManually) detectTouchMode();
  });

  if (enabled) {
    // the controls help panel takes up too much of a small screen, start it collapsed
    document.getElementById("info-panel").classList.add("collapsed");
    document.getElementById("toggle-info").innerText = "Show";
  }
};
