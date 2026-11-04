// The grand piano's voice (pianoPlay.js plays it). Each note is computed once and cached: a sum of the
// string's overtones, slightly stretched the way stiff piano strings are, each fading on two slopes
// (the quick fall after the hammer, then the long ring), with two strings a hair apart for the gentle
// beating of a real unison and a soft thump of the hammer at the start. Notes ring through a small hall.
// Releasing a key damps it, unless the sustain pedal is down.

const MAX_PARTIALS = 14;
const DAMP_TIME = 0.09; // seconds for a damper to stop a string

const frequencyOf = (midi) => 440 * 2 ** ((midi - 69) / 12);

const synthesize = (context, midi) => {
  const rate = context.sampleRate;
  const f0 = frequencyOf(midi);
  const duration = Math.min(7, Math.max(1.6, 7 - (midi - 21) * 0.075)); // low notes ring longest
  const length = Math.round(duration * rate);
  const buffer = context.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  const stiffness = 0.00012 * 2 ** ((midi - 60) / 24);
  const ring = 2 ** (-(midi - 60) / 28);

  for (let n = 1; n <= MAX_PARTIALS; n++) {
    const frequency = n * f0 * Math.sqrt(1 + stiffness * n * n);
    if (frequency > Math.min(9000, rate / 2.3)) break;
    const amplitude = Math.exp(-(n - 1) * 0.32) / n ** 0.6;
    const fast = Math.exp(-1 / (0.32 * ring * rate / n ** 0.4));
    const slow = Math.exp(-1 / (2.8 * ring * rate / n ** 0.7));
    // The low partials get a second string, 1-2 cents sharp
    (n <= 6 ? [1, 1.0009] : [1]).forEach((detune) => {
      const step = (2 * Math.PI * frequency * detune) / rate;
      const cos = Math.cos(step);
      const sin = Math.sin(step);
      let x = 0; // a rotating phasor: no sin() per sample
      let y = 1;
      let e1 = 0.6 * amplitude;
      let e2 = 0.4 * amplitude;
      for (let i = 0; i < length; i++) {
        data[i] += x * (e1 + e2);
        const nx = x * cos + y * sin;
        y = y * cos - x * sin;
        x = nx;
        e1 *= fast;
        e2 *= slow;
      }
    });
  }

  // The hammer: a short, soft thump of filtered noise
  let low = 0;
  const thump = Math.round(0.025 * rate);
  for (let i = 0; i < thump; i++) {
    low += ((Math.random() * 2 - 1) - low) * 0.12;
    data[i] += low * 0.5 * (1 - i / thump);
  }

  // Level: a quick attack, a smooth fade at the end, and treble a little quieter than bass
  let peak = 0;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const gain = (0.32 - (midi - 60) * 0.0015) / (peak || 1);
  const attack = Math.round(0.003 * rate);
  const fade = Math.round(0.3 * rate);
  for (let i = 0; i < length; i++) {
    let g = gain;
    if (i < attack) g *= i / attack;
    if (i > length - fade) g *= (length - i) / fade;
    data[i] *= g;
  }
  return buffer;
};

// A hall made of decaying noise, wider in stereo
const hallImpulse = (context) => {
  const rate = context.sampleRate;
  const length = Math.round(1.8 * rate);
  const impulse = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return impulse;
};

export const createPianoSound = (context) => {
  const cache = new Map(); // MIDI note -> AudioBuffer
  const voices = new Map(); // MIDI note -> { source, gain }
  const held = new Set();
  let sustain = false;

  const output = context.createDynamicsCompressor(); // big chords stay clean
  output.threshold.value = -12;
  output.ratio.value = 4;
  output.connect(context.destination);
  const dry = context.createGain();
  dry.gain.value = 0.85;
  const hall = context.createConvolver();
  hall.buffer = hallImpulse(context);
  const wet = context.createGain();
  wet.gain.value = 0.28;
  dry.connect(output);
  dry.connect(hall).connect(wet).connect(output);

  const bufferFor = (midi) => {
    if (!cache.has(midi)) cache.set(midi, synthesize(context, midi));
    return cache.get(midi);
  };

  const damp = (midi, time = context.currentTime) => {
    const voice = voices.get(midi);
    if (!voice) return;
    voice.gain.gain.cancelScheduledValues(time);
    voice.gain.gain.setTargetAtTime(0, time, DAMP_TIME / 3);
    voice.source.stop(time + DAMP_TIME * 4);
    voices.delete(midi);
  };

  let warming = [];
  return {
    // Work out notes ahead of time, a few at a time, so the first press of each doesn't stutter
    warm: (notes) => {
      warming = notes.filter((midi) => !cache.has(midi));
      const next = () => {
        const midi = warming.shift();
        if (midi === undefined) return;
        bufferFor(midi);
        setTimeout(next, 15);
      };
      setTimeout(next, 30);
    },
    noteOn: (midi, velocity = 0.8, when = 0) => {
      const time = context.currentTime + when;
      damp(midi, time); // striking a ringing string stops it first
      const source = context.createBufferSource();
      source.buffer = bufferFor(midi);
      const gain = context.createGain();
      gain.gain.value = 0.35 + 0.65 * velocity;
      source.connect(gain).connect(dry);
      source.start(time);
      voices.set(midi, { source, gain });
      held.add(midi);
    },
    noteOff: (midi, when = 0) => {
      held.delete(midi);
      if (!sustain) damp(midi, context.currentTime + when);
    },
    setSustain: (on) => {
      sustain = on;
      if (!on) [...voices.keys()].filter((midi) => !held.has(midi)).forEach((midi) => damp(midi));
    },
    stop: () => {
      warming = [];
      held.clear();
      sustain = false;
      [...voices.keys()].forEach((midi) => damp(midi));
    },
  };
};
