import * as THREE from "three";
import { updateMovement } from "./movement.js";
import { updatePlayerView, getViewCamera } from "./playerView.js";
import { updatePaintingDetail } from "./paintingDetail.js";
import { updateProjector } from "./projector.js";
import { updateSeating } from "./seating.js";
import { updateExitDoor } from "./exitDoor.js";
import { updateArcade } from "./arcade.js";
import { updatePhotoPrompt } from "./photoPrompt.js";
import { updateBarDrinks } from "./barDrinks.js";
import { updateArcadePlay, isAtArcade } from "./arcadePlay.js";
import { updateRacingPlay, isAtRacing } from "./racingPlay.js";
import { updateRacingSim } from "./racingSim.js";
import { updateInstrumentPlay } from "./instrumentPlay.js";
import { updatePianoPlay, isAtPiano } from "./pianoPlay.js";

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
    updateArcadePlay(delta); // at the cabinet the camera is the game's, not the walker's
    updatePianoPlay(delta); // likewise on the piano bench
    updateRacingPlay(delta); // and in the racing seat
    if (!isAtArcade() && !isAtPiano() && !isAtRacing()) updateMovement(delta, controls, camera, walls);
    updateExitDoor();
    updatePhotoPrompt();
    updateInstrumentPlay();
    updateBarDrinks(delta);

    renderer.gammaOutput = true;
    renderer.gammaFactor = 2.2;

    updatePlayerView(delta);
    updatePaintingDetail(paintings, camera.position);
    updateProjector(delta);
    updateArcade(delta);
    updateRacingSim(delta);

    renderer.render(scene, getViewCamera());
    requestAnimationFrame(render);
  };

  render();
};
