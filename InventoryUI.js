// InventoryUI.js
// Tab 打开/关闭的背包界面。
// 现在有两个模式：
//   1) "main"   背包主页，只显示分类 + 当前装备信息
//   2) "weapon" 武器页面：左侧武器列表 + 中间描述 + 右侧属性

import { Sword_Box } from "../weapons/sword_box.js";

// 以后增加武器就在这里加即可
const WEAPON_CLASSES = [Sword_Box];

// 状态
let isOpen = false;
let dom = {};
let selectedIndex = 0;            // 当前在武器列表里选中的索引
let currentCategory = "weapon";   // 左侧当前选中的分类
let mode = "main";                // "main" | "weapon"

// 注入自 main.js / player.js 的回调
let getEquippedWeaponClass = null;
let equipWeaponClassFn = null;

// =============== 对外接口 ===============

export function initInventoryUI(options) {
  getEquippedWeaponClass = options.getEquippedWeaponClass;
  equipWeaponClassFn     = options.equipWeaponClass;

  dom.root       = document.getElementById("inventory-screen");
  dom.weaponList = document.getElementById("inv-weapon-list");
  dom.desc       = document.getElementById("inv-desc");
  dom.stats      = document.getElementById("inv-stats");
  dom.mainHand   = document.getElementById("inv-main-hand");
  dom.equipBtn   = document.getElementById("inv-equip-main");
  dom.categoryButtons = document.querySelectorAll("#inv-category-list button");
  dom.preview    = document.getElementById("inv-preview");
  dom.backBtn    = document.getElementById("inv-back-btn");

  if (!dom.root) {
    console.warn("InventoryUI: 未找到 #inventory-screen");
    return;
  }

  // 装备按钮：在武器页面中，把当前选中武器装到主手
  if (dom.equipBtn) {
    dom.equipBtn.addEventListener("click", () => {
      if (mode !== "weapon") return;
      const WeaponClass = WEAPON_CLASSES[selectedIndex];
      if (WeaponClass && equipWeaponClassFn) {
        equipWeaponClassFn(WeaponClass);
        refreshEquippedSlot();
        refreshWeaponList(); // 更新“装备中”标记
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
          // 进入武器页面
          enterWeaponPage();
        } else {
          // 其他分类暂时只在主页里显示占位文字
          enterMainPage(cat);
        }
      });
    });
  }

  // 初始状态：打开背包时先进入主页，默认选中“武器”分类
  currentCategory = "weapon";
  mode = "main";
  updateCategoryButtons();
  renderMainPage();
  refreshEquippedSlot();
}

// Tab / Esc 调用它来开关背包
export function toggleInventory() {
  if (!dom.root) return;

  isOpen = !isOpen;

  if (isOpen) {
    dom.root.classList.add("show");
    // 打开背包时退出 pointer lock
    if (document.pointerLockElement === document.body) {
      document.exitPointerLock();
    }
    // 每次打开时都回到主页
    currentCategory = "weapon";
    mode = "main";
    updateCategoryButtons();
    renderMainPage();
    refreshEquippedSlot();
  } else {
    dom.root.classList.remove("show");
  }
}

export function isInventoryOpen() {
  return isOpen;
}

// =============== 内部：模式切换 ===============

function enterMainPage(category) {
  if (category) currentCategory = category;
  mode = "main";
  updateCategoryButtons();
  renderMainPage();
  refreshEquippedSlot();
}

function enterWeaponPage() {
  mode = "weapon";
  currentCategory = "weapon";
  updateCategoryButtons();
  renderWeaponPage();
  refreshEquippedSlot();
}

// =============== 渲染：主页 & 武器页 ===============

function renderMainPage() {
  // 主页：不显示左侧武器列表、不显示描述和武器属性，只显示装备信息和占位说明

  if (dom.backBtn) {
    dom.backBtn.style.display = "none"; // 在主页不需要返回按钮
  }

  if (dom.weaponList) {
    dom.weaponList.style.display = "none";
    dom.weaponList.innerHTML = "";
  }

  if (dom.desc) {
    dom.desc.textContent = "";
  }

  if (dom.stats) {
    // 简单占位：以后你可以在这里填玩家属性信息
    const label = getCategoryLabel(currentCategory);
    dom.stats.innerHTML = `<div>${label} 页面暂未实现（主页占位）</div>`;
  }

  if (dom.preview) {
    dom.preview.textContent = "背包 - 主菜单（暂时占位）";
  }
}

function renderWeaponPage() {
  if (dom.backBtn) {
    dom.backBtn.style.display = "inline-block";
  }

  if (dom.weaponList) {
    dom.weaponList.style.display = "block";
  }

  // 进入武器页面时，刷新武器列表和当前选中
  refreshWeaponList();
  refreshSelection();
}

// =============== 工具：分类按钮高亮、文本 ===============

function updateCategoryButtons() {
  if (!dom.categoryButtons) return;
  dom.categoryButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.cat === currentCategory);
  });
}

function getCategoryLabel(cat) {
  switch (cat) {
    case "weapon":     return "武器";
    case "rune":       return "符文";
    case "consumable": return "消耗品";
    case "ring":       return "戒指";
    case "key":        return "关键物品";
    case "material":   return "材料";
    default:           return "背包";
  }
}

// =============== 武器列表相关 ===============

function refreshWeaponList() {
  if (!dom.weaponList) return;

  dom.weaponList.innerHTML = "";

  if (!WEAPON_CLASSES.length) {
    const div = document.createElement("div");
    div.className = "inv-empty";
    div.textContent = "没有武器";
    dom.weaponList.appendChild(div);
    return;
  }

  const equippedClass = getEquippedWeaponClass
    ? getEquippedWeaponClass()
    : null;

  WEAPON_CLASSES.forEach((WeaponClass, index) => {
    const name = WeaponClass.displayName || WeaponClass.name || "武器";
    const btn = document.createElement("button");
    btn.className = "inv-weapon-row";
    btn.dataset.index = index;

    const isEquipped = equippedClass === WeaponClass;
    btn.textContent = name + (isEquipped ? "  [装备中]" : "");

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

function refreshSelection() {
  if (!WEAPON_CLASSES.length || mode !== "weapon") return;

  const WeaponClass = WEAPON_CLASSES[selectedIndex];
  const name = WeaponClass.displayName || WeaponClass.name || "武器";
  const desc =
    WeaponClass.description ||
    "一把普通的武器，可以在武器类的静态字段中填写更详细的描述。";
  const stats = WeaponClass.stats || {};

  // 高亮选中的行
  if (dom.weaponList) {
    const rows = dom.weaponList.querySelectorAll(".inv-weapon-row");
    rows.forEach((row) => {
      const idx = Number(row.dataset.index);
      row.classList.toggle("selected", idx === selectedIndex);
    });
  }

  if (dom.preview) {
    dom.preview.textContent = `${name} 的模型预览（暂时占位）`;
  }

  if (dom.desc) {
    dom.desc.textContent = desc;
  }

  if (dom.stats) {
    const damage = stats.damage ?? "?";
    const range = stats.range ?? "?";
    const cooldown = stats.cooldown ?? "?";
    dom.stats.innerHTML = `
      <div>伤害：${damage}</div>
      <div>攻击距离：${range}</div>
      <div>冷却时间：${cooldown} 秒</div>
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
    dom.mainHand.textContent = "空";
    return;
  }

  const name = equippedClass.displayName || equippedClass.name || "武器";
  dom.mainHand.textContent = name;
}
