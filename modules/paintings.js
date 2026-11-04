import * as THREE from 'three';

import { paintingData, wallLabelData } from './paintingData.js';
import { texturePath } from './textureQuality.js';

// Paintings are positioned 0.5 in front of the walls (room.js)
const WALL_OFFSET = -0.49;

// One thin frame profile everywhere (under 1 in at hanging scale); only the finish changes per wall
const FRAME_BORDER = 0.12;
const FRAME_DEPTH = 0.18;
const FRAME_BEVEL = 0.015;
const MAT_RATIO = 0.08; // minimum mat border, as a fraction of the frame's shorter edge

// Matte finishes only, so nothing glares under the spotlights
const frameMaterials = {
  oak: new THREE.MeshStandardMaterial({ color: 0xb08a5e, roughness: 0.75, metalness: 0 }), // natural wood
  black: new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.8, metalness: 0.3 }), // matte black metal
};
const matMaterial = new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 1 });

// A rectangular ring (outline with a hole) extruded with rounded bevels, so corners are mitered cleanly.
// `innerWidth`/`innerHeight` is the opening; the ring's back face sits at z = 0.
function createRing(innerWidth, innerHeight, border, depth, bevel, material) {
  // The bevel grows the solid outward on every edge, so compensate on both outlines
  const outerX = innerWidth / 2 + border - bevel;
  const outerY = innerHeight / 2 + border - bevel;
  const holeX = innerWidth / 2 + bevel;
  const holeY = innerHeight / 2 + bevel;

  const shape = new THREE.Shape();
  shape.moveTo(-outerX, -outerY);
  shape.lineTo(outerX, -outerY);
  shape.lineTo(outerX, outerY);
  shape.lineTo(-outerX, outerY);
  shape.lineTo(-outerX, -outerY);

  const hole = new THREE.Path();
  hole.moveTo(-holeX, -holeY);
  hole.lineTo(-holeX, holeY);
  hole.lineTo(holeX, holeY);
  hole.lineTo(holeX, -holeY);
  hole.lineTo(-holeX, -holeY);
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 1,
  });
  geometry.translate(0, 0, bevel);

  const ring = new THREE.Mesh(geometry, material);
  ring.castShadow = true;
  ring.receiveShadow = true;
  return ring;
}

// Matte card with the arrangement's title, hung beside it like museum wall text
function createWallLabel(title, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f7f5f0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1c1c1c';
  ctx.font = 'bold 56px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(title, 36, 76, canvas.width - 72);
  ctx.fillStyle = '#6b6b6b';
  ctx.font = '32px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(subtitle, 36, 136, canvas.width - 72);

  const cardMaterial = new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 1 });
  const label = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.03), [
    cardMaterial, cardMaterial, cardMaterial, cardMaterial, // sides
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas), roughness: 1 }), // front
    cardMaterial, // back
  ]);
  label.position.z = WALL_OFFSET + 0.015;
  label.castShadow = true;
  return label;
}

// Wraps `text` onto lines no wider than `maxWidth`, at most `maxLines` (the last one ends in …)
function wrapText(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width <= maxWidth || !line) {
      line = attempt;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, '')}…`;
  }
  return lines;
}

const NAME_CARD_HEIGHT = 1.7;
const NAME_CARD_GAP = 0.25; // between the frame and the card below it

// Card under a teammate's portrait: name, role, their quote and portfolio site
function createNameCard(person, width) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = Math.round((canvas.width * NAME_CARD_HEIGHT) / width);
  const ctx = canvas.getContext('2d');
  const pad = 36;
  const textWidth = canvas.width - 2 * pad;
  const font = 'Manrope, "Helvetica Neue", Arial, sans-serif';

  const draw = () => {
    ctx.fillStyle = '#f7f5f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#d0eb00';
    ctx.fillRect(0, 0, 10, canvas.height); // brand accent down the left edge

    ctx.textBaseline = 'top';
    let y = pad - 4;
    ctx.fillStyle = '#1c1c1c';
    ctx.font = `800 52px ${font}`;
    ctx.fillText(person.name, pad, y, textWidth);
    y += 64;
    ctx.fillStyle = '#024b4a';
    ctx.font = `700 34px ${font}`;
    ctx.fillText(person.role.toUpperCase(), pad, y, textWidth);
    y += 52;
    ctx.fillStyle = '#5b5b5b';
    ctx.font = `italic 500 32px ${font}`;
    wrapText(ctx, `“${person.quote}”`, textWidth, 2).forEach((line) => {
      ctx.fillText(line, pad, y);
      y += 40;
    });
    if (person.portfolio) {
      ctx.fillStyle = '#024b4a';
      ctx.font = `700 32px ${font}`;
      const site = person.portfolio.replace(/^https?:\/\//, '').replace(/\/$/, '');
      ctx.fillText(`${site} ↗`, pad, canvas.height - pad - 32, textWidth);
    }
  };
  draw();

  const cardMaterial = new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 1 });
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  // The brand font may still be loading; redraw once it's in so the card doesn't keep the fallback
  document.fonts?.load('800 44px Manrope').then(() => {
    draw();
    texture.needsUpdate = true;
  });
  const card = new THREE.Mesh(new THREE.BoxGeometry(width, NAME_CARD_HEIGHT, 0.03), [
    cardMaterial, cardMaterial, cardMaterial, cardMaterial, // sides
    new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }), // front
    cardMaterial, // back
  ]);
  card.position.z = WALL_OFFSET + 0.015;
  return card;
}

export function createPaintings(scene, textureLoader) {

  let paintings = [];

  paintingData.forEach((data) => {
    const painting = new THREE.Group();

    // `data.width`/`data.height` is the frame's outer size; the mat fills the opening inside it
    const openingWidth = data.width - 2 * FRAME_BORDER;
    const openingHeight = data.height - 2 * FRAME_BORDER;
    const matBorder = MAT_RATIO * Math.min(data.width, data.height);

    // Fit the photo inside the mat without stretching; the mat absorbs any difference in aspect ratio
    const areaWidth = openingWidth - 2 * matBorder;
    const areaHeight = openingHeight - 2 * matBorder;
    const fitsWidth = data.aspect > areaWidth / areaHeight;
    const photoWidth = fitsWidth ? areaWidth : areaHeight * data.aspect;
    const photoHeight = fitsWidth ? areaWidth / data.aspect : areaHeight;

    // Photo, recessed behind the frame. Unlit, because the combined room lights are brighter than 1 and
    // would clip light photo backgrounds to white, blending them into the mat so the photo edges vanish.
    const photoTexture = textureLoader.load(texturePath(data.imgSrc));
    photoTexture.anisotropy = 8; // stays sharp when seen at an angle along the wall
    const photo = new THREE.Mesh(
      new THREE.PlaneGeometry(photoWidth, photoHeight),
      new THREE.MeshBasicMaterial({ map: photoTexture })
    );
    photo.position.z = WALL_OFFSET + 0.03;

    // Mat board extends under the frame so no gaps show at the edges
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(openingWidth + 0.08, openingHeight + 0.08), matMaterial);
    mat.position.z = WALL_OFFSET + 0.02;
    mat.receiveShadow = true;

    const frame = createRing(
      openingWidth,
      openingHeight,
      FRAME_BORDER,
      FRAME_DEPTH,
      FRAME_BEVEL,
      frameMaterials[data.frame]
    );
    frame.position.z = WALL_OFFSET;

    painting.add(mat, photo, frame);

    // Part of the painting, so clicking the card opens the portrait (with the portfolio link) too
    if (data.nameCard) {
      const card = createNameCard(data.nameCard, data.width);
      card.position.y = -data.height / 2 - NAME_CARD_GAP - NAME_CARD_HEIGHT / 2;
      painting.add(card);
    }

    painting.position.set(data.position.x, data.position.y, data.position.z);
    painting.rotation.y = data.rotationY;


    painting.userData = {
      type: 'painting',
      info: data.info,
      url: data.info.link,
      photo, // paintingDetail.js swaps in the full-size photo up close on phones
      imgSrc: data.imgSrc,
    };

    paintings.push(painting);
  });

  wallLabelData.forEach((data) => {
    const label = new THREE.Group();
    label.add(createWallLabel(data.title, data.subtitle));
    label.position.set(data.position.x, data.position.y, data.position.z);
    label.rotation.y = data.rotationY;
    label.scale.set(data.scale, data.scale, 1); // bigger card, still flat on the wall
    scene.add(label);
  });

  return paintings;
}
