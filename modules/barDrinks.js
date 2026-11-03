import * as THREE from 'three';
import { UNITS_PER_METER } from './paintingData.js';
import { currentSeat } from './seating.js';

// Drinks at the Rally Bar (miniBar.js). Sit on a stool and two buttons appear: "Drinks menu" opens
// the bar's menu card (or press B), and picking a drink pours it into a glass on the counter in front
// of the stool. "Take a sip" (or Q) lifts the glass to the visitor and lowers it again, a little
// emptier each time, until it's finished and they can order another.
// The glass is modelled in meters and scaled into scene units like the rest of the bar.

export const DRINKS = [
  { name: 'Smash Mojito', note: 'Lime, mint and soda', color: 0xc6ec8c, garnish: 0x6fbf3a },
  { name: 'Shuttle Lemonade', note: 'Fresh lemon with a little fizz', color: 0xf8e47a, garnish: 0xffd23f },
  { name: 'Deuce Iced Tea', note: 'Peach black tea over ice', color: 0xc47a2c, garnish: 0xffa64d },
  { name: 'Drop Shot Berry', note: 'Mixed berries and sparkling water', color: 0xb5345e, garnish: 0xe0527d },
  { name: 'Match Point Matcha', note: 'Iced matcha latte', color: 0x86ad55, garnish: 0xf6f4ef },
  { name: 'Net Cold Brew', note: 'Slow-steeped coffee, splash of milk', color: 0x4a2c1a, garnish: 0xd9b48f },
];

const GLASS = { radius: 0.036, height: 0.14, wall: 0.003 };
const FULL = 0.85; // how full a fresh drink is poured
const SIPS = 4; // sips to finish one
const POUR_TIME = 1.2; // seconds
const LIFT_TIME = 0.55; // up to the lips, and the same back down
const SIP_HOLD = 0.5; // at the lips, while the level drops

let scene;
let camera;
let controls;
let relockOnClose = false; // desktop: go back to mouse-look after closing the menu if it was on before

let glass = null; // { group, liquid, ice, straw, drink, level }
let rest = new THREE.Vector3(); // where the glass stands on the counter
let pour = null; // { from, to, time } while pouring
let sip = null; // { time, from } while sipping
let atBar = false;

const actions = () => document.getElementById('bar-actions');
const menu = () => document.getElementById('bar-menu');
const sipButton = () => document.getElementById('sip-button');
const isMenuOpen = () => menu().classList.contains('show');
const isExploring = () => document.body.classList.contains('exploring');

const glassMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.05,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const iceMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.55 });

// A highball glass with the drink, two ice cubes and a straw, standing on y = 0 (meters)
const createGlass = (drink) => {
  const group = new THREE.Group();
  const { radius, height, wall } = GLASS;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.92, height, 24, 1, true), glassMaterial);
  shell.position.y = height / 2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius * 0.92, 0.008, 24), glassMaterial);
  base.position.y = 0.004;

  // The liquid is a unit-high cylinder scaled to the current level
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(radius - wall, (radius - wall) * 0.92, 1, 24),
    new THREE.MeshStandardMaterial({ color: drink.color, roughness: 0.2, transparent: true, opacity: 0.88 })
  );
  const ice = [0, 1].map((i) => {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.022), iceMaterial);
    cube.position.x = i ? 0.008 : -0.01;
    cube.position.z = i ? -0.006 : 0.008;
    cube.rotation.set(0.4 + i, 0.3 * i, 0.2);
    return cube;
  });
  const straw = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0035, 0.0035, height + 0.06, 8),
    new THREE.MeshStandardMaterial({ color: drink.garnish, roughness: 0.5 })
  );
  straw.position.set(0.012, (height + 0.06) / 2 + 0.01, 0);
  straw.rotation.z = -0.18;
  group.add(shell, base, liquid, ...ice, straw);
  group.scale.setScalar(UNITS_PER_METER);
  return { group, liquid, ice, drink, level: 0 };
};

// Liquid height and the ice floating on top of it
const setLevel = (level) => {
  glass.level = level;
  const fill = Math.max(level, 0.001) * (GLASS.height - 0.01);
  glass.liquid.scale.y = fill;
  glass.liquid.position.y = 0.008 + fill / 2;
  glass.liquid.visible = level > 0.01;
  glass.ice.forEach((cube, i) => (cube.position.y = Math.max(0.02, 0.008 + fill - 0.006 - i * 0.012)));
  updateSipButton();
};

// A drink left at another stool isn't this visitor's to sip
const glassHere = () => Boolean(glass) && Boolean(currentSeat()?.glassSpot?.equals(rest));

const updateSipButton = () => {
  const here = glassHere();
  sipButton().hidden = !here || glass.level <= 0.01;
  sipButton().disabled = !here || Boolean(pour || sip);
  const finished = here && glass.level <= 0.01;
  document.getElementById('bar-menu-button').firstChild.textContent = finished ? '📋 Order another' : '📋 Drinks menu';
};

const order = (drink) => {
  closeMenu({ relock: true });
  const seat = currentSeat();
  if (!seat?.glassSpot) return;
  if (glass) scene.remove(glass.group);
  glass = createGlass(drink);
  rest = seat.glassSpot.clone();
  glass.group.position.copy(rest);
  scene.add(glass.group);
  setLevel(0);
  pour = { time: 0 };
  updateSipButton();
};

const takeSip = () => {
  if (!glassHere() || glass.level <= 0.01 || pour || sip) return;
  sip = { time: 0, from: glass.level, to: Math.max(0, glass.level - FULL / SIPS) };
  updateSipButton();
};

const openMenu = () => {
  if (isMenuOpen()) return;
  relockOnClose = controls.isLocked; // free the mouse so the menu can be clicked
  if (controls.isLocked) controls.unlock();
  menu().classList.add('show');
  menu().querySelector('.bar-drink')?.focus();
};

const closeMenu = ({ relock }) => {
  if (!isMenuOpen()) return;
  menu().classList.remove('show');
  if (relock && relockOnClose) controls.lock();
  relockOnClose = false;
};

const buildMenu = () => {
  const list = document.getElementById('bar-menu-list');
  DRINKS.forEach((drink, i) => {
    const item = document.createElement('button');
    item.className = 'bar-drink';
    item.style.setProperty('--drink', `#${drink.color.toString(16).padStart(6, '0')}`);
    item.innerHTML = `<span class="bar-drink-swatch" aria-hidden="true"></span>
      <span class="bar-drink-text"><b></b><small></small></span><span class="key-hint">${i + 1}</span>`;
    item.querySelector('b').textContent = drink.name;
    item.querySelector('small').textContent = drink.note;
    item.addEventListener('click', () => order(drink));
    list.append(item);
  });
};

export const setupBarDrinks = (barScene, playerCamera, pointerLockControls) => {
  scene = barScene;
  camera = playerCamera;
  controls = pointerLockControls;
  buildMenu();

  document.getElementById('bar-menu-button').addEventListener('click', openMenu);
  sipButton().addEventListener('click', takeSip);
  document.getElementById('close-bar-menu').addEventListener('click', () => closeMenu({ relock: true }));
  menu().addEventListener('click', (event) => {
    if (event.target === menu()) closeMenu({ relock: true }); // the dark area around the card
  });

  document.addEventListener('keydown', (event) => {
    if (!atBar || isMenuOpen()) return;
    if (event.key === 'b') openMenu();
    if (event.key === 'q') takeSip();
  });
  // While the menu is open, keys belong to it: 1-6 order, B or Esc close it, and nothing else reaches
  // the gallery (Esc would otherwise open the main menu, W/A/S/D would walk off the stool)
  window.addEventListener(
    'keydown',
    (event) => {
      if (!isMenuOpen()) return;
      event.stopImmediatePropagation();
      const drink = DRINKS[Number(event.key) - 1];
      if (drink) order(drink);
      if (event.key === 'Escape' || event.key === 'b') {
        event.preventDefault();
        closeMenu({ relock: event.key === 'b' });
      }
    },
    true
  );
};

const smooth = (t) => t * t * (3 - 2 * t);
const lips = new THREE.Vector3();
const forward = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

// Called every frame from the render loop
export const updateBarDrinks = (delta) => {
  const seated = isExploring() && currentSeat()?.kind === 'bar';
  if (seated !== atBar) {
    atBar = seated;
    actions().hidden = !seated;
    if (!seated) closeMenu({ relock: false });
    updateSipButton();
  }
  if (!glass) return;

  if (pour) {
    pour.time += delta;
    setLevel(FULL * smooth(Math.min(pour.time / POUR_TIME, 1)));
    if (pour.time >= POUR_TIME) {
      pour = null;
      updateSipButton();
    }
  }

  if (sip) {
    sip.time += delta;
    const t = sip.time;
    const total = 2 * LIFT_TIME + SIP_HOLD;
    // Up, hold while drinking, back down
    const lift = smooth(Math.min(t / LIFT_TIME, 1) - Math.max(0, (t - LIFT_TIME - SIP_HOLD) / LIFT_TIME));
    if (t > LIFT_TIME) setLevel(sip.from + (sip.to - sip.from) * Math.min((t - LIFT_TIME) / SIP_HOLD, 1));

    // Just below and in front of the eyes, tipped toward them
    camera.getWorldDirection(forward);
    lips.copy(camera.position).addScaledVector(forward, 0.3 * UNITS_PER_METER);
    lips.y -= 0.09 * UNITS_PER_METER;
    glass.group.position.lerpVectors(rest, lips, lift);
    euler.setFromQuaternion(camera.quaternion);
    glass.group.rotation.set(0.9 * lift, euler.y, 0, 'YXZ');

    if (t >= total) {
      sip = null;
      glass.group.position.copy(rest);
      glass.group.rotation.set(0, 0, 0);
      updateSipButton();
    }
  }
};
