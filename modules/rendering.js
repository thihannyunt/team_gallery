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
import { updateSkyLounge } from "./skyLounge.js";
import { createRenderQuality } from "./renderQuality.js";

const LANDING_FRAME_SKIP = 15; // the landing video covers the gallery, so meanwhile draw only every 15th frame

export const setupRendering = (
  scene,
  camera,
  renderer,
  paintings,
  controls,
  walls
) => {
  const clock = new THREE.Clock();
  // Static shadows are cached; grandPiano.js invalidates them when a key actually moves.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  let frame = 0;
  const updateQuality = createRenderQuality(renderer);

  let render = function () {
    const delta = clock.getDelta();
    frame += 1;

    // On the landing page the intro video covers the gallery: drawing it at full speed behind the video
    // only made the video stutter. An occasional frame keeps its shaders and textures ready.
    const exploring = document.body.classList.contains("exploring");
    updateQuality(delta, exploring && !document.hidden);
    if (document.hidden) {
      requestAnimationFrame(render);
      return;
    }
    if (!exploring && frame % LANDING_FRAME_SKIP !== 0) {
      requestAnimationFrame(render);
      return;
    }

    updateSeating(); // before movement, so starting to walk gets you up from a seat first
    updateArcadePlay(delta); // at the cabinet the camera is the game's, not the walker's
    updatePianoPlay(delta); // likewise on the piano bench
    updateRacingPlay(delta); // and in the racing seat
    if (!isAtArcade() && !isAtPiano() && !isAtRacing()) updateMovement(delta, controls, camera, walls);
    updateExitDoor();
    updatePhotoPrompt();
    updateInstrumentPlay();
    updateBarDrinks(delta);

    updatePlayerView(delta);
    updatePaintingDetail(paintings, camera.position);
    updateProjector(delta);
    updateArcade(delta);
    updateRacingSim(delta);
    updateSkyLounge(delta);

    renderer.render(scene, getViewCamera());

    requestAnimationFrame(render);
  };

  render();
};
