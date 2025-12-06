// Manage_Enemies.js
import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { Enemy_Box } from "../enemies/Enemy_Box.js";

export const enemies = [];

// 用于敌人-敌人碰撞的临时向量
const _tmpVec3 = new THREE.Vector3();

// 安全的刷怪点（避开建筑）——可以自己改位置
const ENEMY_SPAWN_POINTS = [
  { x: -15, z: -8 },
  { x:  15, z: -8 },
  { x:   0, z: -22 },
];

export function initEnemies(scene) {
  clearEnemies(scene);
  for (const p of ENEMY_SPAWN_POINTS) {
    spawnEnemy(scene, p.x, p.z);
  }
}

export function spawnEnemy(scene, x, z) {
  const pos = new THREE.Vector3(x, 0, z);
  const enemy = new Enemy_Box(scene, pos);
  enemies.push(enemy);
}

export function clearEnemies(scene) {
  for (const e of enemies) {
    if (e.mesh && e.mesh.parent === scene) {
      scene.remove(e.mesh);
    }
  }
  enemies.length = 0;
}

export function resetEnemies(scene) {
  initEnemies(scene);
}

// 更新所有敌人
export function updateEnemies(dt, playerPosition, damagePlayerCallback) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    if (!enemy.alive) {
      enemies.splice(i, 1);
      continue;
    }

    enemy.update(dt, playerPosition, damagePlayerCallback);
  }

  resolveEnemyEnemyCollisions();
}

// 敌人-敌人之间的简单球体碰撞（只在 XZ 平面上顶开）
function resolveEnemyEnemyCollisions() {
  const count = enemies.length;
  if (count <= 1) return;

  for (let i = 0; i < count; i++) {
    const a = enemies[i];
    if (!a.alive || !a.mesh) continue;

    for (let j = i + 1; j < count; j++) {
      const b = enemies[j];
      if (!b.alive || !b.mesh) continue;

      // 取位置
      const posA = a.mesh.position;
      const posB = b.mesh.position;

      // 水平方向向量（只算 XZ）
      _tmpVec3.subVectors(posB, posA);
      _tmpVec3.y = 0;

      const dist = _tmpVec3.length();
      const ra = a.radius || 0.4; // 没写 radius 的敌人用默认值
      const rb = b.radius || 0.4;
      const minDist = ra + rb;

      // 距离正常或者完全重合就跳过
      if (dist === 0 || dist >= minDist) continue;

      const overlap = minDist - dist;
      if (overlap <= 0) continue;

      _tmpVec3.normalize();

      // 双方各自挪开一半
      const move = overlap * 0.5;

      posA.addScaledVector(_tmpVec3, -move); // A 往反方向挪
      posB.addScaledVector(_tmpVec3,  move); // B 往正方向挪
    }
  }
}
