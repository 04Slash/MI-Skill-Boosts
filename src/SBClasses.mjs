const { getResourceUrl, settings, characterStorage } = mod.getContext(
		import.meta),
	generalSettings = settings.section('General'),
	getSetting = generalSettings.get,
	player = game.combat.player,
	melvorRealm = game.realms.getObjectByID('melvorD:Melvor'),
	inactiveIcon = getResourceUrl('assets/inactive.png');

// A modified version of Melvor's InfoIcon
class SkillBoostsIconElement extends HTMLElement {
	constructor(category, item) {
		super();
		this.item = item;
		this.category = category;
		this._content = new DocumentFragment();
		this.container = this._content.appendChild(createElement('div', { attributes: [['data-sbMainTooltip', '']] }));
		if ((item instanceof EquipmentItem && this.item.validSlots.length > 2) || ['Obstacle', 'FillerObstacle', 'Clone', 'POI'].includes(this.category))
			this.container.setAttribute('data-sbAltTooltip', '');
		if (['Consumable', 'POI', 'Astrology', 'Synergy'].includes(this.category) || this.item.consumesChargesOn) {
			this.text = createElement('div', {
				className: `pill-center`,
			}).appendChild(createElement('small', {
				className: `badge-pill bg-secondary`,
				text: 0
			}));
		}
	}
	connectedCallback() {
		this.appendChild(this._content);
	}
	setText(qty, dec = 2) {
		this.text.textContent = formatNumber(qty, dec);
	}
	destroy() {
		this.remove();
	}
	hide() {
		hideElement(this);
	}
	show() {
		showElement(this);
	}
	setBg(hexColor) {
		if (this.bgColor === hexColor)
			return;
		this.bgColor = hexColor; // Value is auto converted to rbg so save the Hex color
		this.container.style.backgroundColor = hexColor;
	}
	setPillbox(style) {
		if (this.text.className.includes(style))
			return;
		this.text.classList.remove('bg-secondary', 'bg-warning', 'bg-danger');
		this.text.classList.add(style);
	}
}

class SkillBoostsIcon extends SkillBoostsIconElement {
	constructor(category, item, media, basicTooltip = false, size = 40) {
		super(category, item);
		this.basicTooltip = basicTooltip;
		this.container.className = `sb-icon m-1 resize-${size}`;
		this.image = this.container.appendChild(createElement('img', { className: `p-1 resize-${size}` }));

		if (this.category === 'Relic')
			this.skillImage = this.container.appendChild(createElement('img', { className: `p-1 sb-relic-skill`, attributes: [['src', this.item.skill.media]] }));

		if (basicTooltip)
			this.tooltip = createElement('div', { attributes: [['data-sbTooltipContent', '']] }).appendChild(createElement('div', { className: 'font-size-sm' })).parentElement;
		if (media)
			this.setImage(media);

		if (this.category === 'Obstacle')
			this.inactiveIcon = this.container.appendChild(createElement('img', { className: 'sb-inactive d-none', attributes: [['src', inactiveIcon]] }));

		if (this.text)
			this.container.append(this.text.parentElement);
	}
	setImage(media) {
		this.image.src = media;
	}
	setTooltip(text) {
		this.tooltip.children[0].textContent = text;
	}
}
window.customElements.define('skillboosts-icon', SkillBoostsIcon);

class SkillBoostsSynergy extends SkillBoostsIconElement {
	constructor(category, synergy) {
		super(category, synergy);
		this.container.className = `sb-synergy-icon`;
		this.iconContainer = this.container.appendChild(createElement('div', {
			className: `d-inline-flex`,
		}));
		this.summon1Image = this.iconContainer.appendChild(createElement('div', {
			className: `mr-1`,
		})).appendChild(createElement('img', {
			className: `p-1 resize-40`,
		}));
		this.summon2Image = this.iconContainer.appendChild(createElement('div', {
			className: `ml-1`,
		})).appendChild(createElement('img', {
			className: `p-1 resize-40`,
		}));
		if (!game.summoning.isSynergyUnlocked(synergy)) {
			this.synergyLocked = this.container.appendChild(createElement('img', {
				className: 'synergy-locked d-none',
				attributes: [['src', assets.getURI('assets/media/skills/summoning/synergy_locked.svg')]]
			}));
		}
		if (this.text)
			this.container.append(this.text.parentElement);
	}
	setText(qty1, qty2, dec = 2) {
		this.text.textContent = `${formatNumber(qty1, dec)} | ${formatNumber(qty2, dec)}`;
	}
	setImage() {
		this.summon1Image.src = this.item.summons[0].media;
		this.summon2Image.src = this.item.summons[1].media;
	}
}
window.customElements.define('skillboosts-synergy', SkillBoostsSynergy);

class SBAgilitySelect extends HTMLElement {
	constructor(built, destroy, iconArr) {
		super();
		this.built = built;
		this.destroyed = destroy;
		this.iconArr = iconArr;
		this.iconMap = new Map();
		this._content = new DocumentFragment();
		this._content.append(getTemplateNode('SkillBoosts-Agility-Selection'));
		const getElem = (id) => getAnyElementFromFragment(this._content, id);
		this.builtContainer = getElem('SB-Built-Container');
		this.builtName = getElem('SB-Built-Name');
		this.builtCosts = getElem('SB-Built-Cost');
		this.requirements = getElem('SB-Built-Requirements');
		this.builtPassives = getElem('SB-Built-Passives');
		this.destroyedContainer = getElem('SB-Destroy-Container');
		this.destroyedName = getElem('SB-Destroy-Name');
		this.destroyedCosts = getElem('SB-Destroy-Cost');
		this.destroyedPassives = getElem('SB-Destroy-Passives');
		this.tiersContainer = getElem('SB-Agi-Tiers');
		this.boostsContainer = getElem('SB-Agi-Boosts');

		this.builtName.textContent = `${getLangString('MENU_TEXT_BUILD')} ${this.built.name}?`;
		if (this.destroyed) {
			this.destroyedName.textContent = `${getLangString('MENU_TEXT_DESTROY')} ${this.destroyed.name}?`;
			showElement(this.destroyedContainer);
		}
		if (this.built === this.destroyed)
			hideElements([this.builtContainer, this.destroyedContainer])
		this.built instanceof AgilityObstacle ? this.setObstacles() : this.setPillars();

		if (this.built.realm === melvorRealm) {
			this.costReductionItems();
			this.updateBgs();
		}
		this.createAllTierIcons();
	}
	connectedCallback() {
		this.appendChild(this._content);
	}
	createAllTierIcons() {
		let type = skillBoosts.getObstacleType(this.built) === 'Obstacle';
		let obstacles = type ? game.agility.sortedMasteryActions : game.agility.pillars.allObjects;
		let sortedObstacles = obstacles.filter(x => x.category === this.built.category && x.realm === this.built.realm && this.built.slot.obstacleCount === x.slot.obstacleCount);
		sortedObstacles.forEach(obstacle => {
			if (obstacle === this.destroyed)
				return;
			let icon = new SkillBoostsIcon('', obstacle, obstacle.media, false);
			skillBoosts.mainTooltipController.init(icon.container);
			icon.container.onclick = () => {
				this.built = obstacle;
				this.builtName.textContent = `${getLangString('MENU_TEXT_BUILD')} ${this.built.name}?`;
				type ? this.setObstacles(false) : this.setPillars(false);
				this.updateBuildButton();
			};
			this.tiersContainer.append(icon);
			skillBoosts.updateObstacleBg(obstacle, icon, false);
		});
	}
	setObstacles(updateDestroyed = true) {
		this.setObstacle(this.built, this.builtCosts, this.builtPassives, this.requirements);
		if (this.destroyed && updateDestroyed)
			this.setObstacle(this.destroyed, this.destroyedCosts, this.destroyedPassives);
	}
	setPillars(updateDestroyed = true) {
		this.setPillar(this.built, this.builtCosts, this.builtPassives);
		if (this.destroyed && updateDestroyed)
			this.setPillar(this.destroyed, this.destroyedCosts, this.destroyedPassives);
	}
	buildObstacle() {
		let type = skillBoosts.getObstacleType(this.built) === 'Obstacle';
		if (!skillBoosts.canBuildObstacle(this.built) || this.built === this.destroyed)
			return;
		type ? game.agility.buildObstacle(this.built) : game.agility.buildPillar(this.built);
		skillBoosts.renderObstacleBg();
	}
	updateCosts() {
		let costs = skillBoosts.getObstacleCost(this.built);
		skillBoosts.setObstacleCosts(costs.getItemQuantityArray(), costs.getCurrencyQuantityArray(), this.builtCosts, true);
		if (this.destroyed) {
			let dcosts = skillBoosts.getObstacleCost(this.destroyed);
			skillBoosts.setObstacleCosts(dcosts.getItemQuantityArray(), dcosts.getCurrencyQuantityArray(), this.destroyedCosts, true);
		}
	}
	costReductionItems() {
		let fragment = new DocumentFragment();
		this.iconArr.forEach((item) => {
			let icon = new SkillBoostsIcon('Equipment', item, item.media);
			skillBoosts.mainTooltipController.init(icon.container);
			fragment.append(icon);
			icon.container.onclick = () => {
				if (game.bank.getQty(item) !== 0) {
					player.equipItem(item, player.selectedEquipmentSet, item.validSlots[0], game.bank.getQty(item));
					this.updateBgs();
					this.updateCosts();
					this.updateBuildButton();
				}
			};
			this.iconMap.set(icon, item);
		});
		this.boostsContainer.append(fragment);
	}
	updateBuildButton() {
		let buildBtn = SwalLocale.getConfirmButton();
		if (skillBoosts.canBuildObstacle(this.built) && !this.built.isBuilt)
			buildBtn.style = ``;
		else
			buildBtn.style = `display: none;`;
		showElement(this.builtContainer);
		if (this.destroyed)
			showElement(this.destroyedContainer);
	}
	updateBgs() {
		this.iconMap.forEach((item, icon) => {
			if (item instanceof EquipmentItem) {
				if (player.equipment.checkForItem(item))
					icon.setBg(getSetting('colorBgs')[0]);
				else if (game.bank.getQty(item) !== 0)
					icon.setBg(getSetting('colorBgs')[3]);
				else if (skillBoosts.checkOtherEquipmentSets(item))
					icon.setBg(getSetting('colorBgs')[1]);
				else
					icon.setBg(getSetting('colorBgs')[2]);
			}
		});
	};
	setPassives(obstacle, passivesElem, negMult = 1) {
		const createElem = (desc, textClass) => {
			return createElement('h5', {
				className: `${textClass} font-size-sm font-w400 m-1`,
				text: desc,
				parent: passivesElem,
			});
		};
		passivesElem.innerHTML = '';
		passivesElem.append(...skillBoosts.getModifierNodes(obstacle, negMult, 1, false));
	}
	setObstacle(obstacle, costsElem, passivesElem, requiresElem) {
		if (requiresElem)
			requiresElem.textContent = getLangString('MENU_TEXT_REQUIRES');
		const costs = skillBoosts.getObstacleCost(obstacle);
		skillBoosts.setObstacleCosts(costs.getItemQuantityArray(), costs.getCurrencyQuantityArray(), costsElem, true);
		if (requiresElem) {
			let levelReq = [new SkillLevelRequirement({ skillID: game.agility.id, level: obstacle.slot.level }, game)];
			if (obstacle.abyssalLevel > 0)
				levelReq.push(new AbyssalLevelRequirement({ skillID: game.agility.id, level: obstacle.slot.abyssalLevel }, game));
				[...levelReq, ...obstacle.skillRequirements].forEach((requirement) => {
				const textClass = game.checkRequirement(requirement, false) ? 'text-success' : 'text-danger';
				let type = requirement.type === 'SkillLevel' ? 'MENU_TEXT_LEVEL' : 'MENU_TEXT_ABYSSAL_LEVEL';
				let newReq = skillBoosts.createInlineRequirement(requirement.skill.media, templateLangString(type, { level: `${requirement.level}` }), textClass);
				skillBoosts.createImageTooltip(newReq.children[0], requirement.skill.name);
				requiresElem.append(newReq);
			});
		}
		this.setPassives(obstacle, passivesElem, game.agility.getObstacleNegMult(obstacle));
	}
	setPillar(pillar, costsElem, passivesElem) {
		const costs = game.agility.getPillarBuildCosts(pillar);
		skillBoosts.setObstacleCosts(costs.getItemQuantityArray(), costs.getCurrencyQuantityArray(), costsElem, true);
		this.setPassives(pillar, passivesElem);
	}
}
window.customElements.define('sb-agility-select', SBAgilitySelect);

class SBColorSetting extends HTMLElement {
	constructor() {
		super();
		this._content = new DocumentFragment();
		this.parent = this._content.appendChild(createElement('div', { className: 'text-center' }));
		this.warning = createElement('span', {
			text: `${langString['SETTING_HEX_FORMAT'][setLang]} #rrggbb`,
			className: 'd-none justify-content-center alert-danger'
		});
		this.container = createElement('div', {
			className: 'row no-gutters text-center justify-content-around',
		});
		for (let i = 1; i < 6; i++) {
			let setting = this.colorSettingElem(),
				input = setting.querySelector('#input'),
				picker = setting.querySelector('#SB-picker');
			input.addEventListener('change', () => {
				if (input.value[0] !== '#') {
					this.warning.classList.replace('d-none', 'd-flex');
					this.load();
					return;
				}
				this.warning.classList.replace('d-flex', 'd-none');
				this.save('#input');
			});
			picker.addEventListener('change', () => {
				input.value = `${picker.value}`;
				this.warning.classList.replace('d-flex', 'd-none');
				this.save('#SB-picker');
			});
			this.container.append(setting);
		};
		this.parent.append(this.warning, this.container);
	}
	connectedCallback() {
		this.appendChild(this._content);
	}
	colorSettingElem() {
		return createElement('div', {
			className: 'sb-color-setting',
			children: [
				createElement('div', {
					children: [
						createElement('input', {
							id: 'SB-picker',
							className: 'btn-light sb-picker',
							attributes: [['type', 'color']]
						}),
						createElement('input', {
							id: 'input',
							className: 'form-control form-control-sm text-center sb-input',
							attributes: [['type', 'text']]
						})
					]
				})
			]
		});
	}
	load() {
		getSetting('colorBgs').forEach((value, i) => {
			this.container.querySelectorAll('#SB-picker')[i].value = value;
			this.container.querySelectorAll('#input')[i].value = value;
		});
	}
	save(id) {
		let values = [];
		this.container.querySelectorAll(id).forEach((elem) => { values.push(elem.value); });
		generalSettings.set('colorBgs', values);
		this.load();
		skillBoosts.updateBackgrounds(values);
		agiCostSetting.updateBgs();
	}
}
window.customElements.define('sb-color-setting', SBColorSetting);

class AgilityCostSetting extends HTMLElement {
	constructor() {
		super();
		this._content = new DocumentFragment();
		this.parent = this._content.appendChild(createElement('div', { className: 'text-center' }));
		this.items = ['melvorF:Agility_Skillcape'];
		this.icons = new Map();
		this.itemsContainer = createElement('div', { className: `row no-gutters justify-content-center` });
		this.parent.append(this.itemsContainer);
	}
	connectedCallback() {
		this.appendChild(this._content);
	}
	init() {
		if (cloudManager.hasTotHEntitlementAndIsEnabled)
			this.items.push('melvorTotH:Superior_Agility_Skillcape');
		if (game.currentGamemode.id === 'melvorAoD:AncientRelics')
			this.items.push('melvorAoD:Agility_Lesser_Relic');
		this.items.forEach((itemID) => { this.createIcons(itemID), this.updateBgs(itemID, false); });
	}
	createIcons(itemID) {
		let item = game.items.getObjectByID(itemID),
			icon = new SkillBoostsIcon('Equipment', item, item.media, true);
		icon.setTooltip(item.name);
		skillBoosts.mainTooltipController.init(icon.container);
		this.itemsContainer.append(icon);
		icon.container.onclick = () => { this.updateBgs(itemID, true); };
		this.icons.set(itemID, icon);
	}
	updateBgs(itemID, save) {
		let items = skillBoosts.data.filteredItems.get('agi'),
			icons = [this.icons.get(itemID)];
		if (icons[0] === undefined)
			icons = this.icons;
		icons.forEach((icon) => {
			if (items.includes(icon.item.id))
				icon.setBg(getSetting('colorBgs')[save ? 2 : 0]);
			else
				icon.setBg(getSetting('colorBgs')[save ? 0 : 2]);
		});
		if (save) {
			items.includes(itemID) ? items.splice(items.indexOf(itemID), 1) : items.push(itemID);
			skillBoosts.updateAllObstacles();
			SBSave.save();
		}
	}
}
window.customElements.define('sb-agility-setting', AgilityCostSetting);

// Credits to Psycast (Equipment Presents) for the following "SBSaving" system
// https://mod.io/g/melvoridle/m/psy-equipment-presets
// crc32
class SBSaving {
	constructor() {
		this.crcTable = [];
		this.crcMap;
		this.SAVE_VERSION = 2;
	}
	initAndLoad() {
		this.makeCRCTable();
		this.crcCreateMapID();
		this.load();
		delete this.crcMap.from;
	}
	makeCRCTable() {
		var c;
		for (var n = 0; n < 256; n++) {
			c = n;
			for (var k = 0; k < 8; k++) {
				c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
			}
			this.crcTable[n] = c;
		}
	}
	crc32(str) {
		var crc = 0 ^ (-1);
		for (var i = 0; i < str.length; i++) {
			crc = (crc >>> 8) ^ this.crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
		}
		return (crc ^ (-1)) >>> 0;
	}
	crcCreateMapID() {
		const crcStrings = [
			...game.skills.allObjects,
			...game.realms.allObjects,
			...game.items.equipment.allObjects,
			...game.items.potions.allObjects,
			...game.agility.actions.allObjects,
			...game.agility.pillars.allObjects,
			...game.pets.allObjects,
			...game.shop.purchases.allObjects,
			...game.astrology.actions.allObjects,
			...game.summoning.actions.allObjects,
			...game.ancientRelics.allObjects
		];
		if (cloudManager.hasAoDEntitlementAndIsEnabled) {
			game.cartography.worldMaps.forEach((map) => {
				crcStrings.push(...map.pointsOfInterest.allObjects);
			});
		};
		let mappedIDs = crcStrings.map(item => item.id);
		mappedIDs.push('0', '1', 'mf', 'agi', 'Default Sorting');
		game.summoning.synergies.forEach(({ summons }) => mappedIDs.push(`${summons[0].id}+${summons[1].id}`));
		for (let i = 1; i < 16; i++) {
			mappedIDs.push(`Skill_Boosts:${i}SB`);
			if (i < 13)
				mappedIDs.push(`Skill_Boosts:${i}-SB`);
		}
		const items = [...new Set(mappedIDs)]; // deduplicate
		const crcFrom = new Map(items.map(item => [this.crc32(item), item]));
		const crcTo = new Map(items.map(item => [item, this.crc32(item)]));

		if (items.length !== crcFrom.size || items.length !== crcTo.size) {
			console.warn(`[Skill Boosts] CRC Array length doesn't match Map sizes, possible duplicate!`);
		}
		this.crcMap = {
			from: crcFrom,
			to: crcTo
		};
	};
	readMapping(crc) {
		if (crc === 0x0)
			return null;

		const item = this.crcMap.from.get(crc);
		if (!item) {
			//console.warn(`[Skill Boosts] Decoded CRC had no matching item: 0x${crc.toString(16)}`);
			return null;
		}
		return item;
	};
	load() {
		const compressedData = characterStorage.getItem('saveData');
		if (compressedData)
			this.decode(compressedData, skillBoosts.data);
	}
	save() {
		const compressedData = this.encode(skillBoosts.data);
		try {
			characterStorage.setItem('saveData', compressedData);
		} catch (e) {
			notifyPlayer(game.combat, `[Skill Boosts]: ${e}`, 'danger');
		}
	}
	decode(saveString, data) {
		const reader = new SaveWriter('Read', 1);
		try {
			reader.setRawData(fflate.unzlibSync(fflate.strToU8(atob(saveString), true)).buffer);

			let MAGIC = reader.getString();
			if (MAGIC !== 'PLMV') {
				console.error("[Skill Boosts] Invalid Preset Config Magic:", MAGIC.substr(0, 4));
				return [];
			}

			let version = reader.getUint16();
			if (version > this.SAVE_VERSION)
				throw new Error('[Skill Boosts] Save version higher then script version.');

			let len = reader.getUint16();
			for (let i = 0; i < len; i++) {
				let item = this.readMapping(reader.getUint32());
				let lenSkill = reader.getUint16();
				let skills = [];
				for (let i = 0; i < lenSkill; i++) {
					let skill = this.readMapping(reader.getUint32());
					if (skill !== null)
						skills.push(skill);
				};
				if (item !== null)
					data.filteredItems.set(item, skills);
			}
			len = reader.getUint16();
			for (let i = 0; i < len; i++) {
				let skill = this.readMapping(reader.getUint32());
				let state = this.readMapping(reader.getUint32());
				if (skill !== null && state !== null)
					data.menuStates.set(skill, state);
			}
			if (version >= 2) {
				len = reader.getUint16();
				for (let i = 0; i < len; i++) {
					let skill = this.readMapping(reader.getUint32());
					let realm = this.readMapping(reader.getUint32());
					if (skill !== null && realm !== null)
						data.realmStates.set(skill, realm);
				}
			}
		} catch (_a) {
			console.error("[Skill Boosts] Config Reader Error", _a);
		}
	}
	encode(data) {
		const writeUint32 = (value) => writer.writeUint32(this.crcMap.to.get(value) || 0);
		let writer = new SaveWriter('Write', 128);

		writer.writeString('PLMV');
		writer.writeUint16(this.SAVE_VERSION);

		writer.writeUint16(data.filteredItems.size);
		data.filteredItems.forEach((skillArr, item) => {
			writeUint32(item);
			writer.writeUint16(skillArr.length);
			skillArr.forEach((skill) => {
				writeUint32(skill);
			});
		});

		writer.writeUint16(data.menuStates.size);
		data.menuStates.forEach((state, skill) => {
			writeUint32(skill);
			writeUint32(state);
		});

		writer.writeUint16(data.realmStates.size);
		data.realmStates.forEach((realm, skill) => {
			writeUint32(skill);
			writeUint32(realm);
		});

		const rawSaveData = writer.getRawData();
		const compressedData = fflate.strFromU8(fflate.zlibSync(new Uint8Array(rawSaveData)), true);
		const saveString = btoa(compressedData);
		return saveString;
	}
}

const langString = {
	'SETTING_HEX_FORMAT': {
		'en': 'Format:',
		'zh-CN': '格式：',
		'zh-TW': '格式：',
		'fr': 'Format:',
		'de': 'Format:',
		'it': 'Formato:',
		'ko': '체재:',
		'ja': 'フォーマット：',
		'pt': 'Formatar:',
		'pt-br': 'Formatar:',
		'es': 'Formato:',
		'ru': 'Формат:',
		'tr': 'Biçim:',
	},
}
let SBSave = new SBSaving();
let customColorSetting = new SBColorSetting();
let agiCostSetting = new AgilityCostSetting();

export { SBSave, SkillBoostsIcon, SkillBoostsSynergy, SBAgilitySelect, customColorSetting, agiCostSetting };