import * as THREE from 'three';
import { openPhotoViewer } from './photoViewer.js';
import { getViewCamera } from './playerView.js';
import { isWithinReach } from './photoPrompt.js';

const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

function clickHandling(renderer, paintings) {
  renderer.domElement.addEventListener(
    'click',
    (event) => {
      // With the mouse locked the cursor is hidden and its position is stale, so aim at the screen center
      if (document.pointerLockElement) {
        openPaintingAt(window.innerWidth / 2, window.innerHeight / 2, paintings);
      } else {
        openPaintingAt(event.clientX, event.clientY, paintings);
      }
    },
    false
  );
}

// Also used by touchControls.js, which detects taps itself
function openPaintingAt(x, y, paintings) {
  mouse.x = (x / window.innerWidth) * 2 - 1;
  mouse.y = -(y / window.innerHeight) * 2 + 1;
  onClick(paintings);
}

function onClick(paintings) {
  // In third person the rendering camera is behind the player, so aim from it, not the player's eyes
  raycaster.setFromCamera(mouse, getViewCamera());

  const intersects = raycaster.intersectObjects(paintings);

  if (intersects.length > 0) {
    // The hit is a part of the painting (photo, frame, plaque), so walk up to the painting group
    let painting = intersects[0].object;
    while (painting.userData.type !== 'painting' && painting.parent) {
      painting = painting.parent;
    }

    // Only up close, the same reach as the "View photo" button: walk over to a photo to open it
    if (isWithinReach(painting)) openPhotoViewer(painting.userData.info);
  }
}

export { clickHandling, openPaintingAt };
