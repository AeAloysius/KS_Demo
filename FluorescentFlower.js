// FluorescentFlower.js
// 荧光花材料实现，继承 MaterialBase。
import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { MaterialBase } from "./MaterialBase.js";

export class FluorescentFlower extends MaterialBase {
  constructor() {
    const positions = [
      new THREE.Vector3(4, 0, 4),
      new THREE.Vector3(-6, 0, 8),
      new THREE.Vector3(10, 0, -6),
      new THREE.Vector3(-12, 0, -2),
    ];
    super({
      name: "荧光花",
      positions,
      pickupRadius: 2.0,
      buildMesh: FluorescentFlower.buildMesh,
      description: "夜间会微微发光的花朵，可以作为材料收集。",
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
