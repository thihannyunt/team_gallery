import * as THREE from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

// Phones crash on the full 4K textures (they decode to well over 1 GB of GPU memory),
// so touch devices load the 1024px copies kept in public/textures-mobile/ instead.
export const useMobileTextures = window.matchMedia("(pointer: coarse)").matches;

// Desktops get 2048px copies of the room's floor, ceiling and wall textures (public/textures-2k/): the 4K
// originals took about 1 GB of graphics memory between them, which made laptops stutter, and looked no
// sharper at the distances they're seen from.
const ROOM_TEXTURES = ["WoodFloor040_4K-JPG/", "OfficeCeiling005_4K-JPG/", "leather_white_4k.gltf/"];

// The photos start as their 1024px copies on every device, and paintingDetail.js swaps in the full-size
// photo only for the paintings the player walks up to: a wall of full-size photos made walking past it lag.
const PHOTOS = "artworks/";

export const texturePath = (path) => {
  if (useMobileTextures || path.startsWith(PHOTOS)) return `textures-mobile/${path}`;
  return ROOM_TEXTURES.some((folder) => path.startsWith(folder)) ? `textures-2k/${path}` : path;
};

// Every texture also has a GPU-compressed .ktx2 copy beside its .jpg (scripts/make-ktx2.sh makes them;
// public/basis/ holds three.js's decoder for them). The graphics card keeps those compressed, at a
// quarter or less of a JPEG's memory, and they skip the JPEG decode that stalled the frame as each one
// arrived. Normal maps are the 1024px copies everywhere: they only add fine bumps, and at 2048px they
// compress badly.
let ktx2Loader;
const imageLoader = new THREE.TextureLoader();

// Called once the renderer exists (main.js): the loader picks the compressed format this GPU supports
export const setupTextures = (renderer) => {
  ktx2Loader = new KTX2Loader().setTranscoderPath("basis/").detectSupport(renderer);
};

// Loads the copy of `path` (as kept in public/, the full-size original) for this device, KTX2 first and
// the JPEG if that fails. The texture arrives later, so `apply` gets it to set up and put on its material.
// `color`: an image to show (sRGB), not data such as roughness; `normal`: a normal map; `exact`: load
// `path` itself rather than this device's copy.
export const loadTexture = (path, apply, { color = true, normal = false, exact = false } = {}) => {
  const jpg = exact ? path : normal ? `textures-mobile/${path}` : texturePath(path);
  // Counts for the loading screen until the texture is on its material: a KTX2 file has finished
  // downloading a moment before it's decoded, and the screen shouldn't lift in between (loadingScreen.js)
  const manager = THREE.DefaultLoadingManager;
  manager.itemStart(jpg);
  const ready = (texture) => {
    texture.encoding = color ? THREE.sRGBEncoding : THREE.LinearEncoding;
    apply(texture);
    manager.itemEnd(jpg);
  };
  const giveUp = () => manager.itemEnd(jpg);
  const fallback = () => imageLoader.load(jpg, ready, undefined, giveUp);
  if (!ktx2Loader) return fallback();
  ktx2Loader.load(jpg.replace(/\.jpg$/, ".ktx2"), ready, undefined, fallback);
};

// Puts a freshly loaded texture on `material` as `key` (map, normalMap, ...); the shader is rebuilt for it
export const assign = (material, key, setup) => (texture) => {
  setup?.(texture);
  material[key] = texture;
  material.needsUpdate = true;
};
