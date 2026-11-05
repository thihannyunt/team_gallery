import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Joins every mesh under `root` that shares a material into one mesh, so furniture and plants built from
// dozens of small parts cost one draw call per material instead of one per part. Only for things that
// never move afterwards. Lights, the sky and anything with userData.keepSeparate are left alone.
export const mergeStatic = (root, { opaqueOnly = false } = {}) => {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const byMaterial = new Map();
  root.traverse((mesh) => {
    if (!mesh.isMesh || Array.isArray(mesh.material) || mesh.material.isShaderMaterial) return;
    // Moving/hidden groups must keep their children, too (steering wheel, driver seat).
    for (let node = mesh; node && node !== root.parent; node = node.parent) {
      if (node.userData.keepSeparate) return;
    }
    // Glass needs individual depth sorting; only batch opaque parts when requested.
    if (opaqueOnly && mesh.material.transparent) return;
    if (!byMaterial.has(mesh.material)) byMaterial.set(mesh.material, []);
    byMaterial.get(mesh.material).push(mesh);
  });

  byMaterial.forEach((meshes, material) => {
    if (meshes.length < 2) return;
    const geometries = meshes.map((mesh) => {
      // Same attributes on every part, unindexed, placed where the part stands
      let geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      Object.keys(geometry.attributes).forEach((name) => {
        if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
      });
      if (!geometry.attributes.uv) {
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
      }
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld));
      return geometry;
    });
    const merged = new THREE.Mesh(mergeGeometries(geometries), material);
    merged.castShadow = meshes.some((mesh) => mesh.castShadow);
    merged.receiveShadow = meshes.some((mesh) => mesh.receiveShadow);
    merged.renderOrder = meshes[0].renderOrder;
    geometries.forEach((geometry) => geometry.dispose());
    meshes.forEach((mesh) => mesh.removeFromParent());
    root.add(merged);
  });
  return root;
};
