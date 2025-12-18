// weapons/scythe.js
// 镰刀：蓄力慢但伤害高、削韧和击退强
import * as THREE from "../libs/CS559-Three/build/three.module.js";
import { WeaponSwordBase } from "./WeaponSwordBase.js";

export class Scythe extends WeaponSwordBase {
  static displayName = "Scythe";
  static description = "Large scythe with slow charge but high damage and strong poise break.";
  static stats = {
    damage: 18,
    range: 4.8,
    cooldown: 0.7,
    chargeTime: 1.2,
  };

  constructor(camera) {
    super(camera, {
      damage: 18,
      maxDistance: 4.8,
      cooldownTime: 0.7,
      attackDuration: 0.55,
      windupFrac: 0.35,
      recoveryFrac: 0.22,
      chargeTimeMax: 1.2,
      chargeDamageMul: 3.0,
      chargePoiseMul: 3.2,
      minChargeRatio: 0.1,
      poiseDamage: 45,
      chargeMoveMul: 0.35,
      knockbackPower: 9.0,
    });
  }

  // 更偏双手持握的姿势
  getIdlePose() {
    return {
      pos: new THREE.Vector3(0.9, -0.55, -0.9),
      rot: new THREE.Euler(0, 90 * (Math.PI / 180), 0),
    };
  }

  getWindupPose() {
    return {
      pos: new THREE.Vector3(1.0, -0.25, -0.75),
      rot: new THREE.Euler(-80 * (Math.PI / 180), 170 * (Math.PI / 180), 60 * (Math.PI / 180)),
    };
  }

  getSlashPose() {
    return {
      pos: new THREE.Vector3(-0.35, -0.85, -1.1),
      rot: new THREE.Euler(0, 170 * (Math.PI / 180), -110 * (Math.PI / 180)),
    };
  }


    getWindupPoseAlt() {
      return {
        pos: new THREE.Vector3(1.0, -0.25, -0.75),
      rot: new THREE.Euler(30 * (Math.PI / 180), 20 * (Math.PI / 180), -30 * (Math.PI / 180)),
      };
    }
  
    getSlashPoseAlt() {
      return {
        pos: new THREE.Vector3(-0.35, -0.85, -1.1),
      rot: new THREE.Euler(0, 150 * (Math.PI / 180), -130 * (Math.PI / 180)),
      };
    }

  // 镰刀造型：长柄 + 弧刃
  createMesh() {
    const group = new THREE.Group();

    const handleGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.6, 10);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.2, roughness: 0.7 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = 0.2;

    // 横梁
    const beamGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.5, 10);
    const beam = new THREE.Mesh(beamGeo, handleMat);
    beam.rotation.z = Math.PI / 2;
    beam.position.set(0.15, 1.05, 0);


    // 弧形刃：用细长盒子和旋转模拟弧度
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc7c7cf, metalness: 0.8, roughness: 0.25 });
    const bladeGeo = new THREE.BoxGeometry(0.08, 0.6, 0.08);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0.5, 0.9, 0);
    blade.rotation.z = -130 * (Math.PI / 180);

    group.add(handle);
    group.add(beam);
    group.add(blade);

    // 整体绕长柄轴（Y 轴）旋转 90°
    group.rotation.x = Math.PI / 2;

    return group;
  }
}
