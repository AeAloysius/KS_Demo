// Checkpoint.js
// 简单的检查点系统：球体表示，按 E 交互后变色并记录复活点
import * as THREE from "three";

const COLOR_IDLE = 0x5555aa;
const COLOR_ACTIVE = 0x55aa55;
const INTERACT_RADIUS = 2.5;

export function getCheckpointInteractRadius() {
  return INTERACT_RADIUS;
}

const checkpoints = [];
let lastActivated = null;
let onCheckpointActivated = null;

// 避开现有建筑物的检查点位置
const DEFAULT_POINTS = [
  new THREE.Vector3(0, 0, 8),     // 出生庭院中轴，远离墙与敌人
  new THREE.Vector3(0, 0, 40),    // 第二个检查点更远，位于中后段主路

  // Boss 房前入口左侧，避免挡路
  new THREE.Vector3(22, 0, 76),

  // 迷宫入口（北侧开口 x≈-28,z≈58 附近，稍往里放以防贴墙）
  new THREE.Vector3(-28, 0, 62),

  // 迷宫内部（终点前的转折处，便于失败后快速回收戒指）
  new THREE.Vector3(-28, 0, 84),
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
  if (typeof onCheckpointActivated === "function") {
    onCheckpointActivated(cp);
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

// 为外部注册回调：当 checkpoint 激活时调用（用于精美版视觉特效）
export function setCheckpointActivatedCallback(cb) {
  onCheckpointActivated = cb;
}
