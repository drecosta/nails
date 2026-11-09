/* DEAD ZONE — expedition gameplay */

import {
  ITEMS, ZONES, ZOMBIE_TYPES, PLAYER_BASE, CORPSE_LOOT
} from './data.js';
import { World, TILE, TILE_INFO, T, WORLD_PX } from './world.js';
import {
  Inventory, createItem, weaponStats, magSize, armorValue, fieldRows,
  reloadWeaponFrom, defOf
} from './inventory.js';
import { maxHealth, maxStamina } from './save.js';
import { drawPlayer, drawZombie, drawTree, drawRock, drawContainer, drawExtraction, shade } from './sprites.js';
import { FirstPersonRenderer } from './firstperson.js';
import {
  clamp, dist, angleTo, normAngle, randInt, randRange, pick, weightedPick,
  mulberry32, hash2, fmtTime, segmentRect
} from './util.js';
import { audio } from './audio.js';

const HIT = 0.5;

export class Game {
  constructor(canvas, save, zoneId, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.save = save;
    this.zone = ZONES[zoneId];
    this.zoneId = zoneId;
    this.callbacks = callbacks || {};
    this.seed = (save.seedBase = (save.seedBase || 1) + 1) * 7919 + Math.floor(Math.random() * 100000);
    this.world = new World(zoneId, this.seed);
    this.rng = mulberry32(this.seed ^ 0x9e3779b9);

    this.inv = save.field;
    this.equipment = save.equipment;
    if (this.inv.rows !== fieldRows(this.equipment)) {
      this.inv.resize(PLAYER_BASE.cols, fieldRows(this.equipment));
    }

    this.player = {
      x: this.world.spawn.x, y: this.world.spawn.y, r: 5,
      health: maxHealth(save), maxHealth: maxHealth(save),
      stamina: maxStamina(save), maxStamina: maxStamina(save),
      hunger: 88, thirst: 88, bleed: 0, infection: 0,
      walkPhase: 0, moving: false, running: false, crouching: false,
      facingX: 0, facingY: 1, aimAngle: Math.PI / 2,
      mode: 'primary', attackCd: 0, attackAnim: 0, muzzle: 0,
      invuln: 0, dead: false, hurtFlash: 0,
      shirt: '#3f4d3e', pants: '#2f3540', hair: '#352b22',
      weapon: this.equipment.primary || this.equipment.melee || null,
      backpack: !!this.equipment.backpack,
      armorSprite: this.equipment.armor ? (ITEMS[this.equipment.armor.id].icon === 'vest' ? '#4f6351' : '#5d4132') : null
    };
    if (!this.equipment.primary) this.player.mode = 'melee';

    this.zombies = [];
    this.spawnInitialZombies();
    this.particles = [];
    this.tracers = [];
    this.floaters = [];
    this.lightFlashes = [];

    this.camera = { x: this.player.x, y: this.player.y, shake: 0 };
    this.mouse = { x: 0, y: 0, active: false, down: false, lastMove: -99 };
    this.moveInput = { x: 0, y: 0 };
    this.touchRun = false;
    this.touchAttack = false;
    this.keys = Object.create(null);
    this.raidTime = this.zone.raidTime;
    this.raidMax = this.zone.raidTime;
    this.overrun = false;
    this.overrunTimer = 0;
    this.warned60 = false;
    this.time = 0;
    this.frame = 0;
    this.paused = false;
    this.ended = false;
    this.stats = { kills: 0, xp: 0, shots: 0, looted: 0 };
    this.action = null;
    this.extractionState = null;
    this.interactTarget = null;
    this.searchStart = null;
    this.reloadState = null;
    this.hudAccum = 0;
    this.promptAccum = 0;
    this.lastPromptText = '';
    this.deathCause = '';
    this.hitMarker = 0;
    this.hitMarkerKill = false;
    this.lastHurtAngle = 0;
    this.lastHurtTimer = 0;
    this.minimap = document.getElementById('minimap');
    this.minimapCtx = this.minimap ? this.minimap.getContext('2d') : null;
    this.usingTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (this.usingTouch) this.player.crouching = false;

    /* first-person view */
    this.viewMode = this.save.settings && this.save.settings.view === 'fp' ? 'fp' : 'iso';
    this.fpYaw = this.player.aimAngle;
    this.fpPitch = 0;
    this.fpSensitivity = 0.0022;
    this.fpTouchSensitivity = 0.0052;
    this.lookPointer = null;
    this.lookLastX = 0;
    this.lookLastY = 0;
    if (this.viewMode === 'fp') this.player.aimAngle = this.fpYaw;
    this.firstPerson = new FirstPersonRenderer(this);

    /* gear-derived flags */
    this.radio = this.equipment.utility && ITEMS[this.equipment.utility.id].tool === 'radio';
    this.flashlight = this.equipment.utility && ITEMS[this.equipment.utility.id].tool === 'flashlight';
    this.tower = save.camp.buildings.tower > 0;
    this.gasmask = this.equipment.utility && ITEMS[this.equipment.utility.id].tool === 'gasmask';

    if (this.radio || this.tower) {
      for (const e of this.world.extractions) e.discovered = true;
      this.toast('Extraction beacons decoded on your map.', 'good');
    }
    this.world.markExplored(this.player.x, this.player.y, 10);

    this._onKeyDown = (e) => this.onKeyDown(e);
    this._onKeyUp = (e) => this.onKeyUp(e);
    this._onMouseDown = (e) => this.onMouseDown(e);
    this._onMouseUp = (e) => this.onMouseUp(e);
    this._onMouseMove = (e) => this.onMouseMove(e);
    this._onPointerDown = (e) => this.onPointerDown(e);
    this._onPointerMove = (e) => this.onPointerMove(e);
    this._onPointerUp = (e) => this.onPointerUp(e);
    this._onResize = () => this.resize();
    this._onContext = (e) => e.preventDefault();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('pointercancel', this._onPointerUp);
    window.addEventListener('resize', this._onResize);
    this.canvas.addEventListener('contextmenu', this._onContext);
    this.resize();
    this.lastTime = performance.now();
    this._loop = (now) => this.loop(now);
    this.raf = requestAnimationFrame(this._loop);

    if (this.zone.mapType === 'industrial' && !this.gasmask) {
      this.toast('Toxic air here. A gas mask would help.', 'warn');
    }
    this.toast('Insertion complete. Find an extraction beacon.', 'info');
    this.updateHud(true);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('pointercancel', this._onPointerUp);
    window.removeEventListener('resize', this._onResize);
    this.canvas.removeEventListener('contextmenu', this._onContext);
    this.releaseLookLock();
  }

  toast(text, tone = 'info') { if (this.callbacks.toast) this.callbacks.toast(text, tone); }
  setPaused(v) {
    this.paused = v;
    if (v) this.releaseLookLock();
    if (!v) this.lastTime = performance.now();
  }
  isPaused() { return this.paused; }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(280, rect.width || window.innerWidth);
    const cssH = Math.max(220, rect.height || window.innerHeight);
    const scale = Math.max(1, Math.ceil(cssW / 760));
    this.canvas.width = Math.max(280, Math.floor(cssW / scale));
    this.canvas.height = Math.max(220, Math.floor(cssH / scale));
    this.renderScale = scale;
    this.viewW = this.canvas.width;
    this.viewH = this.canvas.height;
    this.ctx.imageSmoothingEnabled = false;
  }

  spawnInitialZombies() {
    const weights = this.zombieWeights();
    for (const sp of this.world.zombieSpawns) {
      const type = sp.type || weightedPick(this.rng, weights)[0];
      this.spawnZombie(sp.x, sp.y, type, false);
    }
  }

  zombieWeights() {
    const diff = this.zone.difficulty;
    const base = [['walker', 80 - diff * 10], ['runner', 8 + diff * 5], ['crawler', 12], ['brute', Math.max(0, diff - 1) * 6]];
    return base.filter(e => e[1] > 0);
  }

  spawnZombie(x, y, type, alerted) {
    const def = ZOMBIE_TYPES[type] || ZOMBIE_TYPES.walker;
    const hpScale = 1 + (this.zone.difficulty - 1) * 0.12;
    const z = {
      id: this.zombies.length + 1, type, x, y, r: def.radius,
      hp: Math.round(def.health * hpScale), maxHp: Math.round(def.health * hpScale),
      homeX: x, homeY: y, state: alerted ? 'chase' : 'idle',
      stateTimer: randRange(this.rng, 0.5, 3), targetX: x, targetY: y,
      aimAngle: 0, moving: false, walkPhase: this.rng() * 6,
      attackCd: 0, attackWindup: 0, attackWindupMax: 0, attackAnim: 0,
      hitFlash: 0, stagger: 0, chase: !!alerted, dead: false,
      lostTimer: 0, searchTimer: 0, variant: Math.floor(this.rng() * 3),
      lastSeenX: x, lastSeenY: y, alertFlash: 0,
      avoidDir: 0, avoidTimer: 0, stuckTimer: 0,
      speed: def.speed, alerted: !!alerted
    };
    if (z.chase) z.targetX = this.player.x, z.targetY = this.player.y;
    this.zombies.push(z);
    return z;
  }

  onKeyDown(e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const code = e.code;
    if (['Tab', 'KeyM', 'KeyE', 'KeyR', 'KeyF', 'KeyG', 'KeyH', 'KeyV', 'Space', 'Escape', 'Digit1', 'Digit2', 'KeyC', 'ShiftLeft', 'ShiftRight'].includes(code)) e.preventDefault();
    if (this.paused || this.ended) return;
    if (code === 'Escape') { if (this.callbacks.pause) this.callbacks.pause(); return; }
    if (code === 'Tab') { if (this.callbacks.inventory) this.callbacks.inventory(); return; }
    if (code === 'KeyM') { if (this.callbacks.map) this.callbacks.map(); return; }
    if (this.keys[code]) return;
    this.keys[code] = true;
    if (code === 'KeyE') this.interact();
    else if (code === 'KeyR') this.startReload();
    else if (code === 'KeyF') this.quickHeal();
    else if (code === 'KeyG') this.quickEat();
    else if (code === 'KeyH') this.quickDrink();
    else if (code === 'Digit1') this.switchWeapon('primary');
    else if (code === 'Digit2') this.switchWeapon('melee');
    else if (code === 'KeyC') this.toggleCrouch();
    else if (code === 'KeyV') this.toggleViewMode();
    else if (code === 'Space') this.tryAttack();
  }
  onKeyUp(e) { this.keys[e.code] = false; }

  onMouseDown(e) {
    if (this.paused || this.ended) return;
    if (e.button !== 0) return;
    if (this.viewMode === 'fp') {
      this.mouse.down = true;
      this.requestLookLock();
      this.tryAttack();
      return;
    }
    this.mouse.down = true;
    this.mouse.active = true;
    this.mouse.lastMove = this.time;
    this.updateMouse(e);
    this.tryAttack();
  }
  onMouseUp(e) { if (e.button === 0) this.mouse.down = false; }
  onMouseMove(e) {
    if (this.paused || this.ended) return;
    if (e.pointerType === 'touch') return;
    if (this.viewMode === 'fp') {
      if (document.pointerLockElement === this.canvas || this.mouse.down) {
        this.lookBy(e.movementX || 0, e.movementY || 0, this.fpSensitivity);
      }
      return;
    }
    this.mouse.active = true;
    this.mouse.lastMove = this.time;
    this.updateMouse(e);
  }

  onPointerDown(e) {
    if (e.pointerType !== 'touch' || this.viewMode !== 'fp' || this.paused || this.ended) return;
    e.preventDefault();
    this.lookPointer = e.pointerId;
    this.lookLastX = e.clientX;
    this.lookLastY = e.clientY;
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  }
  onPointerMove(e) {
    if (e.pointerType !== 'touch' || this.viewMode !== 'fp' || e.pointerId !== this.lookPointer) return;
    e.preventDefault();
    const dx = e.clientX - this.lookLastX;
    const dy = e.clientY - this.lookLastY;
    this.lookLastX = e.clientX;
    this.lookLastY = e.clientY;
    this.lookBy(dx, dy, this.fpTouchSensitivity);
  }
  onPointerUp(e) {
    if (e.pointerType !== 'touch' || e.pointerId !== this.lookPointer) return;
    this.lookPointer = null;
  }

  lookBy(dx, dy, sensitivity) {
    if (!dx && !dy) return;
    this.fpYaw = normAngle(this.fpYaw + dx * sensitivity);
    this.fpPitch = clamp(this.fpPitch - dy * sensitivity * 0.85, -0.62, 0.62);
    this.player.aimAngle = this.fpYaw;
  }

  requestLookLock() {
    if (this.usingTouch || this.viewMode !== 'fp') return;
    if (document.pointerLockElement === this.canvas) return;
    if (!this.canvas.requestPointerLock) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (err) { /* noop */ }
  }
  releaseLookLock() {
    if (document.exitPointerLock && document.pointerLockElement === this.canvas) {
      try { document.exitPointerLock(); } catch (err) { /* noop */ }
    }
    this.lookPointer = null;
  }

  setViewMode(mode, announce = true) {
    const next = mode === 'fp' ? 'fp' : 'iso';
    if (next === this.viewMode) return;
    if (next === 'fp') {
      this.fpYaw = this.player.aimAngle;
      this.fpPitch = 0;
      this.mouse.active = false;
      this.mouse.down = false;
      this.player.aimAngle = this.fpYaw;
    } else {
      this.releaseLookLock();
      this.player.aimAngle = this.fpYaw;
      this.mouse.active = false;
      this.mouse.down = false;
    }
    this.viewMode = next;
    if (this.save.settings) this.save.settings.view = next;
    if (this.callbacks.view) this.callbacks.view(next);
    if (announce) this.toast(next === 'fp' ? 'First-person view.' : 'Isometric view.', 'info');
    this.updateHud(true);
  }
  toggleViewMode() {
    this.setViewMode(this.viewMode === 'fp' ? 'iso' : 'fp');
  }

  updateMouse(e) {
    const r = this.canvas.getBoundingClientRect();
    const sx = (e.clientX - r.left) * (this.canvas.width / r.width);
    const sy = (e.clientY - r.top) * (this.canvas.height / r.height);
    this.mouse.x = this.camera.x + sx - this.viewW / 2;
    this.mouse.y = this.camera.y + sy - this.viewH / 2;
  }

  setMoveInput(x, y) { this.moveInput.x = x; this.moveInput.y = y; }
  setTouchRun(v) { this.touchRun = v; }
  setTouchAttack(v) { this.touchAttack = v; if (v) this.tryAttack(); if (v) this.mouse.down = true; else this.mouse.down = false; }
  touchInteract() { this.interact(); }
  toggleCrouch() {
    this.player.crouching = !this.player.crouching;
    this.toast(this.player.crouching ? 'Crouching — harder to spot.' : 'Standing.', 'info');
    this.updateHud(true);
  }

  currentWeapon() {
    return this.player.mode === 'melee' ? this.equipment.melee : this.equipment.primary;
  }
  switchWeapon(mode) {
    if (mode === 'primary' && !this.equipment.primary) { this.toast('No firearm equipped.', 'warn'); return; }
    if (mode === 'melee' && !this.equipment.melee) { this.toast('No melee weapon equipped.', 'warn'); return; }
    this.player.mode = mode;
    this.player.weapon = this.currentWeapon();
    this.reloadState = null;
    this.updateHud(true);
  }
  refreshGear() {
    if (this.player.mode === 'primary' && !this.equipment.primary) this.player.mode = this.equipment.melee ? 'melee' : 'primary';
    if (this.player.mode === 'melee' && !this.equipment.melee && this.equipment.primary) this.player.mode = 'primary';
    this.player.weapon = this.currentWeapon();
    this.player.backpack = !!this.equipment.backpack;
    this.player.armorSprite = this.equipment.armor ? (ITEMS[this.equipment.armor.id].icon === 'vest' ? '#4f6351' : '#5d4132') : null;
    this.radio = this.equipment.utility && ITEMS[this.equipment.utility.id].tool === 'radio';
    this.flashlight = this.equipment.utility && ITEMS[this.equipment.utility.id].tool === 'flashlight';
    this.gasmask = this.equipment.utility && ITEMS[this.equipment.utility.id].tool === 'gasmask';
    this.updateHud(true);
  }

  tryAttack() {
    if (this.paused || this.ended) return;
    const p = this.player;
    if (p.attackCd > 0 || this.reloadState) return;
    const weapon = this.currentWeapon();
    if (!weapon) {
      if (p.mode === 'primary' && this.equipment.melee) { this.switchWeapon('melee'); return; }
      this.toast('You have no weapon. Run.', 'warn');
      return;
    }
    const stats = weaponStats(weapon);
    if (!stats) return;
    if (stats.kind === 'gun') this.fireGun(weapon, stats);
    else this.meleeAttack(weapon, stats);
  }

  fireGun(weapon, stats) {
    const p = this.player;
    if (weapon.cond <= 0) { this.toast('Weapon is broken. Repair it at camp.', 'warn'); return; }
    if ((weapon.loaded || 0) <= 0) {
      this.toast('Empty magazine — press R to reload.', 'warn');
      return;
    }
    p.attackCd = stats.cooldown;
    p.attackAnim = 0.12;
    p.muzzle = 0.07;
    p.stamina = Math.max(0, p.stamina - stats.stamina);
    weapon.loaded--;
    weapon.cond = Math.max(0, weapon.cond - (0.2 + this.rng() * 0.35));
    const noise = stats.noise;
    this.makeNoise(p.x, p.y, noise, true);
    audio.shoot(weapon.id === 'shotgun' ? 'shotgun' : (stats.damage > 60 ? 'rifle' : 'gun'));
    if (this.save.settings.shake) this.camera.shake = Math.min(5, this.camera.shake + 1.6);
    const baseAngle = p.aimAngle;
    const muzzleX = p.x + Math.cos(baseAngle) * 9;
    const muzzleY = p.y - 7 + Math.sin(baseAngle) * 9;
    for (let i = 0; i < (stats.pellets || 1); i++) {
      const spread = (this.rng() - 0.5) * stats.spread * 2;
      const a = baseAngle + spread;
      this.traceBullet(muzzleX, muzzleY, a, stats, i === 0);
    }
    this.spawnParticles(muzzleX, muzzleY, 5, '#ffd870', 50, 0.18);
    this.spawnParticles(p.x, p.y - 6, 1, '#d8c278', 20, 0.6, 'shell');
    this.stats.shots++;
    this.updateHud(true);
  }

  traceBullet(x, y, angle, stats, primary) {
    const maxD = stats.range;
    const ex = x + Math.cos(angle) * maxD;
    const ey = y + Math.sin(angle) * maxD;
    const wall = this.world.raycast(x, y, ex, ey);
    let hitD = wall.hit ? wall.d : maxD;
    let target = null;
    let targetT = hitD;
    for (const z of this.zombies) {
      if (z.dead) continue;
      const t = this.rayCircle(x, y, Math.cos(angle), Math.sin(angle), z.x, z.y - 5, z.r + 2);
      if (t != null && t > 0 && t < hitD && t < targetT) {
        targetT = t; target = z;
      }
    }
    let endX, endY;
    if (target) {
      endX = x + Math.cos(angle) * targetT;
      endY = y + Math.sin(angle) * targetT;
      const crit = this.rng() < (stats.spread < 0.02 ? 0.28 : 0.12);
      const dmg = Math.round(stats.damage * (crit ? 1.7 : 1) * randRange(this.rng, 0.88, 1.12));
      this.damageZombie(target, dmg, angle, crit, stats.knockback || 6);
      this.spawnParticles(endX, endY, 6, '#7d2d2a', 55, 0.4);
    } else {
      endX = x + Math.cos(angle) * hitD;
      endY = y + Math.sin(angle) * hitD;
      if (wall.hit) this.spawnParticles(endX, endY, 4, '#9b947c', 35, 0.35, 'dust');
    }
    if (primary) this.tracers.push({ x1: x, y1: y, x2: endX, y2: endY, life: 0.08, maxLife: 0.08 });
  }

  rayCircle(x, y, dx, dy, cx, cy, cr) {
    const ox = cx - x, oy = cy - y;
    const t = ox * dx + oy * dy;
    if (t < 0) return null;
    const px = x + dx * t, py = y + dy * t;
    const d2 = (px - cx) ** 2 + (py - cy) ** 2;
    if (d2 > cr * cr) return null;
    return t - Math.sqrt(cr * cr - d2);
  }

  meleeAttack(weapon, stats) {
    const p = this.player;
    p.attackCd = stats.cooldown;
    p.attackAnim = 0.22;
    p.stamina = Math.max(0, p.stamina - stats.stamina);
    weapon.cond = Math.max(0, weapon.cond - (0.6 + this.rng() * 0.7));
    this.makeNoise(p.x, p.y, stats.noise * 4 + 8, false);
    audio.melee();
    const range = stats.range;
    let hitAny = false;
    const targets = [];
    for (const z of this.zombies) {
      if (z.dead) continue;
      const d = dist(p.x, p.y, z.x, z.y);
      if (d > range + z.r) continue;
      const ang = angleTo(p.x, p.y, z.x, z.y);
      if (Math.abs(normAngle(ang - p.aimAngle)) > 0.95) continue;
      targets.push({ z, d });
    }
    targets.sort((a, b) => a.d - b.d);
    for (const { z } of targets.slice(0, 3)) {
      const dmg = Math.round(stats.damage * randRange(this.rng, 0.9, 1.15));
      this.damageZombie(z, dmg, p.aimAngle, false, stats.knockback || 5);
      hitAny = true;
    }
    if (!hitAny) this.spawnParticles(p.x + Math.cos(p.aimAngle) * 22, p.y - 6 + Math.sin(p.aimAngle) * 22, 2, '#9d9d86', 20, 0.2, 'dust');
    if (weapon.cond <= 0) this.toast('Melee weapon broke.', 'warn');
    this.updateHud(true);
  }

  damageZombie(z, dmg, angle, crit, knockback) {
    z.hp -= dmg;
    z.hitFlash = 0.12;
    this.hitMarker = 0.16;
    this.hitMarkerKill = z.hp <= 0;
    z.stagger = Math.max(z.stagger || 0, z.type === 'brute' ? 0.06 : z.type === 'runner' ? 0.12 : 0.18);
    z.chase = true;
    z.alerted = true;
    z.state = 'chase';
    z.targetX = this.player.x;
    z.targetY = this.player.y;
    this.floaters.push({
      x: z.x + randRange(this.rng, -2, 2), y: z.y - 18,
      text: crit ? 'CRIT ' + dmg : String(dmg), life: 0.8, color: crit ? '#e7c96b' : '#d8c8ad'
    });
    if (knockback) {
      const nx = z.x + Math.cos(angle) * knockback;
      const ny = z.y + Math.sin(angle) * knockback;
      if (this.world.canMove(nx, ny, z.r)) { z.x = nx; z.y = ny; }
    }
    audio.hit();
    if (z.hp <= 0 && !z.dead) this.killZombie(z);
    else {
      /* alert nearby allies */
      for (const o of this.zombies) {
        if (o === z || o.dead) continue;
        if (dist(o.x, o.y, z.x, z.y) < 150) {
          o.alerted = true;
          if (o.state === 'idle' || o.state === 'wander') { o.state = 'investigate'; o.targetX = z.x; o.targetY = z.y; o.stateTimer = 5; }
        }
      }
    }
  }

  killZombie(z) {
    z.dead = true;
    z.deathTime = this.time;
    z.attackWindup = 0;
    z.attackAnim = 0;
    z.moving = false;
    const def = ZOMBIE_TYPES[z.type];
    this.stats.kills++;
    this.stats.xp += def.xp;
    audio.zombie();
    this.world.addDecal(z.x, z.y, 'blood', 5 + Math.random() * 5);
    this.spawnParticles(z.x, z.y - 5, 14, '#6f2826', 70, 0.7);
    /* loot bag chance */
    const chance = z.type === 'brute' ? 0.9 : 0.42;
    if (this.rng() < chance) {
      const entries = [];
      const rolls = randInt(this.rng, 1, 2);
      for (let i = 0; i < rolls; i++) {
        const e = weightedPick(this.rng, CORPSE_LOOT);
        if (!e) continue;
        const qty = randInt(this.rng, e[2], e[3]);
        const item = createItem(e[0], { qty });
        entries.push({ id: item.id, qty: item.qty, cond: item.cond, loaded: item.loaded });
      }
      if (entries.length) this.world.spawnLootBag(z.x, z.y, entries);
    }
    this.updateHud(true);
  }

  attackPlayer(z) {
    const p = this.player;
    if (p.invuln > 0 || p.dead) return;
    const def = ZOMBIE_TYPES[z.type];
    const armor = this.equipment.armor;
    let dmg = def.damage * randRange(this.rng, 0.8, 1.2);
    let absorbed = 0;
    if (armor) {
      const av = armorValue(armor);
      absorbed = Math.min(dmg * 0.65, av * randRange(this.rng, 0.3, 0.7));
      dmg -= absorbed;
      armor.cond = Math.max(0, armor.cond - randRange(this.rng, 0.8, 1.8));
      if (armor.cond <= 0 && !armor._brokenShown) {
        armor._brokenShown = true;
        this.toast(ITEMS[armor.id].name + ' is ruined.', 'warn');
      }
    }
    dmg = Math.max(1, Math.round(dmg));
    p.health -= dmg;
    p.invuln = 0.45;
    p.hurtFlash = 0.25;
    this.lastHurtAngle = angleTo(p.x, p.y, z.x, z.y);
    this.lastHurtTimer = 1.1;
    if (this.rng() < (z.type === 'brute' ? 0.55 : z.type === 'runner' ? 0.18 : 0.3)) p.bleed = Math.min(5, p.bleed + 1);
    if (this.save.settings.shake) this.camera.shake = Math.min(8, this.camera.shake + (z.type === 'brute' ? 6 : 3));
    audio.hurt();
    this.floaters.push({ x: p.x, y: p.y - 22, text: '-' + dmg, life: 0.8, color: '#d96b5b' });
    if (this.extractionState) {
      this.extractionState.stall = 1.8;
      this.extractionState.progress = Math.max(0, this.extractionState.progress - 3);
      this.toast('Extraction interrupted!', 'bad');
    }
    if (p.health <= 0) this.die(z.type === 'brute' ? 'Crushed by a brute' : 'Torn apart by the infected');
    this.updateHud(true);
  }

  die(cause) {
    if (this.ended) return;
    this.player.dead = true;
    this.ended = true;
    this.deathCause = cause;
    audio.hurt();
    if (this.callbacks.end) this.callbacks.end('death', {
      zone: this.zone, cause, stats: this.stats, raidTime: this.raidTime,
      time: this.time, items: this.inv.items.slice()
    });
  }

  completeExtraction() {
    if (this.ended) return;
    this.ended = true;
    this.extractionState = null;
    audio.extract();
    const bonus = this.zone.difficulty * 75;
    this.stats.xp += bonus;
    if (this.callbacks.end) this.callbacks.end('extracted', {
      zone: this.zone, stats: this.stats, raidTime: this.raidTime, time: this.time,
      bonus, site: this.currentExtraction
    });
  }

  makeNoise(x, y, radius, gunshot) {
    let alerted = 0;
    for (const z of this.zombies) {
      if (z.dead) continue;
      const d = dist(z.x, z.y, x, y);
      if (d > radius) continue;
      if (z.state === 'chase') continue;
      z.alerted = true;
      z.state = 'investigate';
      z.targetX = x + randRange(this.rng, -18, 18);
      z.targetY = y + randRange(this.rng, -18, 18);
      z.stateTimer = gunshot ? 8 : 4;
      alerted++;
    }
    if (gunshot && alerted > 0 && this.rng() < 0.8) this.toast('Gunshot attracted the dead.', 'warn');
  }

  startReload() {
    const weapon = this.equipment.primary;
    if (!weapon) { this.toast('No firearm equipped.', 'warn'); return; }
    if (this.player.mode !== 'primary') this.switchWeapon('primary');
    const stats = weaponStats(weapon);
    if (!stats || stats.kind !== 'gun') return;
    if (this.reloadState) return;
    const need = magSize(weapon) - (weapon.loaded || 0);
    if (need <= 0) { this.toast('Magazine is full.', 'info'); return; }
    if (this.inv.count(stats.ammo) <= 0) { this.toast('No ' + ITEMS[stats.ammo].name + ' in your kit.', 'warn'); return; }
    this.reloadState = { t: 0, dur: stats.reload, weapon };
    audio.reload();
    this.updateHud(true);
  }

  updateReload(dt) {
    if (!this.reloadState) return;
    const rs = this.reloadState;
    rs.t += dt;
    if (rs.t >= rs.dur) {
      const loaded = reloadWeaponFrom(rs.weapon, this.inv);
      this.reloadState = null;
      if (loaded > 0) this.toast('Reloaded ' + loaded + ' rounds.', 'info');
      else this.toast('Out of ammunition.', 'warn');
      this.updateHud(true);
    }
  }

  /* ------------------- consumables ------------------- */
  applyEffects(effects) {
    const p = this.player;
    if (!effects) return;
    if (effects.health) p.health = clamp(p.health + effects.health, -20, p.maxHealth);
    if (effects.hunger) p.hunger = clamp(p.hunger + effects.hunger, 0, 100);
    if (effects.thirst) p.thirst = clamp(p.thirst + effects.thirst, 0, 100);
    if (effects.stamina) p.stamina = clamp(p.stamina + effects.stamina, 0, p.maxStamina);
    if (effects.bleed) p.bleed = clamp(p.bleed + effects.bleed, 0, 5);
    if (effects.infection) p.infection = clamp(p.infection + effects.infection, 0, 3);
    if (p.health <= 0 && !this.ended) this.die('Succumbed to your wounds');
    this.updateHud(true);
  }

  useFieldItem(item) {
    if (!item) return false;
    const d = ITEMS[item.id];
    if (!d) return false;
    if (this.inv.find(item.uid) == null) return false;
    if (d.type === 'food' || d.type === 'drink' || d.type === 'med') {
      if (this.player.dead) return false;
      if (d.type === 'med' && this.player.health >= this.player.maxHealth && this.player.bleed <= 0 && !(d.effects.stamina)) {
        this.toast('You are not injured.', 'info'); return false;
      }
      if (d.type === 'food' && this.player.hunger >= 99) { this.toast('You are not hungry.', 'info'); return false; }
      if (d.type === 'drink' && this.player.thirst >= 99) { this.toast('You are not thirsty.', 'info'); return false; }
      this.applyEffects(d.effects);
      this.inv.consume(item.id, 1);
      audio.pickup();
      this.toast('Used ' + d.name + '.', 'good');
      return true;
    }
    if (d.attach) {
      const primary = this.equipment.primary;
      if (!primary || !ITEMS[primary.id].weapon || ITEMS[primary.id].weapon.kind !== 'gun') {
        this.toast('Equip a firearm before fitting this.', 'warn'); return false;
      }
      if (primary.mods && primary.mods.includes(d.attach)) { this.toast('That attachment is already fitted.', 'info'); return false; }
      primary.mods = primary.mods || [];
      primary.mods.push(d.attach);
      this.inv.remove(item.uid);
      audio.craft();
      this.toast(d.name + ' fitted to ' + ITEMS[primary.id].name + '.', 'good');
      this.updateHud(true);
      return true;
    }
    if (d.tool === 'flare') {
      this.inv.consume(item.id, 1);
      for (const e of this.world.extractions) e.discovered = true;
      this.world.markExplored(this.player.x, this.player.y, 36);
      this.makeNoise(this.player.x, this.player.y, 800, true);
      this.spawnParticles(this.player.x, this.player.y - 8, 26, '#e6a34f', 80, 1.2);
      this.toast('Flare fired. The map is marked — and the dead are coming.', 'warn');
      audio.alarm();
      return true;
    }
    if (d.tool === 'lockpick' || d.tool === 'repair') {
      this.toast('Use this while interacting at camp or on a locked container.', 'info');
      return false;
    }
    this.toast(d.name + ' must be equipped at camp (or used from equipment).', 'info');
    return false;
  }

  quickHeal() {
    const candidates = ['medkit', 'bandage', 'painkillers', 'antibiotics'];
    for (const id of candidates) {
      const item = this.inv.items.find(it => it.id === id);
      if (item) { this.useFieldItem(item); return; }
    }
    this.toast('No medical supplies in your kit.', 'warn');
  }
  quickEat() {
    const candidates = ['mre', 'beans', 'tuna', 'jerky', 'energybar', 'apple', 'dogfood'];
    for (const id of candidates) {
      const item = this.inv.items.find(it => it.id === id);
      if (item) { this.useFieldItem(item); return; }
    }
    this.toast('No food in your kit.', 'warn');
  }
  quickDrink() {
    const candidates = ['purifiedwater', 'water', 'soda'];
    for (const id of candidates) {
      const item = this.inv.items.find(it => it.id === id);
      if (item) { this.useFieldItem(item); return; }
    }
    this.toast('No drinks in your kit.', 'warn');
  }

  /* ------------------- interaction ------------------- */
  getNearby() {
    const p = this.player;
    const ext = this.world.nearestExtraction(p.x, p.y);
    if (ext.extraction && ext.distance < ext.extraction.r + 10) {
      return { kind: 'extraction', target: ext.extraction, distance: ext.distance };
    }
    const c = this.world.nearestContainer(p.x, p.y, 30);
    if (c) return { kind: 'container', target: c, distance: dist(p.x, p.y, c.x + c.w / 2, c.y + c.h / 2) };
    const r = this.world.nearestResource(p.x, p.y, 34);
    if (r) return { kind: r.type === 'tree' ? 'tree' : 'rock', target: r, distance: dist(p.x, p.y, r.x, r.y) };
    return null;
  }

  interact() {
    if (this.paused || this.ended) return;
    if (this.action) { this.action = null; this.toast('Stopped.', 'info'); return; }
    if (this.extractionState) { return; }
    const near = this.getNearby();
    if (!near) { this.toast('Nothing to interact with.', 'info'); return; }
    if (near.kind === 'extraction') {
      const e = near.target;
      if (!e.discovered) { e.discovered = true; this.toast('Extraction beacon discovered: ' + e.name, 'good'); return; }
      this.startExtraction(e);
      return;
    }
    if (near.kind === 'container') {
      const c = near.target;
      if (c.locked) {
        if (this.inv.count('lockpick') > 0) {
          this.inv.consume('lockpick', 1);
          c.locked = false;
          this.toast('Lock picked.', 'good');
          audio.pickup();
        } else {
          this.toast('Locked. You need a lockpick set.', 'warn');
          return;
        }
      }
      if (c.opened) {
        this.openLoot(c);
        return;
      }
      const def = ITEMS[c.kind];
      this.action = { kind: 'search', target: c, t: 0, dur: c.searchTime, label: 'Searching ' + (c.kind === 'corpse' ? 'corpse' : 'container') };
      this.searchStart = { x: this.player.x, y: this.player.y };
      this.toast('Searching...', 'info');
      return;
    }
    if (near.kind === 'tree' || near.kind === 'rock') {
      const hasAxe = this.equipment.hasTool('axe') || (this.equipment.melee && ITEMS[this.equipment.melee.id].tool === 'axe');
      const dur = near.kind === 'tree' ? (hasAxe ? 0.9 : 1.8) : 1.5;
      this.action = { kind: 'harvest', target: near.target, t: 0, dur, label: near.kind === 'tree' ? 'Chopping tree' : 'Breaking rock' };
      this.searchStart = { x: this.player.x, y: this.player.y };
    }
  }

  openLoot(c) {
    const inv = this.world.getContainerInventory(c);
    c.searched = true;
    if (this.callbacks.loot) this.callbacks.loot(c, inv);
  }

  dropItem(item) {
    const found = this.inv.find(item.uid);
    if (!found) return false;
    const dropped = this.inv.remove(item.uid);
    this.world.spawnLootBag(
      this.player.x + (this.rng() - 0.5) * 12,
      this.player.y + (this.rng() - 0.5) * 12,
      [{ id: dropped.id, qty: dropped.qty, cond: dropped.cond, loaded: dropped.loaded, mods: dropped.mods }]
    );
    this.toast('Dropped ' + ITEMS[dropped.id].name + '.', 'info');
    return true;
  }

  startExtraction(e) {
    if (this.extractionState) return;
    const duration = Math.max(16, 30 - (this.radio ? 5 : 0) - (this.tower ? 6 : 0));
    this.extractionState = { site: e, progress: 0, duration, stall: 0, spawnTimer: 2, noiseTimer: 1 };
    this.currentExtraction = e;
    this.makeNoise(e.x, e.y, 650, true);
    for (let i = 0; i < 2 + this.zone.difficulty; i++) this.spawnRingZombie(e.x, e.y, 60, 120, true);
    this.toast('EXTRACTION STARTED — survive ' + Math.round(duration) + ' seconds.', 'good');
    audio.alarm();
    if (this.save.settings.shake) this.camera.shake = 4;
  }

  spawnRingZombie(x, y, minD, maxD, alerted) {
    if (this.zombies.filter(z => !z.dead).length > 155) return null;
    for (let i = 0; i < 20; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = randRange(this.rng, minD, maxD);
      const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
      if (this.world.canMove(sx, sy, 7)) {
        const type = weightedPick(this.rng, this.zombieWeights())[0];
        const z = this.spawnZombie(sx, sy, type, alerted);
        z.homeX = sx; z.homeY = sy;
        return z;
      }
    }
    return null;
  }

  updateAction(dt) {
    if (!this.action) return;
    const a = this.action;
    const p = this.player;
    if (p.moving) {
      if (dist(p.x, p.y, this.searchStart.x, this.searchStart.y) > 8) {
        this.action = null; this.toast('Interrupted.', 'warn'); return;
      }
    }
    a.t += dt;
    if (a.kind === 'search') {
      /* check still near */
      const c = a.target;
      if (dist(p.x, p.y, c.x + c.w / 2, c.y + c.h / 2) > 40) { this.action = null; this.toast('Interrupted.', 'warn'); return; }
      if (a.t >= a.dur) {
        c.opened = true;
        this.action = null;
        this.stats.looted++;
        this.openLoot(c);
      }
    } else if (a.kind === 'harvest') {
      const target = a.target;
      if (dist(p.x, p.y, target.x, target.y) > 44) { this.action = null; return; }
      if (a.t >= a.dur) {
        this.action = null;
        this.harvest(target);
      }
    }
  }

  harvest(target) {
    const hasAxe = this.equipment.hasTool('axe') || (this.equipment.melee && ITEMS[this.equipment.melee.id].tool === 'axe');
    const adds = [];
    if (target.type === 'tree') {
      const n = hasAxe ? randInt(this.rng, 2, 4) : randInt(this.rng, 1, 2);
      adds.push({ id: 'wood', qty: n });
      if (this.rng() < 0.2) adds.push({ id: 'rope', qty: 1 });
      if (this.rng() < 0.12) adds.push({ id: 'apple', qty: 1 });
      target.hp--;
      for (let i = 0; i < 8; i++) this.spawnParticles(target.x + randRange(this.rng, -4, 4), target.y - 8, 1, '#8b6a42', 30, 0.4);
      if (target.hp <= 0) {
        target.depleted = true; target.solid = false;
        adds.push({ id: 'wood', qty: randInt(this.rng, 2, 4) });
        this.spawnParticles(target.x, target.y - 8, 14, '#5e4a2e', 50, 0.8);
      }
      audio.melee();
    } else {
      const n = randInt(this.rng, 1, 3);
      adds.push({ id: 'stone', qty: n });
      if (this.rng() < 0.45) adds.push({ id: 'scrap', qty: 1 });
      target.hp--;
      for (let i = 0; i < 8; i++) this.spawnParticles(target.x + randRange(this.rng, -4, 4), target.y - 3, 1, '#8b8b7f', 35, 0.4);
      if (target.hp <= 0) { target.depleted = true; target.solid = false; adds.push({ id: 'stone', qty: randInt(this.rng, 1, 3) }); }
      audio.hit();
    }
    for (const add of adds) {
      const item = createItem(add.id, { qty: add.qty });
      const left = this.inv.add(item);
      if (left > 0) { this.toast('Inventory full — some resources lost.', 'warn'); break; }
      this.floaters.push({ x: target.x, y: target.y - 16, text: '+' + add.qty + ' ' + ITEMS[add.id].name, life: 1.1, color: '#c9cf9e' });
    }
    this.toast('Harvested ' + adds.map(a => a.qty + '× ' + ITEMS[a.id].name).join(', '), 'good');
    this.updateHud(true);
  }

  /* ------------------- main loop ------------------- */
  loop(now) {
    const dtRaw = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(0.05, Math.max(0, dtRaw));
    this.time += dt;
    this.frame++;
    if (!this.paused && !this.ended) this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this._loop);
  }

  update(dt) {
    this.world.time = this.time;
    this.updatePlayer(dt);
    this.updateReload(dt);
    this.updateAction(dt);
    this.updateExtraction(dt);
    this.updateZombies(dt);
    this.updateParticles(dt);
    this.updateRaid(dt);
    this.updateCamera(dt);
    this.world.markExplored(this.player.x, this.player.y, 8);

    this.hudAccum += dt;
    if (this.hudAccum > 0.12) { this.hudAccum = 0; this.updateHud(); this.updatePrompt(); }
    if (this.minimapCtx && this.frame % 5 === 0) this.renderMinimap();
  }

  updatePlayer(dt) {
    const p = this.player;
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.attackAnim = Math.max(0, p.attackAnim - dt);
    p.muzzle = Math.max(0, p.muzzle - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);
    this.hitMarker = Math.max(0, this.hitMarker - dt);
    this.lastHurtTimer = Math.max(0, this.lastHurtTimer - dt);
    this.camera.shake = Math.max(0, this.camera.shake - dt * 12);

    let mx = this.moveInput.x, my = this.moveInput.y;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) my -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) my += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    const moving = len > 0.05;
    const fp = this.viewMode === 'fp';
    let wx = mx, wy = my;
    if (fp) {
      const forward = -my, strafe = mx;
      wx = Math.cos(this.fpYaw) * forward - Math.sin(this.fpYaw) * strafe;
      wy = Math.sin(this.fpYaw) * forward + Math.cos(this.fpYaw) * strafe;
    }
    const wantRun = (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.touchRun) && !p.crouching;
    let running = wantRun && p.stamina > 1 && moving;
    let speed = p.crouching ? PLAYER_BASE.crouchSpeed : (running ? PLAYER_BASE.runSpeed : PLAYER_BASE.speed);
    if (p.hunger <= 0 || p.thirst <= 0) speed *= 0.72;
    if (p.stamina <= 0) running = false;

    if (moving) {
      const nx = p.x + wx * speed * dt;
      const ny = p.y + wy * speed * dt;
      if (this.world.canMove(nx, p.y, p.r)) p.x = nx;
      if (this.world.canMove(p.x, ny, p.r)) p.y = ny;
      p.walkPhase += dt * (running ? 13 : p.crouching ? 5 : 8.5);
      p.facingX = wx;
      p.facingY = wy;
      if (!fp && !this.mouse.active) p.aimAngle = Math.atan2(wy, wx);
    }
    p.moving = moving;
    p.running = running;

    if (fp) {
      p.aimAngle = this.fpYaw;
    } else if (!this.mouse.active || this.time - this.mouse.lastMove > 2.5) {
      /* aim assist / last direction */
      let best = null, bd = 250;
      for (const z of this.zombies) {
        if (z.dead) continue;
        const d = dist(p.x, p.y, z.x, z.y);
        if (d < bd) { bd = d; best = z; }
      }
      if (best) p.aimAngle = angleTo(p.x, p.y - 5, best.x, best.y - 5);
      else if (moving) p.aimAngle = Math.atan2(wy, wx);
    } else {
      p.aimAngle = angleTo(p.x, p.y - 5, this.mouse.x, this.mouse.y);
    }
    if (this.touchAttack || (this.mouse.down && this.currentWeapon() && ITEMS[this.currentWeapon().id].weapon && ITEMS[this.currentWeapon().id].weapon.auto)) {
      const w = this.currentWeapon();
      const st = w ? weaponStats(w) : null;
      if (st && st.kind === 'gun' && st.auto) this.tryAttack();
    }

    /* stamina */
    if (running) p.stamina = Math.max(0, p.stamina - PLAYER_BASE.sprintStamina * dt);
    else p.stamina = Math.min(p.maxStamina, p.stamina + (moving ? 5 : 12) * dt);

    /* survival meters */
    const exertion = running ? 2.2 : moving ? 1 : 0.55;
    p.hunger = Math.max(0, p.hunger - (0.027 + this.zone.difficulty * 0.003) * exertion * dt * 2.2);
    p.thirst = Math.max(0, p.thirst - (0.04 + this.zone.difficulty * 0.004) * exertion * dt * 2.2);
    if (p.hunger <= 0) p.health -= 0.8 * dt;
    if (p.thirst <= 0) p.health -= 1.2 * dt;
    if (p.hunger < 22 || p.thirst < 22) p.stamina = Math.min(p.stamina, p.maxStamina * 0.65);
    if (p.bleed > 0) {
      p.health -= (0.55 * p.bleed) * dt;
      if (this.rng() < dt * 1.5) this.world.addDecal(p.x + randRange(this.rng, -4, 4), p.y + randRange(this.rng, -4, 4), 'blood', 2.5);
    }
    if (p.hunger > 35 && p.thirst > 35 && p.bleed <= 0 && p.health < p.maxHealth) {
      p.health = Math.min(p.maxHealth, p.health + 0.42 * dt);
    }
    if (p.health <= 0 && !this.ended) {
      this.die(p.bleed > 0 ? 'Bled out in the dead zone' : p.hunger <= 0 ? 'Starved to death' : p.thirst <= 0 ? 'Died of dehydration' : 'Succumbed to your wounds');
    }
    if (this.usingTouch && !fp) this.updateMouseAutoAim();
  }

  updateMouseAutoAim() {
    const p = this.player;
    let best = null, bd = 230;
    for (const z of this.zombies) {
      if (z.dead) continue;
      const d = dist(p.x, p.y, z.x, z.y);
      if (d < bd) { bd = d; best = z; }
    }
    if (best) p.aimAngle = angleTo(p.x, p.y - 5, best.x, best.y - 5);
  }

  updateZombies(dt) {
    const p = this.player;
    const px = p.x, py = p.y;
    for (const z of this.zombies) {
      if (z.dead) continue;
      z.hitFlash = Math.max(0, z.hitFlash - dt);
      z.attackCd = Math.max(0, z.attackCd - dt);
      z.attackAnim = Math.max(0, (z.attackAnim || 0) - dt);
      z.stagger = Math.max(0, (z.stagger || 0) - dt);
      z.alertFlash = Math.max(0, (z.alertFlash || 0) - dt);
      const d = dist(z.x, z.y, px, py);
      if (d > 720 && !z.chase) { z.moving = false; continue; }

      const def = ZOMBIE_TYPES[z.type];
      const chaseSpeed = this.viewMode === 'fp' && def.fpChase ? def.fpChase : def.chase;
      const detectBonus = p.crouching ? 0.55 : 1;
      const moveBonus = p.running ? 1.3 : p.moving ? 1.1 : 0.9;
      const canSee = d < def.vision * detectBonus * moveBonus && this.world.hasLOS(z.x, z.y - 5, px, py - 5);
      const canHear = d < def.hearing * (p.running ? 1.25 : p.crouching ? 0.35 : 0.7);
      const heard = canHear && (p.moving || p.running);

      if (canSee) {
        z.lastSeenX = px; z.lastSeenY = py;
      } else if (heard) {
        z.lastSeenX = px + randRange(this.rng, -16, 16);
        z.lastSeenY = py + randRange(this.rng, -16, 16);
      }

      if (!z.chase && (canSee || heard)) {
        z.chase = true;
        z.alerted = true;
        z.state = 'chase';
        z.lostTimer = 0;
        z.searchTimer = 5;
        z.alertFlash = 1;
        z.aimAngle = angleTo(z.x, z.y - 5, px, py - 5);
        if (this.rng() < 0.04) this.toast('A zombie has your scent.', 'warn');
        for (const o of this.zombies) {
          if (o === z || o.dead || o.chase) continue;
          if (dist(o.x, o.y, z.x, z.y) < 130) {
            o.state = 'investigate';
            o.targetX = px; o.targetY = py;
            o.lastSeenX = px; o.lastSeenY = py;
            o.stateTimer = 5; o.searchTimer = 3; o.alerted = true;
            o.alertFlash = Math.max(o.alertFlash || 0, 0.75);
          }
        }
        audio.zombie();
      }

      if (z.chase) {
        if (canSee || d < 55) {
          z.lostTimer = 0;
          z.targetX = px; z.targetY = py;
          z.lastSeenX = px; z.lastSeenY = py;
        } else {
          z.lostTimer += dt;
          z.targetX = z.lastSeenX != null ? z.lastSeenX : px;
          z.targetY = z.lastSeenY != null ? z.lastSeenY : py;
        }
        if (z.lostTimer > 5) {
          z.chase = false;
          z.state = 'investigate';
          z.stateTimer = 6;
          z.searchTimer = 5;
          z.alertFlash = Math.max(z.alertFlash || 0, 0.6);
        }
      }

      let tx = z.targetX, ty = z.targetY;
      let speed = z.chase ? chaseSpeed : def.speed;
      if (z.state === 'idle') {
        z.stateTimer -= dt;
        z.moving = false;
        z.aimAngle = (z.variant - 1) * 1.1 + Math.sin(this.time * 0.85 + z.walkPhase) * 0.9;
        if (z.stateTimer <= 0) {
          z.state = 'wander';
          z.stateTimer = randRange(this.rng, 2, 5);
          const a = this.rng() * Math.PI * 2;
          const rr = randRange(this.rng, 20, 90);
          z.targetX = z.homeX + Math.cos(a) * rr;
          z.targetY = z.homeY + Math.sin(a) * rr;
        }
      } else if (z.state === 'wander') {
        z.stateTimer -= dt;
        speed = def.speed * 0.7;
        if (z.stateTimer <= 0 || dist(z.x, z.y, z.targetX, z.targetY) < 5) {
          z.state = 'idle';
          z.stateTimer = randRange(this.rng, 1.5, 5);
        }
      } else if (z.state === 'investigate') {
        z.stateTimer -= dt;
        speed = def.speed * 1.5;
        if (z.stateTimer <= 0 || dist(z.x, z.y, z.targetX, z.targetY) < 8) {
          if (z.searchTimer > 0) {
            z.searchTimer -= 1;
            const a = this.rng() * Math.PI * 2;
            const rr = randRange(this.rng, 14, 44);
            z.targetX = (z.lastSeenX != null ? z.lastSeenX : z.x) + Math.cos(a) * rr;
            z.targetY = (z.lastSeenY != null ? z.lastSeenY : z.y) + Math.sin(a) * rr;
            z.stateTimer = randRange(this.rng, 1.5, 3.2);
          } else {
            z.state = 'idle';
            z.stateTimer = randRange(this.rng, 1, 3);
          }
        }
      } else if (z.state === 'chase') {
        speed = chaseSpeed;
      }

      const attackRange = (def.low ? 10 : 13) + (def.size || 1) * 3;
      if (z.attackWindup > 0) {
        z.moving = false;
        z.aimAngle = angleTo(z.x, z.y - 5, px, py - 5);
        z.attackWindup -= dt;
        if (z.attackWindup <= 0) {
          z.attackWindup = 0;
          z.attackAnim = 0.34;
          if (dist(z.x, z.y, px, py) <= attackRange + 2) this.attackPlayer(z);
        }
      } else if (z.attackAnim > 0) {
        z.moving = false;
        z.aimAngle = angleTo(z.x, z.y - 5, px, py - 5);
      } else if (z.chase && d < attackRange) {
        z.moving = false;
        z.aimAngle = angleTo(z.x, z.y - 5, px, py - 5);
        if (z.attackCd <= 0) {
          const windup = def.windup || 0.45;
          z.attackWindup = windup;
          z.attackWindupMax = windup;
          z.attackCd = def.attackRate + windup;
          z.alertFlash = Math.max(z.alertFlash || 0, 0.4);
          if (this.rng() < 0.25) audio.zombie();
        }
      } else if (z.state !== 'idle') {
        tx = z.targetX; ty = z.targetY;
        const dd = dist(z.x, z.y, tx, ty);
        if (dd > 2) {
          let dx = (tx - z.x) / dd, dy = (ty - z.y) / dd;
          /* separation */
          let sepX = 0, sepY = 0;
          for (const o of this.zombies) {
            if (o === z || o.dead) continue;
            const od = dist(z.x, z.y, o.x, o.y);
            if (od < 14 && od > 0.01) { sepX += (z.x - o.x) / od; sepY += (z.y - o.y) / od; }
          }
          dx += sepX * 0.35; dy += sepY * 0.35;
          const dl = Math.hypot(dx, dy) || 1;
          dx /= dl; dy /= dl;
          const moved = z.stagger > 0 ? false : this.tryZombieStep(z, dx, dy, speed * dt);
          z.moving = moved;
          if (moved) {
            const gait = z.type === 'runner' ? 15 : z.type === 'brute' ? 8 : z.chase ? 11 : 6;
            z.walkPhase += dt * gait;
            z.stuckTimer = Math.max(0, z.stuckTimer - dt * 2);
          } else {
            z.aimAngle = angleTo(z.x, z.y - 5, tx, ty - 5);
            z.stuckTimer = (z.stuckTimer || 0) + dt;
            if (z.stuckTimer > 0.7) {
              z.stuckTimer = 0;
              const side = z.variant % 2 ? 1 : -1;
              z.avoidDir = -(z.avoidDir || side * 0.55);
              if (z.chase) {
                z.targetX = z.lastSeenX != null ? z.lastSeenX : px;
                z.targetY = z.lastSeenY != null ? z.lastSeenY : py;
              } else {
                const a = this.rng() * Math.PI * 2;
                const rr = randRange(this.rng, 18, 50);
                z.targetX = z.homeX + Math.cos(a) * rr;
                z.targetY = z.homeY + Math.sin(a) * rr;
                z.state = 'wander';
                z.stateTimer = randRange(this.rng, 1.5, 3.5);
              }
            }
          }
        } else {
          z.moving = false;
          z.aimAngle = angleTo(z.x, z.y - 5, tx, ty - 5);
        }
      } else {
        z.moving = false;
      }
      if (z.chase && this.rng() < dt * 0.05) audio.zombie();
      if (this.frame % 300 === 0 && !z.chase && d < 220 && this.rng() < 0.08) audio.zombie();
    }
    if (this.frame % 180 === 0) {
      this.zombies = this.zombies.filter(z => !z.dead || this.time - z.deathTime < 20);
    }
  }

  tryZombieStep(z, dx, dy, step) {
    if (!(step > 0.0001)) return false;
    const base = Math.atan2(dy, dx);
    const side = z.variant % 2 ? 1 : -1;
    const offsets = [0];
    if (z.avoidDir) offsets.push(z.avoidDir);
    for (const off of [0.55, -0.55, 1.05, -1.05, 1.55, -1.55]) offsets.push(off * side);
    const seen = new Set();
    for (const off of offsets) {
      const key = off.toFixed(3);
      if (seen.has(key)) continue;
      seen.add(key);
      const a = base + off;
      const sx = Math.cos(a) * step;
      const sy = Math.sin(a) * step;
      let mx = 0, my = 0;
      if (Math.abs(sx) > 0.01 && this.world.canMove(z.x + sx, z.y, z.r)) { z.x += sx; mx = sx; }
      if (Math.abs(sy) > 0.01 && this.world.canMove(z.x, z.y + sy, z.r)) { z.y += sy; my = sy; }
      if (mx || my) {
        z.aimAngle = Math.atan2(my, mx);
        if (off !== 0) { z.avoidDir = off; z.avoidTimer = 0.9; }
        else if (z.avoidTimer > 0) z.avoidTimer -= 0.05;
        else z.avoidDir = 0;
        return true;
      }
    }
    return false;
  }

  updateExtraction(dt) {
    if (!this.extractionState) return;
    const es = this.extractionState;
    const e = es.site;
    const p = this.player;
    if (dist(p.x, p.y, e.x, e.y) > e.r + 14) {
      this.extractionState = null;
      this.toast('You left the extraction zone. Signal lost.', 'bad');
      return;
    }
    es.stall = Math.max(0, es.stall - dt);
    if (es.stall <= 0) es.progress += dt;
    es.noiseTimer -= dt;
    if (es.noiseTimer <= 0) {
      es.noiseTimer = 2.2;
      this.makeNoise(e.x, e.y, 420, false);
    }
    es.spawnTimer -= dt;
    if (es.spawnTimer <= 0) {
      es.spawnTimer = Math.max(1.4, 4 - this.zone.difficulty * 0.4);
      const n = 1 + Math.floor(this.rng() * (1 + this.zone.difficulty / 2));
      for (let i = 0; i < n; i++) this.spawnRingZombie(e.x, e.y, 70, 150, true);
      if (this.rng() < 0.4) this.toast('They are closing in on the beacon.', 'warn');
    }
    if (es.progress >= es.duration) this.completeExtraction();
  }

  updateRaid(dt) {
    if (this.overrun) {
      this.overrunTimer -= dt;
      if (this.overrunTimer <= 0) {
        this.overrunTimer = Math.max(5, 11 - this.zone.difficulty);
        for (let i = 0; i < 2 + this.zone.difficulty; i++) this.spawnRingZombie(this.player.x, this.player.y, 120, 220, true);
      }
      return;
    }
    this.raidTime -= dt;
    if (!this.warned60 && this.raidTime < 60) {
      this.warned60 = true;
      this.toast('One minute until the dead zone goes dark.', 'bad');
      audio.alarm();
    }
    if (this.raidTime <= 0) {
      this.raidTime = 0;
      this.overrun = true;
      this.overrunTimer = 3;
      this.toast('OVERRUN — the horde is converging. Extract NOW.', 'bad');
      this.makeNoise(this.player.x, this.player.y, 1200, true);
      audio.alarm();
    }
  }

  updateCamera(dt) {
    const p = this.player;
    if (this.viewMode === 'fp') {
      this.camera.x = p.x;
      this.camera.y = p.y;
      return;
    }
    const lookX = Math.cos(p.aimAngle) * 18;
    const lookY = Math.sin(p.aimAngle) * 14;
    const tx = p.x + lookX;
    const ty = p.y + lookY;
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 7);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 7);
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      if (q.life <= 0) { this.particles.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 0.94; q.vy *= 0.94;
      if (q.gravity) q.vy += q.gravity * dt;
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt; f.y -= dt * 16;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  }

  spawnParticles(x, y, count, color, speed, life, type = 'blood') {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * speed;
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (type === 'dust' ? 8 : 6),
        life: life * (0.6 + Math.random() * 0.7), maxLife: life,
        color, size: type === 'shell' ? 1.5 : (1 + Math.random() * 2),
        gravity: type === 'blood' ? 50 : type === 'dust' ? -4 : 35,
        type
      });
    }
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
  }

  /* ------------------- rendering ------------------- */
  render() {
    const ctx = this.ctx;
    const w = this.viewW, h = this.viewH;
    const shake = this.camera.shake;
    const sx = this.camera.x + (shake ? (Math.random() - 0.5) * shake : 0);
    const sy = this.camera.y + (shake ? (Math.random() - 0.5) * shake : 0);
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    if (this.viewMode === 'fp') {
      this.firstPerson.render(ctx, w, h);
      ctx.restore();
      return;
    }
    ctx.translate(Math.round(w / 2 - sx), Math.round(h / 2 - sy));

    const left = sx - w / 2 - TILE * 2, right = sx + w / 2 + TILE * 2;
    const top = sy - h / 2 - TILE * 2, bottom = sy + h / 2 + TILE * 2;
    const tx0 = Math.max(0, Math.floor(left / TILE)), tx1 = Math.min(this.world.cols - 1, Math.ceil(right / TILE));
    const ty0 = Math.max(0, Math.floor(top / TILE)), ty1 = Math.min(this.world.rows - 1, Math.ceil(bottom / TILE));

    /* ground */
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        this.drawTile(ctx, tx, ty);
      }
    }

    /* decals */
    for (const d of this.world.decals) {
      if (d.x < left || d.x > right || d.y < top || d.y > bottom) continue;
      if (d.type === 'blood') {
        ctx.fillStyle = 'rgba(84,25,24,0.45)';
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.size, d.size * 0.55, d.rot, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* extraction rings */
    for (const e of this.world.extractions) {
      if (e.x < left - 60 || e.x > right + 60 || e.y < top - 60 || e.y > bottom + 60) continue;
      drawExtraction(ctx, e, this.time, e.discovered);
    }

    /* drawables sorted by base y */
    const list = [];
    for (const tr of this.world.trees) {
      if (tr.x < left - 20 || tr.x > right + 20 || tr.y < top - 30 || tr.y > bottom + 20) continue;
      list.push({ y: tr.y, draw: () => drawTree(ctx, tr, this.time) });
    }
    for (const r of this.world.rocks) {
      if (r.x < left - 20 || r.x > right + 20 || r.y < top - 20 || r.y > bottom + 20) continue;
      list.push({ y: r.y, draw: () => drawRock(ctx, r, this.time) });
    }
    for (const c of this.world.containers) {
      if (c.x + c.w < left || c.x > right || c.y + c.h < top || c.y > bottom) continue;
      list.push({ y: c.y + c.h, draw: () => drawContainer(ctx, c, this.time) });
    }
    for (const z of this.zombies) {
      if (z.dead) continue;
      if (z.x < left - 20 || z.x > right + 20 || z.y < top - 30 || z.y > bottom + 20) continue;
      list.push({ y: z.y, draw: () => drawZombie(ctx, z, this.time) });
    }
    list.push({ y: this.player.y, draw: () => drawPlayer(ctx, this.player, this.time) });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();

    /* melee arc */
    if (this.player.attackAnim > 0 && this.currentWeapon() && !ITEMS[this.currentWeapon().id].weapon) { /* noop */ }
    const cur = this.currentWeapon();
    if (cur && ITEMS[cur.id].weapon && ITEMS[cur.id].weapon.kind === 'melee' && this.player.attackAnim > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, this.player.attackAnim * 2.5);
      ctx.strokeStyle = '#d8d3b6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y - 6, ITEMS[cur.id].weapon.range * 0.8, this.player.aimAngle - 0.8, this.player.aimAngle + 0.8);
      ctx.stroke();
      ctx.restore();
    }

    /* tracers */
    for (const tr of this.tracers) {
      ctx.globalAlpha = tr.life / tr.maxLife;
      ctx.strokeStyle = '#f2d68a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /* particles */
    for (const q of this.particles) {
      ctx.globalAlpha = Math.max(0.1, q.life / q.maxLife);
      ctx.fillStyle = q.color;
      ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size);
    }
    ctx.globalAlpha = 1;

    /* floaters */
    ctx.font = '5px monospace';
    ctx.textAlign = 'center';
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    /* interaction marker */
    if (this.interactTarget) {
      const t = this.interactTarget;
      const mx = t.kind === 'extraction' ? t.target.x : (t.target.x + (t.target.w ? t.target.w / 2 : 0));
      const my = t.kind === 'extraction' ? t.target.y - 18 : (t.target.y + (t.target.h ? t.target.h / 2 : 0) - 2);
      ctx.fillStyle = '#d8c36a';
      ctx.fillRect(mx - 1, my - 1, 2, 2);
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#d8c36a';
      ctx.strokeRect(mx - 3, my - 3, 6, 6);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    /* screen-space atmosphere */
    this.renderAtmosphere(ctx, w, h, sx, sy);

    /* crosshair */
    if (this.mouse.active && !this.usingTouch && !this.paused && !this.ended) {
      const cx = this.mouse.x - sx + w / 2;
      const cy = this.mouse.y - sy + h / 2;
      ctx.strokeStyle = 'rgba(219,213,178,0.65)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy); ctx.lineTo(cx - 1, cy);
      ctx.moveTo(cx + 1, cy); ctx.lineTo(cx + 4, cy);
      ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy - 1);
      ctx.moveTo(cx, cy + 1); ctx.lineTo(cx, cy + 4);
      ctx.stroke();
    }

    /* hurt flash */
    if (this.player.hurtFlash > 0) {
      ctx.fillStyle = 'rgba(150,30,25,' + (this.player.hurtFlash * 0.5) + ')';
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawTile(ctx, tx, ty) {
    const t = this.world.tileAt(tx, ty);
    const x = tx * TILE, y = ty * TILE;
    const v = hash2(tx, ty, this.world.seed);
    const info = TILE_INFO[t] || TILE_INFO[T.GRASS];
    let base = info.color;
    if (t === T.GRASS || t === T.DARK_GRASS || t === T.DIRT) {
      const palettes = {
        [T.GRASS]: ['#34402c', '#36422d', '#323d2a', '#39462f'],
        [T.DARK_GRASS]: ['#29331f', '#2b3521', '#26301d', '#2e3823'],
        [T.DIRT]: ['#4b4030', '#504535', '#473d2e', '#534737']
      };
      base = palettes[t][Math.floor(v * 4)];
    } else if (t === T.ROAD || t === T.ASPHALT) {
      const palettes = {
        [T.ROAD]: ['#35383a', '#373a3c', '#333638', '#393c3e'],
        [T.ASPHALT]: ['#3d4042', '#404345', '#3b3e40', '#424547']
      };
      base = palettes[t][Math.floor(v * 4)];
    } else if (t === T.WOOD_FLOOR) {
      base = v < 0.5 ? '#5b4935' : '#574532';
    } else if (t === T.CONCRETE) {
      base = v < 0.5 ? '#565a56' : '#525652';
    } else if (t === T.WALL_WOOD) {
      base = v < 0.5 ? '#6b5136' : '#634a31';
    } else if (t === T.WALL_CONCRETE) {
      base = v < 0.5 ? '#626762' : '#5b605b';
    } else if (t === T.WATER) {
      base = Math.sin(this.time * 1.2 + tx * 0.6 + ty * 0.3) > 0 ? '#263c42' : '#2a4249';
    } else if (t === T.TILE_FLOOR) {
      base = ((tx + ty) % 2 === 0) ? '#5a5c55' : '#54564f';
    } else if (t === T.PAVEMENT) {
      base = v < 0.5 ? '#4c4e4a' : '#494b47';
    } else if (t === T.DIRT_ROAD) {
      base = v < 0.5 ? '#4d4433' : '#514736';
    } else if (t === T.RUBBLE) {
      base = v < 0.5 ? '#4a4a43' : '#45453f';
    }
    ctx.fillStyle = base;
    ctx.fillRect(x, y, TILE, TILE);

    if (t === T.WALL_WOOD || t === T.WALL_CONCRETE) {
      const top = t === T.WALL_WOOD ? '#886944' : '#7d817b';
      const bot = t === T.WALL_WOOD ? '#3f2f1f' : '#3b3f3b';
      ctx.fillStyle = top; ctx.fillRect(x, y, TILE, 2);
      ctx.fillStyle = bot; ctx.fillRect(x, y + TILE - 3, TILE, 3);
      if (t === T.WALL_WOOD) {
        ctx.fillStyle = 'rgba(30,20,12,0.35)';
        ctx.fillRect(x + 7, y + 2, 1, TILE - 4);
      } else {
        ctx.fillStyle = 'rgba(30,35,30,0.3)';
        ctx.fillRect(x + 2, y + 6, 5, 1); ctx.fillRect(x + 9, y + 10, 4, 1);
      }
    } else if (t === T.WOOD_FLOOR) {
      ctx.fillStyle = 'rgba(35,24,14,0.35)';
      ctx.fillRect(x, y + 7, TILE, 1);
      ctx.fillStyle = 'rgba(120,95,62,0.22)';
      ctx.fillRect(x, y + 8, TILE, 1);
      if (v < 0.2) { ctx.fillStyle = 'rgba(35,24,14,0.25)'; ctx.fillRect(x + 5, y, 1, TILE); }
    } else if (t === T.CONCRETE || t === T.PAVEMENT || t === T.ASPHALT) {
      if (v < 0.16) { ctx.fillStyle = 'rgba(20,24,20,0.28)'; ctx.fillRect(x + 3, y + 4, 6, 1); ctx.fillRect(x + 5, y + 5, 3, 1); }
      if (v > 0.92) { ctx.fillStyle = 'rgba(20,24,20,0.2)'; ctx.fillRect(x + 10, y + 11, 1, 2); }
    } else if (t === T.ROAD || t === T.DIRT_ROAD) {
      if (t === T.ROAD && Math.abs(ty % 9) === 0 && v < 0.55) {
        ctx.fillStyle = 'rgba(180,170,115,0.16)';
        ctx.fillRect(x + 4, y + 7, 7, 1);
      }
      if (v < 0.1) { ctx.fillStyle = 'rgba(15,18,18,0.3)'; ctx.fillRect(x + 3, y + 5, 4, 2); }
    } else if (t === T.GRASS || t === T.DARK_GRASS) {
      if (v < 0.055) {
        ctx.fillStyle = t === T.GRASS ? '#4c5e3a' : '#3d5230';
        ctx.fillRect(x + 4, y + 5, 1, 3); ctx.fillRect(x + 6, y + 4, 1, 4); ctx.fillRect(x + 8, y + 6, 1, 3);
      }
      if (v > 0.975) { ctx.fillStyle = 'rgba(80,75,52,0.55)'; ctx.fillRect(x + 9, y + 10, 2, 1); }
    } else if (t === T.DIRT) {
      if (v < 0.1) { ctx.fillStyle = 'rgba(30,25,17,0.3)'; ctx.fillRect(x + 4, y + 5, 2, 1); ctx.fillRect(x + 10, y + 11, 1, 1); }
    } else if (t === T.WATER) {
      if (v < 0.2) { ctx.fillStyle = 'rgba(130,170,170,0.12)'; ctx.fillRect(x + 3, y + 6, 8, 1); }
    } else if (t === T.FENCE) {
      ctx.fillStyle = '#737660'; ctx.fillRect(x, y + 4, TILE, 2);
      ctx.fillRect(x + 3, y + 2, 2, TILE - 2); ctx.fillRect(x + 11, y + 2, 2, TILE - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + 12, TILE, 1);
    } else if (t === T.RUBBLE) {
      if (v < 0.5) { ctx.fillStyle = '#5e5f56'; ctx.fillRect(x + 4, y + 6, 3, 2); ctx.fillRect(x + 9, y + 10, 2, 2); }
      if (v < 0.2) { ctx.fillStyle = '#3d3f37'; ctx.fillRect(x + 10, y + 3, 2, 2); }
    }
  }

  renderAtmosphere(ctx, w, h, sx, sy) {
    /* dusk tint + vignette */
    const px = this.player.x - sx + w / 2;
    const py = this.player.y - sy + h / 2;
    const grad = ctx.createRadialGradient(px, py, Math.min(w, h) * 0.18, px, py, Math.max(w, h) * 0.72);
    grad.addColorStop(0, 'rgba(4,7,7,0)');
    grad.addColorStop(0.55, 'rgba(4,7,7,0.18)');
    grad.addColorStop(1, 'rgba(3,5,6,0.65)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    /* cold dusk cast */
    ctx.fillStyle = 'rgba(24,34,44,0.12)';
    ctx.fillRect(0, 0, w, h);
    /* flashlight */
    if (this.flashlight) {
      const a = this.player.aimAngle;
      ctx.save();
      ctx.translate(px, py - 3);
      ctx.rotate(a);
      const lg = ctx.createRadialGradient(0, 0, 2, 0, 0, 75);
      lg.addColorStop(0, 'rgba(240,225,165,0.18)');
      lg.addColorStop(0.5, 'rgba(240,225,165,0.07)');
      lg.addColorStop(1, 'rgba(240,225,165,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 75, -0.44, 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    /* rain */
    if (this.world.weather === 'rain') {
      ctx.strokeStyle = 'rgba(156,178,184,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const t = this.time;
      for (let i = 0; i < 70; i++) {
        const rx = (hash2(i, 1, 7) * w + t * 18 * (0.7 + hash2(i, 3, 2) * 0.6)) % w;
        const ry = (hash2(i, 2, 9) * h + t * 90 * (0.5 + hash2(i, 4, 5) * 0.7)) % h;
        ctx.moveTo(rx, ry); ctx.lineTo(rx - 2, ry + 6);
      }
      ctx.stroke();
    }
    /* low-health pulse */
    const hpRatio = this.player.health / this.player.maxHealth;
    if (hpRatio < 0.35) {
      const a = (0.12 + Math.sin(this.time * 4) * 0.05) * (1 - hpRatio / 0.35);
      ctx.fillStyle = 'rgba(95,18,16,' + a + ')';
      ctx.fillRect(0, 0, w, h);
    }
    /* overrun red sky */
    if (this.overrun) {
      ctx.fillStyle = 'rgba(100,22,18,0.08)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  updatePrompt() {
    let text = '';
    let progress = null;
    const near = this.getNearby();
    this.interactTarget = near;
    if (this.action) {
      text = this.action.label.toUpperCase() + '...';
      progress = clamp(this.action.t / this.action.dur, 0, 1);
    } else if (this.extractionState) {
      const es = this.extractionState;
      text = 'EXTRACTING — HOLD THE ZONE';
      progress = clamp(es.progress / es.duration, 0, 1);
    } else if (near) {
      if (near.kind === 'extraction') {
        const e = near.target;
        text = e.discovered ? 'E  CALL EXTRACTION — ' + e.name.toUpperCase() : 'E  SCAN BEACON';
      } else if (near.kind === 'container') {
        const c = near.target;
        const name = c.kind === 'corpse' ? 'CORPSE' : c.kind === 'car' ? 'VEHICLE' : c.kind === 'warehouse' ? 'CRATE' : c.kind.toUpperCase();
        if (c.locked) text = 'E  LOCKED ' + name + ' — NEED LOCKPICK';
        else if (c.opened) text = 'E  LOOT ' + name;
        else text = 'E  SEARCH ' + name;
      } else if (near.kind === 'tree') text = 'E  CHOP TREE';
      else text = 'E  BREAK ROCK';
    } else if (this.reloadState) {
      text = 'RELOADING...';
      progress = clamp(this.reloadState.t / this.reloadState.dur, 0, 1);
    }
    if (this.reloadState && !this.action && !this.extractionState) {
      text = 'RELOADING...';
      progress = clamp(this.reloadState.t / this.reloadState.dur, 0, 1);
    }
    if (this.callbacks.prompt) this.callbacks.prompt({ text, progress, extraction: this.extractionState });
  }

  updateHud(force) {
    const p = this.player;
    const weapon = this.currentWeapon();
    const stats = weapon ? weaponStats(weapon) : null;
    let ammo = null;
    if (stats && stats.kind === 'gun') {
      ammo = { loaded: weapon.loaded || 0, mag: magSize(weapon), reserve: this.inv.count(stats.ammo), type: ITEMS[stats.ammo].name };
    }
    const near = this.world.nearestExtraction(p.x, p.y);
    const data = {
      health: Math.max(0, p.health), maxHealth: p.maxHealth,
      stamina: p.stamina, maxStamina: p.maxStamina,
      hunger: p.hunger, thirst: p.thirst, bleed: p.bleed,
      crouching: p.crouching, running: p.running,
      mode: p.mode,
      weapon: weapon ? {
        name: ITEMS[weapon.id].name, id: weapon.id,
        kind: stats ? stats.kind : 'melee',
        loaded: ammo ? ammo.loaded : null, mag: ammo ? ammo.mag : null,
        reserve: ammo ? ammo.reserve : null, ammoName: ammo ? ammo.type : null,
        cond: weapon.cond, maxCond: ITEMS[weapon.id].weapon ? ITEMS[weapon.id].weapon.durability : 100,
        mods: weapon.mods || []
      } : null,
      melee: this.equipment.melee ? ITEMS[this.equipment.melee.id].name : null,
      primary: this.equipment.primary ? ITEMS[this.equipment.primary.id].name : null,
      raidTime: this.raidTime, raidMax: this.raidMax, overrun: this.overrun,
      zone: this.zone.name, zoneId: this.zoneId, level: this.save.player.level,
      view: this.viewMode,
      kills: this.stats.kills, xp: this.save.player.xp, day: this.save.day,
      extraction: this.extractionState ? {
        progress: this.extractionState.progress, duration: this.extractionState.duration,
        name: this.extractionState.site.name, stall: this.extractionState.stall
      } : null,
      nearestExtraction: near.extraction ? { distance: near.distance, discovered: near.extraction.discovered, name: near.extraction.name } : null,
      time: this.time
    };
    if (this.callbacks.hud) this.callbacks.hud(data, force);
  }

  renderMinimap() {
    const ctx = this.minimapCtx;
    if (!ctx) return;
    const w = this.minimap.width, h = this.minimap.height;
    const world = this.world;
    const p = this.player;
    const range = 27;
    const ptx = p.x / TILE, pty = p.y / TILE;
    const scale = w / (range * 2);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#151a15';
    ctx.fillRect(0, 0, w, h);
    for (let dy = -range; dy < range; dy++) {
      for (let dx = -range; dx < range; dx++) {
        const tx = Math.floor(ptx + dx), ty = Math.floor(pty + dy);
        if (!world.inBounds(tx, ty)) continue;
        const x = (dx + range) * scale, y = (dy + range) * scale;
        if (!world.isExplored(tx, ty)) { ctx.fillStyle = '#10140f'; ctx.fillRect(x, y, scale + 0.5, scale + 0.5); continue; }
        const t = world.tileAt(tx, ty);
        let col = TILE_INFO[t] ? TILE_INFO[t].color : '#30382a';
        if (t === T.WALL_WOOD || t === T.WALL_CONCRETE) col = '#8b8c77';
        else if (t === T.WATER) col = '#2b4d58';
        else if (t === T.ROAD || t === T.ASPHALT || t === T.DIRT_ROAD) col = '#44484a';
        else if (t === T.WOOD_FLOOR || t === T.CONCRETE || t === T.TILE_FLOOR || t === T.PAVEMENT) col = '#5f5d4e';
        ctx.fillStyle = col;
        ctx.fillRect(x, y, scale + 0.5, scale + 0.5);
      }
    }
    /* extraction */
    for (const e of world.extractions) {
      if (!e.discovered) continue;
      const x = (e.x / TILE - ptx + range) * scale;
      const y = (e.y / TILE - pty + range) * scale;
      if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue;
      ctx.fillStyle = '#b9c96a';
      ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.strokeStyle = 'rgba(185,201,106,0.5)';
      ctx.strokeRect(x - 4, y - 4, 8, 8);
    }
    /* zombies close */
    for (const z of this.zombies) {
      if (z.dead) continue;
      const d = dist(z.x, z.y, p.x, p.y);
      if (d > 230) continue;
      const x = (z.x / TILE - ptx + range) * scale;
      const y = (z.y / TILE - pty + range) * scale;
      ctx.fillStyle = z.chase ? '#d45f4b' : 'rgba(170,90,70,0.65)';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    /* player */
    const cx = w / 2, cy = h / 2;
    ctx.fillStyle = '#e8e2c0';
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
    ctx.strokeStyle = '#e8e2c0';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(p.aimAngle) * 6, cy + Math.sin(p.aimAngle) * 6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160,170,130,0.18)';
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  drawFullMap(ctx) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const world = this.world;
    const size = Math.min(w, h) - 12;
    const ox = (w - size) / 2, oy = (h - size) / 2;
    const s = size / world.cols;
    ctx.fillStyle = '#0d100d';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#141a12';
    ctx.fillRect(ox, oy, size, size);
    for (let ty = 0; ty < world.rows; ty++) {
      for (let tx = 0; tx < world.cols; tx++) {
        const x = ox + tx * s, y = oy + ty * s;
        if (!world.isExplored(tx, ty)) {
          if (tx % 8 === 0 || ty % 8 === 0) { ctx.fillStyle = 'rgba(60,68,54,0.18)'; ctx.fillRect(x, y, s, s); }
          continue;
        }
        const t = world.tileAt(tx, ty);
        let col = TILE_INFO[t] ? TILE_INFO[t].color : '#30382a';
        if (t === T.WALL_WOOD || t === T.WALL_CONCRETE) col = '#9a9b82';
        else if (t === T.WATER) col = '#2f5864';
        else if (t === T.ROAD || t === T.ASPHALT || t === T.DIRT_ROAD) col = '#4b5052';
        else if (t === T.WOOD_FLOOR || t === T.CONCRETE || t === T.TILE_FLOOR || t === T.PAVEMENT) col = '#64614f';
        ctx.fillStyle = col;
        ctx.fillRect(x, y, Math.ceil(s) + 0.3, Math.ceil(s) + 0.3);
      }
    }
    /* buildings outlines on explored map (subtle) */
    ctx.strokeStyle = 'rgba(200,196,160,0.3)';
    ctx.lineWidth = 1;
    for (const b of world.buildings) {
      if (!world.isExplored(b.x, b.y)) continue;
      ctx.strokeRect(ox + b.x * s, oy + b.y * s, b.w * s, b.h * s);
    }
    /* extraction signals */
    for (const e of world.extractions) {
      const x = ox + (e.x / TILE) * s, y = oy + (e.y / TILE) * s;
      if (e.discovered) {
        ctx.fillStyle = '#c3d474';
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.strokeStyle = 'rgba(195,212,116,0.8)';
        ctx.strokeRect(x - 5, y - 5, 10, 10);
      } else {
        ctx.fillStyle = 'rgba(200,160,85,0.7)';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,160,85,0.5)';
        ctx.strokeRect(x - 4, y - 4, 8, 8);
      }
    }
    /* grid lines */
    ctx.strokeStyle = 'rgba(150,160,130,0.08)';
    for (let i = 0; i <= 8; i++) {
      const x = ox + size * i / 8, y = oy + size * i / 8;
      ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x, oy + size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + size, y); ctx.stroke();
    }
    /* player */
    const px = ox + (this.player.x / TILE) * s;
    const py = oy + (this.player.y / TILE) * s;
    ctx.fillStyle = '#f1eccb';
    ctx.fillRect(px - 3, py - 3, 6, 6);
    ctx.strokeStyle = '#f1eccb';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(this.player.aimAngle) * 10, py + Math.sin(this.player.aimAngle) * 10);
    ctx.stroke();
    /* border */
    ctx.strokeStyle = '#5f6b4f';
    ctx.strokeRect(ox + 0.5, oy + 0.5, size, size);
    return { ox, oy, size, s };
  }
}
