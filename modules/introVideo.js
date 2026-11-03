import { setMusicDucked } from './music.js';

// The landing page plays a walk-through of the gallery (public/video/) behind the menu, with sound.
// Browsers only allow sound once the visitor has interacted with the page, so if it's blocked the
// video starts muted and unmutes on the first tap, click or key press, unless the visitor turned the
// sound off with the button. Entering the gallery pauses it; opening the menu again resumes it.

let video;
let soundButton;
let active = false; // the menu is open, so the video should be playing
let wantsSound = true;

const updateSoundButton = () => {
  const on = !video.muted;
  soundButton.textContent = on ? '🔊 SOUND ON' : '🔇 TAP FOR SOUND';
  soundButton.setAttribute('aria-pressed', String(on));
};

// Plays with sound when wanted and allowed, otherwise muted
const play = async () => {
  video.muted = !wantsSound;
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
  soundButton = document.getElementById('intro-sound');
  video.addEventListener('volumechange', updateSoundButton);
  updateSoundButton();

  soundButton.addEventListener('click', () => {
    wantsSound = video.muted;
    play();
  });

  // The first interaction with the page is what lets the browser play sound
  const unlockSound = (event) => {
    if (!active || !wantsSound || !video.muted || soundButton.contains(event.target)) return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return; // e.g. a touch that hasn't lifted yet
    play();
  };
  ['pointerdown', 'pointerup', 'keydown'].forEach((type) => document.addEventListener(type, unlockSound));
  // Playback starts once the loading screen is gone (main.js)
};
