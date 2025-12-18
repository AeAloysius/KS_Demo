// Map.js
import * as THREE from "./libs/CS559-Three/build/three.module.js";

export const mapWalls = [];
export let groundMesh = null;
export const TILE_SIZE = 2;

// 类魂起始村落：围墙 + 庭院 + 小村
const OPEN_MAP_CONFIG = {
  groundSize: 320,
  obstacles: [
    // 出生庭院左右残墙，留出正面开口
    { type: "wall", x: -10, z: 6,  sx: 2, sy: 3,   sz: 16 },
    { type: "wall", x:  10, z: 6,  sx: 2, sy: 3,   sz: 16 },
    // 破败门框（中间留通道）
    { type: "gate", x:  -6, z: 14, sx: 3, sy: 4,   sz: 1 },
    { type: "gate", x:   6, z: 14, sx: 3, sy: 4,   sz: 1 },

    // 庭院内的倒塌石栏与柱子
    { type: "ruin",   x: -4, z: -6, sx: 6,  sy: 2,   sz: 2 },
    { type: "ruin",   x:  4, z: -6, sx: 6,  sy: 2,   sz: 2 },
    { type: "pillar", x: -6, z:  6, sx: 1,  sy: 3,   sz: 1 },
    { type: "pillar", x:  6, z:  6, sx: 1,  sy: 3,   sz: 1 },

    // 通往村口的残破木栅（连续，不留大口）
    { type: "fence", x: -10, z: 22, sx: 4, sy: 1.5, sz: 8 },
    { type: "fence", x:  -2, z: 22, sx: 4, sy: 1.5, sz: 8 },
    { type: "fence", x:   6, z: 22, sx: 4, sy: 1.5, sz: 8 },
    { type: "fence", x:  14, z: 22, sx: 4, sy: 1.5, sz: 8 },

    // 村口路面的石台，营造高低差
    { type: "platform", x: 0,  z: 26, sx: 6, sy: 0.6, sz: 10 },

    // 村屋布局（基础版保持原尺寸）
    { type: "house", x: -12, z: 36, sx: 8, sy: 5,  sz: 8 },
    { type: "house", x:  12, z: 34, sx: 7, sy: 5,  sz: 9 },
    { type: "house", x:  -4, z: 42, sx: 6, sy: 4.5, sz: 6 },
    { type: "house", x: -16, z: 52, sx: 6, sy: 4,  sz: 7 },
    { type: "house", x:   8, z: 52, sx: 9, sy: 5,  sz: 7 },
    { type: "house", x: -10, z: 60, sx: 7, sy: 5,  sz: 8 },
    { type: "house", x:  12, z: 60, sx: 6, sy: 4.5, sz: 7 },
    // 村落北端挡墙后移，给更大纵深
    { type: "wall",  x:   0, z: 120, sx: 26, sy: 4,  sz: 2 },

    // 村口杂物/石堆
    { type: "rock", x: -3, z: 28, sx: 1.6, sy: 1.2, sz: 1.4 },
    { type: "rock", x:  4, z: 30, sx: 1.4, sy: 1.0, sz: 1.2 },
    { type: "rock", x: -8, z: 32, sx: 1.5, sy: 1.1, sz: 1.3 },
    { type: "rock", x: 10, z: 32, sx: 1.2, sy: 0.9, sz: 1.0 },

    // 石锥、方尖碑点缀
    { type: "spike",   x: -8,  z: 18, sx: 1.2, sy: 2.4, sz: 1.2 },
    { type: "obelisk", x:  8,  z: 20, sx: 1.2, sy: 3.4, sz: 1.2 },
    { type: "spike",   x: 14,  z: 38, sx: 1.0, sy: 2.2, sz: 1.0 },
    { type: "obelisk", x: -14, z: 40, sx: 1.3, sy: 3.6, sz: 1.3 },
    { type: "obelisk", x:   0,  z: 46, sx: 1.1, sy: 3.2, sz: 1.1 },
    { type: "spike",   x: -6,  z: 56, sx: 1.0, sy: 2.0, sz: 1.0 },
    { type: "spike",   x: 10,  z: 56, sx: 1.1, sy: 2.1, sz: 1.1 },

    // 环境树木
    { type: "tree", x: -18, z: 32, sx: 1, sy: 5, sz: 1 },
    { type: "tree", x:  18, z: 30, sx: 1, sy: 4.5, sz: 1 },
    { type: "tree", x:  -6, z: 46, sx: 1, sy: 4.5, sz: 1 },
    { type: "tree", x:  12, z: 58, sx: 1, sy: 5.5, sz: 1 },
    { type: "tree", x: -18, z: 58, sx: 1, sy: 5.2, sz: 1 },
    { type: "tree", x: -4,  z: 64, sx: 1, sy: 4.8, sz: 1 },
    { type: "tree", x: 16,  z: 66, sx: 1, sy: 5.0, sz: 1 },

    // 远端右侧 Boss 区域围墙（扩大场地，西侧留更宽入口，中心偏东）
    { type: "wall", x: 36, z: 68, sx: 20, sy: 4, sz: 2 },  // 北边（x 26-46）
    { type: "wall", x: 36, z: 84, sx: 20, sy: 4, sz: 2 },  // 南边（x 26-46）
    { type: "wall", x: 26, z: 72, sx: 2,  sy: 4, sz: 8 },  // 西上段（z 68-76）
    { type: "wall", x: 26, z: 84, sx: 2,  sy: 4, sz: 8 },  // 西下段（z 80-88）- 留出 76-80 门口
    { type: "wall", x: 46, z: 76, sx: 2,  sy: 4, sz: 16 }, // 东侧（z 68-84）
    // 通往 Boss 的路上增加一些阻挡和掩体
    { type: "house", x: 18, z: 66, sx: 7, sy: 4.5, sz: 7 },
    { type: "ruin",  x: 14, z: 72, sx: 5, sy: 2.5, sz: 3 },
    { type: "rock",  x: 20, z: 76, sx: 1.6, sy: 1.2, sz: 1.4 },

    // 左侧缺口的迷宫（放大通道宽度，终点放戒指）
    // 外围框
    { type: "wall", x: -42, z: 68, sx: 2,  sy: 3.5, sz: 24 }, // 西侧外墙
    { type: "wall", x: -14, z: 68, sx: 2,  sy: 3.5, sz: 24 }, // 东侧外墙
    { type: "wall", x: -28, z: 56, sx: 28, sy: 3.5, sz: 2 },  // 北侧外墙
    { type: "wall", x: -28, z: 92, sx: 28, sy: 3.5, sz: 2 },  // 南侧外墙
    // 入口通道（北侧开口位于 x=-28,z=58），留 8 米宽度
    { type: "wall", x: -35, z: 60, sx: 6,  sy: 3.5, sz: 2 },  // 北口左挡
    { type: "wall", x: -21, z: 60, sx: 6,  sy: 3.5, sz: 2 },  // 北口右挡
    // 内部隔断形成转折，通道最窄处保持 >4m
    { type: "wall", x: -33, z: 70, sx: 10, sy: 3.5, sz: 2 },  // 第一横墙（让出右侧更宽）
    { type: "wall", x: -22, z: 76, sx: 2,  sy: 3.5, sz: 10 }, // 纵墙引导右转
    { type: "wall", x: -32, z: 82, sx: 12, sy: 3.5, sz: 2 },  // 第二横墙
    { type: "wall", x: -24, z: 86, sx: 6,  sy: 3.5, sz: 2 },  // 终点前隔断（保留 5m 通道）
    { type: "wall", x: -36, z: 74, sx: 2,  sy: 3.5, sz: 12 }, // 左内墙
    // 终点小房间围挡（留中央空地）
    { type: "wall", x: -28, z: 88, sx: 14, sy: 3.5, sz: 2 },
    { type: "wall", x: -22, z: 86, sx: 2,  sy: 3.5, sz: 6 },

    // 迷宫内的几何装饰（不挡路）
    { type: "pillar", x: -32, z: 66, sx: 1,  sy: 3,   sz: 1 },
    { type: "obelisk", x: -20, z: 72, sx: 1.2, sy: 3.2, sz: 1.2 },
    { type: "rock",  x: -34, z: 78, sx: 1.4, sy: 1.0, sz: 1.2 },
    { type: "pillar", x: -30, z: 84, sx: 1,  sy: 3,   sz: 1 },
    { type: "spike", x: -26, z: 88, sx: 1.0, sy: 2.0, sz: 1.0 },

    // 远端悬崖围挡，防止跑出地图（再次外移，给 z>60 留出更大缓冲）
    { type: "cliff", x: 0,    z: 160, sx: 320, sy: 6, sz: 4 },
    { type: "cliff", x: 0,    z: -160, sx: 320, sy: 6, sz: 4 },
    { type: "cliff", x: -160, z: 0,   sx: 4,   sy: 6, sz: 320 },
    { type: "cliff", x:  160, z: 0,   sx: 4,   sy: 6, sz: 320 },
  ],
};

export function clearMap(scene) {
  for (const obj of mapWalls) {
    scene.remove(obj);
  }
  mapWalls.length = 0;
  if (groundMesh && scene) {
    scene.remove(groundMesh);
    groundMesh = null;
  }
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
  groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // 障碍物
  const geoCache = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cone: new THREE.ConeGeometry(0.5, 1, 6),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
    pyramid: new THREE.ConeGeometry(0.7, 1, 4),
  };

  for (const cfg of OPEN_MAP_CONFIG.obstacles) {
    const mat = new THREE.MeshStandardMaterial({
      color: colorForType(cfg.type),
    });

    const geo = geometryForType(cfg.type, geoCache);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(cfg.sx, cfg.sy, cfg.sz);
    mesh.position.set(cfg.x, cfg.sy / 2, cfg.z);
    mesh.userData.type = cfg.type;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    scene.add(mesh);
    mapWalls.push(mesh); // 加进碰撞数组
  }
}

/**
 * 切换某类障碍物（例如 house）是否可见，用于精美版用外部模型替换视觉效果。
 * 碰撞仍然存在，因为 mesh 仍在场景中。
 */
export function setObstacleVisibility(type, visible) {
  for (const obj of mapWalls) {
    if (obj && obj.userData && obj.userData.type === type) {
      obj.visible = visible;
    }
  }
}

function colorForType(type) {
  switch (type) {
    case "house":    return 0x666666;
    case "rock":     return 0x555555;
    case "wall":     return 0x444444;
    case "gate":     return 0x554433;
    case "fence":    return 0x664422;
    case "pillar":   return 0x555555;
    case "ruin":     return 0x4a4a4a;
    case "cliff":    return 0x2f2f2f;
    case "tree":     return 0x226622;
    case "spike":    return 0x6a5a4a;
    case "obelisk":  return 0x555577;
    case "platform": return 0x333333;
    default:          return 0x777777;
  }
}

function geometryForType(type, cache) {
  switch (type) {
    case "pillar":
    case "tree":
      return cache.cylinder;
    case "spike":
      return cache.cone;
    case "obelisk":
      return cache.pyramid;
    default:
      return cache.box;
  }
}

// 提供地面 mesh 访问，用于精美版替换材质
export function getGroundMesh() {
  return groundMesh;
}
