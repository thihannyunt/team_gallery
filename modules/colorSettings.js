import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Colour and light the way a camera sees them. Imported first in main.js, because every material colour
// in the gallery is written as an ordinary (sRGB) hex value and three.js has to know that before the
// first one is made. Lighting is then worked out in linear light and turned back into screen colour at
// the end, so spotlight pools fade off softly and lit surfaces keep their contrast instead of looking flat.
// No tone curve on top: ACES, Reinhard and Cineon all drained the warm colours from the gallery (the
// cream name cards turned grey), and with the lights below nothing gets bright enough to need one.
THREE.ColorManagement.enabled = true;

// The lights were tuned for the old colour handling. In linear light the same numbers come out
// differently: the soft fill (ambient and sky light) much brighter, the lamps and spots dimmer by
// comparison. These bring back the old balance of warm pools on a dimmer room.
const LIGHT_SCALE = { ambient: 0.2, hemisphere: 0.22, lamps: 2 };
// Additive glows (cove strips, lamp pools, the piano stage's halo) likewise come out stronger. A glow
// already set for this colour handling says so with userData.colorTuned.
const GLOW_SCALE = 0.4;
// How strongly surfaces reflect the room around them (the reflection map, below): a hint on paint and
// fabric, more on metal. Materials with a reflection map of their own (the piano) keep a share of theirs.
const REFLECTION = { surface: 0.1, metal: 0.25, own: 0.35 };

export const setupColor = (renderer) => {
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
};

// A soft studio "room" for everything to reflect, so metal, glass and lacquer catch highlights rather
// than looking painted on. The piano keeps the sharper one it sets up itself (grandPiano.js).
export const setupReflections = (scene, renderer) => {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
};

// Goes over the scene once (call it again after more is added; finished things are skipped): lights get
// the scales above; pictures drawn onto canvases are marked as sRGB colour, like the image files; photos,
// screens and signs, which are unlit, keep their exact colours; and each surface gets its reflections.
const done = new WeakSet();
export const applyColorSettings = (scene) => {
  scene.traverse((object) => {
    if (object.isLight && !done.has(object)) {
      done.add(object);
      if (object.isAmbientLight) object.intensity *= LIGHT_SCALE.ambient;
      else if (object.isHemisphereLight) object.intensity *= LIGHT_SCALE.hemisphere;
      else object.intensity *= LIGHT_SCALE.lamps;
    }
    if (!object.material) return;
    [].concat(object.material).forEach((material) => {
      if (done.has(material) || material.isShaderMaterial) return;
      done.add(material);
      ['map', 'emissiveMap'].forEach((key) => {
        const texture = material[key];
        if (texture && !texture.isCompressedTexture && texture.encoding !== THREE.sRGBEncoding) {
          texture.encoding = THREE.sRGBEncoding;
          texture.needsUpdate = true;
        }
      });
      if (material.isMeshBasicMaterial && material.map) material.toneMapped = false;
      if (material.blending === THREE.AdditiveBlending && !material.userData.colorTuned) material.opacity *= GLOW_SCALE;
      if (material.isMeshStandardMaterial) {
        if (material.envMap) material.envMapIntensity *= REFLECTION.own;
        else material.envMapIntensity = material.metalness > 0.3 ? REFLECTION.metal : REFLECTION.surface;
      }
      material.needsUpdate = true;
    });
  });
};
