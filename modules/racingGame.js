import { pixelText as text } from './shuttleRally.js';

// "Court Connect GP", the game on the racing simulator (racingSim.js shows it, racingPlay.js seats the
// driver). A pseudo-3D racer in the style of the 80s arcade racers: the road is a run of flat segments,
// each projected to a strip of the screen, and bends are faked by shifting each strip sideways. It is
// drawn on one wide canvas spread across the rig's three screens, so the road runs down the middle one
// and the side screens carry the verges, trees and the view into the bends.
// Three laps against five rival cars from the back of the grid; the best lap is kept in this browser.
// Steer with left/right, gas and brake; off the road the grass slows the car, and trees and signs stop it.

export const SCREEN = { width: 320, height: 180 }; // one of the three screens, in canvas pixels
export const VIEW = { width: SCREEN.width * 3, height: SCREEN.height }; // all three side by side
const W = VIEW.width;
const H = VIEW.height;
const HALF = W / 2;
const HORIZON = Math.round(H * 0.44);
const CENTER = { left: SCREEN.width, right: SCREEN.width * 2 }; // the middle screen's edges

// The road, in the game's own world units
const SEGMENT = 200; // length of one road segment
const RUMBLE = 3; // segments per rumble-strip stripe
const ROAD = 2000; // half the road's width
const LANES = 3;
const CAMERA_HEIGHT = 1000;
const DEPTH = 1 / Math.tan((110 / 2) * (Math.PI / 180)); // 110° across all three screens
const DRAW = 150; // segments drawn ahead
const PLAYER_Z = (DEPTH * CAMERA_HEIGHT * HALF) / (H - 8 - HORIZON); // the car sits just above the bottom edge
const CAR_WIDTH = 760;
const CAR_SPAN = CAR_WIDTH / ROAD; // in road half-widths, the unit of `offset`

// Driving
const MAX = SEGMENT * 60; // top speed, world units per second
const ACCEL = MAX / 5;
const BRAKE = -MAX;
const DECEL = -MAX / 5;
const OFF_ROAD_DECEL = -MAX / 2;
const OFF_ROAD_LIMIT = MAX / 4;
const CENTRIFUGAL = 0.3; // how hard a bend pushes the car outward
const TOP_KMH = 260; // what the speedometer reads at top speed
const GEARS = [0, 0.16, 0.32, 0.5, 0.7, 1.01]; // share of top speed where each gear ends
const LAPS = 3;
const COUNTDOWN = 3.4; // seconds of 3-2-1 before the lights go green
const BEST_KEY = 'courtConnectGpBest';

// Seeded random numbers, so the scenery is the same on every visit
let seed = 7;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const makeCanvas = (width, height, draw) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  return canvas;
};

// ---- Sprites, drawn once as small pixel-art canvases ----

const pine = makeCanvas(32, 56, (ctx) => {
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(14, 44, 4, 12);
  [
    [16, 0, 6, 16, '#1d5b33'],
    [16, 10, 10, 18, '#1f6637'],
    [16, 22, 14, 22, '#22703b'],
  ].forEach(([x, y, half, height, color]) => {
    ctx.fillStyle = color;
    for (let row = 0; row < height; row++) {
      const w = Math.round((half * (row + 1)) / height);
      ctx.fillRect(x - w, y + row, w * 2, 1);
    }
  });
  ctx.fillStyle = '#3d8f4f'; // light on the left
  for (let row = 4; row < 44; row += 3) ctx.fillRect(10 + (row % 4), row, 2, 1);
});

const palm = makeCanvas(44, 60, (ctx) => {
  ctx.fillStyle = '#7a5532';
  for (let y = 14; y < 60; y++) {
    const x = 22 + Math.round(Math.sin(y / 14) * 4);
    ctx.fillRect(x - 2, y, 4, 1);
    if (y % 4 === 0) {
      ctx.fillStyle = '#5c3f24';
      ctx.fillRect(x - 2, y, 4, 1);
      ctx.fillStyle = '#7a5532';
    }
  }
  ctx.fillStyle = '#2f8a3c';
  [
    [-1, 0.2],
    [1, 0.2],
    [-1, 0.75],
    [1, 0.75],
    [0, -0.3],
  ].forEach(([side, droop]) => {
    for (let i = 0; i < 18; i++) {
      const x = 24 + side * i;
      const y = 15 - (side === 0 ? i * 0.7 : 0) + droop * i * (i / 18) * 6 - (side === 0 ? 0 : 3);
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  });
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(21, 14, 4, 3);
});

const billboard = (lines) =>
  makeCanvas(96, 56, (ctx) => {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(14, 34, 4, 22);
    ctx.fillRect(78, 34, 4, 22);
    ctx.fillStyle = '#f4f2ea';
    ctx.fillRect(0, 0, 96, 38);
    ctx.fillStyle = '#024b4a';
    ctx.fillRect(2, 2, 92, 34);
    ctx.fillStyle = '#d0eb00';
    ctx.fillRect(2, 32, 92, 4);
    text(ctx, lines[0], 48, 6, '#d0eb00', 'center', 2);
    text(ctx, lines[1], 48, 19, '#f4f2ea', 'center', 2);
  });
const boards = [billboard(['COURT', 'CONNECT']), billboard(['SMASH', 'IT!']), billboard(['BOOK A', 'COURT']), billboard(['RALLY', 'BAR'])];

const shuttle = makeCanvas(28, 36, (ctx) => {
  ctx.fillStyle = '#f4f2ea'; // feathers, widening up
  for (let row = 0; row < 24; row++) {
    const w = 4 + Math.round(row * 0.42);
    ctx.fillRect(14 - w, 23 - row, w * 2, 1);
  }
  ctx.fillStyle = '#cfcbbf';
  for (let x = 4; x < 26; x += 4) ctx.fillRect(x, 2, 1, 20);
  ctx.fillStyle = '#d0eb00';
  ctx.fillRect(7, 16, 14, 2);
  ctx.fillStyle = '#e9e2cf'; // cork
  ctx.fillRect(9, 24, 10, 6);
  ctx.fillRect(10, 30, 8, 2);
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(13, 32, 2, 4);
});

const banner = makeCanvas(240, 72, (ctx) => {
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(4, 8, 6, 64);
  ctx.fillRect(230, 8, 6, 64);
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 4, 240, 26);
  for (let x = 0; x < 240; x += 6) {
    ctx.fillStyle = (x / 6) % 2 ? '#f4f2ea' : '#111';
    ctx.fillRect(x, 4, 6, 3);
    ctx.fillStyle = (x / 6) % 2 ? '#111' : '#f4f2ea';
    ctx.fillRect(x, 27, 6, 3);
  }
  text(ctx, 'COURT CONNECT GP', 120, 12, '#d0eb00', 'center', 2);
});

// Cars from behind: tyres, body, cabin, rear wing and lights. `lean` shifts the top when turning.
const car = (body, stripe, lean = 0) =>
  makeCanvas(64, 30, (ctx) => {
    ctx.fillStyle = '#111';
    ctx.fillRect(2, 18, 12, 12);
    ctx.fillRect(50, 18, 12, 12);
    ctx.fillStyle = '#333';
    ctx.fillRect(4, 20, 8, 2);
    ctx.fillRect(52, 20, 8, 2);
    ctx.fillStyle = body;
    ctx.fillRect(8, 14, 48, 12);
    ctx.fillRect(18 + lean, 7, 28, 8);
    ctx.fillStyle = '#1b2733'; // rear window
    ctx.fillRect(21 + lean, 9, 22, 5);
    ctx.fillStyle = stripe;
    ctx.fillRect(29 + lean, 7, 6, 2);
    ctx.fillRect(29, 14, 6, 12);
    ctx.fillStyle = '#e02b2b'; // lights
    ctx.fillRect(10, 17, 8, 3);
    ctx.fillRect(46, 17, 8, 3);
    ctx.fillStyle = '#222'; // wing and bumper
    ctx.fillRect(4 + lean, 2, 56, 4);
    ctx.fillRect(12 + lean, 5, 3, 3);
    ctx.fillRect(49 + lean, 5, 3, 3);
    ctx.fillRect(10, 25, 44, 2);
  });
const playerCars = { straight: car('#047a78', '#d0eb00'), left: car('#047a78', '#d0eb00', -3), right: car('#047a78', '#d0eb00', 3) };
const RIVALS = [
  { body: '#e8562a', stripe: '#f4f2ea', pace: 0.7 },
  { body: '#7a4fd6', stripe: '#f2c230', pace: 0.73 },
  { body: '#2a7de8', stripe: '#f4f2ea', pace: 0.76 },
  { body: '#f2c230', stripe: '#222', pace: 0.79 },
  { body: '#e83a6c', stripe: '#f4f2ea', pace: 0.82 },
].map((rival) => ({ ...rival, sprite: car(rival.body, rival.stripe) }));

// ---- Background: an evening sky, the sun, and two ranges of hills that slide round the bends ----

const sky = makeCanvas(1, H, (ctx) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, HORIZON + 10);
  gradient.addColorStop(0, '#1c3f6e');
  gradient.addColorStop(0.6, '#5f7fb0');
  gradient.addColorStop(1, '#f0b27a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1, H);
});
const range = (height, color, roughness, step) =>
  makeCanvas(W * 2, HORIZON + 30, (ctx, width, canvasHeight) => {
    ctx.fillStyle = color;
    for (let x = 0; x < width; x += step) {
      const t = (x / width) * Math.PI * 2;
      const y = height * (0.55 + 0.25 * Math.sin(t * 3) + 0.15 * Math.sin(t * 7 + 1) + roughness * Math.sin(t * 23 + 2));
      ctx.fillRect(x, canvasHeight - 30 - y, step, y + 30);
    }
  });
const farHills = range(46, '#6c6f9c', 0.06, 2);
const nearHills = range(26, '#2f6b4a', 0.12, 2);

// ---- The track ----

const segments = [];
const lastY = () => (segments.length ? segments[segments.length - 1].p2.world.y : 0);
const addSegment = (curve, y) => {
  const n = segments.length;
  segments.push({
    index: n,
    p1: { world: { y: lastY(), z: n * SEGMENT }, camera: {}, screen: {} },
    p2: { world: { y, z: (n + 1) * SEGMENT }, camera: {}, screen: {} },
    curve,
    sprites: [],
    cars: [],
    dark: Math.floor(n / RUMBLE) % 2 === 1,
    clip: H,
  });
};
const easeIn = (a, b, t) => a + (b - a) * t * t;
const easeInOut = (a, b, t) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);
// A stretch of road: easing into a bend (or a hill), holding it, easing out
const addRoad = (enter, hold, leave, curve, height) => {
  const startY = lastY();
  const endY = startY + height * SEGMENT;
  const total = enter + hold + leave;
  for (let i = 0; i < enter; i++) addSegment(easeIn(0, curve, i / enter), easeInOut(startY, endY, i / total));
  for (let i = 0; i < hold; i++) addSegment(curve, easeInOut(startY, endY, (enter + i) / total));
  for (let i = 0; i < leave; i++) addSegment(easeInOut(curve, 0, i / leave), easeInOut(startY, endY, (enter + hold + i) / total));
};

addRoad(30, 40, 30, 0, 0); // start straight
addRoad(30, 60, 30, 3, 20); // climbing right-hander
addRoad(40, 40, 40, 0, -20); // down the other side
addRoad(25, 45, 25, -4, 0); // left
addRoad(20, 25, 20, 4.5, 10); // esses
addRoad(20, 25, 20, -4.5, 10);
addRoad(40, 60, 40, 0, -25); // long fast drop
addRoad(30, 90, 30, -2.5, 15); // big left sweeper over a rise
addRoad(15, 20, 15, 6, 0); // tight right
addRoad(30, 30, 30, 0, -15);
addRoad(25, 50, 25, -5, 0); // last left
addRoad(40, 60, 40, 0, -lastY() / SEGMENT); // home straight, back down to the start line's height
const TRACK_LENGTH = segments.length * SEGMENT;

// The visitor's car starts on the grid a little behind the start/finish line and its gantry
const GRID_SEGMENT = Math.floor(PLAYER_Z / SEGMENT);
const LINE_SEGMENT = GRID_SEGMENT + 12;
const TO_LINE = LINE_SEGMENT * SEGMENT - PLAYER_Z; // from the grid to the line

const findSegment = (z) => segments[Math.floor(z / SEGMENT) % segments.length];
const wrap = (z) => ((z % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;

// Scenery: trees all along, signs every so often, the start gantry
const addSprite = (index, source, worldWidth, offset) => segments[index].sprites.push({ source, worldWidth, offset });
for (let n = 12; n < segments.length - 4; n += 6) {
  const side = random() < 0.5 ? -1 : 1;
  addSprite(n, random() < 0.6 ? pine : palm, 1100 + random() * 300, side * (1.5 + random() * 1.6));
  if (random() < 0.55) addSprite(n + 3, random() < 0.6 ? pine : palm, 1100 + random() * 300, -side * (1.6 + random() * 2));
}
for (let n = 40, i = 0; n < segments.length - 20; n += 95, i++) addSprite(n, boards[i % boards.length], 1900, i % 2 ? 1.25 : -1.25);
for (let n = 70; n < segments.length - 20; n += 140) addSprite(n, shuttle, 800, n % 280 < 140 ? -1.15 : 1.15);
addSprite(LINE_SEGMENT, banner, ROAD * 2.6, 0);

// ---- State ----

export const controlInput = { left: false, right: false, gas: false, brake: false };

let state = 'attract'; // 'attract', 'countdown', 'race' or 'finish'
let position = 0; // the camera's distance along the track
let playerX = 0; // across the road: -1 and 1 are its edges
let speed = 0;
let steer = 0; // -1 left .. 1 right, eased, for the 3D wheel and the car sprite
let skyOffset = 0;
let lap = 1;
let travelled = 0; // how far the visitor has driven this race, for laps and places
let nextLine = 0; // `travelled` at which the next lap is done
let clock = 0; // seconds since the lights went green
let lapStart = 0;
let lastLap = 0;
let countdown = 0;
let finish = null; // { place, time }
let gasWasDown = false;
let bump = 0; // seconds of shake after a knock
let lastKnock = 0;
let cars = [];

const readBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};
let best = readBest();
const saveBest = (time) => {
  if (best && time >= best) return;
  best = time;
  try {
    localStorage.setItem(BEST_KEY, String(time));
  } catch {
    // private mode: keep it for this visit only
  }
};

const placeCars = (racing) => {
  segments.forEach((segment) => (segment.cars.length = 0));
  cars = RIVALS.map((rival, i) => ({
    ...rival,
    z: racing ? wrap(PLAYER_Z + SEGMENT * (3 + i * 2)) : wrap(SEGMENT * (60 + i * 150)),
    offset: racing ? (i % 2 ? -0.45 : 0.45) : (i % 3) * 0.5 - 0.5,
    speed: 0,
  }));
  cars.forEach((rival) => (rival.travelled = rival.z - PLAYER_Z)); // their head start on the grid
  cars.forEach((rival) => findSegment(rival.z).cars.push(rival));
};
placeCars(false);
speed = MAX * 0.7;

// ---- Sound: an engine that climbs through the gears, beeps for the lights, a thump for knocks ----

let audio = null;
let engine = null;
const startEngine = () => {
  try {
    audio = audio ?? new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch {
    audio = null; // no Web Audio: the race just runs silently
    return;
  }
  if (engine) return;
  const gain = audio.createGain();
  gain.gain.value = 0;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  const low = audio.createOscillator();
  low.type = 'sawtooth';
  const high = audio.createOscillator();
  high.type = 'square';
  const highGain = audio.createGain();
  highGain.gain.value = 0.35;
  low.connect(filter);
  high.connect(highGain).connect(filter);
  filter.connect(gain).connect(audio.destination);
  low.start();
  high.start();
  gain.gain.setTargetAtTime(0.05, audio.currentTime, 0.2);
  engine = { gain, filter, low, high };
};
const stopEngine = () => {
  if (!engine || !audio) return;
  const { gain, low, high } = engine;
  gain.gain.setTargetAtTime(0, audio.currentTime, 0.08);
  low.stop(audio.currentTime + 0.5);
  high.stop(audio.currentTime + 0.5);
  engine = null;
};
const beep = (frequency, duration, volume = 0.12) => {
  if (!audio) return;
  const start = audio.currentTime;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
};
const knock = () => {
  bump = 0.35;
  if (!audio || clock - lastKnock < 0.4) return;
  lastKnock = clock;
  const length = Math.round(audio.sampleRate * 0.25);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  const gain = audio.createGain();
  gain.gain.value = 0.5;
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start();
};
const gearOf = (ratio) => Math.max(1, GEARS.findIndex((end) => ratio < end));
const updateEngine = () => {
  if (!engine || !audio) return;
  const ratio = speed / MAX;
  const gear = gearOf(ratio);
  const rpm = (ratio - GEARS[gear - 1]) / (GEARS[gear] - GEARS[gear - 1]);
  const frequency = 48 + rpm * 95 + gear * 9 + (state === 'countdown' && controlInput.gas ? 60 : 0);
  const now = audio.currentTime;
  engine.low.frequency.setTargetAtTime(frequency, now, 0.04);
  engine.high.frequency.setTargetAtTime(frequency * 2.01, now, 0.04);
  engine.filter.frequency.setTargetAtTime(500 + rpm * 900, now, 0.05);
  engine.gain.gain.setTargetAtTime(controlInput.gas ? 0.07 : 0.045, now, 0.1);
};

// ---- Races ----

export const isRaceOn = () => state !== 'attract';
export const steerAmount = () => steer;
// For tests and the seat: where the race stands
export const raceStatus = () => ({
  state,
  lap,
  place: finish ? finish.place : placeOf(),
  clock,
  speed: speed / MAX,
  playerX,
  curve: findSegment(position + PLAYER_Z).curve,
  lastLap,
  finish,
});

export const startRace = () => {
  state = 'countdown';
  countdown = COUNTDOWN;
  position = 0;
  playerX = -0.45;
  speed = 0;
  lap = 1;
  travelled = 0;
  nextLine = TO_LINE + TRACK_LENGTH; // crossing the line the first time is the start, not a lap
  clock = 0;
  lapStart = 0;
  lastLap = 0;
  finish = null;
  gasWasDown = true; // a gas held from before doesn't restart anything
  placeCars(true);
  startEngine();
};

export const endRace = () => {
  state = 'attract';
  Object.keys(controlInput).forEach((key) => (controlInput[key] = false));
  stopEngine();
  placeCars(false);
  speed = MAX * 0.7;
};

const overlap = (x1, w1, x2, w2) => Math.abs(x1 - x2) < (w1 + w2) / 2;
const placeOf = () => 1 + cars.filter((rival) => rival.travelled > travelled).length;

const moveCars = (delta, racing) => {
  const playerZ = wrap(position + PLAYER_Z);
  cars.forEach((rival) => {
    const before = findSegment(rival.z);
    const target = racing ? (state === 'countdown' ? 0 : MAX * rival.pace) : MAX * 0.62;
    rival.speed += Math.sign(target - rival.speed) * Math.min(Math.abs(target - rival.speed), (MAX / 4) * delta);
    rival.z = wrap(rival.z + rival.speed * delta);
    rival.travelled += rival.speed * delta;
    // Steer round the player's car when it's just ahead or alongside, otherwise drift back to a lane
    const gap = wrap(playerZ - rival.z);
    if (racing && gap < SEGMENT * 12 && overlap(rival.offset, CAR_SPAN * 1.4, playerX, CAR_SPAN * 1.4)) {
      const away = rival.offset > playerX ? 1 : -1;
      rival.offset += away * delta * 1.2 * (rival.offset * away > 0.8 ? -1 : 1);
    }
    rival.offset = Math.max(-0.85, Math.min(0.85, rival.offset));
    const after = findSegment(rival.z);
    if (after !== before) {
      before.cars.splice(before.cars.indexOf(rival), 1);
      after.cars.push(rival);
    }
  });
};

// Called every frame (seconds since the last one)
export const stepRace = (delta) => {
  const dt = Math.min(delta, 0.05);
  const racing = state !== 'attract';
  const before = position;
  const playerSegment = findSegment(position + PLAYER_Z);
  const ratio = speed / MAX;

  if (state === 'countdown') {
    const previous = Math.ceil(countdown);
    countdown -= dt;
    if (Math.ceil(countdown) !== previous && countdown > 0) beep(440, 0.18);
    if (countdown <= 0) {
      state = 'race';
      beep(880, 0.45);
    }
  } else if (racing) clock += dt;

  // Who's at the wheel: the visitor, or (in attract mode and after the flag) the autopilot
  let left = controlInput.left;
  let right = controlInput.right;
  let gas = controlInput.gas;
  let brake = controlInput.brake;
  if (state === 'attract' || state === 'finish') {
    const aim = -playerSegment.curve * 0.12;
    left = playerX > aim + 0.05;
    right = playerX < aim - 0.05;
    gas = state === 'attract' ? speed < MAX * 0.72 : false;
    brake = false;
  }
  if (state === 'countdown') gas = brake = false; // revving on the grid only makes noise

  const dx = dt * 2 * ratio;
  if (left) playerX -= dx;
  else if (right) playerX += dx;
  playerX -= dx * ratio * playerSegment.curve * CENTRIFUGAL;
  steer += ((left ? -1 : right ? 1 : 0) - steer) * Math.min(1, dt * 8);

  if (gas) speed += ACCEL * dt;
  else if (brake) speed += BRAKE * dt;
  else speed += DECEL * dt;
  const offRoad = playerX < -1 || playerX > 1;
  if (offRoad && speed > OFF_ROAD_LIMIT) speed += OFF_ROAD_DECEL * dt;

  // Knocks: scenery when off the road, cars anywhere
  if (offRoad) {
    playerSegment.sprites.forEach((sprite) => {
      const width = sprite.worldWidth / ROAD;
      const center = sprite.offset + (sprite.offset < 0 ? -width / 2 : width / 2);
      if (sprite.offset !== 0 && overlap(playerX, CAR_SPAN, center, width * 0.5)) {
        speed = MAX / 6;
        position = wrap(playerSegment.p1.world.z - PLAYER_Z);
        knock();
      }
    });
  }
  if (racing) {
    playerSegment.cars.forEach((rival) => {
      if (speed > rival.speed && overlap(playerX, CAR_SPAN, rival.offset, CAR_SPAN)) {
        speed = rival.speed * (rival.speed / speed) * 0.85;
        position = wrap(rival.z - PLAYER_Z - SEGMENT * 0.3);
        knock();
      }
    });
  }

  playerX = Math.max(-3, Math.min(3, playerX));
  speed = Math.max(0, Math.min(MAX, speed));
  position = wrap(position + dt * speed);
  skyOffset = (skyOffset + 0.001 * playerSegment.curve * ((dt * speed) / SEGMENT) + 1) % 1;
  bump = Math.max(0, bump - dt);
  moveCars(dt, racing);

  // Laps: how far the car really moved (knocks can push it back), then whether it crossed the line
  let moved = position - before;
  if (moved < -TRACK_LENGTH / 2) moved += TRACK_LENGTH;
  else if (moved > TRACK_LENGTH / 2) moved -= TRACK_LENGTH;
  if (state === 'race') travelled += moved;
  if (state === 'race' && travelled >= nextLine) {
    nextLine += TRACK_LENGTH;
    lastLap = clock - lapStart;
    lapStart = clock;
    saveBest(lastLap);
    lap += 1;
    if (lap > LAPS) {
      state = 'finish';
      lap = LAPS;
      finish = { place: placeOf(), time: clock };
      beep(660, 0.2);
      beep(990, 0.5, 0.08);
    }
  }

  // After the flag, gas starts the next race
  const gasDown = controlInput.gas;
  if (state === 'finish' && gasDown && !gasWasDown && clock - finish.time > 1) startRace();
  gasWasDown = gasDown;
  updateEngine();
};

// ---- Drawing ----

const polygon = (ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
};

const project = (point, cameraX, cameraY, cameraZ) => {
  point.camera.x = -cameraX;
  point.camera.y = point.world.y - cameraY;
  point.camera.z = point.world.z - cameraZ;
  const scale = DEPTH / point.camera.z;
  point.screen.scale = scale;
  point.screen.x = HALF + scale * point.camera.x * HALF;
  point.screen.y = HORIZON - scale * point.camera.y * HALF;
  point.screen.w = scale * ROAD * HALF;
};

const COLORS = {
  light: { road: '#76787a', grass: '#47a03f', rumble: '#f4f2ea', lane: '#f4f2ea' },
  dark: { road: '#6e7072', grass: '#3d9137', rumble: '#d0eb00', lane: null },
};
const FOG = '#c9b9a6';

const drawSegment = (ctx, segment, near, far, fog) => {
  const colors = segment.dark ? COLORS.dark : COLORS.light;
  // Whole pixels, overlapping the next strip by one, so no seams show between segments
  const p1 = { x: near.x, y: Math.ceil(near.y), w: near.w };
  const p2 = { x: far.x, y: Math.floor(far.y) - 0.5, w: far.w };
  const top = Math.floor(p2.y);
  const bottom = p1.y;
  ctx.fillStyle = colors.grass;
  ctx.fillRect(0, top, W, bottom - top);
  const r1 = p1.w / 6;
  const r2 = p2.w / 6;
  polygon(ctx, p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, colors.rumble);
  polygon(ctx, p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, colors.rumble);
  if (segment.index >= LINE_SEGMENT && segment.index < LINE_SEGMENT + 4) {
    // The chequered start line
    const columns = 10;
    for (let c = 0; c < columns; c++) {
      const a = c / columns;
      const b = (c + 1) / columns;
      const color = (c + segment.index) % 2 ? '#f4f2ea' : '#1a1a1a';
      polygon(ctx, p1.x - p1.w + 2 * p1.w * a, p1.y, p1.x - p1.w + 2 * p1.w * b, p1.y, p2.x - p2.w + 2 * p2.w * b, p2.y, p2.x - p2.w + 2 * p2.w * a, p2.y, color);
    }
  } else {
    polygon(ctx, p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, colors.road);
    if (colors.lane) {
      const l1 = p1.w / 32;
      const l2 = p2.w / 32;
      for (let lane = 1; lane < LANES; lane++) {
        const x1 = p1.x - p1.w + (2 * p1.w * lane) / LANES;
        const x2 = p2.x - p2.w + (2 * p2.w * lane) / LANES;
        polygon(ctx, x1 - l1, p1.y, x1 + l1, p1.y, x2 + l2, p2.y, x2 - l2, p2.y, colors.lane);
      }
    }
  }
  if (fog > 0.02) {
    ctx.globalAlpha = fog;
    ctx.fillStyle = FOG;
    ctx.fillRect(0, top, W, bottom - top);
    ctx.globalAlpha = 1;
  }
};

const drawSprite = (ctx, source, worldWidth, scale, x, y, alignX, clipY) => {
  const width = worldWidth * scale * HALF;
  const height = (width * source.height) / source.width;
  const left = x + width * alignX;
  const top = y - height;
  const hidden = Math.max(0, y - clipY); // the part behind a crest nearer the camera
  if (hidden >= height || width < 1) return;
  const shown = 1 - hidden / height;
  ctx.drawImage(source, 0, 0, source.width, source.height * shown, Math.round(left), Math.round(top), Math.round(width), Math.round(height * shown));
};

const drawBackground = (ctx, playerY) => {
  ctx.drawImage(sky, 0, 0, W, H);
  ctx.fillStyle = '#ffd59a'; // the sun, low over the hills
  const sunX = Math.round(((0.62 - skyOffset * 2 + 4) % 2) * W - W * 0.5);
  ctx.beginPath();
  ctx.arc(sunX, HORIZON - 34, 16, 0, Math.PI * 2);
  ctx.fill();
  [
    [farHills, 1, 0.02],
    [nearHills, 2, 0.04],
  ].forEach(([layer, speed, rise]) => {
    const left = -(((skyOffset * speed) % 1) * layer.width);
    const y = HORIZON + 30 - layer.height + Math.min(10, playerY * rise * 0.01);
    ctx.drawImage(layer, Math.round(left), Math.round(y));
    ctx.drawImage(layer, Math.round(left + layer.width), Math.round(y));
  });
};

const time = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
};

const panel = (ctx, x, y, width, height) => {
  ctx.fillStyle = 'rgba(2, 30, 30, 0.62)';
  ctx.fillRect(x, y, width, height);
};

const drawHud = (ctx, blink) => {
  const lime = '#d0eb00';
  const cream = '#f4f2ea';
  if (state === 'attract') {
    panel(ctx, CENTER.left + 40, 18, 240, 50);
    text(ctx, 'COURT CONNECT GP', HALF, 26, lime, 'center', 3);
    if (blink) text(ctx, 'TAKE A SEAT TO RACE', HALF, 50, cream, 'center', 2);
    if (best) {
      panel(ctx, CENTER.right + 12, 10, 110, 30);
      text(ctx, 'BEST LAP', CENTER.right + 18, 15, lime, 'left', 1);
      text(ctx, time(best), CENTER.right + 18, 24, cream, 'left', 2);
    }
    return;
  }

  // Middle screen: lap and race clock along the top, speed and gear bottom right
  panel(ctx, CENTER.left + 6, 6, 308, 20);
  text(ctx, `LAP ${lap}/${LAPS}`, CENTER.left + 12, 11, cream, 'left', 2);
  text(ctx, time(finish ? finish.time : clock), CENTER.right - 12, 11, lime, 'right', 2);
  const kmh = Math.round((speed / MAX) * TOP_KMH);
  panel(ctx, CENTER.right - 86, H - 30, 80, 24);
  text(ctx, String(kmh), CENTER.right - 40, H - 25, cream, 'right', 3);
  text(ctx, 'KMH', CENTER.right - 36, H - 25, lime, 'left', 1);
  text(ctx, `G${gearOf(speed / MAX)}`, CENTER.right - 36, H - 16, cream, 'left', 1);

  // Left screen, next to the driver: lap times. Right screen: place in the race.
  panel(ctx, CENTER.left - 112, 6, 106, 44);
  text(ctx, 'LAST LAP', CENTER.left - 106, 11, lime, 'left', 1);
  text(ctx, lastLap ? time(lastLap) : '-:--.-', CENTER.left - 106, 19, cream, 'left', 2);
  text(ctx, 'BEST LAP', CENTER.left - 106, 32, lime, 'left', 1);
  text(ctx, best ? time(best) : '-:--.-', CENTER.left - 106, 40, cream, 'left', 1);
  panel(ctx, CENTER.right + 6, 6, 74, 44);
  text(ctx, 'POS', CENTER.right + 12, 11, lime, 'left', 1);
  text(ctx, `${finish ? finish.place : placeOf()}/${RIVALS.length + 1}`, CENTER.right + 12, 20, cream, 'left', 4);

  if (state === 'countdown') {
    const n = Math.ceil(countdown);
    // Start lights: red, red, red, then all green
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#111';
      ctx.fillRect(HALF - 45 + i * 32, 34, 26, 26);
      ctx.fillStyle = 3 - i >= n && n <= 3 ? '#ff3b30' : '#3a1a1a';
      ctx.beginPath();
      ctx.arc(HALF - 32 + i * 32, 47, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    if (n <= 3) text(ctx, String(n), HALF, 68, cream, 'center', 4);
  } else if (state === 'race' && clock < 1.2) {
    text(ctx, 'GO!', HALF, 40, lime, 'center', 6);
  } else if (state === 'finish') {
    panel(ctx, CENTER.left + 40, 34, 240, 66);
    text(ctx, finish.place === 1 ? 'YOU WIN!' : 'FINISH', HALF, 40, lime, 'center', 4);
    text(ctx, `P${finish.place}  ${time(finish.time)}`, HALF, 66, cream, 'center', 2);
    if (blink && clock - finish.time > 1) text(ctx, 'GAS TO RACE AGAIN', HALF, 84, cream, 'center', 1);
  }
};

export const drawRace = (ctx, now) => {
  ctx.imageSmoothingEnabled = false;
  const baseSegment = findSegment(position);
  const basePercent = (position % SEGMENT) / SEGMENT;
  const playerSegment = findSegment(position + PLAYER_Z);
  const playerPercent = ((position + PLAYER_Z) % SEGMENT) / SEGMENT;
  const playerY = playerSegment.p1.world.y + (playerSegment.p2.world.y - playerSegment.p1.world.y) * playerPercent;
  const shake = bump > 0 ? Math.round(Math.sin(now * 60) * 2) : 0;

  drawBackground(ctx, playerY);

  let maxY = H;
  let x = 0;
  let dx = -(baseSegment.curve * basePercent);
  for (let n = 0; n < DRAW; n++) {
    const segment = segments[(baseSegment.index + n) % segments.length];
    const looped = segment.index < baseSegment.index;
    const cameraZ = position - (looped ? TRACK_LENGTH : 0);
    segment.clip = maxY;
    project(segment.p1, playerX * ROAD - x, playerY + CAMERA_HEIGHT, cameraZ);
    project(segment.p2, playerX * ROAD - x - dx, playerY + CAMERA_HEIGHT, cameraZ);
    x += dx;
    dx += segment.curve;
    const p1 = segment.p1.screen;
    const p2 = segment.p2.screen;
    if (segment.p1.camera.z <= DEPTH || p2.y >= p1.y || p2.y >= maxY) continue;
    drawSegment(ctx, segment, p1, p2, Math.min(0.85, (n / DRAW) ** 2 * 1.6));
    maxY = p2.y;
  }

  // Scenery and cars, far to near so the near ones cover the far
  for (let n = DRAW - 1; n > 0; n--) {
    const segment = segments[(baseSegment.index + n) % segments.length];
    const p1 = segment.p1.screen;
    const p2 = segment.p2.screen;
    if (!(segment.p1.camera.z > DEPTH)) continue;
    segment.cars.forEach((rival) => {
      const percent = (rival.z % SEGMENT) / SEGMENT;
      const scale = p1.scale + (p2.scale - p1.scale) * percent;
      const carX = p1.x + (p2.x - p1.x) * percent + scale * rival.offset * ROAD * HALF;
      const carY = p1.y + (p2.y - p1.y) * percent;
      drawSprite(ctx, rival.sprite, CAR_WIDTH, scale, carX, carY, -0.5, segment.clip);
    });
    segment.sprites.forEach((sprite) => {
      const alignX = sprite.offset === 0 ? -0.5 : sprite.offset < 0 ? -1 : 0;
      drawSprite(ctx, sprite.source, sprite.worldWidth, p1.scale, p1.x + p1.scale * sprite.offset * ROAD * HALF, p1.y, alignX, segment.clip);
    });
  }

  // The visitor's car, sitting on the road just above the bottom edge
  const p1 = playerSegment.p1.screen;
  const p2 = playerSegment.p2.screen;
  const roadY = p1.y + (p2.y - p1.y) * playerPercent;
  const offRoad = Math.abs(playerX) > 1 && speed > 0;
  const bounce = offRoad ? Math.round(Math.random() * 2) : speed > 0 && Math.floor(now * 20) % 2 ? 1 : 0;
  const sprite = steer < -0.3 ? playerCars.left : steer > 0.3 ? playerCars.right : playerCars.straight;
  drawSprite(ctx, sprite, CAR_WIDTH, DEPTH / PLAYER_Z, HALF + shake, Math.min(H - 2, Math.max(roadY, H - 30)) - bounce, -0.5, H);

  drawHud(ctx, Math.floor(now * 2.5) % 2 === 0);

  // Thin dark gaps where the screens' bezels meet, so the picture lines up with the glass
  ctx.fillStyle = '#000';
  ctx.fillRect(CENTER.left - 1, 0, 2, H);
  ctx.fillRect(CENTER.right - 1, 0, 2, H);
};
