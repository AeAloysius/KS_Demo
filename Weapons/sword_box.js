// weapons/sword_box.js
import * as THREE from "three";
import { WeaponSwordBase } from "./WeaponSwordBase.js";


export class Sword_Box extends WeaponSwordBase {
  // 可选：给背包用的元数据
  static displayName = "Broken Sword";
  static description = "Plain short steel sword; charged attacks deal higher damage and poise break.";
  static stats = {
    damage: 10,
    range: 3.5,
    cooldown: 0.45,
    chargeTime: 0.7,
  };

  constructor(camera) {
    super(camera, {
      damage: 7,         // 基础伤害
      maxDistance: 2,   // 攻击距离
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
    // 以长剑模型为基，做一把断掉前端的短剑
    const group = new THREE.Group();

    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc7c7cf, metalness: 0.75, roughness: 0.3 });
    const guardMat = new THREE.MeshStandardMaterial({ color: 0x454545, metalness: 0.35, roughness: 0.55 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.2, roughness: 0.7 });

    // 主刀身：较短，方截面，顶部直接斜切一块表现断刃
    const bladeGeo = new THREE.BoxGeometry(0.08, 0.7, 0.08);
    const pos = bladeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const t = THREE.MathUtils.clamp((x + 0.08) / 0.16, 0, 1); // 右侧越靠边，削去越多
        pos.setY(i, y - 0.12 * t);
        pos.setZ(i, z + 0.04 * t);
      }
    }
    pos.needsUpdate = true;
    bladeGeo.computeVertexNormals();
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.35;

    // 护手
    const guardGeo = new THREE.BoxGeometry(0.2, 0.08, 0.16);
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.y = -0.05;

    // 柄
    const handleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.32, 10);
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = -0.25;

    group.add(blade);
    group.add(guard);
    group.add(handle);

    return group;
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
