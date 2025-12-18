// main.js
import * as THREE from "./libs/CS559-Three/build/three.module.js";
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
  setCameraBobOffset,
} from "./player.js";
import { Sword_Long } from "./Weapons/sword_long.js";
import { Scythe } from "./Weapons/scythe.js";
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
} from "./Materials/MaterialBase.js";
import { FluorescentFlower } from "./Materials/FluorescentFlower.js";
import { MazeGlow } from "./Materials/MazeGlow.js";
import { MysticRing } from "./Rings/Ring_Mystic.js";
import { addRing, addRingById, resetRings, serializeRings, restoreRings, getEquippedRingId, equipRingById } from "./Rings/RingManager.js";

import {
  initInventoryUI,
  toggleInventory,
  isInventoryOpen,
  backToInventoryHub,
  unlockWeaponClass,
  getUnlockedWeaponClasses,
  resetUnlockedWeapons,
} from "./InventoryUI.js";

import { buildMap, setObstacleVisibility, mapWalls, getGroundMesh } from "./Map.js";
import { enemies, initEnemies, updateEnemies, resetEnemies } from "./Manage_Enemies.js";
import { initCheckpoints, handleCheckpointInteract, getCheckpointMeshes, clearCheckpoints, getCurrentCheckpointPosition, getCheckpointInteractRadius, setCheckpointActivatedCallback } from "./Checkpoint.js";
import { getPoints, tryPickupDrop, handleDeathDrop, getDropPosition, setPoints, getDropRadius } from "./Points.js";
import { GLTFLoader } from "./libs/CS559-Three/examples/jsm/loaders/GLTFLoader.js";

const WeaponRegistry = {
  Sword_Box,
  Sword_Long,
  Scythe,
};

const BASE_BG_COLOR = new THREE.Color(0x0b0b0f);
// 精美版：稍微提高底色亮度，避免整体过暗
const FANCY_BG_COLOR = new THREE.Color(0x1a2638);

// 光照与雾配置，方便在两种模式间切换亮度
const BASE_LIGHTING = {
  ambientColor: 0x9ca0b0,
  ambientIntensity: 0.9,
  hemiSkyColor: 0xc8d8ff,
  hemiGroundColor: 0x403020,
  hemiIntensity: 0.7,
  dirColor: 0xffffff,
  dirIntensity: 1.35,
  fogColor: 0x0f1014,
  fogDensity: 0.03,
  bgColor: BASE_BG_COLOR.getHex(),
};

const FANCY_LIGHTING = {
  ambientColor: 0xd4e4ff,
  ambientIntensity: 1.65,
  hemiSkyColor: 0xf8fbff,
  hemiGroundColor: 0x50382c,
  hemiIntensity: 1.25,
  dirColor: 0xffffff,
  dirIntensity: 2.1,
  fogColor: 0x24365a,
  fogDensity: 0.01,
  bgColor: new THREE.Color(0x1d2f48).getHex(),
};

// 设置默认材料类型（荧光花），并准备迷宫内的蘑菇
setDefaultMaterial(new FluorescentFlower());

let scene, camera, renderer, clock;
let ambientLight, hemiLight, dirLight;

// UI DOM
let hpFillEl, hpTextEl, deathScreenEl;
let chargeBgEl, chargeFillEl;
let staminaFillEl;
const weaponPickups = [];
const ringPickups = [];
let pointsTextEl;
let pickupToastEl;
let pickupToastTimer = null;
let interactHintEl;
let posIndicatorEl;
let variantToggleEl;
let menuRootEl;
let btnNewGame;
let btnContinue;
let weaponPickupSave = null; // 记录存档中武器拾取状态
const tmpCamPos = new THREE.Vector3();
const tmpForward = new THREE.Vector3();
const tmpToTarget = new THREE.Vector3();
const tmpBBox = new THREE.Box3();
const tmpVecAlign = new THREE.Vector3();
const SAVE_KEY = "ks_demo_save_v1";
const VARIANT_KEY = "ks_demo_variant";
let variantMode = "base";
let fancyDecorations = [];
let fancyColliders = [];
let fancyTreeColliders = [];
let hiddenBaseHouseColliders = [];
const originalMaterials = new WeakMap();
let fancyGroundTexture = null;
let fancyPlasterTexture = null;
let fancyStoneTexture = null;
let fancyDirtTexture = null;
let fancyCheckpointFX = [];
let fancySmokeFX = [];
let fancyBonfireTemplate = null;
let fancySmokeTemplate = null;
let fancyPillarTrees = [];
let fancySky = null;
let retroRT = null;
let retroScene = null;
let retroCamera = null;
let retroQuad = null;
let retroEnabled = false;
let isMainMenuOpen = true;
let torchLight = null;
let mazeGlowMaterial = null;
let mazeGlowCount = 0;
let lastPlayerPos = new THREE.Vector3();
let cameraBobPhase = 0;
let cameraBobOffset = 0;
const CAMERA_BOB_FREQ = 1;
const CAMERA_BOB_AMPLITUDE = 0.2;

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
  posIndicatorEl = document.getElementById("pos-indicator");
  variantToggleEl = document.getElementById("variant-toggle");

  // 蓄力条
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
  scene.background = BASE_BG_COLOR.clone();
  scene.fog = new THREE.FogExp2(0x0f1014, 0.03);

  // 相机
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  // 玩家
  createPlayer(scene, camera);
  lastPlayerPos.copy(getPlayerPosition());

  // 光照（更亮、更柔和；支持模式切换时调节强度）
  ambientLight = new THREE.AmbientLight(
    BASE_LIGHTING.ambientColor,
    BASE_LIGHTING.ambientIntensity
  );
  scene.add(ambientLight);

  hemiLight = new THREE.HemisphereLight(
    BASE_LIGHTING.hemiSkyColor,
    BASE_LIGHTING.hemiGroundColor,
    BASE_LIGHTING.hemiIntensity
  );
  scene.add(hemiLight);

  dirLight = new THREE.DirectionalLight(
    BASE_LIGHTING.dirColor,
    BASE_LIGHTING.dirIntensity
  );
  dirLight.position.set(10, 14, 6);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -40;
  dirLight.shadow.camera.right = 40;
  dirLight.shadow.camera.top = 40;
  dirLight.shadow.camera.bottom = -40;
  scene.add(dirLight);

  // 地图
  buildMap(scene);

  // 检查点
  initCheckpoints(scene);
  setCheckpointActivatedCallback(onCheckpointActivatedFancy);

  // 材料
  initMaterials(scene);
  mazeGlowMaterial = new MazeGlow();
  mazeGlowMaterial.init(scene);
  mazeGlowCount = 0;

    // 地图中的武器拾取
    initWeaponPickups(scene);

    // 戒指拾取（迷宫终点）
    initRingPickups(scene);

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

  // 版本切换按钮（基础版 <-> 精美版占位）
  if (variantToggleEl) {
    variantToggleEl.addEventListener("click", () => {
      toggleVariantMode();
    });
  }

  // 敌人
  initEnemies(scene);

  // 初始化背包 UI，让它知道怎样获取/更换武器
  initInventoryUI({
    getEquippedWeaponClass: getCurrentWeaponClass,
    equipWeaponClass,
    onEquip: () => saveGameState(),
    onEquipRing: () => saveGameState(),
    getExtraMaterials,
  });

  // 读取版本模式
  applyVariantMode(loadVariantMode());
  if (variantMode === "fancy") {
    addFancyColliders();
    loadFancyDecor();
    applyFancyMaterials();
    setupFancyCheckpoints();
    addFancyPillarTrees();
    addFancySky();
    setupRetroPass();
  }

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
      showPickupToast(`Picked up: +${pickedPts} points`);
      saveGameState();
      return;
    }

    const pickedMat = tryPickupMaterial(scene, playerPos);
    if (pickedMat) {
      showPickupToast(`Picked up: ${pickedMat}`);
      saveGameState();
      return;
    }

    if (mazeGlowMaterial) {
      const pickedMaze = mazeGlowMaterial.tryPickup(scene, playerPos);
      if (pickedMaze) {
        mazeGlowCount = typeof mazeGlowMaterial.getCount === "function"
          ? mazeGlowMaterial.getCount()
          : mazeGlowCount + 1;
        showPickupToast(`Picked up: ${pickedMaze}`);
        saveGameState();
        return;
      }
    }

    const pickedWeapon = tryPickupWeapon(scene, playerPos);
    if (pickedWeapon) return;

    const pickedRing = tryPickupRing(scene, playerPos);
    if (pickedRing) return;

    const didInteract = handleCheckpointInteract(playerPos, (cp) => {
      setCheckpointPosition(cp.mesh.position);
      restorePlayerStatus(cp.mesh.position);
      resetEnemies(scene);
      resetMaterials(scene);
      resetMazeGlowMaterials();
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
  if (retroEnabled) {
    setupRetroPass();
  }
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

  updateCameraBob(dt, gameRunning);

  updateTorchLightPosition();

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

  // 更新位置显示（右上角）
  if (posIndicatorEl) {
    const p = getPlayerPosition();
    posIndicatorEl.textContent = `x:${p.x.toFixed(1)} y:${p.y.toFixed(1)} z:${p.z.toFixed(1)}`;
  }

  updateInteractHint();

  if (variantMode === "fancy" && retroEnabled && retroRT && retroScene && retroCamera) {
    renderer.setRenderTarget(retroRT);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(retroScene, retroCamera);
  } else {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }
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

  // 断剑（近战起步） + 长剑（第一检查点后） + 镰刀（出生点调试 & Boss 前）
  const pickups = [
    { pos: new THREE.Vector3(1.5, 0, 2.0), WeaponClass: Sword_Box },
    { pos: new THREE.Vector3(0, 0, 36), WeaponClass: Sword_Long },
    { pos: new THREE.Vector3(20, 0, 74), WeaponClass: Scythe },
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

// ========== 戒指拾取（迷宫终点神秘戒指） ==========
function initRingPickups(scene) {
  ringPickups.length = 0;

  const pickups = [
    // 迷宫终点房间中央，避开墙体略前移
    { pos: new THREE.Vector3(-28, 0, 86), ringId: MysticRing.id },
  ];

  const geo = new THREE.TorusGeometry(0.28, 0.08, 8, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0x88ccff, emissive: 0x224466, emissiveIntensity: 0.5 });

  pickups.forEach(({ pos, ringId }) => {
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.copy(pos);
    mesh.position.y = 0.6; // 抬高一些避免与地面或墙体重合
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    ringPickups.push({ mesh, ringId, collected: false });
  });
}

function resetRingPickups(scene) {
  ringPickups.forEach((rp) => {
    if (rp.mesh && rp.mesh.parent === scene) {
      scene.remove(rp.mesh);
    }
  });
  initRingPickups(scene);
}

// ========== 精美版装饰（加载外部模型） ==========
function clearFancyDecor() {
  fancyDecorations.forEach((obj) => {
    if (obj && obj.parent) obj.parent.remove(obj);
  });
  fancyDecorations = [];
}

function removeFancyColliders() {
  if (!scene) return;
  fancyColliders.forEach((c) => {
    if (c && c.parent) c.parent.remove(c);
    const idx = mapWalls.indexOf(c);
    if (idx >= 0) mapWalls.splice(idx, 1);
  });
  fancyTreeColliders.forEach((c) => {
    if (c && c.parent) c.parent.remove(c);
    const idx = mapWalls.indexOf(c);
    if (idx >= 0) mapWalls.splice(idx, 1);
  });
  fancyColliders = [];
  fancyTreeColliders = [];

  // 恢复基础房屋碰撞
  hiddenBaseHouseColliders.forEach((c) => {
    if (c && scene && !c.parent) scene.add(c);
    if (mapWalls.indexOf(c) < 0) mapWalls.push(c);
    if (c.material) c.material.visible = true;
  });
  hiddenBaseHouseColliders = [];

  // 恢复基础版障碍可见/可碰撞
  setObstacleVisibility("house", true);
}

function addFancyColliders() {
  removeFancyColliders();
  if (!scene) return;

   // 隐藏基础版房屋几何和碰撞
  setObstacleVisibility("house", false);

  // 移除基础房屋碰撞体（保存以便切回基础版时恢复）
  hiddenBaseHouseColliders = mapWalls.filter((c) => c.userData && c.userData.type === "house");
  mapWalls.splice(0, mapWalls.length, ...mapWalls.filter((c) => !(c.userData && c.userData.type === "house")));
  hiddenBaseHouseColliders.forEach((c) => {
    if (c.parent) c.parent.remove(c);
  });

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  // 精美版去除房屋和树木碰撞：不再创建对应碰撞盒
}

function clearFancyCheckpointFX() {
  fancyCheckpointFX.forEach((obj) => {
    if (obj && obj.parent) obj.parent.remove(obj);
  });
  fancyCheckpointFX = [];

  fancySmokeFX.forEach((entry) => {
    const obj = entry?.obj || entry;
    if (obj && obj.parent) obj.parent.remove(obj);
  });
  fancySmokeFX = [];

  const cps = getCheckpointMeshes();
  cps.forEach((mesh) => {
    if (mesh) mesh.visible = true;
  });
}

function ensureFancyCheckpointAssets(onDone) {
  let pending = 0;
  const loader = new GLTFLoader();

  const finish = () => {
    pending -= 1;
    if (pending <= 0 && typeof onDone === "function") onDone();
  };

  if (!fancyBonfireTemplate) {
    pending += 1;
    loader.load(
      "Assets/Bonfire.glb",
      (gltf) => {
        fancyBonfireTemplate = gltf.scene;
        finish();
      },
      undefined,
      () => finish()
    );
  }

  if (!fancySmokeTemplate) {
    pending += 1;
    loader.load(
      "Assets/Smoke.glb",
      (gltf) => {
        fancySmokeTemplate = gltf.scene;
        finish();
      },
      undefined,
      () => finish()
    );
  }

  if (pending === 0 && typeof onDone === "function") {
    onDone();
  }
}

function setupFancyCheckpoints() {
  clearFancyCheckpointFX();
  if (variantMode !== "fancy" || !scene) return;

  const cps = getCheckpointMeshes();
  if (!cps || cps.length === 0) return;

  ensureFancyCheckpointAssets(() => {
    if (variantMode !== "fancy" || !scene) return;

    cps.forEach((mesh) => {
      if (!mesh) return;

      if (fancyBonfireTemplate) {
        const fire = fancyBonfireTemplate.clone(true);
        fire.position.set(mesh.position.x, 0, mesh.position.z);
        fire.scale.setScalar(4.8);
        fire.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        scene.add(fire);
        fancyCheckpointFX.push(fire);
      }

      mesh.visible = false;
    });
  });
}

function spawnFancyCheckpointSmoke(cp) {
  if (!cp || !cp.mesh || !scene) return;
  const cpId = cp.mesh.uuid;

  fancySmokeFX = fancySmokeFX.filter((entry) => {
    if (entry && entry.cpId === cpId) {
      const obj = entry.obj || entry;
      if (obj && obj.parent) obj.parent.remove(obj);
      return false;
    }
    return true;
  });

  const addSmoke = () => {
    if (!fancySmokeTemplate || variantMode !== "fancy") return;
    const smoke = fancySmokeTemplate.clone(true);
    smoke.position.copy(cp.mesh.position);
    smoke.position.y += 1.0;
    smoke.scale.setScalar(0.24);
    smoke.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    scene.add(smoke);
    fancySmokeFX.push({ cpId, obj: smoke });
  };

  if (!fancySmokeTemplate) {
    ensureFancyCheckpointAssets(addSmoke);
  } else {
    addSmoke();
  }
}

function onCheckpointActivatedFancy(cp) {
  if (variantMode !== "fancy") return;
  spawnFancyCheckpointSmoke(cp);
}

function applyFancyMaterials() {
  const palette = {
    wall: 0x4b5a70,
    gate: 0x5d4635,
    fence: 0x5a4230,
    rock: 0x6b7078,
    pillar: 0x6b6460,
    ruin: 0x555555,
    cliff: 0x2f3035,
    tree: 0x2f5a38,
    spike: 0x6a5a4a,
    obelisk: 0x5a5f8a,
    platform: 0x3a3f46,
    default: 0x6a6a6a,
  };

  const ground = typeof getGroundMesh === "function" ? getGroundMesh() : null;
  const texLoader = new THREE.TextureLoader();

  if (!fancyGroundTexture) {
    fancyGroundTexture = texLoader.load("Assets/ground_sand.jpg", (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(18, 18);
      tex.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || 8;
      if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
    });
    fancyGroundTexture.wrapS = fancyGroundTexture.wrapT = THREE.RepeatWrapping;
    fancyGroundTexture.repeat.set(18, 18);
    if (fancyGroundTexture.colorSpace !== undefined) fancyGroundTexture.colorSpace = THREE.SRGBColorSpace;
  }

  const rockTex = fancyGroundTexture.clone();
  rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping;
  rockTex.repeat.set(8, 8);
  if (rockTex.colorSpace !== undefined) rockTex.colorSpace = THREE.SRGBColorSpace;

  if (!fancyPlasterTexture) {
    fancyPlasterTexture = texLoader.load("Assets/plaster_wall.jpg", (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 4);
      tex.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || 8;
      if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
    });
    fancyPlasterTexture.wrapS = fancyPlasterTexture.wrapT = THREE.RepeatWrapping;
    fancyPlasterTexture.repeat.set(4, 4);
    if (fancyPlasterTexture.colorSpace !== undefined) fancyPlasterTexture.colorSpace = THREE.SRGBColorSpace;
  }

  if (!fancyStoneTexture) {
    fancyStoneTexture = texLoader.load("Assets/stone_wall.jpg", (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 3);
      tex.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || 8;
      if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
    });
    fancyStoneTexture.wrapS = fancyStoneTexture.wrapT = THREE.RepeatWrapping;
    fancyStoneTexture.repeat.set(3, 3);
    if (fancyStoneTexture.colorSpace !== undefined) fancyStoneTexture.colorSpace = THREE.SRGBColorSpace;
  }

  if (!fancyDirtTexture) {
    // Use rock texture clone by default to avoid missing-asset requests; swap here if dirt_mound.jpg is added later.
    fancyDirtTexture = rockTex.clone();
  }

  if (ground) {
    if (!originalMaterials.has(ground)) {
      originalMaterials.set(ground, ground.material);
    }
    ground.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0,
      map: fancyGroundTexture,
    });
  }

  mapWalls.forEach((mesh) => {
    const t = mesh.userData && mesh.userData.type;
    if (!t || t === "house") return; // 房屋在精美版已隐藏
    if (!originalMaterials.has(mesh)) {
      originalMaterials.set(mesh, mesh.material);
    }
    const color = palette[t] || palette.default;
    if (t === "rock") {
      const useDirt = mesh.position.z >= 24 && mesh.position.z <= 40 && mesh.position.x >= -12 && mesh.position.x <= 12;
      mesh.material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.92,
        metalness: 0.05,
        map: useDirt ? fancyDirtTexture : rockTex,
      });
    } else if (t === "wall" || t === "gate") {
      mesh.material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.78,
        metalness: 0.08,
        map: fancyStoneTexture,
      });
    } else if (t === "pillar") {
      mesh.material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.02,
        map: fancyPlasterTexture,
      });
    } else {
      mesh.material = new THREE.MeshToonMaterial({ color, gradientMap: null });
    }
  });
}

function clearFancySky() {
  if (fancySky && scene) {
    scene.remove(fancySky);
  }
  fancySky = null;
  if (scene) {
    scene.background = BASE_BG_COLOR.clone();
  }
}

function addFancySky() {
  clearFancySky();
  if (!scene) return;

  const group = new THREE.Group();

  const domeGeo = new THREE.SphereGeometry(600, 32, 24);
  // 精美版天空改为蓝紫色调，提升整体亮度
  const domeMat = new THREE.MeshBasicMaterial({ color: 0x101a2d, side: THREE.BackSide, fog: false });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  group.add(dome);

  const moonGeo = new THREE.SphereGeometry(12, 64, 48);
  const moonMat = new THREE.MeshStandardMaterial({
    color: 0x553a2a,
    emissive: 0xff8870,
    emissiveIntensity: 1.2,
    roughness: 0.34,
    metalness: 0.02,
    fog: false,
  });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.position.set(-60, 110, -140);
  moon.castShadow = false;
  moon.receiveShadow = false;
  group.add(moon);

  const glowGeo = new THREE.SphereGeometry(26, 32, 24);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff8870, transparent: true, opacity: 0.14, side: THREE.BackSide, fog: false });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.copy(moon.position);
  group.add(glow);

  scene.add(group);
  fancySky = group;
  scene.background = FANCY_BG_COLOR.clone();
}

function clearFancyPillarTrees() {
  fancyPillarTrees.forEach((obj) => {
    if (obj && obj.parent) obj.parent.remove(obj);
  });
  fancyPillarTrees = [];

  mapWalls.forEach((mesh) => {
    if (mesh && mesh.userData && mesh.userData.type === "pillar") {
      mesh.visible = true;
    }
  });
}

function disposeRetroPass() {
  if (retroRT) {
    retroRT.dispose();
    retroRT = null;
  }
  if (retroQuad) {
    if (retroQuad.material) retroQuad.material.dispose();
    if (retroQuad.geometry) retroQuad.geometry.dispose();
  }
  retroScene = null;
  retroCamera = null;
  retroQuad = null;
  retroEnabled = false;
}

function setupRetroPass() {
  retroEnabled = true;
  const w = Math.max(160, Math.floor(window.innerWidth * 0.6));
  const h = Math.max(120, Math.floor(window.innerHeight * 0.6));

  if (!retroScene) {
    retroScene = new THREE.Scene();
    retroCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        levels: { value: 6.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform float levels;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          c.rgb = floor(c.rgb * levels) / levels;
          gl_FragColor = c;
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    retroQuad = new THREE.Mesh(quadGeo, quadMat);
    retroScene.add(retroQuad);
  }

  if (retroRT) retroRT.dispose();
  retroRT = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
  });
  if (retroQuad && retroQuad.material && retroQuad.material.uniforms) {
    retroQuad.material.uniforms.tDiffuse.value = retroRT.texture;
  }
}

function addFancyPillarTrees() {
  clearFancyPillarTrees();
  if (variantMode !== "fancy" || !scene) return;

  const pillars = mapWalls.filter((m) => m && m.userData && m.userData.type === "pillar");
  if (pillars.length === 0) return;

  const loader = new GLTFLoader();
  loader.load(
    "Assets/Tree.glb",
    (gltf) => {
      pillars.forEach((pillar) => {
        const tree = gltf.scene.clone(true);
        tree.position.copy(pillar.position);
        tree.scale.setScalar(1.4);
        tree.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        alignObjectToGround(tree, 0);
        scene.add(tree);
        fancyPillarTrees.push(tree);
        pillar.visible = false; // keep collider but hide old pillar mesh
      });
    },
    undefined,
    () => {
      /* ignore load failure; keep pillars visible */
    }
  );
}

function restoreBaseMaterials() {
  mapWalls.forEach((mesh) => {
    const baseMat = originalMaterials.get(mesh);
    if (baseMat) {
      mesh.material = baseMat;
      originalMaterials.delete(mesh);
    }
  });
  const ground = typeof getGroundMesh === "function" ? getGroundMesh() : null;
  if (ground) {
    const baseMat = originalMaterials.get(ground);
    if (baseMat) {
      ground.material = baseMat;
      originalMaterials.delete(ground);
    }
  }
}

function loadFancyDecor() {
  clearFancyDecor();
  if (!scene) return;

  const loader = new GLTFLoader();

  const placements = [
    // 多样岩石
    { file: "Assets/Rock Large.glb",        pos: new THREE.Vector3(6, 0, 28),    scale: 0.9 },
    { file: "Assets/Rock Large-54jZKTAt5p.glb", pos: new THREE.Vector3(-8, 0, 30),   scale: 0.9 },
    { file: "Assets/Rock-RtLRqYjfMs.glb",   pos: new THREE.Vector3(-3, 0, 28),    scale: 1.0 },
    { file: "Assets/Rocks.glb",             pos: new THREE.Vector3(-26, 0, 70),   scale: 1.2 },
    { file: "Assets/Rocks-OQvi8PIZ40.glb",  pos: new THREE.Vector3(-20, 0, 66),   scale: 1.1 },
    { file: "Assets/Rock.glb",              pos: new THREE.Vector3(20, 0, 76),    scale: 1.0 },

    // 幻想建筑替换基础房屋（位置对齐基础版）
    { file: "Assets/Fantasy House.glb",             pos: new THREE.Vector3(-12, 0, 36), scale: 2.4, rotY: Math.PI * 0.08 },
    { file: "Assets/Fantasy House-BH2XHWUNmF.glb",  pos: new THREE.Vector3(12, 0, 34),  scale: 2.5, rotY: -Math.PI * 0.1 },
    { file: "Assets/Fantasy House-dcPho4SUA3.glb",  pos: new THREE.Vector3(-4, 0, 42),  scale: 2.5, rotY: Math.PI * 0.18 },
    { file: "Assets/Fantasy Inn.glb",               pos: new THREE.Vector3(-16, 0, 52), scale: 2.8, rotY: Math.PI * 0.12 },
    { file: "Assets/Fantasy Stable.glb",            pos: new THREE.Vector3(8, 0, 52),   scale: 2.8, rotY: -Math.PI * 0.12 },
    { file: "Assets/Fantasy Barracks.glb",          pos: new THREE.Vector3(-10, 0, 60), scale: 2.8, rotY: Math.PI * 0.06 },
    { file: "Assets/Wooden Fortress.glb",           pos: new THREE.Vector3(18, 0, 66),  scale: 3.2, rotY: Math.PI * 0.5 },

    // 树木与自然点缀
    { file: "Assets/Tree.glb",           pos: new THREE.Vector3(-12, 0, 34), scale: 1.2 },
    { file: "Assets/Tree-QeYQEpgPcC.glb",pos: new THREE.Vector3(14, 0, 38),  scale: 1.3 },
    { file: "Assets/Pine.glb",           pos: new THREE.Vector3(-30, 0, 72), scale: 1.5 },
    { file: "Assets/Pine Trees.glb",     pos: new THREE.Vector3(-20, 0, 80), scale: 1.1 },
    { file: "Assets/Dead Trees.glb",     pos: new THREE.Vector3(6, 0, 68),   scale: 0.9 },
    { file: "Assets/Trees.glb",          pos: new THREE.Vector3(-34, 0, 90), scale: 1.1 },

    // 村口/庭院装饰
    { file: "Assets/Fence.glb",          pos: new THREE.Vector3(0, 0, 24),   scale: 1.05 },

    // 出生点附近小装饰（无碰撞）
    { file: "Assets/Bag.glb",            pos: new THREE.Vector3(2, 0, 10),    scale: 0.8 },
    { file: "Assets/Barrel.glb",         pos: new THREE.Vector3(-10, 0, 14),  scale: 0.85 },
    { file: "Assets/Tumbleweed.glb",     pos: new THREE.Vector3(-6, 0, 8),    scale: 0.65 },
    { file: "Assets/Crate.glb",          pos: new THREE.Vector3(10, 0, 16),   scale: 0.85 },

    // 市集与生活气息
    { file: "Assets/Cart.glb",           pos: new THREE.Vector3(6, 0, 32),   scale: 3.5, rotY: Math.PI * 0.6 },
    { file: "Assets/Crate.glb",          pos: new THREE.Vector3(10, 0, 32),  scale: 0.9 },
    { file: "Assets/Barrel.glb",         pos: new THREE.Vector3(-6, 0, 32),  scale: 0.9 },
    { file: "Assets/Hay.glb",            pos: new THREE.Vector3(-2, 0, 34),  scale: 9.0 },

    // 水井与聚会场景
    { file: "Assets/Well.glb",           pos: new THREE.Vector3(0, 0, 52),   scale: 5.5 },
    { file: "Assets/Gazebo.glb",         pos: new THREE.Vector3(18, 0, 58),  scale: 1.6, rotY: Math.PI * 0.5 },

    // 迷宫/外围氛围（无碰撞，放在通道边缘）
    { file: "Assets/Dead Trees.glb",     pos: new THREE.Vector3(-30, 0, 70), scale: 0.8 },
    { file: "Assets/Tumbleweed.glb",     pos: new THREE.Vector3(-24, 0, 78), scale: 0.75 },
    { file: "Assets/Dead Trees.glb",     pos: new THREE.Vector3(-34, 0, 74), scale: 0.6 },
    { file: "Assets/Rocks.glb",          pos: new THREE.Vector3(-22, 0, 82), scale: 0.7 },
    { file: "Assets/Tumbleweed.glb",     pos: new THREE.Vector3(-28, 0, 64), scale: 0.65 },
  ];

  placements.forEach(({ file, pos, scale, rotY }) => {
    loader.load(file, (gltf) => {
      const obj = gltf.scene;
      obj.position.copy(pos);
      obj.scale.setScalar(scale || 1);
      if (rotY) obj.rotation.y = rotY;
      obj.traverse((n) => {
        if (n.isMesh) {
          n.castShadow = true;
          n.receiveShadow = true;
        }
      });
      alignObjectToGround(obj, 0);
      scene.add(obj);
      fancyDecorations.push(obj);
    });
  });
}

function tryPickupRing(scene, playerPos) {
  const R = 2.0;
  for (const rp of ringPickups) {
    if (rp.collected || !rp.mesh) continue;
    const dist = rp.mesh.position.distanceTo(playerPos);
    if (dist <= R) {
      rp.collected = true;
      scene.remove(rp.mesh);
      addRingById(rp.ringId);
      const name = MysticRing.name;
      showPickupToast(`Picked up: ${name}`);
      saveGameState();
      return true;
    }
  }
  return false;
}

function applyRingPickupState(states) {
  if (!Array.isArray(states)) return;
  ringPickups.forEach((rp, idx) => {
    if (!rp.mesh) return;
    const collected = !!states[idx];
    rp.collected = collected;
    if (collected && rp.mesh.parent === scene) {
      scene.remove(rp.mesh);
    }
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
      const name = wp.WeaponClass.displayName || wp.WeaponClass.name || "Weapon";
      showPickupToast(`Picked up: ${name}`);
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
    return "Press E to pick up points";
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
      return `Press E to pick up ${matName || "material"}`;
    }
  }

  // 迷宫蘑菇拾取提示
  if (mazeGlowMaterial) {
    const mushrooms = mazeGlowMaterial.getMeshes();
    for (const mesh of mushrooms) {
      if (!mesh) continue;
      const pos = mesh.getWorldPosition ? mesh.getWorldPosition(tmpToTarget) : mesh.position;
      if (isInSight(tmpCamPos, tmpForward, pos, 2.4, maxAngle, tmpToTarget)) {
        return "Press E to pick up Glowshroom";
      }
    }
  }

  // 武器拾取
  const weaponR = 2.2;
  for (const wp of weaponPickups) {
    if (wp.collected || !wp.mesh) continue;
    const pos = wp.mesh.position;
    if (isInSight(tmpCamPos, tmpForward, pos, weaponR, maxAngle, tmpToTarget)) {
      const name = wp.WeaponClass.displayName || wp.WeaponClass.name || "Weapon";
      return `Press E to pick up ${name}`;
    }
  }

  // 戒指拾取
  const ringR = 2.0;
  for (const rp of ringPickups) {
    if (rp.collected || !rp.mesh) continue;
    const pos = rp.mesh.position;
    if (isInSight(tmpCamPos, tmpForward, pos, ringR, maxAngle, tmpToTarget)) {
      return `Press E to pick up ${MysticRing.name}`;
    }
  }

  // 检查点
  const cps = getCheckpointMeshes();
  const cpR = typeof getCheckpointInteractRadius === "function" ? getCheckpointInteractRadius() : maxDist;
  for (const mesh of cps) {
    if (!mesh) continue;
    const pos = mesh.position;
    if (isInSight(tmpCamPos, tmpForward, pos, cpR, maxAngle, tmpToTarget)) {
      return "Press E to interact with checkpoint";
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

function ensureTorchLight() {
  if (torchLight || !scene) return;
  // 温暖点光源，模拟手持火把
  torchLight = new THREE.PointLight(0xffc270, 5, 30, 3);
  torchLight.castShadow = false; // 避免成本过高
  torchLight.position.set(0, 2, 0);
  scene.add(torchLight);
}

function alignObjectToGround(obj, groundY = 0) {
  if (!obj) return;
  tmpBBox.setFromObject(obj);
  if (!tmpBBox.isEmpty()) {
    const lift = groundY - tmpBBox.min.y;
    if (Math.abs(lift) > 1e-3) {
      obj.position.y += lift;
    }
  }
}

function removeTorchLight() {
  if (torchLight && scene) {
    scene.remove(torchLight);
    if (torchLight.dispose) {
      torchLight.dispose();
    }
  }
  torchLight = null;
}

function updateTorchLightPosition() {
  if (!torchLight || variantMode !== "fancy") return;
  const p = getPlayerPosition();
  // 稍微抬高并放到视线前方，避免遮挡视角
  tmpToTarget.set(0, 0, -1);
  if (camera) {
    camera.getWorldDirection(tmpToTarget);
  }
  torchLight.position.copy(p).addScaledVector(tmpToTarget, 0.9);
  torchLight.position.y += 1.6;
}

function resetMazeGlowMaterials() {
  if (mazeGlowMaterial && scene) {
    mazeGlowMaterial.reset(scene);
    if (typeof mazeGlowMaterial.setCount === "function") {
      mazeGlowMaterial.setCount(mazeGlowCount);
    }
  }
}

function getExtraMaterials() {
  if (!mazeGlowMaterial) return [];
  const previewBuilder = typeof MazeGlow.buildMesh === "function" ? () => MazeGlow.buildMesh() : null;
  return [
    {
      name: mazeGlowMaterial.getName(),
      desc: mazeGlowMaterial.getDescription(),
      count: mazeGlowCount,
      previewBuilder,
    },
  ];
}

function applyLightingForVariant(mode) {
  const cfg = mode === "fancy" ? FANCY_LIGHTING : BASE_LIGHTING;
  if (ambientLight) {
    ambientLight.color.setHex(cfg.ambientColor);
    ambientLight.intensity = cfg.ambientIntensity;
  }
  if (hemiLight) {
    hemiLight.color.setHex(cfg.hemiSkyColor);
    hemiLight.groundColor.setHex(cfg.hemiGroundColor);
    hemiLight.intensity = cfg.hemiIntensity;
  }
  if (dirLight) {
    dirLight.color.setHex(cfg.dirColor);
    dirLight.intensity = cfg.dirIntensity;
  }
  if (scene && scene.fog) {
    scene.fog.color.setHex(cfg.fogColor);
    scene.fog.density = cfg.fogDensity;
  }
  // 清屏颜色与天空同步：若精美版已添加天空，则保持天空背景
  const shouldSetBackground = !(mode === "fancy" && fancySky);
  if (scene && shouldSetBackground) {
    scene.background = new THREE.Color(cfg.bgColor);
  }
  if (renderer) {
    renderer.setClearColor(cfg.bgColor);
  }
  if (mode === "fancy") {
    ensureTorchLight();
    // Reset bob phase to avoid jump when switching variants
    cameraBobPhase = 0;
    cameraBobOffset = 0;
    setCameraBobOffset(0);
  } else {
    removeTorchLight();
    cameraBobPhase = 0;
    cameraBobOffset = 0;
    setCameraBobOffset(0);
  }
}

function updateCameraBob(dt, gameRunning) {
  if (!scene || !camera || variantMode !== "fancy") {
    cameraBobPhase = 0;
    cameraBobOffset = 0;
    setCameraBobOffset(0);
    lastPlayerPos.copy(getPlayerPosition());
    return;
  }

  const currentPos = getPlayerPosition();
  const speed = tmpVecAlign.subVectors(currentPos, lastPlayerPos).length() / Math.max(dt, 1e-5);
  lastPlayerPos.copy(currentPos);

  const moving = gameRunning && speed > 0.1;
  if (moving) {
    const speedFactor = Math.min(1.05, Math.max(0.5, speed / 3.5));
    cameraBobPhase += dt * CAMERA_BOB_FREQ * speedFactor;
    const ampScale = Math.min(0.8, Math.max(0.25, speed / 5));
    const targetOffset = Math.sin(cameraBobPhase * Math.PI * 2) * CAMERA_BOB_AMPLITUDE * ampScale;
    cameraBobOffset = THREE.MathUtils.lerp(
      cameraBobOffset,
      targetOffset,
      Math.min(1, dt * 8)
    );
  } else {
    cameraBobOffset *= Math.max(0, 1 - dt * 6);
    if (Math.abs(cameraBobOffset) < 1e-3) {
      cameraBobOffset = 0;
      cameraBobPhase = 0;
    }
  }

  setCameraBobOffset(cameraBobOffset);
}

function loadVariantMode() {
  try {
    const v = localStorage.getItem(VARIANT_KEY);
    return v === "fancy" ? "fancy" : "base";
  } catch (err) {
    return "base";
  }
}

function saveVariantMode(mode) {
  try {
    localStorage.setItem(VARIANT_KEY, mode);
  } catch (err) {
    /* ignore */
  }
}

function applyVariantMode(mode) {
  variantMode = mode === "fancy" ? "fancy" : "base";
  if (document && document.body) {
    document.body.setAttribute("data-variant", variantMode);
  }
  if (variantToggleEl) {
    variantToggleEl.textContent = variantMode === "fancy" ? "Switch to: Base" : "Switch to: Fancy";
  }
  applyLightingForVariant(variantMode);
  // 隐藏/显示基础房屋以便用外部模型替换视觉
  if (typeof setObstacleVisibility === "function") {
    setObstacleVisibility("house", variantMode !== "fancy");
  }
  if (variantMode !== "fancy") {
    removeFancyColliders();
    restoreBaseMaterials();
    clearFancyCheckpointFX();
    clearFancyPillarTrees();
    clearFancySky();
    disposeRetroPass();
  }
  showPickupToast(`Switched to ${variantMode === "fancy" ? "Fancy" : "Base"}`);
}

function toggleVariantMode() {
  const next = variantMode === "fancy" ? "base" : "fancy";
  applyVariantMode(next);
  if (next === "fancy") {
    addFancyColliders();
    loadFancyDecor();
    applyFancyMaterials();
    setupFancyCheckpoints();
    addFancyPillarTrees();
    addFancySky();
    setupRetroPass();
  } else {
    clearFancyDecor();
    removeFancyColliders();
    restoreBaseMaterials();
    clearFancyCheckpointFX();
    clearFancyPillarTrees();
    clearFancySky();
    disposeRetroPass();
  }
  saveVariantMode(next);
}

function saveGameState() {
  if (mazeGlowMaterial && typeof mazeGlowMaterial.getCount === "function") {
    mazeGlowCount = mazeGlowMaterial.getCount();
  }
  const checkpoint = getCurrentCheckpointPosition();
  const unlocked = Array.from(
    new Set(getUnlockedWeaponClasses().map((c) => c.name).filter(Boolean))
  );
  const equipped = getCurrentWeaponClass();
  const weaponPickupStates = weaponPickups.map((wp) => !!wp.collected);
  const ringPickupStates = ringPickups.map((rp) => !!rp.collected);
  const payload = {
    points: getPoints(),
    materials: {
      name: getMaterialName(),
      count: getMaterialCount(),
    },
    mazeGlow: {
      count: mazeGlowCount,
    },
    checkpoint: checkpoint
      ? { x: checkpoint.x, y: checkpoint.y, z: checkpoint.z }
      : null,
    unlocked,
    equipped: equipped ? equipped.name : null,
    weaponPickupStates,
    ringPickupStates,
    rings: serializeRings(),
    variantMode,
    equippedRingId: getEquippedRingId ? getEquippedRingId() : null,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    refreshContinueButton();
  } catch (err) {
    console.warn("Save failed", err);
  }
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Failed to load save", err);
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

  // 2.5b) 迷宫蘑菇数量
  if (data.mazeGlow && typeof data.mazeGlow.count === "number") {
    mazeGlowCount = data.mazeGlow.count;
    if (mazeGlowMaterial && typeof mazeGlowMaterial.setCount === "function") {
      mazeGlowMaterial.setCount(mazeGlowCount);
    }
  }

  // 2.6) 戒指（拥有 & 装备）
  if (data.rings) {
    restoreRings(data.rings);
  } else if (data.equippedRingId) {
    // 兼容旧存档：只有 equippedRingId 时，视为已拥有并装备
    addRingById(data.equippedRingId);
    equipRingById(data.equippedRingId);
  }

  // 2.7) 版本模式
  if (data.variantMode) {
    applyVariantMode(data.variantMode);
    saveVariantMode(data.variantMode);
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

  // 6) 戒指拾取刷新状态
  applyRingPickupState(data.ringPickupStates);
}

function startNewGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    console.warn("Failed to clear save", err);
  }

  resetUnlockedWeapons();
  equipWeaponClass(null);
  setPoints(0);
  setMaterialCount(0);
  mazeGlowCount = 0;
  if (mazeGlowMaterial && typeof mazeGlowMaterial.setCount === "function") {
    mazeGlowMaterial.setCount(0);
  }
  resetRings();
  clearCheckpoints(scene);
  initCheckpoints(scene);
  if (variantMode === "fancy") {
    setupFancyCheckpoints();
    addFancyPillarTrees();
    addFancySky();
  } else {
    clearFancyCheckpointFX();
    clearFancyPillarTrees();
    clearFancySky();
  }
  resetMaterials(scene);
  resetMazeGlowMaterials();
  resetPlayerState();
  resetEnemies(scene);
  resetWeaponPickups(scene);
  resetRingPickups(scene);
  refreshContinueButton();
  closeMainMenu();
  requestPointerLockIfPossible();
}

function continueGame() {
  const data = loadSavedState();
  if (!data) {
    if (pickupToastEl) {
      pickupToastEl.textContent = "No save available";
      pickupToastEl.style.display = "block";
    }
    refreshContinueButton();
    return;
  }

  applyGameState(data);
  if (data && data.variantMode) {
    applyVariantMode(data.variantMode);
  }
  if (variantMode === "fancy") {
    setupFancyCheckpoints();
    addFancyPillarTrees();
    addFancySky();
  } else {
    clearFancyCheckpointFX();
    clearFancyPillarTrees();
    clearFancySky();
  }
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
