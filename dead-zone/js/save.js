/* DEAD ZONE — persistent save data */

import { ITEMS, PLAYER_BASE, baseStorage } from './data.js';
import { Inventory, Equipment, createItem, makeFieldInventory, fieldRows, itemH, weaponStats, magSize } from './inventory.js';
import { safeStorageGet, safeStorageSet, safeStorageRemove, clamp } from './util.js';

const SAVE_KEY = 'deadzone_save_v1';
const SAVE_VERSION = 2;

export function maxHealth(save) {
  const bed = save.camp.buildings.bed ? 1 : 0;
  return PLAYER_BASE.maxHealth + (save.player.level - 1) * 4 + bed * 15;
}

export function maxStamina(save) {
  return PLAYER_BASE.maxStamina + (save.player.level - 1) * 2;
}

export function xpToNext(level) {
  return 120 + (level - 1) * 90;
}

export function addXp(save, amount) {
  const result = { levels: 0, gained: amount };
  save.player.xp += amount;
  while (save.player.xp >= xpToNext(save.player.level) && save.player.level < 30) {
    save.player.xp -= xpToNext(save.player.level);
    save.player.level++;
    result.levels++;
  }
  return result;
}

export function campDefense(save) {
  return (save.camp.buildings.wall || 0) * 2 + (save.camp.buildings.barricade || 0) * 3;
}

export function storageRows(save) {
  return baseStorage.rows + (save.camp.buildings.crate || 0);
}

export function storageCapacity(save) {
  return baseStorage.cols * storageRows(save);
}

function fillStarter() {
  const equipment = new Equipment();
  equipment.primary = createItem('pistol', { loaded: 12, cond: 190 });
  equipment.melee = createItem('knife', { cond: 120 });
  equipment.armor = createItem('hoodie', { cond: 70 });
  equipment.backpack = createItem('schoolbag');

  const field = makeFieldInventory(equipment);
  field.addStack('ammo9', 36);
  field.addStack('beans', 2);
  field.addStack('water', 2);
  field.addStack('bandage', 3);
  field.addStack('jerky', 1);

  const storage = new Inventory(baseStorage.cols, baseStorage.rows, 'Camp Storage');
  storage.addStack('wood', 34);
  storage.addStack('scrap', 24);
  storage.addStack('fabric', 18);
  storage.addStack('components', 8);
  storage.addStack('chemicals', 5);
  storage.addStack('fuel', 4);
  storage.addStack('rope', 6);
  storage.addStack('stone', 10);
  storage.addStack('nails', 16);
  storage.addStack('ammo9', 48);
  storage.addStack('beans', 3);
  storage.addStack('water', 3);
  storage.addStack('bandage', 4);
  storage.addStack('bat', 1);
  storage.addStack('repairkit', 1);
  storage.addStack('flare', 1);

  return { equipment, field, storage };
}

export function newSave() {
  const starter = fillStarter();
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    day: 1,
    player: { level: 1, xp: 0, totalKills: 0, totalRaids: 0, extracted: 0, deaths: 0 },
    camp: {
      buildings: {
        workbench: 0, crate: 0, garden: 0, collector: 0, generator: 0,
        tower: 0, campfire: 0, bed: 0, wall: 0, barricade: 0
      },
      storage: starter.storage,
      lastGardenDay: 0,
      lastCollectorDay: 0
    },
    field: starter.field,
    equipment: starter.equipment,
    settings: { sound: true, shake: true, view: 'iso' }
  };
}

export function serialize(save) {
  return {
    version: SAVE_VERSION,
    createdAt: save.createdAt,
    day: save.day,
    player: Object.assign({}, save.player),
    camp: {
      buildings: Object.assign({}, save.camp.buildings),
      storage: save.camp.storage.toJSON(),
      lastGardenDay: save.camp.lastGardenDay,
      lastCollectorDay: save.camp.lastCollectorDay
    },
    field: save.field.toJSON(),
    equipment: save.equipment.toJSON(),
    settings: Object.assign({}, save.settings)
  };
}

export function deserialize(raw) {
  if (!raw || !raw.player) return null;
  const save = {
    version: SAVE_VERSION,
    createdAt: raw.createdAt || Date.now(),
    day: raw.day || 1,
    player: Object.assign({ level: 1, xp: 0, totalKills: 0, totalRaids: 0, extracted: 0, deaths: 0 }, raw.player),
    camp: {
      buildings: Object.assign({
        workbench: 0, crate: 0, garden: 0, collector: 0, generator: 0,
        tower: 0, campfire: 0, bed: 0, wall: 0, barricade: 0
      }, raw.camp ? raw.camp.buildings : {}),
      storage: Inventory.fromJSON(raw.camp ? raw.camp.storage : { cols: baseStorage.cols, rows: baseStorage.rows, items: [] }, 'Camp Storage'),
      lastGardenDay: (raw.camp && raw.camp.lastGardenDay) || 0,
      lastCollectorDay: (raw.camp && raw.camp.lastCollectorDay) || 0
    },
    field: null,
    equipment: Equipment.fromJSON(raw.equipment),
    settings: Object.assign({ sound: true, shake: true, view: 'iso' }, raw.settings || {})
  };
  const rows = storageRows(save);
  save.camp.storage.resize(baseStorage.cols, rows);
  save.field = raw.field
    ? Inventory.fromJSON(raw.field, 'Field Kit')
    : makeFieldInventory(save.equipment);
  const targetRows = fieldRows(save.equipment);
  if (save.field.rows !== targetRows) {
    if (!save.field.resize(PLAYER_BASE.cols, targetRows)) {
      const overflow = save.field.items.filter(it => it.y + itemH(it) > targetRows);
      for (const it of overflow) save.camp.storage.add(save.field.remove(it.uid));
      save.field.resize(PLAYER_BASE.cols, targetRows);
    }
  }
  return save;
}

export function saveGame(save) {
  return safeStorageSet(SAVE_KEY, serialize(save));
}

export function loadGame() {
  const raw = safeStorageGet(SAVE_KEY);
  if (!raw) return null;
  try { return deserialize(raw); } catch (e) { console.error('Save load failed', e); return null; }
}

export function hasSave() { return !!safeStorageGet(SAVE_KEY); }
export function wipeSave() { safeStorageRemove(SAVE_KEY); }

/** Move all field-kit items into camp storage. Returns report. */
export function storeExtractedLoot(save) {
  const report = { stored: [], lost: [] };
  const items = save.field.items.slice();
  for (const item of items) {
    const qty = item.qty;
    const leftover = save.camp.storage.add(item);
    if (leftover === 0) {
      report.stored.push({ id: item.id, qty });
      save.field.remove(item.uid);
    } else if (leftover < qty) {
      report.stored.push({ id: item.id, qty: qty - leftover });
      report.lost.push({ id: item.id, qty: leftover });
      item.qty = leftover;
    } else {
      report.lost.push({ id: item.id, qty });
    }
  }
  return report;
}

export function loseFieldKit(save) {
  const lost = [];
  for (const item of save.field.items.slice()) {
    lost.push({ id: item.id, qty: item.qty });
    save.field.remove(item.uid);
  }
  for (const slot of ['primary', 'melee', 'armor', 'backpack', 'utility']) {
    const item = save.equipment[slot];
    if (item) {
      lost.push({ id: item.id, qty: item.qty, equipped: true });
      save.equipment[slot] = null;
    }
  }
  save.field.resize(PLAYER_BASE.cols, PLAYER_BASE.rows);
  return lost;
}

function scoreItem(item) {
  const d = ITEMS[item.id];
  if (!d) return -1;
  if (d.weapon && d.weapon.kind === 'gun') return d.weapon.damage * 2 + (d.weapon.mag || 0) * 2;
  if (d.weapon) return d.weapon.damage * 1.5;
  if (d.armor) return d.armor.value * 4;
  if (d.bag) return d.bag.rows * 30;
  return 0;
}

function takeBestFromStorage(save, filter) {
  let best = null;
  for (const item of save.camp.storage.items) {
    if (!filter(item)) continue;
    if (!best || scoreItem(item) > scoreItem(best)) best = item;
  }
  if (!best) return null;
  return save.camp.storage.remove(best.uid);
}

export function quickLoadout(save) {
  const messages = [];
  if (!save.equipment.backpack) {
    const backpack = takeBestFromStorage(save, it => ITEMS[it.id].bag);
    if (backpack) { save.equipment.backpack = backpack; messages.push(ITEMS[backpack.id].name + ' equipped'); }
  }
  if (save.field.rows !== fieldRows(save.equipment)) save.field.resize(PLAYER_BASE.cols, fieldRows(save.equipment));

  if (!save.equipment.primary) {
    const gun = takeBestFromStorage(save, it => ITEMS[it.id].type === 'weapon' && ITEMS[it.id].slot === 'primary');
    if (gun) { save.equipment.primary = gun; messages.push(ITEMS[gun.id].name + ' equipped'); }
  }
  if (!save.equipment.melee) {
    const melee = takeBestFromStorage(save, it => ITEMS[it.id].type === 'weapon' && ITEMS[it.id].slot === 'melee');
    if (melee) { save.equipment.melee = melee; messages.push(ITEMS[melee.id].name + ' equipped'); }
  }
  if (!save.equipment.armor) {
    const armor = takeBestFromStorage(save, it => ITEMS[it.id].type === 'armor');
    if (armor) { save.equipment.armor = armor; messages.push(ITEMS[armor.id].name + ' equipped'); }
  }
  if (!save.equipment.utility) {
    const util = takeBestFromStorage(save, it => ITEMS[it.id].type === 'utility');
    if (util) { save.equipment.utility = util; messages.push(ITEMS[util.id].name + ' equipped'); }
  }

  const addFromStorage = (id, qty) => {
    const have = Math.min(qty, save.camp.storage.count(id));
    if (have <= 0) return 0;
    save.camp.storage.consume(id, have);
    return have - save.field.addStack(id, have);
  };

  const primary = save.equipment.primary;
  if (primary) {
    const stats = weaponStats(primary);
    if (stats && stats.kind === 'gun' && save.field.count(stats.ammo) < magSize(primary) * 2) {
      const n = addFromStorage(stats.ammo, magSize(primary) * 2);
      if (n) messages.push('+' + n + ' ' + ITEMS[stats.ammo].name);
    } else if (stats && stats.kind === 'melee') {
      /* nothing */
    }
  }
  const pulses = [
    ['bandage', 3], ['water', 2], ['beans', 2], ['painkillers', 1], ['flare', 1]
  ];
  for (const [id, qty] of pulses) {
    if (save.field.count(id) >= qty) continue;
    const n = addFromStorage(id, qty - save.field.count(id));
    if (n) messages.push('+' + n + ' ' + ITEMS[id].name);
  }
  return messages;
}

export function processCampProduction(save) {
  const report = { items: [], raid: null };
  const b = save.camp.buildings;
  if (b.garden && save.camp.lastGardenDay !== save.day) {
    save.camp.lastGardenDay = save.day;
    const qty = 1 + b.garden;
    const items = ['apple', 'apple', 'jerky', 'beans'];
    for (let i = 0; i < qty; i++) {
      const id = items[i % items.length];
      if (save.camp.storage.addStack(id, 1) === 0) report.items.push({ id, qty: 1 });
    }
  }
  if (b.collector && save.camp.lastCollectorDay !== save.day) {
    save.camp.lastCollectorDay = save.day;
    const qty = 1 + b.collector;
    if (save.camp.storage.addStack('purifiedwater', qty) === 0) report.items.push({ id: 'purifiedwater', qty });
  }

  const defense = campDefense(save);
  const threat = Math.max(0, save.day * 2 + 4 - defense);
  if (save.day >= 3 && defense < 20) {
    const roll = Math.random();
    if (roll < clamp(0.1 + threat * 0.025, 0, 0.55)) {
      const stolen = [];
      const lootable = save.camp.storage.items.filter(it => ITEMS[it.id].type === 'material' || ITEMS[it.id].type === 'food');
      const count = Math.min(lootable.length, 1 + Math.floor(Math.random() * 3));
      for (let i = 0; i < count; i++) {
        const it = lootable[Math.floor(Math.random() * lootable.length)];
        if (!it) break;
        const take = Math.max(1, Math.ceil(it.qty * 0.4));
        const removed = Math.min(take, it.qty);
        it.qty -= removed;
        stolen.push({ id: it.id, qty: removed });
        if (it.qty <= 0) save.camp.storage.remove(it.uid);
      }
      report.raid = { repelled: false, stolen };
    } else {
      report.raid = { repelled: true, stolen: [] };
    }
  }
  return report;
}
