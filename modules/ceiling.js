import * as THREE from "three";
import { loadTexture, assign } from "./textureQuality.js";
import { ROOM, ROOM_WIDTH, ROOM_DEPTH, ROOM_CENTER_X, ROOM_CENTER_Z } from "./room.js";

const SIZE = { x: ROOM_WIDTH + 1, z: ROOM_DEPTH };
const TILE_SCALE = { x: 45, z: 40 }; // the size the textures were made to cover, keeps the tiles that size

// create a function that takes a scene and a textureLoader as arguments that will be passed in from main.js where the createCeiling is called
export const createCeiling = (scene, textureLoader) => {
  const ceilingGeometry = new THREE.PlaneGeometry(SIZE.x, SIZE.z);
  const ceilingMaterial = new THREE.MeshLambertMaterial({
    normalMapType: THREE.NormalMap,
    side: THREE.DoubleSide,
  });

  // The textures, each put on as it arrives. Only the ones that show: a Lambert material has no metalness
  // or roughness, the ceiling is one flat plane (nothing for a displacement map to move), the ambient
  // occlusion map needs a second set of UVs the plane doesn't have, and the emission map only tints an
  // emissive colour it hasn't got.
  const tile = (texture) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(SIZE.x / TILE_SCALE.x, SIZE.z / TILE_SCALE.z);
  };
  loadTexture("OfficeCeiling005_4K-JPG/OfficeCeiling005_4K_Color.jpg", assign(ceilingMaterial, "map", tile));
  loadTexture("OfficeCeiling005_4K-JPG/OfficeCeiling005_4K_NormalGL.jpg", assign(ceilingMaterial, "normalMap", tile), { color: false, normal: true });
  const ceilingPlane = new THREE.Mesh(ceilingGeometry, ceilingMaterial);

  ceilingPlane.rotation.x = Math.PI / 2;

  ceilingPlane.position.set(ROOM_CENTER_X, ROOM.ceiling, ROOM_CENTER_Z);

  scene.add(ceilingPlane);
};
