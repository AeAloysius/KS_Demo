// InventoryUI.js
// Tab 打开/关闭的背包界面。
// 现在有两个模式：
//   1) "main"   背包主页，只显示分类 + 当前装备信息
//   2) "weapon" 武器页面：左侧武器列表 + 中间描述 + 右侧属性

import * as THREE from "three";
import { Sword_Box } from "../weapons/sword_box.js";
import {
  getMaterialCount,
  getMaterialName,
  getMaterialPreviewMesh,
  getMaterialDescription,
} from "./Materials/MaterialBase.js";
import { getRingEntries, getRingPreviewMesh, equipRingById } from "./Rings/RingManager.js";

// 已解锁的武器列表（初始为空，需拾取解锁）
const WEAPON_CLASSES = [];

// 状态
let isOpen = false;
let dom = {};
let selectedIndex = 0;            // 当前在武器列表里选中的索引
let selectedMaterialIndex = -1;   // 材料页选中的索引
const secondarySelected = {       // 其他二级分类选中索引
  material: -1,
  rune: -1,
  consumable: -1,
  ring: -1,
  key: -1,
};
let currentCategory = null;        // 左侧当前选中的分类，初始不选
let mode = "main";                // "main" | "weapon" | "material" | "rune" ...

// 预览渲染相关
let previewRenderer = null;
let previewScene = null;
let previewCamera = null;
let previewMesh = null;

// 注入自 main.js / player.js 的回调
let getEquippedWeaponClass = null;
let equipWeaponClassFn = null;
let onEquipCallback = null;
let onEquipRingCallback = null;

// 对外：解锁新武器（拾取时调用）
export function unlockWeaponClass(WeaponClass) {
  if (!WeaponClass) return;
  if (!WEAPON_CLASSES.includes(WeaponClass)) {
    WEAPON_CLASSES.push(WeaponClass);
  }
  // 若当前选中被删除，重新选第 0 个
  if (selectedIndex >= WEAPON_CLASSES.length) {
    selectedIndex = WEAPON_CLASSES.length - 1;
  }
  refreshWeaponList();
  refreshSelection();
}

// 获取当前已解锁的武器类列表
export function getUnlockedWeaponClasses() {
  return [...WEAPON_CLASSES];
}

// 重置武器解锁为默认状态（保留基础武器）
export function resetUnlockedWeapons() {
  WEAPON_CLASSES.splice(0, WEAPON_CLASSES.length);
  selectedIndex = 0;
  refreshWeaponList();
  refreshSelection();
}

// =============== 对外接口 ===============

export function initInventoryUI(options) {
  getEquippedWeaponClass = options.getEquippedWeaponClass;
  equipWeaponClassFn     = options.equipWeaponClass;
  onEquipCallback       = options.onEquip || null;
  onEquipRingCallback   = options.onEquipRing || onEquipCallback || null;

  dom.root       = document.getElementById("inventory-screen");
  dom.weaponList = document.getElementById("inv-weapon-list");
  dom.desc       = document.getElementById("inv-desc");
  dom.stats      = document.getElementById("inv-stats");
  dom.statsTitle = document.getElementById("inv-stats-title");
  dom.mainHand   = document.getElementById("inv-main-hand");
  dom.slotLabel  = document.getElementById("inv-slot-label");
  dom.equipBtn   = document.getElementById("inv-equip-main");
  dom.categoryList = document.getElementById("inv-category-list");
  dom.categoryButtons = document.querySelectorAll("#inv-category-list button");
  dom.preview    = document.getElementById("inv-preview");
  dom.backBtn    = document.getElementById("inv-back-btn");

  if (!dom.root) {
    console.warn("InventoryUI: #inventory-screen not found");
    return;
  }

  // 装备按钮：在武器页面中，把当前选中武器装到主手
  if (dom.equipBtn) {
    dom.equipBtn.addEventListener("click", () => {
      if (mode === "weapon") {
        const WeaponClass = WEAPON_CLASSES[selectedIndex];
        if (WeaponClass && equipWeaponClassFn) {
          equipWeaponClassFn(WeaponClass);
          refreshEquippedSlot();
          refreshWeaponList(); // 更新“装备中”标记
          if (typeof onEquipCallback === "function") {
            onEquipCallback(WeaponClass);
          }
        }
      } else if (mode === "ring") {
        equipSelectedRing();
      }
    });
  }

  // 返回按钮：从武器页面回到背包主页
  if (dom.backBtn) {
    dom.backBtn.addEventListener("click", () => {
      enterMainPage();
    });
  }

  // 分类按钮点击逻辑
  if (dom.categoryButtons && dom.categoryButtons.length) {
    dom.categoryButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.dataset.cat;
        currentCategory = cat;

        if (cat === "weapon") {
          enterWeaponPage();
        } else if (cat === "material") {
          enterMaterialPage();
        } else {
          enterSecondaryPage(cat);
        }
      });
    });
  }

  // 初始状态：打开背包时先进入主页，默认选中“武器”分类
  currentCategory = null;
  mode = "main";
  updateCategoryButtons();
  renderMainPage();
  refreshEquippedSlot();

  initPreviewRenderer();
}

// Tab / Esc 调用它来开关背包，可选关闭时是否重新申请指针锁定
export function toggleInventory({ lockOnClose = true } = {}) {
  if (!dom.root) return;

  isOpen = !isOpen;

  if (isOpen) {
    dom.root.classList.add("show");
    // 打开背包时退出 pointer lock
    if (document.pointerLockElement === document.body) {
      document.exitPointerLock();
    }
    // 每次打开时都回到主页（未选中状态）
    currentCategory = null;
    selectedMaterialIndex = -1;
    Object.keys(secondarySelected).forEach((k) => { secondarySelected[k] = -1; });
    mode = "main";
    updateCategoryButtons();
    renderMainPage();
    refreshEquippedSlot();
  } else {
    dom.root.classList.remove("show");
    if (lockOnClose && document.pointerLockElement !== document.body) {
      document.body.requestPointerLock();
    }
    renderPreview();
  }
}

export function isInventoryOpen() {
  return isOpen;
}

// Esc/back：若在二级页面则返回主页，若本就主页则不处理
export function backToInventoryHub() {
  if (!isOpen) return false;
  if (mode !== "main") {
    enterMainPage();
    return true;
  }
  return false;
}

// =============== 内部：模式切换 ===============

function renderMainPage() {
  mode = "main";
  currentCategory = null;
  if (dom.root) dom.root.classList.add("hub-mode");
  if (dom.categoryList) dom.categoryList.style.display = "block";
  if (dom.backBtn) dom.backBtn.style.display = "none";

  if (dom.weaponList) {
    dom.weaponList.style.display = "none";
    dom.weaponList.innerHTML = "";
  }
  if (dom.equipBtn) dom.equipBtn.style.display = "none";
  if (dom.stats) dom.stats.style.display = "none";
  if (dom.statsTitle) dom.statsTitle.style.display = "none";
  if (dom.preview) dom.preview.textContent = "";
  if (dom.desc) dom.desc.textContent = "";
  if (dom.slotLabel) dom.slotLabel.style.display = "none";
  if (dom.mainHand) dom.mainHand.textContent = "";
  updateCategoryButtons();
}

function enterMainPage() {
  renderMainPage();
  refreshEquippedSlot();
}

function enterWeaponPage() {
  mode = "weapon";
  currentCategory = "weapon";
  if (dom.root) dom.root.classList.remove("hub-mode");
  if (dom.categoryList) dom.categoryList.style.display = "none";
  updateCategoryButtons();
  renderWeaponPage();
  refreshEquippedSlot();
}

function enterMaterialPage() {
  enterSecondaryPage("material");
}

function enterSecondaryPage(cat) {
  mode = cat;
  currentCategory = cat;
  if (dom.root) dom.root.classList.remove("hub-mode");
  if (dom.categoryList) dom.categoryList.style.display = "none";
  updateCategoryButtons();
  renderSecondaryPage(cat);
}

function renderSecondaryPage(cat) {
  if (dom.root) dom.root.classList.remove("hub-mode");
  if (dom.categoryList) dom.categoryList.style.display = "none";
  if (dom.backBtn) dom.backBtn.style.display = "inline-block";

  if (dom.weaponList) {
    dom.weaponList.style.display = "block";
    dom.weaponList.innerHTML = "";
  }
  if (dom.equipBtn) dom.equipBtn.style.display = "none";
  if (dom.stats) dom.stats.style.display = "none";
  if (dom.statsTitle) dom.statsTitle.style.display = "none";
  if (dom.slotLabel) dom.slotLabel.style.display = "none";
  if (dom.mainHand) dom.mainHand.textContent = "";

  refreshSecondaryList(cat);
  if (getSelectedIndex(cat) < 0) {
    const first = getCategoryEntries(cat).findIndex((e) => e.count > 0);
    setSelectedIndex(cat, first);
  }
  refreshSecondarySelection(cat);

  if (cat === "ring" && dom.equipBtn) {
    dom.equipBtn.style.display = "inline-block";
    dom.equipBtn.textContent = "Equip Ring";
  }
}

function renderWeaponPage() {
  if (dom.root) dom.root.classList.remove("hub-mode");
  if (dom.categoryList) dom.categoryList.style.display = "none";
  if (dom.backBtn) {
    dom.backBtn.style.display = "inline-block";
  }

  if (dom.weaponList) {
    dom.weaponList.style.display = "block";
  }

  if (dom.equipBtn) {
    dom.equipBtn.style.display = "inline-block";
  }

  if (dom.stats) {
    dom.stats.style.display = "block";
  }

  if (dom.statsTitle) {
    dom.statsTitle.style.display = "block";
    dom.statsTitle.textContent = "Weapon Stats";
  }

  if (dom.slotLabel) {
    dom.slotLabel.textContent = "Main Hand:";
    dom.slotLabel.style.display = "block";
  }

  // 进入武器页面时，刷新武器列表和当前选中
  refreshWeaponList();
  refreshSelection();
}

// =============== 工具：分类按钮高亮、文本 ===============

function updateCategoryButtons() {
  if (!dom.categoryButtons) return;
  dom.categoryButtons.forEach((btn) => {
    btn.classList.toggle("active", currentCategory && btn.dataset.cat === currentCategory);
  });
}

function getCategoryLabel(cat) {
  switch (cat) {
    case "weapon":     return "Weapons";
    case "rune":       return "Runes";
    case "consumable": return "Consumables";
    case "ring":       return "Rings";
    case "key":        return "Key Items";
    case "material":   return "Materials";
    default:            return "Inventory";
  }
}

function getSelectedIndex(cat) {
  if (cat === "material") return selectedMaterialIndex;
  return secondarySelected[cat] ?? -1;
}

function setSelectedIndex(cat, idx) {
  if (cat === "material") {
    selectedMaterialIndex = idx;
  } else if (cat in secondarySelected) {
    secondarySelected[cat] = idx;
  }
}

function getPlaceholderEntries(cat) {
  const label = getCategoryLabel(cat);
  return [{ name: `${label}`, desc: `Collected ${label} will appear here.`, count: 0 }];
}

function getCategoryEntries(cat) {
  switch (cat) {
    case "material":
      return getMaterialEntries();
    case "ring":
      return getRingEntries();
    case "rune":
    case "consumable":
    case "key":
      return getPlaceholderEntries(cat);
    default:
      return getPlaceholderEntries(cat);
  }
}

// =============== 武器列表相关 ===============

function refreshWeaponList() {
  if (!dom.weaponList) return;

  dom.weaponList.innerHTML = "";

  if (!WEAPON_CLASSES.length) {
    const div = document.createElement("div");
    div.className = "inv-empty";
    div.textContent = "No weapons";
    dom.weaponList.appendChild(div);
    if (dom.equipBtn) dom.equipBtn.disabled = true;
    return;
  }

  if (dom.equipBtn) dom.equipBtn.disabled = false;

  if (selectedIndex >= WEAPON_CLASSES.length) {
    selectedIndex = WEAPON_CLASSES.length - 1;
  }

  const equippedClass = getEquippedWeaponClass
    ? getEquippedWeaponClass()
    : null;

  WEAPON_CLASSES.forEach((WeaponClass, index) => {
    const name = WeaponClass.displayName || WeaponClass.name || "Weapon";
    const btn = document.createElement("button");
    btn.className = "inv-weapon-row";
    btn.dataset.index = index;

    const isEquipped = equippedClass === WeaponClass;
    btn.textContent = name + (isEquipped ? "  [Equipped]" : "");

    if (index === selectedIndex) {
      btn.classList.add("selected");
    }

    btn.addEventListener("click", () => {
      selectedIndex = index;
      refreshSelection();
    });

    dom.weaponList.appendChild(btn);
  });
}

// 材料列表（目前只有默认材料）
function getMaterialEntries() {
  const name = typeof getMaterialName === "function" ? getMaterialName() : "Material";
  const desc = typeof getMaterialDescription === "function" ? getMaterialDescription() : "";
  const count = typeof getMaterialCount === "function" ? getMaterialCount() : 0;
  return [{ name, desc, count }];
}

function refreshSecondaryList(cat) {
  if (!dom.weaponList) return;
  dom.weaponList.innerHTML = "";

  const entries = getCategoryEntries(cat);
  const hasAny = entries.some((e) => e.count > 0);

  if (!hasAny) {
    const div = document.createElement("div");
    div.className = "inv-empty";
    div.textContent = `No ${getCategoryLabel(cat)} to preview`;
    dom.weaponList.appendChild(div);
    setSelectedIndex(cat, -1);
    return;
  }

  if (getSelectedIndex(cat) >= entries.length) {
    setSelectedIndex(cat, entries.length - 1);
  }

  entries.forEach((entry, index) => {
    const row = document.createElement("button");
    row.className = "inv-weapon-row";
    row.dataset.index = index;
    const equippedMark = entry.equipped ? " [Equipped]" : "";
    row.textContent = `${entry.name}${equippedMark}  x ${entry.count}`;
    if (index === getSelectedIndex(cat)) row.classList.add("selected");
    row.addEventListener("click", () => {
      setSelectedIndex(cat, index);
      refreshSecondarySelection(cat);
      const rows = dom.weaponList.querySelectorAll(".inv-weapon-row");
      rows.forEach((r, i) => r.classList.toggle("selected", i === getSelectedIndex(cat)));
    });
    dom.weaponList.appendChild(row);
  });
}

function refreshSecondarySelection(cat) {
  const entries = getCategoryEntries(cat);
  const entry = entries[getSelectedIndex(cat)];
  const label = getCategoryLabel(cat);

  if (!entry || entry.count <= 0) {
    if (dom.preview) dom.preview.textContent = `No ${label} yet`;
    if (dom.desc) dom.desc.textContent = "";
    if (cat === "ring" && dom.equipBtn) dom.equipBtn.disabled = true;
    return;
  }

  if (dom.desc) {
    const equippedSuffix = entry.equipped ? " (Equipped)" : "";
    dom.desc.textContent = (entry.desc || "") + equippedSuffix;
  }

  if (dom.preview) {
    if (cat === "material") {
      renderMaterialPreview(entry.name);
    } else if (cat === "ring") {
      renderRingPreview(entry);
    } else {
      dom.preview.textContent = `${label}: ${entry.name}`;
    }
  }

  if (cat === "ring" && dom.equipBtn) {
    dom.equipBtn.disabled = entry.count <= 0;
    dom.equipBtn.textContent = entry.equipped ? "Equipped" : "Equip Ring";
  }
}

function equipSelectedRing() {
  const entries = getCategoryEntries("ring");
  const idx = getSelectedIndex("ring");
  const entry = entries[idx];
  if (!entry || entry.count <= 0) return;
  equipRingById(entry.id);
  refreshSecondaryList("ring");
  refreshSecondarySelection("ring");
  if (typeof onEquipRingCallback === "function") {
    onEquipRingCallback(entry.id);
  }
}

// 包装函数：材料仍沿用旧命名，内部转到新逻辑
function refreshMaterialList() {
  refreshSecondaryList("material");
}

function refreshMaterialSelection() {
  refreshSecondarySelection("material");
}

function refreshSelection() {
  if (!WEAPON_CLASSES.length || mode !== "weapon") {
    if (dom.preview) dom.preview.textContent = "No weapons to preview";
    if (dom.desc) dom.desc.textContent = "Pick up a weapon to view it here";
    if (dom.stats) dom.stats.innerHTML = "";
    return;
  }

  const WeaponClass = WEAPON_CLASSES[selectedIndex];
  const name = WeaponClass.displayName || WeaponClass.name || "Weapon";
  const desc =
    WeaponClass.description ||
    "A basic weapon. Add more details in the weapon class static fields.";
  const stats = WeaponClass.stats || {};

  // 高亮选中的行
  if (dom.weaponList) {
    const rows = dom.weaponList.querySelectorAll(".inv-weapon-row");
    rows.forEach((row) => {
      const idx = Number(row.dataset.index);
      row.classList.toggle("selected", idx === selectedIndex);
    });
  }

  renderWeaponPreview(WeaponClass, name);

  if (dom.desc) {
    dom.desc.textContent = desc;
  }

  if (dom.stats) {
    const damage = stats.damage ?? "?";
    const range = stats.range ?? "?";
    const cooldown = stats.cooldown ?? "?";
    dom.stats.innerHTML = `
      <div>Damage: ${damage}</div>
      <div>Range: ${range}</div>
      <div>Cooldown: ${cooldown} s</div>
    `;
  }
}

// =============== 显示当前主手武器 ===============

function refreshEquippedSlot() {
  if (!dom.mainHand) return;
  const equippedClass = getEquippedWeaponClass
    ? getEquippedWeaponClass()
    : null;

  if (!equippedClass) {
    dom.mainHand.textContent = "None";
    return;
  }

  const name = equippedClass.displayName || equippedClass.name || "Weapon";
  dom.mainHand.textContent = name;
}

// =============== 3D 预览 ===============

function initPreviewRenderer() {
  if (!dom.preview) return;

  // 已经有 renderer，但可能被 DOM 清掉了，再次挂载即可
  if (previewRenderer) {
    if (previewRenderer.domElement.parentElement !== dom.preview) {
      dom.preview.innerHTML = "";
      dom.preview.appendChild(previewRenderer.domElement);
    }
    resizePreviewRenderer();
    return;
  }
  const { clientWidth: w, clientHeight: h } = dom.preview;

  previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  previewRenderer.setPixelRatio(window.devicePixelRatio || 1);
  previewRenderer.setSize(w, h);
  previewRenderer.setClearColor(0x000000, 0);

  previewScene = new THREE.Scene();
  previewCamera = new THREE.PerspectiveCamera(35, w / h, 0.01, 20);
  previewCamera.position.set(0, 0, 3);

  const amb = new THREE.AmbientLight(0xffffff, 0.8);
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(3, 4, 5);
  previewScene.add(amb);
  previewScene.add(dir);

  dom.preview.innerHTML = "";
  previewRenderer.domElement.style.width = "100%";
  previewRenderer.domElement.style.height = "100%";
  previewRenderer.domElement.style.objectFit = "contain";
  dom.preview.appendChild(previewRenderer.domElement);

  window.addEventListener("resize", resizePreviewRenderer);
}

function resizePreviewRenderer() {
  if (!previewRenderer || !previewCamera || !dom.preview) return;
  const w = dom.preview.clientWidth || 1;
  const h = dom.preview.clientHeight || 1;
  previewCamera.aspect = w / h;
  previewCamera.updateProjectionMatrix();
  previewRenderer.setSize(w, h);
  renderPreview();
}

function clearPreviewMesh() {
  if (previewMesh && previewScene) {
    previewScene.remove(previewMesh);
    previewMesh = null;
  }
}

function buildWeaponPreviewMesh(WeaponClass) {
  if (!WeaponClass || !previewCamera) return null;
  try {
    const tempWeapon = new WeaponClass(previewCamera);
    const mesh = tempWeapon.mesh ? tempWeapon.mesh.clone(true) : null;
    if (tempWeapon.mesh && tempWeapon.mesh.parent) {
      tempWeapon.mesh.parent.remove(tempWeapon.mesh);
    }
    if (!mesh && typeof tempWeapon.createMesh === "function") {
      return tempWeapon.createMesh();
    }
    return mesh;
  } catch (err) {
    console.warn("Failed to create preview model", err);
    return null;
  }
}

function buildMaterialPreviewMesh() {
  if (typeof getMaterialPreviewMesh !== "function") return null;
  const mesh = getMaterialPreviewMesh();
  return mesh || null;
}

function renderWeaponPreview(WeaponClass, nameForFallback) {
  if (!dom.preview) return;
  initPreviewRenderer();
  if (!previewRenderer || !previewScene || !previewCamera) {
    dom.preview.textContent = `${nameForFallback} 的模型预览不可用`;
    return;
  }

  clearPreviewMesh();

  const mesh = buildWeaponPreviewMesh(WeaponClass);
  if (!mesh) {
    dom.preview.textContent = `${nameForFallback} 的模型预览不可用`;
    return;
  }

  // 居中并统一比例
  const box = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  mesh.position.sub(center);

  const radius = Math.max(size.x, size.y, size.z) * 0.5;
  const fov = THREE.MathUtils.degToRad(previewCamera.fov);
  const distHeight = (radius / Math.tan(fov / 2)) * 1.1; // 预留边距
  const distWidth = (radius / (Math.tan(fov / 2) * previewCamera.aspect)) * 1.1;
  const dist = Math.max(distHeight, distWidth);
  previewCamera.position.set(0, 0, dist);
  previewCamera.lookAt(0, 0, 0);

  // 预览朝向：普通武器统一向左 45°；镰刀单独旋转让刀刃朝下方
  const isScythe = WeaponClass && (WeaponClass.name === "Scythe" || WeaponClass.displayName === "Scythe");
  if (isScythe) {
    mesh.rotation.x = Math.PI / 4;
    mesh.rotation.y = -Math.PI / 4;
  } else {
    mesh.rotation.z = Math.PI / 4;
  }

  previewScene.add(mesh);
  previewMesh = mesh;
  renderPreview();
}

function renderMaterialPreview(nameForFallback) {
  if (!dom.preview) return;
  initPreviewRenderer();
  if (!previewRenderer || !previewScene || !previewCamera) {
    dom.preview.textContent = `${nameForFallback} 的模型预览不可用`;
    return;
  }

  clearPreviewMesh();

  const mesh = buildMaterialPreviewMesh();
  if (!mesh) {
    dom.preview.textContent = `${nameForFallback} 的模型预览不可用`;
    return;
  }

  const box = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  mesh.position.sub(center);

  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 0.5;
  const fov = THREE.MathUtils.degToRad(previewCamera.fov);
  const distHeight = (radius / Math.tan(fov / 2)) * 1.1;
  const distWidth = (radius / (Math.tan(fov / 2) * previewCamera.aspect)) * 1.1;
  const dist = Math.max(distHeight, distWidth, 1.2);
  previewCamera.position.set(0, 0, dist);
  previewCamera.lookAt(0, 0, 0);

  mesh.rotation.z = Math.PI / 6;

  previewScene.add(mesh);
  previewMesh = mesh;
  renderPreview();
}

function renderRingPreview(entry) {
  if (!dom.preview) return;
  initPreviewRenderer();
  if (!previewRenderer || !previewScene || !previewCamera) {
    dom.preview.textContent = `${entry.name} 的模型预览不可用`;
    return;
  }

  clearPreviewMesh();

  const mesh = typeof getRingPreviewMesh === "function" ? getRingPreviewMesh(entry.id) : null;
  if (!mesh) {
    dom.preview.textContent = `${entry.name} 的模型预览不可用`;
    return;
  }

  // 统一给戒指一个 45° 旋转，方便观赏厚度和内圈
  mesh.rotation.y = Math.PI / 4;
  mesh.rotation.x = Math.PI / 12;

  const box = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  mesh.position.sub(center);

  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 0.3;
  const fov = THREE.MathUtils.degToRad(previewCamera.fov);
  const distHeight = (radius / Math.tan(fov / 2)) * 1.2;
  const distWidth = (radius / (Math.tan(fov / 2) * previewCamera.aspect)) * 1.2;
  const dist = Math.max(distHeight, distWidth, 1.0);
  previewCamera.position.set(0, 0, dist);
  previewCamera.lookAt(0, 0, 0);

  previewScene.add(mesh);
  previewMesh = mesh;
  renderPreview();
}

function renderPreview() {
  if (!previewRenderer || !previewScene || !previewCamera) return;
  previewRenderer.render(previewScene, previewCamera);
}
