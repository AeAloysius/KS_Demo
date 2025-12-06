// Checkpoint.js
// 简单的检查点系统：球体表示，按 E 交互后变色并记录复活点
import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const COLOR_IDLE = 0x5555aa;
const COLOR_ACTIVE = 0x55aa55;
const INTERACT_RADIUS = 2.5;

export function getCheckpointInteractRadius() {
  return INTERACT_RADIUS;
}

const checkpoints = [];
let lastActivated = null;

// 避开现有建筑物的检查点位置
const DEFAULT_POINTS = [
  new THREE.Vector3(0, 0, -3),    // 中央稍前
  new THREE.Vector3(12, 0, -6),   // 右侧空地
  new THREE.Vector3(-14, 0, -6),  // 左侧空地
];

export function initCheckpoints(scene) {
  clearCheckpoints(scene);

  const geo = new THREE.SphereGeometry(0.5, 16, 16);

  for (const pos of DEFAULT_POINTS) {
    const mat = new THREE.MeshStandardMaterial({ color: COLOR_IDLE, emissive: 0x111122 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.position.y = 0.5;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 只作为视觉检查点，不参与任何碰撞 / 射线交互
    mesh.raycast = () => {};

    scene.add(mesh);
    checkpoints.push({ mesh, activated: false });
  }
}

export function clearCheckpoints(scene) {
  for (const cp of checkpoints) {
    if (cp.mesh && cp.mesh.parent === scene) scene.remove(cp.mesh);
  }
  checkpoints.length = 0;
  lastActivated = null;
}

function setActive(cp) {
  if (lastActivated && lastActivated.mesh) {
    lastActivated.mesh.material.color.setHex(COLOR_IDLE);
  }
  cp.mesh.material.color.setHex(COLOR_ACTIVE);
  cp.activated = true;
  lastActivated = cp;
}

function findNearestCheckpoint(playerPos) {
  let nearest = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const cp of checkpoints) {
    if (!cp.mesh) continue;
    const dist = cp.mesh.position.distanceTo(playerPos);
    if (dist <= INTERACT_RADIUS && dist < bestDist) {
      bestDist = dist;
      nearest = cp;
    }
  }
  return nearest;
}

export function handleCheckpointInteract(playerPos, onActivated) {
  const cp = findNearestCheckpoint(playerPos);
  if (!cp) return false;
  setActive(cp);
  if (typeof onActivated === "function") {
    onActivated(cp);
  }
  return true;
}

export function getCurrentCheckpointPosition() {
  return lastActivated && lastActivated.mesh
    ? lastActivated.mesh.position.clone()
    : null;
}

export function getCheckpointMeshes() {
  return checkpoints.map((cp) => cp.mesh).filter(Boolean);
}
