import { setMusicDucked } from './music.js';

// The landing page plays a walk-through of the gallery (public/video/) behind the menu, with sound.
// Browsers only allow sound once the visitor has interacted with the page, so if it's blocked the
// video starts muted and unmutes on the first tap, click or key press. Entering the gallery pauses it;
// opening the menu again resumes it.

let video;
let active = false; // the menu is open, so the video should be playing

// Plays with sound when allowed, otherwise muted
const play = async () => {
  video.muted = false;
  try {
    await video.play();
  } catch {
    if (!active) return; // paused on purpose (the visitor entered the gallery) before it started
    video.muted = true;
    video.play().catch(() => {}); // even muted playback can be blocked, e.g. in battery saver mode
  }
};

export const playIntroVideo = () => {
  if (!video) return;
  active = true;
  setMusicDucked(true); // the gallery's jazz would clash with the video's soundtrack
  play();
};

export const pauseIntroVideo = () => {
  if (!video) return;
  active = false;
  setMusicDucked(false);
  video.pause();
};

export const setupIntroVideo = () => {
  video = document.getElementById('intro-video');

  // The first interaction with the page is what lets the browser play sound
  const unlockSound = () => {
    if (!active || !video.muted) return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return; // e.g. a touch that hasn't lifted yet
    play();
  };
  ['pointerdown', 'pointerup', 'keydown'].forEach((type) => document.addEventListener(type, unlockSound));
  // Playback starts once the loading screen is gone (main.js)
};
