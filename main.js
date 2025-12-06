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
  setCheckpointPosition,
  restorePlayerStatus,
} from "./player.js";
import { Sword_Long } from "./Weapons/sword_long.js";
import { Sword_Box } from "./Weapons/sword_box.js";
import {
  initMaterials,
  resetMaterials,
  tryPickupMaterial,
  getMaterialMeshes,
  getMaterialCount,
  setMaterialCount,
  getMaterialName,
  getMaterialPickupRadius,
  setDefaultMaterial,
} from "./MaterialBase.js";
import { FluorescentFlower } from "./FluorescentFlower.js";

import {
  initInventoryUI,
  toggleInventory,
  isInventoryOpen,
  backToInventoryHub,
  unlockWeaponClass,
  getUnlockedWeaponClasses,
  resetUnlockedWeapons,
} from "./InventoryUI.js";

import { buildMap } from "./Map.js";
import { enemies, initEnemies, updateEnemies, resetEnemies } from "./Manage_Enemies.js";
import { initCheckpoints, handleCheckpointInteract, getCheckpointMeshes, clearCheckpoints, getCurrentCheckpointPosition, getCheckpointInteractRadius } from "./Checkpoint.js";
import { getPoints, tryPickupDrop, handleDeathDrop, getDropPosition, setPoints, getDropRadius } from "./Points.js";

const WeaponRegistry = {
  Sword_Box,
  Sword_Long,
};

// 设置默认材料类型
setDefaultMaterial(new FluorescentFlower());

let scene, camera, renderer, clock;

// UI DOM
let hpFillEl, hpTextEl, deathScreenEl;
let chargeBgEl, chargeFillEl;
let staminaFillEl;
const weaponPickups = [];
let pointsTextEl;
let pickupToastEl;
let pickupToastTimer = null;
let interactHintEl;
let menuRootEl;
let btnNewGame;
let btnContinue;
let weaponPickupSave = null; // 记录存档中武器拾取状态
const tmpCamPos = new THREE.Vector3();
const tmpForward = new THREE.Vector3();
const tmpToTarget = new THREE.Vector3();
const SAVE_KEY = "ks_demo_save_v1";
let isMainMenuOpen = true;

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
  pointsTextEl = document.getElementById("points-text");
  menuRootEl  = document.getElementById("main-menu");
  btnNewGame  = document.getElementById("btn-new-game");
  btnContinue = document.getElementById("btn-continue");

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

  // 检查点
    // 检查点
    initCheckpoints(scene);

    // 材料
    initMaterials(scene);

    // 地图中的武器拾取
    initWeaponPickups(scene);

  // 如果页面没有 points 容器，动态创建一个
  if (!pointsTextEl) {
    pointsTextEl = document.createElement("div");
    pointsTextEl.id = "points-text";
    pointsTextEl.style.position = "absolute";
    pointsTextEl.style.right = "16px";
    pointsTextEl.style.bottom = "16px";
    pointsTextEl.style.color = "#fff";
    pointsTextEl.style.fontSize = "18px";
    pointsTextEl.style.fontFamily = "monospace";
    pointsTextEl.style.pointerEvents = "none";
    pointsTextEl.textContent = "Points: 0";
    document.body.appendChild(pointsTextEl);
  }

  // 拾取提示（显示 3 秒）
  pickupToastEl = document.createElement("div");
  pickupToastEl.id = "pickup-toast";
  pickupToastEl.style.position = "absolute";
  pickupToastEl.style.right = "16px";
  pickupToastEl.style.bottom = "52px";
  pickupToastEl.style.padding = "6px 10px";
  pickupToastEl.style.background = "rgba(0,0,0,0.65)";
  pickupToastEl.style.color = "#fff";
  pickupToastEl.style.fontSize = "14px";
  pickupToastEl.style.fontFamily = "monospace";
  pickupToastEl.style.border = "1px solid rgba(255,255,255,0.35)";
  pickupToastEl.style.borderRadius = "6px";
  pickupToastEl.style.pointerEvents = "none";
  pickupToastEl.style.display = "none";
  document.body.appendChild(pickupToastEl);

  // 交互提示（蓄力条上方）
  interactHintEl = document.createElement("div");
  interactHintEl.id = "interact-hint";
  interactHintEl.style.position = "fixed";
  interactHintEl.style.left = "50%";
  interactHintEl.style.bottom = "60px";
  interactHintEl.style.transform = "translateX(-50%)";
  interactHintEl.style.padding = "4px 10px";
  interactHintEl.style.background = "rgba(0,0,0,0.65)";
  interactHintEl.style.color = "#fff";
  interactHintEl.style.fontSize = "13px";
  interactHintEl.style.fontFamily = "monospace";
  interactHintEl.style.border = "1px solid rgba(255,255,255,0.35)";
  interactHintEl.style.borderRadius = "6px";
  interactHintEl.style.pointerEvents = "none";
  interactHintEl.style.display = "none";
  interactHintEl.style.zIndex = "22";
  document.body.appendChild(interactHintEl);

  // 主菜单按钮
  if (btnNewGame) {
    btnNewGame.addEventListener("click", () => {
      startNewGame();
    });
  }
  if (btnContinue) {
    btnContinue.addEventListener("click", () => {
      continueGame();
    });
  }

  // 敌人
  initEnemies(scene);

  // 初始化背包 UI，让它知道怎样获取/更换武器
  initInventoryUI({
    getEquippedWeaponClass: getCurrentWeaponClass,
    equipWeaponClass,
    onEquip: () => saveGameState(),
  });

  // 事件：键盘 —— 改成用本文件的 onKeyDown / onKeyUp 包一层
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  // 事件：鼠标移动 / 点击
document.addEventListener("mousemove", (e) => handleMouseMove(e));

// ✅ 背包打开时，点击不要再把事件传给 player.handleMouseDown
document.addEventListener("mousedown", (e) => {
  if (isInventoryOpen() || isMainMenuOpen) return;      // <<< 关键
  handleMouseDown(e, scene, enemies);
});

  // 新增：鼠标抬起 → 释放蓄力
  document.addEventListener("mouseup", (e) => {
    if ((isInventoryOpen && isInventoryOpen()) || isMainMenuOpen) return;
    handleMouseUp(e, scene, enemies);
  });

  // 点击画面 → 请求指针锁定（只有没死、没开背包、没在主菜单的时候）
  canvas.addEventListener("click", () => {
  // ✅ 背包开着就不要锁指针
  if (isPlayerDead || isInventoryOpen() || isMainMenuOpen) return;

  if (document.pointerLockElement !== document.body) {
    document.body.requestPointerLock();
  }
});


  window.addEventListener("resize", onWindowResize);

  clock = new THREE.Clock();

  refreshContinueButton();
  openMainMenu();
}

/* ================= 键盘输入封装（处理 Tab / Esc / 背包） ================= */

function onKeyDown(event) {
  // 主菜单时不处理游戏输入
  if (isMainMenuOpen) return;

  // ========== Tab：打开 / 关闭背包 ==========
  if (event.code === "Tab") {
    event.preventDefault();
    if (!isPlayerDead) {
      const wasOpen = isInventoryOpen();   // 之前是否打开
      toggleInventory({ lockOnClose: true });                   // 切换开关
      const nowOpen = isInventoryOpen();

      // ✅ 如果之前是打开的，现在变成关闭了，且玩家没死，就自动锁定鼠标
      if (wasOpen && !nowOpen && document.pointerLockElement !== document.body) {
        document.body.requestPointerLock();
      }
    }
    return;
  }

  // ========== Esc：优先返回上一级，否则关闭背包 ========== 
  if (event.code === "Escape" && isInventoryOpen()) {
    event.preventDefault();
    // 如果在二级页面，先回到主页面，不关闭背包
    const handled = backToInventoryHub();
    if (handled) return;

    // 已在主页面时才真正关闭背包；不强制锁定鼠标
    toggleInventory({ lockOnClose: false });
    return;
  }

  // 背包打开时，不再把 WASD 传给玩家
  if (isInventoryOpen()) return;

  // E 键：优先拾取掉落点数，其次交互检查点
  if (event.code === "KeyE") {
    const playerPos = getPlayerPosition();

    const pickedPts = tryPickupDrop(scene, playerPos);
    if (pickedPts > 0) {
      showPickupToast(`拾取：点数 +${pickedPts}`);
      saveGameState();
      return;
    }

    const pickedMat = tryPickupMaterial(scene, playerPos);
    if (pickedMat) {
      showPickupToast(`拾取：${pickedMat}`);
      saveGameState();
      return;
    }

    const pickedWeapon = tryPickupWeapon(scene, playerPos);
    if (pickedWeapon) return;

    const didInteract = handleCheckpointInteract(playerPos, (cp) => {
      setCheckpointPosition(cp.mesh.position);
      restorePlayerStatus(cp.mesh.position);
      resetEnemies(scene);
      resetMaterials(scene);
      saveGameState();
    });
    if (didInteract) return;
  }

  // 正常游戏状态下，把键盘事件交给 player.js
  playerHandleKeyDown(event);
}


function onKeyUp(event) {
  if (isMainMenuOpen) return;
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
  const gameRunning = isLocked && !isPlayerDead && !isInventoryOpen() && !isMainMenuOpen;

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

  // 更新点数 UI
  if (pointsTextEl) {
    pointsTextEl.textContent = `Points: ${getPoints()}`;
  }

  updateInteractHint();

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
  handleDeathDrop(scene, getPlayerPosition());
  if (deathScreenEl) {
    deathScreenEl.classList.add("show");
  }
  if (document.pointerLockElement === document.body) {
    document.exitPointerLock();
  }
  // 死亡的时候如果背包开着也顺手关掉
  if (isInventoryOpen()) {
    toggleInventory({ lockOnClose: false });
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

// ========== 武器拾取（场景中的长剑） ==========
function initWeaponPickups(scene) {
  weaponPickups.length = 0;

  // 一把断剑（靠近出生点） + 一把长剑（远处）
  const pickups = [
    { pos: new THREE.Vector3(1.5, 0, 2.0), WeaponClass: Sword_Box },
    { pos: new THREE.Vector3(-12, 0, -6), WeaponClass: Sword_Long },
  ];

  const geo = new THREE.ConeGeometry(0.2, 0.8, 12);
  const mat = new THREE.MeshStandardMaterial({ color: 0xdddd88, emissive: 0x333300 });

  pickups.forEach(({ pos, WeaponClass }) => {
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.copy(pos);
    mesh.position.y = 0.4;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    weaponPickups.push({ mesh, WeaponClass, collected: false });
  });
}

function resetWeaponPickups(scene) {
  // 移除已有 mesh
  weaponPickups.forEach((wp) => {
    if (wp.mesh && wp.mesh.parent === scene) {
      scene.remove(wp.mesh);
    }
  });
  initWeaponPickups(scene);
}

function tryPickupWeapon(scene, playerPos) {
  const R = 2.2;
  for (const wp of weaponPickups) {
    if (wp.collected || !wp.mesh) continue;
    const dist = wp.mesh.position.distanceTo(playerPos);
    if (dist <= R) {
      wp.collected = true;
      scene.remove(wp.mesh);
      unlockWeaponClass(wp.WeaponClass);
      const name = wp.WeaponClass.displayName || wp.WeaponClass.name || "武器";
      showPickupToast(`拾取：${name}`);
      saveGameState();
      return true;
    }
  }
  return false;
}

function updateInteractHint() {
  if (!interactHintEl) return;
  if (isPlayerDead || isInventoryOpen() || isMainMenuOpen) {
    interactHintEl.style.display = "none";
    return;
  }

  const target = findInteractTarget();
  if (target) {
    interactHintEl.textContent = target;
    interactHintEl.style.display = "block";
  } else {
    interactHintEl.style.display = "none";
  }
}

function findInteractTarget() {
  if (!camera) return null;

  camera.getWorldPosition(tmpCamPos);
  camera.getWorldDirection(tmpForward);

  const maxDist = 3;
  const maxAngle = Math.PI / 6; // 30° 锥形视角内算“指向”

  // 点数掉落
  const dropPos = getDropPosition();
  const dropR = typeof getDropRadius === "function" ? getDropRadius() : maxDist;
  if (dropPos && isInSight(tmpCamPos, tmpForward, dropPos, dropR, maxAngle, tmpToTarget)) {
    return "按 E 拾取点数";
  }

  // 材料
  const mats = getMaterialMeshes();
  const matName = getMaterialName();
  const matR = typeof getMaterialPickupRadius === "function" ? getMaterialPickupRadius() : maxDist;
  const matHintR = matR + 0.4; // 提示稍微放宽，避免贴脸才显示
  for (const mesh of mats) {
    if (!mesh) continue;
    const matPos = mesh.getWorldPosition ? mesh.getWorldPosition(tmpToTarget) : mesh.position;
    if (isInSight(tmpCamPos, tmpForward, matPos, matHintR, maxAngle, tmpToTarget)) {
      return `按 E 拾取 ${matName || "材料"}`;
    }
  }

  // 武器拾取
  const weaponR = 2.2;
  for (const wp of weaponPickups) {
    if (wp.collected || !wp.mesh) continue;
    const pos = wp.mesh.position;
    if (isInSight(tmpCamPos, tmpForward, pos, weaponR, maxAngle, tmpToTarget)) {
      const name = wp.WeaponClass.displayName || wp.WeaponClass.name || "武器";
      return `按 E 拾取 ${name}`;
    }
  }

  // 检查点
  const cps = getCheckpointMeshes();
  const cpR = typeof getCheckpointInteractRadius === "function" ? getCheckpointInteractRadius() : maxDist;
  for (const mesh of cps) {
    if (!mesh) continue;
    const pos = mesh.position;
    if (isInSight(tmpCamPos, tmpForward, pos, cpR, maxAngle, tmpToTarget)) {
      return "按 E 交互检查点";
    }
  }

  return null;
}

function isInSight(camPos, forward, targetPos, maxDist, maxAngle, tmpVec) {
  const toTarget = tmpVec.subVectors(targetPos, camPos);
  const dist = toTarget.length();
  if (dist > maxDist) return false;
  toTarget.normalize();
  const angle = forward.angleTo(toTarget);
  return angle <= maxAngle;
}

function saveGameState() {
  const checkpoint = getCurrentCheckpointPosition();
  const unlocked = Array.from(
    new Set(getUnlockedWeaponClasses().map((c) => c.name).filter(Boolean))
  );
  const equipped = getCurrentWeaponClass();
  const weaponPickupStates = weaponPickups.map((wp) => !!wp.collected);
  const payload = {
    points: getPoints(),
    materials: {
      name: getMaterialName(),
      count: getMaterialCount(),
    },
    checkpoint: checkpoint
      ? { x: checkpoint.x, y: checkpoint.y, z: checkpoint.z }
      : null,
    unlocked,
    equipped: equipped ? equipped.name : null,
    weaponPickupStates,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    refreshContinueButton();
  } catch (err) {
    console.warn("保存失败", err);
  }
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("读取存档失败", err);
    return null;
  }
}

function applyGameState(data) {
  if (!data) return;

  // 1) 重置武器到默认（空）再按存档解锁
  resetUnlockedWeapons();
  if (Array.isArray(data.unlocked)) {
    Array.from(new Set(data.unlocked)).forEach((name) => {
      const cls = WeaponRegistry[name];
      if (cls) unlockWeaponClass(cls);
    });
  }

  // 2) 分数
  if (typeof data.points === "number") {
    setPoints(data.points);
  }

  // 2.5) 材料
  if (data.materials && typeof data.materials.count === "number") {
    setMaterialCount(data.materials.count);
  }

  // 3) 位置与检查点
  if (data.checkpoint) {
    const pos = new THREE.Vector3(data.checkpoint.x, data.checkpoint.y, data.checkpoint.z);
    setCheckpointPosition(pos);
    restorePlayerStatus(pos);
  } else {
    resetPlayerState();
  }

  resetEnemies(scene);

  // 4) 装备
  if (data.equipped && WeaponRegistry[data.equipped]) {
    equipWeaponClass(WeaponRegistry[data.equipped]);
  } else {
    equipWeaponClass(null);
  }

  // 5) 武器拾取刷新状态
  applyWeaponPickupState(data.weaponPickupStates);
}

function startNewGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    console.warn("清除存档失败", err);
  }

  resetUnlockedWeapons();
  equipWeaponClass(null);
  setPoints(0);
  setMaterialCount(0);
  clearCheckpoints(scene);
  initCheckpoints(scene);
  resetMaterials(scene);
  resetPlayerState();
  resetEnemies(scene);
  resetWeaponPickups(scene);
  refreshContinueButton();
  closeMainMenu();
  requestPointerLockIfPossible();
}

function continueGame() {
  const data = loadSavedState();
  if (!data) {
    if (pickupToastEl) {
      pickupToastEl.textContent = "无存档可继续";
      pickupToastEl.style.display = "block";
    }
    refreshContinueButton();
    return;
  }

  applyGameState(data);
  closeMainMenu();
  requestPointerLockIfPossible();
}

function requestPointerLockIfPossible() {
  if (isPlayerDead || isInventoryOpen() || isMainMenuOpen) return;
  if (document.pointerLockElement !== document.body) {
    document.body.requestPointerLock();
  }
}

function applyWeaponPickupState(states) {
  if (!Array.isArray(states)) return;
  // 确保已有拾取点与存档长度一致
  weaponPickups.forEach((wp, idx) => {
    if (!wp.mesh) return;
    const collected = !!states[idx];
    wp.collected = collected;
    if (collected && wp.mesh.parent === scene) {
      scene.remove(wp.mesh);
    }
  });
}

function openMainMenu() {
  isMainMenuOpen = true;
  if (menuRootEl) menuRootEl.style.display = "flex";
  if (document.pointerLockElement === document.body) {
    document.exitPointerLock();
  }
}

function closeMainMenu() {
  isMainMenuOpen = false;
  if (menuRootEl) menuRootEl.style.display = "none";
}

function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (err) {
    return false;
  }
}

function refreshContinueButton() {
  if (!btnContinue) return;
  btnContinue.disabled = !hasSave();
}

function showPickupToast(text) {
  if (!pickupToastEl) return;
  pickupToastEl.textContent = text;
  pickupToastEl.style.display = "block";
  if (pickupToastTimer) {
    clearTimeout(pickupToastTimer);
  }
  pickupToastTimer = setTimeout(() => {
    pickupToastEl.style.display = "none";
  }, 3000);
}
