// MazeGlow.js
// 迷宫专用材料，实现方式与荧光花类似，但只刷新在迷宫内。
import * as THREE from "../libs/CS559-Three/build/three.module.js";
import { MaterialBase } from "./MaterialBase.js";

export class MazeGlow extends MaterialBase {
  constructor() {
    // 位置沿迷宫通路分布，避开墙体
    const positions = [
      new THREE.Vector3(-28, 0, 62),
      new THREE.Vector3(-32, 0, 70),
      new THREE.Vector3(-24, 0, 74),
      new THREE.Vector3(-30, 0, 80),
      new THREE.Vector3(-26, 0, 86),
    ];
    super({
      name: "Glowshroom",
      positions,
      pickupRadius: 2.0,
      buildMesh: MazeGlow.buildMesh,
      description: "A faintly glowing mushroom found deep in the maze; collectable material.",
    });
  }

  static buildMesh() {
    const group = new THREE.Group();

    // 菌柄
    const stemGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.4, 10);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x885533, roughness: 0.8, metalness: 0.05 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.2;

    // 菌盖
    const capGeo = new THREE.SphereGeometry(0.24, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.4);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x66aaff, emissive: 0x224488, emissiveIntensity: 0.7, metalness: 0.15, roughness: 0.35 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.42;

    // 顶部发光点
    const glowGeo = new THREE.SphereGeometry(0.07, 10, 10);
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x99ccff, emissiveIntensity: 1.0, roughness: 0.15, metalness: 0.2 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.56;

    group.add(stem);
    group.add(cap);
    group.add(glow);

    return group;
  }
}
