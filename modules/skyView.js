import * as THREE from 'three';

// The view from the Sky Lounge's windows (skyLounge.js), 60 floors up: painted by a shader on the inside of
// a big sphere round the lounge, so there is nothing to download. Seen from the tunnel, the right side is
// land: snowy mountains with a waterfall dropping into a forest valley and a river winding to the coast,
// the sun setting over the ridges; the left side is the ocean with islands out to the horizon. Clouds
// drift, the waterfall runs and the sea moves. Looking down past the window sills shows the ground far
// below, which is what sells the height.
//
// The sphere is drawn after everything solid (renderOrder), so wherever a wall is in front of it the GPU
// skips it; in the gallery itself that's everywhere.

const RADIUS = 600; // well inside the camera's far plane (1000) from anywhere in the gallery

const vertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position; // the sphere sits at the lounge's centre, unrotated
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying vec3 vDirection;

  const float PI = 3.14159265;
  // Azimuth is measured from straight ahead out of the tunnel (-z), positive to the right (+x)
  const float SUN_AZ = 0.62;
  const float SUN_EL = 0.05;
  const float FALLS_AZ = 1.05; // the waterfall, on the near ridge to the right
  const vec3 HORIZON = vec3(1.0, 0.62, 0.38);

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 sunDirection() {
    return vec3(sin(SUN_AZ) * cos(SUN_EL), sin(SUN_EL), -cos(SUN_AZ) * cos(SUN_EL));
  }

  // The sky in direction d: a sunset gradient, the sun and its glow, rays and lit clouds
  vec3 sky(vec3 d, float az, float el) {
    vec3 sun = sunDirection();
    float toSun = max(dot(d, sun), 0.0);
    float h = max(el, 0.0);
    vec3 color = mix(HORIZON, vec3(0.62, 0.47, 0.62), smoothstep(0.0, 0.2, h));
    color = mix(color, vec3(0.17, 0.24, 0.47), smoothstep(0.16, 0.75, h));
    // Cooler and dimmer away from the sun, over the sea
    float sunSide = smoothstep(-0.3, 1.0, dot(normalize(d.xz), normalize(sun.xz)));
    color = mix(color * vec3(0.72, 0.78, 1.05), color, sunSide);
    color += vec3(1.0, 0.5, 0.22) * pow(toSun, 6.0) * 0.55;
    color += vec3(1.0, 0.78, 0.5) * pow(toSun, 60.0) * 0.9;
    color = mix(color, vec3(1.0, 0.96, 0.82), smoothstep(0.99935, 0.99965, toSun)); // the sun's disc

    // Rays fanning out from the sun
    vec2 fromSun = vec2(az - SUN_AZ, el - SUN_EL);
    float angle = atan(fromSun.y, fromSun.x);
    float rays = pow(noise(vec2(angle * 7.0, uTime * 0.04)), 3.0) * exp(-length(fromSun) * 2.6) * step(0.0, fromSun.y + 0.02);
    color += vec3(1.0, 0.8, 0.5) * rays * 0.4;

    // Clouds on a layer overhead, thinning toward the horizon
    if (el > 0.0) {
      vec2 uv = d.xz / (d.y + 0.07);
      float c = fbm(uv * 0.9 + vec2(uTime * 0.006, uTime * 0.002));
      float cloud = smoothstep(0.52, 0.82, c) * smoothstep(0.01, 0.1, el);
      vec3 lit = mix(vec3(0.93, 0.52, 0.55), vec3(1.0, 0.78, 0.5), pow(toSun, 3.0));
      vec3 shade = mix(vec3(0.42, 0.32, 0.46), lit, smoothstep(0.5, 0.75, c));
      color = mix(color, shade, cloud * 0.8);
    }
    return color;
  }

  // Haze: everything thickens toward the horizon colour with distance
  vec3 haze(vec3 color, vec3 d, float amount) {
    vec3 tint = mix(vec3(0.62, 0.6, 0.72), HORIZON, smoothstep(-0.3, 1.0, dot(normalize(d.xz), normalize(sunDirection().xz))));
    return mix(color, tint, clamp(amount, 0.0, 1.0));
  }

  // Islands out to sea on the left: their height above the horizon at azimuth az
  float islands(float az) {
    float h = 0.0;
    h = max(h, 0.013 * pow(max(0.0, 1.0 - abs(az + 0.38) / 0.07), 0.6));
    h = max(h, 0.022 * pow(max(0.0, 1.0 - abs(az + 0.8) / 0.12), 0.7));
    h = max(h, 0.009 * pow(max(0.0, 1.0 - abs(az + 1.15) / 0.05), 0.5));
    h = max(h, 0.03 * pow(max(0.0, 1.0 - abs(az + 1.75) / 0.16), 0.8));
    h = max(h, 0.016 * pow(max(0.0, 1.0 - abs(az + 2.35) / 0.09), 0.6));
    return h * (0.85 + 0.3 * noise(vec2(az * 60.0, 2.0)));
  }

  // Distance from p to the segment ab
  float segment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
  }

  void main() {
    vec3 d = normalize(vDirection);
    float az = atan(d.x, -d.z);
    float el = asin(clamp(d.y, -1.0, 1.0));
    vec3 sun = sunDirection();

    // Land to the right, sea to the left; the coastline runs out just right of straight ahead
    float land = smoothstep(0.02, 0.26, az + 0.06 * (noise(vec2(az * 9.0, 4.0)) - 0.5));

    vec3 color = sky(d, az, el);

    // Islands above the horizon (sea side)
    float island = islands(az) * (1.0 - land);
    if (el > 0.0 && el < island) {
      vec3 green = mix(vec3(0.14, 0.24, 0.2), vec3(0.45, 0.36, 0.3), smoothstep(-0.5, 1.2, d.x)); // sunlit edge warmer
      color = haze(green, d, 0.45 + 12.0 * el);
      color = mix(color, vec3(0.86, 0.72, 0.56), smoothstep(0.0015, 0.0, el) * 0.7); // a thin beach
    }

    // Mountains: a far snowy range and a near forested ridge with the waterfall
    float far = (0.05 + 0.17 * fbm(vec2(az * 2.2, 1.3))) * smoothstep(0.0, 0.45, az) * land;
    float near = (0.02 + 0.09 * fbm(vec2(az * 4.6 + 7.0, 3.1))) * smoothstep(0.12, 0.5, az) * land;
    near += 0.035 * exp(-pow((az - FALLS_AZ) / 0.09, 2.0)) * land; // the cliff the waterfall drops from
    float facingSun = pow(max(dot(normalize(d.xz), normalize(sun.xz)), 0.0), 3.0);
    if (el < far && el > -0.01) {
      vec3 rock = mix(vec3(0.38, 0.34, 0.5), vec3(0.78, 0.5, 0.45), facingSun * 0.6);
      rock *= 0.8 + 0.4 * fbm(vec2(az * 40.0, el * 70.0));
      float snow = smoothstep(far - 0.035, far - 0.012, el) * smoothstep(0.12, 0.17, far);
      rock = mix(rock, vec3(1.0, 0.82, 0.78), snow * 0.85);
      rock += vec3(1.0, 0.6, 0.3) * smoothstep(far - 0.004, far, el) * facingSun * 0.5; // sunlit rim
      color = haze(rock, d, 0.35);
    }
    if (el < near && el > -0.035) {
      vec3 ridge = mix(vec3(0.1, 0.17, 0.12), vec3(0.32, 0.3, 0.18), facingSun * 0.5);
      ridge *= 0.75 + 0.5 * fbm(vec2(az * 70.0, el * 90.0));
      ridge += vec3(0.9, 0.5, 0.2) * smoothstep(near - 0.005, near, el) * facingSun * 0.35;
      // Bare grey rock either side of the waterfall
      float cliff = exp(-pow((az - FALLS_AZ) / 0.035, 2.0));
      vec3 rockFace = vec3(0.3, 0.29, 0.3) * (0.7 + 0.6 * fbm(vec2(az * 160.0, el * 120.0)));
      ridge = mix(ridge, rockFace, cliff * 0.85);
      color = haze(ridge, d, 0.18);
    }

    // Below the horizon: the ground (or sea) far below, by where the view ray meets it
    if (el < 0.0) {
      float distance = 1.0 / max(-d.y, 0.002); // in units of the height we look down from
      vec2 ground = d.xz * distance;
      float fade = 1.0 - exp(-distance * 0.05);
      // The coastline wanders a little in ground space, so the shore curves away below the windows
      float coastAz = 0.14 + 0.25 * (fbm(ground * 0.15) - 0.5);
      float isLand = smoothstep(-0.015, 0.015, az - coastAz);

      // Forest valley: canopy in clumps (fine detail fading with distance, so it doesn't shimmer),
      // meadows in the clearings, and the river from the falls down to the sea
      float detail = smoothstep(45.0, 8.0, distance);
      float trees = fbm(ground * 0.35) * 0.5 + fbm(ground * 2.2) * 0.3 * (0.4 + 0.6 * detail) + noise(ground * 12.0) * 0.2 * detail;
      vec3 forest = mix(vec3(0.03, 0.09, 0.05), vec3(0.2, 0.3, 0.11), smoothstep(0.25, 0.75, trees));
      float meadow = smoothstep(0.6, 0.66, fbm(ground * 0.12 + vec2(5.0, 2.0)));
      forest = mix(forest, vec3(0.42, 0.45, 0.2), meadow * 0.7);
      forest += vec3(0.55, 0.32, 0.12) * facingSun * 0.3 * smoothstep(0.45, 0.8, trees); // sunlit crowns
      // From the plunge pool under the falls (about 1/0.016 heights away) down to the coast
      vec2 falls = vec2(sin(FALLS_AZ), -cos(FALLS_AZ)) * 62.0;
      float river = min(segment(ground, falls, vec2(36.0, -40.0)), min(segment(ground, vec2(36.0, -40.0), vec2(18.0, -37.0)), segment(ground, vec2(18.0, -37.0), vec2(6.0, -42.0))));
      float riverWidth = 0.25 + 0.012 * distance;
      forest = mix(forest, mix(HORIZON, vec3(0.55, 0.6, 0.75), 0.4), smoothstep(riverWidth, riverWidth * 0.4, river));
      forest = haze(forest, d, fade);

      // The sea: sky reflections broken up by waves, darker straight down, glints toward the sunset
      vec2 waveUv = ground * vec2(1.6, 0.8);
      float waves = noise(waveUv * 1.5 + vec2(0.0, uTime * 0.35)) + 0.5 * noise(waveUv * 4.0 - vec2(uTime * 0.25, 0.0));
      vec3 reflected = sky(vec3(d.x, -d.y, d.z) + vec3(0.0, (waves - 0.75) * 0.03, 0.0), az, -el);
      float fresnel = pow(1.0 - min(-d.y * 1.6, 1.0), 4.0);
      vec3 sea = mix(vec3(0.03, 0.12, 0.2), reflected, 0.25 + 0.75 * fresnel);
      sea += vec3(1.0, 0.75, 0.5) * smoothstep(0.93, 1.0, noise(ground * 9.0 + uTime * 0.6)) * fresnel * 0.6;
      // Islands nearer in, seen from above: green tops ringed with sand and shallows
      float isle = fbm(ground * 0.22 + vec2(3.7, 1.9)) * smoothstep(-0.1, -0.35, az);
      vec3 isleColor = mix(vec3(0.42, 0.62, 0.6), vec3(0.85, 0.75, 0.58), smoothstep(0.62, 0.64, isle));
      isleColor = mix(isleColor, vec3(0.12, 0.26, 0.14) * (0.8 + 0.4 * noise(ground * 6.0)), smoothstep(0.655, 0.67, isle));
      sea = mix(sea, isleColor, smoothstep(0.6, 0.62, isle) * smoothstep(60.0, 20.0, distance));
      // Reflections of the far islands just under the horizon
      float mirrored = islands(az) * (1.0 - land);
      sea = mix(sea, vec3(0.1, 0.16, 0.18), step(-el, mirrored * 0.6) * 0.5 * (0.7 + 0.3 * waves));
      sea = haze(sea, d, fade * 0.8);

      // The near ridge's foot stands in front of the valley floor
      if (!(el < near && el > -0.035)) color = mix(sea, forest, isLand);
    }

    // The waterfall: from just under the cliff's crest down to a plunge pool at the valley floor,
    // widening as it falls, white water streaming down it
    float fallTop = near - 0.004;
    float fallen = clamp((fallTop - el) / (fallTop + 0.016), 0.0, 1.0);
    float across = (az - FALLS_AZ) / (0.012 + 0.01 * fallen);
    if (abs(across) < 1.0 && el < fallTop && el > -0.016) {
      // Streams of white water with darker gaps, see-through at the edges
      float streams = noise(vec2(across * 6.0, 0.0)) * 0.5 + 0.5;
      float flow = noise(vec2(across * 5.0, el * 220.0 + uTime * 6.0)) * 0.6 + noise(vec2(across * 12.0, el * 480.0 + uTime * 10.0)) * 0.4;
      vec3 water = mix(vec3(0.5, 0.58, 0.64), vec3(0.97, 0.95, 0.93), smoothstep(0.3, 0.8, flow * streams + 0.25 * fallen));
      water += vec3(0.6, 0.35, 0.15) * facingSun * 0.18; // catching the sunset
      float cover = smoothstep(1.0, 0.35, abs(across)) * (0.5 + 0.45 * smoothstep(0.2, 0.7, flow));
      color = mix(color, haze(water, d, 0.15), cover);
    }
    // Spray and mist billowing round its foot
    vec2 foot = vec2((az - FALLS_AZ) / 0.035, (el + 0.014) / 0.012);
    float mist = exp(-dot(foot, foot)) * (0.75 + 0.25 * noise(foot * 3.0 + uTime * 0.8));
    color = mix(color, vec3(0.95, 0.9, 0.9), mist * 0.75);

    gl_FragColor = vec4(color, 1.0);
  }
`;

let material;

export const createSkyView = (center) => {
  material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 64, 32), material);
  sphere.position.copy(center);
  sphere.renderOrder = 1000; // after the solid scene, before the window glass
  sphere.frustumCulled = false;
  return sphere;
};

// Called every frame from the render loop
export const updateSkyView = (delta) => {
  if (material) material.uniforms.uTime.value += delta;
};
