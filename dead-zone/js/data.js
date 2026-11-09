/* DEAD ZONE — static game data: items, loot, crafting, buildings, zones */

export const RARITY = {
  common: { name: 'COMMON', color: '#9aa08b', weight: 1 },
  uncommon: { name: 'UNCOMMON', color: '#7fb069', weight: 2 },
  rare: { name: 'RARE', color: '#5aa9c9', weight: 3 },
  military: { name: 'MILITARY', color: '#d8a23a', weight: 4 },
  legendary: { name: 'LEGENDARY', color: '#c96b4a', weight: 5 }
};

function def(id, data) {
  return Object.assign({ id, w: 1, h: 1, stack: 1, rarity: 'common', type: 'misc' }, data);
}

export const ITEMS = {};

function add(obj) { ITEMS[obj.id] = obj; return obj; }

/* ---------- MATERIALS ---------- */
add(def('wood', { name: 'Wood Scrap', type: 'material', icon: 'wood', color: '#8a5a35', stack: 80, desc: 'Splintered lumber. Used for building and basic crafting.' }));
add(def('scrap', { name: 'Scrap Metal', type: 'material', icon: 'scrap', color: '#8d969b', stack: 80, desc: 'Bent steel and rusted parts. The backbone of camp construction.' }));
add(def('fabric', { name: 'Fabric', type: 'material', icon: 'fabric', color: '#9a7f63', stack: 80, desc: 'Torn cloth. Bandages, packs and clothing all start here.' }));
add(def('components', { name: 'Components', type: 'material', icon: 'components', color: '#6fae7a', stack: 60, rarity: 'uncommon', desc: 'Springs, circuits and precision parts.' }));
add(def('chemicals', { name: 'Chemicals', type: 'material', icon: 'chemicals', color: '#a9c25b', stack: 60, rarity: 'uncommon', desc: 'Volatile compounds for medicine, ammo and fuel.' }));
add(def('fuel', { name: 'Fuel Can', type: 'material', icon: 'fuel', color: '#c8893e', stack: 25, rarity: 'uncommon', desc: 'Diesel / petrol. Feeds generators and some recipes.' }));
add(def('rope', { name: 'Rope', type: 'material', icon: 'rope', color: '#b09867', stack: 40, desc: 'Braided cord. Useful for packs and traps.' }));
add(def('stone', { name: 'Stone', type: 'material', icon: 'stone', color: '#7c817c', stack: 80, desc: 'Sharp stones and rubble.' }));
add(def('nails', { name: 'Nails', type: 'material', icon: 'nails', color: '#b7beb8', stack: 80, desc: 'Improvised spikes for bats and barricades.' }));

/* ---------- FOOD & DRINK ---------- */
add(def('beans', { name: 'Canned Beans', type: 'food', icon: 'can', color: '#b9783f', stack: 8, effects: { hunger: 34, health: 2 }, desc: 'Cold beans, eaten from the can. +34 hunger.' }));
add(def('tuna', { name: 'Canned Tuna', type: 'food', icon: 'can', color: '#6f9dbb', stack: 8, effects: { hunger: 30, health: 4 }, desc: 'Oily fish. +30 hunger.' }));
add(def('mre', { name: 'Military MRE', type: 'food', icon: 'ration', color: '#7d7a55', stack: 5, rarity: 'uncommon', effects: { hunger: 62, health: 8 }, desc: 'A full meal in a foil bag. +62 hunger.' }));
add(def('energybar', { name: 'Energy Bar', type: 'food', icon: 'bar', color: '#b98c4a', stack: 10, effects: { hunger: 18, stamina: 40 }, desc: 'Dense, chalky calories. +18 hunger, +40 stamina.' }));
add(def('apple', { name: 'Wild Apple', type: 'food', icon: 'apple', color: '#a94b3e', stack: 10, effects: { hunger: 13, thirst: 6, health: 2 }, desc: 'Bruised but edible. +13 hunger, +6 thirst.' }));
add(def('jerky', { name: 'Dried Jerky', type: 'food', icon: 'jerky', color: '#7c4a3a', stack: 10, effects: { hunger: 26, stamina: 15 }, desc: 'Salty survival meat. +26 hunger.' }));
add(def('dogfood', { name: 'Dog Food', type: 'food', icon: 'can', color: '#715f43', stack: 8, effects: { hunger: 22, health: -2 }, desc: 'It is food. Technically. +22 hunger, -2 health.' }));
add(def('water', { name: 'Water Bottle', type: 'drink', icon: 'bottle', color: '#5f93b8', stack: 4, effects: { thirst: 45, health: 1 }, desc: 'Half-full, slightly cloudy. +45 thirst.' }));
add(def('purifiedwater', { name: 'Purified Water', type: 'drink', icon: 'bottle', color: '#7fc4d8', stack: 4, rarity: 'uncommon', effects: { thirst: 60, health: 5 }, desc: 'Clean, cold water. +60 thirst.' }));
add(def('soda', { name: 'Warm Soda', type: 'drink', icon: 'can', color: '#b54a3c', stack: 6, effects: { thirst: 30, stamina: 25 }, desc: 'Flat and sweet. +30 thirst, +25 stamina.' }));

/* ---------- MEDICAL ---------- */
add(def('bandage', { name: 'Bandage', type: 'med', icon: 'bandage', color: '#d8d2c2', stack: 8, effects: { health: 22, bleed: -1 }, desc: 'Stops bleeding and restores 22 health.' }));
add(def('medkit', { name: 'Medkit', type: 'med', icon: 'medkit', color: '#c85b50', stack: 4, rarity: 'uncommon', effects: { health: 65, bleed: -3 }, desc: 'Field trauma kit. Restores 65 health and stops bleeding.' }));
add(def('painkillers', { name: 'Painkillers', type: 'med', icon: 'pills', color: '#d3c475', stack: 6, effects: { health: 12, stamina: 45, bleed: -1 }, desc: 'Dulls the pain. +12 health, +45 stamina, stops bleeding.' }));
add(def('antibiotics', { name: 'Antibiotics', type: 'med', icon: 'pills', color: '#84b5bd', stack: 4, rarity: 'rare', effects: { health: 30, bleed: -2, infection: -1 }, desc: 'Rare pre-outbreak medicine. Restores 30 health.' }));

/* ---------- MELEE ---------- */
add(def('knife', {
  name: 'Hunting Knife', type: 'weapon', icon: 'knife', color: '#b8c2cc', w: 1, h: 2, rarity: 'common', slot: 'melee',
  weapon: { kind: 'melee', damage: 25, range: 30, cooldown: 0.38, noise: 2, knockback: 8, durability: 130, stamina: 5 },
  desc: 'Fast and quiet. Good for finishing the fallen.'
}));
add(def('crowbar', {
  name: 'Crowbar', type: 'weapon', icon: 'crowbar', color: '#a33a32', w: 1, h: 2, rarity: 'common', slot: 'melee',
  weapon: { kind: 'melee', damage: 32, range: 34, cooldown: 0.55, noise: 7, knockback: 16, durability: 240, stamina: 8 },
  tool: 'pry', desc: 'Heavy steel. Opens stubborn crates and skulls.'
}));
add(def('bat', {
  name: 'Nail Bat', type: 'weapon', icon: 'bat', color: '#a47b4c', w: 1, h: 2, rarity: 'common', slot: 'melee',
  weapon: { kind: 'melee', damage: 38, range: 38, cooldown: 0.68, noise: 6, knockback: 22, durability: 180, stamina: 10 },
  desc: 'A baseball bat with nails driven through it.'
}));
add(def('machete', {
  name: 'Machete', type: 'weapon', icon: 'machete', color: '#8ea0a8', w: 1, h: 2, rarity: 'uncommon', slot: 'melee',
  weapon: { kind: 'melee', damage: 47, range: 36, cooldown: 0.48, noise: 3, knockback: 14, durability: 210, stamina: 8 },
  desc: 'A broad blade for cutting brush and the dead.'
}));
add(def('axe', {
  name: 'Fire Axe', type: 'weapon', icon: 'axe', color: '#a45a3c', w: 1, h: 2, rarity: 'uncommon', slot: 'melee',
  weapon: { kind: 'melee', damage: 55, range: 38, cooldown: 0.8, noise: 8, knockback: 26, durability: 260, stamina: 13 },
  tool: 'axe', desc: 'Chops wood twice as fast. Also chops everything else.'
}));
add(def('spear', {
  name: 'Scrap Spear', type: 'weapon', icon: 'spear', color: '#9c7b55', w: 1, h: 3, rarity: 'common', slot: 'melee',
  weapon: { kind: 'melee', damage: 33, range: 54, cooldown: 0.7, noise: 2, knockback: 6, durability: 90, stamina: 7 },
  desc: 'Long reach, fragile shaft. Keep them at arm\'s length.'
}));
add(def('sledge', {
  name: 'Sledgehammer', type: 'weapon', icon: 'sledge', color: '#7d858a', w: 1, h: 3, rarity: 'rare', slot: 'melee',
  weapon: { kind: 'melee', damage: 78, range: 40, cooldown: 1.15, noise: 12, knockback: 40, durability: 300, stamina: 20 },
  tool: 'pry', desc: 'Slow, exhausting, and absolutely devastating.'
}));

/* ---------- FIREARMS ---------- */
add(def('pistol', {
  name: '9mm Pistol', type: 'weapon', icon: 'pistol', color: '#8f979b', w: 2, h: 1, rarity: 'common', slot: 'primary',
  weapon: { kind: 'gun', damage: 27, range: 250, cooldown: 0.3, noise: 360, spread: 0.045, mag: 12, ammo: 'ammo9', reload: 1.25, durability: 220, stamina: 2, pellets: 1, auto: false },
  desc: 'Reliable sidearm. Loud enough to wake the street.'
}));
add(def('revolver', {
  name: '.44 Revolver', type: 'weapon', icon: 'revolver', color: '#a89d8d', w: 2, h: 1, rarity: 'uncommon', slot: 'primary',
  weapon: { kind: 'gun', damage: 55, range: 270, cooldown: 0.7, noise: 430, spread: 0.03, mag: 6, ammo: 'ammo44', reload: 1.8, durability: 260, stamina: 3, pellets: 1, auto: false },
  desc: 'Six heavy rounds. Makes a statement nobody wants to hear.'
}));
add(def('smg', {
  name: 'Scrap SMG', type: 'weapon', icon: 'smg', color: '#777f84', w: 3, h: 1, rarity: 'rare', slot: 'primary',
  weapon: { kind: 'gun', damage: 18, range: 210, cooldown: 0.11, noise: 330, spread: 0.09, mag: 30, ammo: 'ammo9', reload: 1.6, durability: 180, stamina: 2, pellets: 1, auto: true },
  desc: 'Sprays 9mm fast. The definition of a noise complaint.'
}));
add(def('rifle', {
  name: 'Hunting Rifle', type: 'weapon', icon: 'rifle', color: '#7f6a4f', w: 4, h: 1, rarity: 'rare', slot: 'primary',
  weapon: { kind: 'gun', damage: 72, range: 430, cooldown: 0.9, noise: 520, spread: 0.012, mag: 5, ammo: 'ammo556', reload: 2.1, durability: 300, stamina: 4, pellets: 1, auto: false },
  desc: 'Precision rifle. Rounds punch through one target and often the next.'
}));
add(def('shotgun', {
  name: 'Pump Shotgun', type: 'weapon', icon: 'shotgun', color: '#6e5540', w: 4, h: 1, rarity: 'rare', slot: 'primary',
  weapon: { kind: 'gun', damage: 15, range: 150, cooldown: 1.0, noise: 560, spread: 0.18, mag: 6, ammo: 'shell', reload: 2.4, durability: 280, stamina: 6, pellets: 7, auto: false },
  desc: 'Seven pellets of close-range problem solving.'
}));
add(def('sniper', {
  name: 'Marksman Rifle', type: 'weapon', icon: 'sniper', color: '#5f6b57', w: 4, h: 1, rarity: 'military', slot: 'primary',
  weapon: { kind: 'gun', damage: 110, range: 620, cooldown: 1.4, noise: 620, spread: 0.004, mag: 5, ammo: 'ammo556', reload: 2.4, durability: 340, stamina: 6, pellets: 1, auto: false },
  desc: 'Military marksman rifle. Reach out and end the conversation.'
}));

/* ---------- AMMO ---------- */
add(def('ammo9', { name: '9mm Rounds', type: 'ammo', icon: 'ammo', color: '#c9b46b', stack: 90, ammoType: 'ammo9', desc: 'Pistol and SMG ammunition.' }));
add(def('ammo44', { name: '.44 Rounds', type: 'ammo', icon: 'ammo', color: '#d29a5a', stack: 60, ammoType: 'ammo44', desc: 'Heavy revolver ammunition.' }));
add(def('ammo556', { name: '5.56 Rounds', type: 'ammo', icon: 'ammo', color: '#c7c58a', stack: 90, rarity: 'uncommon', ammoType: 'ammo556', desc: 'Rifle ammunition.' }));
add(def('shell', { name: 'Shotgun Shells', type: 'ammo', icon: 'shell', color: '#b54e3d', stack: 40, rarity: 'uncommon', ammoType: 'shell', desc: 'Buckshot cartridges.' }));

/* ---------- ARMOR & CLOTHING ---------- */
add(def('hoodie', { name: 'Faded Hoodie', type: 'armor', icon: 'armor', color: '#4f5b58', slot: 'armor', armor: { value: 6, durability: 80 }, desc: 'Warm, quiet and barely protective.' }));
add(def('leatherjacket', { name: 'Leather Jacket', type: 'armor', icon: 'armor', color: '#5d4132', slot: 'armor', rarity: 'uncommon', armor: { value: 16, durability: 160 }, desc: 'Tough hide. Turns teeth aside.' }));
add(def('kevlar', { name: 'Kevlar Vest', type: 'armor', icon: 'vest', color: '#4f6351', slot: 'armor', rarity: 'rare', armor: { value: 30, durability: 220 }, desc: 'Pre-outbreak body armour.' }));
add(def('tacticalvest', { name: 'Tactical Vest', type: 'armor', icon: 'vest', color: '#5c6048', slot: 'armor', rarity: 'military', armor: { value: 38, durability: 280 }, desc: 'Military plate carrier. Heavy but reassuring.' }));

/* ---------- BACKPACKS ---------- */
add(def('schoolbag', { name: 'School Backpack', type: 'backpack', icon: 'bag', color: '#6a5a78', slot: 'backpack', bag: { rows: 1 }, desc: 'Adds 1 inventory row.' }));
add(def('hikingpack', { name: 'Hiking Pack', type: 'backpack', icon: 'bag', color: '#5d6b4e', slot: 'backpack', rarity: 'uncommon', bag: { rows: 2 }, desc: 'Adds 2 inventory rows.' }));
add(def('militarypack', { name: 'Military Pack', type: 'backpack', icon: 'bag', color: '#5c5e4a', slot: 'backpack', rarity: 'rare', bag: { rows: 3 }, desc: 'Adds 3 inventory rows.' }));

/* ---------- TOOLS & UTILITY ---------- */
add(def('flashlight', { name: 'Flashlight', type: 'utility', icon: 'flashlight', color: '#b7a15d', slot: 'utility', tool: 'flashlight', desc: 'Casts a bright cone in the dark. Equip in utility slot.' }));
add(def('radio', { name: 'Field Radio', type: 'utility', icon: 'radio', color: '#6f8b75', slot: 'utility', rarity: 'uncommon', tool: 'radio', desc: 'Reveals extraction beacons at deployment and speeds extraction.' }));
add(def('lockpick', { name: 'Lockpick Set', type: 'tool', icon: 'lockpick', color: '#b7b09d', stack: 3, tool: 'lockpick', desc: 'Opens locked crates and doors without noise.' }));
add(def('repairkit', { name: 'Repair Kit', type: 'tool', icon: 'wrench', color: '#a9955c', stack: 3, tool: 'repair', desc: 'Used at the workbench to restore weapon and armour condition.' }));
add(def('flare', { name: 'Signal Flare', type: 'tool', icon: 'flare', color: '#d6604a', stack: 3, rarity: 'uncommon', tool: 'flare', desc: 'Use to reveal the map and draw the dead toward the flare.' }));
add(def('gasmask', { name: 'Gas Mask', type: 'utility', icon: 'gasmask', color: '#626b55', slot: 'utility', rarity: 'uncommon', tool: 'gasmask', desc: 'Protects against toxic fumes in industrial zones.' }));

/* ---------- ATTACHMENTS ---------- */
add(def('suppressor', { name: 'Suppressor', type: 'attachment', icon: 'suppressor', color: '#6e7477', w: 2, h: 1, rarity: 'rare', attach: 'suppressor', desc: 'Use to fit to your firearm. Cuts gunshot noise by 65%.' }));
add(def('scope', { name: 'Rifle Scope', type: 'attachment', icon: 'scope', color: '#6b7d68', w: 2, h: 1, rarity: 'uncommon', attach: 'scope', desc: 'Use to fit to your firearm. +35% range, improved accuracy.' }));
add(def('extmag', { name: 'Extended Mag', type: 'attachment', icon: 'mag', color: '#7f868a', w: 1, h: 2, rarity: 'rare', attach: 'extmag', desc: 'Use to fit to your firearm. +60% magazine capacity.' }));

/* ---------- MISC ---------- */
add(def('watch', { name: 'Silver Watch', type: 'misc', icon: 'watch', color: '#c9c3a7', stack: 5, rarity: 'uncommon', value: 25, desc: 'Still ticking. People at camp will trade for it.' }));
add(def('battery', { name: 'Battery', type: 'misc', icon: 'battery', color: '#7c8b57', stack: 10, desc: 'A dead phone battery. Components salvage.' }));

/* ---------- LOOT TABLES ---------- */
/* Each entry: [itemId, weight, minQty, maxQty] */
export const LOOT = {
  cabinet: [
    ['fabric', 20, 1, 3], ['beans', 14, 1, 2], ['water', 12, 1, 2], ['bandage', 10, 1, 2],
    ['battery', 8, 1, 1], ['knife', 4, 1, 1], ['pistol', 2, 1, 1], ['ammo9', 8, 4, 12],
    ['watch', 4, 1, 1], ['painkillers', 6, 1, 2], ['hoodie', 4, 1, 1], ['energybar', 8, 1, 2]
  ],
  fridge: [
    ['water', 20, 1, 2], ['soda', 16, 1, 2], ['beans', 12, 1, 2], ['tuna', 10, 1, 2],
    ['apple', 10, 1, 3], ['dogfood', 8, 1, 2], ['jerky', 5, 1, 2], ['purifiedwater', 3, 1, 1],
    ['mre', 2, 1, 1], ['chemicals', 3, 1, 1]
  ],
  crate: [
    ['wood', 18, 2, 5], ['scrap', 16, 1, 4], ['fabric', 10, 1, 3], ['components', 8, 1, 2],
    ['nails', 10, 4, 10], ['rope', 8, 1, 2], ['chemicals', 5, 1, 2], ['fuel', 5, 1, 1],
    ['axe', 3, 1, 1], ['crowbar', 4, 1, 1], ['bat', 3, 1, 1], ['spear', 4, 1, 1], ['flare', 4, 1, 1]
  ],
  toolbox: [
    ['scrap', 20, 2, 4], ['components', 16, 1, 3], ['nails', 12, 5, 12], ['rope', 8, 1, 2],
    ['repairkit', 8, 1, 1], ['lockpick', 6, 1, 1], ['flashlight', 5, 1, 1], ['machete', 2, 1, 1],
    ['ammo9', 6, 6, 15], ['extmag', 2, 1, 1], ['suppressor', 1, 1, 1]
  ],
  medbox: [
    ['bandage', 24, 1, 3], ['medkit', 12, 1, 2], ['painkillers', 12, 1, 2], ['antibiotics', 6, 1, 1],
    ['chemicals', 8, 1, 2], ['fabric', 10, 2, 4], ['water', 8, 1, 2], ['gasmask', 5, 1, 1]
  ],
  locker: [
    ['ammo9', 16, 8, 24], ['pistol', 8, 1, 1], ['knife', 8, 1, 1], ['bandage', 10, 1, 2],
    ['hoodie', 8, 1, 1], ['leatherjacket', 4, 1, 1], ['schoolbag', 6, 1, 1], ['battery', 6, 1, 2],
    ['watch', 4, 1, 1], ['flare', 4, 1, 1], ['shotgun', 2, 1, 1], ['shell', 4, 4, 8]
  ],
  warehouse: [
    ['wood', 16, 3, 8], ['scrap', 18, 2, 6], ['components', 10, 1, 3], ['fuel', 8, 1, 2],
    ['rope', 8, 1, 3], ['nails', 8, 6, 16], ['chemicals', 6, 1, 2], ['crowbar', 4, 1, 1],
    ['sledge', 2, 1, 1], ['smg', 2, 1, 1], ['ammo9', 8, 10, 30], ['hikingpack', 4, 1, 1]
  ],
  car: [
    ['fuel', 18, 1, 2], ['scrap', 18, 1, 4], ['components', 10, 1, 2], ['rope', 6, 1, 1],
    ['battery', 8, 1, 2], ['ammo9', 8, 5, 15], ['water', 6, 1, 1], ['jerky', 6, 1, 2],
    ['pistol', 3, 1, 1], ['shotgun', 2, 1, 1], ['shell', 4, 3, 6], ['watch', 5, 1, 1],
    ['repairkit', 4, 1, 1], ['scope', 2, 1, 1]
  ],
  dumpster: [
    ['scrap', 20, 1, 4], ['fabric', 16, 2, 5], ['wood', 10, 1, 3], ['tuna', 6, 1, 1],
    ['dogfood', 8, 1, 2], ['rope', 8, 1, 2], ['battery', 6, 1, 2], ['water', 6, 1, 1],
    ['crowbar', 3, 1, 1], ['nails', 8, 3, 8], ['beans', 5, 1, 1], ['watch', 2, 1, 1]
  ],
  military: [
    ['ammo556', 16, 15, 45], ['rifle', 5, 1, 1], ['sniper', 2, 1, 1], ['kevlar', 7, 1, 1],
    ['tacticalvest', 4, 1, 1], ['militarypack', 6, 1, 1], ['medkit', 10, 1, 2], ['mre', 10, 1, 2],
    ['suppressor', 4, 1, 1], ['scope', 5, 1, 1], ['extmag', 4, 1, 1], ['smg', 4, 1, 1],
    ['shell', 8, 5, 10], ['gasmask', 5, 1, 1], ['antibiotics', 6, 1, 1], ['flare', 6, 1, 1]
  ],
  forest: [
    ['wood', 30, 2, 6], ['apple', 18, 1, 3], ['rope', 10, 1, 2], ['stone', 15, 1, 3],
    ['fabric', 8, 1, 2], ['jerky', 5, 1, 1]
  ]
};

export const ZONE_LOOT_BONUS = {
  suburbs: { table: [['ammo9', 20, 5, 15], ['bandage', 12, 1, 2], ['schoolbag', 6, 1, 1], ['pistol', 6, 1, 1], ['hoodie', 10, 1, 1], ['beans', 12, 1, 2]], chance: 0.22 },
  riverside: { table: [['water', 16, 1, 2], ['tuna', 14, 1, 2], ['fabric', 12, 2, 4], ['leatherjacket', 6, 1, 1], ['hikingpack', 5, 1, 1], ['shotgun', 4, 1, 1], ['shell', 8, 3, 8]], chance: 0.25 },
  industrial: { table: [['scrap', 18, 3, 6], ['components', 16, 1, 3], ['chemicals', 12, 1, 2], ['fuel', 12, 1, 2], ['smg', 5, 1, 1], ['rifle', 3, 1, 1], ['ammo556', 8, 5, 20], ['repairkit', 8, 1, 1]], chance: 0.3 },
  military: { table: [['ammo556', 20, 20, 50], ['rifle', 8, 1, 1], ['sniper', 4, 1, 1], ['tacticalvest', 8, 1, 1], ['kevlar', 10, 1, 1], ['militarypack', 8, 1, 1], ['medkit', 12, 1, 2], ['suppressor', 5, 1, 1], ['scope', 6, 1, 1], ['mre', 12, 1, 2]], chance: 0.38 }
};

export const CONTAINERS = {
  cabinet: { name: 'Cabinet', table: 'cabinet', w: 14, h: 12, color: '#6f5a41', search: 1.1 },
  fridge: { name: 'Refrigerator', table: 'fridge', w: 14, h: 18, color: '#9ba3a0', search: 1.2 },
  crate: { name: 'Wooden Crate', table: 'crate', w: 14, h: 14, color: '#8a683d', search: 1.3 },
  toolbox: { name: 'Toolbox', table: 'toolbox', w: 12, h: 9, color: '#a5523f', search: 1.0 },
  medbox: { name: 'Medical Box', table: 'medbox', w: 14, h: 11, color: '#b9bda8', search: 1.3 },
  locker: { name: 'Metal Locker', table: 'locker', w: 13, h: 18, color: '#5b6d56', search: 1.5 },
  warehouse: { name: 'Shipping Crate', table: 'warehouse', w: 18, h: 16, color: '#6a6a4f', search: 1.8 },
  car: { name: 'Abandoned Car', table: 'car', w: 30, h: 18, color: '#5f6657', search: 1.7 },
  dumpster: { name: 'Dumpster', table: 'dumpster', w: 24, h: 16, color: '#4f5a4d', search: 1.4 },
  military: { name: 'Military Crate', table: 'military', w: 18, h: 14, color: '#5b6045', search: 2.2, locked: true },
  corpse: { name: 'Corpse', table: 'corpse', w: 12, h: 9, color: '#5b3f3f', search: 0.7 }
};

export const CORPSE_LOOT = [
  ['bandage', 14, 1, 1], ['ammo9', 16, 2, 8], ['ammo556', 8, 2, 8], ['shell', 8, 1, 4],
  ['scrap', 14, 1, 2], ['fabric', 12, 1, 2], ['jerky', 6, 1, 1], ['painkillers', 6, 1, 1],
  ['water', 6, 1, 1], ['watch', 4, 1, 1], ['knife', 4, 1, 1], ['flare', 4, 1, 1]
];

/* ---------- BUILDINGS / CAMP ---------- */
export const BUILDINGS = {
  workbench: {
    name: 'Workbench', icon: 'workbench', max: 3,
    desc: 'Crafting hub. Each level unlocks stronger recipes.',
    levels: [
      { cost: { wood: 12, scrap: 6 }, label: 'Build Workbench I' },
      { cost: { wood: 20, scrap: 14, components: 4 }, label: 'Upgrade to II' },
      { cost: { wood: 30, scrap: 24, components: 10, chemicals: 5 }, label: 'Upgrade to III' }
    ]
  },
  crate: {
    name: 'Storage Crate', icon: 'crate', max: 4,
    desc: 'Adds one row (8 slots) to camp storage per crate.',
    levels: [
      { cost: { wood: 14, scrap: 3 }, label: 'Build Crate' },
      { cost: { wood: 18, scrap: 5 }, label: 'Build Crate' },
      { cost: { wood: 22, scrap: 8 }, label: 'Build Crate' },
      { cost: { wood: 26, scrap: 12 }, label: 'Build Crate' }
    ]
  },
  garden: {
    name: 'Vegetable Garden', icon: 'garden', max: 2,
    desc: 'Produces food every time you return from an expedition.',
    levels: [
      { cost: { wood: 8, fabric: 4, rope: 2 }, label: 'Plant Garden' },
      { cost: { wood: 14, fabric: 6, rope: 3 }, label: 'Expand Garden' }
    ]
  },
  collector: {
    name: 'Rain Collector', icon: 'collector', max: 2,
    desc: 'Collects clean water while you are away.',
    levels: [
      { cost: { wood: 6, scrap: 4, fabric: 3 }, label: 'Build Collector' },
      { cost: { wood: 10, scrap: 8, fabric: 5 }, label: 'Expand Collector' }
    ]
  },
  generator: {
    name: 'Generator', icon: 'generator', max: 1,
    desc: 'Powers advanced ammo crafting. Consumes fuel when used.',
    levels: [{ cost: { scrap: 18, components: 8, fuel: 4 }, label: 'Build Generator' }]
  },
  tower: {
    name: 'Radio Tower', icon: 'tower', max: 1,
    desc: 'Reveals extraction beacons at deployment and speeds up extraction.',
    levels: [{ cost: { scrap: 22, components: 12, fuel: 4, rope: 4 }, label: 'Build Radio Tower' }]
  },
  campfire: {
    name: 'Campfire', icon: 'campfire', max: 1,
    desc: 'A warm light. Unlocks cooked food recipes.',
    levels: [{ cost: { wood: 6, stone: 8 }, label: 'Build Campfire' }]
  },
  bed: {
    name: 'Bedroll', icon: 'bed', max: 1,
    desc: '+15 maximum health on every expedition.',
    levels: [{ cost: { fabric: 8, wood: 4 }, label: 'Build Bedroll' }]
  },
  wall: {
    name: 'Perimeter Wall', icon: 'wall', max: 12,
    desc: '+2 camp defense each. Defends storage against night raids.',
    levels: Array.from({ length: 12 }, () => ({ cost: { wood: 8, scrap: 3 }, label: 'Build Wall' }))
  },
  barricade: {
    name: 'Barricade', icon: 'barricade', max: 8,
    desc: '+3 camp defense each. Slows raiders at the perimeter.',
    levels: Array.from({ length: 8 }, () => ({ cost: { wood: 5, scrap: 5, nails: 4 }, label: 'Build Barricade' }))
  }
};

/* ---------- CRAFTING ---------- */
export const RECIPES = [
  { id: 'bandage', out: ['bandage', 2], cost: { fabric: 2 }, tier: 0, time: 1 },
  { id: 'spear', out: ['spear', 1], cost: { wood: 2, scrap: 1 }, tier: 0, time: 1 },
  { id: 'bat', out: ['bat', 1], cost: { wood: 3, nails: 4 }, tier: 0, time: 1 },
  { id: 'repairkit', out: ['repairkit', 1], cost: { scrap: 2, fabric: 1, components: 1 }, tier: 0, time: 1 },
  { id: 'torch', out: ['flashlight', 1], cost: { scrap: 2, components: 1, battery: 1 }, tier: 0, time: 1 },
  { id: 'backpack', out: ['hikingpack', 1], cost: { fabric: 5, rope: 2, components: 1 }, tier: 1, time: 1 },
  { id: 'leatherjacket', out: ['leatherjacket', 1], cost: { fabric: 5, rope: 2, scrap: 1 }, tier: 1, time: 1 },
  { id: 'machete', out: ['machete', 1], cost: { scrap: 4, fabric: 1, components: 1 }, tier: 1, time: 1 },
  { id: 'medkit', out: ['medkit', 1], cost: { bandage: 2, fabric: 1, chemicals: 1 }, tier: 1, time: 1 },
  { id: 'purifiedwater', out: ['purifiedwater', 2], cost: { water: 2, chemicals: 1 }, tier: 1, time: 1 },
  { id: 'ammo9', out: ['ammo9', 18], cost: { scrap: 3, chemicals: 1 }, tier: 1, time: 1 },
  { id: 'armor', out: ['kevlar', 1], cost: { fabric: 4, scrap: 4, components: 2 }, tier: 2, time: 1 },
  { id: 'suppressor', out: ['suppressor', 1], cost: { scrap: 4, components: 3, chemicals: 1 }, tier: 2, time: 1 },
  { id: 'scope', out: ['scope', 1], cost: { scrap: 3, components: 3 }, tier: 2, time: 1 },
  { id: 'extmag', out: ['extmag', 1], cost: { scrap: 4, components: 2 }, tier: 2, time: 1 },
  { id: 'ammo556', out: ['ammo556', 15], cost: { scrap: 4, chemicals: 2, components: 1 }, tier: 2, time: 1, power: true },
  { id: 'shell', out: ['shell', 8], cost: { scrap: 3, chemicals: 2 }, tier: 2, time: 1, power: true },
  { id: 'mre', out: ['mre', 1], cost: { beans: 2, jerky: 1, fuel: 1 }, tier: 2, time: 1, fire: true },
  { id: 'jerky', out: ['jerky', 2], cost: { dogfood: 1, chemicals: 1 }, tier: 1, time: 1, fire: true },
  { id: 'rifle', out: ['rifle', 1], cost: { scrap: 12, components: 8, wood: 6, chemicals: 2 }, tier: 3, time: 1 },
  { id: 'shotgun', out: ['shotgun', 1], cost: { scrap: 10, components: 6, wood: 8 }, tier: 3, time: 1 },
  { id: 'tacticalvest', out: ['tacticalvest', 1], cost: { kevlar: 1, fabric: 4, components: 4, scrap: 6 }, tier: 3, time: 1 },
  { id: 'militarypack', out: ['militarypack', 1], cost: { fabric: 8, rope: 4, components: 3 }, tier: 3, time: 1 }
];

/* ---------- ZONES ---------- */
export const ZONES = {
  suburbs: {
    id: 'suburbs', name: 'Ashgrove Suburbs', level: 1, difficulty: 1, raidTime: 720,
    zombies: 46, hordes: 3, mapType: 'suburbs', extractCount: 2, loot: 'suburbs',
    desc: 'Quiet residential streets. Good for beginners, bad for the unprepared.',
    threats: 'Walkers · small hordes', color: '#6e8656'
  },
  riverside: {
    id: 'riverside', name: 'Blackwater Riverside', level: 2, difficulty: 2, raidTime: 840,
    zombies: 62, hordes: 4, mapType: 'riverside', extractCount: 3, loot: 'riverside',
    desc: 'Flooded streets and ruined homes. Runners have been sighted near the water.',
    threats: 'Walkers · runners · hordes', color: '#557f8a'
  },
  industrial: {
    id: 'industrial', name: 'Rustyard Industrial', level: 3, difficulty: 3, raidTime: 960,
    zombies: 76, hordes: 5, mapType: 'industrial', extractCount: 3, loot: 'industrial',
    desc: 'Warehouses, chemical spills and tight alleys. Military-grade loot, brute company.',
    threats: 'Runners · brutes · toxic air', color: '#8a6d45'
  },
  military: {
    id: 'military', name: 'Fort Meridian', level: 5, difficulty: 4, raidTime: 1080,
    zombies: 98, hordes: 7, mapType: 'military', extractCount: 3, loot: 'military',
    desc: 'Overrun military checkpoints. The best loot in the dead zone. The worst things guard it.',
    threats: 'Runners · brutes · marksmen · hordes', color: '#6d6f4f'
  }
};

export const ZOMBIE_TYPES = {
  walker: { name: 'Walker', health: 60, speed: 26, chase: 42, damage: 10, vision: 105, radius: 7, xp: 12, color: '#71805a', skin: '#8ca06b', size: 1, attackRate: 1.25, hearing: 190 },
  runner: { name: 'Runner', health: 42, speed: 38, chase: 92, damage: 8, vision: 165, radius: 7, xp: 18, color: '#77745a', skin: '#b0a272', size: 1, attackRate: 0.8, hearing: 260 },
  brute: { name: 'Brute', health: 190, speed: 20, chase: 34, damage: 26, vision: 130, radius: 11, xp: 45, color: '#4f563f', skin: '#6e7a52', size: 1.45, attackRate: 1.6, hearing: 200, knockback: 14 },
  crawler: { name: 'Crawler', health: 30, speed: 18, chase: 55, damage: 6, vision: 80, radius: 6, xp: 9, color: '#5d5a48', skin: '#8d8a64', size: 0.75, attackRate: 0.9, hearing: 120, low: true }
};

export const PLAYER_BASE = {
  cols: 7, rows: 4, speed: 74, runSpeed: 128, crouchSpeed: 42,
  sprintStamina: 22, attackStamina: 3, maxHealth: 100, maxStamina: 100,
  vision: 260
};

export const baseStorage = { cols: 8, rows: 6 };

export const ZONE_ORDER = ['suburbs', 'riverside', 'industrial', 'military'];
