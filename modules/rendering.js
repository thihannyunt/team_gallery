import * as THREE from "three";
import { displayPaintingInfo, hidePaintingInfo } from "./paintingInfo.js";
import { updateMovement } from "./movement.js";
import { updatePlayerView, getViewCamera } from "./playerView.js";
import { updatePaintingDetail } from "./paintingDetail.js";
import { updateProjector } from "./projector.js";
import { updateSeating } from "./seating.js";
import { updateExitDoor } from "./exitDoor.js";

export const setupRendering = (
  scene,
  camera,
  renderer,
  paintings,
  controls,
  walls
) => {
  const clock = new THREE.Clock();

  let render = function () {
    const delta = clock.getDelta();

    updateSeating(); // before movement, so starting to walk gets you up from a seat first
    updateMovement(delta, controls, camera, walls);
    updateExitDoor();

    const distanceThreshold = 8;

    // Paintings hang in tight clusters, so show the closest one rather than any within range
    let paintingToShow;
    let closestDistance = distanceThreshold;
    paintings.forEach((painting) => {
      const distanceToPainting = camera.position.distanceTo(painting.position);
      if (distanceToPainting < closestDistance) {
        closestDistance = distanceToPainting;
        paintingToShow = painting;
      }
    });

    if (paintingToShow) {
      // if there is a painting to show
      displayPaintingInfo(paintingToShow.userData.info);
    } else {
      hidePaintingInfo();
    }

    renderer.gammaOutput = true;
    renderer.gammaFactor = 2.2;

    updatePlayerView(delta);
    updatePaintingDetail(paintings, camera.position);
    updateProjector(delta);

    renderer.render(scene, getViewCamera());
    requestAnimationFrame(render);
  };

  render();
};
