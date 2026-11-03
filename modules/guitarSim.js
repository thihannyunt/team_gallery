// The electric guitar on the music-corner wall, played through its amp (instrumentPlay.js opens it).
// Pick a chord, then swipe across the strings to strum (down or up), tap one string to pluck it, or
// use the Strum buttons. Keys: 1-8 pick a chord, Space or ↓ strums down, ↑ strums up, O toggles the
// amp's overdrive.
// Each string is a Karplus-Strong pluck (a burst of noise fed round a short delay line, which rings at
// the string's pitch and dies away like a real string), computed once per note and cached.

const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]; // E A D G B E as MIDI notes, low to high
const NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
// Frets per string, low E first; null for a string left unplayed
const CHORDS = [
  { name: 'G', frets: [3, 2, 0, 0, 0, 3] },
  { name: 'C', frets: [null, 3, 2, 0, 1, 0] },
  { name: 'D', frets: [null, null, 0, 2, 3, 2] },
  { name: 'Em', frets: [0, 2, 2, 0, 0, 0] },
  { name: 'Am', frets: [null, 0, 2, 2, 1, 0] },
  { name: 'F', frets: [1, 3, 3, 2, 1, 1] },
  { name: 'A', frets: [null, 0, 2, 2, 2, 0] },
  { name: 'E', frets: [0, 2, 2, 1, 0, 0] },
];
const STRUM_GAP = 0.014; // seconds between strings in a strum
const RING_TIME = 3; // seconds a plucked string rings

let audio;
let amp = null; // { input, drive, setDrive, stop }
let chord = CHORDS[0];
let overdrive = false;
const cache = new Map(); // frequency -> AudioBuffer
const ringing = []; // per string: { source, gain }
let lines = [];

const frequencyOf = (midi) => 440 * 2 ** ((midi - 69) / 12);

const pluckBuffer = (frequency) => {
  if (cache.has(frequency)) return cache.get(frequency);
  const rate = audio.sampleRate;
  const buffer = audio.createBuffer(1, Math.round(rate * RING_TIME), rate);
  const data = buffer.getChannelData(0);
  const period = Math.round(rate / frequency);
  const decay = 0.99996; // per sample, on top of the averaging, which already damps high notes faster
  let last = 0;
  for (let i = 0; i < period; i++) {
    last = last * 0.4 + (Math.random() * 2 - 1) * 0.6; // a slightly soft pick
    data[i] = last;
  }
  for (let i = period; i < data.length; i++) {
    data[i] = 0.5 * (data[i - period] + data[Math.max(i - period - 1, 0)]) * decay;
  }
  const fade = Math.round(rate * 0.4); // die away smoothly at the end of the buffer, no click
  for (let i = 0; i < fade; i++) data[data.length - 1 - i] *= i / fade;
  cache.set(frequency, buffer);
  return buffer;
};

// Soft clipping curve for the amp; more drive squares the waves off more
const driveCurve = (amount) => {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
};

// The combo amp: drive, then a speaker cabinet (a low-pass and a mid bump), then a little room
const createAmp = () => {
  const input = audio.createGain();
  const shaper = audio.createWaveShaper();
  shaper.oversample = '2x';
  const cabinet = audio.createBiquadFilter();
  cabinet.type = 'lowpass';
  cabinet.frequency.value = 4200;
  const body = audio.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 800;
  body.gain.value = 4;
  const output = audio.createGain();
  const echo = audio.createDelay();
  echo.delayTime.value = 0.12;
  const feedback = audio.createGain();
  feedback.gain.value = 0.22;
  const wet = audio.createGain();
  wet.gain.value = 0.18;
  input.connect(shaper).connect(cabinet).connect(body).connect(output).connect(audio.destination);
  output.connect(echo).connect(feedback).connect(echo);
  echo.connect(wet).connect(audio.destination);
  const setDrive = (on) => {
    shaper.curve = driveCurve(on ? 9 : 1.2);
    input.gain.value = on ? 0.9 : 0.75;
    output.gain.value = on ? 0.32 : 0.6;
  };
  setDrive(overdrive);
  return {
    input,
    setDrive,
    stop: () => {
      output.gain.setTargetAtTime(0, audio.currentTime, 0.05);
      setTimeout(() => {
        output.disconnect();
        wet.disconnect();
      }, 500);
    },
  };
};

const pluck = (string, delay = 0, velocity = 1) => {
  const fret = chord.frets[string];
  if (fret === null) return;
  if (!amp) amp = createAmp();
  const start = audio.currentTime + delay;
  // A new note on a string stops the one it was ringing
  const previous = ringing[string];
  if (previous) {
    previous.gain.gain.setTargetAtTime(0, start, 0.01);
    previous.source.stop(start + 0.1);
  }
  const source = audio.createBufferSource();
  source.buffer = pluckBuffer(frequencyOf(OPEN_STRINGS[string] + fret));
  const gain = audio.createGain();
  gain.gain.value = 0.55 * velocity;
  source.connect(gain).connect(amp.input);
  source.start(start);
  ringing[string] = { source, gain };
  setTimeout(() => {
    const line = lines[string];
    line.classList.remove('ring');
    void line.offsetWidth; // restart the vibration animation
    line.classList.add('ring');
  }, delay * 1000);
};

const strum = (down) => {
  const order = down ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];
  let delay = 0;
  order.forEach((string) => {
    if (chord.frets[string] === null) return;
    pluck(string, delay, down ? 1 : 0.85);
    delay += STRUM_GAP;
  });
};

const chooseChord = (index) => {
  chord = CHORDS[index];
  document.querySelectorAll('.guitar-chord').forEach((chip, i) => chip.setAttribute('aria-pressed', String(i === index)));
  lines.forEach((line, i) => line.classList.toggle('muted', chord.frets[i] === null));
};

const setOverdrive = (on) => {
  overdrive = on;
  amp?.setDrive(on);
  const button = document.getElementById('guitar-drive');
  button.setAttribute('aria-pressed', String(on));
  button.firstChild.textContent = on ? '🔥 Overdrive on' : '🔥 Overdrive off';
};

// Swiping across the strings: every string the finger crosses is played, in the order it's crossed
const strokes = new Map(); // pointerId -> last y
const stringYs = () => lines.map((line) => {
  const box = line.getBoundingClientRect();
  return box.top + box.height / 2;
});
const startStroke = (event) => {
  event.preventDefault();
  event.currentTarget.setPointerCapture?.(event.pointerId);
  // A tap right on a string plucks it
  const ys = stringYs();
  const gap = (ys[ys.length - 1] - ys[0]) / (ys.length - 1);
  const nearest = ys.reduce((best, y, i) => (Math.abs(y - event.clientY) < Math.abs(ys[best] - event.clientY) ? i : best), 0);
  if (Math.abs(ys[nearest] - event.clientY) < gap * 0.3) pluck(nearest);
  strokes.set(event.pointerId, event.clientY);
};
const moveStroke = (event) => {
  if (!strokes.has(event.pointerId)) return;
  const from = strokes.get(event.pointerId);
  const to = event.clientY;
  const crossed = stringYs()
    .map((y, string) => ({ y, string }))
    .filter(({ y }) => (y - from) * (y - to) < 0)
    .sort((a, b) => (to > from ? a.y - b.y : b.y - a.y));
  crossed.forEach(({ string }, i) => pluck(string, i * 0.006));
  strokes.set(event.pointerId, to);
};
const endStroke = (event) => strokes.delete(event.pointerId);

export const buildGuitar = () => {
  const chips = document.getElementById('guitar-chords');
  CHORDS.forEach(({ name }, i) => {
    const chip = document.createElement('button');
    chip.className = 'guitar-chord';
    chip.innerHTML = `<b></b><span class="key-hint"> ${i + 1}</span>`;
    chip.querySelector('b').textContent = name;
    chip.addEventListener('click', () => chooseChord(i));
    chips.append(chip);
  });
  const neck = document.getElementById('guitar-strings');
  lines = NAMES.map((name, i) => {
    const line = document.createElement('div');
    line.className = 'guitar-string';
    line.style.setProperty('--thickness', `${3.4 - i * 0.45}px`);
    line.dataset.name = name;
    neck.append(line);
    return line;
  });
  neck.addEventListener('pointerdown', startStroke);
  neck.addEventListener('pointermove', moveStroke);
  neck.addEventListener('pointerup', endStroke);
  neck.addEventListener('pointercancel', endStroke);
  document.getElementById('guitar-down').addEventListener('click', () => strum(true));
  document.getElementById('guitar-up').addEventListener('click', () => strum(false));
  document.getElementById('guitar-drive').addEventListener('click', () => setOverdrive(!overdrive));
  chooseChord(0);
};

export const openGuitar = (context) => {
  audio = context;
};

export const closeGuitar = () => {
  strokes.clear();
  ringing.length = 0;
  amp?.stop();
  amp = null;
};

// Keys while the guitar is open (instrumentPlay.js hands them over)
export const guitarKey = (event, down) => {
  if (!down || event.repeat) return;
  const index = Number(event.key) - 1;
  if (index >= 0 && index < CHORDS.length) chooseChord(index);
  if (event.key === ' ' || event.key === 'ArrowDown') strum(true);
  if (event.key === 'ArrowUp') strum(false);
  if (event.key === 'o' || event.key === 'O') setOverdrive(!overdrive);
};
