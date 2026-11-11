/* DEAD ZONE — permanent camp, crafting, building, deployment */

import { BUILDINGS, RECIPES, ITEMS, ZONES, ZONE_ORDER, PLAYER_BASE, baseStorage } from './data.js';
import {
  Inventory, createItem, fieldRows, bagRows
} from './inventory.js';
import {
  xpToNext, storageRows, campDefense, saveGame, quickLoadout,
  maxHealth, maxStamina
} from './save.js';
import { InventoryScreen, itemIconCanvas } from './ui.js';
import { audio } from './audio.js';
import { clamp, fmtTime } from './util.js';

const TABS = ['overview', 'storage', 'craft', 'build', 'raid'];

export class CampUI {
  constructor(save, callbacks) {
    this.save = save;
    this.callbacks = callbacks || {};
    this.screen = document.getElementById('screen-camp');
    this.active = 'overview';
    this.invScreen = null;
    this.campCanvas = document.getElementById('camp-canvas');
    this.campCtx = this.campCanvas.getContext('2d');
    this.campCanvas.width = 480;
    this.campCanvas.height = 270;
    this.campCtx.imageSmoothingEnabled = false;
    this.visible = false;
    this.raf = null;
    this.time = 0;
    this.last = performance.now();
    this.bind();
  }

  bind() {
    for (const tab of TABS) {
      const btn = document.getElementById('tab-' + tab);
      if (btn) btn.addEventListener('click', () => this.setTab(tab));
    }
    const quick = document.getElementById('btn-quick-loadout');
    if (quick) quick.addEventListener('click', () => this.doQuickLoadout());
    const sound = document.getElementById('camp-sound');
    if (sound) sound.addEventListener('click', () => this.toggleSound());
    const mapHelp = document.getElementById('camp-help');
    if (mapHelp) mapHelp.addEventListener('click', () => this.callbacks.onHelp && this.callbacks.onHelp());
    const toRaid = document.getElementById('camp-to-raid');
    if (toRaid) toRaid.addEventListener('click', () => this.setTab('raid'));
  }

  show() {
    this.visible = true;
    this.screen.classList.remove('hidden');
    this.refresh();
    this.startLoop();
  }
  hide() {
    this.visible = false;
    this.screen.classList.add('hidden');
    this.stopLoop();
  }

  syncLoop() {
    if (this.visible && this.active === 'overview' && !document.hidden) this.startLoop();
    else this.stopLoop();
  }

  startLoop() {
    this.stopLoop();
    if (!this.visible || this.active !== 'overview' || document.hidden) return;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.visible || this.active !== 'overview' || document.hidden) {
        this.raf = null;
        return;
      }
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      this.drawCamp();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stopLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  setTab(tab) {
    if (!TABS.includes(tab)) return;
    this.active = tab;
    for (const t of TABS) {
      const btn = document.getElementById('tab-' + t);
      if (btn) btn.classList.toggle('active', t === tab);
      const panel = document.getElementById('panel-' + t);
      if (panel) panel.classList.toggle('hidden', t !== tab);
    }
    this.renderTab();
    this.syncLoop();
    audio.ui();
  }

  refresh() {
    this.renderHeader();
    this.renderTab();
    this.updateSoundBtn();
  }

  refreshHeader() {
    this.renderHeader();
    this.updateSoundBtn();
  }

  renderHeader() {
    const s = this.save;
    const day = document.getElementById('camp-day');
    if (day) day.textContent = s.day;
    const lvl = document.getElementById('camp-level');
    if (lvl) lvl.textContent = s.player.level;
    const xp = document.getElementById('camp-xp');
    if (xp) xp.style.width = clamp((s.player.xp / xpToNext(s.player.level)) * 100, 0, 100) + '%';
    const xpt = document.getElementById('camp-xp-text');
    if (xpt) xpt.textContent = s.player.xp + ' / ' + xpToNext(s.player.level) + ' XP';
    const res = document.getElementById('camp-resources');
    if (res) {
      res.innerHTML = '';
      for (const id of ['wood', 'scrap', 'fabric', 'components', 'chemicals', 'fuel']) {
        const n = s.camp.storage.count(id);
        const chip = document.createElement('div');
        chip.className = 'res-chip';
        chip.appendChild(itemIconCanvas(id, 18));
        const span = document.createElement('span');
        span.textContent = n;
        chip.appendChild(span);
        chip.title = ITEMS[id].name;
        res.appendChild(chip);
      }
    }
    const defense = campDefense(s);
    const atk = document.getElementById('camp-defense');
    if (atk) atk.textContent = defense;
    const threat = document.getElementById('camp-threat');
    if (threat) {
      const risk = Math.max(0, s.day * 2 + 4 - defense);
      threat.textContent = risk <= 0 ? 'SECURE' : risk < 8 ? 'LOW' : risk < 18 ? 'MODERATE' : 'HIGH';
      threat.className = 'threat ' + (risk <= 0 ? 'good' : risk < 18 ? 'warn' : 'bad');
    }
    const cap = document.getElementById('camp-cap');
    if (cap) cap.textContent = s.camp.storage.items.length + '/' + s.camp.storage.size;
  }

  renderTab() {
    if (this.active === 'overview') this.renderOverview();
    else if (this.active === 'storage') this.renderStorage();
    else if (this.active === 'craft') this.renderCraft();
    else if (this.active === 'build') this.renderBuild();
    else if (this.active === 'raid') this.renderRaid();
    this.renderHeader();
  }

  renderOverview() {
    const panel = document.getElementById('panel-overview');
    if (!panel) return;
    const b = this.save.camp.buildings;
    const facilities = [
      ['workbench', 'Workbench', b.workbench ? 'TIER ' + b.workbench : 'NOT BUILT', b.workbench ? 'good' : 'dim'],
      ['crate', 'Storage', storageRows(this.save) + ' rows', 'good'],
      ['garden', 'Garden', b.garden ? 'LVL ' + b.garden + ' · +' + (1 + b.garden) + ' food/return' : 'NOT BUILT', b.garden ? 'good' : 'dim'],
      ['collector', 'Rain Collector', b.collector ? 'LVL ' + b.collector + ' · +' + (1 + b.collector) + ' water/return' : 'NOT BUILT', b.collector ? 'good' : 'dim'],
      ['generator', 'Generator', b.generator ? 'ONLINE' : 'NOT BUILT', b.generator ? 'good' : 'dim'],
      ['tower', 'Radio Tower', b.tower ? 'EXTRACTION DECODED' : 'NOT BUILT', b.tower ? 'good' : 'dim'],
      ['campfire', 'Campfire', b.campfire ? 'LIT' : 'NOT BUILT', b.campfire ? 'good' : 'dim'],
      ['bed', 'Bedroll', b.bed ? '+15 MAX HP' : 'NOT BUILT', b.bed ? 'good' : 'dim'],
      ['wall', 'Walls', (b.wall || 0) + ' sections · +' + (b.wall || 0) * 2 + ' DEF', b.wall ? 'good' : 'dim'],
      ['barricade', 'Barricades', (b.barricade || 0) + ' built · +' + (b.barricade || 0) * 3 + ' DEF', b.barricade ? 'good' : 'dim']
    ];
    const list = document.getElementById('camp-facilities');
    if (list) {
      list.innerHTML = '';
      for (const [key, name, val, tone] of facilities) {
        const row = document.createElement('div');
        row.className = 'facility-row';
        row.innerHTML = `<span class="fac-name">${name}</span><span class="fac-val ${tone}">${val}</span>`;
        list.appendChild(row);
      }
    }
    const stats = document.getElementById('camp-bonuses');
    if (stats) {
      stats.innerHTML = `
        <div><b>${maxHealth(this.save)}</b><span>MAX HP</span></div>
        <div><b>${maxStamina(this.save)}</b><span>MAX STAMINA</span></div>
        <div><b>${this.save.player.level}</b><span>LEVEL</span></div>
        <div><b>${this.save.player.totalKills}</b><span>TOTAL KILLS</span></div>
        <div><b>${this.save.player.extracted}</b><span>EXTRACTIONS</span></div>
        <div><b>${this.save.player.deaths}</b><span>DEATHS</span></div>`;
    }
    const field = document.getElementById('camp-field-summary');
    if (field) {
      const p = this.save.equipment.primary;
      const m = this.save.equipment.melee;
      field.innerHTML = `KIT: <b>${this.save.field.items.length}/${this.save.field.size}</b> items ·
        <b>${p ? ITEMS[p.id].name : 'NO FIREARM'}</b> · <b>${m ? ITEMS[m.id].name : 'NO MELEE'}</b>`;
    }
  }

  renderStorage() {
    const panel = document.getElementById('panel-storage');
    if (!panel) return;
    if (!this.invScreen) {
      panel.innerHTML = '<div id="camp-storage-content" class="camp-storage-content"></div>';
      const mount = panel.querySelector('#camp-storage-content');
      this.invScreen = new InventoryScreen({
        save: this.save, mode: 'camp', mount,
        notify: (t, tone) => this.callbacks.notify(t, tone),
        onChanged: () => {
          saveGame(this.save);
          this.renderHeader();
          if (this.game) this.game.refreshGear();
          this.callbacks.onSave && this.callbacks.onSave();
          this.renderOverview();
        }
      });
    } else {
      this.invScreen.save = this.save;
      this.invScreen.render();
    }
  }

  canAfford(cost) {
    for (const id in cost) if (this.save.camp.storage.count(id) < cost[id]) return false;
    return true;
  }

  costHtml(cost) {
    return Object.entries(cost).map(([id, n]) => {
      const have = this.save.camp.storage.count(id);
      const ok = have >= n;
      return `<span class="cost-chip ${ok ? 'ok' : 'no'}" title="${ITEMS[id].name}: ${have}/${n}">
        ${ITEMS[id].name} <b>${have}/${n}</b></span>`;
    }).join('');
  }

  recipeAvailable(r) {
    const wb = this.save.camp.buildings.workbench || 0;
    if (r.tier > wb) return { ok: false, why: 'WORKBENCH TIER ' + r.tier };
    if (r.power && !this.save.camp.buildings.generator) return { ok: false, why: 'GENERATOR REQUIRED' };
    if (r.power && this.save.camp.storage.count('fuel') < 1) return { ok: false, why: 'NEEDS FUEL' };
    if (r.fire && !this.save.camp.buildings.campfire) return { ok: false, why: 'CAMPFIRE REQUIRED' };
    if (!this.canAfford(r.cost)) return { ok: false, why: 'MISSING MATERIALS' };
    return { ok: true };
  }

  canFitOutput(id, qty) {
    const inv = this.save.camp.storage;
    const def = ITEMS[id];
    if (def.stack > 1) {
      let space = 0;
      for (const it of inv.items) if (it.id === id) space += def.stack - it.qty;
      if (space >= qty) return true;
      qty -= space;
    }
    const sample = createItem(id, { qty: Math.min(qty, def.stack) });
    return !!inv.findFree(sample);
  }

  renderCraft() {
    const panel = document.getElementById('panel-craft');
    if (!panel) return;
    const wb = this.save.camp.buildings.workbench || 0;
    panel.innerHTML = `<div class="panel-bar"><span>WORKBENCH TIER <b>${wb}</b></span><span>${wb === 0 ? 'BUILD A WORKBENCH IN THE BUILD TAB TO UNLOCK ADVANCED RECIPES' : 'MORE TIERS UNLOCK BETTER GEAR'}</span></div>
      <div class="card-grid" id="craft-cards"></div>`;
    const cards = panel.querySelector('#craft-cards');
    for (const r of RECIPES) {
      const av = this.recipeAvailable(r);
      const outDef = ITEMS[r.out[0]];
      const card = document.createElement('div');
      card.className = 'craft-card' + (av.ok ? '' : ' locked');
      const icon = itemIconCanvas(r.out[0], 38);
      const title = document.createElement('div');
      title.className = 'craft-title';
      title.innerHTML = `<span>${outDef.name}${r.out[1] > 1 ? ' ×' + r.out[1] : ''}</span><small>TIER ${r.tier}${r.power ? ' · POWER' : ''}${r.fire ? ' · FIRE' : ''}</small>`;
      const body = document.createElement('div');
      body.className = 'craft-body';
      body.appendChild(icon);
      const costs = document.createElement('div');
      costs.className = 'craft-costs';
      costs.innerHTML = this.costHtml(r.cost);
      body.appendChild(costs);
      card.appendChild(title);
      card.appendChild(body);
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.textContent = av.ok ? 'CRAFT' : av.why;
      btn.disabled = !av.ok;
      btn.addEventListener('click', () => this.craft(r));
      card.appendChild(btn);
      cards.appendChild(card);
    }
  }

  craft(r) {
    const av = this.recipeAvailable(r);
    if (!av.ok) { this.callbacks.notify(av.why, 'warn'); return; }
    if (!this.canFitOutput(r.out[0], r.out[1])) {
      this.callbacks.notify('Camp storage is full. Make room first.', 'warn');
      return;
    }
    for (const id in r.cost) this.save.camp.storage.consume(id, r.cost[id]);
    if (r.power) this.save.camp.storage.consume('fuel', 1);
    const left = this.save.camp.storage.addStack(r.out[0], r.out[1]);
    if (left > 0) {
      for (const id in r.cost) this.save.camp.storage.addStack(id, r.cost[id]);
      if (r.power) this.save.camp.storage.addStack('fuel', 1);
      this.callbacks.notify('Camp storage full — crafting cancelled.', 'warn');
      return;
    }
    audio.craft();
    this.callbacks.notify('Crafted ' + ITEMS[r.out[0]].name + (r.out[1] > 1 ? ' ×' + r.out[1] : '') + '.', 'good');
    saveGame(this.save);
    this.renderCraft();
    this.renderHeader();
  }

  renderBuild() {
    const panel = document.getElementById('panel-build');
    if (!panel) return;
    panel.innerHTML = `<div class="panel-bar"><span>CAMP DEFENSE <b>${campDefense(this.save)}</b></span><span>WALLS AND BARRICADES REDUCE THE CHANCE OF NIGHT RAID THEFT</span></div>
      <div class="card-grid build-grid" id="build-cards"></div>`;
    const cards = panel.querySelector('#build-cards');
    for (const [key, def] of Object.entries(BUILDINGS)) {
      const level = this.save.camp.buildings[key] || 0;
      const max = def.max;
      const next = level < max ? def.levels[level] : null;
      const card = document.createElement('div');
      card.className = 'build-card' + (level >= max ? ' maxed' : '');
      const pips = Array.from({ length: max }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('');
      card.innerHTML = `<div class="build-top"><span class="build-name">${def.name}</span><span class="build-pips">${pips}</span></div>
        <div class="build-desc">${def.desc}</div>
        <div class="build-level">${level >= max ? 'MAXIMUM LEVEL' : 'LEVEL ' + level + ' → ' + (level + 1)}</div>`;
      const costRow = document.createElement('div');
      costRow.className = 'build-costs';
      if (next) costRow.innerHTML = this.costHtml(next.cost);
      card.appendChild(costRow);
      const btn = document.createElement('button');
      btn.className = 'btn small';
      if (!next) { btn.textContent = 'MAXED'; btn.disabled = true; }
      else {
        btn.textContent = next.label.toUpperCase();
        btn.disabled = !this.canAfford(next.cost);
        btn.addEventListener('click', () => this.build(key));
      }
      card.appendChild(btn);
      cards.appendChild(card);
    }
  }

  build(key) {
    const def = BUILDINGS[key];
    const level = this.save.camp.buildings[key] || 0;
    if (level >= def.max) return;
    const next = def.levels[level];
    if (!this.canAfford(next.cost)) { this.callbacks.notify('Not enough materials.', 'warn'); return; }
    this.save.camp.storage.consumeAll(next.cost);
    this.save.camp.buildings[key] = level + 1;
    if (key === 'crate') {
      this.save.camp.storage.resize(baseStorage.cols, storageRows(this.save));
    }
    audio.build();
    this.callbacks.notify(def.name + ' ' + (level === 0 ? 'built' : 'upgraded') + '.', 'good');
    saveGame(this.save);
    this.renderBuild();
    this.renderHeader();
    this.renderOverview();
  }

  renderRaid() {
    const panel = document.getElementById('panel-raid');
    if (!panel) return;
    const p = this.save.player;
    const primary = this.save.equipment.primary;
    const melee = this.save.equipment.melee;
    panel.innerHTML = `<div class="panel-bar"><span>EXPEDITION SELECT</span><span>FIELD KIT: ${this.save.field.items.length}/${this.save.field.size} · ${primary ? ITEMS[primary.id].name.toUpperCase() : 'NO FIREARM'}${melee ? ' · ' + ITEMS[melee.id].name.toUpperCase() : ''}</span></div>
      <div class="raid-grid" id="raid-cards"></div>`;
    const cards = panel.querySelector('#raid-cards');
    for (const id of ZONE_ORDER) {
      const zone = ZONES[id];
      const unlocked = p.level >= zone.level;
      const card = document.createElement('div');
      card.className = 'raid-card' + (unlocked ? '' : ' locked');
      card.style.setProperty('--zone-color', zone.color);
      card.innerHTML = `
        <div class="raid-band"></div>
        <div class="raid-top"><span class="raid-name">${zone.name}</span><span class="raid-diff">${'☠'.repeat(zone.difficulty)}</span></div>
        <div class="raid-desc">${zone.desc}</div>
        <div class="raid-meta">
          <span>RAID ${fmtTime(zone.raidTime)}</span>
          <span>${zone.extractCount} EXTRACTS</span>
          <span>${zone.zombies}+ INFECTED</span>
        </div>
        <div class="raid-threats">${zone.threats}</div>`;
      const btn = document.createElement('button');
      btn.className = 'btn deploy-btn';
      if (!unlocked) {
        btn.textContent = `LOCKED — LEVEL ${zone.level} REQUIRED`;
        btn.disabled = true;
      } else {
        btn.textContent = 'DEPLOY';
        btn.addEventListener('click', () => {
          if (!this.save.equipment.primary && !this.save.equipment.melee) {
            this.callbacks.notify('Equip a weapon before deploying.', 'bad');
            return;
          }
          this.callbacks.onDeploy(id);
        });
      }
      card.appendChild(btn);
      cards.appendChild(card);
    }
  }

  doQuickLoadout() {
    const msgs = quickLoadout(this.save);
    saveGame(this.save);
    if (this.invScreen) { this.invScreen.selected = null; this.invScreen.render(); }
    audio.pickup();
    if (msgs.length) this.callbacks.notify('Quick loadout: ' + msgs.slice(0, 4).join(' · '), 'good');
    else this.callbacks.notify('Nothing suitable in camp storage.', 'warn');
    this.refresh();
  }

  toggleSound() {
    this.save.settings.sound = !this.save.settings.sound;
    audio.setEnabled(this.save.settings.sound);
    if (this.save.settings.sound) audio.init();
    this.updateSoundBtn();
    saveGame(this.save);
    audio.ui();
  }
  updateSoundBtn() {
    const btn = document.getElementById('camp-sound');
    if (btn) btn.textContent = this.save.settings.sound ? '♪ SOUND ON' : '♪ SOUND OFF';
  }

  drawCamp() {
    const ctx = this.campCtx;
    const W = 480, H = 270;
    ctx.save();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    const w = W / 2, h = H / 2;
    const t = this.time;
    const b = this.save.camp.buildings;
    /* ground */
    ctx.fillStyle = '#1b2117';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = (i * 37 % w), y = (i * 61 % h);
      ctx.fillStyle = i % 3 ? '#20281a' : '#242d1d';
      ctx.fillRect(x, y, 2 + (i % 4), 1 + (i % 2));
    }
    ctx.fillStyle = '#2b281b';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2 + 8, 82, 54, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#332e1d';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2 + 8, 68, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    /* perimeter walls */
    if (b.wall > 0) {
      ctx.fillStyle = '#5a4229';
      const count = Math.min(12, b.wall);
      for (let i = 0; i < count; i++) {
        const side = i % 2;
        if (side === 0) {
          ctx.fillRect(50 + i * 13, 84, 12, 4);
          ctx.fillRect(50 + i * 13, 182, 12, 4);
        } else {
          ctx.fillRect(28, 98 + (i - 1) * 12, 4, 11);
          ctx.fillRect(208, 98 + (i - 1) * 12, 4, 11);
        }
      }
    }
    if (b.barricade > 0) {
      ctx.fillStyle = '#6d5c37';
      for (let i = 0; i < Math.min(8, b.barricade); i++) {
        ctx.fillRect(38 + i * 17, 198, 12, 3);
        ctx.fillRect(40 + i * 17, 194, 2, 9);
      }
    }
    /* trees */
    drawPine(ctx, 14, 72, 1.4); drawPine(ctx, 222, 66, 1.2); drawPine(ctx, 18, 146, 1.1);
    drawPine(ctx, 226, 156, 1.5); drawPine(ctx, 100, 18, 0.9); drawPine(ctx, 168, 22, 1.0);
    /* tent always */
    drawTent(ctx, 44, 38, 38, 25);
    /* bedroll */
    if (b.bed) {
      ctx.fillStyle = '#4b553c'; ctx.fillRect(92, 52, 20, 9);
      ctx.fillStyle = '#c8c0a0'; ctx.fillRect(93, 54, 5, 5);
      ctx.fillStyle = '#3f4b34'; ctx.fillRect(97, 52, 15, 9);
    }
    /* workbench */
    if (b.workbench) {
      ctx.fillStyle = '#4a3422'; ctx.fillRect(154, 38, 28, 10);
      ctx.fillStyle = '#76533a'; ctx.fillRect(154, 36, 28, 4);
      ctx.fillStyle = '#3b3f3a'; ctx.fillRect(158, 28, 6, 8); ctx.fillRect(172, 29, 5, 7);
      ctx.fillStyle = '#8f9389'; ctx.fillRect(159, 26, 4, 3);
      if (b.workbench >= 2) { ctx.fillStyle = '#b08a4d'; ctx.fillRect(166, 26, 5, 3); }
      if (b.workbench >= 3) { ctx.fillStyle = '#5f6a4f'; ctx.fillRect(176, 26, 4, 4); }
    }
    /* crates */
    const crates = Math.min(4, b.crate || 0);
    for (let i = 0; i < crates; i++) {
      const cx = 194 + (i % 2) * 13, cy = 59 + Math.floor(i / 2) * 12;
      ctx.fillStyle = '#7d5c39'; ctx.fillRect(cx, cy, 11, 10);
      ctx.fillStyle = '#a17c4e'; ctx.fillRect(cx, cy, 11, 2);
      ctx.fillStyle = '#4c3721'; ctx.fillRect(cx + 2, cy + 4, 7, 1);
    }
    /* garden */
    if (b.garden) {
      for (let g = 0; g < b.garden; g++) {
        ctx.fillStyle = '#433521'; ctx.fillRect(45 + g * 22, 96, 18, 22);
        ctx.fillStyle = '#34291b'; ctx.fillRect(47 + g * 22, 98, 14, 18);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = '#5a743c';
          ctx.fillRect(49 + g * 22, 101 + i * 5, 2, 3);
          ctx.fillRect(55 + g * 22, 101 + i * 5, 2, 3);
          ctx.fillStyle = '#7d9445';
          ctx.fillRect(49 + g * 22, 100 + i * 5, 1, 1);
        }
      }
    }
    /* collector */
    if (b.collector) {
      ctx.fillStyle = '#4a5550'; ctx.fillRect(150, 98, 20, 14);
      ctx.fillStyle = '#76837b'; ctx.fillRect(152, 100, 16, 4);
      ctx.fillStyle = '#4f7c86'; ctx.fillRect(153, 106, 14, 4);
      ctx.fillStyle = '#6a5540'; ctx.fillRect(155, 92, 10, 3);
      ctx.fillStyle = '#874433'; ctx.fillRect(156, 83, 8, 9);
    }
    /* generator */
    if (b.generator) {
      ctx.fillStyle = '#5a6147'; ctx.fillRect(184, 112, 20, 13);
      ctx.fillStyle = '#3c4234'; ctx.fillRect(186, 114, 16, 9);
      ctx.fillStyle = '#c0a24c'; ctx.fillRect(188, 116, 3, 5);
      ctx.fillStyle = '#2f2d24'; ctx.fillRect(194, 115, 6, 6);
      const flick = Math.sin(t * 9) > 0.2;
      if (flick) { ctx.fillStyle = '#d7c46f'; ctx.fillRect(197, 117, 2, 2); }
    }
    /* radio tower */
    if (b.tower) {
      ctx.strokeStyle = '#7b8071';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(206, 40); ctx.lineTo(198, 16); ctx.moveTo(206, 40); ctx.lineTo(214, 16);
      ctx.moveTo(200, 31); ctx.lineTo(212, 31); ctx.moveTo(201, 25); ctx.lineTo(211, 25);
      ctx.stroke();
      const blink = Math.sin(t * 3) > 0.4;
      if (blink) { ctx.fillStyle = '#d85e49'; ctx.fillRect(204, 13, 4, 4); }
    }
    /* campfire */
    drawFire(ctx, w / 2, h / 2 + 10, t, b.campfire);
    /* player silhouette by fire */
    drawCamper(ctx, w / 2 - 26, h / 2 + 22, t);
    /* warm glow */
    const glow = ctx.createRadialGradient(w / 2, h / 2 + 10, 2, w / 2, h / 2 + 10, 34 + Math.sin(t * 7) * 2);
    glow.addColorStop(0, 'rgba(240,160,70,0.22)');
    glow.addColorStop(0.5, 'rgba(210,120,50,0.08)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    /* dusk vignette */
    ctx.fillStyle = 'rgba(6,10,9,0.16)';
    ctx.fillRect(0, 0, w, h);
    const vg = ctx.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, 140);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(3,6,5,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

function drawPine(ctx, x, y, s) {
  ctx.fillStyle = '#1e2a1c';
  ctx.fillRect(x - 1, y, 2, 14 * s);
  ctx.fillStyle = '#22331d';
  ctx.beginPath();
  ctx.moveTo(x, y - 26 * s); ctx.lineTo(x - 10 * s, y + 2); ctx.lineTo(x + 10 * s, y + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a3c23';
  ctx.beginPath();
  ctx.moveTo(x, y - 32 * s); ctx.lineTo(x - 7 * s, y - 8 * s); ctx.lineTo(x + 7 * s, y - 8 * s); ctx.closePath(); ctx.fill();
}
function drawTent(ctx, x, y, w, h) {
  ctx.fillStyle = '#4a513d';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5b634a';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w * 0.72, y + h); ctx.lineTo(x + w * 0.42, y + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#22291e';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 7); ctx.lineTo(x + w * 0.63, y + h); ctx.lineTo(x + w * 0.37, y + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6b7055';
  ctx.fillRect(x + w / 2 - 1, y, 2, 4);
}
function drawFire(ctx, x, y, t, big) {
  ctx.fillStyle = '#2b2418';
  ctx.beginPath(); ctx.ellipse(x, y + 6, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = i * 1.7;
    ctx.fillStyle = i % 2 ? '#6b5e4a' : '#55503e';
    ctx.fillRect(x + Math.cos(a) * 7 - 2, y + 3 + Math.sin(a) * 3, 4, 3);
  }
  const h = (big ? 15 : 10) + Math.sin(t * 13) * 2;
  ctx.fillStyle = '#b54f2c';
  ctx.beginPath(); ctx.moveTo(x - 6, y + 4); ctx.quadraticCurveTo(x - 1, y - h, x + 2, y - 3); ctx.quadraticCurveTo(x + 6, y + 1, x + 6, y + 4); ctx.fill();
  ctx.fillStyle = '#e08a3c';
  ctx.beginPath(); ctx.moveTo(x - 3, y + 4); ctx.quadraticCurveTo(x, y - h * 0.7, x + 3, y - 2); ctx.quadraticCurveTo(x + 4, y + 2, x + 3, y + 4); ctx.fill();
  ctx.fillStyle = '#f2c46a';
  ctx.fillRect(x - 1, y - 2 + Math.sin(t * 10), 2, 6);
  for (let i = 0; i < 4; i++) {
    const life = ((t * 0.5 + i * 0.25) % 1);
    ctx.globalAlpha = (1 - life) * 0.8;
    ctx.fillStyle = '#e8a34e';
    ctx.fillRect(x + Math.sin(i * 4 + t) * 3, y - 8 - life * 16, 1, 1);
  }
  ctx.globalAlpha = 1;
}
function drawCamper(ctx, x, y, t) {
  ctx.fillStyle = '#1e241b';
  ctx.fillRect(x - 3, y - 9, 6, 8);
  ctx.fillRect(x - 2, y - 12, 5, 4);
  ctx.fillStyle = '#c49a72';
  ctx.fillRect(x - 2, y - 12, 4, 3);
  ctx.fillStyle = '#3f4d3e';
  ctx.fillRect(x - 3, y - 9, 6, 5);
  ctx.fillStyle = '#2e3540';
  ctx.fillRect(x - 3, y - 4, 2, 4);
  ctx.fillRect(x + 1, y - 4, 2, 4);
  /* slowly looking side to side */
  const look = Math.sin(t * 0.5);
  ctx.fillStyle = '#e8ddb0';
  if (look > 0) ctx.fillRect(x + 1, y - 11, 1, 1);
  else ctx.fillRect(x - 2, y - 11, 1, 1);
}
