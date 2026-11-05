import * as THREE from 'three';
import { COLORS } from './badmintonDecor.js';
import { useMobileTextures } from './textureQuality.js';
import { FLOOR_Y } from './paintingData.js';
import { createGlow } from './fakeGlow.js';

// "Team Activities" projector slideshow on the right wall, the first wall you see on your right
// after starting. A ceiling projector faces a wide screen of crew photos; each slide holds,
// then crossfades into the next. Photos live in public/projector/ (2048px web copies of the camera
// originals in projector_image/).
//
// Each slide shows photos of one shape only, side by side at the same size on every slide: two
// landscapes, or three portraits. Mixing shapes in one slide looked uneven.
const SLIDES = [
  ['_DSC0625.jpg', '_DSC0636.jpg'], // landscapes
  ['_DSC0597.jpg', '_DSC0669.jpg', '_DSC0720.jpg'], // portraits
  ['_DSC0750.jpg', '_DSC0876.jpg'], // landscapes
  ['_DSC0771.jpg', '_DSC0773.jpg', '_DSC0782.jpg'], // portraits
].map((files) => files.map((file) => `projector/${file}`));

const HOLD_TIME = 3; // seconds each slide stays on screen
const FADE_TIME = 1; // seconds of crossfade between slides

// Right wall stands at x = 20 facing -x; floor at y ≈ -3.14, ceiling at y = 10
const SCREEN = { width: 32, height: 10, centerY: 4.0, x: 19.4 };
const LABEL = { width: 7, height: 1.3, gap: 0.45 }; // "Team Activities" plaque under the screen
// Middle of the screen, for seating.js to turn seated visitors toward it
export const SCREEN_CENTER = new THREE.Vector3(SCREEN.x, SCREEN.centerY, 0);
const GAP = 0.25; // between photos and around the row, in scene units
// Each slide is drawn into one canvas this wide; phones get a smaller one to save memory
const CANVAS_WIDTH = useMobileTextures ? 2048 : 3072;
const SCREEN_COLOR = '#0d1111';
const PROJECTOR = { x: -2, y: 8.9, z: 0 }; // hangs from the ceiling, lens toward the right wall
// The lens, in world space: the projector is turned so its local (0.3, 0, 0.7) lands here
const LENS = new THREE.Vector3(PROJECTOR.x + 0.7, PROJECTOR.y, PROJECTOR.z - 0.3);
const BEAM_STRENGTH = 0.06; // how visible the beam is in the air near the lens (0 to 1)
const ROOM_GLOW = { depth: 12, strength: 0.55 }; // the picture's light on the floor in front of the screen

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D mapA;
  uniform sampler2D mapB;
  uniform float progress;
  uniform float screenAspect;
  varying vec2 vUv;

  void main() {
    vec3 color = mix(texture2D(mapA, vUv).rgb, texture2D(mapB, vUv).rgb, smoothstep(0.0, 1.0, progress));
    // A projector can't project black: the darkest it gets is the screen in the room's light, and its
    // whites are a little softer than a TV's. Map the picture between those.
    color = mix(vec3(0.07, 0.072, 0.075), vec3(0.93, 0.935, 0.95), color);
    // Brightest in the middle, falling off toward the corners (the lamp's hot spot)
    vec2 centered = (vUv - 0.5) * vec2(1.0, 1.0 / screenAspect) * 1.6;
    color *= 1.04 - 0.24 * dot(centered, centered);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
blank.needsUpdate = true;

let uniforms;
let renderer; // to upload each slide to the GPU ahead of its crossfade
let roomGlow;
let beamUniforms;
const glowColor = new THREE.Color(); // the screen's current average colour, for the beam and room light
let current = blank; // on screen
let next = null; // loaded and waiting, or null while loading
let nextIndex = 0;
let loading = false;
let elapsed = HOLD_TIME; // start fading in the first slide as soon as it loads
let fading = false;

// Preparing a slide used to stall the frame every few seconds while walking: decoding 2048px JPEGs,
// reading the whole slide back for its colour and uploading it to the GPU all happened at once on the
// main thread. Now the photos decode off the main thread, the colour comes from a tiny sample of each
// photo, and the remaining steps run on separate frames during the hold, not when the crossfade starts.
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

// Fetches and decodes a photo off the main thread (createImageBitmap); an <img> where that's missing
const loadImage = async (src) => {
  if (window.createImageBitmap) {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`${src}: ${response.status}`);
    return createImageBitmap(await response.blob());
  }
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
};

// A photo's average colour (0 to 1 per channel), from an 8 x 8 copy of it
const sampler = document.createElement('canvas');
sampler.width = sampler.height = 8;
const samplerCtx = sampler.getContext('2d', { willReadFrequently: true });
const averageColor = (image) => {
  samplerCtx.clearRect(0, 0, 8, 8);
  samplerCtx.drawImage(image, 0, 0, 8, 8);
  const { data } = samplerCtx.getImageData(0, 0, 8, 8);
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    sum[0] += data[i];
    sum[1] += data[i + 1];
    sum[2] += data[i + 2];
  }
  return sum.map((total) => total / (64 * 255));
};
const SCREEN_RGB = [0x0d / 255, 0x11 / 255, 0x11 / 255]; // SCREEN_COLOR

// Draw a slide's photos side by side, all the same height, as large as fits, centered on the screen
const composeSlide = (images) => {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = Math.round((CANVAS_WIDTH * SCREEN.height) / SCREEN.width);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = SCREEN_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const px = canvas.width / SCREEN.width;
  const gap = GAP * px;
  const aspects = images.map((image) => image.width / image.height);
  const totalAspect = aspects.reduce((sum, aspect) => sum + aspect, 0);
  const height = Math.min(
    canvas.height - 2 * gap,
    (canvas.width - (images.length + 1) * gap) / totalAspect
  );
  let x = (canvas.width - (totalAspect * height + (images.length - 1) * gap)) / 2;
  const y = (canvas.height - height) / 2;
  // The slide's average colour, which the screen throws back into the room: each photo's colour by the
  // share of the screen it covers, and the dark screen round them
  const canvasArea = canvas.width * canvas.height;
  const average = [0, 0, 0];
  let covered = 0;
  images.forEach((image, i) => {
    const width = aspects[i] * height;
    ctx.drawImage(image, x, y, width, height);
    x += width + gap;
    const share = (width * height) / canvasArea;
    averageColor(image).forEach((value, channel) => (average[channel] += value * share));
    covered += share;
  });
  SCREEN_RGB.forEach((value, channel) => (average[channel] += value * (1 - covered)));

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.userData.average = new THREE.Color(...average);
  return texture;
};

const black = new THREE.Color(0, 0, 0);
const averageOf = (texture) => texture.userData.average ?? black;

const loadNext = () => {
  loading = true;
  const slide = SLIDES[nextIndex];
  nextIndex = (nextIndex + 1) % SLIDES.length;
  Promise.all(slide.map(loadImage))
    .then(async (images) => {
      await nextFrame();
      const texture = composeSlide(images);
      images.forEach((image) => image.close?.()); // free the decoded photos (ImageBitmap)
      await nextFrame();
      renderer?.initTexture(texture); // upload it now, during the hold, not on the crossfade's first frame
      next = texture;
    })
    .catch(() => {}) // skip a slide whose photos fail to load, the next call moves on
    .finally(() => {
      loading = false;
    });
};

// Museum-style plaque under the screen, matching the other wall labels
const createLabel = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.round((canvas.width * LABEL.height) / LABEL.width);
  const ctx = canvas.getContext('2d');
  const draw = () => {
    ctx.fillStyle = '#f7f5f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#d0eb00';
    ctx.fillRect(0, 0, 12, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1c1c1c';
    ctx.font = '800 76px Manrope, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('Team Activities', canvas.width / 2, canvas.height * 0.42);
    ctx.fillStyle = '#6b6b6b';
    ctx.font = '600 30px Manrope, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('THE COURT CONNECT CREW, ON AND OFF THE COURT', canvas.width / 2, canvas.height * 0.76);
  };
  draw();
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  document.fonts?.load('800 76px Manrope').then(() => {
    draw();
    texture.needsUpdate = true;
  });
  return new THREE.Mesh(
    new THREE.PlaneGeometry(LABEL.width, LABEL.height),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 1 })
  );
};

const createScreen = () => {
  const group = new THREE.Group();

  uniforms = {
    mapA: { value: blank },
    mapB: { value: blank },
    screenAspect: { value: SCREEN.width / SCREEN.height },
    progress: { value: 0 },
  };
  const image = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN.width, SCREEN.height),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
  );

  // Thin dark border and the roller case of a pull-down projection screen
  const casing = new THREE.MeshStandardMaterial({ color: COLORS.ink, roughness: 0.5 });
  const border = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.width + 0.4, SCREEN.height + 0.4), casing);
  border.position.z = -0.03; // just behind the image, toward the wall
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, SCREEN.width + 1.2, 24), casing);
  roller.rotation.z = Math.PI / 2;
  roller.position.set(0, SCREEN.height / 2 + 0.45, -0.1);

  const label = createLabel();
  label.position.y = -SCREEN.height / 2 - LABEL.gap - LABEL.height / 2;

  group.add(border, image, roller, label);
  group.position.set(SCREEN.x, SCREEN.centerY, 0);
  group.rotation.y = -Math.PI / 2; // face into the room
  return group;
};

// The beam: a faint pyramid of light from the lens to the screen's corners, brightest at the lens and
// fading out toward the screen, the way projector light shows in the air of a dim room
const createBeam = () => {
  const x = SCREEN.x - 0.05;
  const halfWidth = SCREEN.width / 2;
  const halfHeight = SCREEN.height / 2;
  const corners = [
    [x, SCREEN.centerY + halfHeight, -halfWidth],
    [x, SCREEN.centerY + halfHeight, halfWidth],
    [x, SCREEN.centerY - halfHeight, halfWidth],
    [x, SCREEN.centerY - halfHeight, -halfWidth],
  ];
  const positions = [];
  const along = []; // 0 at the lens, 1 at the screen
  const across = []; // 0 and 1 at a face's two long edges, so the light fades out softly at the sides
  corners.forEach((corner, i) => {
    if (i === 0) return; // no top face: it runs just under the ceiling and showed as a flat grey sheet
    const next = corners[(i + 1) % 4];
    positions.push(...LENS.toArray(), ...corner, ...next);
    along.push(0, 1, 1);
    across.push(0.5, 0, 1);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
  geometry.setAttribute('across', new THREE.Float32BufferAttribute(across, 1));

  beamUniforms = { color: { value: new THREE.Color(1, 1, 1) }, strength: { value: BEAM_STRENGTH } };
  return new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms: beamUniforms,
      vertexShader: /* glsl */ `
        attribute float along;
        attribute float across;
        varying float vAlong;
        varying float vAcross;
        void main() {
          vAlong = along;
          vAcross = across;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 color;
        uniform float strength;
        varying float vAlong;
        varying float vAcross;
        void main() {
          float fade = pow(1.0 - vAlong, 2.2) + 0.08 * (1.0 - vAlong);
          // across is interpolated toward 0.5 near the lens, so this only softens the far edges
          fade *= smoothstep(0.0, 0.25, vAcross) * smoothstep(1.0, 0.75, vAcross);
          gl_FragColor = vec4(color * strength * fade, 1.0);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
};

// Soft round glow for the lens
const lensGlowTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.15, 'rgba(235, 243, 255, 0.8)');
  gradient.addColorStop(0.45, 'rgba(200, 220, 255, 0.18)');
  gradient.addColorStop(1, 'rgba(200, 220, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
};

const createProjector = () => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.5, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x2b3131, roughness: 0.45, metalness: 0.2 })
  );
  // Lens barrel with dark glass, a bright core where the light comes out, and its glow
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.22, 0.2, 24),
    new THREE.MeshStandardMaterial({ color: 0x1a1d1d, roughness: 0.3, metalness: 0.6 })
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0.3, 0, 0.6);
  const glassFace = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshBasicMaterial({ color: 0x9fb4c4 }));
  glassFace.position.set(0.3, 0, 0.701);
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  core.position.set(0.3, 0, 0.703);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: lensGlowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 })
  );
  glow.scale.setScalar(1.1);
  glow.position.set(0.3, 0, 0.78);
  // Vents on the side and a little blue power light
  const vents = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ color: 0x151818, roughness: 0.9 }));
  vents.rotation.y = -Math.PI / 2;
  vents.position.set(-0.701, 0, 0);
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.025, 12), new THREE.MeshBasicMaterial({ color: 0x4fa8ff }));
  led.position.set(-0.4, 0.1, 0.551);
  const mount = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 10 - PROJECTOR.y, 8),
    new THREE.MeshStandardMaterial({ color: 0x2b3131, roughness: 0.5 })
  );
  mount.position.y = (10 - PROJECTOR.y) / 2;
  group.add(body, lens, glassFace, core, glow, vents, led, mount);
  group.position.set(PROJECTOR.x, PROJECTOR.y, PROJECTOR.z);
  group.rotation.y = Math.PI / 2; // lens (local +z) toward the right wall (+x)

  return group;
};

export const setupProjector = (scene, webglRenderer) => {
  renderer = webglRenderer;
  // The picture's light thrown onto the floor in front of it, tinted by what's on screen. Painted on
  // (fakeGlow.js): a real area light here cost the whole gallery more frame rate than everything else.
  // Starts black (no light) until the first slide's colour arrives.
  roomGlow = createGlow(0x000000, SCREEN.width + 4, ROOM_GLOW.depth, ROOM_GLOW.strength, 'wash');
  roomGlow.rotation.z = -Math.PI / 2; // the wash's bright edge against the right wall (+x)
  roomGlow.position.set(SCREEN.x - ROOM_GLOW.depth / 2, FLOOR_Y + 0.01, 0);
  scene.add(createScreen(), createProjector(), createBeam(), roomGlow);
  loadNext();
};

// Beam and room light follow the screen's average colour, blending with the crossfade
const updateGlow = (fromTexture, toTexture, amount) => {
  glowColor.copy(averageOf(fromTexture)).lerp(averageOf(toTexture), amount);
  roomGlow.material.color.copy(glowColor);
  // The beam is mostly the lamp's white, tinted a little by the picture
  const brightness = Math.max(glowColor.r, glowColor.g, glowColor.b, 0.001);
  beamUniforms.color.value.setRGB(1, 1, 1).lerp(glowColor.clone().multiplyScalar(1 / brightness), 0.35);
};

const smoothstepProgress = () => {
  const t = uniforms.progress.value;
  return t * t * (3 - 2 * t);
};

// Called every frame from the render loop
export const updateProjector = (delta) => {
  elapsed += Math.min(delta, 0.1); // a long pause (hidden tab) shouldn't skip slides

  if (!fading) {
    if (!next && !loading) loadNext();
    if (elapsed >= HOLD_TIME && next) {
      // Crossfade from the slide on screen (A) to the loaded one (B)
      uniforms.mapA.value = current;
      uniforms.mapB.value = next;
      uniforms.progress.value = 0;
      fading = true;
      elapsed = 0;
    }
    return;
  }

  uniforms.progress.value = Math.min(elapsed / FADE_TIME, 1);
  updateGlow(uniforms.mapA.value, uniforms.mapB.value, smoothstepProgress());
  if (elapsed >= FADE_TIME) {
    if (current !== blank) current.dispose(); // keep only what's on screen in memory
    current = next;
    next = null;
    uniforms.mapA.value = current;
    uniforms.progress.value = 0;
    fading = false;
    elapsed = 0;
  }
};
