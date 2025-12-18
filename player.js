// player.js
import * as THREE from "./libs/CS559-Three/build/three.module.js";
// 👇 关键修改：把 ".." 改成了 "."
import { Sword_Box } from "./Weapons/sword_box.js";
import { mapWalls } from "./Map.js";
import { setGlobalWeaponOnDealDamage } from "./Weapons/WeaponSwordBase.js";
import { getLifeStealRatio } from "./Rings/RingManager.js";

let player;
let cameraRef;
const CAMERA_BASE_HEIGHT = 1.7;

const move = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

let yaw = 0;
let pitch = 0;
const PITCH_LIMIT = Math.PI / 2 - 0.01;

const speed = 4;
const jumpSpeed = 6;
const gravity = -15;
let verticalVelocity = 0;
let onGround = true;
let isSprinting = false;
let shiftHeld = false;
let shiftHoldTime = 0;

// Dash
const DASH_SPEED = 16;       // 冲刺速度（略微提升）
const DASH_DURATION = 0.18;  // 冲刺持续秒数
const DASH_COOLDOWN = 0.8;   // 冷却（略微增加）
const STAMINA_COST_DASH = 12; // 每次 dash 体力消耗
let dashTimer = 0;
let dashCooldown = 0;
let dashDir = new THREE.Vector3();
let isDashing = false;

const PLAYER_RADIUS = 0.5;

// 出生点（可由 checkpoint 覆盖）
const initialPosition = new THREE.Vector3(0, 0, -4);
let respawnPosition = initialPosition.clone();

// HP
export const PLAYER_MAX_HP = 100;
let playerHp = PLAYER_MAX_HP;

// ====== 体力（Stamina）系统 ======
export const PLAYER_MAX_STAMINA = 100;

// 每秒恢复多少体力
const STAMINA_REGEN_RATE  = 30; 
// 停止消耗多少秒后开始恢复
const STAMINA_REGEN_DELAY = 0.8; 

// 各种行为的体力消耗
const STAMINA_COST_JUMP             = 12;   // 跳跃
const STAMINA_COST_ATTACK_BASE      = 18;   // 攻击基础体力（蓄越久可以再乘系数）
const STAMINA_COST_SPRINT_PER_SEC   = 20;   // 奔跑每秒消耗
const STAMINA_COST_CHARGE_START     = 5;    // 蓄力起手一次性消耗
// 蓄力不再持续消耗体力

let stamina = PLAYER_MAX_STAMINA;
let staminaRegenTimer = 0;   // >0 时，不恢复，计时结束才开始回

export function getStamina() {
  // 防止浮点误差
  return Math.max(0, Math.min(PLAYER_MAX_STAMINA, stamina));
}

export function getStaminaRatio() {
  return getStamina() / PLAYER_MAX_STAMINA;
}

// 离散消耗（跳跃 / 出刀）：不够就失败，返回 false
function tryConsumeStamina(cost) {
  if (cost <= 0) return true;
  if (stamina < cost) return false;
  stamina -= cost;
  if (stamina < 0) stamina = 0;
  staminaRegenTimer = STAMINA_REGEN_DELAY;
  return true;
}

// 连续消耗（蓄力 / 奔跑）：允许扣到 0
function consumeStaminaContinuous(cost) {
  if (cost <= 0) return;
  stamina -= cost;
  if (stamina < 0) stamina = 0;
  staminaRegenTimer = STAMINA_REGEN_DELAY;
}

// 当前武器
let currentWeapon = null;

// 当前拿的武器的构造函数（给背包界面用）
export function getCurrentWeaponClass() {
  return currentWeapon ? currentWeapon.constructor : null;
}

// 通过武器类来装备武器（背包点击时会调用）
export function equipWeaponClass(WeaponClass) {
  if (!cameraRef) return;

  // 清掉旧武器的 mesh
  if (currentWeapon && currentWeapon.mesh && currentWeapon.mesh.parent) {
    currentWeapon.mesh.parent.remove(currentWeapon.mesh);
  }

  if (!WeaponClass) {
    currentWeapon = null;
    return;
  }

  // 新建一把
  currentWeapon = new WeaponClass(cameraRef);
}

export function createPlayer(scene, camera) {
  cameraRef = camera;

  player = new THREE.Object3D();
  player.position.copy(initialPosition);

  // 初始改为面向相反方向（朝 -Z）
  yaw = Math.PI;

  camera.position.set(0, CAMERA_BASE_HEIGHT, 0);
  player.add(camera);

  scene.add(player);

  // 开局不装备任何武器，需自行拾取
  equipWeaponClass(null);
}

export function updatePlayer(dt, scene, enemies) {
  if (!player) return;

  if (currentWeapon) currentWeapon.update(dt);

  // Shift 长按 1s 进入奔跑；短按触发 dash
  if (shiftHeld) {
    shiftHoldTime += dt;
    if (!isSprinting && shiftHoldTime >= 1.0) {
      isSprinting = true;
    }
  }

  if (dashCooldown > 0) {
    dashCooldown -= dt;
    if (dashCooldown < 0) dashCooldown = 0;
  }

  if (isDashing) {
    dashTimer -= dt;
    const dashMove = dashDir.clone().multiplyScalar(DASH_SPEED * dt);
    tryMove(dashMove);
    if (dashTimer <= 0) {
      isDashing = false;
    }
  }

  // 蓄力不再消耗体力，也不因体力为 0 自动中断
  const canMove = !currentWeapon || currentWeapon.canMove();

    if (canMove) {
    const dir = new THREE.Vector3();

    if (move.forward) dir.z -= 1;
    if (move.backward) dir.z += 1;
    if (move.left) dir.x -= 1;
    if (move.right) dir.x += 1;

    // dash 时跳过常规移动，避免速度叠加
    if (!isDashing && dir.lengthSq() > 0) {
      dir.normalize();
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

      let moveSpeed = speed;

      // 蓄力减速（前面在 WeaponSwordBase 里会提供 getMoveSpeedMul）
      if (currentWeapon && typeof currentWeapon.getMoveSpeedMul === "function") {
        moveSpeed *= currentWeapon.getMoveSpeedMul();
      }

      // 奔跑加速 + 持续体力消耗
      if (isSprinting && stamina > 0) {
        const sprintMult = 1.6; // 奔跑速度倍率，自己可以改
        moveSpeed *= sprintMult;
        consumeStaminaContinuous(STAMINA_COST_SPRINT_PER_SEC * dt);
      }

      dir.multiplyScalar(moveSpeed * dt);
      tryMove(dir);
    }
  }


  // 重力 / 跳跃
  const prevY = player.position.y;
  verticalVelocity += gravity * dt;
  player.position.y += verticalVelocity * dt;
  resolveVerticalCollision(prevY);

  // 方向
  player.rotation.y = yaw;
  cameraRef.rotation.x = pitch;

  // 体力恢复逻辑：只有在一段时间没有消耗后才开始恢复
  if (staminaRegenTimer > 0) {
    staminaRegenTimer -= dt;
    if (staminaRegenTimer < 0) staminaRegenTimer = 0;
  } else if (stamina < PLAYER_MAX_STAMINA) {
    stamina += STAMINA_REGEN_RATE * dt;
    if (stamina > PLAYER_MAX_STAMINA) stamina = PLAYER_MAX_STAMINA;
  }
}

export function getPlayerPosition() {
  return player ? player.position.clone() : new THREE.Vector3();
}

export function getPlayerHp() {
  return Math.round(playerHp);
}

// 相机轻微上下偏移（用于精美版行走摇摄）
export function setCameraBobOffset(offsetY) {
  if (!cameraRef) return;
  cameraRef.position.y = CAMERA_BASE_HEIGHT + (offsetY || 0);
}

// 玩家受到伤害：返回 bool 表示这次是否死亡
export function damagePlayer(amount) {
  if (playerHp <= 0) return false; // 已经死了

  playerHp -= amount;
  if (playerHp < 0) playerHp = 0;
  playerHp = Math.round(playerHp);

  console.log(`Player HP: ${playerHp}/${PLAYER_MAX_HP}`);

  if (playerHp <= 0) {
    console.log("Player Died");
    return true;
  }
  return false;
}

// 治疗（用于吸血效果），返回实际回复值
export function healPlayer(amount) {
  if (playerHp <= 0 || amount <= 0) return 0;
  const prev = playerHp;
  playerHp += amount;
  if (playerHp > PLAYER_MAX_HP) playerHp = PLAYER_MAX_HP;
  playerHp = Math.round(playerHp);
  return playerHp - prev;
}

// 注册全局武器伤害回调，用于戒指吸血
setGlobalWeaponOnDealDamage((damage) => {
  const ratio = getLifeStealRatio();
  if (ratio > 0 && damage > 0) {
    healPlayer(damage * ratio);
  }
});

// 由游戏管理：复活玩家（回出生点、回血、速度清零）
export function resetPlayerState() {
  if (!player) return;
  player.position.copy(respawnPosition);
  player.position.y = respawnPosition.y;
  verticalVelocity = 0;
  onGround = true;
  playerHp = PLAYER_MAX_HP;
  console.log("Player Respawned");
  stamina = PLAYER_MAX_STAMINA;
  staminaRegenTimer = 0;
}

export function setCheckpointPosition(pos) {
  if (!pos) return;
  respawnPosition.copy(pos);
  respawnPosition.y = pos.y;
}

export function restorePlayerStatus(pos) {
  if (!player) return;
  if (pos) {
    player.position.copy(pos);
  }
  verticalVelocity = 0;
  onGround = true;
  playerHp = PLAYER_MAX_HP;
  stamina = PLAYER_MAX_STAMINA;
  staminaRegenTimer = 0;
}

// 当前武器蓄力比例（0~1），给 UI 用
export function getWeaponChargeRatio() {
  if (!currentWeapon || !currentWeapon.getChargeRatio) return 0;
  return currentWeapon.getChargeRatio();
}

// 是否满蓄（用来让蓄力条变色 / 闪白）
export function isWeaponChargeFull() {
  if (!currentWeapon || !currentWeapon.isChargeFull) return false;
  return currentWeapon.isChargeFull();
}

// 键盘
export function handleKeyDown(event) {
  switch (event.code) {
    case "KeyW": move.forward  = true; break;
    case "KeyS": move.backward = true; break;
    case "KeyA": move.left     = true; break;
    case "KeyD": move.right    = true; break;
    case "ShiftLeft":
    case "ShiftRight":
      if (!shiftHeld) {
        shiftHeld = true;
        shiftHoldTime = 0;
      }
      break;
    case "Space":
      if (onGround) {
        if (tryConsumeStamina(STAMINA_COST_JUMP)) {
          onGround = false;
          verticalVelocity = jumpSpeed;
        }
      }
      break;
  }
}

export function handleKeyUp(event) {
  switch (event.code) {
    case "KeyW": move.forward  = false; break;
    case "KeyS": move.backward = false; break;
    case "KeyA": move.left     = false; break;
    case "KeyD": move.right    = false; break;
    case "ShiftLeft":
    case "ShiftRight":
      // 短按判定 dash，长按则结束奔跑
      if (shiftHoldTime < 1.0) {
        tryStartDash();
      } else {
        isSprinting = false;
      }
      shiftHeld = false;
      shiftHoldTime = 0;
      break;
  }
}

// 鼠标视角
export function handleMouseMove(event) {
  if (document.pointerLockElement !== document.body) return;

  const movementX =
    event.movementX || event.mozMovementX || event.webkitMovementX || 0;
  const movementY =
    event.movementY || event.mozMovementY || event.webkitMovementY || 0;

  const lookSpeed = 0.0015;

  yaw   -= movementX * lookSpeed;
  pitch -= movementY * lookSpeed;

  if (pitch >  PITCH_LIMIT) pitch =  PITCH_LIMIT;
  if (pitch < -PITCH_LIMIT) pitch = -PITCH_LIMIT;
}

// 鼠标按下：开始蓄力（如果有体力）
export function handleMouseDown(event, scene, enemies) {
  if (event.button !== 0) return;
  if (playerHp <= 0) return;
  if (!currentWeapon || !currentWeapon.startCharge || !currentWeapon.canStartCharge) return;

  // 攻击冷却或其他原因无法蓄力时，不扣体力
  if (!currentWeapon.canStartCharge()) return;

  // 体力太低，直接不让起手；蓄力起手扣一次体力
  if (!tryConsumeStamina(STAMINA_COST_CHARGE_START)) return;

  if (document.pointerLockElement !== document.body) {
    document.body.requestPointerLock();
  }

  if (currentWeapon && currentWeapon.startCharge) {
    currentWeapon.startCharge();
  }
}

// 鼠标抬起：扣一次攻击体力 + 释放蓄力
export function handleMouseUp(event, scene, enemies) {
  if (event.button !== 0) return;
  if (playerHp <= 0) return;
  if (!currentWeapon || !currentWeapon.releaseCharge) return;

  // 根据最终使用的蓄力比例来结算体力消耗（蓄越久越贵）
  const ratioLive = currentWeapon.getChargeRatio
    ? currentWeapon.getChargeRatio()
    : 0;

  // 先尝试释放，获得实际出刀与最终蓄力比例（release 内部会做最小蓄力夹紧）
  const result = currentWeapon.releaseCharge(enemies);
  if (!result || !result.didAttack) return; // 冷却/其他原因未出刀，不扣体力

  const ratioUsed = result.ratioUsed ?? ratioLive;
  const cost = STAMINA_COST_ATTACK_BASE * (0.5 + 0.5 * ratioUsed);

  // 体力不够就视为攻击被取消（但已经释放了动作，这里可以只不扣体力；若需强制取消可在武器层处理）
  tryConsumeStamina(cost);
}



// === 碰撞：与环境 ===

function tryMove(moveVec) {
  if (moveVec.x !== 0) {
    const newPosX = player.position.clone();
    newPosX.x += moveVec.x;
    if (!willCollide(newPosX)) {
      player.position.x = newPosX.x;
    }
  }

  if (moveVec.z !== 0) {
    const newPosZ = player.position.clone();
    newPosZ.z += moveVec.z;
    if (!willCollide(newPosZ)) {
      player.position.z = newPosZ.z;
    }
  }
}

// 尝试开始 dash：方向取当前按键方向，若无按键则向视角前方
function tryStartDash() {
  if (isDashing) return;
  if (dashCooldown > 0) return;

  // 体力不足不允许 dash
  if (!tryConsumeStamina(STAMINA_COST_DASH)) return;

  const dir = new THREE.Vector3();
  if (move.forward) dir.z -= 1;
  if (move.backward) dir.z += 1;
  if (move.left) dir.x -= 1;
  if (move.right) dir.x += 1;

  if (dir.lengthSq() === 0) {
    // 无输入则朝相机后方 dash（忽略 pitch）
    dir.set(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  } else {
    dir.normalize();
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  }

  isDashing = true;
  dashTimer = DASH_DURATION;
  dashCooldown = DASH_COOLDOWN;
  dashDir.copy(dir).normalize();
}

function willCollide(newPos) {
  const feetY = newPos.y;

  for (const wall of mapWalls) {
    const halfX = wall.scale.x * 0.5;
    const halfY = wall.scale.y * 0.5;
    const halfZ = wall.scale.z * 0.5;

    const topY    = wall.position.y + halfY;
    const bottomY = wall.position.y - halfY;

    // 在平台顶附近或更高：视为在平台上/上方，不挡水平移动
    if (feetY >= topY - 0.05) continue;
    if (feetY < bottomY - 0.5) continue;

    const dx = Math.abs(newPos.x - wall.position.x);
    const dz = Math.abs(newPos.z - wall.position.z);

    if (dx < halfX + PLAYER_RADIUS && dz < halfZ + PLAYER_RADIUS) {
      return true;
    }
  }
  return false;
}

function resolveVerticalCollision(prevY) {
  let landedOnPlatform = false;

  for (const wall of mapWalls) {
    const halfX = wall.scale.x * 0.5;
    const halfY = wall.scale.y * 0.5;
    const halfZ = wall.scale.z * 0.5;

    const topY = wall.position.y + halfY;

    const dx = Math.abs(player.position.x - wall.position.x);
    const dz = Math.abs(player.position.z - wall.position.z);
    const horizontallyInside =
      dx < halfX + PLAYER_RADIUS &&
      dz < halfZ + PLAYER_RADIUS;

    if (
      horizontallyInside &&
      prevY >= topY &&
      player.position.y <= topY &&
      verticalVelocity <= 0
    ) {
      player.position.y = topY;
      verticalVelocity = 0;
      onGround = true;
      landedOnPlatform = true;
      break;
    }
  }

  const GROUND_Y = 0;

  if (!landedOnPlatform) {
    if (player.position.y <= GROUND_Y) {
      player.position.y = GROUND_Y;
      verticalVelocity = 0;
      onGround = true;
    } else {
      onGround = false;
    }
  }
}