// FluorescentFlower.js
// 荧光花材料实现，继承 MaterialBase。
import * as THREE from "three";
import { MaterialBase } from "./MaterialBase.js";

export class FluorescentFlower extends MaterialBase {
  constructor() {
    const positions = [
      // 庭院与入口
      new THREE.Vector3(-2, 0, 6),
      new THREE.Vector3(6, 0, 10),
      new THREE.Vector3(-8, 0, 14),
      new THREE.Vector3(10, 0, 18),
      // 村口与栅栏内侧
      new THREE.Vector3(-12, 0, 22),
      new THREE.Vector3(0, 0, 24),
      new THREE.Vector3(12, 0, 26),
      // 村内道路两侧（避开房屋与检查点）
      new THREE.Vector3(-14, 0, 32),
      new THREE.Vector3(8, 0, 34),
      new THREE.Vector3(-6, 0, 38),
      new THREE.Vector3(14, 0, 44),
      new THREE.Vector3(-10, 0, 48),
      new THREE.Vector3(4, 0, 52),
      new THREE.Vector3(-4, 0, 56),
      // 迷宫入口与中段
      new THREE.Vector3(-20, 0, 62),
      new THREE.Vector3(-12, 0, 64),
      new THREE.Vector3(-4, 0, 66),
      new THREE.Vector3(-16, 0, 72),
      // Boss 路线边缘（不挡路）
      new THREE.Vector3(18, 0, 70),
      new THREE.Vector3(22, 0, 76),
    ];
    super({
      name: "Fluorescent Flower",
      positions,
      pickupRadius: 2.0,
      buildMesh: FluorescentFlower.buildMesh,
      description: "A flower that glows softly at night; collectable as material.",
    });
  }

  static buildMesh() {
    const group = new THREE.Group();

    const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x226622, metalness: 0.1, roughness: 0.8 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.3;

    const petalGeo = new THREE.ConeGeometry(0.18, 0.25, 6);
    const petalMat = new THREE.MeshStandardMaterial({ color: 0x55ccff, emissive: 0x113344, metalness: 0.2, roughness: 0.4 });
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.position.y = 0.65;

    const glowGeo = new THREE.SphereGeometry(0.05, 10, 10);
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x88ccff, emissiveIntensity: 0.8, metalness: 0.1, roughness: 0.2 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.78;

    group.add(stem);
    group.add(petal);
    group.add(glow);

    return group;
  }
}
