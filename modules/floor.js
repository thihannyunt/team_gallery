import * as THREE from "three";
import { texturePath } from "./textureQuality.js";
import { ROOM_WIDTH, ROOM_CENTER_X, ROOM_CENTER_Z } from "./room.js";

const SIZE = { x: ROOM_WIDTH + 2, z: 45 }; // a little past the walls
const PLANK_SCALE = 45; // the textures were made to cover 45 units, keep their planks that size
import floortTexture from "../public/WoodFloor040_4K-JPG/WoodFloor040_4K_Color.jpg";

export const setupFloor = (scene) => {
  const textureLoader = new THREE.TextureLoader();

  // Load the textures
  const colorTexture = textureLoader.load(
    texturePath("WoodFloor040_4K-JPG/WoodFloor040_4K_Color.jpg")
  );
  const displacementTexture = textureLoader.load(
    texturePath("WoodFloor040_4K-JPG/WoodFloor040_4K_Displacement.jpg")
  );
  const normalTexture = textureLoader.load(
    texturePath("WoodFloor040_4K-JPG/WoodFloor040_4K_NormalGL.jpg")
  );
  const roughnessTexture = textureLoader.load(
    texturePath("WoodFloor040_4K-JPG/WoodFloor040_4K_Roughness.jpg")
  );
  const aoTexture = textureLoader.load(
    texturePath("WoodFloor040_4K-JPG/WoodFloor040_4K_AmbientOcclusion.jpg")
  );

  // Set texture parameters
  colorTexture.wrapS = colorTexture.wrapT = THREE.RepeatWrapping;
  displacementTexture.wrapS = displacementTexture.wrapT = THREE.RepeatWrapping;
  normalTexture.wrapS = normalTexture.wrapT = THREE.RepeatWrapping;
  roughnessTexture.wrapS = roughnessTexture.wrapT = THREE.RepeatWrapping;
  aoTexture.wrapS = aoTexture.wrapT = THREE.RepeatWrapping;
  [colorTexture, displacementTexture, normalTexture, roughnessTexture, aoTexture].forEach((texture) =>
    texture.repeat.set(SIZE.x / PLANK_SCALE, SIZE.z / PLANK_SCALE)
  );

  const planeGeometry = new THREE.PlaneGeometry(SIZE.x, SIZE.z);
  const planeMaterial = new THREE.MeshStandardMaterial({
    map: colorTexture,
    displacementMap: displacementTexture,
    normalMap: normalTexture,
    roughnessMap: roughnessTexture,
    aoMap: aoTexture,
    displacementScale: 0.1,
    side: THREE.DoubleSide,
  });

  const floorPlane = new THREE.Mesh(planeGeometry, planeMaterial);

  floorPlane.rotation.x = Math.PI / 2;
  floorPlane.position.set(ROOM_CENTER_X, -Math.PI, ROOM_CENTER_Z);

  scene.add(floorPlane);
};
