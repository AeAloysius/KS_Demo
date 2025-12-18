// enemies/Enemy_Boss.js
// Boss 敌人：高血量、高伤害，慢速压迫型
import * as THREE from "../libs/CS559-Three/build/three.module.js";
import { EnemyBase } from "./EnemyBase.js";
import { mapWalls } from "../Map.js";
import { addPoints } from "../Points.js";
import { GLTFLoader } from "../libs/CS559-Three/examples/jsm/loaders/GLTFLoader.js";

const tmpVec3 = new THREE.Vector3();

function isFancyVariant() {
  try {
    return localStorage?.getItem("ks_demo_variant") === "fancy";
  } catch (e) {
    return false;
  }
}

export class Enemy_Boss extends EnemyBase {
  constructor(scene, position) {
    super(scene, position, {
      hp: 200,
      speed: 1.5,
    });

    this.chaseRange     = 18;
    this.stopDistance   = 2.5;
    this.attackRange    = 2.8;
    this.attackDamage   = 15;
    this.attackInterval = 1.4;
    this.attackCooldown = 0;

    this.radius = 0.9;

    this.maxPoise       = 80;
    this.poise          = this.maxPoise;
    this.poiseRegenRate = 35;

    this.isStunned    = false;
    this.stunDuration = 0.6;
    this.stunTimer    = 0;
    this.knockbackVelocity = new THREE.Vector3();

    this.baseColor        = this.mesh.material.color.clone();
    this.hitColor         = new THREE.Color(0xaa3333);
    this.hitFlashDuration = 0.12;
    this.hitFlashTimer    = 0;

    this.pointValue = 200;
  }

  createMesh() {
    const geo = new THREE.BoxGeometry(1.6, 2.8, 1.6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x552222, metalness: 0.25, roughness: 0.5, emissive: 0x220000, emissiveIntensity: 0.2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = 1.4;

    if (isFancyVariant()) {
      const loader = new GLTFLoader();
      loader.load(
        "Assets/Slime Enemy.glb",
        (gltf) => {
          const model = gltf.scene;
          model.scale.setScalar(220);
          model.position.set(0, 0.0, 0);
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          mesh.add(model);
          if (mesh.material) mesh.material.visible = false;
        },
        undefined,
        () => {
          /* keep box fallback if load fails */
        }
      );
    }

    return mesh;
  }

  onDeath() {
    addPoints(this.pointValue);
    super.onDeath();
  }

  onHit({ poiseDamage = 0, knockbackDir = null, knockbackPower = 0 } = {}) {
    this.hitFlashTimer = this.hitFlashDuration;
    this.mesh.material.color.copy(this.hitColor);

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
        this.knockbackVelocity.copy(dir.multiplyScalar(knockbackPower * 0.7));
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
        this.mesh.material.color.copy(this.baseColor);
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
      this.attackCooldown = this.attackInterval + Math.random() * 0.5;
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
