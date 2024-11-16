const { getResourceUrl, settings } = mod.getContext('Skill_Boosts'),
	createImgNode = (src, cls) => {
		return createElement('img', { className: cls, attributes: [['src', src]] });
	},
	generalSettings = settings.section('General'),
	getSetting = generalSettings.get,
	player = game.combat.player,
	hasTotH = cloudManager.hasTotHEntitlementAndIsEnabled,
	hasAoD = cloudManager.hasAoDEntitlementAndIsEnabled,
	hasItA = cloudManager.hasItAEntitlementAndIsEnabled,
	melvorRealm = game.realms.getObjectByID('melvorD:Melvor'),
	abyssalRealm = hasItA && game.realms.getObjectByID('melvorItA:Abyssal'),
	synergyLockedIcon = createImgNode(assets.getURI('assets/media/skills/summoning/synergy_locked.png'), 'synergy-locked d-none'),
	inactiveIcon = createImgNode(getResourceUrl('assets/inactive.png'), 'sb-inactive d-none');

// A modified version of Melvor's InfoIcon
class SkillBoostsIconElement extends HTMLElement {
	constructor(category, item) {
		super();
		this.item = item;
		this.category = category;
		this._content = new DocumentFragment();
		this.container = this._content.appendChild(createElement('div', { attributes: [['data-sbMainTooltip', '']] }));

		if ((item instanceof EquipmentItem && this.item.validSlots.length >= 2) || ['Obstacle', 'FillerObstacle', 'POI'].includes(this.category))
			this.container.setAttribute('data-sbAltTooltip', '');
	}
	connectedCallback() {
		this.appendChild(this._content);
	}
	hide() {
		hideElement(this);
	}
	show() {
		showElement(this);
	}
	getDecimals(val) {
		let decimals = 2;
		if (`${val}`.length % 3 === 0)
			decimals = 1;
		return decimals;
	}
	createText() {
		this.text = this.container.appendChild(createElement('div', {
			className: 'pill-center',
		})).appendChild(createElement('small', {
			className: 'badge-pill bg-secondary',
			text: 0
		}));
	}
	setText(qty) {
		this.text.textContent = formatNumber(qty, this.getDecimals(qty));
	}
	setBg(newColor) {
		if (this.bgColor === newColor)
			return;
		this.container.classList.replace(this.bgColor, newColor);
		this.bgColor = newColor;
		this.hasRedBg = this.bgColor === 'sb-red-bg';
	}
	setPillbox(newColor) {
		if (this.pillColor === newColor)
			return;
		this.text.classList.replace(this.pillColor, newColor);
		this.pillColor = newColor;
	}
	setOpacity(opacity) {
		this.style.opacity = opacity;
	}
}

class SkillBoostsIcon extends SkillBoostsIconElement {
	constructor(category, item, media, basicTooltip = false, size = 40) {
		super(category, item);
		this.basicTooltip = basicTooltip;
		this.bgColor = 'sb-default-bg';
		this.pillColor = 'bg-secondary';
		this.container.className = `sb-icon m-1 resize-${size} ${this.bgColor}`;
		this.image = this.container.appendChild(createElement('img', { className: `p-1 resize-${size}` }));

		if (this.category === 'Relic')
			this.skillImage = this.container.appendChild(createElement('img', { className: `p-1 sb-relic-skill`, attributes: [['src', this.item.skill.media]] }));

		if (basicTooltip)
			this.tooltip = createElement('div', { attributes: [['data-sbTooltipContent', '']] }).appendChild(createElement('div', { className: 'font-size-sm' })).parentElement;
		if (media)
			this.setImage(media);

		if (this.category === 'Obstacle')
			this.inactiveIcon = this.container.appendChild(inactiveIcon.cloneNode());

		if (['Consumable', 'POI', 'Astrology'].includes(this.category) || this.item.consumesChargesOn)
			this.createText();
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
		this.bgColor = ['sb-default-bg', 'sb-default-bg'];
		this.pillColor = ['bg-secondary', 'bg-secondary'];
		this.container.className = 'sb-double-icon';
		this.iconContainers = this.container.appendChild(createElement('div', {
			className: 'sb-synergy d-inline-flex',
		}));

		this.iconContainer0 = this.iconContainers.appendChild(createElement('div', {
			className: `${this.bgColor[0]}`
		}));
		this.summon0Media = this.iconContainer0.appendChild(createElement('div', {
			className: 'mr-1',
		})).appendChild(createElement('img', {
			className: 'p-1 resize-40'
		}));

		this.iconContainer1 = this.iconContainers.appendChild(createElement('div', {
			className: `${this.bgColor[1]}`
		}));
		this.summon1Media = this.iconContainer1.appendChild(createElement('div', {
			className: 'ml-1',
		})).appendChild(createElement('img', {
			className: 'p-1 resize-40'
		}));

		if (!game.summoning.isSynergyUnlocked(this.item))
			this.synergyLocked = this.container.appendChild(synergyLockedIcon.cloneNode());

		this.createText();
	}
	createText() {
		this.textContainers = this.container.appendChild(createElement('div', {
			className: 'pill-center pill-group',
		}))
		this.text0 = this.textContainers.appendChild(createElement('small', {
			className: `badge-pill ${this.pillColor[0]}`,
			text: 0
		}));
		this.text1 = this.textContainers.appendChild(createElement('small', {
			className: `badge-pill ${this.pillColor[1]}`,
			text: 0
		}));
	}
	setText(qty0, qty1) {
		this.text0.textContent = formatNumber(qty0, this.getDecimals(qty0));
		this.text1.textContent = formatNumber(qty1, this.getDecimals(qty1));
	}
	setBg(newColors) {
		if (this.bgColor[0] === newColors[0] && this.bgColor[1] === newColors[1])
			return;
		newColors.forEach((color, i) => this[`iconContainer${i}`].classList.replace(this.bgColor[i], color));
		this.bgColor = newColors;
		this.hasRedBg = this.bgColor.every(x => x === 'sb-red-bg');
	}
	setPillbox(newColors) {
		if (this.pillColor[0] === newColors[0] && this.pillColor[1] === newColors[1])
			return;
		newColors.forEach((color, i) => this[`text${i}`].classList.replace(this.pillColor[i], color));
		this.pillColor = newColors;
	}
	setImage() {
		this.summon0Media.src = this.item.summons[0].media;
		this.summon1Media.src = this.item.summons[1].media;
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
			hideElements([this.builtContainer, this.destroyedContainer]);
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
			skillBoosts.MainTooltipController.init(icon.container);
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
		this.iconArr.forEach(item => {
			let icon = new SkillBoostsIcon('Equipment', item, item.media);
			skillBoosts.MainTooltipController.init(icon.container);
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
					icon.setBg('sb-green-bg');
				else if (game.bank.getQty(item) !== 0)
					icon.setBg('sb-default-bg');
				else if (skillBoosts.checkOtherEquipmentSets(item))
					icon.setBg('sb-yellow-bg');
				else
					icon.setBg('sb-red-bg');
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

			[...levelReq, ...obstacle.skillRequirements].forEach(requirement => {
				let textClass = game.checkRequirement(requirement) ? 'text-success' : 'text-danger',
					type = requirement.type === 'SkillLevel' ? 'MENU_TEXT_LEVEL' : 'MENU_TEXT_ABYSSAL_LEVEL',
					newReq = skillBoosts.createInlineRequirement(requirement.skill.media, templateLangString(type, { level: `${requirement.level}` }), textClass);

				skillBoosts.createImageTooltip(newReq.children[0], requirement.skill.name);
				requiresElem.append(newReq);
			});
			if (hasItA && obstacle.abyssalLevel >= 1 && !abyssalRealm.isUnlocked) {
				let reqNode = skillBoosts.getItACompletionNode(true);
				skillBoosts.createImageTooltip(reqNode.children[0], getLangString('DUNGEON_NAME_Into_The_Abyss'));
				requiresElem.append(reqNode);
			}
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
	constructor(config) {
		super();
		this.config = config;
		this.value = config.default;
		this._content = new DocumentFragment();
		this.warning = createElement('span', {
			text: `${langString['SETTING_HEX_FORMAT'][setLang]} #rrggbb`,
			className: 'd-none justify-content-center alert-danger mb-2'
		});
		this.container = createElement('div', {
			className: 'row no-gutters text-center justify-content-around',
		});

		for (let i = 0; i < 5; i++) {
			let { container, picker, input } = this.colorSettingElem(this.value[i]);

			input.addEventListener('change', () => {
				if (input.value[0] !== '#' || input.value.length !== 7) {
					this.warning.classList.replace('d-none', 'd-flex');
					input.value = getSetting('colorBgs')[i];
					return;
				}
				picker.value = input.value;
				this.value[i] = input.value;
				skillBoosts.agilitySetting.updateAllBgs();
				skillBoosts.updateBackgrounds();
				this.warning.classList.replace('d-flex', 'd-none');
			});
			picker.addEventListener('change', () => {
				input.value = picker.value;
				this.value[i] = picker.value;
				skillBoosts.agilitySetting.updateAllBgs();
				skillBoosts.updateBackgrounds();
				this.warning.classList.replace('d-flex', 'd-none');
			});
			this.container.append(container);
		}

		this._content.append(this.warning, this.container);
	}
	connectedCallback() {
		this.appendChild(this._content);
	}
	colorSettingElem(value) {
		let container = createElement('div', { className: 'sb-color-setting' });
		let picker = createElement('input', { className: 'btn-light sb-picker', attributes: [['type', 'color']], parent: container });
		let input = createElement('input', { className: 'form-control form-control-sm text-center sb-input', attributes: [['type', 'text']], parent: container });
		picker.value = value;
		input.value = value;
		return { container, picker, input };
	}
}
window.customElements.define('sb-color-setting', SBColorSetting);

class AgilityCostSetting extends HTMLElement {
	constructor(config) {
		super();
		this.config = config;
		this.value = config.default;
		this._content = new DocumentFragment();
		this.label = createElement('label', { className: 'font-weight-normal text-center w-100', text: this.config.label, parent: this._content });
		this.hint = createElement('small', { className: 'd-block', text: this.config.hint, parent: this.label });
		this.iconContainer = createElement('div', { className: 'row no-gutters justify-content-center', parent: this._content });
	}
	connectedCallback() {
		this.appendChild(this._content);
	}
	init() {
		let lesserRelicDrops = game.woodcutting.rareDrops.filter(x => x.item.id.includes('_Lesser_Relic')),
			items = ['melvorF:Agility_Skillcape'];

		if (hasTotH)
			items.push('melvorTotH:Superior_Agility_Skillcape');
		if (lesserRelicDrops.some(x => x.gamemodes.includes(game.currentGamemode)))
			items.push('melvorAoD:Agility_Lesser_Relic');

		items.forEach(itemID => {
			let item = game.items.getObjectByID(itemID),
				icon = new SkillBoostsIcon('Equipment', item, item.media, true);

			icon.setTooltip(item.name);
			skillBoosts.MainTooltipController.init(icon.container);
			icon.onclick = () => { this.save(icon), this.updateBg(icon); };

			this.iconContainer.append(icon);
			this.updateBg(icon);
		});
	}
	updateBg(icon) {
		icon.setBg(this.value.includes(icon.item.id) ? 'sb-green-bg' : 'sb-red-bg');
	}
	save(icon) {
		if (this.value.includes(icon.item.id))
			this.value.splice(this.value.indexOf(icon.item.id), 1);
		else
			this.value.push(icon.item.id);
	}
	updateAllBgs() {
		this.iconContainer.children.forEach(icon => this.updateBg(icon));
	}
}
window.customElements.define('sb-agility-setting', AgilityCostSetting);

class SBCompactCheckboxGroup extends HTMLElement {
	constructor() {
		super();
		this.checkboxes = [];
		this._content = new DocumentFragment();
	}
	connectedCallback() {
		this.appendChild(this._content);
	}
	init(config) {
		let label = createElement('label', { className: 'font-weight-normal text-center w-100', text: config.label, parent: this._content });
		let checkboxGroup = this._content.appendChild(createElement('div', { className: 'row no-gutters' }));

		if (config.hint)
			createElement('small', { className: 'd-block', text: config.hint, parent: label });

		config.options.forEach((option, i) => {
			let optName = `${config.name}[${i}]`,
				optCheckbox = createElement('input', { id: optName, className: 'custom-control-input', attributes: [['type', 'checkbox'], ['name', optName]] }),
				optLabel = createElement('label', { className: 'font-weight-normal custom-control-label ml-2', attributes: [['for', optName]], text: option.label }),
				control = createElement('div', { className: 'custom-control custom-checkbox custom-control-md mb-1 pl-3 w-50', children: [optCheckbox, optLabel], });

			optCheckbox.value = option.value;
			optCheckbox.addEventListener('change', () => this.save(option.value));
			this.checkboxes.push(optCheckbox);
			checkboxGroup.appendChild(control);
		});
	}
	save(value) {
		if (this.value.includes(value))
			this.value.splice(this.value.indexOf(value), 1);
		else
			this.value.push(value);

		if (!skillBoosts.menu)
			return;
		skillBoosts.getAllIcons().filter(x => x.category === value).forEach(icon => skillBoosts.menu.updateIcon(icon));
		skillBoosts.renderQueue.menu = true;
	}
}
window.customElements.define('sb-checkbox-group', SBCompactCheckboxGroup);

class SBRenderQueue {
	constructor() {
		this.equipment = {
			bg: new Set(),
			charge: new Set()
		};
		this.consumable = {
			bg: new Set(),
			qty: new Set()
		};
		this.obstacle = {
			bg: new Set(),
			active: new Set()
		};
		this.poi = {
			bg: new Set(),
			cost: new Set()
		};
		this.pet = {
			bg: new Set()
		};
		this.purchase = {
			bg: new Set()
		};
		this.constellation = {
			bg: new Set()
		};
		this.synergy = {
			bg: new Set(),
			qty: new Set(),
			locked: new Set()
		};
		this.relic = {
			bg: new Set()
		};
		this.items = new Map();
		this.currency = new Map();
		this.menu = false;
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
};

export { SkillBoostsIcon, SkillBoostsSynergy, SBAgilitySelect, SBRenderQueue, SBCompactCheckboxGroup, AgilityCostSetting, SBColorSetting };