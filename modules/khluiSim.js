// The khlui (Thai bamboo flute) you can play from its showcase (instrumentPlay.js opens it).
// Hold a hole to sound its note, slide along the holes to glide between them, or use the keys
// A S D F G H J K (or 1-8). "Blow harder" jumps an octave up, as overblowing a real khlui does.
// The sound is made on the spot: a breathy sine tone with a little vibrato and the "chiff" of air
// at the start of each note. Thai music divides the octave into seven near-equal steps rather than
// the piano's mix of whole and half steps, so the notes follow that tuning.

const LOWEST = 392; // all holes closed, about G4
const NOTES = [
  { thai: 'โด', name: 'do' },
  { thai: 'เร', name: 're' },
  { thai: 'มี', name: 'mi' },
  { thai: 'ฟา', name: 'fa' },
  { thai: 'ซอล', name: 'sol' },
  { thai: 'ลา', name: 'la' },
  { thai: 'ที', name: 'ti' },
  { thai: 'โด', name: 'do' },
];
const KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];
const LEVEL = 0.22;
// A short phrase in the five-note mode much Thai folk music uses (do re mi sol la), as [note, beats]
const SAMPLE = [
  [4, 1], [5, 1], [7, 2], [5, 1], [4, 1], [2, 2], [4, 3],
  [1, 1], [2, 1], [4, 1], [2, 1], [1, 1], [0, 3],
];
const BEAT = 0.3; // seconds

const frequencyOf = (note, high) => LOWEST * 2 ** (note / 7) * (high ? 2 : 1);

let audio;
let voice = null; // { oscillators, gain, chiff, stop }
let held = []; // notes held down, the latest sounds
let high = false;
let sampleTimers = [];
const holes = [];

const noiseBuffer = (context) => {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
};

// One voice for the whole visit to the showcase: a flute plays one note at a time, gliding between them
const createVoice = () => {
  const now = audio.currentTime;
  const output = audio.createGain();
  output.gain.value = 0;
  // A small room: a soft echo off the gallery walls
  const echo = audio.createDelay();
  echo.delayTime.value = 0.16;
  const feedback = audio.createGain();
  feedback.gain.value = 0.28;
  const wet = audio.createGain();
  wet.gain.value = 0.22;
  output.connect(audio.destination);
  output.connect(echo).connect(feedback).connect(echo);
  echo.connect(wet).connect(audio.destination);

  // Fundamental and two soft overtones, all with the same vibrato
  const vibrato = audio.createOscillator();
  vibrato.frequency.value = 5.2;
  const depth = audio.createGain();
  depth.gain.value = 9; // cents
  vibrato.connect(depth);
  const oscillators = [1, 2, 3].map((harmonic, i) => {
    const oscillator = audio.createOscillator();
    oscillator.frequency.value = LOWEST * harmonic;
    const level = audio.createGain();
    level.gain.value = [1, 0.16, 0.05][i];
    depth.connect(oscillator.detune);
    oscillator.connect(level).connect(output);
    return { oscillator, harmonic };
  });

  // Breath: noise around the note's pitch, louder for a moment at each attack (the chiff)
  const noise = audio.createBufferSource();
  noise.buffer = noiseBuffer(audio);
  noise.loop = true;
  const band = audio.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.2;
  band.frequency.value = LOWEST * 2;
  const chiff = audio.createGain();
  chiff.gain.value = 0.07;
  noise.connect(band).connect(chiff).connect(output);

  [vibrato, noise, ...oscillators.map(({ oscillator }) => oscillator)].forEach((node) => node.start(now));
  return {
    oscillators,
    band,
    output,
    chiff,
    stop: () => {
      output.gain.setTargetAtTime(0, audio.currentTime, 0.03);
      setTimeout(() => {
        [vibrato, noise, ...oscillators.map(({ oscillator }) => oscillator)].forEach((node) => node.stop());
        output.disconnect();
        wet.disconnect();
      }, 600);
    },
  };
};

const sound = (note, attack) => {
  if (!voice) voice = createVoice();
  const now = audio.currentTime;
  const frequency = frequencyOf(note, high);
  voice.oscillators.forEach(({ oscillator, harmonic }) =>
    oscillator.frequency.setTargetAtTime(frequency * harmonic, now, attack ? 0.005 : 0.025)
  );
  voice.band.frequency.setTargetAtTime(frequency * 2, now, 0.02);
  voice.output.gain.cancelScheduledValues(now);
  voice.output.gain.setTargetAtTime(LEVEL * (high ? 0.8 : 1), now, attack ? 0.025 : 0.01);
  if (attack) {
    voice.chiff.gain.cancelScheduledValues(now);
    voice.chiff.gain.setValueAtTime(0.35, now);
    voice.chiff.gain.setTargetAtTime(0.07, now + 0.02, 0.04);
  }
};

const silence = () => {
  if (!voice) return;
  voice.output.gain.cancelScheduledValues(audio.currentTime);
  voice.output.gain.setTargetAtTime(0, audio.currentTime, 0.05);
};

const showHeld = () => holes.forEach((hole, i) => hole.classList.toggle('active', held.at(-1) === i));

const press = (note) => {
  held = held.filter((n) => n !== note);
  held.push(note);
  sound(note, held.length === 1); // a fresh breath, or slurred from the note already sounding
  showHeld();
};

const release = (note) => {
  const wasSounding = held.at(-1) === note;
  held = held.filter((n) => n !== note);
  if (held.length) {
    if (wasSounding) sound(held.at(-1), false);
  } else {
    silence();
  }
  showHeld();
};

const stopSample = () => {
  sampleTimers.forEach(clearTimeout);
  sampleTimers = [];
};

const playSample = () => {
  stopSample();
  held.forEach(release);
  let time = 0;
  SAMPLE.forEach(([note, beats]) => {
    sampleTimers.push(setTimeout(() => press(note), time * 1000));
    time += beats * BEAT;
    sampleTimers.push(setTimeout(() => release(note), time * 1000 - 40));
  });
};

const setHigh = (on) => {
  high = on;
  document.getElementById('khlui-high').setAttribute('aria-pressed', String(on));
  if (held.length) sound(held.at(-1), false);
};

// Fingers (and the mouse) pressing and sliding along the holes
const fingers = new Map(); // pointerId -> note
const holeAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('.khlui-hole');
const track = (event) => {
  const hole = holeAt(event.clientX, event.clientY);
  const note = hole ? Number(hole.dataset.note) : null;
  const before = fingers.get(event.pointerId);
  if (note === before) return;
  if (note !== null) press(note); // press the new hole before letting go of the old, so the note glides
  if (before !== undefined && before !== null) release(before);
  fingers.set(event.pointerId, note);
};
const lift = (event) => {
  const note = fingers.get(event.pointerId);
  if (note !== undefined && note !== null) release(note);
  fingers.delete(event.pointerId);
};

export const buildKhlui = () => {
  const body = document.getElementById('khlui-body');
  NOTES.forEach(({ thai, name }, i) => {
    const hole = document.createElement('button');
    hole.className = 'khlui-hole';
    hole.dataset.note = String(i);
    hole.setAttribute('aria-label', `${name} (${thai})`);
    hole.innerHTML = `<span class="khlui-dot"></span><b></b><small></small><span class="key-hint"></span>`;
    hole.querySelector('b').textContent = thai;
    hole.querySelector('small').textContent = name;
    hole.querySelector('.key-hint').textContent = KEYS[i].toUpperCase();
    body.append(hole);
    holes.push(hole);
  });
  body.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    body.setPointerCapture?.(event.pointerId); // keep getting moves while sliding off a hole
    stopSample();
    track(event);
  });
  body.addEventListener('pointermove', (event) => fingers.has(event.pointerId) && track(event));
  body.addEventListener('pointerup', lift);
  body.addEventListener('pointercancel', lift);
  document.getElementById('khlui-high').addEventListener('click', () => setHigh(!high));
  document.getElementById('khlui-sample').addEventListener('click', playSample);
};

export const openKhlui = (context) => {
  audio = context;
};

export const closeKhlui = () => {
  stopSample();
  held = [];
  fingers.clear();
  showHeld();
  voice?.stop();
  voice = null;
  setHigh(false);
};

// Keys while the khlui is open (instrumentPlay.js hands them over)
export const khluiKey = (event, down) => {
  const key = event.key.toLowerCase();
  const note = KEYS.indexOf(key) >= 0 ? KEYS.indexOf(key) : Number(key) - 1;
  if (event.key === 'Shift') setHigh(down);
  if (!(note >= 0 && note < NOTES.length) || event.repeat) return;
  stopSample();
  if (down) press(note);
  else release(note);
};
