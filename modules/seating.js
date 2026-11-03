import { seats } from './lounge.js';
import { barSeats } from './miniBar.js';
import { setSeated } from './playerView.js';
import { keysPressed, touchInput } from './movement.js';
import { FLOOR_Y, UNITS_PER_METER } from './paintingData.js';
import { SCREEN_CENTER } from './projector.js';

// Sit down on the sofa or an armchair and watch "Team Activities", or on a bar stool (barDrinks.js
// serves the drinks). Walk up to a seat and a "Sit" button appears (press E on a keyboard, or tap it).
// Sitting turns the view to the projector screen, or to the bar for a stool; press E again, tap
// "Stand up" or simply start walking to get up.

const SIT_DISTANCE = 4.5; // the button shows when a free seat is this close (scene units)
const STAND_DISTANCE = 2.6; // getting up puts the player this far in front of the seat, clear of the furniture
const STANDING_EYE_Y = 2; // the camera's normal height (scene.js)
const SEATED_EYE_Y = FLOOR_Y + 1.27 * UNITS_PER_METER; // seated eyes are about 1.27 m off the floor

let camera;
let seat = null; // the seat in use
let nearest = null; // the closest free seat within reach
let shown = ''; // what the button currently says, so the DOM only changes when it needs to

const button = () => document.getElementById('seat-button');
const isExploring = () => document.body.classList.contains('exploring');

const sit = (target) => {
  seat = target;
  camera.position.set(target.position.x, target.eyeY ?? SEATED_EYE_Y, target.position.z);
  // Look at what the seat is for: the middle of the screen, or a stool's own spot on the bar
  const look = target.lookAt ?? SCREEN_CENTER;
  const dx = look.x - camera.position.x;
  const dz = look.z - camera.position.z;
  const dy = look.y - camera.position.y;
  camera.rotation.set(Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(-dx, -dz), 0, 'YXZ');
  setSeated(target.facing + Math.PI); // the character model faces -z, the furniture faces +z
};

const stand = () => {
  const away = seat.standFacing ?? seat.facing; // sofas: forward off the seat; stools: back from the counter
  camera.position.set(
    seat.position.x + Math.sin(away) * STAND_DISTANCE,
    STANDING_EYE_Y,
    seat.position.z + Math.cos(away) * STAND_DISTANCE
  );
  seat = null;
  setSeated(null);
};

const toggle = () => {
  if (seat) stand();
  else if (nearest) sit(nearest);
};

const findNearest = () => {
  let best = null;
  let bestDistance = SIT_DISTANCE;
  [...seats, ...barSeats].forEach((candidate) => {
    const distance = Math.hypot(candidate.position.x - camera.position.x, candidate.position.z - camera.position.z);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  });
  return best;
};

const showButton = (state) => {
  if (state === shown) return;
  shown = state;
  const element = button();
  element.hidden = !state;
  if (state === 'sit') element.innerHTML = '🪑 Sit &amp; watch<span class="key-hint"> · E</span>';
  if (state === 'sit-bar') element.innerHTML = '🪑 Sit at the bar<span class="key-hint"> · E</span>';
  if (state === 'stand') element.innerHTML = 'Stand up<span class="key-hint"> · E</span>';
};

// Whether E means sit down / stand up right now (photoPrompt.js uses E for photos otherwise)
export const canSit = () => Boolean(seat || nearest);

// The seat in use, or null (barDrinks.js serves whoever sits at the bar)
export const currentSeat = () => seat;

export const setupSeating = (playerCamera) => {
  camera = playerCamera;
  button().addEventListener('click', toggle);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'e' && isExploring()) toggle();
  });
};

// Called every frame from the render loop, before movement
export const updateSeating = () => {
  if (!camera || !isExploring()) {
    showButton('');
    return;
  }
  if (seat && (Object.values(keysPressed).some(Boolean) || touchInput.forward || touchInput.right)) {
    stand(); // walking off gets you up
  }
  nearest = seat ? null : findNearest();
  showButton(seat ? 'stand' : nearest ? (nearest.kind === 'bar' ? 'sit-bar' : 'sit') : '');
};
