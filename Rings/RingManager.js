// RingManager.js
// 简单的戒指收集/效果管理
import { MysticRing, MYSTIC_RING_ID } from "./Ring_Mystic.js";

const allRings = [MysticRing];
const ownedRingIds = new Set();
let equippedRingId = null; // 当前生效的戒指，仅允许一枚

export function addRingById(id) {
  if (!id) return null;
  const ring = allRings.find((r) => r.id === id);
  if (ring) ownedRingIds.add(ring.id);
  return ring || null;
}

export function addRing(ring) {
  if (!ring || !ring.id) return;
  ownedRingIds.add(ring.id);
}

export function equipRingById(id) {
  if (!id) {
    equippedRingId = null;
    return null;
  }
  const ring = allRings.find((r) => r.id === id);
  if (!ring || !ownedRingIds.has(ring.id)) return null; // 必须已拥有
  equippedRingId = ring.id;
  return ring;
}

export function getEquippedRingId() {
  return equippedRingId;
}

export function isRingEquipped(id) {
  return equippedRingId === id;
}

export function hasRing(id) {
  return ownedRingIds.has(id);
}

export function getRingEntries() {
  return allRings.map((ring) => ({
    id: ring.id,
    name: ring.name,
    desc: ring.desc,
    count: ownedRingIds.has(ring.id) ? 1 : 0,
    buildMesh: ring.buildMesh || null,
    equipped: equippedRingId === ring.id,
  }));
}

export function getRingPreviewMesh(id) {
  const ring = allRings.find((r) => r.id === id);
  if (!ring) return null;
  if (typeof ring.buildMesh === "function") {
    try {
      return ring.buildMesh();
    } catch (err) {
      console.warn("Failed to build ring preview model", err);
    }
  }
  return null;
}

export function getLifeStealRatio() {
  return equippedRingId === MYSTIC_RING_ID ? MysticRing.lifeStealRatio : 0;
}

export function resetRings() {
  ownedRingIds.clear();
  equippedRingId = null;
}

export function serializeRings() {
  return {
    owned: Array.from(ownedRingIds),
    equipped: equippedRingId,
  };
}

export function restoreRings(ids = []) {
  ownedRingIds.clear();
  equippedRingId = null;

  if (Array.isArray(ids)) {
    ids.forEach((id) => addRingById(id));
    return;
  }

  if (ids && Array.isArray(ids.owned)) {
    ids.owned.forEach((id) => addRingById(id));
  }
  if (ids && ids.equipped) {
    equipRingById(ids.equipped);
  }
}
