// Full-screen button in the top-right controls (index.html #fullscreen_toggle), plus the F key.
// iPhones can't take a web page full screen (Safari only allows it for videos), so the button stays
// hidden where the browser doesn't support it; there the page fills the screen when it's added to the
// home screen instead (the apple-mobile-web-app-capable meta in index.html).

const root = document.documentElement;

const isSupported = () => Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;

const enter = () => (root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen?.());
const exit = () => (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen?.());

export const toggleFullscreen = () => {
  if (!isSupported()) return;
  Promise.resolve(fullscreenElement() ? exit() : enter()).catch(() => {}); // refused, e.g. no user gesture
};

export const setupFullscreen = () => {
  const button = document.getElementById("fullscreen_toggle");
  if (!isSupported()) return; // stays hidden (style.css)

  const update = () => {
    const on = Boolean(fullscreenElement());
    button.hidden = false;
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
    button.querySelector(".button-label").textContent = on ? "Exit Full Screen" : "Full Screen";
  };
  update();

  button.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", update);
  document.addEventListener("webkitfullscreenchange", update);
};
