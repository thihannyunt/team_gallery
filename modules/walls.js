import * as THREE from "three";
import { texturePath } from "./textureQuality.js";
import { ROOM, ROOM_CENTER_X } from "./room.js";

export function createWalls(scene, textureLoader) {
  let wallGroup = new THREE.Group();
  scene.add(wallGroup);

  const normalTexture = textureLoader.load(
    texturePath("leather_white_4k.gltf/textures/leather_white_nor_gl_4k.jpg")
  );
  const roughnessTexture = textureLoader.load(
    texturePath("leather_white_4k.gltf/textures/leather_white_rough_4k.jpg")
  );

  normalTexture.wrapS = normalTexture.wrapT = THREE.RepeatWrapping;
  roughnessTexture.wrapS = roughnessTexture.wrapT = THREE.RepeatWrapping;

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xadadae,
    normalMap: normalTexture,
    roughnessMap: roughnessTexture,
    side: THREE.DoubleSide,
  });
  // Front Wall
  const frontWall = new THREE.Mesh( 
    new THREE.BoxGeometry(80, 20, 0.001), 
    wallMaterial 
  );

  frontWall.position.set(ROOM_CENTER_X, 0, ROOM.front); 

  // Left Wall
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(80, 20, 0.001), 
    wallMaterial
  );

  leftWall.rotation.y = Math.PI / 2; 
  leftWall.position.x = ROOM.left; // moved out for the piano salon (room.js)

  // Right Wall
  const rightWall = new THREE.Mesh( 
    new THREE.BoxGeometry(80, 20, 0.001), 
    wallMaterial
  );

  rightWall.position.x = ROOM.right;
  rightWall.rotation.y = Math.PI / 2; 

  // Back Wall
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(80, 20, 0.001),
    wallMaterial 
  );
  backWall.position.set(ROOM_CENTER_X, 0, ROOM.back);

  wallGroup.add(frontWall, backWall, leftWall, rightWall);

  return wallGroup;
}
