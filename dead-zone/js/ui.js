/* DEAD ZONE — HUD, inventory screens, modals, loot UI */

import { ITEMS, RARITY, PLAYER_BASE } from './data.js';
import {
  createItem, itemW, itemH, maxConditionFor, weaponStats, magSize,
  bagRows, fieldRows, armorValue
} from './inventory.js';
import { drawItemIcon } from './sprites.js';
import { fmtTime, clamp } from './util.js';
import { audio } from './audio.js';

/* ------------------------------------------------------------------ */
export class ModalManager {
  constructor(root) {
    this.root = root;
    this.stack = [];
    this._onKey = (e) => {
      if (e.code !== 'Escape' || !this.stack.length) return;
      const top = this.stack[this.stack.length - 1];
      if (!top.closable) return;
      e.preventDefault();
      this.close(top);
    };
    window.addEventListener('keydown', this._onKey);
  }
  get isOpen() { return this.stack.length > 0; }
  open({ title = '', subtitle = '', content = null, className = '', closable = true, onClose = null }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-screen ' + className;
    overlay.innerHTML = `
      <div class="modal-panel">
        <div class="modal-head">
          <div><div class="modal-title">${title}</div>${subtitle ? `<div class="modal-sub">${subtitle}</div>` : ''}</div>
          ${closable ? '<button class="modal-close" aria-label="Close">×</button>' : ''}
        </div>
        <div class="modal-body"></div>
      </div>`;
    const body = overlay.querySelector('.modal-body');
    if (content) body.appendChild(content);
    const handle = { overlay, panel: overlay.querySelector('.modal-panel'), body, title, onClose, closable };
    if (closable) {
      overlay.querySelector('.modal-close').addEventListener('click', () => this.close(handle));
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) this.close(handle); });
    }
    this.root.appendChild(overlay);
    this.stack.push(handle);
    requestAnimationFrame(() => overlay.classList.add('open'));
    return handle;
  }
  close(handle) {
    const idx = this.stack.indexOf(handle);
    if (idx < 0) return;
    this.stack.splice(idx, 1);
    handle.overlay.classList.remove('open');
    setTimeout(() => handle.overlay.remove(), 120);
    if (handle.onClose) handle.onClose();
  }
  closeAll() {
    while (this.stack.length) this.close(this.stack[this.stack.length - 1]);
  }
}

/* ------------------------------------------------------------------ */
export function itemIconCanvas(id, size = 30) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  c.className = 'item-icon';
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawItemIcon(ctx, id, size);
  return c;
}

export function addIcon(el, id, size = 26) {
  el.appendChild(itemIconCanvas(id, size));
  return el;
}

/* ------------------------------------------------------------------ */
export class HUD {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.root = $('hud');
    this.bars = {
      health: $('bar-health'), stamina: $('bar-stamina'),
      hunger: $('bar-hunger'), thirst: $('bar-thirst')
    };
    this.vals = {
      health: $('val-health'), stamina: $('val-stamina'),
      hunger: $('val-hunger'), thirst: $('val-thirst')
    };
    this.timer = $('raid-timer');
    this.zone = $('hud-zone');
    this.signal = $('signal-label');
    this.promptRoot = $('hud-prompt');
    this.promptText = $('prompt-text');
    this.promptBar = $('prompt-progress');
    this.promptFill = $('prompt-progress-fill');
    this.weaponMode = $('weapon-mode');
    this.weaponName = $('weapon-name');
    this.weaponAmmo = $('weapon-ammo');
    this.weaponCond = $('weapon-cond-fill');
    this.weaponMods = $('weapon-mods');
    this.effects = $('status-effects');
    this.extractionPanel = $('extraction-panel');
    this.extractionName = $('extraction-name');
    this.extractionFill = $('extraction-fill');
    this.extractionTime = $('extraction-time');
    this.hotPrimary = $('hot-primary');
    this.hotMelee = $('hot-melee');
    this.hotHeal = $('hot-heal');
    this.btnCrouch = $('btn-crouch');
    this.btnView = $('btn-view');
    this.kills = $('hud-kills');
    this.minimap = $('minimap');
    this.last = null;
  }
  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); this.promptRoot.classList.add('hidden'); this.extractionPanel.classList.add('hidden'); }
  update(d, force) {
    const p = d;
    const setBar = (el, v) => { if (el) el.style.width = clamp(v, 0, 100) + '%'; };
    setBar(this.bars.health, (p.health / p.maxHealth) * 100);
    setBar(this.bars.stamina, (p.stamina / p.maxStamina) * 100);
    setBar(this.bars.hunger, p.hunger);
    setBar(this.bars.thirst, p.thirst);
    this.bars.health.classList.toggle('critical', p.health / p.maxHealth < 0.28);
    this.bars.stamina.classList.toggle('critical', p.stamina / p.maxStamina < 0.18);
    if (this.vals.health) this.vals.health.textContent = Math.ceil(p.health);
    if (this.vals.stamina) this.vals.stamina.textContent = Math.ceil(p.stamina);
    if (this.vals.hunger) this.vals.hunger.textContent = Math.floor(p.hunger);
    if (this.vals.thirst) this.vals.thirst.textContent = Math.floor(p.thirst);

    this.timer.textContent = p.overrun ? 'OVERRUN' : fmtTime(p.raidTime);
    this.timer.classList.toggle('danger', p.raidTime < 60 || p.overrun);
    this.timer.classList.toggle('overrun', p.overrun);
    this.zone.textContent = p.zone.toUpperCase() + ' · DAY ' + p.day;
    if (this.signal) {
      const ne = p.nearestExtraction;
      if (ne && ne.discovered) {
        this.signal.textContent = 'EXTRACT: ' + ne.name.toUpperCase() + ' · ' + Math.round(ne.distance / 16) + 'm';
        this.signal.classList.remove('hidden');
      } else if (ne) {
        this.signal.textContent = 'NO EXTRACTION SIGNAL LOCKED';
        this.signal.classList.add('dim');
        this.signal.classList.remove('hidden');
      } else this.signal.classList.add('hidden');
    }

    if (p.weapon) {
      const w = p.weapon;
      this.weaponMode.textContent = p.mode === 'primary' ? 'PRIMARY' : 'MELEE';
      this.weaponName.textContent = w.name.toUpperCase();
      if (w.kind === 'gun') {
        this.weaponAmmo.innerHTML = `<b>${w.loaded}</b><span> / ${w.mag}</span> <em>${w.reserve} ${w.ammoName}</em>`;
      } else {
        this.weaponAmmo.innerHTML = '<b>MELEE</b>';
      }
      const cond = w.maxCond ? (w.cond / w.maxCond) * 100 : 100;
      if (this.weaponCond) {
        this.weaponCond.style.width = clamp(cond, 0, 100) + '%';
        this.weaponCond.classList.toggle('critical', cond < 25);
      }
      this.weaponMods.innerHTML = (w.mods || []).map(m => `<span>${m.toUpperCase()}</span>`).join('');
    } else {
      this.weaponMode.textContent = 'UNARMED';
      this.weaponName.textContent = 'NO WEAPON';
      this.weaponAmmo.innerHTML = '<b>FISTS</b>';
      if (this.weaponCond) this.weaponCond.style.width = '0%';
    }
    if (this.hotPrimary) this.hotPrimary.classList.toggle('active', p.mode === 'primary');
    if (this.hotMelee) this.hotMelee.classList.toggle('active', p.mode === 'melee');
    if (this.btnCrouch) this.btnCrouch.classList.toggle('active', p.crouching);
    if (this.btnView) {
      this.btnView.textContent = p.view === 'fp' ? 'FP' : 'ISO';
      this.btnView.classList.toggle('active', p.view === 'fp');
      this.btnView.title = p.view === 'fp' ? 'First-person view — click or V for isometric' : 'Isometric view — click or V for first-person';
      document.body.classList.toggle('first-person', p.view === 'fp');
    }

    const chips = [];
    if (p.bleed > 0) chips.push(`<span class="chip bad">BLEEDING ×${p.bleed}</span>`);
    if (p.hunger < 20) chips.push('<span class="chip warn">STARVING</span>');
    if (p.thirst < 20) chips.push('<span class="chip warn">DEHYDRATED</span>');
    if (p.crouching) chips.push('<span class="chip">CROUCHED</span>');
    if (p.overrun) chips.push('<span class="chip bad">OVERRUN</span>');
    if (p.weapon && p.weapon.cond <= 0) chips.push('<span class="chip bad">WEAPON BROKEN</span>');
    this.effects.innerHTML = chips.join('');

    if (p.extraction) {
      this.extractionPanel.classList.remove('hidden');
      this.extractionName.textContent = p.extraction.name.toUpperCase();
      this.extractionFill.style.width = clamp((p.extraction.progress / p.extraction.duration) * 100, 0, 100) + '%';
      this.extractionTime.textContent = p.extraction.stall > 0 ? 'INTERRUPTED' : Math.ceil(p.extraction.duration - p.extraction.progress) + 's';
    } else this.extractionPanel.classList.add('hidden');

    if (this.kills) this.kills.textContent = p.kills;
    this.last = p;
  }
  prompt(data) {
    const text = data.text || '';
    const progress = data.progress;
    this.promptRoot.classList.toggle('hidden', !text);
    this.promptText.textContent = text;
    if (progress != null) {
      this.promptBar.classList.remove('hidden');
      this.promptFill.style.width = clamp(progress * 100, 0, 100) + '%';
    } else {
      this.promptBar.classList.add('hidden');
    }
  }
}

/* ------------------------------------------------------------------ */
export class Toasts {
  constructor(root) { this.root = root; }
  show(text, tone = 'info') {
    const el = document.createElement('div');
    el.className = 'toast ' + tone;
    el.textContent = text;
    this.root.appendChild(el);
    while (this.root.children.length > 5) this.root.firstChild.remove();
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3600);
  }
  clear() { this.root.innerHTML = ''; }
}

/* ------------------------------------------------------------------ */
/* INVENTORY / LOOT SCREEN                                             */
/* ------------------------------------------------------------------ */

function canStackWith(item, other) {
  const d = ITEMS[item.id];
  return other && other.uid !== item.uid && other.id === item.id && d.stack > 1;
}

function stackSpace(inv, item) {
  const d = ITEMS[item.id];
  if (d.stack <= 1) return 0;
  let n = 0;
  for (const it of inv.items) {
    if (it.id === item.id) n += Math.max(0, d.stack - it.qty);
  }
  return n;
}

function canAccept(inv, item, x, y) {
  if (stackSpace(inv, item) >= item.qty) return true;
  if (x != null && inv.canPlace(item, x, y)) return true;
  return !!inv.findFree(item);
}

export class InventoryScreen {
  constructor(opts) {
    this.save = opts.save;
    this.mode = opts.mode || 'camp';
    this.mount = opts.mount;
    this.lootInv = opts.lootInv || null;
    this.lootContainer = opts.lootContainer || null;
    this.game = opts.game || null;
    this.onChanged = opts.onChanged || (() => {});
    this.notify = opts.notify || (() => {});
    this.onDropItem = opts.onDropItem || null;
    this.onClose = opts.onClose || null;
    this.selected = null;
    this.views = [];
    this.drag = null;
    this._viewSeq = 0;
    this.render();

    this._onPointerMove = (e) => this.dragMove(e);
    this._onPointerUp = (e) => this.dragUp(e);
  }

  inputInv() { return this.save.field; }
  storageInv() { return this.save.camp.storage; }

  render() {
    if (!this.mount) return;
    const scrollTop = this.mount.scrollTop;
    this.mount.innerHTML = '';
    this.views = [];
    const wrap = document.createElement('div');
    wrap.className = 'inv-layout ' + (this.mode === 'raid' ? 'solo' : '');

    if (this.mode === 'loot') {
      const lootCol = document.createElement('div');
      lootCol.className = 'inv-col loot-col';
      const header = this.lootHeader();
      lootCol.appendChild(header);
      const gridWrap = this.gridPanel(this.lootInv, 'LOOT', 'loot', 'loot-grid');
      lootCol.appendChild(gridWrap);
      wrap.appendChild(lootCol);
    } else if (this.mode === 'camp') {
      const storageCol = document.createElement('div');
      storageCol.className = 'inv-col';
      const head = document.createElement('div');
      head.className = 'inv-col-head';
      head.innerHTML = `<span>CAMP STORAGE</span><small>${this.storageInv().items.length}/${this.storageInv().size} SLOTS</small>`;
      storageCol.appendChild(head);
      const store = this.gridPanel(this.storageInv(), '', 'storage', 'storage-grid');
      storageCol.appendChild(store);
      wrap.appendChild(storageCol);
    }

    const right = document.createElement('div');
    right.className = 'inv-col right-col';
    const kitHead = document.createElement('div');
    kitHead.className = 'inv-col-head';
    kitHead.innerHTML = `<span>FIELD KIT</span><small>${this.inputInv().items.length}/${this.inputInv().size} SLOTS</small>`;
    right.appendChild(kitHead);
    const fieldGrid = this.gridPanel(this.inputInv(), '', 'field', 'field-grid');
    right.appendChild(fieldGrid);
    const eq = this.equipmentPanel();
    right.appendChild(eq);
    wrap.appendChild(right);

    const details = this.detailsPanel();
    wrap.appendChild(details);
    this.mount.appendChild(wrap);
    this.renderDetails();
    if (scrollTop) this.mount.scrollTop = scrollTop;
  }

  lootHeader() {
    const head = document.createElement('div');
    head.className = 'inv-col-head loot-head';
    const name = this.lootContainer ? (this.lootContainer.kind === 'corpse' ? 'CORPSE' : (this.lootContainer.kind || 'container')) : 'LOOT';
    head.innerHTML = `<span>${String(name).toUpperCase()}</span><small>${this.lootInv.items.length} ITEMS</small>`;
    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.textContent = 'TAKE ALL';
    btn.addEventListener('click', () => this.takeAll());
    head.appendChild(btn);
    return head;
  }

  gridPanel(inv, title, kind, key) {
    const holder = document.createElement('div');
    holder.className = 'grid-holder';
    if (title) {
      const t = document.createElement('div');
      t.className = 'grid-title';
      t.textContent = title;
      holder.appendChild(t);
    }
    const grid = document.createElement('div');
    grid.className = 'inv-grid';
    grid.dataset.invkey = key;
    grid.style.gridTemplateColumns = `repeat(${inv.cols}, var(--cell))`;
    grid.style.gridTemplateRows = `repeat(${inv.rows}, var(--cell))`;
    grid.style.width = `calc(var(--cell) * ${inv.cols})`;
    grid.style.height = `calc(var(--cell) * ${inv.rows})`;
    for (let i = 0; i < inv.cols * inv.rows; i++) {
      const cell = document.createElement('div');
      cell.className = 'inv-cell';
      grid.appendChild(cell);
    }
    const view = { key, inv, kind, grid };
    this.views.push(view);
    for (const item of inv.items) {
      const el = this.itemElement(item, { kind, inv, view });
      el.style.left = `calc(var(--cell) * ${item.x})`;
      el.style.top = `calc(var(--cell) * ${item.y})`;
      el.style.width = `calc(var(--cell) * ${itemW(item)})`;
      el.style.height = `calc(var(--cell) * ${itemH(item)})`;
      grid.appendChild(el);
    }
    holder.appendChild(grid);
    return holder;
  }

  itemElement(item, source) {
    const d = ITEMS[item.id];
    const el = document.createElement('div');
    el.className = 'inv-item rarity-' + d.rarity;
    el.dataset.uid = item.uid;
    if (this.selected && this.selected.item.uid === item.uid) el.classList.add('selected');
    const icon = itemIconCanvas(item.id, 28);
    el.appendChild(icon);
    if (item.qty > 1) {
      const q = document.createElement('span');
      q.className = 'item-qty';
      q.textContent = item.qty;
      el.appendChild(q);
    }
    if (item.cond != null && maxConditionFor(item.id) > 0) {
      const ratio = clamp(item.cond / maxConditionFor(item.id), 0, 1);
      const bar = document.createElement('i');
      bar.className = 'item-cond';
      const fill = document.createElement('b');
      fill.style.width = (ratio * 100) + '%';
      fill.style.background = ratio < 0.25 ? '#c25d4a' : ratio < 0.6 ? '#c7a350' : '#8caf68';
      bar.appendChild(fill);
      el.appendChild(bar);
    }
    if (d.weapon && d.weapon.kind === 'gun' && item.loaded != null) {
      const l = document.createElement('span');
      l.className = 'item-loaded';
      l.textContent = item.loaded;
      el.appendChild(l);
    }
    el.title = d.name + (item.qty > 1 ? ' ×' + item.qty : '');
    el.addEventListener('pointerdown', (e) => this.pointerDown(e, item, source));
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); this.openMenu(item, source, e.clientX, e.clientY); });
    el.addEventListener('dblclick', (e) => { e.preventDefault(); this.doubleClick(item, source); });
    return el;
  }

  equipmentPanel() {
    const eq = this.save.equipment;
    const holder = document.createElement('div');
    holder.className = 'equip-panel';
    const head = document.createElement('div');
    head.className = 'inv-col-head';
    head.innerHTML = '<span>EQUIPMENT</span><small>GEAR IS LOST ON DEATH</small>';
    holder.appendChild(head);
    const slots = document.createElement('div');
    slots.className = 'equip-slots';
    const labels = { primary: 'PRIMARY', melee: 'MELEE', armor: 'ARMOR', backpack: 'BACKPACK', utility: 'UTILITY' };
    for (const slot of ['primary', 'melee', 'armor', 'backpack', 'utility']) {
      const item = eq[slot];
      const el = document.createElement('div');
      el.className = 'equip-slot' + (item ? ' filled' : '');
      el.dataset.equipSlot = slot;
      el.innerHTML = `<span class="equip-label">${labels[slot]}</span>`;
      if (item) {
        const d = ITEMS[item.id];
        el.classList.add('rarity-' + d.rarity);
        el.appendChild(itemIconCanvas(item.id, 24));
        const nm = document.createElement('span');
        nm.className = 'equip-name';
        nm.textContent = d.name;
        el.appendChild(nm);
        el.addEventListener('pointerdown', (e) => this.pointerDown(e, item, { kind: 'equip', slot, inv: null }));
        el.addEventListener('contextmenu', (e) => { e.preventDefault(); this.openMenu(item, { kind: 'equip', slot, inv: null }, e.clientX, e.clientY); });
        el.addEventListener('dblclick', () => this.unequipToField(slot));
      } else {
        const em = document.createElement('span');
        em.className = 'equip-empty';
        em.textContent = '—';
        el.appendChild(em);
      }
      slots.appendChild(el);
    }
    holder.appendChild(slots);
    return holder;
  }

  detailsPanel() {
    const el = document.createElement('div');
    el.className = 'inv-details';
    el.id = 'inv-details';
    return el;
  }

  renderDetails() {
    const el = this.mount.querySelector('#inv-details');
    if (!el) return;
    if (!this.selected) {
      el.innerHTML = '<div class="detail-hint">SELECT AN ITEM FOR DETAILS · DRAG TO MOVE · DOUBLECLICK TO USE / EQUIP</div>';
      return;
    }
    const { item, source } = this.selected;
    const d = ITEMS[item.id];
    const rarity = RARITY[d.rarity];
    const condMax = maxConditionFor(item.id);
    el.innerHTML = '';
    const iconWrap = document.createElement('div');
    iconWrap.className = 'detail-icon';
    iconWrap.appendChild(itemIconCanvas(item.id, 44));
    el.appendChild(iconWrap);
    const info = document.createElement('div');
    info.className = 'detail-info';
    info.innerHTML = `<div class="detail-name">${d.name}${item.qty > 1 ? ' ×' + item.qty : ''}</div>
      <div class="detail-rarity" style="color:${rarity.color}">${rarity.name} · ${d.type.toUpperCase()}</div>
      <div class="detail-desc">${d.desc || ''}</div>`;
    if (condMax > 0 && item.cond != null) {
      const ratio = clamp(item.cond / condMax, 0, 1);
      info.innerHTML += `<div class="detail-stat">CONDITION <b>${Math.ceil(item.cond)}/${condMax}</b></div>
        <div class="cond-track"><i style="width:${ratio * 100}%;background:${ratio < 0.25 ? '#c25d4a' : ratio < 0.6 ? '#c7a350' : '#8caf68'}"></i></div>`;
    }
    if (d.weapon) {
      const st = weaponStats(item);
      if (st.kind === 'gun') {
        info.innerHTML += `<div class="detail-stat">DAMAGE <b>${st.damage}</b> · MAG <b>${magSize(item)}</b> · LOADED <b>${item.loaded || 0}</b></div>
          <div class="detail-stat">RANGE <b>${st.range}</b> · NOISE <b>${st.noise}</b></div>`;
      } else {
        info.innerHTML += `<div class="detail-stat">DAMAGE <b>${st.damage}</b> · REACH <b>${st.range}</b> · NOISE <b>${st.noise}</b></div>`;
      }
      if (item.mods && item.mods.length) info.innerHTML += `<div class="detail-stat">FITTED: <b>${item.mods.map(m => ITEMS[m] ? ITEMS[m].name : m).join(', ')}</b></div>`;
    }
    if (d.armor) info.innerHTML += `<div class="detail-stat">ARMOR <b>${armorValue(item)}</b> · MAX ${d.armor.value}</div>`;
    if (d.bag) info.innerHTML += `<div class="detail-stat">CAPACITY <b>+${d.bag.rows} ROW${d.bag.rows > 1 ? 'S' : ''}</b></div>`;
    if (d.effects) {
      const eff = Object.entries(d.effects).map(([k, v]) => `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`).join(' · ');
      info.innerHTML += `<div class="detail-stat">${eff}</div>`;
    }
    el.appendChild(info);
    const actions = document.createElement('div');
    actions.className = 'detail-actions';
    for (const a of this.getActions(item, source)) {
      if (!a) continue;
      const btn = document.createElement('button');
      btn.className = 'btn small' + (a.danger ? ' danger' : '');
      btn.textContent = a.label;
      btn.disabled = !!a.disabled;
      btn.addEventListener('click', () => { a.fn(); });
      actions.appendChild(btn);
    }
    el.appendChild(actions);
  }

  getActions(item, source) {
    const d = ITEMS[item.id];
    const actions = [];
    const isRaid = this.mode === 'raid' || this.mode === 'loot';
    const fromField = source.kind === 'field';
    const fromStorage = source.kind === 'storage';
    const fromLoot = source.kind === 'loot';
    const fromEquip = source.kind === 'equip';

    if (fromEquip) {
      actions.push({ label: 'UNEQUIP', fn: () => this.unequipToField(source.slot) });
    }
    if (fromLoot) {
      actions.push({ label: 'TAKE', fn: () => this.takeLootItem(item) });
    }
    if (fromField || fromStorage) {
      const slot = this.save.equipment.slotFor(item);
      if (slot) actions.push({ label: 'EQUIP', fn: () => this.equipFrom(item, source) });
      if (d.attach) actions.push({ label: 'FIT TO WEAPON', fn: () => this.attach(item, source) });
      if (isRaid && fromField && d.type === 'food') actions.push({ label: 'EAT', fn: () => this.useItem(item, source) });
      if (isRaid && fromField && d.type === 'drink') actions.push({ label: 'DRINK', fn: () => this.useItem(item, source) });
      if (isRaid && fromField && d.type === 'med') actions.push({ label: 'USE', fn: () => this.useItem(item, source) });
      if (isRaid && fromField && d.tool === 'flare') actions.push({ label: 'FIRE FLARE', fn: () => this.useItem(item, source) });
      if (isRaid && fromField) actions.push({ label: 'DROP', danger: true, fn: () => this.dropItem(item, source) });
      if (fromStorage && this.mode === 'camp') actions.push({ label: 'TO FIELD KIT', fn: () => this.moveToField(item, source) });
      if (fromField && this.mode === 'camp') actions.push({ label: 'TO STORAGE', fn: () => this.moveToStorage(item, source) });
      if (this.mode === 'camp' && item.cond != null && maxConditionFor(item.id) > 0 && item.cond < maxConditionFor(item.id)) {
        actions.push({ label: 'REPAIR', fn: () => this.repair(item) });
      }
    }
    if (d.stack > 1 && item.qty > 1) actions.push({ label: 'SPLIT', fn: () => this.split(item, source) });
    return actions;
  }

  select(item, source) {
    this.selected = { item, source };
    for (const el of this.mount.querySelectorAll('.inv-item')) {
      el.classList.toggle('selected', el.dataset.uid === item.uid);
    }
    this.renderDetails();
    audio.ui();
  }

  pointerDown(e, item, source) {
    if (e.button === 1) return;
    if (e.button === 2) return;
    const button = e.button;
    if (e.pointerType === 'touch') e.preventDefault();
    this.selected = { item, source };
    this.drag = {
      item, source, startX: e.clientX, startY: e.clientY,
      active: false, ghost: null, pointerId: e.pointerId, lastTarget: null
    };
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
  }

  dragMove(e) {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.startX, dy = e.clientY - this.drag.startY;
    if (!this.drag.active && Math.hypot(dx, dy) > 5) {
      this.drag.active = true;
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.appendChild(itemIconCanvas(this.drag.item.id, 28));
      const q = document.createElement('span');
      q.className = 'ghost-qty';
      q.textContent = this.drag.item.qty > 1 ? this.drag.item.qty : '';
      ghost.appendChild(q);
      document.body.appendChild(ghost);
      this.drag.ghost = ghost;
      audio.ui();
    }
    if (!this.drag.active) return;
    e.preventDefault();
    const g = this.drag.ghost;
    g.style.left = (e.clientX - 14) + 'px';
    g.style.top = (e.clientY - 14) + 'px';
    if (this.drag.lastTarget) this.drag.lastTarget.classList.remove('drop-target');
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el ? el.closest('.inv-grid, .equip-slot') : null;
    if (target) target.classList.add('drop-target');
    this.drag.lastTarget = target;
  }

  dragUp(e) {
    if (!this.drag) return;
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
    const drag = this.drag;
    this.drag = null;
    if (drag.ghost) drag.ghost.remove();
    if (drag.lastTarget) drag.lastTarget.classList.remove('drop-target');
    if (!drag.active) {
      this.select(drag.item, drag.source);
      this.renderDetails();
      return;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) { this.render(); return; }
    const gridEl = el.closest('.inv-grid');
    const equipEl = el.closest('.equip-slot');
    if (equipEl) {
      const slot = equipEl.dataset.equipSlot;
      if (drag.source.kind === 'equip') {
        if (drag.source.slot !== slot) this.swapEquipSlots(drag.source.slot, slot);
      } else {
        this.equipFrom(drag.item, drag.source, slot);
      }
      return;
    }
    if (gridEl) {
      const view = this.views.find(v => v.grid === gridEl);
      if (!view) { this.render(); return; }
      const rect = gridEl.getBoundingClientRect();
      const cell = rect.width / view.inv.cols;
      let x = Math.floor((e.clientX - rect.left) / cell);
      let y = Math.floor((e.clientY - rect.top) / cell);
      x = clamp(x, 0, view.inv.cols - 1);
      y = clamp(y, 0, view.inv.rows - 1);
      if (drag.source.kind === 'equip') {
        this.unequipToInventory(drag.source.slot, view.inv, x, y);
      } else {
        this.transfer(drag.item, drag.source, view, x, y);
      }
    } else {
      this.render();
    }
  }

  transfer(item, source, targetView, x, y) {
    const toInv = targetView.inv;
    if (source.inv === toInv) {
      const occupying = toInv.items.find(it => it.uid !== item.uid && x >= it.x && x < it.x + itemW(it) && y >= it.y && y < it.y + itemH(it));
      if (occupying && canStackWith(item, occupying)) {
        const space = ITEMS[occupying.id].stack - occupying.qty;
        const move = Math.min(space, item.qty);
        occupying.qty += move; item.qty -= move;
        if (item.qty <= 0) toInv.remove(item.uid);
        this.afterChange();
        return;
      }
      if (toInv.canPlace(item, x, y, item.uid)) {
        item.x = x; item.y = y;
        this.afterChange();
        return;
      }
      if (source.kind === 'loot' && !toInv.canPlace(item, x, y)) { this.notify('No room there.', 'warn'); }
      this.render();
      return;
    }
    if (!canAccept(toInv, item, x, y)) { this.notify('Not enough space.', 'warn'); this.render(); return; }
    source.inv.remove(item.uid);
    const left = toInv.add(item, x, y);
    if (left > 0) {
      source.inv.add(item);
      this.notify('Not enough space.', 'warn');
    } else if (source.kind === 'loot') {
      audio.pickup();
      this.notify(ITEMS[item.id].name + ' taken.', 'good');
    }
    this.afterChange();
  }

  equipFrom(item, source, forcedSlot = null) {
    const eq = this.save.equipment;
    const slot = forcedSlot || eq.slotFor(item);
    if (!slot || !eq.accepts(slot, item)) { this.notify('That cannot go in that slot.', 'warn'); return; }
    const old = eq[slot];
    const field = this.inputInv();
    const isFieldSource = source.inv === field;

    if (slot === 'backpack') {
      const newRows = PLAYER_BASE.rows + bagRows(item);
      const overflow = field.items.filter(it => it.uid !== item.uid && it.y + itemH(it) > newRows);
      if (overflow.length) {
        this.notify('Clear the bottom rows before swapping to a smaller pack.', 'warn');
        this.render();
        return;
      }
    }
    source.inv.remove(item.uid);
    if (old) {
      const left = source.inv.add(old);
      if (left > 0) {
        source.inv.add(item);
        if (isFieldSource) eq[slot] = old;
        this.notify('No room to stow the old equipment.', 'warn');
        this.render();
        return;
      }
    }
    eq[slot] = item;
    if (slot === 'backpack') {
      field.resize(PLAYER_BASE.cols, fieldRows(eq));
    }
    audio.pickup();
    this.notify(ITEMS[item.id].name + ' equipped.', 'good');
    if (this.game) this.game.refreshGear();
    this.selected = null;
    this.afterChange();
  }

  swapEquipSlots(fromSlot, toSlot) {
    if (fromSlot === toSlot) { this.render(); return; }
    const eq = this.save.equipment;
    const a = eq[fromSlot];
    if (!a) { this.render(); return; }
    if (!eq.accepts(toSlot, a)) { this.notify('Incompatible equipment slot.', 'warn'); return; }
    /* swapping backpack sizes must be validated */
    if (fromSlot === 'backpack' || toSlot === 'backpack') {
      const newPack = toSlot === 'backpack' ? a : eq[toSlot];
      const rows = PLAYER_BASE.rows + bagRows(newPack);
      const field = this.inputInv();
      if (field.items.some(it => it.y + itemH(it) > rows)) {
        this.notify('Clear the bottom rows before swapping backpacks.', 'warn');
        this.render();
        return;
      }
      eq[fromSlot] = null;
      eq[toSlot] = a;
      field.resize(PLAYER_BASE.cols, rows);
    } else {
      eq[fromSlot] = eq[toSlot];
      eq[toSlot] = a;
    }
    if (this.game) this.game.refreshGear();
    this.afterChange();
  }

  unequipToField(slot) {
    this.unequipToInventory(slot, this.inputInv());
  }

  unequipToInventory(slot, toInv, x = null, y = null) {
    const eq = this.save.equipment;
    const item = eq[slot];
    if (!item) { this.render(); return; }
    const field = this.inputInv();
    if (slot === 'backpack') {
      const newRows = PLAYER_BASE.rows;
      const overflow = field.items.filter(it => it.y + itemH(it) > newRows);
      if (overflow.length) { this.notify('Clear the bottom rows before removing your pack.', 'warn'); this.render(); return; }
    }
    const target = toInv;
    if (!canAccept(target, item, x, y)) { this.notify('No room to unequip that.', 'warn'); this.render(); return; }
    eq[slot] = null;
    if (slot === 'backpack') field.resize(PLAYER_BASE.cols, fieldRows(eq));
    const left = target.add(item, x, y);
    if (left > 0) {
      eq[slot] = item;
      if (slot === 'backpack') field.resize(PLAYER_BASE.cols, fieldRows(eq));
      this.notify('No room to unequip that.', 'warn');
      this.render();
      return;
    }
    audio.pickup();
    this.notify(ITEMS[item.id].name + ' unequipped.', 'info');
    if (this.game) this.game.refreshGear();
    this.selected = null;
    this.afterChange();
  }

  moveToField(item, source) {
    const field = this.inputInv();
    if (!canAccept(field, item, null, null)) { this.notify('Field kit is full.', 'warn'); return; }
    source.inv.remove(item.uid);
    const left = field.add(item);
    if (left > 0) source.inv.add(item);
    this.afterChange();
  }
  moveToStorage(item, source) {
    const storage = this.storageInv();
    if (!canAccept(storage, item, null, null)) { this.notify('Camp storage is full.', 'warn'); return; }
    source.inv.remove(item.uid);
    const left = storage.add(item);
    if (left > 0) source.inv.add(item);
    this.afterChange();
  }

  takeLootItem(item) {
    const field = this.inputInv();
    if (!canAccept(field, item, null, null)) { this.notify('Field kit is full.', 'warn'); return; }
    this.lootInv.remove(item.uid);
    const left = field.add(item);
    if (left > 0) this.lootInv.add(item);
    else { audio.pickup(); this.notify(ITEMS[item.id].name + ' taken.', 'good'); }
    this.afterChange();
  }

  takeAll() {
    if (!this.lootInv) return;
    const items = this.lootInv.items.slice();
    let taken = 0;
    for (const item of items) {
      const field = this.inputInv();
      if (!canAccept(field, item, null, null)) continue;
      this.lootInv.remove(item.uid);
      const left = field.add(item);
      if (left > 0) this.lootInv.add(item);
      else taken++;
    }
    if (taken) { audio.pickup(); this.notify(taken + ' item' + (taken > 1 ? 's' : '') + ' taken.', 'good'); }
    else this.notify('Field kit is full.', 'warn');
    this.afterChange();
  }

  useItem(item, source) {
    if (!this.game) {
      if (ITEMS[item.id].attach) return this.attach(item, source);
      this.notify('Consumables are used during expeditions.', 'info');
      return;
    }
    const ok = this.game.useFieldItem(item);
    if (ok) this.afterChange();
    else this.render();
  }

  attach(item, source) {
    const primary = this.save.equipment.primary;
    if (!primary || !ITEMS[primary.id].weapon || ITEMS[primary.id].weapon.kind !== 'gun') {
      this.notify('Equip a firearm first.', 'warn'); return;
    }
    const d = ITEMS[item.id];
    primary.mods = primary.mods || [];
    if (primary.mods.includes(d.attach)) { this.notify('Already fitted.', 'info'); return; }
    primary.mods.push(d.attach);
    source.inv.remove(item.uid);
    audio.craft();
    this.notify(d.name + ' fitted to ' + ITEMS[primary.id].name + '.', 'good');
    if (this.game) this.game.refreshGear();
    this.selected = null;
    this.afterChange();
  }

  repair(item) {
    if (this.mode !== 'camp') return;
    const storage = this.storageInv();
    const max = maxConditionFor(item.id);
    if (!max || item.cond >= max) { this.notify('Nothing to repair.', 'info'); return; }
    let used = '';
    if (storage.count('repairkit') > 0) {
      storage.consume('repairkit', 1); used = 'Repair Kit';
    } else if (storage.count('scrap') >= 2 && storage.count('components') >= 1) {
      storage.consume('scrap', 2); storage.consume('components', 1); used = '2 Scrap + 1 Component';
    } else {
      this.notify('Repair needs a Repair Kit, or 2 Scrap + 1 Component.', 'warn'); return;
    }
    item.cond = max;
    if (item._brokenShown) item._brokenShown = false;
    audio.craft();
    this.notify(ITEMS[item.id].name + ' repaired using ' + used + '.', 'good');
    this.afterChange();
  }

  split(item, source) {
    const d = ITEMS[item.id];
    if (!d.stack || d.stack <= 1 || item.qty < 2) return;
    const half = Math.floor(item.qty / 2);
    const newItem = createItem(item.id, { qty: half });
    if (!source.inv.findFree(newItem)) { this.notify('No free slot to split.', 'warn'); return; }
    item.qty -= half;
    source.inv.add(newItem);
    this.afterChange();
  }

  dropItem(item, source) {
    if (this.onDropItem) {
      this.onDropItem(item, source);
      this.selected = null;
      this.afterChange();
    } else {
      this.notify('You cannot drop that here.', 'warn');
    }
  }

  doubleClick(item, source) {
    if (source.kind === 'loot') { this.takeLootItem(item); return; }
    if (source.kind === 'equip') { this.unequipToField(source.slot); return; }
    const d = ITEMS[item.id];
    const equipSlot = this.save.equipment.slotFor(item);
    if (equipSlot) { this.equipFrom(item, source); return; }
    if (this.mode === 'camp') {
      if (source.kind === 'storage') this.moveToField(item, source);
      else this.moveToStorage(item, source);
      return;
    }
    this.useItem(item, source);
  }

  openMenu(item, source, sx, sy) {
    document.querySelectorAll('.item-menu').forEach(e => e.remove());
    const actions = this.getActions(item, source);
    if (!actions.length) return;
    const menu = document.createElement('div');
    menu.className = 'item-menu';
    menu.style.left = Math.min(window.innerWidth - 170, sx) + 'px';
    menu.style.top = Math.min(window.innerHeight - 30 - actions.length * 30, sy) + 'px';
    for (const a of actions) {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.disabled = !!a.disabled;
      b.addEventListener('click', (e) => { e.stopPropagation(); menu.remove(); a.fn(); });
      menu.appendChild(b);
    }
    document.body.appendChild(menu);
    setTimeout(() => {
      const close = (e) => {
        if (menu.contains(e.target)) return;
        menu.remove();
        window.removeEventListener('pointerdown', close);
      };
      window.addEventListener('pointerdown', close);
    }, 10);
  }

  afterChange() {
    if (this.game) {
      const target = fieldRows(this.save.equipment);
      if (this.save.field.rows !== target) this.save.field.resize(PLAYER_BASE.cols, target);
    }
    this.onChanged();
    this.render();
  }
}
