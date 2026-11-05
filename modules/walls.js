import * as THREE from "three";
import { loadTexture, assign } from "./textureQuality.js";
import { ROOM, ROOM_CENTER_X, TUNNEL, SKY_LOUNGE_OPEN } from "./room.js";

const WALL = { width: 80, height: 20 }; // each wall, centred on the room

// A piece of the front wall from x0 to x1 and y0 to y1, its texture placed as on the whole wall, so the
// pieces round the Sky Lounge doorway (skyLounge.js) join without a seam
const frontWallPiece = (x0, x1, y0, y1, material) => {
  const geometry = new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.001);
  geometry.translate((x0 + x1) / 2, (y0 + y1) / 2, ROOM.front);
  const wallLeft = ROOM_CENTER_X - WALL.width / 2;
  const { position, uv } = geometry.attributes;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (position.getX(i) - wallLeft) / WALL.width, (position.getY(i) + WALL.height / 2) / WALL.height);
  }
  return new THREE.Mesh(geometry, material);
};

export function createWalls(scene, textureLoader) {
  let wallGroup = new THREE.Group();
  scene.add(wallGroup);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xadadae,
    side: THREE.DoubleSide,
  });
  const repeat = (texture) => (texture.wrapS = texture.wrapT = THREE.RepeatWrapping);
  loadTexture("leather_white_4k.gltf/textures/leather_white_nor_gl_4k.jpg", assign(wallMaterial, "normalMap", repeat), { color: false, normal: true });
  loadTexture("leather_white_4k.gltf/textures/leather_white_rough_4k.jpg", assign(wallMaterial, "roughnessMap", repeat), { color: false });
  // Front Wall, in three pieces round the doorway to the Sky Lounge tunnel at its left end (one piece while it's closed)
  const wallLeft = ROOM_CENTER_X - WALL.width / 2;
  const wallRight = ROOM_CENTER_X + WALL.width / 2;
  const frontWall = SKY_LOUNGE_OPEN
    ? [
        frontWallPiece(wallLeft, TUNNEL.left, -WALL.height / 2, WALL.height / 2, wallMaterial),
        frontWallPiece(TUNNEL.right, wallRight, -WALL.height / 2, WALL.height / 2, wallMaterial),
        frontWallPiece(TUNNEL.left, TUNNEL.right, TUNNEL.ceiling, WALL.height / 2, wallMaterial), // over the doorway
      ]
    : [frontWallPiece(wallLeft, wallRight, -WALL.height / 2, WALL.height / 2, wallMaterial)]; // closed: no doorway

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

  wallGroup.add(...frontWall, backWall, leftWall, rightWall);

  return wallGroup;
}
