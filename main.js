import * as THREE from "three";
// First: colour management has to be on before any material colour is made (colorSettings.js)
import { setupColor, setupReflections, applyColorSettings } from "./modules/colorSettings.js";
import { setupTextures } from "./modules/textureQuality.js";
import { scene, setupScene } from "./modules/scene.js";
import { createPaintings } from "./modules/paintings.js";
import { createWalls } from "./modules/walls.js";
import { setupLighting } from "./modules/lighting.js";
import { setupFloor } from "./modules/floor.js";
import { createCeiling } from "./modules/ceiling.js";
import { createBoundingBoxes } from "./modules/boundingBox.js";
import { setupRendering } from "./modules/rendering.js";
import { setupEventListeners } from "./modules/eventListeners.js";
import { addObjectsToScene } from "./modules/sceneHelpers.js";
import { setupPlayButton } from "./modules/menu.js";
import { setupMusic } from "./modules/music.js";
import { clickHandling } from "./modules/clickHandling.js";
import { setupPhotoViewer } from "./modules/photoViewer.js";
import { setupPlayerView } from "./modules/playerView.js";
import { setupTouchControls } from "./modules/touchControls.js";
import { setupVR } from "./modules/VRSupport.js";
import { loadBenchModel } from "./modules/bench.js";
import { loadCeilingLampModel } from "./modules/ceilingLamp.js";
import { createBadmintonDecor } from "./modules/badmintonDecor.js";
import { setupProjector } from "./modules/projector.js";
import { createContactBoard, contactBoardLight } from "./modules/contactBoard.js";
import { setupIntroVideo, playIntroVideo } from "./modules/introVideo.js";
import { setupLoadingScreen } from "./modules/loadingScreen.js";
import { createLounge } from "./modules/lounge.js";
import { setupAboutPage } from "./modules/aboutPage.js";
import { setupSeating } from "./modules/seating.js";
import { setupExitDoor } from "./modules/exitDoor.js";
import { setupFullscreen } from "./modules/fullscreen.js";
import { setupPhotoPrompt } from "./modules/photoPrompt.js";
import { setupBarDrinks } from "./modules/barDrinks.js";
import { setupArcadePlay } from "./modules/arcadePlay.js";
import { setupRacingPlay } from "./modules/racingPlay.js";
import { createRacingSim, racingSimLight } from "./modules/racingSim.js";
import { setupInstrumentPlay } from "./modules/instrumentPlay.js";
import { setupPianoPlay } from "./modules/pianoPlay.js";
import { createArcade } from "./modules/arcade.js";
import { createMiniBar } from "./modules/miniBar.js";
import { createMusicCorner, musicCornerLights } from "./modules/musicCorner.js";
import { createGrandPiano } from "./modules/grandPiano.js";
import { createGalleryDecor } from "./modules/galleryDecor.js";
import { createSkyLounge } from "./modules/skyLounge.js";
import { SKY_LOUNGE_OPEN } from "./modules/room.js";

// The grand piano on its corner stage (grandPiano.js, pianoPlay.js); false puts it away without
// touching its code
const SHOW_PIANO = true;

setupIntroVideo(); // first, so the landing video buffers while the gallery is built

// Before any loader starts, so it counts every texture and model. The video plays once they're in.
setupLoadingScreen(() => {
  applyColorSettings(scene); // again, for anything that arrived while loading
  playIntroVideo();
});

let { camera, controls, renderer } = setupScene();
setupTextures(renderer); // before anything loads a texture: it picks the GPU's compressed format
setupColor(renderer);
setupReflections(scene, renderer);

const textureLoader = new THREE.TextureLoader();

const walls = createWalls(scene, textureLoader);
const floor = setupFloor(scene);
const ceiling = createCeiling(scene, textureLoader);
const paintings = createPaintings(scene, textureLoader);
const lighting = setupLighting(scene, paintings, [contactBoardLight, ...musicCornerLights, racingSimLight]);

// The decor's solid pieces join the walls so the player can't walk through them
walls.add(
  ...createBadmintonDecor(scene),
  ...createLounge(scene),
  ...setupMusic(scene, camera),
  ...createArcade(scene),
  ...createRacingSim(scene),
  ...createMiniBar(scene),
  ...createMusicCorner(scene),
  ...(SHOW_PIANO ? createGrandPiano(scene, renderer) : []),
  ...createGalleryDecor(scene),
  ...(SKY_LOUNGE_OPEN ? createSkyLounge(scene) : [])
);

setupProjector(scene, renderer);

createContactBoard(scene);

setupAboutPage();

setupSeating(camera);

setupPhotoPrompt(camera, paintings);

setupBarDrinks(scene, camera, controls);
setupArcadePlay(camera, controls);
setupRacingPlay(camera, controls);
setupInstrumentPlay(camera, controls);
if (SHOW_PIANO) setupPianoPlay(camera, controls);

setupExitDoor(scene, camera, controls);

createBoundingBoxes(walls);
createBoundingBoxes(paintings);

addObjectsToScene(scene, paintings);

setupPlayButton(controls);

setupEventListeners(controls);

setupPhotoViewer(controls);

setupPlayerView(scene, camera);

clickHandling(renderer, paintings);

setupTouchControls(renderer, camera, paintings);

setupRendering(scene, camera, renderer, paintings, controls, walls);

loadBenchModel(scene);

loadCeilingLampModel(scene);

setupVR(renderer);

setupFullscreen();

applyColorSettings(scene); // now that everything is in the scene
