// weapons/sword_long.js
import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { WeaponSwordBase } from "./WeaponSwordBase.js";

export class Sword_Long extends WeaponSwordBase {
  static displayName = "长剑";
  static description = "更长的单手剑，攻击距离和伤害略高。";
  static stats = {
    damage: 14,
    range: 4.2,
    cooldown: 0.5,
    chargeTime: 0.8,
  };

  constructor(camera) {
    super(camera, {
      damage: 14,
      maxDistance: 4.2,
      cooldownTime: 0.5,
      attackDuration: 0.4,
      windupFrac: 0.28,
      recoveryFrac: 0.22,
      chargeTimeMax: 0.8,
      chargeDamageMul: 2.3,
      chargePoiseMul: 2.6,
      minChargeRatio: 0.0,
      poiseDamage: 32,
      chargeMoveMul: 0.55,
      knockbackPower: 7.0,
    });
  }

  createMesh() {
    // 由简单几何拼装长剑：柄+护手+刃
    const group = new THREE.Group();

    // 方截面刀身，便于与四棱锥尖端对齐
    const bladeGeo = new THREE.BoxGeometry(0.08, 1.25, 0.08);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc7c7cf, metalness: 0.8, roughness: 0.25 });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.6;

    // 锋尖：四棱锥，底面与刀身顶面重合（方形 0.08x0.08）
    const tipRadius = 0.08 / Math.sqrt(2); // 使得方形边长为 0.08
    const tipGeo = new THREE.ConeGeometry(tipRadius, 0.28, 4);
    const tip = new THREE.Mesh(tipGeo, bladeMat);
    tip.position.y = blade.position.y + bladeGeo.parameters.height / 2 + 0.14;
    tip.rotation.y = Math.PI / 4; // 使棱面与刀身方形对齐

    const guardGeo = new THREE.BoxGeometry(0.1, 0.08, 0.18);
    const guardMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.4, roughness: 0.5 });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.y = -0.05;

    const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 10);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.2, roughness: 0.7 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = 0;
    handle.position.y = -0.25;

    group.add(blade);
    group.add(tip);
    group.add(guard);
    group.add(handle);

    return group;
  }
}
