const { patch, settings, onInterfaceReady } = mod.getContext(
		import.meta),
	player = game.combat.player,
	getSynergy = (set) => {
		if (!(set instanceof Equipment))
			return;
		return game.summoning.getSynergy(set.getItemInSlot('melvorD:Summon1'), set.getItemInSlot('melvorD:Summon2'));
	},
	addToRenderQueue = (item, category, types) => types.forEach((type) => skillBoosts.renderQueue[category][type].add(item)),
	getCategoryIcons = (category) => skillBoosts.getCategoryIcons(category),
	melvorRealm = game.realms.getObjectByID('melvorD:Melvor');

let oldEquipmentSet = player.selectedEquipmentSet,
	get = settings.section('General').get,
	destroyedObstacles = [],
	hasAoD = cloudManager.hasAoDEntitlementAndIsEnabled,
	hasItA = cloudManager.hasItAEntitlementAndIsEnabled,
	isPetUnlocked, unequippedItem, lazyRenderer, fastRenderer, previousSynergy, prevMarkLevel, sideBarClicked;


// Equipment Events
// Update after item equipped
player._events.on('itemEquipped', e => {
	if (getCategoryIcons('Equipment').includes(e.item))
		addToRenderQueue(e.item, 'equipment', ['bg']);
	else if (getCategoryIcons('Consumable').includes(e.item)) {
		addToRenderQueue(e.item, 'consumable', ['bg', 'qty']);
	}
	if (previousSynergy && previousSynergy.summons.some(x => x.product === e.item)) {
		addToRenderQueue(previousSynergy, 'synergy', ['bg', 'qty']);
		previousSynergy = undefined;
	}
	let newSynergy = player.equippedSummoningSynergy;
	if (newSynergy && newSynergy.summons.some(x => x.product === e.item)) {
		addToRenderQueue(newSynergy, 'synergy', ['bg', 'qty']);
	}
	if (skillBoosts.hasAgilityCostMod(e.item))
		skillBoosts.updateAllObstacles();
	if (skillBoosts.hasTravelCostMod(e.item))
		skillBoosts.updateAllPOIs();
});


// Consumable Events
// Update item charges
game.itemCharges._events.on('chargesChanged', e => {
	if (!game.itemCharges.charges.has(e.item))
		return;
	addToRenderQueue(e.item, 'equipment', ['charge']);
	addToRenderQueue(e.item, 'consumable', ['bg']);
});


// POI Events
if (hasAoD) {
	game.cartography.on('travel', e => skillBoosts.updateAllPOIs());

	game.cartography.on('poiDiscovered', e => {
		if (getCategoryIcons('POI').includes(e.poi))
			addToRenderQueue(e.poi, 'poi', ['bg']);
		getCategoryIcons('Purchase').filter(x => x.purchaseRequirements[0] && x.purchaseRequirements[0].pois && x.purchaseRequirements[0].pois[0] === e.poi).forEach((purchase) => {
			addToRenderQueue(purchase, 'purchase', ['bg']);
		});
	});
}

// Purchase Events
// Remove Purchase from list after buying
// game.shop._events.on('purchaseMade', e => {
// 	getCategoryIcons('Purchase').filter(x => x.unlockRequirements.some(x => x.purchase === e.purchase)).forEach((purchase) => {
// 		updateBg(purchase, 'purchase');
// 	});
// 	skillBoosts.renderPurchaseBg();
// 	if (getCategoryIcons('Purchase').includes(e.purchase))
// 		skillBoosts.removeIcon(e.purchase);
// 	if (e.purchase.contains.pet && getCategoryIcons('Pet').includes(e.purchase.contains.pet))
// 		skillBoosts.removeIcon(e.purchase.contains.pet);
// });


// Misc Events
// Update Shop Requirements on Dungeon Completion
game.combat._events.on('dungeonCompleted', e => {
	getCategoryIcons('Purchase').filter(x => x.unlockRequirements.some(x => x.dungeon === e.dungeon)).forEach((purchase) => {
		addToRenderQueue(purchase, 'purchase', ['bg']);
	});
});

// Update Shop Requirements on Abyss Completion
game.combat._events.on('abyssDepthCompleted', e => {
	getCategoryIcons('Purchase').filter(x => x.unlockRequirements.some(x => x.dungeon === e.dungeon)).forEach((purchase) => {
		addToRenderQueue(purchase, 'purchase', ['bg']);
	});
});

// Update after building a Building
game.township.on('buildingCountChanged', e => {
	getCategoryIcons('Purchase').filter(x => x.contains.pet && x.purchaseRequirements.some(y => y.building === e.building)).forEach((purchase) => {
		addToRenderQueue(purchase, 'purchase', ['bg']);
	});
});

// Update Purchases with Museum Donation requirements
if (hasAoD) {
	game.archaeology.on('itemDonated', e => {
		getCategoryIcons('Purchase').filter(x => x.purchaseRequirements.some(y => y.count === e.newCount)).forEach((purchase) => {
			addToRenderQueue(purchase, 'purchase', ['bg']);
		});
	});
}



// Update items with Level Requirements
[game.woodcutting, game.fishing, game.firemaking, game.cooking, game.mining, game.smithing, game.agility, game.cartography, game.archaeology].forEach((skill) => {
	if (skill === undefined) return;
	skill.on('levelChanged', e => {
		getCategoryIcons('Purchase').filter(x => x.purchaseRequirements.some(y => y.skill === e.skill && e.oldLevel < y.level && e.newLevel >= y.level)).forEach((purchase) => {
			addToRenderQueue(purchase, 'purchase', ['bg']);
		});
	});
});
[game.slayer, game.woodcutting, game.fishing, game.harvesting].forEach((skill) => {
	if (skill === undefined) return;
	skill.on('abyssalLevelChanged', e => {
		getCategoryIcons('Purchase').filter(x => x.purchaseRequirements.some(y => y.skill === e.skill && e.oldLevel < y.abyssalLevel && e.newLevel >= y.abyssalLevel)).forEach((purchase) => {
			addToRenderQueue(purchase, 'purchase', ['bg']);
		});
	});
});
onInterfaceReady(() => {
	skillBoosts.data.skills.forEach((skill) => {
		['levelChanged', 'abyssalLevelChanged'].forEach((levelChange) => {
			let level = levelChange === 'levelChanged' ? 'Level' : 'AbyssalLevel';
			if (skill === game.agility && skill[level] < skill[`max${level}Cap`]) {
				skill.on(levelChange, e => {
					getCategoryIcons('Obstacle').filter(x => x.slot[level] === e.newlevel).forEach((obstacle) => { addToRenderQueue(obstacle, 'obstacle', ['bg']); });
				});
			} else if (skill[level] < skill[`max${level}Cap`]) {
				skill.on(levelChange, e => {
					getCategoryIcons('Obstacle').filter(x => x.skillRequirements && x.skillRequirements.some(y => y.skill === e.skill && e.oldLevel < y[level] && e.newLevel >= y[level])).forEach((obstacle) => {
						addToRenderQueue(obstacle, 'obstacle', ['bg']);
					});
				});
			}
			if (skill === game.astrology && skill[level] < skill[`max${level}Cap`]) {
				skill.on(levelChange, e => {
					getCategoryIcons('Constellation').filter(x => x[level] === e.newLevel).forEach((constellation) => { addToRenderQueue(constellation, 'constellation', ['bg']); });
				});
			}
		});
	});
});



// Class Patches
// Equipment Patches
// Update on equipment set change
patch(Player, 'changeEquipmentSet').before(function() {
	oldEquipmentSet = player.selectedEquipmentSet;
});
patch(Player, 'changeEquipmentSet').after(function(_, setID) {
	if (this.equipmentSets.length <= setID)
		return;
	try {
		let setsToUpdate = Array.from(new Set([oldEquipmentSet, setID]));
		setsToUpdate.forEach((set) => {
			let eSet = player.equipmentSets[set];
			if (!eSet)
				return;
			let synergy = getSynergy(eSet.equipment);
			eSet.equipment.equippedArray.forEach((slot) => {
				if (slot.isEmpty)
					return;
				if (['melvorD:Consumable', 'melvorD:Summon1', 'melvorD:Summon2'].includes(slot.id))
					addToRenderQueue(slot.item, 'consumable', ['bg', 'qty']);
				else
					addToRenderQueue(slot.item, 'equipment', ['bg']);

				if (synergy && synergy.summons.some(x => x.product === slot.item))
					addToRenderQueue(synergy, 'synergy', ['bg', 'qty']);
			});
		});
		skillBoosts.render();
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
patch(Player, 'equipItem').before(function(item, set, slot, quantity) {
	previousSynergy = getSynergy(this.equipmentSets[set].equipment);
});
patch(Equipment, 'unequipItem').before(function(slot) {
	unequippedItem = this.getItemInSlot(slot.id);
	previousSynergy = player.equippedSummoningSynergy;
});
patch(Equipment, 'unequipItem').after(function(_, slot) {
	try {
		if (getCategoryIcons('Equipment').includes(unequippedItem))
			addToRenderQueue(unequippedItem, 'equipment', ['bg']);
		else if (getCategoryIcons('Consumable').includes(unequippedItem)) {
			addToRenderQueue(unequippedItem, 'consumable', ['bg', 'qty']);
		}
		if (previousSynergy) {
			addToRenderQueue(previousSynergy, 'synergy', ['bg', 'qty']);
			previousSynergy = undefined;
		}
		if (skillBoosts.hasTravelCostMod(unequippedItem))
			skillBoosts.updateAllPOIs();
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});


// Potion Patches
// Update consumables and summons on use
patch(Player, 'consumeItemQuantities').after(function(_, e, equipped) {
	if (e instanceof CharacterAttackEvent && e.isPlayerMulti)
		return;
	if (['melvorD:Consumable', 'melvorD:Summon1', 'melvorD:Summon2'].includes(equipped.slot.id)) {
		addToRenderQueue(equipped.item, 'consumable', ['qty']);
		let synergies = game.summoning.synergiesByItem.get(equipped.item);
		if (synergies !== undefined)
			synergies.forEach(synergy => addToRenderQueue(synergy, 'synergy', ['qty']));
	}
});
// Update potions on use and when consumed
patch(PotionManager, 'usePotion').replace(function(o, potion, loadPotions) {
	let oldPotion = game.potions.activePotions.get(potion.action);
	if (this.game !== game || Math.max(game.bank.getQty(potion) - get('allbutx'), 0) > 0)
		o(potion, loadPotions);
	else
		this.removePotion(potion.action, false);
	addToRenderQueue(potion, 'consumable', ['bg', 'qty']);
	if (oldPotion)
		addToRenderQueue(oldPotion.item, 'consumable', ['bg']);
});
patch(PotionManager, 'removePotion').after(function(o, skill, loadPotions) {
	getCategoryIcons('Consumable').filter(potion => potion instanceof PotionItem && potion.action === skill).forEach((potion) => {
		addToRenderQueue(potion, 'consumable', ['bg', 'qty']);
	});
});



// POI Patches
patch(Cartography, 'goToWorldMapOnClick').after(function(_, poi) { skillBoosts.updateAllPOIs(); });



// Obstacles Patches
// Modify obstacle costs when updating Backgrounds
patch(Agility, 'addSingleObstacleBuildCost').after(function(_, obstacle, costs) {
	if (!skillBoosts.agiCosts)
		return;
	skillBoosts.agiCosts = false;

	let agiSetting = skillBoosts.data.filteredItems.get('agi');
	if (agiSetting.length === 0 || obstacle.realm !== melvorRealm)
		return;

	let capeID = player.equipment.getItemInSlot('melvorD:Cape').id,
		cap = game.modifiers.agilityItemCostReductionCanReach100 > 0 ? 100 : 95,
		isWearingSkillcape = capeID === 'melvorF:Agility_Skillcape',
		skillcape = !isWearingSkillcape && agiSetting.includes('melvorF:Agility_Skillcape') ? 20 : 0,
		superiorCape = capeID !== 'melvorTotH:Superior_Agility_Skillcape' && agiSetting.includes('melvorTotH:Superior_Agility_Skillcape') ? isWearingSkillcape ? 10 : 30 : 0;

	obstacle.currencyCosts.forEach(({ currency, quantity }) => {
		let costModifier = this.getObstacleCostModifier(obstacle, currency);
		costModifier -= skillcape + superiorCape;
		let cost = Math.floor(quantity * (1 + Math.max(costModifier, -cap) / 100));
		if (cost > 0)
			costs._currencies.set(currency, cost);
	});

	let itemCostModifier = this.getObstacleItemCostModifier(obstacle);
	itemCostModifier -= skillcape + superiorCape;
	itemCostModifier -= player.equipment.equippedItems['melvorD:Consumable'].item.id !== 'melvorAoD:Agility_Lesser_Relic' && agiSetting.includes('melvorAoD:Agility_Lesser_Relic') ? 10 : 0;
	obstacle.itemCosts.forEach(({ item, quantity }) => {
		let cost = Math.floor(quantity * (1 + Math.max(itemCostModifier, -cap) / 100));
		if (cost > 0)
			costs._items.set(item, cost);
	});
});
patch(Agility, 'addSinglePillarBuildCost').after(function(_, pillar, costs) {
	if (!skillBoosts.agiCosts)
		return;
	skillBoosts.agiCosts = false;

	let agiSetting = skillBoosts.data.filteredItems.get('agi');
	if (agiSetting.length === 0 || pillar.realm !== melvorRealm)
		return;

	let costModifier = this.game.modifiers.getValue("melvorD:agilityPillarCost", this.getActionModifierQuery(pillar)),
		cap = game.modifiers.agilityItemCostReductionCanReach100 > 0 ? 100 : 95;
	costModifier -= player.equipment.getItemInSlot('melvorD:Cape').id !== 'melvorTotH:Superior_Agility_Skillcape' && agiSetting.includes('melvorTotH:Superior_Agility_Skillcape') ? 20 : 0;

	pillar.currencyCosts.forEach(({ currency, quantity }) => {
		let cost = Math.floor(quantity * (1 + Math.max(costModifier, -cap) / 100));
		if (cost > 0)
			costs._currencies.set(currency, cost);
	});
	pillar.itemCosts.forEach(({ item, quantity }) => {
		let cost = Math.floor(quantity * (1 + Math.max(costModifier, -cap) / 100));
		if (cost > 0)
			costs._items.set(item, cost);
	});
});
// Update Obstacle on Build
patch(Agility, 'buildObstacle').after(function(_, obstacle) {
	let obstacles = getCategoryIcons('Obstacle');
	if (obstacle.id === 'melvorTotH:ForestJog')
		return obstacles.forEach((obstacle) => { addToRenderQueue(obstacle, 'obstacle', ['bg']); });
	obstacles.filter(x => x.category === obstacle.category).forEach((obst) => { addToRenderQueue(obst, 'obstacle', ['bg']); });
	obstacles.filter(x => x instanceof AgilityPillar || x.category >= obstacle.category).forEach((obst) => { addToRenderQueue(obst, 'obstacle', ['active']); });
});
// Grab the destroyed obstacle then update it after
patch(Agility, 'destroyObstacle').before(function(category) {
	this.courses.forEach((course) => {
		if (course.builtObstacles.has(category))
			destroyedObstacles.push(course.builtObstacles.get(category));
	});
});
patch(Agility, 'destroyObstacle').after(function(_, category) {
	if (destroyedObstacles.length <= 0)
		return;
	let obstacles = getCategoryIcons('Obstacle');
	if (destroyedObstacles.some(x => x.id === 'melvorTotH:ForestJog'))
		return obstacles.forEach((obstacle) => { addToRenderQueue(obstacle, 'obstacle', ['bg']); });
	destroyedObstacles.forEach((destroy) => { addToRenderQueue(destroy, 'obstacle', ['bg']); });
	obstacles.filter(x => x instanceof AgilityPillar || x.category >= category).forEach((obst) => { addToRenderQueue(obst, 'obstacle', ['active']); });
	destroyedObstacles = [];
});
// Update Pillars on Build
patch(Agility, 'buildPillar').before(function(pillar) {
	if (pillar.course.builtPillars.has(pillar.category))
		destroyedObstacles.push(pillar.course.builtPillars.get(pillar.category));
});
patch(Agility, 'buildPillar').after(function(_, pillar) {
	addToRenderQueue(pillar, 'obstacle', ['bg', 'active']);
	if (destroyedObstacles.length <= 0)
		return;
	destroyedObstacles.forEach((obstacle) => { addToRenderQueue(obstacle, 'obstacle', ['bg', 'active']); });
	destroyedObstacles = [];
});
patch(Agility, 'destroyPillar').before(function(category) {
	this.courses.forEach((course) => {
		if (course.builtPillars.has(category))
			destroyedObstacles.push(course.builtPillars.get(category));
	});
});
patch(Agility, 'destroyPillar').after(function(_, category) {
	if (destroyedObstacles.length <= 0)
		return;
	destroyedObstacles.forEach((destroy) => { addToRenderQueue(destroy, 'obstacle', ['bg', 'active']); });
	destroyedObstacles = [];
});



// Pet Patching
// Remove pet from list after acquired
patch(PetManager, 'unlockPet').before(function(pet) {
	isPetUnlocked = this.unlocked.has(pet);
});
patch(PetManager, 'unlockPet').after(function(_, pet) {
	if (isPetUnlocked)
		return;
	if (getCategoryIcons('Pet').includes(pet))
		skillBoosts.removeIcon(pet);
});


patch(ShopMenu, 'updateItemPostPurchase').after(function(_, purchase) {
	try {
		let purchases = getCategoryIcons('Purchase');
		purchases.filter(x => x.unlockRequirements.some(x => x.purchase === purchase)).forEach((purchase) => {
			addToRenderQueue(purchase, 'purchase', ['bg']);
		});
		skillBoosts.renderPurchaseBg();
		if (purchases.includes(purchase))
			skillBoosts.removeIcon(purchase);
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});


// Update Constellations
['upgradeStandardModifier', 'upgradeUniqueModifier', 'upgradeAbyssalModifier'].forEach((func) => {
	patch(Astrology, func).after(function(_, constellation, modID) {
		if (game.astrology.isConstellationComplete(constellation))
			skillBoosts.removeIcon(constellation);
	});
});


// Update Synergies
patch(Player, 'quickEquipSynergy').before(function(synergy) {
	previousSynergy = player.equippedSummoningSynergy;
});
patch(Player, 'quickEquipSynergy').after(function(_, synergy) {
	if (getCategoryIcons('Synergy').includes(synergy)) {
		addToRenderQueue(synergy, 'synergy', ['bg', 'qty']);
	}
	if (previousSynergy) {
		addToRenderQueue(previousSynergy, 'synergy', ['bg', 'qty']);
		previousSynergy = undefined;
	}
});
patch(Summoning, 'discoverMark').before(function(mark) {
	prevMarkLevel = this.getMarkLevel(mark);
});
patch(Summoning, 'discoverMark').after(function(_, mark) {
	if (this.getMarkLevel(mark) !== prevMarkLevel)
		getCategoryIcons('Synergy').filter(x => x.summons.includes(mark.product)).forEach(synergy => addToRenderQueue(synergy, 'synergy', ['locked']));
});



// Remove all negative obstacles after Agility Master Relic
patch(Agility, 'locateAncientRelic').after(function(o) {
	if (this.numberOfRelicsFound >= 5) {
		skillBoosts.getAllIcons().filter(x => x.category === 'Obstacle' && x.elem === 3).forEach((icon) => skillBoosts.removeIcon(icon.item, icon.elem));
		skillBoosts.setClassByLength();
	}
});

//Update Purchase, Obstacle, and POI bgs on currency change
['add', 'remove'].forEach((func) => {
	patch(Currency, func).after(function(_, amount) {
		if (this === game.raidCoins)
			return;
		addToQueue('currency', this, amount);
	});
});
// Update on Item gain
['addItem', 'removeItemQuantity'].forEach((func) => {
	patch(Bank, func).after(function(success, item, quantity) {
		if (func === 'removeItemQuantity' && quantity > 0)
			success = true;
		if (success)
			addToQueue('items', item, quantity);
	});
});

function addToQueue(queue, obj, quantity = 1) {
	queue = skillBoosts.renderQueue[queue];
	if (queue.has(obj))
		queue.set(obj, queue.get(obj) + quantity);
	else
		queue.set(obj, quantity);
}

function updateCurrency() {
	if (!game.loopStarted || skillBoosts.renderQueue.currency.size === 0)
		return;
	skillBoosts.renderQueue.currency.forEach((qty, currency) => {
		getCategoryIcons('Obstacle').forEach((obstacle) => {
			let costs = skillBoosts.getObstacleCost(obstacle, true)._currencies.get(currency);
			if (!costs) return;
			if (currency.amount >= costs - qty && currency.amount <= costs + qty)
				addToRenderQueue(obstacle, 'obstacle', ['bg']);
		});
		getCategoryIcons('Purchase').forEach((purchase) => {
			let costs = purchase.costs.currencies.find(x => x.currency === currency);
			if (!costs) return;
			if (currency.amount >= costs.cost - qty && currency.amount <= costs.cost + qty) {
				addToRenderQueue(purchase, 'purchase', ['bg']);
			}
		});
		getCategoryIcons('POI').forEach((poi) => {
			let costs = skillBoosts.getTravelCosts(poi)._currencies.get(currency);
			if (!costs) return;
			if (currency.amount >= costs - qty && currency.amount <= costs + qty)
				addToRenderQueue(poi, 'poi', ['bg']);
		});
	});
	skillBoosts.renderQueue.currency.clear();
}

function updateItem() {
	if (!game.loopStarted || skillBoosts.renderQueue.items.size === 0)
		return;
	let newSynergy = player.equippedSummoningSynergy;
	skillBoosts.renderQueue.items.forEach((qty, item) => {
		if (item instanceof EquipmentItem || item instanceof PotionItem) {
			if (getCategoryIcons('Consumable').includes(item))
				addToRenderQueue(item, 'consumable', ['bg', 'qty']);
			else if (getCategoryIcons('Equipment').includes(item))
				addToRenderQueue(item, 'equipment', ['bg']);
			else if (item.validSlots && item.validSlots[0] === game.equipmentSlots.getObjectByID('melvorD:Summon1'))
				getCategoryIcons('Synergy').filter(x => x.summons.some(y => y.product === item)).forEach(synergy => addToRenderQueue(synergy, 'synergy', ['bg', 'qty']));
		}

		let bankQty = game.bank.getQty(item);
		getCategoryIcons('Obstacle').filter(y => y.itemCosts.some(x => x.item === item)).forEach((obstacle) => {
			let costs = skillBoosts.getObstacleCost(obstacle, true)._items;
			costs.forEach((costQty, itm) => {
				if (bankQty >= costQty - qty && bankQty <= costQty + qty)
					addToRenderQueue(obstacle, 'obstacle', ['bg']);
			});
		});
		getCategoryIcons('Purchase').filter(y => y.costs.items.some(x => x.item === item)).forEach((purchase) => {
			purchase.costs.items.forEach(({ itm, costQty }) => {
				if (bankQty >= costQty - qty && bankQty <= costQty + qty) {
					addToRenderQueue(purchase, 'purchase', ['bg']);
				}
			});
		});
	});
	skillBoosts.renderQueue.items.clear();
}

function lazyRender() {
	updateCurrency();
	updateItem();
	skillBoosts.renderMenu();
}

// Misc Patching
// Move the Menu with the Player
patch(SidebarItem, 'click').after(function(o) {
	if (game.skillPageMap.has(game.skills.getObjectByID(this.id)) || this.id === 'melvorD:Combat')
		skillBoosts.onSkillChange(true);
	sideBarClicked = true;
});
patch(BaseManager, 'onCombatPageChange').after(function(o) {
	if (!sideBarClicked)
		setTimeout(() => { skillBoosts.onSkillChange(true); }, 250);
	sideBarClicked = false;
});
patch(Skill, 'selectRealm').after(function(o, realm) {
	if (hasItA && get('autoSwapRealms') && skillBoosts.data.realms.includes(realm))
		skillBoosts.onRealmChange(realm.id);
});
// Introduce custom loops for renderQueue
patch(Game, 'startMainLoop').before(function() {
	if (this.loopStarted)
		return;
	lazyRenderer = window.setInterval(lazyRender, 2000);
	fastRenderer = window.setInterval(skillBoosts.render.bind(skillBoosts), 500);
});
patch(Game, 'stopMainLoop').before(function() {
	if (!this.loopStarted)
		return;
	clearInterval(lazyRenderer);
	clearInterval(fastRenderer);
});
//Fix for black Cartography Map bug
patch(WorldMapDisplayElement, 'setViewportSize').replace(function() {
	if (this.offsetParent === null)
		return;
	this.viewport.resize(this.clientWidth, Math.max(this.clientHeight, 1));
	this.viewport.clampZoom({
		maxWidth: this.viewport.worldWidth,
		maxHeight: this.viewport.worldHeight,
		minWidth: this.clientWidth,
		minHeight: Math.max(this.clientHeight, 1),
	});
	this.computeViewportBorders();
	this.setViewportClamp();
});