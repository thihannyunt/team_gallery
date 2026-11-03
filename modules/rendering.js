import * as THREE from "three";
import { updateMovement } from "./movement.js";
import { updatePlayerView, getViewCamera } from "./playerView.js";
import { updatePaintingDetail } from "./paintingDetail.js";
import { updateProjector } from "./projector.js";
import { updateSeating } from "./seating.js";
import { updateExitDoor } from "./exitDoor.js";
import { updateArcade } from "./arcade.js";

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

    renderer.gammaOutput = true;
    renderer.gammaFactor = 2.2;

    updatePlayerView(delta);
    updatePaintingDetail(paintings, camera.position);
    updateProjector(delta);
    updateArcade(delta);

    renderer.render(scene, getViewCamera());
    requestAnimationFrame(render);
  };

  render();
};
