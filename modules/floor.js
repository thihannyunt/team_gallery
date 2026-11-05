import * as THREE from "three";
import { loadTexture, assign } from "./textureQuality.js";
import { ROOM_WIDTH, ROOM_CENTER_X, ROOM_CENTER_Z } from "./room.js";

const SIZE = { x: ROOM_WIDTH + 2, z: 45 }; // a little past the walls
const PLANK_SCALE = 45; // the textures were made to cover 45 units, keep their planks that size

export const setupFloor = (scene) => {
  const planeGeometry = new THREE.PlaneGeometry(SIZE.x, SIZE.z);
  const planeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });

  // The textures, each put on as it arrives. Only the ones that show: the floor is one flat plane, so a
  // displacement map has no vertices to move, and the ambient occlusion map needs a second set of UVs
  // the plane doesn't have.
  const tile = (texture) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(SIZE.x / PLANK_SCALE, SIZE.z / PLANK_SCALE);
    texture.anisotropy = 8; // the floor is mostly seen at a low angle
  };
  loadTexture("WoodFloor040_4K-JPG/WoodFloor040_4K_Color.jpg", assign(planeMaterial, "map", tile));
  loadTexture("WoodFloor040_4K-JPG/WoodFloor040_4K_NormalGL.jpg", assign(planeMaterial, "normalMap", tile), { color: false, normal: true });
  loadTexture("WoodFloor040_4K-JPG/WoodFloor040_4K_Roughness.jpg", assign(planeMaterial, "roughnessMap", tile), { color: false });

  const floorPlane = new THREE.Mesh(planeGeometry, planeMaterial);

  floorPlane.rotation.x = Math.PI / 2;
  floorPlane.position.set(ROOM_CENTER_X, -Math.PI, ROOM_CENTER_Z);

  scene.add(floorPlane);
};
