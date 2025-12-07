// MaterialBase.js
// 抽象材料基类，负责位置、拾取、计数与刷新。
import * as THREE from "three";

let defaultMaterial = null;

export class MaterialBase {
  constructor(options) {
    this.name = options.name;
    this.positions = options.positions || [];
    this.pickupRadius = options.pickupRadius ?? 1.6;
    this.buildMesh = options.buildMesh;
    this.pickups = [];
    this.count = 0;
    this.description = options.description || "";
  }

  getName() {
    return this.name;
  }

  getCount() {
    return this.count;
  }

  getPickupRadius() {
    return this.pickupRadius;
  }

  getDescription() {
    return this.description;
  }

  createPreviewMesh() {
    if (typeof this.buildMesh === "function") {
      return this.buildMesh();
    }
    return null;
  }

  setCount(value = 0) {
    if (!Number.isFinite(value)) return;
    this.count = Math.max(0, Math.floor(value));
  }

  addCount(delta = 0) {
    if (!Number.isFinite(delta)) return;
    this.count = Math.max(0, this.count + Math.floor(delta));
  }

  init(scene) {
    this.reset(scene);
  }

  reset(scene) {
    this.pickups.forEach((p) => {
      if (p.mesh && p.mesh.parent === scene) scene.remove(p.mesh);
    });
    this.pickups.length = 0;

    this.positions.forEach((pos) => {
      const mesh = this.buildMesh();
      mesh.position.copy(pos);
      mesh.position.y = mesh.position.y || 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      this.pickups.push({ mesh, collected: false });
    });
  }

  tryPickup(scene, playerPos) {
    const R = this.pickupRadius;
    for (const p of this.pickups) {
      if (p.collected || !p.mesh) continue;
      const dist = p.mesh.position.distanceTo(playerPos);
      if (dist <= R) {
        p.collected = true;
        if (p.mesh.parent === scene) scene.remove(p.mesh);
        this.addCount(1);
        return this.name;
      }
    }
    return null;
  }

  getMeshes() {
    return this.pickups.map((p) => p.mesh).filter(Boolean);
  }
}

// ===== 默认材料委托 API（可被上层设置具体实例） =====

export function setDefaultMaterial(instance) {
  defaultMaterial = instance || null;
}

function ensureDefault() {
  if (!defaultMaterial) {
    throw new Error("No default material instance set. Call setDefaultMaterial().");
  }
  return defaultMaterial;
}

export function getMaterialCount() {
  return ensureDefault().getCount();
}

export function setMaterialCount(value = 0) {
  ensureDefault().setCount(value);
}

export function addMaterialCount(delta = 0) {
  ensureDefault().addCount(delta);
}

export function initMaterials(scene) {
  ensureDefault().init(scene);
}

export function resetMaterials(scene) {
  ensureDefault().reset(scene);
}

export function tryPickupMaterial(scene, playerPos) {
  return ensureDefault().tryPickup(scene, playerPos);
}

export function getMaterialMeshes() {
  return ensureDefault().getMeshes();
}

export function getMaterialName() {
  return ensureDefault().getName();
}

export function getMaterialDescription() {
  return ensureDefault().getDescription();
}

export function getMaterialPreviewMesh() {
  return ensureDefault().createPreviewMesh();
}

export function getMaterialPickupRadius() {
  return ensureDefault().getPickupRadius();
}
