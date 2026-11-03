import { keysPressed } from "./movement.js"; // import the keysPressed object
import { showMenu, hideMenu } from "./menu.js"; // import the showMenu function
import { startAudio, stopAudio } from "./music.js";
import { toggleFullscreen } from "./fullscreen.js";

let lockPointer = true;
let showMenuOnUnlock = false;

// add the controls parameter which is the pointer lock controls and is passed from main.js where setupEventListeners is called
export const setupEventListeners = (controls, camera, scene) => {
  // add the event listeners to the document which is the whole page
  document.addEventListener(
    "keydown",
    (event) => onKeyDown(event, controls),
    false
  );
  document.addEventListener(
    "keyup",
    (event) => onKeyUp(event, controls),
    false
  );

  controls.addEventListener("unlock", () => {
    if (showMenuOnUnlock) {
      showMenu();
    }
    showMenuOnUnlock = false;
  });

  // One button toggles the music
  document.getElementById("music_toggle").addEventListener("click", () => {
    if (document.getElementById("music_toggle").getAttribute("aria-pressed") === "true") stopAudio();
    else startAudio();
  });
};

// toggle the pointer lock
function togglePointerLock(controls) {
  if (lockPointer) {
    controls.lock();
  } else {
    showMenuOnUnlock = false;
    controls.unlock();
  }
  lockPointer = !lockPointer; // toggle the lockPointer variable
}

function onKeyDown(event, controls) {
  // no shortcuts until the loading screen is gone, Enter would otherwise walk into a half-built gallery
  if (document.body.classList.contains("loading")) return;

  // event is the event object that has the key property
  if (event.key in keysPressed) {
    // check if the key pressed by the user is in the keysPressed object
    keysPressed[event.key] = true; // if yes, set the value of the key pressed to true
  }

  if (event.key === "Escape") {
    // if the "ESC" key is pressed
    showMenu(); // show the menu
    showMenuOnUnlock = true;
    controls.unlock(); // unlock the pointer
    lockPointer = false;
  }

  if (event.key === "p") {
    // if the "SPACE" key is pressed
    controls.unlock(); // unlock the pointer
    lockPointer = false;
  }

  // if key prssed is enter or return for mac
  if (event.key === "Enter" || event.key === "Return") {
    // if the "ENTER" key is pressed
    hideMenu(); // hide the menu
    controls.lock(); // lock the pointer
    lockPointer = true;
  }

  if (event.key === " ") {
    // if the "p" key is pressed
    togglePointerLock(controls); // toggle the pointer lock
  }

  if (event.key === "g") {
    // if the "a" key is pressed
    startAudio(); // play the music
  }

  if (event.key === "p") {
    // if the "s" key is pressed
    stopAudio(); // stop the music
  }

  if (event.key === "m") {
    // if the "h" key is pressed
    showMenu(); // show the menu
    showMenuOnUnlock = true;
    controls.unlock(); // unlock the pointer
    lockPointer = false;
  }

  if (event.key === "f") {
    toggleFullscreen();
  }

  if (event.key === "r") {
    // if the "r" key is pressed
    location.reload(); // reload the page
  }
}

function onKeyUp(event, controls) {
  // same but for keyup
  if (event.key in keysPressed) {
    keysPressed[event.key] = false; // set to false when the key is released
  }
}

const toggleInfoPanel = () => {
  const collapsed = document.getElementById("info-panel").classList.toggle("collapsed");
  document.getElementById("toggle-info").innerText = collapsed ? "Show" : "Hide";
  document.getElementById("help_button").setAttribute("aria-expanded", String(!collapsed));
};

document.getElementById("toggle-info").addEventListener("click", toggleInfoPanel);
document.getElementById("help_button").addEventListener("click", toggleInfoPanel); // the "!" button on phones

document.getElementById("about_button").addEventListener("click", function () {
  document.getElementById("about-overlay").classList.add("show");
});

document.getElementById("close-about").addEventListener("click", function () {
  document.getElementById("about-overlay").classList.remove("show");
});
