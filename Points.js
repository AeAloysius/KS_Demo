// Points.js
// 管理玩家点数、死亡掉落与拾取
import * as THREE from "./libs/CS559-Three/build/three.module.js";

let currentPoints = 0;
let droppedPoints = 0;
let dropMesh = null;

const DROP_RADIUS = 2.0;
const DROP_COLOR = 0xffaa33;

export function getPoints() {
  return currentPoints;
}

export function setPoints(value = 0) {
  if (!Number.isFinite(value)) return;
  currentPoints = Math.max(0, Math.floor(value));
}

export function addPoints(amount = 0) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  currentPoints += amount;
}

export function clearDrop(scene) {
  if (dropMesh && scene && dropMesh.parent === scene) {
    scene.remove(dropMesh);
  }
  dropMesh = null;
  droppedPoints = 0;
}

export function getDropPosition() {
  return dropMesh ? dropMesh.position : null;
}

export function getDropRadius() {
  return DROP_RADIUS;
}

function spawnDrop(scene, pos, amount) {
  if (!scene || !pos || amount <= 0) return;
  const geo = new THREE.TetrahedronGeometry(0.6, 0);
  const mat = new THREE.MeshStandardMaterial({ color: DROP_COLOR, emissive: 0x442200 });
  dropMesh = new THREE.Mesh(geo, mat);
  dropMesh.position.copy(pos);
  dropMesh.position.y += 0.5;
  dropMesh.castShadow = true;
  dropMesh.receiveShadow = true;
  scene.add(dropMesh);
  droppedPoints = amount;
}

// 死亡时：清空当前点数，生成掉落物（会覆盖旧的掉落物）
export function handleDeathDrop(scene, deathPos) {
  clearDrop(scene);
  if (currentPoints > 0) {
    spawnDrop(scene, deathPos, currentPoints);
  }
  currentPoints = 0;
}

// 玩家按 E 交互拾取掉落物
export function tryPickupDrop(scene, playerPos) {
  if (!dropMesh || !playerPos) return 0;
  const dist = dropMesh.position.distanceTo(playerPos);
  if (dist > DROP_RADIUS) return 0;

  const amount = droppedPoints;
  currentPoints += amount;
  clearDrop(scene);
  return amount;
}