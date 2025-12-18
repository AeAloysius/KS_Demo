// enemies/Enemy_Spear.js
// 进阶敌人：速度更快、攻击更远，造型为矛状圆柱+尖锥
import * as THREE from "../libs/CS559-Three/build/three.module.js";
import { GLTFLoader } from "../libs/CS559-Three/examples/jsm/loaders/GLTFLoader.js";
import { EnemyBase } from "./EnemyBase.js";
import { mapWalls } from "../Map.js";
import { addPoints } from "../Points.js";

const tmpVec3 = new THREE.Vector3();
const BASE_SHAFT_COLOR = new THREE.Color(0x335577);
const BASE_TIP_COLOR = new THREE.Color(0x99bbff);
const HIT_COLOR = new THREE.Color(0x66aaff);

function isFancyVariant() {
  try {
    return localStorage?.getItem("ks_demo_variant") === "fancy";
  } catch (e) {
    return false;
  }
}

export class Enemy_Spear extends EnemyBase {
  constructor(scene, position) {
    super(scene, position, {
      hp: 70,
      speed: 3.8,
    });

    this.gltfHitTargets = [];
    this.gltfBaseColors = [];
    this.baseParts = null;

    this.chaseRange     = 12;
    this.stopDistance   = 2.0;
    this.attackRange    = 2.4;
    this.attackDamage   = 10;
    this.attackInterval = 1.2;
    this.attackCooldown = 0;

    this.radius = 0.45;

    this.maxPoise       = 35;
    this.poise          = this.maxPoise;
    this.poiseRegenRate = 30;

    this.isStunned    = false;
    this.stunDuration = 0.45;
    this.stunTimer    = 0;
    this.knockbackVelocity = new THREE.Vector3();

    this.baseShaftColor   = BASE_SHAFT_COLOR.clone();
    this.baseTipColor     = BASE_TIP_COLOR.clone();
    this.hitColor         = HIT_COLOR.clone();
    this.hitFlashDuration = 0.12;
    this.hitFlashTimer    = 0;

    this.pointValue = 35;
  }

  createMesh() {
    const group = new THREE.Group();

    const shaftGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.6, 10);
    const shaftMat = new THREE.MeshStandardMaterial({ color: BASE_SHAFT_COLOR, metalness: 0.2, roughness: 0.6 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.castShadow = true;
    shaft.receiveShadow = true;

    const tipGeo = new THREE.ConeGeometry(0.28, 0.5, 6);
    const tipMat = new THREE.MeshStandardMaterial({ color: BASE_TIP_COLOR, metalness: 0.45, roughness: 0.35, emissive: 0x112244, emissiveIntensity: 0.3 });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = 0.8 + 0.25;
    tip.castShadow = true;
    tip.receiveShadow = true;

    group.add(shaft);
    group.add(tip);

    this.shaftMat = shaftMat;
    this.tipMat = tipMat;

    this.baseParts = { shaft, tip };

    group.position.y = 0.9; // 提高底部避免穿地

    if (isFancyVariant()) {
      const loader = new GLTFLoader();
      // 隐藏基础矛造型，避免叠在骷髅上
      if (this.baseParts) {
        if (this.baseParts.shaft) this.baseParts.shaft.visible = false;
        if (this.baseParts.tip) this.baseParts.tip.visible = false;
      }
      loader.load(
        "Assets/Skeleton.glb",
        (gltf) => {
          const model = gltf.scene;
          model.scale.setScalar(0.4);
          model.position.set(0, 0, 0);
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material && child.material.color) {
                this.gltfHitTargets.push(child.material);
                this.gltfBaseColors.push(child.material.color.clone());
              }
            }
          });
          group.add(model);
        },
        undefined,
        () => {
          // 加载失败时恢复基础矛可见
          if (this.baseParts) {
            if (this.baseParts.shaft) this.baseParts.shaft.visible = true;
            if (this.baseParts.tip) this.baseParts.tip.visible = true;
          }
        }
      );
    }

    return group;
  }

  onDeath() {
    addPoints(this.pointValue);
    super.onDeath();
  }

  onHit({ poiseDamage = 0, knockbackDir = null, knockbackPower = 0 } = {}) {
    this.hitFlashTimer = this.hitFlashDuration;
    if (this.shaftMat) this.shaftMat.color.copy(this.hitColor);
    if (this.tipMat) this.tipMat.color.copy(this.hitColor);
    if (this.gltfHitTargets.length > 0) {
      this.gltfHitTargets.forEach((mat) => {
        if (mat && mat.color) mat.color.copy(this.hitColor);
      });
    }

    if (poiseDamage > 0) {
      this.poise -= poiseDamage;
      if (this.poise < 0) this.poise = 0;
    }

    if (this.poise <= 0 && !this.isStunned) {
      this.isStunned = true;
      this.stunTimer = this.stunDuration;

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

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      if (this.hitFlashTimer <= 0) {
        if (this.shaftMat) this.shaftMat.color.copy(this.baseShaftColor);
        if (this.tipMat) this.tipMat.color.copy(this.baseTipColor);
        if (this.gltfHitTargets.length > 0) {
          this.gltfHitTargets.forEach((mat, idx) => {
            const base = this.gltfBaseColors[idx];
            if (mat && mat.color && base) mat.color.copy(base);
          });
        }
      }
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
      if (this.attackCooldown < 0) this.attackCooldown = 0;
    }

    if (this.isStunned) {
      this.stunTimer -= dt;

      if (this.knockbackVelocity.lengthSq() > 0) {
        const move = this.knockbackVelocity.clone().multiplyScalar(dt);
        this.tryMove(move);
        this.knockbackVelocity.multiplyScalar(0.9);
        if (this.knockbackVelocity.length() < 0.1) {
          this.knockbackVelocity.set(0, 0, 0);
        }
      }

      if (this.stunTimer <= 0) {
        this.isStunned = false;
        this.poise = this.maxPoise;
      }
      return;
    }

    if (this.poise < this.maxPoise) {
      this.poise += this.poiseRegenRate * dt;
      if (this.poise > this.maxPoise) this.poise = this.maxPoise;
    }

    tmpVec3.copy(playerPos).sub(this.mesh.position);
    const distance = tmpVec3.length();

    if (distance > this.chaseRange) return;

    const targetYaw = Math.atan2(tmpVec3.x, tmpVec3.z);
    this.mesh.rotation.y = targetYaw;

    if (distance > this.stopDistance) {
      tmpVec3.normalize();
      const move = tmpVec3.multiplyScalar(this.speed * dt);
      this.tryMove(move);
    }

    if (distance <= this.attackRange && damagePlayerCallback && this.attackCooldown <= 0) {
      damagePlayerCallback(this.attackDamage);
      this.attackCooldown = this.attackInterval + Math.random() * 0.6;
    }
  }

  tryMove(moveVec) {
    if (moveVec.lengthSq() === 0) return;

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
