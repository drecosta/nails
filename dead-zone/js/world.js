/* DEAD ZONE — procedural expedition maps */

import { LOOT, CORPSE_LOOT, CONTAINERS, ZONE_LOOT_BONUS, ZONES, ZOMBIE_TYPES, ITEMS } from './data.js';
import { Inventory, createItem, weaponStats, magSize } from './inventory.js';
import { mulberry32, randInt, randRange, pick, weightedPick, dist, clamp, hash2, shuffle } from './util.js';

export const TILE = 16;
export const MAP_SIZE = 96;
export const WORLD_PX = MAP_SIZE * TILE;

export const T = {
  GRASS: 0, DIRT: 1, ROAD: 2, ASPHALT: 3, WOOD_FLOOR: 4, CONCRETE: 5,
  WALL_WOOD: 6, WALL_CONCRETE: 7, WATER: 8, FENCE: 9, RUBBLE: 10,
  TILE_FLOOR: 11, PAVEMENT: 12, SAND: 13, DARK_GRASS: 14, DIRT_ROAD: 15
};

export const SOLID_TILES = new Set([T.WALL_WOOD, T.WALL_CONCRETE, T.WATER, T.FENCE]);

export const TILE_INFO = {
  [T.GRASS]: { name: 'grass', color: '#34402c' },
  [T.DIRT]: { name: 'dirt', color: '#4b4030' },
  [T.ROAD]: { name: 'road', color: '#35383a' },
  [T.ASPHALT]: { name: 'asphalt', color: '#3d4042' },
  [T.WOOD_FLOOR]: { name: 'wood floor', color: '#5b4935' },
  [T.CONCRETE]: { name: 'concrete', color: '#565a56' },
  [T.WALL_WOOD]: { name: 'wood wall', color: '#6b5136' },
  [T.WALL_CONCRETE]: { name: 'concrete wall', color: '#626762' },
  [T.WATER]: { name: 'water', color: '#263c42' },
  [T.FENCE]: { name: 'fence', color: '#5f6150' },
  [T.RUBBLE]: { name: 'rubble', color: '#4a4a43' },
  [T.TILE_FLOOR]: { name: 'tile', color: '#5a5c55' },
  [T.PAVEMENT]: { name: 'pavement', color: '#4c4e4a' },
  [T.SAND]: { name: 'sand', color: '#5d5540' },
  [T.DARK_GRASS]: { name: 'brush', color: '#29331f' },
  [T.DIRT_ROAD]: { name: 'dirt road', color: '#4d4433' }
};

const BUILDING_TYPES = {
  house: {
    w: [7, 10], h: [6, 8], wall: T.WALL_WOOD, floor: T.WOOD_FLOOR,
    containers: ['cabinet', 'fridge', 'crate', 'cabinet'], count: [2, 4], zombies: [1, 3]
  },
  shop: {
    w: [9, 12], h: [7, 9], wall: T.WALL_CONCRETE, floor: T.TILE_FLOOR,
    containers: ['fridge', 'cabinet', 'medbox', 'crate', 'toolbox'], count: [3, 5], zombies: [1, 3]
  },
  warehouse: {
    w: [12, 17], h: [9, 13], wall: T.WALL_CONCRETE, floor: T.CONCRETE,
    containers: ['warehouse', 'warehouse', 'locker', 'crate', 'toolbox'], count: [3, 6], zombies: [2, 4]
  },
  barracks: {
    w: [10, 14], h: [7, 10], wall: T.WALL_CONCRETE, floor: T.CONCRETE,
    containers: ['locker', 'locker', 'military', 'medbox', 'cabinet'], count: [3, 5], zombies: [2, 4]
  },
  shed: {
    w: [4, 6], h: [4, 5], wall: T.WALL_WOOD, floor: T.DIRT,
    containers: ['crate', 'toolbox', 'dumpster'], count: [1, 2], zombies: [0, 1]
  }
};

export class World {
  constructor(zoneId, seed) {
    this.zone = ZONES[zoneId] || ZONES.suburbs;
    this.zoneId = zoneId;
    this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed);
    this.cols = MAP_SIZE;
    this.rows = MAP_SIZE;
    this.tiles = new Uint8Array(this.cols * this.rows);
    this.protected = new Uint8Array(this.cols * this.rows);
    this.explored = new Uint8Array(this.cols * this.rows);
    this.buildings = [];
    this.containers = [];
    this.trees = [];
    this.rocks = [];
    this.extractions = [];
    this.zombieSpawns = [];
    this.decals = [];
    this.solidGrid = null;
    this.weather = this.rng() < (this.zone.difficulty >= 3 ? 0.7 : 0.4) ? 'rain' : 'clear';
    this.time = 0;
    this.lootSeedCounter = 0;
    this.generate();
  }

  idx(tx, ty) { return ty * this.cols + tx; }
  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.cols && ty < this.rows; }
  tileAt(tx, ty) {
    if (!this.inBounds(tx, ty)) return T.WATER;
    return this.tiles[ty * this.cols + tx];
  }
  setTile(tx, ty, t) {
    if (this.inBounds(tx, ty)) this.tiles[ty * this.cols + tx] = t;
  }
  tileAtWorld(x, y) { return this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE)); }
  isWallTile(tx, ty) { return SOLID_TILES.has(this.tileAt(tx, ty)); }

  generate() {
    const rng = this.rng;
    this.fillTerrain();
    this.carveRoads();
    if (this.zone.mapType === 'riverside') this.carveRiver();
    this.reserveExtractions();
    this.placeBuildings();
    this.placeVehicles();
    this.placeNature();
    this.placeLooseContainers();
    this.buildSolidGrid();
    this.pickSpawn();
    this.spawnZombies();
  }

  fillTerrain() {
    const rng = this.rng;
    let base = T.GRASS;
    if (this.zone.mapType === 'industrial') base = T.DIRT;
    if (this.zone.mapType === 'military') base = T.GRASS;
    this.tiles.fill(base);

    /* broad patches */
    for (let i = 0; i < 22; i++) {
      const cx = randInt(rng, 3, this.cols - 4), cy = randInt(rng, 3, this.rows - 4);
      const r = randInt(rng, 4, 11);
      const t = rng() < 0.55 ? T.DARK_GRASS : (this.zone.mapType === 'industrial' ? T.RUBBLE : T.DIRT);
      for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
          if (dist(x, y, cx, cy) < r * (0.7 + hash2(x, y, this.seed) * 0.4)) this.setTile(x, y, t);
        }
      }
    }
    if (this.zone.mapType === 'industrial') {
      for (let i = 0; i < 12; i++) {
        const cx = randInt(rng, 5, this.cols - 6), cy = randInt(rng, 5, this.rows - 6);
        const w = randInt(rng, 4, 11), h = randInt(rng, 3, 8);
        for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) this.setTile(x, y, T.PAVEMENT);
      }
    }
    if (this.zone.mapType === 'military') {
      for (let i = 0; i < 8; i++) {
        const cx = randInt(rng, 5, this.cols - 12), cy = randInt(rng, 5, this.rows - 10);
        const w = randInt(rng, 7, 14), h = randInt(rng, 5, 9);
        for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) this.setTile(x, y, T.PAVEMENT);
      }
    }
  }

  carveRoads() {
    const rng = this.rng;
    const roadsY = [18, 45, 72];
    const roadsX = [20, 47, 73];
    const width = 3;
    for (const ry of roadsY) {
      for (let x = 0; x < this.cols; x++) {
        for (let y = ry - width; y <= ry + width; y++) {
          this.setTile(x, y, Math.abs(y - ry) === width ? T.DIRT_ROAD : T.ROAD);
          this.protected[this.idx(x, y)] = 1;
        }
        this.setTile(x, ry - width - 1, T.PAVEMENT);
        this.setTile(x, ry + width + 1, T.PAVEMENT);
      }
    }
    for (const rx of roadsX) {
      for (let y = 0; y < this.rows; y++) {
        for (let x = rx - width; x <= rx + width; x++) {
          this.setTile(x, y, Math.abs(x - rx) === width ? T.DIRT_ROAD : T.ROAD);
          this.protected[this.idx(x, y)] = 1;
        }
        this.setTile(rx - width - 1, y, T.PAVEMENT);
        this.setTile(rx + width + 1, y, T.PAVEMENT);
      }
    }
    /* broken patches on roads */
    for (let i = 0; i < 80; i++) {
      const x = randInt(rng, 1, this.cols - 2), y = randInt(rng, 1, this.rows - 2);
      if (this.tileAt(x, y) === T.ROAD && rng() < 0.5) this.setTile(x, y, T.RUBBLE);
    }
  }

  carveRiver() {
    const baseX = 66;
    for (let y = 0; y < this.rows; y++) {
      const cx = Math.round(baseX + Math.sin(y * 0.11) * 5 + Math.sin(y * 0.031) * 7);
      for (let x = cx - 4; x <= cx + 4; x++) {
        if (this.tileAt(x, y) === T.ROAD || this.tileAt(x, y) === T.DIRT_ROAD) {
          /* bridges keep road passable */
          this.setTile(x, y, T.ASPHALT);
          this.protected[this.idx(x, y)] = 1;
        } else {
          this.setTile(x, y, T.WATER);
          this.protected[this.idx(x, y)] = 1;
        }
      }
    }
    /* banks */
    for (let y = 0; y < this.rows; y++) {
      const cx = Math.round(baseX + Math.sin(y * 0.11) * 5 + Math.sin(y * 0.031) * 7);
      for (const x of [cx - 6, cx - 5, cx + 5, cx + 6]) {
        if (this.tileAt(x, y) !== T.WATER && this.tileAt(x, y) !== T.ROAD && this.tileAt(x, y) !== T.DIRT_ROAD) this.setTile(x, y, T.SAND);
      }
    }
  }

  reserveExtractions() {
    const rng = this.rng;
    const candidates = shuffle(rng, [
      { x: 10, y: 10, name: 'Northwest Signal' },
      { x: 85, y: 11, name: 'North Ridge' },
      { x: 12, y: 85, name: 'South Marsh' },
      { x: 84, y: 84, name: 'Old Quarry' },
      { x: 48, y: 7, name: 'Highway Overpass' },
      { x: 8, y: 48, name: 'West Checkpoint' },
      { x: 87, y: 48, name: 'East Docks' },
      { x: 48, y: 88, name: 'South Bridge' }
    ]);
    const count = this.zone.extractCount || 2;
    const chosen = candidates.slice(0, count);
    for (const c of chosen) {
      const px = clamp(c.x, 6, this.cols - 7);
      const py = clamp(c.y, 6, this.rows - 7);
      this.extractions.push({
        x: px * TILE + TILE / 2, y: py * TILE + TILE / 2,
        r: 42, name: c.name, discovered: false, discoveredAt: 0
      });
      for (let y = py - 6; y <= py + 6; y++) {
        for (let x = px - 6; x <= px + 6; x++) {
          if (!this.inBounds(x, y)) continue;
          if (dist(x, y, px, py) < 6) {
            this.protected[this.idx(x, y)] = 1;
            if (this.tileAt(x, y) === T.WATER || this.isWallTile(x, y)) this.setTile(x, y, T.DIRT);
          }
        }
      }
      /* clear pad */
      for (let y = py - 3; y <= py + 3; y++) for (let x = px - 3; x <= px + 3; x++) {
        if (this.inBounds(x, y)) this.setTile(x, y, T.DIRT);
      }
    }
    /* spawn at an edge point away from extraction sites */
    const spawnCandidates = [
      { x: 48, y: 90 }, { x: 48, y: 6 }, { x: 6, y: 48 }, { x: 90, y: 48 },
      { x: 13, y: 47 }, { x: 82, y: 47 }, { x: 47, y: 13 }, { x: 47, y: 82 }
    ];
    let best = spawnCandidates[0], bestScore = -1;
    for (const s of spawnCandidates) {
      let minDist = 999;
      for (const e of this.extractions) minDist = Math.min(minDist, dist(s.x, s.y, e.x / TILE, e.y / TILE));
      if (minDist > bestScore) { bestScore = minDist; best = s; }
    }
    this.spawnTile = { x: clamp(best.x, 3, this.cols - 4), y: clamp(best.y, 3, this.rows - 4) };
  }

  canPlaceBuilding(x, y, w, h) {
    if (x < 1 || y < 1 || x + w >= this.cols - 1 || y + h >= this.rows - 1) return false;
    for (let yy = y - 1; yy <= y + h; yy++) {
      for (let xx = x - 1; xx <= x + w; xx++) {
        if (!this.inBounds(xx, yy)) return false;
        if (this.protected[this.idx(xx, yy)]) return false;
        const t = this.tileAt(xx, yy);
        if (t === T.WATER || t === T.ROAD || t === T.DIRT_ROAD) return false;
      }
    }
    return true;
  }

  placeBuildings() {
    const rng = this.rng;
    const sets = {
      suburbs: [['house', 14], ['shop', 2], ['warehouse', 1], ['shed', 4]],
      riverside: [['house', 10], ['shop', 3], ['warehouse', 2], ['shed', 3]],
      industrial: [['warehouse', 5], ['house', 5], ['shop', 2], ['shed', 3]],
      military: [['barracks', 6], ['warehouse', 2], ['house', 3], ['shop', 1], ['shed', 2]]
    };
    const list = sets[this.zone.mapType] || sets.suburbs;
    for (const [type, count] of list) {
      const info = BUILDING_TYPES[type];
      let placed = 0;
      for (let attempt = 0; attempt < 400 && placed < count; attempt++) {
        const w = randInt(rng, info.w[0], info.w[1]);
        const h = randInt(rng, info.h[0], info.h[1]);
        const x = randInt(rng, 2, this.cols - w - 3);
        const y = randInt(rng, 2, this.rows - h - 3);
        if (!this.canPlaceBuilding(x, y, w, h)) continue;
        this.addBuilding(x, y, w, h, type, info);
        placed++;
      }
    }
  }

  addBuilding(x, y, w, h, type, info) {
    const rng = this.rng;
    for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      if (this.inBounds(xx, yy)) this.protected[this.idx(xx, yy)] = 1;
    }
    this.buildings.push({ x, y, w, h, type });

    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const border = xx === x || yy === y || xx === x + w - 1 || yy === y + h - 1;
        this.setTile(xx, yy, border ? info.wall : info.floor);
      }
    }
    /* interior room divider for larger houses */
    if (type === 'house' && w >= 8 && h >= 6) {
      const dx = x + Math.floor(w / 2);
      const gapY = y + h - 2;
      for (let yy = y + 2; yy < y + h - 1; yy++) {
        if (yy !== gapY) this.setTile(dx, yy, info.wall);
      }
    }
    /* door */
    const side = randInt(rng, 0, 3);
    let dx, dy;
    if (side === 0) { dx = x + Math.floor(w / 2); dy = y + h - 1; }
    else if (side === 1) { dx = x + Math.floor(w / 2); dy = y; }
    else if (side === 2) { dx = x; dy = y + Math.floor(h / 2); }
    else { dx = x + w - 1; dy = y + Math.floor(h / 2); }
    this.setTile(dx, dy, info.floor);
    this.setTile(dx + (side === 3 ? -1 : side === 2 ? 1 : 0), dy + (side === 0 ? -1 : side === 1 ? 1 : 0), info.floor);
    this.setTile(dx + (side === 3 ? -2 : side === 2 ? 2 : 0), dy + (side === 0 ? -2 : side === 1 ? 2 : 0), info.floor);

    /* containers */
    const cCount = randInt(rng, info.count[0], info.count[1]);
    const spots = [];
    for (let yy = y + 1; yy < y + h - 1; yy++) {
      for (let xx = x + 1; xx < x + w - 1; xx++) {
        if (Math.abs(xx - dx) <= 1 && Math.abs(yy - dy) <= 1) continue;
        if (hash2(xx, yy, this.seed) > 0.88) spots.push({ x: xx, y: yy });
      }
    }
    const shuffled = shuffle(rng, spots);
    for (let i = 0; i < cCount && i < shuffled.length; i++) {
      const kind = pick(rng, info.containers);
      const p = shuffled[i];
      const cdef = CONTAINERS[kind];
      const cx = p.x * TILE + Math.floor((TILE - cdef.w) / 2);
      const cy = p.y * TILE + Math.floor((TILE - cdef.h) / 2);
      this.containers.push(this.makeContainer(kind, cx, cy, rng, {
        locked: kind === 'military' && rng() < 0.45,
        inside: true
      }));
    }

    /* zombie spawns */
    const zc = randInt(rng, info.zombies[0], info.zombies[1]);
    for (let i = 0; i < zc; i++) {
      const sx = randInt(rng, x + 1, x + w - 2);
      const sy = randInt(rng, y + 1, y + h - 2);
      this.zombieSpawns.push({ x: sx * TILE + TILE / 2, y: sy * TILE + TILE / 2, horde: false });
    }
    /* loiterers outside */
    for (let i = 0; i < randInt(rng, 1, 3); i++) {
      const ang = rng() * Math.PI * 2;
      const d = randInt(rng, 3, 8) * TILE;
      const sx = x * TILE + w * TILE / 2 + Math.cos(ang) * d;
      const sy = y * TILE + h * TILE / 2 + Math.sin(ang) * d;
      if (!this.isSolidPoint(sx, sy, 0)) this.zombieSpawns.push({ x: sx, y: sy, horde: false });
    }
  }

  placeVehicles() {
    const rng = this.rng;
    const count = randInt(rng, 6, 11);
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 120; attempt++) {
        const tx = randInt(rng, 3, this.cols - 4);
        const ty = randInt(rng, 3, this.rows - 4);
        const t = this.tileAt(tx, ty);
        if (t !== T.ROAD && t !== T.DIRT_ROAD && t !== T.PAVEMENT) continue;
        const cdef = CONTAINERS.car;
        const cx = tx * TILE + (rng() < 0.5 ? 0 : 10);
        const cy = ty * TILE - 6;
        let bad = false;
        for (const c of this.containers) {
          if (Math.abs(c.x - cx) < 40 && Math.abs(c.y - cy) < 40) { bad = true; break; }
        }
        if (bad) continue;
        this.containers.push(this.makeContainer('car', cx, cy, rng, { locked: false }));
        for (let yy = ty - 1; yy <= ty + 2; yy++) for (let xx = tx - 1; xx <= tx + 2; xx++) this.protected[this.idx(xx, yy)] = 1;
        break;
      }
    }
  }

  placeNature() {
    const rng = this.rng;
    const density = this.zone.mapType === 'industrial' || this.zone.mapType === 'military' ? 0.55 : 1;
    const treeAttempts = Math.floor(700 * density);
    for (let i = 0; i < treeAttempts; i++) {
      const tx = randInt(rng, 1, this.cols - 2), ty = randInt(rng, 1, this.rows - 2);
      if (this.protected[this.idx(tx, ty)]) continue;
      const t = this.tileAt(tx, ty);
      if (t === T.WATER || t === T.ROAD || t === T.DIRT_ROAD || this.isWallTile(tx, ty)) continue;
      if (this.trees.some(tr => Math.abs(tr.tx - tx) < 2 && Math.abs(tr.ty - ty) < 2)) continue;
      if (rng() > (this.zone.mapType === 'suburbs' ? 0.5 : 0.7)) continue;
      this.trees.push({
        type: 'tree', tx, ty, x: tx * TILE + 8, y: ty * TILE + 8,
        r: 7, hp: 3, solid: true, sway: rng() * Math.PI * 2, variant: Math.floor(rng() * 3)
      });
    }
    const rockAttempts = Math.floor(110 * density);
    for (let i = 0; i < rockAttempts; i++) {
      const tx = randInt(rng, 1, this.cols - 2), ty = randInt(rng, 1, this.rows - 2);
      if (this.protected[this.idx(tx, ty)]) continue;
      const t = this.tileAt(tx, ty);
      if (t === T.WATER || t === T.ROAD || this.isWallTile(tx, ty)) continue;
      if (this.rocks.some(r => Math.abs(r.tx - tx) < 2 && Math.abs(r.ty - ty) < 2)) continue;
      this.rocks.push({
        type: 'rock', tx, ty, x: tx * TILE + 8, y: ty * TILE + 8,
        r: 6, hp: 2, solid: true, variant: Math.floor(rng() * 3)
      });
    }
  }

  placeLooseContainers() {
    const rng = this.rng;
    const kinds = ['crate', 'dumpster', 'toolbox', 'medbox'];
    for (let i = 0; i < 20; i++) {
      for (let attempt = 0; attempt < 60; attempt++) {
        const tx = randInt(rng, 3, this.cols - 4), ty = randInt(rng, 3, this.rows - 4);
        if (this.protected[this.idx(tx, ty)]) continue;
        const t = this.tileAt(tx, ty);
        if (t === T.WATER || t === T.ROAD || this.isWallTile(tx, ty)) continue;
        if (this.containers.some(c => Math.abs(c.tx - tx) < 2 && Math.abs(c.ty - ty) < 2)) continue;
        const kind = pick(rng, kinds);
        const cdef = CONTAINERS[kind];
        this.containers.push(this.makeContainer(kind, tx * TILE + Math.floor((TILE - cdef.w) / 2), ty * TILE + Math.floor((TILE - cdef.h) / 2), rng, {}));
        break;
      }
    }
  }

  makeContainer(kind, x, y, rng, opts = {}) {
    const cdef = CONTAINERS[kind];
    const c = {
      type: 'container', kind, x, y, w: cdef.w, h: cdef.h,
      tx: Math.floor((x + cdef.w / 2) / TILE), ty: Math.floor((y + cdef.h / 2) / TILE),
      locked: !!opts.locked, opened: false, searched: false, inside: !!opts.inside,
      inv: null, custom: opts.custom || null, searchTime: cdef.search || 1.2,
      id: 'c' + (this.containers.length + 1)
    };
    return c;
  }

  getContainerInventory(c) {
    if (c.inv) return c.inv;
    if (c.custom) {
      const inv = new Inventory(6, 4, CONTAINERS[c.kind].name);
      for (const entry of c.custom) {
        const item = createItem(entry.id, { qty: entry.qty || 1, cond: entry.cond, loaded: entry.loaded });
        inv.add(item);
      }
      c.inv = inv;
      return inv;
    }
    const def = CONTAINERS[c.kind];
    const table = LOOT[def.table] || LOOT.crate;
    const bonus = ZONE_LOOT_BONUS[this.zoneId];
    const inv = new Inventory(c.kind === 'car' ? 6 : 5, 4, def.name);
    const rng = mulberry32((this.seed ^ (++this.lootSeedCounter * 2654435761)) >>> 0);
    let rolls = 2 + randInt(rng, 0, 2) + Math.min(2, this.zone.difficulty - 1);
    if (c.kind === 'warehouse' || c.kind === 'military') rolls += 1;
    for (let i = 0; i < rolls; i++) {
      let entry;
      if (bonus && rng() < bonus.chance) entry = weightedPick(rng, bonus.table);
      else entry = weightedPick(rng, table);
      if (!entry) continue;
      const [id, , minQ, maxQ] = entry;
      if (!ITEMS[id]) continue;
      let qty = randInt(rng, minQ, maxQ);
      const idef = ITEMS[id];
      if (idef.stack > 1) qty = Math.min(qty, idef.stack);
      const opts = {};
      if (idef.weapon) {
        opts.cond = Math.round((idef.weapon.durability || 100) * randRange(rng, 0.3, 1));
        if (idef.weapon.kind === 'gun') {
          const tmp = createItem(id, opts);
          opts.loaded = Math.floor(magSize(tmp) * randRange(rng, 0, 0.7));
        }
      }
      if (idef.armor) opts.cond = Math.round(idef.armor.durability * randRange(rng, 0.3, 1));
      const item = createItem(id, Object.assign({ qty }, opts));
      const left = inv.add(item);
      if (left > 0) { /* discard overflow */ }
    }
    c.inv = inv;
    return inv;
  }

  spawnLootBag(x, y, entries) {
    const c = this.makeContainer('corpse', x - 6, y - 4, this.rng, { custom: entries });
    c.solid = false;
    this.containers.push(c);
    return c;
  }

  buildSolidGrid() {
    const cell = TILE * 3;
    const gw = Math.ceil(WORLD_PX / cell) + 1;
    const grid = new Array(gw * gw);
    for (let i = 0; i < grid.length; i++) grid[i] = [];
    const addBox = (obj) => {
      const x0 = Math.floor(obj.x / cell), x1 = Math.floor((obj.x + (obj.w || 14)) / cell);
      const y0 = Math.floor(obj.y / cell), y1 = Math.floor((obj.y + (obj.h || 14)) / cell);
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        if (gx >= 0 && gy >= 0 && gx < gw && gy < gw) grid[gy * gw + gx].push(obj);
      }
    };
    for (const c of this.containers) if (c.solid !== false) addBox(c);
    for (const t of this.trees) if (t.solid) addBox({ x: t.x - 5, y: t.y - 5, w: 10, h: 10, ref: t });
    for (const r of this.rocks) if (r.solid) addBox({ x: r.x - 5, y: r.y - 5, w: 10, h: 10, ref: r });
    this.solidGrid = { cell, gw, grid };
  }

  getSolidsNear(x, y, r = 16) {
    if (!this.solidGrid) return [];
    const { cell, gw, grid } = this.solidGrid;
    const x0 = Math.floor((x - r) / cell), x1 = Math.floor((x + r) / cell);
    const y0 = Math.floor((y - r) / cell), y1 = Math.floor((y + r) / cell);
    const out = [];
    const seen = new Set();
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      if (gx < 0 || gy < 0 || gx >= gw || gy >= gw) continue;
      for (const o of grid[gy * gw + gx]) {
        const key = o.ref || o;
        if (seen.has(key)) continue;
        seen.add(key); out.push(o);
      }
    }
    return out;
  }

  isSolidPoint(x, y, r = 2) {
    if (x < 0 || y < 0 || x >= WORLD_PX || y >= WORLD_PX) return true;
    const pts = [[x, y], [x - r, y], [x + r, y], [x, y - r], [x, y + r]];
    for (const [px, py] of pts) {
      if (this.isWallTile(Math.floor(px / TILE), Math.floor(py / TILE))) return true;
    }
    const solids = this.getSolidsNear(x, y, r + 10);
    for (const s of solids) {
      const ref = s.ref;
      if (ref && (ref.solid === false || ref.depleted)) continue;
      const rx = s.x, ry = s.y, rw = s.w || 10, rh = s.h || 10;
      const nx = clamp(x, rx, rx + rw), ny = clamp(y, ry, ry + rh);
      if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
    }
    return false;
  }

  canMove(x, y, r = 5) {
    if (x - r < 0 || y - r < 0 || x + r >= WORLD_PX || y + r >= WORLD_PX) return false;
    const pts = [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]];
    for (const [ox, oy] of pts) {
      if (this.isWallTile(Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE))) return false;
    }
    const solids = this.getSolidsNear(x, y, r + 16);
    for (const s of solids) {
      const ref = s.ref;
      if (ref && (ref.solid === false || ref.depleted)) continue;
      const rx = s.x, ry = s.y, rw = s.w || 10, rh = s.h || 10;
      const nx = clamp(x, rx, rx + rw), ny = clamp(y, ry, ry + rh);
      if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return false;
    }
    return true;
  }

  lineBlocked(x1, y1, x2, y2) {
    const d = dist(x1, y1, x2, y2);
    const steps = Math.ceil(d / 8);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      if (this.isWallTile(Math.floor(x / TILE), Math.floor(y / TILE))) return true;
    }
    return false;
  }

  hasLOS(x1, y1, x2, y2) { return !this.lineBlocked(x1, y1, x2, y2); }

  /** Raycast against walls and solids. Returns distance to first hit and target. */
  raycast(x1, y1, x2, y2) {
    const d = dist(x1, y1, x2, y2);
    const steps = Math.max(1, Math.ceil(d / 4));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      if (this.isWallTile(Math.floor(x / TILE), Math.floor(y / TILE))) return { hit: true, x, y, d: d * t, wall: true };
      for (const s of this.getSolidsNear(x, y, 6)) {
        const ref = s.ref;
        if (ref && (ref.solid === false || ref.depleted)) continue;
        const rx = s.x, ry = s.y, rw = s.w || 10, rh = s.h || 10;
        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
          if (ref && (ref.type === 'tree' || ref.type === 'rock')) return { hit: true, x, y, d: d * t, wall: true };
          return { hit: true, x, y, d: d * t, wall: true };
        }
      }
    }
    return { hit: false, x: x2, y: y2, d };
  }

  pickSpawn() {
    const st = this.spawnTile;
    let sx = st.x * TILE + 8, sy = st.y * TILE + 8;
    for (let i = 0; i < 40; i++) {
      if (this.canMove(sx, sy, 6)) break;
      sx = (st.x + randInt(this.rng, -3, 3)) * TILE + 8;
      sy = (st.y + randInt(this.rng, -3, 3)) * TILE + 8;
    }
    this.spawn = { x: sx, y: sy };
  }

  spawnZombies() {
    const rng = this.rng;
    const total = this.zone.zombies;
    const hordeCount = this.zone.hordes;
    const weights = {
      suburbs: [['walker', 78], ['runner', 12], ['crawler', 10]],
      riverside: [['walker', 60], ['runner', 27], ['crawler', 13]],
      industrial: [['walker', 49], ['runner', 22], ['brute', 17], ['crawler', 12]],
      military: [['walker', 36], ['runner', 27], ['brute', 22], ['crawler', 15]]
    }[this.zone.mapType] || [['walker', 80], ['runner', 15], ['crawler', 5]];

    const hordeCenters = [];
    for (let i = 0; i < hordeCount; i++) {
      const spawn = pick(rng, this.zombieSpawns);
      if (!spawn) break;
      hordeCenters.push({ x: spawn.x, y: spawn.y });
      const radius = randInt(rng, 2, 5) * TILE;
      const n = randInt(rng, 5, 12);
      for (let j = 0; j < n; j++) {
        const ang = rng() * Math.PI * 2, d = randRange(rng, 0, radius);
        const x = spawn.x + Math.cos(ang) * d, y = spawn.y + Math.sin(ang) * d;
        if (!this.canMove(x, y, 6)) continue;
        const type = weightedPick(rng, weights)[0];
        this.zombieSpawns.push({ x, y, horde: true, type });
      }
    }
    /* fill remaining across map near POIs */
    let guard = 0;
    while (this.zombieSpawns.length < total && guard < total * 6) {
      guard++;
      const base = pick(rng, this.zombieSpawns);
      if (!base) break;
      const x = base.x + randRange(rng, -5, 5) * TILE;
      const y = base.y + randRange(rng, -5, 5) * TILE;
      if (!this.canMove(x, y, 6)) continue;
      this.zombieSpawns.push({ x, y, horde: false, type: weightedPick(rng, weights)[0] });
    }
    this.hordeCenters = hordeCenters;
  }

  markExplored(x, y, radius = 9) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    for (let yy = ty - radius; yy <= ty + radius; yy++) {
      for (let xx = tx - radius; xx <= tx + radius; xx++) {
        if (!this.inBounds(xx, yy)) continue;
        if (dist(xx, yy, tx, ty) <= radius) this.explored[this.idx(xx, yy)] = 1;
      }
    }
    /* discover extraction */
    for (const e of this.extractions) {
      if (e.discovered) continue;
      if (dist(x, y, e.x, e.y) < 190) {
        e.discovered = true;
        e.discoveredAt = this.time;
      }
    }
  }

  isExplored(tx, ty) { return this.inBounds(tx, ty) && this.explored[this.idx(tx, ty)] === 1; }

  nearestContainer(x, y, maxDist = 26) {
    let best = null, bd = maxDist;
    for (const c of this.containers) {
      const d = dist(x, y, c.x + c.w / 2, c.y + c.h / 2);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  nearestResource(x, y, maxDist = 32) {
    let best = null, bd = maxDist;
    for (const t of this.trees) {
      if (t.depleted) continue;
      const d = dist(x, y, t.x, t.y);
      if (d < bd) { bd = d; best = t; }
    }
    for (const r of this.rocks) {
      if (r.depleted) continue;
      const d = dist(x, y, r.x, r.y);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  nearestExtraction(x, y) {
    let best = null, bd = Infinity;
    for (const e of this.extractions) {
      const d = dist(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return { extraction: best, distance: bd };
  }

  addDecal(x, y, type = 'blood', size = 6) {
    this.decals.push({ x, y, type, size, t: 0, rot: this.rng() * 6.28 });
    if (this.decals.length > 180) this.decals.shift();
  }
}
