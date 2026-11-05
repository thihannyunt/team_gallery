import { texturePath, loadTexture } from './textureQuality.js';

// Every device starts with the 1024px copies of the photos (see textureQuality.js): light on memory and
// quick to draw. Walking up to a painting swaps in the full-size photo, and walking away swaps the copy
// back and frees it, so only the few paintings around the player hold a full-size photo at once.
const LOAD_DISTANCE = 10;
const UNLOAD_DISTANCE = 14; // further than LOAD_DISTANCE so standing at the edge doesn't keep reloading


export const updatePaintingDetail = (paintings, position) => {
  paintings.forEach((painting) => {
    const { photo, imgSrc } = painting.userData;
    if (texturePath(imgSrc) === imgSrc || !photo.material.map) return; // nothing to swap, or not loaded yet

    painting.userData.detail ??= { lowRes: photo.material.map, fullRes: null, loading: false, failed: false };
    const detail = painting.userData.detail;
    const distance = position.distanceTo(painting.position);

    if (distance < LOAD_DISTANCE && !detail.fullRes && !detail.loading && !detail.failed) {
      detail.loading = true;
      // The full-size photo's KTX2 copy (a quarter of a JPEG's memory), or the JPEG if that fails
      loadTexture(
        imgSrc,
        (texture) => {
          detail.loading = false;
          texture.anisotropy = 8;
          detail.fullRes = texture;
          photo.material.map = texture; // if the player already walked off, the next frame swaps it back
        },
        { exact: true }
      );
    } else if (distance > UNLOAD_DISTANCE && detail.fullRes) {
      photo.material.map = detail.lowRes;
      detail.fullRes.dispose();
      detail.fullRes = null;
    }
  });
};
