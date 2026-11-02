// Original chill-jazz loop, generated live with the Web Audio API: electric piano chords, a walking
// upright bass, brushed drums and a sparse vibraphone melody, through a soft room reverb.
// Composed for this gallery in code, so there's no audio file to download and no copyright to clear.
//
// createJazz(context) returns { output, start, stop }: connect `output` wherever the music should go
// (music.js feeds it to the room speakers).

const BPM = 74;
const SWING = 0.64; // the off-beat eighth lands this far through the beat (0.5 would be straight)
const LOOKAHEAD = 0.15; // seconds of music scheduled ahead of the clock
const TICK = 25; // milliseconds between scheduler runs

// Eight bars, one chord each: ii–V–I–vi, then ii–V–iii–VI back to the top (in C).
// `bass` is the root in MIDI, `voicing` the electric piano notes, `third` the bass line's third.
const PROGRESSION = [
  { bass: 38, third: 3, voicing: [53, 57, 60, 64] }, // Dm9
  { bass: 43, third: 4, voicing: [53, 59, 64, 69] }, // G13
  { bass: 36, third: 4, voicing: [52, 55, 59, 62] }, // Cmaj9
  { bass: 45, third: 3, voicing: [55, 60, 64, 71] }, // Am9
  { bass: 38, third: 3, voicing: [53, 57, 60, 64] }, // Dm9
  { bass: 43, third: 4, voicing: [53, 59, 64, 69] }, // G13
  { bass: 40, third: 3, voicing: [50, 55, 59, 62] }, // Em7
  { bass: 45, third: 4, voicing: [55, 61, 64, 70] }, // A7(b9)
];
// Melody notes the vibraphone picks from (C major / D dorian, upper register)
const MELODY_NOTES = [69, 71, 72, 74, 76, 77, 79, 81];

const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

export const createJazz = (context) => {
  const beat = 60 / BPM;
  const output = context.createGain();

  // Soft room reverb from a decaying noise impulse
  const reverb = context.createConvolver();
  const length = Math.round(context.sampleRate * 2.4);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  reverb.buffer = impulse;
  const wet = context.createGain();
  wet.gain.value = 0.32;
  reverb.connect(wet).connect(output);

  const bus = (gain, cutoff) => {
    const node = context.createGain();
    node.gain.value = gain;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    node.connect(filter);
    filter.connect(output);
    filter.connect(reverb);
    return node;
  };
  const pianoBus = bus(0.22, 2600);
  const bassBus = bus(0.5, 900);
  const drumBus = bus(0.5, 9000);
  const vibesBus = bus(0.14, 3200);

  // Gentle tremolo on the electric piano
  const tremolo = context.createOscillator();
  const tremoloDepth = context.createGain();
  tremolo.frequency.value = 4.2;
  tremoloDepth.gain.value = 0.05;
  tremolo.connect(tremoloDepth).connect(pianoBus.gain);
  tremolo.start();

  const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const noiseData = noise.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;

  const envelope = (gain, time, peak, attack, decay) => {
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  };

  // Electric piano: a sine with a quick FM "bark" on the attack
  const piano = (midi, time, velocity) => {
    const carrier = context.createOscillator();
    const modulator = context.createOscillator();
    const modulation = context.createGain();
    const amp = context.createGain();
    const f = frequency(midi);
    carrier.frequency.value = f;
    modulator.frequency.value = f;
    modulation.gain.setValueAtTime(f * 1.2, time);
    modulation.gain.exponentialRampToValueAtTime(f * 0.05, time + 0.4);
    modulator.connect(modulation).connect(carrier.frequency);
    carrier.connect(amp).connect(pianoBus);
    envelope(amp, time, velocity, 0.006, 2.6);
    [carrier, modulator].forEach((osc) => {
      osc.start(time);
      osc.stop(time + 2.7);
    });
  };

  // Upright bass: round sine plus a little triangle for the pluck
  const bass = (midi, time) => {
    const amp = context.createGain();
    envelope(amp, time, 0.9, 0.012, beat * 0.95);
    ['sine', 'triangle'].forEach((type, i) => {
      const osc = context.createOscillator();
      const level = context.createGain();
      osc.type = type;
      osc.frequency.value = frequency(midi);
      level.gain.value = i ? 0.35 : 1;
      osc.connect(level).connect(amp);
      osc.start(time);
      osc.stop(time + beat * 1.1);
    });
    amp.connect(bassBus);
  };

  // Vibraphone: pure sine with a slow shimmer
  const vibes = (midi, time) => {
    const osc = context.createOscillator();
    const amp = context.createGain();
    const shimmer = context.createOscillator();
    const shimmerDepth = context.createGain();
    osc.frequency.value = frequency(midi);
    shimmer.frequency.value = 5.5;
    shimmerDepth.gain.value = 0.25;
    shimmer.connect(shimmerDepth).connect(amp.gain);
    osc.connect(amp).connect(vibesBus);
    envelope(amp, time, 0.8, 0.004, 1.6);
    [osc, shimmer].forEach((node) => {
      node.start(time);
      node.stop(time + 1.7);
    });
  };

  const noiseHit = (time, type, cutoff, peak, attack, decay) => {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const amp = context.createGain();
    source.buffer = noise;
    filter.type = type;
    filter.frequency.value = cutoff;
    source.connect(filter).connect(amp).connect(drumBus);
    envelope(amp, time, peak, attack, decay);
    source.start(time, Math.random() * 0.5);
    source.stop(time + attack + decay + 0.05);
  };

  const kick = (time) => {
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.frequency.setValueAtTime(110, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    osc.connect(amp).connect(drumBus);
    envelope(amp, time, 0.55, 0.004, 0.3);
    osc.start(time);
    osc.stop(time + 0.35);
  };
  const brush = (time) => noiseHit(time, 'bandpass', 2400, 0.16, 0.025, 0.25);
  const ride = (time, accent) => noiseHit(time, 'highpass', 7500, accent ? 0.07 : 0.04, 0.002, 0.12);

  // Time of an eighth-note step inside a bar, with swing on the off-beats
  const stepTime = (barStart, step) => barStart + Math.floor(step / 2) * beat + (step % 2 ? SWING * beat : 0);

  const scheduleBar = (bar, barStart) => {
    const chord = PROGRESSION[bar % PROGRESSION.length];
    const next = PROGRESSION[(bar + 1) % PROGRESSION.length];

    // Piano: chord on the downbeat, a softer push on the "and" of 2
    chord.voicing.forEach((note, i) => piano(note, barStart + i * 0.012, 0.5));
    chord.voicing.forEach((note) => piano(note, stepTime(barStart, 3), 0.28));

    // Walking bass: root, third, fifth, then a half step into the next chord
    const approach = next.bass + (next.bass > chord.bass ? -1 : 1);
    [chord.bass, chord.bass + chord.third, chord.bass + 7, approach].forEach((note, i) =>
      bass(note, barStart + i * beat)
    );

    // Drums: ride pattern "ding, ding-a, ding, ding-a", brushes on 2 and 4, a soft kick
    [0, 2, 3, 4, 6, 7].forEach((step) => ride(stepTime(barStart, step), step % 2 === 0));
    [2, 6].forEach((step) => brush(stepTime(barStart, step)));
    kick(barStart);
    if (Math.random() < 0.4) kick(stepTime(barStart, 5));

    // Sparse vibraphone melody, a little different every time round
    for (let step = 0; step < 8; step++) {
      if (Math.random() < (bar % 2 ? 0.22 : 0.32)) {
        vibes(MELODY_NOTES[Math.floor(Math.random() * MELODY_NOTES.length)], stepTime(barStart, step));
      }
    }
  };

  let timer = null;
  let bar = 0;
  let nextBarTime = 0;

  const start = () => {
    if (timer) return;
    bar = 0;
    nextBarTime = context.currentTime + 0.1;
    const run = () => {
      while (nextBarTime < context.currentTime + LOOKAHEAD) {
        scheduleBar(bar, nextBarTime);
        bar += 1;
        nextBarTime += 4 * beat;
      }
    };
    run();
    timer = setInterval(run, TICK);
  };

  // Notes already scheduled ring out; music.js fades the output for a clean stop
  const stop = () => {
    clearInterval(timer);
    timer = null;
  };

  return { output, start, stop };
};
