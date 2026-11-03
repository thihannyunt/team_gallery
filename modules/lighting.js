import * as THREE from "three";
import { GUI } from "lil-gui";

// Warm, soft gallery lighting: the room sits in a low warm glow and every artwork gets its own
// ceiling track spotlight, so each photo hangs in a soft pool of light on the wall. A warm LED strip
// runs along the top of the walls. The projector wall gets no spotlight so the screen stands out.
// Photos and the projector screen are unlit (always full brightness), so the
// lighting only shapes the room around them.

const WARM_LIGHT = 0xffd9a8; // about 3000 K
const AMBIENT = { color: 0xfff0dc, intensity: 0.22 };
const HEMISPHERE = { sky: 0xffe2bd, ground: 0x4a3626, intensity: 0.4 };
const TRACK = {
  y: 9.3, // fixture height, just under the ceiling (y = 10)
  railY: 9.86,
  offset: 3.8, // how far out from the wall the track runs
  intensity: 1.5,
  penumbra: 0.8, // soft-edged pools of light
};
const CEILING_Y = 10;
const WALL = 20; // walls stand at ±20

const housingMaterial = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5, metalness: 0.4 });
const lensMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1d6 });

// Spotlight hung from the ceiling track in front of an artwork, aimed at its center
function createTrackLight(target) {
  const { center, normal, width, height } = target;
  const position = center.clone().addScaledVector(normal, TRACK.offset);
  position.y = TRACK.y;

  const spotlight = new THREE.SpotLight(WARM_LIGHT, TRACK.intensity);
  spotlight.position.copy(position);
  spotlight.target.position.copy(center);
  spotlight.penumbra = TRACK.penumbra;
  spotlight.decay = 1;
  spotlight.distance = 30;
  // Wide enough for a soft halo around the artwork, not the whole wall
  const reach = 0.5 * Math.hypot(width, height) * 1.25;
  spotlight.angle = Math.atan(reach / position.distanceTo(center));

  // The fixture: a stem down from the track and a dark can pointing at the artwork
  const fixture = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, TRACK.railY - TRACK.y, 6), housingMaterial);
  stem.position.y = (TRACK.railY - TRACK.y) / 2;
  const can = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 16), housingMaterial);
  body.rotation.x = Math.PI / 2; // along the can's local z, which lookAt points at the artwork
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), lensMaterial);
  lens.position.z = 0.251;
  can.add(body, lens);
  fixture.add(stem, can);
  fixture.position.copy(position);
  fixture.updateMatrixWorld();
  can.lookAt(center);

  return { spotlight, fixture };
}

// Thin black ceiling track running the length of a wall, `TRACK.offset` out from it
function createRail(rotationY) {
  const normal = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
  const rail = new THREE.Mesh(new THREE.BoxGeometry(34, 0.08, 0.12), housingMaterial);
  rail.position.copy(normal).multiplyScalar(-(WALL - TRACK.offset));
  rail.position.y = TRACK.railY;
  rail.rotation.y = rotationY;
  return rail;
}

// Warm LED strip where the wall meets the ceiling, with a soft glow washing down the wall
function createCoveLight(rotationY) {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(255, 214, 160, 0.55)");
  gradient.addColorStop(1, "rgba(255, 214, 160, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cove = new THREE.Group();
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2 * WALL, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  strip.position.set(0, CEILING_Y - 0.08, 0.05);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * WALL, 1.6),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.position.set(0, CEILING_Y - 0.85, 0.02);
  cove.add(strip, glow);

  // The group's +z faces into the room
  const normal = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
  cove.position.copy(normal).multiplyScalar(-(WALL - 0.01));
  cove.rotation.y = rotationY;
  return cove;
}

// `extraTargets`: other things to light besides the paintings, as { center, normal, width, height }
export const setupLighting = (scene, paintings, extraTargets = []) => {
  const gui = new GUI();
  const folder = gui.addFolder("Lighting");

  const ambientLight = new THREE.AmbientLight(AMBIENT.color, AMBIENT.intensity);
  const hemisphereLight = new THREE.HemisphereLight(HEMISPHERE.sky, HEMISPHERE.ground, HEMISPHERE.intensity);
  scene.add(ambientLight, hemisphereLight);
  folder.add(ambientLight, "intensity", 0, 1).name("Ambient");
  folder.add(hemisphereLight, "intensity", 0, 1).name("Soft fill");

  // One track light per painting, aimed at the middle of the frame and its name card
  const targets = paintings.map((painting) => {
    const box = new THREE.Box3().setFromObject(painting);
    const size = box.getSize(new THREE.Vector3());
    const rotationY = painting.rotation.y;
    return {
      center: box.getCenter(new THREE.Vector3()),
      normal: new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY)),
      width: Math.max(size.x, size.z),
      height: size.y,
    };
  });

  const spotlights = [...targets, ...extraTargets].map((target) => {
    const { spotlight, fixture } = createTrackLight(target);
    scene.add(spotlight, spotlight.target, fixture);
    return spotlight;
  });
  const track = { intensity: TRACK.intensity };
  folder
    .add(track, "intensity", 0, 4)
    .name("Track lights")
    .onChange((value) => spotlights.forEach((spotlight) => (spotlight.intensity = value)));

  // Tracks and cove strips on every wall, the projector wall included, so the room reads as one
  [0, Math.PI / 2, -Math.PI / 2, Math.PI].forEach((rotationY) => {
    scene.add(createRail(rotationY), createCoveLight(rotationY));
  });
};
