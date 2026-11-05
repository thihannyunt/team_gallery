import * as THREE from 'three';

// A soft pool of coloured light painted onto a flat surface, instead of a real light. three.js shades
// every lit surface in the gallery with every light, wherever it is, so each small lamp cost frame rate
// everywhere: on a Retina screen the projector's area light and three point lights (arcade, bar, racing
// sim) took the gallery from about 95 fps down to 42. A painted glow only costs the pixels it covers.

const gradients = {};

// White fading to clear: 'round' from the middle out; 'wash' from one long edge (the wall) out into
// the room, softened at both ends
const gradientTexture = (shape) => {
  if (gradients[shape]) return gradients[shape];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (shape === 'round') {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.45)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  } else {
    const away = ctx.createLinearGradient(0, 0, 0, 128); // top edge against the wall
    away.addColorStop(0, 'rgba(255, 255, 255, 1)');
    away.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
    away.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = away;
    ctx.fillRect(0, 0, 128, 128);
    const ends = ctx.createLinearGradient(0, 0, 128, 0);
    ends.addColorStop(0, 'rgba(0, 0, 0, 0)');
    ends.addColorStop(0.2, 'rgba(0, 0, 0, 1)');
    ends.addColorStop(0.8, 'rgba(0, 0, 0, 1)');
    ends.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = ends;
    ctx.fillRect(0, 0, 128, 128);
  }
  gradients[shape] = new THREE.CanvasTexture(canvas);
  return gradients[shape];
};

// A glow `width` x `depth` lying flat (face up), `strength` 0 to 1. Position and turn it as needed; its
// material's colour can change later (the projector's follows the slide on screen).
export const createGlow = (color, width, depth, strength, shape = 'round') => {
  const material = new THREE.MeshBasicMaterial({
    map: gradientTexture(shape),
    color,
    transparent: true,
    opacity: strength,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true, // drawn over the surface it lies on without flickering
    polygonOffsetFactor: -2,
  });
  material.userData.colorTuned = true; // its strength is set here already (colorSettings.js)
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  glow.rotation.x = -Math.PI / 2;
  glow.renderOrder = 1; // after the floor and counter under it
  return glow;
};

// A faint cone of light in the air, as a lamp's beam shows in a dim room: `lensRadius` at the lamp,
// `spreadRadius` where it lands, `length` long. Built hanging down from the lamp at its origin; turn it
// over for a lamp shining up. Soft at its edges, brightest near the lamp, fading out where it lands.
export const createLightCone = (color, lensRadius, spreadRadius, length, strength) => {
  const geometry = new THREE.CylinderGeometry(lensRadius, spreadRadius, length, 32, 1, true);
  geometry.translate(0, -length / 2, 0); // lamp at the origin; uv.y is 1 there and 0 where it lands
  const material = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, strength: { value: strength } },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vToEye;
      void main() {
        vAlong = uv.y;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vToEye = -viewPosition.xyz;
        vNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float strength;
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vToEye;
      void main() {
        // Faces seen side on are the cone's edges: fade them, so it reads as a soft volume of light
        float facing = abs(dot(normalize(vNormal), normalize(vToEye)));
        float fade = pow(facing, 1.6) * (0.3 + 0.7 * vAlong) * smoothstep(0.0, 0.18, vAlong);
        gl_FragColor = vec4(color * strength * fade, 1.0);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(geometry, material);
  cone.renderOrder = 2; // after the glows on the surfaces under it
  return cone;
};
