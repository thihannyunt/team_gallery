import * as THREE from "three";
import { touchInput } from "./movement.js";
import { showMenu } from "./menu.js";
import { openPaintingAt } from "./clickHandling.js";

const STORAGE_KEY = "touchControls"; // remembers the manual on/off override from the menu
const LOOK_SPEED = 0.005; // radians the camera turns per pixel dragged
const DEAD_ZONE = 0.15; // joystick pushes smaller than this (0 to 1) are ignored
const TAP_MAX_MOVE = 10; // pixels a finger can drift and still count as a tap
const TAP_MAX_TIME = 300; // milliseconds a finger can stay down and still count as a tap
const ROTATE_TOAST_TIME = 6000; // milliseconds the "turn your phone sideways" reminder stays up

const euler = new THREE.Euler(0, 0, 0, "YXZ"); // same rotation order PointerLockControls uses

let enabled = false;
let joystickTouchId = null;
let lookTouch = null;

// Phones and tablets report a coarse (finger) pointer; laptops with a touchscreen still report a fine one
const isTouchDevice = () => window.matchMedia("(pointer: coarse)").matches;

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

const findTouch = (touches, id) =>
  Array.from(touches).find((touch) => touch.identifier === id);

export const resetTouchInput = () => {
  joystickTouchId = null;
  lookTouch = null;
  touchInput.forward = 0;
  touchInput.right = 0;
  document.getElementById("joystick-knob").style.transform = "";
};

const setTouchMode = (on) => {
  enabled = on;
  document.body.classList.toggle("touch-mode", on);
  document.getElementById("touch_toggle").innerText = `TOUCH CONTROLS: ${on ? "ON" : "OFF"}`;
  resetTouchInput();
};

// Left joystick: walk forward/back and strafe, pushing further walks faster
const setupJoystick = () => {
  const base = document.getElementById("joystick");
  const knob = document.getElementById("joystick-knob");

  const moveKnob = (touch) => {
    const rect = base.getBoundingClientRect();
    const maxDistance = rect.width / 2;
    let dx = touch.clientX - (rect.left + maxDistance);
    let dy = touch.clientY - (rect.top + rect.height / 2);
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
  };

  base.addEventListener(
    "touchstart",
    (event) => {
      event.preventDefault();
      if (joystickTouchId !== null) return;
      const touch = event.changedTouches[0];
      joystickTouchId = touch.identifier;
      moveKnob(touch);
    },
    { passive: false }
  );

  // touchmove/touchend keep firing on the element the finger started on, even after it slides off
  base.addEventListener(
    "touchmove",
    (event) => {
      event.preventDefault();
      const touch = findTouch(event.changedTouches, joystickTouchId);
      if (touch) moveKnob(touch);
    },
    { passive: false }
  );

  const release = (event) => {
    if (findTouch(event.changedTouches, joystickTouchId)) {
      resetTouchInput();
    }
  };
  base.addEventListener("touchend", release);
  base.addEventListener("touchcancel", release);
};

// Dragging anywhere on the scene looks around, a quick tap opens the painting under the finger
const setupLook = (canvas, camera, paintings) => {
  canvas.addEventListener(
    "touchstart",
    (event) => {
      if (!isActive()) return;
      event.preventDefault(); // also stops the browser's synthetic click, taps are handled below
      if (lookTouch) return;
      const touch = event.changedTouches[0];
      lookTouch = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: performance.now(),
      };
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    (event) => {
      if (!isActive() || !lookTouch) return;
      event.preventDefault();
      const touch = findTouch(event.changedTouches, lookTouch.id);
      if (!touch) return;

      euler.setFromQuaternion(camera.quaternion);
      euler.y -= (touch.clientX - lookTouch.x) * LOOK_SPEED;
      euler.x -= (touch.clientY - lookTouch.y) * LOOK_SPEED;
      euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x)); // don't flip over the top
      camera.quaternion.setFromEuler(euler);

      lookTouch.x = touch.clientX;
      lookTouch.y = touch.clientY;
    },
    { passive: false }
  );

  canvas.addEventListener("touchend", (event) => {
    if (!lookTouch) return;
    const touch = findTouch(event.changedTouches, lookTouch.id);
    if (!touch) return;

    const moved = Math.hypot(touch.clientX - lookTouch.startX, touch.clientY - lookTouch.startY);
    const duration = performance.now() - lookTouch.startTime;
    if (isActive() && moved < TAP_MAX_MOVE && duration < TAP_MAX_TIME) {
      event.preventDefault(); // no follow-up click, it would land on the pop-up and close it straight away
      openPaintingAt(touch.clientX, touch.clientY, paintings);
    }
    lookTouch = null;
  });

  canvas.addEventListener("touchcancel", () => {
    lookTouch = null;
  });
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
    setTouchMode(!enabled);
    saveOverride(enabled);
  });

  const override = readOverride();
  setTouchMode(override ? override === "on" : isTouchDevice());

  if (enabled) {
    // the controls help panel takes up too much of a small screen, start it collapsed
    document.getElementById("info-panel").classList.add("collapsed");
    document.getElementById("toggle-info").innerText = "Show";
  }
};
