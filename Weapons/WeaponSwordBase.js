// weapons/WeaponSwordBase.js
import * as THREE from "three";

let globalOnDealDamage = null;

export function setGlobalWeaponOnDealDamage(fn) {
  globalOnDealDamage = typeof fn === "function" ? fn : null;
}

export class WeaponSwordBase {
  constructor(camera, config = {}) {
    this.camera = camera;

    // 通用数值（子类可以通过 config 覆盖）
    this.damage         = config.damage         ?? 10;
    this.maxDistance    = config.maxDistance    ?? 2.0;
    this.cooldownTime   = config.cooldownTime   ?? 0.45;
    this.attackDuration = config.attackDuration ?? 0.35;
    this.windupFrac     = config.windupFrac     ?? 0.25;
    this.recoveryFrac   = config.recoveryFrac   ?? 0.2;

// ======= 新增：蓄力相关参数 =======
    this.chargeTimeMax   = config.chargeTimeMax   ?? 0.7;  // 从 0 到满蓄的时间（秒）
    this.chargeDamageMul = config.chargeDamageMul ?? 2.0;  // 满蓄伤害倍率
    this.chargePoiseMul  = config.chargePoiseMul  ?? 2.0;  // 满蓄削韧倍率（预留）
    this.minChargeRatio  = config.minChargeRatio  ?? 0.0;  // 最小蓄力比例（0 允许点一下）

    // 连招窗口：在上一次攻击结束后的一小段时间内触发第二段横斩
    const defaultComboWindow = this.chargeTimeMax + 0.6;
    this.comboWindow = config.comboWindow ?? defaultComboWindow;

 // ✅ 新增：蓄力时移动速度倍率（0.5 = 只剩一半速度）
    this.chargeMoveMul   = config.chargeMoveMul   ?? 0.5;

    // 新增：韧性削减 & 击退强度（可以被子类覆盖）
    this.poiseDamage    = config.poiseDamage    ?? 40;
    this.knockbackPower = config.knockbackPower ?? 6.0;

    // 状态
    this.attackCooldown = 0;
    this.animTime = 0;
    this.isSwinging = false;
    this.useAltAttack = false; // 第二段横斩
    this.timeSinceAttackEnd = Number.POSITIVE_INFINITY;
    this.pendingAltAttack = false; // 记录在蓄力起手时是否落在连招窗口
      this.lastAttackWasAlt = false; // 记录上一击是否是第二段

    // ======= 新增：蓄力状态 =======
    this.isCharging    = false;
    this.chargeTimer   = 0;
    this.currentCharge = 0; // 0~1

    this.raycaster = new THREE.Raycaster();

    // 创建武器模型
    this.mesh = this.createMesh();
    // 调用关键帧：idle 姿势
    const { pos: idlePos, rot: idleRot } = this.getIdlePose();
    this.mesh.position.copy(idlePos);
    this.mesh.rotation.copy(idleRot);

    // 挂在相机上
    camera.add(this.mesh);
  }

  // ========== 提供默认实现，子类可以 override ==========

  // 默认几何体：长方体剑
  createMesh() {
    const geo = new THREE.BoxGeometry(0.06, 0.9, 0.18);
    const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    return new THREE.Mesh(geo, mat);
  }

  // 默认：持剑待机姿势
getIdlePose() {
    return {
      pos: new THREE.Vector3(0.8, -0.4, -0.8),
      // 等价于 (-0.3rad, 0.1rad, 0) ，改写为 PI 形式便于理解
      rot: new THREE.Euler(-0.0955 * Math.PI, 0.0318 * Math.PI, 0),
    };
  }

  // 第一段：右后上抬
  getWindupPose() {
    return {
      pos: new THREE.Vector3(0.8, -0.3, -0.7),
      rot: new THREE.Euler(20 * (Math.PI / 180), 10 * (Math.PI / 180), -30 * (Math.PI / 180)),
    };
  }

  // 第一段：左下劈出
  getSlashPose() {
    return {
      pos: new THREE.Vector3(-0.2, -0.7, -0.8),
      rot: new THREE.Euler(-200 * (Math.PI / 180), 10 * (Math.PI / 180), 50 * (Math.PI / 180)),
    };
  }

  // 第二段横斩：微右起手 → 向左横挥
  getWindupPoseAlt() {
    return {
      pos: new THREE.Vector3(1, -0.47, -0.8),
      rot: new THREE.Euler(-10 * (Math.PI / 180), 0, -70 * (Math.PI / 180)),
    };
  }

  getSlashPoseAlt() {
    return {
      pos: new THREE.Vector3(-0.45, -0.45, -0.9),
      rot: new THREE.Euler(-20 * (Math.PI / 180), 150 * (Math.PI / 180), -100 * (Math.PI / 180)),
    };
  }

  // 蓄力时对移动速度的影响：1 = 不变，0.5 = 降到一半
  getMoveSpeedMul() {
    if (this.isCharging) {
      return this.chargeMoveMul;
    }
    return 1.0;
  }

    // ========== 公共逻辑：update / 动画 / 攻击 ==========

  update(dt) {
    // 冷却计时
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
      if (this.attackCooldown < 0) this.attackCooldown = 0;
    }

    // 上一次攻击结束后经过的时间，用于连招判定
    if (this.isSwinging) {
      this.timeSinceAttackEnd = 0;
    } else if (this.timeSinceAttackEnd >= 0) {
      this.timeSinceAttackEnd += dt;
    }

    // 蓄力计时
    if (this.isCharging) {
      this.chargeTimer += dt;
      const maxT = Math.max(0.0001, this.chargeTimeMax);
      let r = this.chargeTimer / maxT;
      if (r > 1) r = 1;
      this.currentCharge = r;
    } else {
      this.chargeTimer = 0;
      this.currentCharge = 0;
    }

    if (!this.mesh) return;

    // 攻击动画（挥刀）
    if (this.isSwinging) {
      this.animTime -= dt;
      if (this.animTime <= 0) {
        this.animTime = 0;
        this.isSwinging = false;
        this.useAltAttack = false; // 结束后重置
        this.pendingAltAttack = false; // 连招标记也一并清空
      }
      const t = 1 - this.animTime / this.attackDuration; // 0→1
      this.applyAnim(t);
    } else if (this.isCharging) {
      // 蓄力阶段：从 idle 过渡到 windup，使用当前蓄力比例作为插值因子
      const windup    = this.pendingAltAttack ? this.getWindupPoseAlt() : this.getWindupPose();
      const { pos: idlePos, rot: idleRot } = this.getIdlePose();
      const { pos: wPos, rot: wRot } = windup;

      const k = Math.max(0, Math.min(1, this.currentCharge));
      const pos = new THREE.Vector3(
        THREE.MathUtils.lerp(idlePos.x, wPos.x, k),
        THREE.MathUtils.lerp(idlePos.y, wPos.y, k),
        THREE.MathUtils.lerp(idlePos.z, wPos.z, k)
      );
      const rot = new THREE.Euler(
        THREE.MathUtils.lerp(idleRot.x, wRot.x, k),
        THREE.MathUtils.lerp(idleRot.y, wRot.y, k),
        THREE.MathUtils.lerp(idleRot.z, wRot.z, k)
      );

      this.mesh.position.copy(pos);
      this.mesh.rotation.copy(rot);
    } else {
      const { pos, rot } = this.getIdlePose();
      this.mesh.position.copy(pos);
      this.mesh.rotation.copy(rot);
    }
  }


  // 动画：根据 t(0~1) 在 idle → windup → slash → idle 之间插值
  applyAnim(t) {
    const { pos: idlePos,   rot: idleRot   } = this.getIdlePose();
    const windup    = this.useAltAttack ? this.getWindupPoseAlt() : this.getWindupPose();
    const slash     = this.useAltAttack ? this.getSlashPoseAlt()  : this.getSlashPose();
    const { pos: windupPos, rot: windupRot } = windup;
    const { pos: slashPos,  rot: slashRot  } = slash;

    const pos = new THREE.Vector3();
    const rot = new THREE.Euler();

    if (t < this.windupFrac) {
      // idle → windup
      const k = t / this.windupFrac;
      pos.set(
        THREE.MathUtils.lerp(idlePos.x, windupPos.x, k),
        THREE.MathUtils.lerp(idlePos.y, windupPos.y, k),
        THREE.MathUtils.lerp(idlePos.z, windupPos.z, k)
      );
      rot.set(
        THREE.MathUtils.lerp(idleRot.x, windupRot.x, k),
        THREE.MathUtils.lerp(idleRot.y, windupRot.y, k),
        THREE.MathUtils.lerp(idleRot.z, windupRot.z, k)
      );
    } else if (t < 1 - this.recoveryFrac) {
      // windup → slash
      const midStart = this.windupFrac;
      const midEnd   = 1 - this.recoveryFrac;
      const k = (t - midStart) / (midEnd - midStart);
      pos.set(
        THREE.MathUtils.lerp(windupPos.x, slashPos.x, k),
        THREE.MathUtils.lerp(windupPos.y, slashPos.y, k),
        THREE.MathUtils.lerp(windupPos.z, slashPos.z, k)
      );
      rot.set(
        THREE.MathUtils.lerp(windupRot.x, slashRot.x, k),
        THREE.MathUtils.lerp(windupRot.y, slashRot.y, k),
        THREE.MathUtils.lerp(windupRot.z, slashRot.z, k)
      );
    } else {
      // slash → idle
      const recStart = 1 - this.recoveryFrac;
      const k = (t - recStart) / this.recoveryFrac;
      pos.set(
        THREE.MathUtils.lerp(slashPos.x, idlePos.x, k),
        THREE.MathUtils.lerp(slashPos.y, idlePos.y, k),
        THREE.MathUtils.lerp(slashPos.z, idlePos.z, k)
      );
      rot.set(
        THREE.MathUtils.lerp(slashRot.x, idleRot.x, k),
        THREE.MathUtils.lerp(slashRot.y, idleRot.y, k),
        THREE.MathUtils.lerp(slashRot.z, idleRot.z, k)
      );
    }

    this.mesh.position.copy(pos);
    this.mesh.rotation.copy(rot);
  }

   // 是否允许移动：前摇+劈砍阶段锁移动，收招阶段放开
  canMove() {
    if (!this.isSwinging) return true;
    const t = 1 - this.animTime / this.attackDuration;
    const cutoff = 1 - this.recoveryFrac; // 比如 0.8
    return t >= cutoff;
  }

  // ======= 新增：蓄力接口 =======

  // 是否可以开始蓄力
  canStartCharge() {
    return this.attackCooldown <= 0 && !this.isSwinging;
  }

  // 鼠标按下 → 开始蓄力
  startCharge() {
    if (!this.canStartCharge()) return;
    this.isCharging = true;
    this.chargeTimer = 0;
    this.currentCharge = 0;

    const comboWin = Number.isFinite(this.comboWindow)
      ? this.comboWindow
      : (this.chargeTimeMax + 0.6);
      this.pendingAltAttack = 
        !this.lastAttackWasAlt &&
        this.timeSinceAttackEnd >= 0 &&
        this.timeSinceAttackEnd <= comboWin;
  }

  // 鼠标抬起 → 释放蓄力并执行攻击
  releaseCharge(enemies) {
    if (!this.isCharging) return { didAttack: false, ratioUsed: 0 };

    let ratio = this.currentCharge;   // 0~1
    this.isCharging = false;

    // 至少达到最小蓄力
    if (ratio < this.minChargeRatio) {
      ratio = this.minChargeRatio;
    }

    const did = this.doAttack(enemies, ratio);
    return { didAttack: did, ratioUsed: ratio };
  }

  // 供 UI 查询蓄力进度（0~1）
  getChargeRatio() {
    return this.currentCharge;
  }

  // 是否已经满蓄，用来让 UI 变色 / 闪光
  isChargeFull() {
    return this.isCharging && this.currentCharge >= 0.999;
  }

    // 核心攻击逻辑：根据蓄力比例进行攻击
  doAttack(enemies, chargeRatio = 0) {
    if (this.attackCooldown > 0 || this.isSwinging) return false;

    // 连招判定：在蓄力起手时记录的窗口结果，保证长按蓄力也能触发第二段
    this.useAltAttack = this.pendingAltAttack;
    this.pendingAltAttack = false;
      this.lastAttackWasAlt = this.useAltAttack;

    this.attackCooldown = this.cooldownTime;
    this.isSwinging = true;
    // 已经处于 windup 姿态，直接从 windup 段进入挥击，避免回弹
    this.animTime = this.attackDuration * (1 - this.windupFrac);

    const r = Math.max(0, Math.min(1, chargeRatio));

    const damageMul = 1 + r * (this.chargeDamageMul - 1);
    const poiseMul  = 1 + r * (this.chargePoiseMul  - 1);

    this.performHit(enemies, damageMul, poiseMul);
    return true;
  }

  // 保留一个不带蓄力的接口，方便以后 AI 或脚本用
  tryAttack(enemies) {
    return this.doAttack(enemies, 0);
  }

    // 蓄力时移动速度倍率
  getMoveSpeedMul() {
    if (this.isCharging) {
      return this.chargeMoveMul;
    }
    return 1.0;
  }

  // 给外部判断是否正在蓄力
  isChargingNow() {
    return this.isCharging;
  }

  // 鼠标抬起但体力不足等情况用来取消蓄力
  cancelCharge() {
    this.isCharging = false;
    this.chargeTimer = 0;
    this.currentCharge = 0;
  }
  


    // 命中判定（默认：从相机中心射一条射线）
  performHit(enemies, damageMul = 1, poiseMul = 1) {
    if (!enemies || enemies.length === 0) return;

    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    this.raycaster.set(origin, dir);

    const enemyMeshes = enemies
      .filter(e => e.alive)
      .map(e => e.mesh);

    const intersects = this.raycaster.intersectObjects(enemyMeshes, true);

    if (intersects.length > 0 && intersects[0].distance <= this.maxDistance) {
      let hitMesh = intersects[0].object;

      while (hitMesh.parent && !enemyMeshes.includes(hitMesh)) {
        hitMesh = hitMesh.parent;
      }

      const enemy = enemies.find(e => e.mesh === hitMesh);
      if (enemy) {
        const finalDamage = this.damage * damageMul;
        // 使用配置的基础削韧值，若未配置则退回伤害值
        const poiseDamage = (this.poiseDamage ?? this.damage) * poiseMul;

        // 计算从玩家到敌人的方向作为击退方向（仅 XZ）
        const hitDir = enemy.mesh.position.clone().sub(origin);
        hitDir.y = 0;
        if (hitDir.lengthSq() > 0) hitDir.normalize();

        const knockbackPower = this.knockbackPower * poiseMul;

        enemy.takeDamage(finalDamage, {
          poiseDamage,
          knockbackDir: hitDir,
          knockbackPower,
        });

        if (globalOnDealDamage) {
          globalOnDealDamage(finalDamage);
        }
      }
    }
  }

}
