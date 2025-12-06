// Map.js
import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

export const mapWalls = [];
export const TILE_SIZE = 2;

// 一个开放场景地图配置：地面 + 多个箱子/房子/树等 Box 障碍
const OPEN_MAP_CONFIG = {
  groundSize: 200,
  obstacles: [
    // 房子
    { type: "house", x: -10, z: -15, sx: 6, sy: 4,  sz: 6 },
    { type: "house", x:  12, z: -20, sx: 8, sy: 5,  sz: 8 },

    // 石头堆
    { type: "rock", x: 5,  z: -5,  sx: 2,   sy: 1.5, sz: 2 },
    { type: "rock", x: 8,  z: -6,  sx: 1.5, sy: 1,   sz: 1.5 },
    { type: "rock", x: 4,  z: -2,  sx: 1.2, sy: 0.8, sz: 1.2 },

    // 一堵长墙
    { type: "wall", x: -20, z: 0,  sx: 20,  sy: 3,   sz: 1 },

    // 树
    { type: "tree", x: 15, z: 10, sx: 1,   sy: 5,   sz: 1 },
    { type: "tree", x: 18, z: 12, sx: 1,   sy: 4,   sz: 1 },

    // 中央高台
    { type: "platform", x: 0, z: -10, sx: 10, sy: 1, sz: 10 },
  ],
};

export function clearMap(scene) {
  for (const obj of mapWalls) {
    scene.remove(obj);
  }
  mapWalls.length = 0;
}

/**
 * 构建开放地图
 */
export function buildMap(scene) {
  clearMap(scene);

  const groundSize = OPEN_MAP_CONFIG.groundSize;

  // 地面（如果你在 main 里已经建过地面，这一段可以删掉）
  const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // 障碍物
  const baseGeo = new THREE.BoxGeometry(1, 1, 1);

  for (const cfg of OPEN_MAP_CONFIG.obstacles) {
    const mat = new THREE.MeshStandardMaterial({
      color: colorForType(cfg.type),
    });

    const mesh = new THREE.Mesh(baseGeo, mat);
    mesh.scale.set(cfg.sx, cfg.sy, cfg.sz);
    mesh.position.set(cfg.x, cfg.sy / 2, cfg.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    scene.add(mesh);
    mapWalls.push(mesh); // 加进碰撞数组
  }
}

function colorForType(type) {
  switch (type) {
    case "house":    return 0x666666;
    case "rock":     return 0x555555;
    case "wall":     return 0x444444;
    case "tree":     return 0x226622;
    case "platform": return 0x333333;
    default:         return 0x777777;
  }
}
