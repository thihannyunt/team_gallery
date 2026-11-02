import * as THREE from 'three';
import { COLORS } from './badmintonDecor.js';
import { useMobileTextures } from './textureQuality.js';

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
    // Projected light falls off a little toward the corners
    vec2 centered = (vUv - 0.5) * vec2(1.0, 1.0 / screenAspect) * 1.6;
    color *= 1.0 - 0.18 * dot(centered, centered);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
blank.needsUpdate = true;

let uniforms;
let current = blank; // on screen
let next = null; // loaded and waiting, or null while loading
let nextIndex = 0;
let loading = false;
let elapsed = HOLD_TIME; // start fading in the first slide as soon as it loads
let fading = false;

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

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
  images.forEach((image, i) => {
    const width = aspects[i] * height;
    ctx.drawImage(image, x, y, width, height);
    x += width + gap;
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
};

const loadNext = () => {
  loading = true;
  const slide = SLIDES[nextIndex];
  nextIndex = (nextIndex + 1) % SLIDES.length;
  Promise.all(slide.map(loadImage))
    .then((images) => {
      next = composeSlide(images);
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

const createProjector = () => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.5, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x2b3131, roughness: 0.45, metalness: 0.2 })
  );
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.22, 0.2, 24),
    new THREE.MeshBasicMaterial({ color: COLORS.cream })
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0.3, 0, 0.6);
  const mount = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 10 - PROJECTOR.y, 8),
    new THREE.MeshStandardMaterial({ color: 0x2b3131, roughness: 0.5 })
  );
  mount.position.y = (10 - PROJECTOR.y) / 2;
  group.add(body, lens, mount);
  group.position.set(PROJECTOR.x, PROJECTOR.y, PROJECTOR.z);
  group.rotation.y = Math.PI / 2; // lens (local +z) toward the right wall (+x)

  return group;
};

export const setupProjector = (scene) => {
  scene.add(createScreen(), createProjector());
  loadNext();
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
