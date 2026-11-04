// Shuttle Rally, the game inside the arcade cabinet (arcade.js builds the cabinet, arcadePlay.js puts the
// visitor at its controls). Nobody playing: attract mode, two pixel players keep a rally going.
// Playing: a side-on badminton match against the machine. Move left and right under the shuttle (its
// shadow on the court shows where it will come down) and swing as it reaches the racket. Moving toward
// the net as you hit plays a drop shot, moving back a deep clear. First to 5 points wins.
// Everything is in the screen's pixels: 160 x 120, drawn onto a canvas the cabinet shows as its screen.

const W = 160;
const H = 120;
const NET = { x: W / 2, top: 46 };
const GROUND = 88; // the shuttle lands at the players' feet
const GRAVITY = 160; // pixels per second²
const RACKET_Y = 59; // racket head height, where shots start
const WIN_SCORE = 5;
const HOME = { you: 30, cpu: W - 30 };
const RANGE = { you: [10, NET.x - 8], cpu: [NET.x + 8, W - 10] };
const SPEED = { you: 85, cpu: 66 }; // pixels per second
const SWING_TIME = 0.22; // the racket stays up this long after a swing, and can hit during it
const BEST_KEY = 'shuttleRallyBest';

// Held directions and swings from the keyboard or the on-screen pad (arcadePlay.js)
export const controlInput = { left: false, right: false };

let match = null;

const readBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

const saveBest = (best) => {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // storage blocked, the best rally just won't be remembered
  }
};

// Little blips for hits and points, made on the spot (no sound files)
let audio = null;
const blip = (frequency, duration, { type = 'square', delay = 0, volume = 0.05 } = {}) => {
  if (!audio) return;
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.6, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
};
const sounds = {
  hit: () => blip(620, 0.07, { type: 'triangle', volume: 0.12 }),
  point: (won) =>
    won
      ? [660, 880].forEach((f, i) => blip(f, 0.12, { delay: i * 0.1 }))
      : [330, 220].forEach((f, i) => blip(f, 0.16, { delay: i * 0.12 })),
  win: () => [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.14, { delay: i * 0.11 })),
};

const racketX = (who) => match[who].x + (who === 'you' ? 4 : -4);

// Launch the shuttle from `x0, y0` in a high arc over the net to come down at `x1`. `apex` is the
// highest point of the flight (a smaller y is higher up the screen); raised until the arc clears the net.
const launch = (x0, y0, x1, apex) => {
  let top = Math.min(apex, y0 - 4);
  for (let tries = 0; tries < 12; tries += 1, top -= 4) {
    const vy = -Math.sqrt(2 * GRAVITY * (y0 - top));
    const time = -vy / GRAVITY + Math.sqrt((2 * (GROUND - top)) / GRAVITY);
    const vx = (x1 - x0) / time;
    const atNet = (NET.x - x0) / vx;
    if (y0 + vy * atNet + 0.5 * GRAVITY * atNet * atNet < NET.top - 4) {
      Object.assign(match.shuttle, { x: x0, y: y0, vx, vy, flying: true, trail: [] });
      return;
    }
  }
};

// Where the shuttle comes back down to racket height, for the machine to run to
const landingAtRacket = () => {
  const { x, y, vx, vy } = match.shuttle;
  const time = (-vy + Math.sqrt(vy * vy + 2 * GRAVITY * Math.max(0, RACKET_Y - y))) / GRAVITY;
  return x + vx * time;
};

const random = (min, max) => min + Math.random() * (max - min);

// The rally speeds up as it goes on: lower, quicker arcs
const rallyApex = () => 20 + Math.min(match.rally, 12) * 1.4;

const hit = (who) => {
  const { shuttle } = match;
  match.rally += 1;
  match[who].swing = SWING_TIME;
  sounds.hit();
  if (who === 'you') {
    // Run in to drop it short, back off to clear it deep, or stand still for anything in between
    const moving = (controlInput.right ? 1 : 0) - (controlInput.left ? 1 : 0);
    const [near, far] = moving > 0 ? [NET.x + 10, NET.x + 26] : moving < 0 ? [W - 34, W - 14] : [NET.x + 18, W - 16];
    launch(shuttle.x, Math.min(shuttle.y, RACKET_Y), random(near, far), moving > 0 ? rallyApex() + 8 : rallyApex());
    // The machine reads the shot, but now and then misjudges it, more often the longer the rally
    const misjudged = Math.random() < Math.min(0.12 + match.rally * 0.02, 0.4);
    match.cpu.target = landingAtRacket() + 4 + (misjudged ? random(14, 22) * (Math.random() < 0.5 ? -1 : 1) : random(-2, 2));
    match.cpu.wait = random(0.12, 0.3); // reaction time
  } else {
    const drop = Math.random() < 0.25;
    launch(shuttle.x, Math.min(shuttle.y, RACKET_Y), drop ? random(NET.x - 24, NET.x - 10) : random(14, NET.x - 22), rallyApex() + (drop ? 8 : 0));
    match.cpu.target = HOME.cpu;
    match.cpu.wait = 0.4;
  }
  match.lastHit = who;
};

const serveFrom = (who) => {
  match.state = 'serve';
  match.server = who;
  match.rally = 0;
  match.lastHit = null;
  match.you.x = HOME.you;
  match.cpu.x = HOME.cpu;
  match.cpu.target = HOME.cpu;
  match.timer = who === 'cpu' ? 1 : 0; // the machine serves after a moment, the visitor when they swing
  match.shuttle.flying = false;
  match.shuttle.trail = [];
};

const serve = () => {
  const who = match.server;
  match.state = 'rally';
  match.rally = 0;
  match[who].swing = SWING_TIME;
  sounds.hit();
  const x0 = racketX(who);
  launch(x0, RACKET_Y - 2, who === 'you' ? random(NET.x + 30, W - 18) : random(18, NET.x - 30), 20);
  match.lastHit = who;
  if (who === 'you') {
    match.cpu.target = landingAtRacket() + 4;
    match.cpu.wait = 0.2;
  }
};

const scorePoint = (winner) => {
  match.score[winner] += 1;
  match.state = 'point';
  match.winner = winner;
  match.timer = 1.3;
  match.shuttle.flying = false;
  if (match.rally > match.best) {
    match.best = match.rally;
    saveBest(match.best);
  }
  if (match.score[winner] >= WIN_SCORE) {
    match.state = 'over';
    match.timer = 1; // a moment before a swing can start the next match
    sounds.win();
  } else {
    sounds.point(winner === 'you');
  }
};

export const isMatchOn = () => Boolean(match);

export const startMatch = () => {
  try {
    audio = audio ?? new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch {
    audio = null; // no Web Audio, the game just plays silently
  }
  match = {
    you: { x: HOME.you, swing: 0, walk: 0 },
    cpu: { x: HOME.cpu, swing: 0, walk: 0, target: HOME.cpu, wait: 0 },
    shuttle: { x: 0, y: 0, vx: 0, vy: 0, flying: false, trail: [] },
    score: { you: 0, cpu: 0 },
    best: readBest(),
    rally: 0,
    time: 0,
  };
  serveFrom('you');
};

export const endMatch = () => {
  match = null;
  controlInput.left = false;
  controlInput.right = false;
};

// A swing from the keyboard, the pad or a tap on the screen
export const pressSwing = () => {
  if (!match) return;
  if (match.state === 'over') {
    if (match.timer <= 0) startMatch();
    return;
  }
  if (match.state === 'serve' && match.server === 'you') {
    serve();
    return;
  }
  if (match.you.swing <= -0.15) match.you.swing = SWING_TIME; // a short pause between swings, no button mashing
};

const moveToward = (player, target, speed, delta) => {
  const step = Math.max(-speed * delta, Math.min(speed * delta, target - player.x));
  player.x += step;
  player.walk = Math.abs(step) > 0.01 ? player.walk + delta : 0;
};

// Called every frame while a match is on (arcade.js)
export const stepMatch = (delta) => {
  if (!match) return;
  match.time += delta;
  const { you, cpu, shuttle } = match;
  you.swing -= delta;
  cpu.swing -= delta;

  // The visitor's player, kept on their side of the net
  const direction = (controlInput.right ? 1 : 0) - (controlInput.left ? 1 : 0);
  moveToward(you, you.x + direction * 100, SPEED.you, delta);
  you.x = Math.max(RANGE.you[0], Math.min(RANGE.you[1], you.x));

  // The machine runs to where it thinks the shuttle will be, after its reaction time
  cpu.wait -= delta;
  if (cpu.wait <= 0) moveToward(cpu, Math.max(RANGE.cpu[0], Math.min(RANGE.cpu[1], cpu.target)), SPEED.cpu, delta);

  if (match.state === 'serve') {
    // The server holds the shuttle up by the racket
    const who = match.server;
    shuttle.x = racketX(who) + (who === 'you' ? 3 : -3);
    shuttle.y = RACKET_Y - 4;
    if (who === 'cpu') {
      match.timer -= delta;
      if (match.timer <= 0) serve();
    }
    return;
  }

  if (match.state === 'point' || match.state === 'over') {
    match.timer -= delta;
    if (match.state === 'point' && match.timer <= 0) serveFrom(match.winner);
    return;
  }

  // Rally: fly the shuttle
  shuttle.trail.unshift([shuttle.x, shuttle.y]);
  shuttle.trail.length = Math.min(shuttle.trail.length, 3);
  shuttle.vy += GRAVITY * delta;
  shuttle.x += shuttle.vx * delta;
  shuttle.y += shuttle.vy * delta;

  const coming = (who) => match.lastHit !== who && (who === 'you' ? shuttle.x < NET.x : shuttle.x > NET.x);
  const inReach = (who, spread) => Math.abs(shuttle.x - racketX(who)) <= spread && shuttle.y >= RACKET_Y - 14 && shuttle.vy > 0;

  if (coming('you') && you.swing > 0 && inReach('you', 9)) hit('you');
  else if (coming('cpu') && inReach('cpu', 6)) hit('cpu');

  if (shuttle.y >= GROUND) {
    shuttle.y = GROUND;
    scorePoint(shuttle.x < NET.x ? 'cpu' : 'you');
  }
};

// ---- Drawing ----

const drawCourt = (ctx) => {
  ctx.fillStyle = '#071821';
  ctx.fillRect(0, 0, W, H);
  // Court in perspective along the bottom, net in the middle
  ctx.fillStyle = '#0b5d4b';
  ctx.beginPath();
  ctx.moveTo(18, 70);
  ctx.lineTo(W - 18, 70);
  ctx.lineTo(W - 2, 108);
  ctx.lineTo(2, 108);
  ctx.fill();
  ctx.fillStyle = '#f6f4ef';
  ctx.fillRect(10, 106, W - 20, 1);
  ctx.fillRect(22, 72, W - 44, 1);
  ctx.fillRect(W / 2, NET.top, 1, 44); // net post
  for (let y = NET.top + 2; y < 64; y += 2) ctx.fillRect(W / 2 - 1, y, 3, 1); // net mesh
};

// A pixel player standing at `x` with their feet on y = 88, racket on the `side` facing the net
const drawPlayer = (ctx, x, color, side, raised, step = 0, stride = 0) => {
  const px = Math.round(x) + step;
  ctx.fillStyle = '#f2c79b';
  ctx.fillRect(px - 2, 66, 5, 5); // head
  ctx.fillStyle = color;
  ctx.fillRect(px - 3, 71, 7, 9); // shirt
  ctx.fillStyle = '#1b2a3a';
  ctx.fillRect(px - 3, 80, 3, stride === 1 ? 7 : 8); // legs, one lifted mid-stride
  ctx.fillRect(px + 1, 80, 3, stride === 2 ? 7 : 8);
  const reach = raised ? 10 : 6;
  ctx.fillStyle = '#f6f4ef';
  ctx.fillRect(px + side * 4, 70 - reach, 1, reach);
  ctx.strokeStyle = '#f6f4ef';
  ctx.strokeRect(px + side * 4 - 2.5, 64 - reach, 5, 6);
};

const drawShuttle = (ctx, x, y, trail) => {
  trail.forEach(([tx, ty], i) => {
    ctx.fillStyle = `rgba(246,244,239,${0.6 - i * 0.2})`;
    ctx.fillRect(Math.round(tx), Math.round(ty), 2, 2);
  });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
};

const drawScanlines = (ctx) => {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  for (let row = 0; row < H; row += 2) ctx.fillRect(0, row, W, 1);
};

// A tiny pixel font, 5 pixels tall, so the words stay crisp when the screen is seen up close
// (a browser font this small comes out blurred). Each glyph is its rows, '1' for a lit pixel.
const GLYPHS = {
  A: '010 101 111 101 101', B: '110 101 110 101 110', C: '011 100 100 100 011', D: '110 101 101 101 110',
  E: '111 100 110 100 111', F: '111 100 110 100 100', G: '011 100 101 101 011', H: '101 101 111 101 101',
  I: '111 010 010 010 111', J: '001 001 001 101 010', K: '101 101 110 101 101', L: '100 100 100 100 111',
  M: '10001 11011 10101 10001 10001', N: '1001 1101 1011 1001 1001', O: '010 101 101 101 010',
  P: '110 101 110 100 100', Q: '010 101 101 110 011', R: '110 101 110 101 101', S: '011 100 010 001 110',
  T: '111 010 010 010 010', U: '101 101 101 101 111', V: '101 101 101 101 010', W: '10001 10001 10101 11011 10001',
  X: '101 101 010 101 101', Y: '101 101 010 010 010', Z: '111 001 010 100 111',
  0: '111 101 101 101 111', 1: '010 110 010 010 111', 2: '110 001 010 100 111', 3: '110 001 010 001 110',
  4: '101 101 111 001 001', 5: '111 100 110 001 110', 6: '011 100 111 101 111', 7: '111 001 010 010 010',
  8: '111 101 111 101 111', 9: '111 101 111 001 110', '!': '1 1 1 0 1', ' ': '00 00 00 00 00',
  ':': '0 1 0 1 0', '.': '0 0 0 0 1', '/': '001 001 010 100 100', '-': '000 000 111 000 000',
};
const glyph = (char) => (GLYPHS[char] ?? GLYPHS[' ']).split(' ');
const textWidth = (words, scale) =>
  [...words].reduce((sum, char) => sum + (glyph(char)[0].length + 1) * scale, -scale);

const text = (ctx, words, x, y, color, align = 'center', scale = 1) => {
  const width = textWidth(words, scale);
  let left = Math.round(align === 'center' ? x - width / 2 : align === 'right' ? x - width : x);
  ctx.fillStyle = color;
  [...words].forEach((char) => {
    const rows = glyph(char);
    rows.forEach((row, dy) =>
      [...row].forEach((bit, dx) => bit === '1' && ctx.fillRect(left + dx * scale, y + dy * scale, scale, scale))
    );
    left += (rows[0].length + 1) * scale;
  });
};

// The racing simulator's game (racingGame.js) writes with the same font
export { text as pixelText, textWidth as pixelTextWidth };

// Attract mode: the shuttle flies a high arc from one player to the other every 1.2 s
export const drawAttract = (ctx, time) => {
  drawCourt(ctx);
  const RALLY = 1.2;
  const shot = Math.floor(time / RALLY);
  const t = (time % RALLY) / RALLY;
  const fromLeft = shot % 2 === 0;
  const startX = 34;
  const endX = W - 34;
  const along = (tt) => (fromLeft ? startX + (endX - startX) * tt : endX - (endX - startX) * tt);
  const height = (tt) => 74 - Math.sin(Math.PI * tt) * 50;
  [
    { x: 30, color: '#d0eb00', swing: fromLeft ? 1 - t : t },
    { x: W - 30, color: '#ff6b5b', swing: fromLeft ? t : 1 - t },
  ].forEach(({ x, color, swing }, i) => {
    const step = Math.round(Math.sin(time * 6 + i) * 1.5); // a little footwork
    drawPlayer(ctx, x, color, i === 0 ? 1 : -1, swing > 0.8, step);
  });
  const trail = [0.03, 0.06].map((back) => {
    const tt = Math.max(0, t - back);
    return [along(tt), height(tt)];
  });
  drawShuttle(ctx, along(t), height(t), trail);

  // Scores and title, a point every few rallies
  text(ctx, `1P ${String(7 + (Math.floor(time / 7) % 14)).padStart(2, '0')}`, 5, 4, '#d0eb00', 'left');
  text(ctx, `2P ${String(5 + (Math.floor(time / 9) % 16)).padStart(2, '0')}`, W - 5, 4, '#ff6b5b', 'right');
  text(ctx, 'HI 21', W / 2, 4, '#f6f4ef');
  text(ctx, 'SHUTTLE RALLY', W / 2, 15, '#7fe0ff', 'center', 2);
  if (Math.floor(time * 1.5) % 2 === 0) text(ctx, 'INSERT COIN', W / 2, H - 9, '#ffffff');
  drawScanlines(ctx);
};

const strideOf = (player) => (player.walk > 0 ? 1 + (Math.floor(player.walk * 10) % 2) : 0);

// A match in progress
export const drawMatch = (ctx) => {
  if (!match) return;
  const { you, cpu, shuttle, score, state } = match;
  drawCourt(ctx);

  // The shuttle's shadow on the court, so you can run under it
  if (state === 'rally') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(Math.round(shuttle.x) - 1, GROUND, 5, 2);
  }
  drawPlayer(ctx, you.x, '#d0eb00', 1, you.swing > 0 || (state === 'serve' && match.server === 'you'), 0, strideOf(you));
  drawPlayer(ctx, cpu.x, '#ff6b5b', -1, cpu.swing > 0 || (state === 'serve' && match.server === 'cpu'), 0, strideOf(cpu));
  drawShuttle(ctx, shuttle.x, shuttle.y, state === 'rally' ? shuttle.trail : []);

  text(ctx, `YOU ${score.you}`, 5, 4, '#d0eb00', 'left', 2);
  text(ctx, `CPU ${score.cpu}`, W - 5, 4, '#ff6b5b', 'right', 2);
  text(ctx, match.rally > 1 ? `RALLY ${match.rally}` : `FIRST TO ${WIN_SCORE}`, W / 2, 7, '#f6f4ef');
  text(ctx, `BEST RALLY ${match.best}`, W / 2, H - 9, '#7fe0ff');

  const blink = Math.floor(match.time * 2.5) % 2 === 0;
  if (state === 'serve' && match.server === 'you' && blink) text(ctx, 'SWING TO SERVE', W / 2, 22, '#ffffff');
  if (state === 'point') {
    text(ctx, match.winner === 'you' ? 'YOUR POINT!' : 'CPU POINT', W / 2, 22, match.winner === 'you' ? '#d0eb00' : '#ff6b5b', 'center', 2);
  }
  if (state === 'over') {
    ctx.fillStyle = 'rgba(7, 24, 33, 0.8)';
    ctx.fillRect(24, 17, W - 48, 30);
    text(ctx, match.winner === 'you' ? 'YOU WIN!' : 'CPU WINS', W / 2, 21, match.winner === 'you' ? '#d0eb00' : '#ff6b5b', 'center', 2);
    if (match.timer <= 0 && blink) text(ctx, 'SWING TO PLAY AGAIN', W / 2, 36, '#ffffff');
  }
  drawScanlines(ctx);
};
