/* DEAD ZONE — item instances, grid inventory, equipment */

import { ITEMS, PLAYER_BASE } from './data.js';
import { uid, clamp } from './util.js';

let uidCounter = 0;
export function newUid() {
  uidCounter++;
  return 'it' + Date.now().toString(36) + uidCounter.toString(36);
}

export const defOf = (item) => ITEMS[item.id];

export function maxConditionFor(id) {
  const d = ITEMS[id];
  if (!d) return 0;
  if (d.weapon) return d.weapon.durability || 100;
  if (d.armor) return d.armor.durability || 100;
  return 0;
}

export function createItem(id, opts = {}) {
  const d = ITEMS[id];
  if (!d) throw new Error('Unknown item: ' + id);
  const item = { uid: opts.uid || newUid(), id, qty: opts.qty || 1 };
  const maxCond = maxConditionFor(id);
  if (maxCond > 0) item.cond = opts.cond != null ? opts.cond : maxCond;
  if (d.weapon && d.weapon.kind === 'gun') {
    item.loaded = opts.loaded != null ? opts.loaded : 0;
    item.mods = Array.isArray(opts.mods) ? opts.mods.slice() : [];
  }
  if (d.weapon && d.weapon.kind === 'melee' && Array.isArray(opts.mods)) item.mods = opts.mods.slice();
  return item;
}

export function itemW(item) { return ITEMS[item.id].w || 1; }
export function itemH(item) { return ITEMS[item.id].h || 1; }
export function itemName(item) { return ITEMS[item.id].name; }

export function magSize(item) {
  const d = ITEMS[item.id];
  if (!d.weapon || d.weapon.kind !== 'gun') return 0;
  let m = d.weapon.mag;
  if (item.mods && item.mods.includes('extmag')) m = Math.ceil(m * 1.6);
  return m;
}

export function weaponStats(item) {
  const d = ITEMS[item.id];
  if (!d || !d.weapon) return null;
  const w = Object.assign({}, d.weapon);
  const condRatio = item.cond != null ? clamp(item.cond / (w.durability || 100), 0, 1) : 1;
  w.damage = Math.round(w.damage * (condRatio < 0.25 ? 0.55 : 1));
  if (item.mods) {
    if (item.mods.includes('suppressor')) w.noise = Math.round(w.noise * 0.35);
    if (item.mods.includes('scope')) { w.range = Math.round(w.range * 1.35); w.spread *= 0.65; }
    if (item.mods.includes('extmag')) w.mag = Math.ceil(w.mag * 1.6);
  }
  w.condRatio = condRatio;
  return w;
}

export function armorValue(item) {
  if (!item) return 0;
  const d = ITEMS[item.id];
  if (!d || !d.armor) return 0;
  const max = d.armor.durability || 1;
  const ratio = item.cond != null ? clamp(item.cond / max, 0, 1) : 1;
  return Math.round(d.armor.value * ratio * 10) / 10;
}

export function bagRows(item) {
  if (!item) return 0;
  const d = ITEMS[item.id];
  return d && d.bag ? d.bag.rows : 0;
}

export class Inventory {
  constructor(cols, rows, label = '') {
    this.cols = cols;
    this.rows = rows;
    this.label = label;
    this.items = [];
  }

  get size() { return this.cols * this.rows; }

  occupancy() {
    const grid = new Array(this.size).fill(null);
    for (const it of this.items) {
      for (let y = 0; y < itemH(it); y++) {
        for (let x = 0; x < itemW(it); x++) {
          const idx = (it.y + y) * this.cols + (it.x + x);
          if (idx >= 0 && idx < grid.length) grid[idx] = it;
        }
      }
    }
    return grid;
  }

  canPlace(item, x, y, ignoreUid = null) {
    const w = itemW(item), h = itemH(item);
    if (x < 0 || y < 0 || x + w > this.cols || y + h > this.rows) return false;
    for (const other of this.items) {
      if (other.uid === item.uid || (ignoreUid && other.uid === ignoreUid)) continue;
      if (x < other.x + itemW(other) && x + w > other.x && y < other.y + itemH(other) && y + h > other.y) return false;
    }
    return true;
  }

  findFree(item, ignoreUid = null) {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.canPlace(item, x, y, ignoreUid)) return { x, y };
      }
    }
    return null;
  }

  /** Add item, merging stacks when possible. Returns leftover quantity (0 = fully added). */
  add(item, x = null, y = null, merge = true) {
    const def = ITEMS[item.id];
    if (!def) return item.qty;
    if (def.stack > 1 && merge) {
      for (const other of this.items) {
        if (other.id !== item.id) continue;
        const space = def.stack - other.qty;
        if (space <= 0) continue;
        const move = Math.min(space, item.qty);
        other.qty += move;
        item.qty -= move;
        if (item.qty <= 0) return 0;
      }
    }
    let placeX = x, placeY = y;
    if (placeX == null || placeY == null) {
      const p = this.findFree(item);
      if (!p) return item.qty;
      placeX = p.x; placeY = p.y;
    } else if (!this.canPlace(item, placeX, placeY)) {
      const p = this.findFree(item);
      if (!p) return item.qty;
      placeX = p.x; placeY = p.y;
    }
    item.x = placeX; item.y = placeY;
    this.items.push(item);
    return 0;
  }

  addStack(id, qty) {
    const def = ITEMS[id];
    if (!def) return qty;
    let remaining = qty;
    while (remaining > 0) {
      const chunk = Math.min(remaining, def.stack);
      const item = createItem(id, { qty: chunk });
      const left = this.add(item);
      if (left === chunk) return remaining;
      remaining -= (chunk - left);
      if (left > 0) break;
    }
    return remaining;
  }

  findAt(x, y) {
    return this.items.find(it => x >= it.x && x < it.x + itemW(it) && y >= it.y && y < it.y + itemH(it)) || null;
  }

  find(uidVal) { return this.items.find(i => i.uid === uidVal) || null; }

  remove(uidVal) {
    const idx = this.items.findIndex(i => i.uid === uidVal);
    if (idx < 0) return null;
    const it = this.items[idx];
    this.items.splice(idx, 1);
    return it;
  }

  removeItem(item) { return this.remove(item.uid); }

  count(id) {
    let n = 0;
    for (const it of this.items) if (it.id === id) n += it.qty;
    return n;
  }

  countType(type) {
    let n = 0;
    for (const it of this.items) {
      const d = ITEMS[it.id];
      if (d && d.type === type) n += it.qty;
    }
    return n;
  }

  /** Consume quantity of item id. Returns number actually consumed. */
  consume(id, qty = 1) {
    let need = qty;
    for (let i = this.items.length - 1; i >= 0 && need > 0; i--) {
      const it = this.items[i];
      if (it.id !== id) continue;
      const take = Math.min(it.qty, need);
      it.qty -= take;
      need -= take;
      if (it.qty <= 0) this.items.splice(i, 1);
    }
    return qty - need;
  }

  consumeAll(map) {
    for (const id in map) {
      if (this.count(id) < map[id]) return false;
    }
    for (const id in map) this.consume(id, map[id]);
    return true;
  }

  hasAll(map) {
    for (const id in map) if (this.count(id) < map[id]) return false;
    return true;
  }

  totalItems() { return this.items.reduce((n, it) => n + 1, 0); }

  /** Resize inventory; returns true on success. Fails if items would fall outside. */
  resize(cols, rows) {
    for (const it of this.items) {
      if (it.x + itemW(it) > cols || it.y + itemH(it) > rows) return false;
    }
    this.cols = cols; this.rows = rows;
    return true;
  }

  itemsAboveRow(row) {
    return this.items.filter(it => it.y + itemH(it) > row);
  }

  toJSON() {
    return {
      cols: this.cols, rows: this.rows,
      items: this.items.map(it => Object.assign({}, it))
    };
  }

  static fromJSON(data, label = '') {
    const inv = new Inventory(data.cols, data.rows, label);
    if (data.items) {
      for (const raw of data.items) {
        if (!ITEMS[raw.id]) continue;
        const it = createItem(raw.id, { uid: raw.uid, qty: raw.qty, cond: raw.cond, loaded: raw.loaded, mods: raw.mods });
        it.x = raw.x; it.y = raw.y;
        inv.items.push(it);
      }
    }
    return inv;
  }
}

export const EQUIP_SLOTS = ['primary', 'melee', 'armor', 'backpack', 'utility'];

export class Equipment {
  constructor() {
    this.primary = null;
    this.melee = null;
    this.armor = null;
    this.backpack = null;
    this.utility = null;
  }

  get(slot) { return this[slot]; }
  set(slot, item) { this[slot] = item; }

  accepts(slot, item) {
    const d = ITEMS[item.id];
    if (!d) return false;
    if (slot === 'primary') return d.type === 'weapon' && d.slot === 'primary';
    if (slot === 'melee') return d.type === 'weapon' && d.slot === 'melee';
    if (slot === 'armor') return d.type === 'armor';
    if (slot === 'backpack') return d.type === 'backpack';
    if (slot === 'utility') return d.type === 'utility';
    return false;
  }

  slotFor(item) {
    const d = ITEMS[item.id];
    if (!d) return null;
    if (d.type === 'weapon') return d.slot === 'melee' ? 'melee' : 'primary';
    if (d.type === 'armor') return 'armor';
    if (d.type === 'backpack') return 'backpack';
    if (d.type === 'utility') return 'utility';
    return null;
  }

  all() {
    return EQUIP_SLOTS.map(slot => ({ slot, item: this[slot] })).filter(s => s.item);
  }

  armor() { return armorValue(this.armor); }
  bagRows() { return bagRows(this.backpack); }
  hasTool(tool) {
    for (const slot of EQUIP_SLOTS) {
      const it = this[slot];
      if (it && ITEMS[it.id].tool === tool) return true;
    }
    return false;
  }

  toJSON() {
    const o = {};
    for (const slot of EQUIP_SLOTS) {
      const it = this[slot];
      o[slot] = it ? Object.assign({}, it) : null;
    }
    return o;
  }

  static fromJSON(data) {
    const eq = new Equipment();
    if (!data) return eq;
    for (const slot of EQUIP_SLOTS) {
      const raw = data[slot];
      if (raw && ITEMS[raw.id]) {
        eq[slot] = createItem(raw.id, { uid: raw.uid, qty: raw.qty, cond: raw.cond, loaded: raw.loaded, mods: raw.mods });
      }
    }
    return eq;
  }
}

export function fieldRows(equipment) {
  return PLAYER_BASE.rows + equipment.bagRows();
}

export function makeFieldInventory(equipment, label = 'Field Kit') {
  return new Inventory(PLAYER_BASE.cols, PLAYER_BASE.rows + equipment.bagRows(), label);
}

/** Fill a magazine from inventory ammo. Returns rounds loaded. */
export function reloadWeaponFrom(item, inv) {
  const stats = weaponStats(item);
  if (!stats || stats.kind !== 'gun') return 0;
  const need = magSize(item) - (item.loaded || 0);
  if (need <= 0) return 0;
  const have = inv.count(stats.ammo);
  const take = Math.min(need, have);
  if (take <= 0) return 0;
  inv.consume(stats.ammo, take);
  item.loaded = (item.loaded || 0) + take;
  return take;
}
