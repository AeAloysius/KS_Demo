// enemies/Enemy_Box.js
import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { EnemyBase } from "./EnemyBase.js";
import { mapWalls } from "../Map.js";

const tmpVec3 = new THREE.Vector3();

export class Enemy_Box extends EnemyBase {
  constructor(scene, position) {
    super(scene, position, {
      hp: 50,
      speed: 3.0,
    });

    // ========= 追击 / 攻击参数 =========
    this.chaseRange     = 10;
    this.stopDistance   = 1.8;
    this.attackRange    = 1.5;
    this.attackDamage   = 5;
    this.attackInterval = 8.0;
    this.attackCooldown = 0;

    this.radius = 0.4; // 敌人碰撞半径

    // ========= 韧性（poise）相关 =========
    this.maxPoise       = 25;   // 最大韧性
    this.poise          = this.maxPoise;
    this.poiseRegenRate = 25;    // 每秒恢复多少韧性

    this.isStunned    = false;   // 是否处于硬直/击退中
    this.stunDuration = 0.4;     // 硬直持续时间（秒）
    this.stunTimer    = 0;

    // 击退速度（在硬直时生效）
    this.knockbackVelocity = new THREE.Vector3(0, 0, 0);

    // ========= 受击变色相关 =========
    this.baseColor        = this.mesh.material.color.clone(); // 原本颜色
    this.hitColor         = new THREE.Color(0xff6666);        // 受击时颜色
    this.hitFlashDuration = 0.1;                              // 闪一下的时间
    this.hitFlashTimer    = 0;
  }

  createMesh() {
    const geo = new THREE.BoxGeometry(0.8, 1.6, 0.8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x884444 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * 敌人被击中时的统一处理：
   * - 闪色
   * - 韧性削减
   * - 韧性被打空则进入硬直/击退
   *
   * 需要 EnemyBase.takeDamage 调用：
   *   this.onHit({ poiseDamage, knockbackDir, knockbackPower })
   */
  onHit({ poiseDamage = 0, knockbackDir = null, knockbackPower = 0 } = {}) {
    // 1. 受击闪色
    this.hitFlashTimer = this.hitFlashDuration;
    this.mesh.material.color.copy(this.hitColor);

    // 2. 韧性削减
    if (poiseDamage > 0) {
      this.poise -= poiseDamage;
      if (this.poise < 0) this.poise = 0;
    }

    // 3. 韧性被打空，进入硬直/击退
    if (this.poise <= 0 && !this.isStunned) {
      this.isStunned = true;
      this.stunTimer = this.stunDuration;

      // 击退方向只用 XZ 分量
      if (knockbackDir && knockbackPower > 0) {
        const dir = knockbackDir.clone();
        dir.y = 0;
        if (dir.lengthSq() > 0) dir.normalize();
        this.knockbackVelocity.copy(dir.multiplyScalar(knockbackPower));
      } else {
        this.knockbackVelocity.set(0, 0, 0);
      }
    }
  }

  update(dt, playerPos, damagePlayerCallback) {
    if (!this.alive) return;

    // ========= 受击闪色恢复 =========
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      if (this.hitFlashTimer <= 0) {
        this.mesh.material.color.copy(this.baseColor);
      }
    }

    // ========= 攻击冷却 =========
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
      if (this.attackCooldown < 0) this.attackCooldown = 0;
    }

    // ========= 硬直 / 击退状态 =========
    if (this.isStunned) {
      this.stunTimer -= dt;

      // 击退移动 + 简单阻尼
      if (this.knockbackVelocity.lengthSq() > 0) {
        const move = this.knockbackVelocity.clone().multiplyScalar(dt);
        this.tryMove(move);
        this.knockbackVelocity.multiplyScalar(0.9);
        if (this.knockbackVelocity.length() < 0.1) {
          this.knockbackVelocity.set(0, 0, 0);
        }
      }

      // 硬直结束
      if (this.stunTimer <= 0) {
        this.isStunned = false;
        this.poise = this.maxPoise; // 硬直结束韧性回满，想要更硬可以改成只回一半
      }

      // 硬直期间不做追踪/攻击
      return;
    }

    // ========= 平时韧性自然恢复 =========
    if (this.poise < this.maxPoise) {
      this.poise += this.poiseRegenRate * dt;
      if (this.poise > this.maxPoise) this.poise = this.maxPoise;
    }

    // ========= 以下是原来的追踪 + 攻击逻辑 =========

    // 向玩家方向
    tmpVec3.copy(playerPos).sub(this.mesh.position);
    const distance = tmpVec3.length();

    if (distance > this.chaseRange) return; // 太远不追

    const targetYaw = Math.atan2(tmpVec3.x, tmpVec3.z);
    this.mesh.rotation.y = targetYaw;

    if (distance > this.stopDistance) {
      tmpVec3.normalize();
      const move = tmpVec3.multiplyScalar(this.speed * dt);
      this.tryMove(move);
    }

    if (
      distance <= this.attackRange &&
      damagePlayerCallback &&
      this.attackCooldown <= 0
    ) {
      damagePlayerCallback(this.attackDamage);
      // 攻击间隔加一点随机，避免所有怪同频率一起砍
      this.attackCooldown = this.attackInterval + Math.random() * 0.8;
    }
  }

  // 敌人和环境的简单碰撞（XZ 平面）
  tryMove(moveVec) {
    if (moveVec.lengthSq() === 0) return;

    // 分轴移动：先 X 后 Z，效果和玩家类似，能沿墙滑动
    if (moveVec.x !== 0) {
      const newPosX = this.mesh.position.clone();
      newPosX.x += moveVec.x;
      if (!this.willCollide(newPosX)) {
        this.mesh.position.x = newPosX.x;
      }
    }

    if (moveVec.z !== 0) {
      const newPosZ = this.mesh.position.clone();
      newPosZ.z += moveVec.z;
      if (!this.willCollide(newPosZ)) {
        this.mesh.position.z = newPosZ.z;
      }
    }
  }

  willCollide(newPos) {
    for (const wall of mapWalls) {
      const halfX = wall.scale.x * 0.5;
      const halfZ = wall.scale.z * 0.5;

      const dx = Math.abs(newPos.x - wall.position.x);
      const dz = Math.abs(newPos.z - wall.position.z);

      if (dx < halfX + this.radius && dz < halfZ + this.radius) {
        return true;
      }
    }
    return false;
  }
}
