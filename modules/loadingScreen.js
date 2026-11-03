import * as THREE from 'three';

// On a first visit the textures, photos and 3D models take a while to download, so a loading screen
// covers the page until they're ready. Every TextureLoader and GLTFLoader in the gallery reports to
// three.js's DefaultLoadingManager, which gives us the progress. Returning visitors have most of it
// cached, so the screen only flashes by.

const STATUS_MESSAGES = [
  [0, 'Hanging the team portraits…'],
  [30, 'Polishing the court floor…'],
  [60, 'Switching on the lights…'],
  [90, 'Opening the doors…'],
];

const MIN_VISIBLE_MS = 600; // long enough that a cached load fades out instead of blinking

export const setupLoadingScreen = (onReady) => {
  const screen = document.getElementById('loading-screen');
  const bar = document.getElementById('loading-bar');
  const percentText = document.getElementById('loading-percent');
  const statusText = document.getElementById('loading-status');
  const manager = THREE.DefaultLoadingManager;
  const shownAt = performance.now();
  let shownPercent = 0;

  // A 3D model only reveals its own textures once it's downloaded, so the total grows while loading.
  // Only ever move the bar forward so it doesn't jump back.
  const showProgress = (percent) => {
    shownPercent = Math.max(shownPercent, Math.min(100, Math.round(percent)));
    bar.style.transform = `scaleX(${shownPercent / 100})`;
    percentText.textContent = `${shownPercent}%`;
    statusText.textContent = STATUS_MESSAGES.findLast(([from]) => shownPercent >= from)[1];
  };
  showProgress(0);

  const assetsLoaded = new Promise((resolve) => {
    manager.onProgress = (url, loaded, total) => showProgress((loaded / total) * 100);
    manager.onLoad = resolve; // also called after errors, a missing texture shouldn't block the gallery
  });

  Promise.all([assetsLoaded, document.fonts?.ready]).then(() => {
    // Later loads, like the full-size photos fetched when walking up to a painting, don't need the screen
    manager.onProgress = undefined;
    manager.onLoad = undefined;
    showProgress(100);

    setTimeout(() => {
      document.body.classList.remove('loading');
      screen.addEventListener('transitionend', () => screen.remove(), { once: true });
      onReady();
    }, Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt)));
  });
};
