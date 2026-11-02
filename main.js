import * as THREE from "three";
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
import { createFeatureArt, featureArtLight } from "./modules/featureArt.js";
import { createLounge } from "./modules/lounge.js";
import { setupAboutPage } from "./modules/aboutPage.js";
import { setupSeating } from "./modules/seating.js";
import { setupExitDoor } from "./modules/exitDoor.js";

let { camera, controls, renderer } = setupScene();

const textureLoader = new THREE.TextureLoader();

const walls = createWalls(scene, textureLoader);
const floor = setupFloor(scene);
const ceiling = createCeiling(scene, textureLoader);
const paintings = createPaintings(scene, textureLoader);
const lighting = setupLighting(scene, paintings, [featureArtLight]);

// The decor's solid pieces join the walls so the player can't walk through them
walls.add(...createBadmintonDecor(scene), ...createLounge(scene), ...setupMusic(scene, camera));

setupProjector(scene);

createFeatureArt(scene);

setupAboutPage();

setupSeating(camera);

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
