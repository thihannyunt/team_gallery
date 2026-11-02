import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { FLOOR_Y, UNITS_PER_METER } from './paintingData.js';
import { COLORS, collider } from './badmintonDecor.js';

// Living-room corner facing the "Team Activities" projector screen on the right wall: a sofa, two
// armchairs turned toward the screen, a round coffee table and a rug. Modelled in meters, then
// scaled into scene units; built from simple shapes so it stays light on phones.

const SOFA = { x: 4.5, z: 0 }; // about 4.5 m back from the screen, the comfortable distance for its size
const ARMCHAIRS = [
  { x: 5.9, z: -6.2, turn: -0.45 }, // turned in toward the middle of the screen
  { x: 5.9, z: 6.2, turn: 0.45 },
];
const TABLE = { x: 9.1, z: 0 }; // leaves room to stand up in front of the sofa

const fabric = new THREE.MeshStandardMaterial({ color: 0x8c918d, roughness: 0.95 }); // warm grey
const accentFabric = new THREE.MeshStandardMaterial({ color: COLORS.teal, roughness: 0.9 });
const wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.7 });
const cushion = (width, height, depth, material) =>
  new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 3, Math.min(width, height, depth) * 0.3), material);

// A sofa (seats > 1) or armchair (seats = 1), seat facing +z, standing on y = 0
const createSeat = (seats, material) => {
  const seatWidth = 0.62;
  const armWidth = 0.18;
  const width = seats * seatWidth + 2 * armWidth;
  const depth = 0.9;
  const seat = new THREE.Group();

  const base = cushion(width, 0.26, depth, material);
  base.position.y = 0.1 + 0.13;
  seat.add(base);

  for (let i = 0; i < seats; i++) {
    const x = (i - (seats - 1) / 2) * seatWidth;
    const seatCushion = cushion(seatWidth - 0.02, 0.15, depth - 0.25, material);
    seatCushion.position.set(x, 0.43, 0.08);
    const backCushion = cushion(seatWidth - 0.03, 0.42, 0.2, material);
    backCushion.position.set(x, 0.68, -0.27);
    backCushion.rotation.x = -0.12; // leans back a little
    seat.add(seatCushion, backCushion);
  }

  const back = cushion(width, 0.5, 0.16, material);
  back.position.set(0, 0.6, -depth / 2 + 0.08);
  seat.add(back);

  [-1, 1].forEach((side) => {
    const arm = cushion(armWidth, 0.58, depth, material);
    arm.position.set(side * (width / 2 - armWidth / 2), 0.4, 0);
    seat.add(arm);
    [-1, 1].forEach((end) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.1, 10), wood);
      leg.position.set(side * (width / 2 - 0.06), 0.05, end * (depth / 2 - 0.06));
      seat.add(leg);
    });
  });

  seat.scale.setScalar(UNITS_PER_METER);
  // Where someone sits on each cushion, for seating.js
  const spots = Array.from({ length: seats }, (_, i) => new THREE.Vector3((i - (seats - 1) / 2) * seatWidth, 0, -0.02));
  return { seat, spots, width: width * UNITS_PER_METER, depth: depth * UNITS_PER_METER };
};

const createCoffeeTable = () => {
  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 40), wood);
  top.position.y = 0.42;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.38, 16), wood);
  stem.position.y = 0.2;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 32), wood);
  foot.position.y = 0.015;
  table.add(top, stem, foot);
  table.scale.setScalar(UNITS_PER_METER);
  return table;
};

const createRug = () => {
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8 * UNITS_PER_METER, 4.0 * UNITS_PER_METER), // clear of the court
    new THREE.MeshStandardMaterial({
      color: 0x9c9384, // warm taupe, softer than the white walls
      roughness: 1,
      polygonOffset: true, // keeps the rug from flickering against the wooden floor
      polygonOffsetFactor: -1,
    })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(SOFA.x + 2.6, FLOOR_Y + 0.02, SOFA.z);
  return rug;
};

// Every place to sit, filled in by createLounge: `position` on the floor under the sitter's hips and
// `facing`, the yaw of the way the seat faces
export const seats = [];

const addSeats = (furniture) => {
  furniture.seat.updateMatrixWorld();
  furniture.spots.forEach((spot) => {
    const position = furniture.seat.localToWorld(spot.clone());
    seats.push({ position, facing: furniture.seat.rotation.y });
  });
};

// Adds the lounge and returns its invisible colliders for main.js to add to the walls
export const createLounge = (scene) => {
  const colliders = [];
  const lounge = new THREE.Group();

  // Furniture faces +z when built; turning by π/2 faces it toward the screen on the right wall (+x)
  const sofa = createSeat(3, fabric);
  sofa.seat.position.set(SOFA.x, FLOOR_Y, SOFA.z);
  sofa.seat.rotation.y = Math.PI / 2;
  lounge.add(sofa.seat);
  addSeats(sofa);
  colliders.push(collider(SOFA.x, SOFA.z, sofa.depth, sofa.width));

  ARMCHAIRS.forEach(({ x, z, turn }) => {
    const chair = createSeat(1, accentFabric);
    chair.seat.position.set(x, FLOOR_Y, z);
    chair.seat.rotation.y = Math.PI / 2 + turn;
    lounge.add(chair.seat);
    addSeats(chair);
    colliders.push(collider(x, z, chair.depth, chair.depth));
  });

  const table = createCoffeeTable();
  table.position.set(TABLE.x, FLOOR_Y, TABLE.z);
  lounge.add(table, createRug());
  colliders.push(collider(TABLE.x, TABLE.z, 1.6, 1.6));

  scene.add(lounge);
  return colliders;
};
