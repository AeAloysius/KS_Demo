// enemies/EnemyBase.js
import * as THREE from "three";

export class EnemyBase {
  constructor(scene, position = new THREE.Vector3(), config = {}) {
    this.scene = scene;

    // 通用属性，可被子类通过 config 覆盖
    this.maxHp  = config.hp    ?? 30;
    this.hp     = this.maxHp;
    this.speed  = config.speed ?? 0;    // 以后做 AI 用
    this.alive  = true;

    // 子类来决定外形
    this.mesh = this.createMesh();
    this.mesh.position.copy(position);

    scene.add(this.mesh);
  }

  // 默认创建一个简单方块（子类一般会 override）
  createMesh() {
    const geo = new THREE.BoxGeometry(0.8, 1.6, 0.8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x772222 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // 每帧更新（dt：秒，playerPos：玩家世界坐标），以后可以在这里写寻路 / 巡逻
  update(dt, playerPos) {
    // 现在先不动，纯站桩
  }

  /**
   * 受伤
   * @param {number} damage  生命扣减
   * @param {object} options 额外受击信息，例如：
   *    { poiseDamage, knockbackDir, knockbackPower }
   */
  takeDamage(damage, options = {}) {
    if (!this.alive) return;

    this.hp -= damage;

    // 交给子类处理受击效果（韧性 / 变色 / 击退等）
    if (typeof this.onHit === "function") {
      this.onHit(options);
    }

    if (this.hp <= 0) {
      this.die();
    }
  }

  // 死亡
  die() {
    if (!this.alive) return;
    this.alive = false;
    this.onDeath();
  }

  // 默认死亡行为：从场景里移除 mesh
  onDeath() {
    this.scene.remove(this.mesh);
  }
}
