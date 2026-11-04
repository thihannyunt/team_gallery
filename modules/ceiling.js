import * as THREE from "three";
import { texturePath } from "./textureQuality.js";
import { ROOM, ROOM_WIDTH, ROOM_DEPTH, ROOM_CENTER_X, ROOM_CENTER_Z } from "./room.js";

const SIZE = { x: ROOM_WIDTH + 1, z: ROOM_DEPTH };
const TILE_SCALE = { x: 45, z: 40 }; // the size the textures were made to cover, keeps the tiles that size

// create a function that takes a scene and a textureLoader as arguments that will be passed in from main.js where the createCeiling is called
export const createCeiling = (scene, textureLoader) => {
  // Load the textures
  const colorTexture = textureLoader.load(
    texturePath("OfficeCeiling005_4K-JPG/OfficeCeiling005_4K_Color.jpg")
  );
  const displacementTexture = textureLoader.load(
    texturePath("OfficeCeiling005_4K-JPG/OfficeCeiling005_4K_Displacement.jpg")
  );
  const aoTexture = textureLoader.load(
    texturePath("OfficeCeiling005_4K-JPG/OfficeCeiling005_4K_AmbientOcclusion.jpg")
  );
  const emissionTexture = textureLoader.load(
    texturePath("OfficeCeiling005_4K-JPG/OfficeCeiling005_4K_Emission.jpg")
  );
  const metalnessTexture = textureLoader.load(
    texturePath("OfficeCeiling005_4K-JPG/OfficeCeiling005_4K_Metalness.jpg")
  );
  const normalGLTexture = textureLoader.load(
    texturePath("OfficeCeiling005_4K-JPG/OfficeCeiling005_4K_NormalGL.jpg")
  );
  const roughnessTexture = textureLoader.load(
    texturePath("OfficeCeiling005_4K-JPG/OfficeCeiling005_4K_Roughness.jpg")
  );

  // Set texture parameters
  colorTexture.wrapS = colorTexture.wrapT = THREE.RepeatWrapping;
  displacementTexture.wrapS = displacementTexture.wrapT = THREE.RepeatWrapping;
  aoTexture.wrapS = aoTexture.wrapT = THREE.RepeatWrapping;
  emissionTexture.wrapS = emissionTexture.wrapT = THREE.RepeatWrapping;
  metalnessTexture.wrapS = metalnessTexture.wrapT = THREE.RepeatWrapping;
  normalGLTexture.wrapS = normalGLTexture.wrapT = THREE.RepeatWrapping;
  roughnessTexture.wrapS = roughnessTexture.wrapT = THREE.RepeatWrapping;
  [colorTexture, displacementTexture, aoTexture, emissionTexture, metalnessTexture, normalGLTexture, roughnessTexture].forEach(
    (texture) => texture.repeat.set(SIZE.x / TILE_SCALE.x, SIZE.z / TILE_SCALE.z)
  );

  const ceilingGeometry = new THREE.PlaneGeometry(SIZE.x, SIZE.z);
  const ceilingMaterial = new THREE.MeshLambertMaterial({
    map: colorTexture,
    displacementMap: displacementTexture,
    aoMap: aoTexture,
    emissiveMap: emissionTexture,
    metalnessMap: metalnessTexture,
    normalMap: normalGLTexture,
    normalMapType: THREE.NormalMap,
    roughnessMap: roughnessTexture,
    displacementScale: 0.1,
    side: THREE.DoubleSide,
  });
  const ceilingPlane = new THREE.Mesh(ceilingGeometry, ceilingMaterial);

  ceilingPlane.rotation.x = Math.PI / 2;

  ceilingPlane.position.set(ROOM_CENTER_X, ROOM.ceiling, ROOM_CENTER_Z);

  scene.add(ceilingPlane);
};
