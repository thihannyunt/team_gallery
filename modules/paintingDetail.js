import * as THREE from 'three';
import { texturePath } from './textureQuality.js';

// Phones start with the 1024px copies of the photos (see textureQuality.js) so the gallery fits in
// their memory. Walking up to a painting swaps in the full-size photo, and walking away swaps the copy
// back and frees it, so only the few paintings around the player hold a full-size photo at once.
// On desktop the walls already show the full-size photos, so there is nothing to do.
const LOAD_DISTANCE = 10;
const UNLOAD_DISTANCE = 14; // further than LOAD_DISTANCE so standing at the edge doesn't keep reloading

const loader = new THREE.TextureLoader();

export const updatePaintingDetail = (paintings, position) => {
  paintings.forEach((painting) => {
    const { photo, imgSrc } = painting.userData;
    if (texturePath(imgSrc) === imgSrc) return;

    painting.userData.detail ??= { lowRes: photo.material.map, fullRes: null, loading: false, failed: false };
    const detail = painting.userData.detail;
    const distance = position.distanceTo(painting.position);

    if (distance < LOAD_DISTANCE && !detail.fullRes && !detail.loading && !detail.failed) {
      detail.loading = true;
      loader.load(
        imgSrc,
        (texture) => {
          detail.loading = false;
          texture.anisotropy = 8;
          detail.fullRes = texture;
          photo.material.map = texture; // if the player already walked off, the next frame swaps it back
        },
        undefined,
        () => {
          detail.loading = false;
          detail.failed = true; // keep the 1024px copy rather than retrying every frame
        }
      );
    } else if (distance > UNLOAD_DISTANCE && detail.fullRes) {
      photo.material.map = detail.lowRes;
      detail.fullRes.dispose();
      detail.fullRes = null;
    }
  });
};
