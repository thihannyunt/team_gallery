// Full-screen button in the top-right controls (index.html #fullscreen_toggle), plus the F key.
// iPhones can't take a web page full screen (Safari only allows it for videos), but the page fills the
// screen when it's opened from the home screen (the apple-mobile-web-app-capable meta in index.html),
// so there the button shows a tip explaining how. Opened from the home screen, the button hides.

const root = document.documentElement;
const TIP_TIME = 10000; // ms the iPhone tip stays up unless dismissed

const isSupported = () => Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
const isStandalone = () => navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;

const enter = () => (root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen?.());
const exit = () => (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen?.());

const tip = () => document.getElementById("fullscreen-tip");
let tipTimer;
const hideTip = () => tip().classList.remove("show");
const toggleTip = () => {
  clearTimeout(tipTimer);
  if (tip().classList.toggle("show")) {
    document.getElementById("rotate-toast").classList.remove("show"); // same spot on the screen
    tipTimer = setTimeout(hideTip, TIP_TIME);
  }
};

export const toggleFullscreen = () => {
  if (!isSupported()) return;
  Promise.resolve(fullscreenElement() ? exit() : enter()).catch(() => {}); // refused, e.g. no user gesture
};

export const setupFullscreen = () => {
  const button = document.getElementById("fullscreen_toggle");
  document.getElementById("close-fullscreen-tip").addEventListener("click", hideTip);
  if (isStandalone()) return; // already fills the screen, the button stays hidden (style.css)

  button.hidden = false;
  if (!isSupported()) {
    button.addEventListener("click", toggleTip);
    return;
  }

  const update = () => {
    const on = Boolean(fullscreenElement());
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
    button.querySelector(".button-label").textContent = on ? "Exit Full Screen" : "Full Screen";
  };
  update();

  button.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", update);
  document.addEventListener("webkitfullscreenchange", update);
};
