// weapons/sword_box.js
import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { WeaponSwordBase } from "./WeaponSwordBase.js";


export class Sword_Box extends WeaponSwordBase {
  // 可选：给背包用的元数据
  static displayName = "断剑";
  static description = "普通的钢制短剑，蓄力后可以打出更高的伤害和削韧。";
  static stats = {
    damage: 10,
    range: 3.5,
    cooldown: 0.45,
    chargeTime: 0.7,
  };

  constructor(camera) {
    super(camera, {
      damage: 10,         // 基础伤害
      maxDistance: 3.5,   // 攻击距离
      cooldownTime: 0.45, // 冷却
      attackDuration: 0.35,
      windupFrac: 0.25,
      recoveryFrac: 0.2,

      // 新增：蓄力相关
      chargeTimeMax: 0.7,     // 满蓄时间（秒）
      chargeDamageMul: 2.2,   // 满蓄时伤害倍率
      chargePoiseMul:  2.5,   // 满蓄时削韧倍率
      minChargeRatio:  0.0,   // 点一下也有最小蓄力
      poiseDamage:     15,    // 基础削韧值

      chargeMoveMul:   0.4,   // 蓄力时移动速度
    });
  }
  // 几何体可以自己定义（比默认略细一点）
  createMesh() {
    const geo = new THREE.BoxGeometry(0.05, 0.9, 0.15);
    const mat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
    return new THREE.Mesh(geo, mat);
  }

  // 下面这三个可以先用父类默认的动作，
  // 如果你想做“重剑/轻剑”不同动作，再在子类里单独 override

  // getIdlePose() {
  //   return {
  //     pos: new THREE.Vector3(0.5, -0.6, -0.9),
  //     rot: new THREE.Euler(-0.5, 1.0, 0),
  //   };
  // }

  // getWindupPose() {
  //   return {
  //     pos: new THREE.Vector3(0.55, -0.4, -0.8),
  //     rot: new THREE.Euler(-0.9, 1.3, 0.0),
  //   };
  // }

  // getSlashPose() {
  //   return {
  //     pos: new THREE.Vector3(0.25, -1.0, -1.3),
  //     rot: new THREE.Euler(0.3, 0.2, 0.6),
  //   };
  // }
}
