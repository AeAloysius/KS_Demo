// Ring_Mystic.js
// 神秘戒指：每次造成伤害时回复伤害的 10%
import * as THREE from "../libs/CS559-Three/build/three.module.js";

export const MYSTIC_RING_ID = "mystic_ring";

export const MysticRing = {
  id: MYSTIC_RING_ID,
  name: "Mystic Ring",
  desc: "Restore 10% of damage dealt as health on each hit.",
  lifeStealRatio: 0.10,
  // 供背包预览用的简易建模函数
  buildMesh: () => {
    const geo = new THREE.TorusGeometry(0.28, 0.08, 16, 24);
    const mat = new THREE.MeshStandardMaterial({ color: 0xccaa55, emissive: 0x332200, metalness: 0.75, roughness: 0.25 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  },
};
