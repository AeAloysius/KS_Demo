// main.js
import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import {
  createPlayer,
  updatePlayer,
  // 👇 把 player 里的输入函数改名导入，避免和本文件冲突
  handleKeyDown as playerHandleKeyDown,
  handleKeyUp as playerHandleKeyUp,
  handleMouseMove,
  handleMouseDown,
  handleMouseUp,
  getPlayerPosition,
  damagePlayer,
  getPlayerHp,
  PLAYER_MAX_HP,
  resetPlayerState,
  getCurrentWeaponClass,
  equipWeaponClass,
  getWeaponChargeRatio,
  isWeaponChargeFull,
  getStamina,
  PLAYER_MAX_STAMINA,
} from "./player.js";

import {
  initInventoryUI,
  toggleInventory,
  isInventoryOpen,
} from "./InventoryUI.js";

import { buildMap } from "./Map.js";
import { enemies, initEnemies, updateEnemies, resetEnemies } from "./Manage_Enemies.js";

let scene, camera, renderer, clock;

// UI DOM
let hpFillEl, hpTextEl, deathScreenEl;
let chargeBgEl, chargeFillEl;
let staminaFillEl;

// 状态
let isPlayerDead = false;

init();
animate();

function init() {
  const canvas = document.getElementById("game");

  // UI 元素
  hpFillEl = document.getElementById("hp-fill");
  hpTextEl = document.getElementById("hp-text");
  deathScreenEl = document.getElementById("death-screen");
  staminaFillEl = document.getElementById("stamina-fill");

    // 新增：蓄力条
  chargeBgEl   = document.getElementById("charge-bg");
  chargeFillEl = document.getElementById("charge-fill");

  if (deathScreenEl) {
    deathScreenEl.addEventListener("click", () => {
      if (isPlayerDead) {
        respawnGame();
      }
    });
  }

  // 渲染器
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // 场景 & 雾
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.08);

  // 相机
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  // 玩家
  createPlayer(scene, camera);

  // 光照
  const ambient = new THREE.AmbientLight(0x404040);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  // 地图
  buildMap(scene);

  // 敌人
  initEnemies(scene);

  // 初始化背包 UI，让它知道怎样获取/更换武器
  initInventoryUI({
    getEquippedWeaponClass: getCurrentWeaponClass,
    equipWeaponClass,
  });

  // 事件：键盘 —— 改成用本文件的 onKeyDown / onKeyUp 包一层
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  // 事件：鼠标移动 / 点击
document.addEventListener("mousemove", (e) => handleMouseMove(e));

// ✅ 背包打开时，点击不要再把事件传给 player.handleMouseDown
document.addEventListener("mousedown", (e) => {
  if (isInventoryOpen()) return;      // <<< 关键
  handleMouseDown(e, scene, enemies);
});

  // 新增：鼠标抬起 → 释放蓄力
  document.addEventListener("mouseup", (e) => {
    if (isInventoryOpen && isInventoryOpen()) return;
    handleMouseUp(e, scene, enemies);
  });

  // 点击画面 → 请求指针锁定（只有没死 且 没开背包 的时候）
  canvas.addEventListener("click", () => {
  // ✅ 背包开着就不要锁指针
  if (isPlayerDead || isInventoryOpen()) return;

  if (document.pointerLockElement !== document.body) {
    document.body.requestPointerLock();
  }
});


  window.addEventListener("resize", onWindowResize);

  clock = new THREE.Clock();
}

/* ================= 键盘输入封装（处理 Tab / Esc / 背包） ================= */

function onKeyDown(event) {
  // ========== Tab：打开 / 关闭背包 ==========
  if (event.code === "Tab") {
    event.preventDefault();
    if (!isPlayerDead) {
      const wasOpen = isInventoryOpen();   // 之前是否打开
      toggleInventory();                   // 切换开关
      const nowOpen = isInventoryOpen();

      // ✅ 如果之前是打开的，现在变成关闭了，且玩家没死，就自动锁定鼠标
      if (wasOpen && !nowOpen && document.pointerLockElement !== document.body) {
        document.body.requestPointerLock();
      }
    }
    return;
  }

  // ========== Esc：关闭背包 ==========
  if (event.code === "Escape" && isInventoryOpen()) {
    event.preventDefault();
    const wasOpen = isInventoryOpen();     // 这里一定是 true
    toggleInventory();
    const nowOpen = isInventoryOpen();

    if (
      wasOpen &&
      !nowOpen &&
      !isPlayerDead &&
      document.pointerLockElement !== document.body
    ) {
      document.body.requestPointerLock();
    }
    return;
  }

  // 背包打开时，不再把 WASD 传给玩家
  if (isInventoryOpen()) return;

  // 正常游戏状态下，把键盘事件交给 player.js
  playerHandleKeyDown(event);
}


function onKeyUp(event) {
  // 背包打开时不处理松键
  if (isInventoryOpen()) return;

  playerHandleKeyUp(event);
}

/* ================= 其他保持不变，只加了背包暂停条件 ================= */

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  const isLocked = document.pointerLockElement === document.body;
  // 加上 “没打开背包” 这个条件
  const gameRunning = isLocked && !isPlayerDead && !isInventoryOpen();

  // 游戏暂停逻辑：没锁定、死亡或打开背包就不更新逻辑
  if (gameRunning) {
    updatePlayer(dt, scene, enemies);
    updateEnemies(dt, getPlayerPosition(), handleDamageFromEnemy);
  }

  // 更新 HP UI
  const hp = getPlayerHp();
  const ratio = hp / PLAYER_MAX_HP;
  if (hpFillEl) {
    const clamped = Math.max(0, Math.min(1, ratio));
    hpFillEl.style.width = `${clamped * 100}%`;
  }
  if (hpTextEl) {
    hpTextEl.textContent = `${hp} / ${PLAYER_MAX_HP}`;
  }

  // 更新体力 UI（绿色条）
  if (staminaFillEl && typeof getStamina === "function") {
    const stamina = getStamina();
    const ratioS = stamina / PLAYER_MAX_STAMINA;
    const clampedS = Math.max(0, Math.min(1, ratioS));
    staminaFillEl.style.width = `${clampedS * 100}%`;
  }

  // 更新蓄力条 UI（放在主循环里保证实时刷新）
  if (chargeBgEl && chargeFillEl) {
    const ratioCharge =
      typeof getWeaponChargeRatio === "function"
        ? getWeaponChargeRatio() || 0
        : 0;
    const clampedC = Math.max(0, Math.min(1, ratioCharge));
    chargeFillEl.style.width = `${clampedC * 100}%`;

    // 不在蓄力时，让条稍微淡一点
    chargeBgEl.style.opacity = clampedC > 0 ? 1 : 0.25;

    // 满蓄时变白 + 高亮
    if (typeof isWeaponChargeFull === "function" && isWeaponChargeFull()) {
      chargeBgEl.classList.add("charged");
    } else {
      chargeBgEl.classList.remove("charged");
    }
  }

  renderer.render(scene, camera);
}

// 敌人调用的伤害接口：包装一下 damagePlayer，用来触发死亡 UI
function handleDamageFromEnemy(amount) {
  if (isPlayerDead) return;
  const died = damagePlayer(amount);
  if (died) {
    onPlayerDied();
  }
}

function onPlayerDied() {
  isPlayerDead = true;
  if (deathScreenEl) {
    deathScreenEl.classList.add("show");
  }
  if (document.pointerLockElement === document.body) {
    document.exitPointerLock();
  }
  // 死亡的时候如果背包开着也顺手关掉
  if (isInventoryOpen()) {
    toggleInventory();
  }
}

// 复活：玩家回出生点 + 血回满 + 敌人全部重置
function respawnGame() {
  isPlayerDead = false;
  if (deathScreenEl) {
    deathScreenEl.classList.remove("show");
  }

  resetPlayerState();
  resetEnemies(scene);

  // 复活后让玩家再点击一次画面进入指针锁定
}
