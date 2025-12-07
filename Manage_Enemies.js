// Manage_Enemies.js
import * as THREE from "three";
import { Enemy_Box } from "./Enemies/Enemy_Box.js";
import { Enemy_Spear } from "./Enemies/Enemy_Spear.js";
import { Enemy_Boss } from "./Enemies/Enemy_Boss.js";

export const enemies = [];

// 用于敌人-敌人碰撞的临时向量
const _tmpVec3 = new THREE.Vector3();

// 刷怪点：出生与复活点留空，首个检查点前 2 只，之后再增加
// type: "basic" | "advanced" | "boss"
const ENEMY_SPAWN_POINTS = [
  // 首 checkpoint 前：在庭院出口与木栅后，避开出生/复活区 (cp1 at z=8)
  { x: -6, z: 18, type: "basic" },
  { x: 6,  z: 22, type: "basic" },
  // checkpoint2 (z=40) 之后到 checkpoint3 前 (z=65)
  { x: -6,  z: 48, type: "basic" },
  { x: 6,   z: 52, type: "basic" },
  // 避开建筑：放到中路稍偏左
  { x: -4, z: 58, type: "advanced" },
  // checkpoint3 后的尾段
  // 避开建筑：放到中路偏右
  { x: 6,  z: 64, type: "advanced" },
  { x: -8,  z: 76, type: "basic" },
  // 迷宫内部刷怪（适度密度，避开墙体）
  { x: -28, z: 64, type: "basic" },
  { x: -30, z: 76, type: "advanced" },
  { x: -26, z: 84, type: "basic" },
  // Boss 区域（远端右侧围起来的小场地）
  { x: 32, z: 74, type: "boss" },
];

export function initEnemies(scene) {
  clearEnemies(scene);
  for (const p of ENEMY_SPAWN_POINTS) {
    spawnEnemy(scene, p.x, p.z, p.type);
  }
}

export function spawnEnemy(scene, x, z, type = "basic") {
  const pos = new THREE.Vector3(x, 0, z);
  const Cls = type === "advanced" ? Enemy_Spear : type === "boss" ? Enemy_Boss : Enemy_Box;
  const enemy = new Cls(scene, pos);
  enemies.push(enemy);
  return enemy;
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
