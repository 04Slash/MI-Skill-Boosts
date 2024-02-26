export async function setup({ settings, loadModule, loadTemplates, onModsLoaded, onInterfaceReady, getResourceUrl }) {
	await loadTemplates("template.html");
	const lang = await loadModule('localization.mjs');
	const getLang = (key) => {
		if (!lang['lang'][key]) {
			return `SkillBoosts: Undefined Lang`;
		}
		return lang['lang'][key][setLang] ? lang['lang'][key][setLang] : lang['lang'][key]['en'];
	};
	const { SBSave } = await loadModule('src/Saving.mjs');
	const { SkillBoostIcon } = await loadModule('src/SBIcon.mjs');
	const { getGlobalModifiers, getSkillModifiers, getMappedModifiers, hasMappedModifier, sortModdedSkill } = await loadModule('src/ModifierData.mjs');

	const generalSettings = settings.section('General'),
		get = generalSettings.get,
		player = game.combat.player,
		hasAoD = cloudManager.hasAoDEntitlement,
		slotTypes = ['Weapon', 'Shield', 'Helmet', 'Platebody', 'Platelegs', 'Boots', 'Gloves', 'Cape', 'Amulet', 'Ring', 'Gem', 'Consumable', 'Summon1', 'Quiver'],
		bannedModifiers = ['increasedChanceToDodgeCrystallization', 'increasedBarrierSummonDamage', 'increasedFlatBarrierSummonDamage', 'allowUnholyPrayerUse', 'increasedMinElementalSpellDmg', 'increasedAmmoPreservation', 'increasedMinAirSpellDmg', 'increasedMinWaterSpellDmg', 'increasedMinEarthSpellDmg', 'increasedMinFireSpellDmg', 'increasedPoisonSpellAccuracy', 'increasedInfernalSpellAccuracy', 'increasedLightningSpellAccuracy', 'decreasedAltMagicSkillXP'],
		providedRunes = ['melvorD:Air_Rune', 'melvorD:Water_Rune', 'melvorD:Earth_Rune', 'melvorD:Fire_Rune', 'melvorF:Nature_Rune', 'melvorF:Spirit_Rune', 'melvorF:Lava_Rune', 'melvorF:Mud_Rune', 'melvorTotH:Soul_Rune', 'melvorTotH:Infernal_Rune'];

	let filterMode = 0,
		massFiltering = 0,
		pillarIcon = getResourceUrl('assets/pillar.png'),
		elitePillarIcon = getResourceUrl('assets/elite_pillar.png'),
		passiveImg = getResourceUrl('assets/passive_slot_filled.png'),
		passiveIcon = createElement('img', {
			className: 'inactive-sb',
			attributes: [['src', passiveImg]]
		});

	//Add Info tooltips to the Info Circles
	function tooltipTemplate(text2, text1 = '', cls = '') {
		return `•<span class="font-w600 ${cls}">${text1}</span> ${text2}.<br>`;
	};
	let textClass = 'font-w600 d-flex justify-content-center text-info font-size-h6';
	let filteredBackground = `${tooltipTemplate(getLang('FILTERED_ICON'), getLang('FILTER_BG'), 'filterBg')}`;
	let filteringTT = `${getLang('FILTERING_DESC_1')}<br>${getLang('FILTERING_DESC_2')}<br>${getLang('FILTERING_DESC_3')}`;
	let equipmentTT = `<span class="${textClass}">${getLang('EQUIPMENT_INFO')}</span>
		${tooltipTemplate(getLang('ITEM_DESC_1'), getLang('GREEN_BG'), 'greenBg')}
		${tooltipTemplate(getLang('ITEM_DESC_2'), getLang('DEFAULT_BG'), 'defaultBg')}
		${tooltipTemplate(getLang('ITEM_DESC_3'), getLang('YELLOW_BG'), 'yellowBg')}
		${tooltipTemplate(getLang('ITEM_DESC_4'), getLang('RED_BG'), 'redBg')}
		${filteredBackground}
		${tooltipTemplate(getLang('ITEM_DESC_5'), getLang('YELLOW_PB'), 'badge-pill bg-warning')}
		•<img class="skill-icon-xxs" src=${passiveImg}>${getLang('PASSIVE')}</img><br>
		${tooltipTemplate(getLang('ITEM_DESC_6'))}
		${tooltipTemplate(getLang('ITEM_DESC_7'))}`;
	let poiTT = `<span class="${textClass}">${getLang('POI_INFO')}</span>
		${tooltipTemplate(getLang('POI_DESC_1'), getLang('GREEN_BG'), 'greenBg')}
		${tooltipTemplate(getLang('POI_DESC_2'), getLang('DEFAULT_BG'), 'defaultBg')}
		${tooltipTemplate(getLang('POI_DESC_3'), getLang('YELLOW_BG'), 'yellowBg')}
		${tooltipTemplate(getLang('POI_DESC_4'), getLang('RED_BG'), 'redBg')}
		${filteredBackground}
		${tooltipTemplate(getLang('POI_DESC_5'), getLang('RED_PB'), 'badge-pill bg-danger')}
		${tooltipTemplate(getLang('POI_DESC_6'))}`;
	let obstaclesTT = `<span class="${textClass}">${getLang('OBSTACLES')}</span>
		${tooltipTemplate(getLang('OBSTACLE_DESC_1'), getLang('GREEN_BG'), 'greenBg')}
		${tooltipTemplate(getLang('OBSTACLE_DESC_2'), getLang('DEFAULT_BG'), 'defaultBg')}
		${tooltipTemplate(getLang('OBSTACLE_DESC_3'), getLang('YELLOW_BG'), 'yellowBg')}
		${tooltipTemplate(getLang('OBSTACLE_DESC_4'), getLang('RED_BG'), 'redBg')}
		${filteredBackground}
		•<img class='skill-icon-xxs' src=${getResourceUrl('assets/inactive.png')}>${getLang('INACTIVE')}</img><br>
		${tooltipTemplate(getLang('OBSTACLE_DESC_5'))}`;
	let otherTT = `<span class="${textClass}">${getLang('PETSPURCHASES')}</span>
		${tooltipTemplate(getLang('PURCHASE_DESC_1'), getLang('GREEN_BG'), 'greenBg')}
		${tooltipTemplate(getLang('OBSTACLE_DESC_3'), getLang('YELLOW_BG'), 'yellowBg')}
		${tooltipTemplate(getLang('OTHER_DESC_1'), getLang('RED_BG'), 'redBg')}
		${filteredBackground}
		${tooltipTemplate(getLang('PURCHASE_DESC_3'))}
		${tooltipTemplate(getLang('AUTOMATICALLY_HIDE'))}`;

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
			this.builtName = getElem('SB-Built-Name');
			this.builtCosts = getElem('SB-Built-Cost');
			this.requirements = getElem('SB-Built-Requirements');
			this.builtPassives = getElem('SB-Built-Passives');
			this.destroyedName = getElem('SB-Destroy-Name');
			this.destroyedCosts = getElem('SB-Destroy-Cost');
			this.destroyedPassives = getElem('SB-Destroy-Passives');
			this.boostsContainer = getElem('SB-Agi-Boosts');

			this.builtName.textContent = `${getLangString('MENU_TEXT_BUILD')} ${this.built.name}?`;
			if (this.destroyed) {
				this.destroyedName.textContent = `${getLangString('MENU_TEXT_DESTROY')} ${this.destroyed.name}?`;
				showElement(getElem('SB-Destroy-Container'));
			}

			if (this.built instanceof AgilityObstacle)
				this.setObstacles();
			else
				this.setPillars();
			this.costReductionItems();
			this.updateBgs();
		}
		connectedCallback() {
			this.appendChild(this._content);
		}
		setObstacles() {
			this.setObstacle(this.built, this.builtCosts, this.builtPassives, this.requirements);
			if (this.destroyed)
				this.setObstacle(this.destroyed, this.destroyedCosts, this.destroyedPassives);
		}
		setPillars() {
			this.setPillar(this.built, this.builtCosts, this.builtPassives);
			if (this.destroyed)
				this.setPillar(this.destroyed, this.destroyedCosts, this.destroyedPassives);
		}
		updateCosts() {
			let costs = skillBoosts.getObstacleCost(this.built);
			skillBoosts.setObstacleCosts(costs.getItemQuantityArray(), costs.gp, costs.sc, this.builtCosts, true);
			if (this.destroyed) {
				let dcosts = skillBoosts.getObstacleCost(this.destroyed);
				skillBoosts.setObstacleCosts(dcosts.getItemQuantityArray(), dcosts.gp, dcosts.sc, this.destroyedCosts, true);
			}
		}
		costReductionItems() {
			let fragment = new DocumentFragment();
			this.iconArr.forEach((item) => {
				let icon = new SkillBoostIcon(item, item.media, createItemInformationTooltip(item));
				fragment.append(icon.container);
				icon.container.onclick = () => {
					if (game.bank.getQty(item) !== 0) {
						player.equipItem(item, player.selectedEquipmentSet, 'Default', game.bank.getQty(item));
						this.updateBgs();
						this.updateCosts();
						let buildBtn = SwalLocale.getConfirmButton();
						if (skillBoosts.canBuildObstacle(this.built))
							buildBtn.style = ``;
						else
							buildBtn.style = `display: none;`;
					}
				};
				this.iconMap.set(icon, item);
			});
			this.boostsContainer.append(fragment);
		}
		updateBgs() {
			this.iconMap.forEach((item, icon) => {
				if (item instanceof EquipmentItem) {
					if (player.equipment.checkForItem(item))
						icon.setBg('greenBg');
					else if (game.bank.getQty(item) !== 0)
						icon.setBg('btn-light');
					else if (skillBoosts.checkOtherEquipmentSets(item))
						icon.setBg('yellowBg');
					else
						icon.setBg('redBg');
				}
			});
		};
		setPassives(passives, passivesElem) {
			let elems = [...passives.getModifierDescriptionsAsNodes('h5', ['font-sm-sb', 'font-w400', 'm-1'])];
			elems.forEach((elem) => {
				if (elem.classList.contains('font-w700'))
					elem.classList.remove('font-w700', 'font-w400');
				passivesElem.append(elem);
			});
		};
		setObstacle(obstacle, costsElem, passivesElem, requiresElem) {
			if (requiresElem)
				requiresElem.textContent = getLangString('MENU_TEXT_REQUIRES');
			const costs = skillBoosts.getObstacleCost(obstacle);
			skillBoosts.setObstacleCosts(costs.getItemQuantityArray(), costs.gp, costs.sc, costsElem, true);
			if (requiresElem) {
				if (obstacle.skillRequirements.length === 0) {
					requiresElem.append(createElement('span', {
						className: ['font-sm-sb font-w400 mr-2 ml-2 text-success'],
						text: getLangString('MENU_TEXT_NO_REQUIREMENT'),
					}));
				} else {
					obstacle.skillRequirements.forEach((requirement) => {
						const textClass = game.checkSkillRequirement(requirement, false) ? 'text-success' : 'text-danger';
						let newReq = skillBoosts.createInlineRequirement(requirement.skill.media, templateLangString('MENU_TEXT_LEVEL', { level: `${requirement.level}` }), textClass);
						skillBoosts.createImageTooltip(newReq.children[0], requirement.skill.name);
						requiresElem.append(newReq);
					});
				}
			}
			this.setPassives(game.agility.getObstacleModifiers(obstacle), passivesElem);
		}
		setPillar(pillar, costsElem, passivesElem) {
			const costs = game.agility.getPillarBuildCosts(pillar);
			skillBoosts.setObstacleCosts(costs.getItemQuantityArray(), costs.gp, costs.sc, costsElem, true);
			this.setPassives(game.agility.getPillarModifiers(pillar), passivesElem);
		}
	}
	window.customElements.define('sb-agility-select', SBAgilitySelect);

	class SBRenderQueue {
		constructor() {
			this.equipment = {
				bg: new Set()
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
			this.purchase = {
				bg: new Set(),
				cost: new Set(),
				requirements: new Set()
			};
			this.items = new Map();
			this.currency = new Map();
			this.menu = false;
		}
	}

	class SkillBoostMenu extends HTMLElement {
		constructor() {
			super();
			this._content = new DocumentFragment();
			this._content.append(getTemplateNode('SkillBoosts-Menu-Template'));
			const getElem = (id) => getAnyElementFromFragment(this._content, id);
			this.btns = getElem('SB-Btns');
			this.container = getElem('SB-Menu-Container');
			this.iconMenu = getElem('SB-Icon-Menu');
			this.skillDropdown = getElem('SB-Skill-Dropdown');
			this.dropDownItems = getElem('SB-Dropdown-Items');
			this.buttons = [getElem('SB-Filter-Btn'), getElem('SB-Boosts-Btn')];
			this.alert = getElem('SB-Alert');
			this.massFilterToggle = getElem('SB-Mass-Filtering');
			this.skillName = getElem('SB-Current-Skill');
			this.iconContainers = [];
			this.iconParents = [];
			['Global', 'Equipment', 'Positive', 'Negative', 'Other'].forEach((category) => { this.iconContainers.push(getElem(`SB-${category}-Icons`)), this.iconParents.push(getElem(`SB-${category}-Container`)); });

			this.buttons[0].onclick = () => this.toggleFilterModeOnClick();
			this.buttons[1].onclick = () => this.toggleMenu(false);
			this.massFilterToggle.onclick = () => this.toggleMassFiltering(this.massFilterToggle.checked);
			this.iconParents.forEach((parent) => { parent.shownIcons = 0; });
			this.container.totalIcons = 0;

			this.initMenu();
		}
		connectedCallback() {
			this.appendChild(this._content);
		}
		initMenu() {
			this.updateMenu();
			this.toggleMassFiltering(skillBoosts.data.menuStates.get('mf') === '1' ? true : false);
			skillBoosts.renderQueue.menu = true;
		}
		updateMenu() {
			skillBoosts.data.skills.forEach((skill) => {
				this.dropDownItems.append(this.createDropdownItem(skill));
			});
			this.skillDropdown.append(this.getSkillItem(skillBoosts.selectedSkill), skillBoosts.selectedSkill.name);
			this.skillName.textContent = skillBoosts.selectedSkill.name;
			this.toggleMenu(true);
			this.translate(this.container);
			this.createTooltips();
		}
		translate(element) {
			element.getElementsByTagName('sb-lang').forEach((elem) => {
				let id = elem.getAttribute('sb-lang-id');
				elem.textContent = getLang(`${id}`);
			});
		}
		createTooltips() {
			let tooltips = [filteringTT, equipmentTT, poiTT, obstaclesTT, obstaclesTT, otherTT];
			this.container.querySelectorAll('#SB-Info').forEach((info, i) => {
				tippy(info, {
					content: tooltips[i],
					placement: 'top',
					allowHTML: true,
					interactive: false,
					animation: false,
				});
			});
		}
		createDropdownItem(skill) {
			const item = createElement('a', { className: 'dropdown-item pointer-enabled' });
			item.append(this.getSkillItem(skill));
			item.append(skill.name);
			item.onclick = () => { skillBoosts.updateForSkillChange(skill.id, false); };
			return item;
		}
		getSkillItem(skill) {
			const img = createElement('img', { className: 'icon-xs-sb' });
			img.src = skill.media;
			return img;
		}
		toggleMenu(onLoad) {
			if (skillBoosts.skillPage === undefined)
				return;
			let state = skillBoosts.data.menuStates.get(skillBoosts.skillPage) === '1' ? true : false;
			onLoad ? state = !state : skillBoosts.data.menuStates.set(skillBoosts.skillPage, `${state ? '0' : '1'}`);
			state ? hideElement(this.iconMenu) : showElement(this.iconMenu);
			if (skillBoosts.skillPage === 'melvorAoD:Cartography')
				skillBoosts.updateCartographyMap();
			SBSave.save();
		}
		toggleMassFiltering(checked) {
			this.massFilterToggle.checked = checked;
			massFiltering = checked ? 1 : 0;
			skillBoosts.data.menuStates.set('mf', `${massFiltering}`);
			SBSave.save();
		}
		toggleFilterAlert() {
			if (filterMode)
				this.alert.classList.remove('d-none');
			else
				this.alert.classList.add('d-none');
		}
		toggleFilterModeOnClick() {
			filterMode = 1 - filterMode;
			this.toggleFilterAlert();
			this.toggleAllFilteredIcons();
			skillBoosts.setClassByLength();
		}
		toggleAllFilteredIcons() {
			skillBoosts.data.icons.filter(x => x.skill === skillBoosts.selectedSkill && x.isFiltered).forEach((icon) => {
				let parent = icon.container.parentElement.parentElement;
				if (filterMode) {
					icon.show();
					parent.shownIcons++;
					this.container.totalIcons++;
				} else {
					icon.hide();
					parent.shownIcons--;
					this.container.totalIcons--;
				}
			});
		}
		updateSkillIcons(icon) {
			if (icon === undefined || icon.category === undefined || icon.category === 'Pet')
				return;
			if (icon.category === 'Equipment')
				skillBoosts.renderQueue.equipment.bg.add(icon.item);
			else if (icon.category === 'Consumable') {
				skillBoosts.renderQueue.consumable.bg.add(icon.item);
				skillBoosts.renderQueue.consumable.qty.add(icon.item);
			} else if (icon.category === 'Obstacle') {
				skillBoosts.renderQueue.obstacle.bg.add(icon.item);
				skillBoosts.renderQueue.obstacle.active.add(icon.item);
			} else if (icon.category === 'Purchase') {
				skillBoosts.renderQueue.purchase.cost.add(icon.item);
				skillBoosts.renderQueue.purchase.requirements.add(icon.item);
				skillBoosts.renderQueue.purchase.bg.add(icon.item);
			} else if (icon.category === 'POI') {
				skillBoosts.renderQueue.poi.bg.add(icon.item);
				skillBoosts.renderQueue.poi.cost.add(icon.item);
			} else
				console.warn(`[Skill Boosts]: ${icon.category} for ${icon.item.id} was not found. Updating icon failed.`);
		}
	}
	window.customElements.define('skillboost-menu', SkillBoostMenu);

	class SkillBoosts {
		constructor() {
			this.renderQueue = new SBRenderQueue();
			this.data = { skills: [game.farming, game.township], menus: new Map(), icons: [], modifierMap: new MultiMap(3), headers: new Map(), mappedModifiers: new Map(), moddedModifiers: [], filteredItems: new Map(), menuStates: new Map(), settingFilter: [], agiSelectArr: [] };
			this.wasClicked = false;
			this.agiCosts = false;
		}
		initSB() {
			// These items either don't have modifiers or exist in both Global and Skill categories
			this.data.specialItems = [{ itemID: 'melvorD:Cooking_Gloves', skill: game.cooking }, { itemID: 'melvorD:Mining_Gloves', skill: game.mining }, { itemID: 'melvorD:Gem_Gloves', skill: game.mining }, { itemID: 'melvorD:Smithing_Gloves', skill: game.smithing }, { itemID: 'melvorF:Thieving_Gloves', skill: game.thieving }, { itemID: 'melvorD:Barbarian_Gloves', skill: game.fishing }, { itemID: 'mythMusic:Concert_Pass', skill: game.music }];
			// Init Settings
			this.data.settingFilter = get('filter').toLowerCase().replace(/\s/g, '').split(",");
			if (!this.data.filteredItems.has('agi'))
				this.initSettings();
			//Init Data
			this.initSkills();
			this.initHeaderElems();
			this.initMenus();
			this.initModifiers();
			// Filter everything
			this.filterEquipment();
			this.filterPotions();
			if (hasAoD) {
				this.filterPOIs();
			}
			this.filterObstacles();
			this.filterDungeonPets();
			this.filterPurchases();
		}
		initSettings() {
			this.data.filteredItems.set('agi', []);
			this.data.menuStates.set('mf', '0');
		}
		initSkills() {
			game.masterySkills.forEach((skill) => {
				if (this.data.skills.includes(skill) || skill === game.altMagic)
					return;
				if (skill.namespace === 'melvorD' || skill.namespace === 'melvorF' || skill.namespace === 'melvorAoD' || skill.id === 'mythMusic:Music')
					this.data.skills.push(skill);
				if (skill === game.astrology) {
					this.data.skills.push(game.altMagic);
					if (hasAoD)
						this.data.skills.push(game.cartography);
				}
			});
		}
		initHeaderElems() {
			this.data.skills.forEach((skill) => {
				if (skill === game.altMagic)
					this.data.headers.set(skill.id, `skill-header-melvorD:Magic-1`);
				else if (skill === game.township)
					this.data.headers.set(skill.id, `DIV_PASSIVE_TICKS`);
				else
					this.data.headers.set(skill.id, `skill-header-${skill.id}`);
			});
		}
		initMenus() {
			this.data.skills.forEach((skill) => {
				let state = get('state');
				if (state === 1)
					this.data.menuStates.set(skill.id, '0');
				else if (state === 2)
					this.data.menuStates.set(skill.id, '1');

				this.selectedSkill = skill;
				this.menu = new SkillBoostMenu();
				this.renderMenu();
				this.data.menus.set(skill.id, this.menu);
				this.moveMenu(skill.id, this.menu);
			});
			this.selectedSkill = this.selectedSkill.id;
		}
		initModifiers() {
			this.data.skills.forEach((skill) => {
				this.addModifiersToMap('Global', 'Positive', skill.id, getGlobalModifiers('Positive', skill))
				this.addModifiersToMap('Global', 'Negative', skill.id, getGlobalModifiers('Negative', skill))
				this.addModifiersToMap('Skill', 'Positive', skill.id, getSkillModifiers('Positive', skill))
				this.addModifiersToMap('Skill', 'Negative', skill.id, getSkillModifiers('Negative', skill))
				this.addModifiersToMap('Mapped', 'Positive', skill.id, getMappedModifiers('Positive', skill))
				this.addModifiersToMap('Mapped', 'Negative', skill.id, getMappedModifiers('Negative', skill))
			});
			this.data.moddedModifiers.forEach((obj) => {
				if (!obj.skills)
					obj.skills = this.data.skills;
				if (!Array.isArray(obj.skills))
					obj.skill = [obj.skills];
				obj.skills.forEach((skill) => {
					let data = {
						skill: skill,
						scope: obj.scope,
						positive: obj.pos,
						negative: obj.neg
					};
					if (data.positive) {
						if (game.currentGamemode.id === 'melvorAoD:AncientRelics' && obj.inARPos)
							data.positive = [...data.positive, ...obj.inARPos];
						else if (obj.outARPos)
							data.positive = [...data.positive, ...obj.outARPos];
					}
					this.addModifiers(data);
				});
			});
		}
		initMenu(skill) {
			this.selectedSkill = skill;
			this.skillPage = skill;
			this.menu = this.data.menus.get(skill);
			this.getSkillIcons(this.skillPage).forEach((icon) => { this.menu.updateSkillIcons(icon); });
			this.menu.toggleMenu(true);
			this.updateMenu();
			this.render();
			if (this.skillPage === 'melvorAoD:Cartography')
				this.updateCartographyMap();
		}
		updateMenu() {
			this.renderQueue.menu = true;
		}
		render() {
			this.renderEquipmentBg();
			this.renderConsumableBg();
			this.renderConsumableQty();
			this.renderObstacleBg();
			this.renderObstacleActive();
			this.renderPOIBg();
			this.renderPOICost();
			this.renderPurhcaseBg();
			this.renderPurhcaseCost();
			this.renderPurhcaseRequirements();
			this.renderMenu();
		}
		renderEquipmentBg() {
			if (this.renderQueue.equipment.bg.size === 0)
				return;
			this.renderQueue.equipment.bg.forEach((item) => { this.updateEquipmentBg(item); });
			this.renderQueue.equipment.bg.clear();
		}
		renderConsumableBg() {
			if (this.renderQueue.consumable.bg.size === 0)
				return;
			this.renderQueue.consumable.bg.forEach((consumable) => { this.updateConsumableBg(consumable); });
			this.renderQueue.consumable.bg.clear();
		}
		renderConsumableQty() {
			if (this.renderQueue.consumable.qty.size === 0)
				return;
			this.renderQueue.consumable.qty.forEach((consumable) => { this.updateConsumableQty(consumable); });
			this.renderQueue.consumable.qty.clear();
		}
		renderObstacleBg() {
			if (this.renderQueue.obstacle.bg.size === 0)
				return;
			this.renderQueue.obstacle.bg.forEach((obstacle) => { this.updateObstacleBg(obstacle); });
			this.renderQueue.obstacle.bg.clear();
		}
		renderObstacleActive() {
			if (this.renderQueue.obstacle.active.size === 0)
				return;
			this.renderQueue.obstacle.active.forEach((obstacle) => { this.updateObstacleActive(obstacle); });
			this.renderQueue.obstacle.active.clear();
		}
		renderPOIBg() {
			if (this.renderQueue.poi.bg.size === 0)
				return;
			this.renderQueue.poi.bg.forEach((poi) => { this.updatePOIBg(poi); });
			this.renderQueue.poi.bg.clear();
		}
		renderPOICost() {
			if (this.renderQueue.poi.cost.size === 0)
				return;
			this.renderQueue.poi.cost.forEach((poi) => { this.updatePOICosts(poi); });
			this.renderQueue.poi.cost.clear();
		}
		renderPurhcaseBg() {
			if (this.renderQueue.purchase.bg.size === 0)
				return;
			this.renderQueue.purchase.bg.forEach((purchase) => { this.updatePurchaseBg(purchase); });
			this.renderQueue.purchase.bg.clear();
		}
		renderPurhcaseCost() {
			if (this.renderQueue.purchase.cost.size === 0)
				return;
			this.renderQueue.purchase.cost.forEach((purchase) => { this.updatePurchaseCost(purchase); });
			this.renderQueue.purchase.cost.clear();
		}
		renderPurhcaseRequirements() {
			if (this.renderQueue.purchase.requirements.size === 0)
				return;
			this.renderQueue.purchase.requirements.forEach((purchase) => { this.updatePurchaseRequirements(purchase); });
			this.renderQueue.purchase.requirements.clear();
		}
		renderMenu() {
			if (!this.renderQueue.menu)
				return;
			this.setClassByLength();
			this.renderQueue.menu = false;
		}
		updateForSkillChange(newSkill, relocate = true) {
			if (!this.data.skills.some(x => x.id === newSkill))
				return;
			let oldMenu = this.menu;
			this.menu = this.data.menus.get(newSkill);

			if (oldMenu === this.menu && (this.menu.skillPage === newSkill || (newSkill === this.selectedSkill && !relocate)))
				return;

			if (!relocate || (relocate && oldMenu.skillPage !== oldMenu.skill)) {
				oldMenu.remove();
				oldMenu.skillPage = null;
			}

			if ((!relocate && this.selectedSkill !== newSkill))
				this.moveMenu(this.skillPage);
			else if (this.menu.skillPage !== newSkill)
				this.moveMenu(newSkill);

			this.selectedSkill = newSkill;
			this.getSkillIcons().forEach((icon) => { this.menu.updateSkillIcons(icon); });
			this.menu.toggleMenu(true);
			this.menu.toggleFilterAlert();
			this.updateMenu();
			this.render();
			if (this.skillPage === 'melvorAoD:Cartography')
				this.updateCartographyMap();
		}
		moveMenu(skill) {
			let element = document.getElementById(this.data.headers.get(skill));
			if (skill === 'melvorD:Township')
				element = element.children[0];
			if (element === null)
				return console.warn(`[Skill Boosts] No Skill Header found for: ${skill}`);
			this.menu.skillPage = skill;
			element.append(this.menu);
		}
		updateCartographyMap() {
			cartographyMap.onShow();
			cartographyMap.app.resize();
			cartographyMap.onZoomChange(game.cartography.activeMap);
		}
		createIcon(item, skill, elem, tooltip, category, bg) {
			let media;
			if (item instanceof AgilityPillar)
				media = this.getObstacleType(item) === 'Pillar' ? pillarIcon : elitePillarIcon;
			else
				media = item.media;
			let icon = new SkillBoostIcon(item, media, tooltip, bg);
			icon.skill = skill.id;
			icon.category = category;
			let menu = this.data.menus.get(skill.id);
			menu.iconContainers[elem].appendChild(icon.container);
			if (this.data.filteredItems.has(item.id) && this.data.filteredItems.get(item.id).includes(skill.id)) {
				this.toggleFilterState(icon);
				icon.hide();
			} else {
				icon.isFiltered = false;
				menu.container.totalIcons++;
				menu.iconParents[elem].shownIcons++;
			}

			if (icon.category === 'Equipment')
				this.equipmentOnClick(item, icon);
			else if (icon.category === 'Obstacle')
				this.obstacleOnClick(item, icon);
			else if (icon.category === 'Consumable')
				this.consumableOnClick(item, icon);
			else if (icon.category === 'Purchase')
				this.purchaseOnClick(item, icon);
			else if (icon.category === 'POI')
				this.poiOnClick(item, icon);
			else if (icon.category === 'Pet')
				this.petOnClick(icon);

			this.data.icons.push(icon);
		}
		addModifiersToMap(scope, type, skillID, val) {
			let map = this.data.modifierMap;
			if (!map.has(scope, type, skillID))
				map.set(val, scope, type, skillID);
			else {
				val.forEach((modifier) => {
					if (!map.get(scope, type, skillID).includes(modifier))
						map.get(scope, type, skillID).push(modifier);
				});
			}
		}
		addIconsToMap(map, key, val) {
			if (!map.has(key))
				map.set(key, [val]);
			else if (!map.get(key).includes(val))
				map.get(key).push(val);
		}
		removeIconsFromMap(item) {
			let icons = this.data.icons.filter(x => x.item === item);
			if (icons.length === 0)
				return;
			icons.forEach((icon) => {
				this.data.icons.splice(this.data.icons.indexOf(icon), 1);
				icon.destroy();
			});
		}
		getSkillIcons(skill = this.selectedSkill) {
			return this.data.icons.filter(x => x.skill === skill);
		}
		getItemIcons(item) {
			return this.getSkillIcons().filter(x => x.item === item && !x.isFiltered);
		}
		getCategoryIcons(category) {
			return this.getSkillIcons().filter(x => x.category === category && !x.isFiltered).map(x => x.item);
		}
		filterIcon(oIcon) {
			let isFiltered = oIcon.isFiltered,
				icons;
			if (massFiltering)
				icons = this.data.icons.filter(x => x.item === oIcon.item);
			else
				icons = this.data.icons.filter(x => x.skill === oIcon.skill && x.item === oIcon.item);
			oIcon.isFiltered ? this.removeFilteredItem(oIcon) : this.addFilteredItem(oIcon);
			icons.forEach((icon) => {
				this.toggleFilterState(icon, icon === oIcon, isFiltered);
				this.menu.updateSkillIcons(icon);
			});
			this.render();
		}
		toggleFilterState(icon, count, increase) {
			icon.isFiltered = massFiltering ? !increase : !icon.isFiltered;
			if (icon.isFiltered)
				icon.setBg('filterBg');
		}
		addFilteredItem(icon) {
			let skills = this.data.filteredItems.get(icon.item.id);
			if (massFiltering)
				this.data.filteredItems.set(icon.item.id, this.data.icons.filter(x => x.item === icon.item).map(x => x.skill));
			else {
				let toFilter = this.selectedSkill;
				if (skills === undefined)
					this.data.filteredItems.set(icon.item.id, [toFilter]);
				else if (!skills.includes(toFilter))
					skills.push(toFilter);
			}
			SBSave.save();
		}
		removeFilteredItem(icon) {
			let skills = this.data.filteredItems.get(icon.item.id);
			if (massFiltering)
				this.data.filteredItems.delete(icon.item.id);
			else {
				skills.splice(skills.indexOf(this.selectedSkill), 1);
				if (skills.length === 0)
					this.data.filteredItems.delete(icon.item.id);
			}
			SBSave.save();
		}
		sortArray(array) {
			array.sort(function(a, b) {
				let x = slotTypes.indexOf(a.validSlots[0]);
				let y = slotTypes.indexOf(b.validSlots[0]);
				if (x < y) { return -1; }
				if (x > y) { return 1; }
				return 0;
			});
		}
		hasModifiers(scope, type, skill, itemMods) {
			if (scope.includes('Global') && this.data.modifierMap.get('Global', type, skill.id).some(x => itemMods[x]))
				return 1;
			if (scope.includes('Skill') && this.data.modifierMap.get('Skill', type, skill.id).some(x => itemMods[x]))
				return 1;
			if (scope.includes('Skill') && hasMappedModifier(itemMods, skill, type))
				return 1;
			return 0;
		}
		filterEquipment() {
			let allEquipment = game.items.equipment.filter(x => this.data.specialItems.some(z => z.itemID === x.id) || x.providedRunes.length > 0 || (!this.data.settingFilter.some(y => y !== '' && x.id.toLowerCase().includes(y)) && (x.modifiers && x.category !== 'Golbin Raid' && !bannedModifiers.some(y => x.tier !== "Skillcape" && x.modifiers[y]))));
			let relics = game.currentGamemode.id === 'melvorAoD:AncientRelics';
			this.sortArray(allEquipment);
			allEquipment.forEach((item) => {
				if (!relics && item.id.includes('_Lesser_Relic'))
					return;
				let isConsumed = item.validSlots[0] === 'Summon1' || item.validSlots[0] === 'Consumable' || item.consumesChargesOn,
					tooltip = createItemInformationTooltip(item);

				if (this.data.specialItems.some(x => x.itemID === item.id)) {
					let skill = this.data.specialItems.find(x => x.itemID === item.id).skill;
					if (isConsumed)
						this.createIcon(item, skill, 1, tooltip, 'Consumable', 'bg-secondary');
					else
						this.createIcon(item, skill, 1, tooltip, 'Equipment');
					return;
				}

				if (item.providedRunes.some(({ item }) => providedRunes.includes(item.id))) {
					if (isConsumed)
						this.createIcon(item, game.altMagic, 1, tooltip, 'Consumable', 'bg-secondary');
					else
						this.createIcon(item, game.altMagic, 1, tooltip, 'Equipment');
					return;
				}

				if (item.modifiers === undefined)
					return;
				if ((item.modifiers.decreasedAgilityPillarCost || item.modifiers.decreasedAgilityObstacleCost || item.modifiers.decreasedAgilityObstacleItemCost) && !this.data.agiSelectArr.includes(item))
					this.data.agiSelectArr.push(item);

				for (var i = 0; i < this.data.skills.length; i++) {
					let isGlobal = this.hasModifiers('Global', 'Positive', this.data.skills[i], item.modifiers),
						itemCount = isGlobal + this.hasModifiers('Skill', 'Positive', this.data.skills[i], item.modifiers);
					for (var s = 0; s < itemCount; s++) {
						if ((!isGlobal && itemCount === 2 && ['max_skillcape', 'cape_of_completion', 'golden_wreath', 'aorpheats'].find(x => item.id.toLowerCase().includes(x))) || (item.id === 'melvorD:Mining_Gloves' && relics))
							continue;
						if (isConsumed)
							this.createIcon(item, this.data.skills[i], isGlobal ? 0 : 1, tooltip, 'Consumable', 'bg-secondary');
						else
							this.createIcon(item, this.data.skills[i], isGlobal ? 0 : 1, tooltip, 'Equipment');
						isGlobal = 0;
					}
				}
			});
		}
		onLongPress(element, callback) {
			let timer;
			element.addEventListener('touchstart', (_e) => {
				timer = setTimeout(() => {
					timer = null;
					callback();
				}, 500);
			});

			function cancel() {
				clearTimeout(timer);
			}
			element.addEventListener('touchend', cancel);
			element.addEventListener('touchmove', cancel);
		}
		equipmentOnClick(item, icon) {
			var hasTouchScreen = false;
			if ("maxTouchPoints" in navigator)
				hasTouchScreen = navigator.maxTouchPoints > 0;
			else if ("msMaxTouchPoints" in navigator)
				hasTouchScreen = navigator.msMaxTouchPoints > 0;

			icon.container.onclick = () => { this.equipmentCallback(icon, item, item.validSlots[0]); };
			if (item.validSlots.includes('Passive')) {
				if (hasTouchScreen)
					this.onLongPress(icon.container, () => { this.equipmentCallback(icon, item, 'Passive'); }); //Why apple
				else
					icon.container.oncontextmenu = (e) => { e.preventDefault(), this.equipmentCallback(icon, item, 'Passive'); };
			}
		}
		equipmentCallback(icon, item, slot) {
			let qty = game.bank.getQty(item),
				isConsumable = item.validSlots[0] === 'Consumable' || item.validSlots[0] === 'Summon1';
			if (filterMode)
				this.filterIcon(icon);
			else if (player.isEquipmentSlotUnlocked(slot) && qty > 0 && item.validSlots.includes(slot)) {
				if (isConsumable)
					qty -= Math.floor(get('allbutx'));
				if (qty > 0) {
					player.equipItem(item, player.selectedEquipmentSet, slot, qty);
					if (isConsumable || item.consumesChargesOn) {
						this.renderConsumableBg();
						this.renderConsumableQty();
					} else
						this.renderEquipmentBg();
				}

			}
		}
		checkOtherEquipmentSets(item) {
			return player.equipmentSets.some(({ equipment }) => {
				if (equipment === player.equipment)
					return;
				return equipment.checkForItem(item);
			});
		}
		updateEquipmentBg(item) {
			this.getItemIcons(item).forEach((icon) => {
				if (icon.passiveIcon) {
					icon.passiveIcon.remove();
					delete icon.passiveIcon;
				}
				if (player.equipment.checkForItem(item)) {
					icon.setBg('greenBg');
					if (player.equipment.getSlotOfItem(item) === 'Passive') {
						icon.passiveIcon = passiveIcon;
						icon.container.append(passiveIcon);
					}
				} else if (game.bank.getQty(item) > 0)
					icon.setBg('btn-light');
				else if (this.checkOtherEquipmentSets(item))
					icon.setBg('yellowBg');
				else
					icon.setBg('redBg');
			});
		}
		filterPotions() {
			game.items.potions.filter(x => this.data.skills.includes(x.action) && !this.data.settingFilter.some(y => y !== '' && x.id.toLowerCase().includes(y))).forEach((potion) => {
				this.createIcon(potion, potion.action, 1, createItemInformationTooltip(potion), 'Consumable', 'bg-secondary');
			});
		}
		consumableOnClick(consumable, icon) {
			if (consumable.type === 'Potion') {
				icon.container.onclick = () => {
					let potion = game.potions.activePotions.get(consumable.action);
					if (filterMode)
						this.filterIcon(icon);
					else if (potion === undefined || potion.item !== consumable) {
						this.wasClicked = true;
						game.potions.usePotion(consumable, false);
						this.renderConsumableBg();
						this.renderConsumableQty();
					}
				};
			} else {
				icon.container.onclick = () => {
					let slot = consumable.validSlots[0];
					if (consumable.type === 'Familiar') {
						if (player.equipment.getSlotOfItem(consumable) !== 'None')
							slot = player.equipment.getSlotOfItem(consumable);
						else if (player.equipment.slots['Summon1'].item.id !== 'melvorD:Empty_Equipment' && player.equipment.slots['Summon2'].item.id === 'melvorD:Empty_Equipment')
							slot = 'Summon2';
					}
					this.equipmentCallback(icon, consumable, slot);
				};
			};
		}
		updateConsumableBg(consumable, value = get('allbutx')) {
			let hasCharges = consumable.consumesChargesOn,
				qty = game.bank.getQty(consumable);
			this.getItemIcons(consumable).forEach((icon) => {
				if (player.equipment.checkForItem(consumable) || game.potions.isPotionActive(consumable))
					icon.setBg('greenBg');
				else if ((!hasCharges && Math.max(qty - value, 0)) || (hasCharges && qty))
					icon.setBg('btn-light');
				else if (this.checkOtherEquipmentSets(consumable))
					icon.setBg('yellowBg');
				else
					icon.setBg('redBg');
			});
		}
		updateConsumableQty(consumable, value = get('allbutx')) {
			let qty = Math.max(game.bank.getQty(consumable) - value, 0);
			this.getItemIcons(consumable).forEach((icon) => {
				if (consumable.consumesChargesOn) {
					icon.setText(formatNumber(game.itemCharges.getCharges(consumable)));
					return;
				}
				icon.setPillbox('bg-secondary');
				if (player.equipment.checkForItem(consumable)) {
					icon.setText(formatNumber(player.equipment.getQuantityOfItem(consumable)));
					if (qty !== 0 || this.checkOtherEquipmentSets(consumable))
						icon.setPillbox('bg-warning');
				} else if (qty !== 0)
					icon.setText(formatNumber(qty));
				else if (this.checkOtherEquipmentSets(consumable)) {
					let totalQty = 0;
					player.equipmentSets.forEach(({ equipment }) => {
						if (equipment !== player.equipment && equipment.checkForItem(consumable))
							totalQty += equipment.slotArray.find(x => x.item === consumable).quantity;
					});
					icon.setText(formatNumber(totalQty));
				} else
					icon.setText('0');
			});
		}
		filterPOIs() {
			game.cartography.worldMaps.forEach((map) => {
				map.pointsOfInterest.filter(x => x.activeModifiers !== undefined && !this.data.settingFilter.some(y => y !== '' && x.id.toLowerCase().includes(y))).forEach((poi) => {
					let tooltip = this.createPOITooltip(poi);
					for (var i = 0; i < this.data.skills.length; i++) {
						if (this.hasModifiers('Skill', 'Positive', this.data.skills[i], poi.activeModifiers))
							this.createIcon(poi, this.data.skills[i], 1, tooltip, 'POI', 'bg-secondary');
					}
				});
			});
		}
		poiOnClick(poi, icon) {
			icon.text.innerHTML = `<img src=${cdnMedia('assets/media/main/coins.svg')} class='poi-inline-icon'/>${formatNumber(this.getTravelCosts(poi).gp)}`;
			icon.container.onclick = () => {
				if (filterMode)
					this.filterIcon(icon);
				else if (poi.hex.map === game.cartography.activeMap && poi.isDiscovered && this.getTravelCosts(poi).checkIfOwned()) {
					if (cartographyMap._initialized)
						game.cartography.onHexTap(poi.hex);
					poi.hex.map.selectHex(poi.hex);
					game.cartography.travelOnClick();
					this.renderPOIBg();
					this.renderPOICost();
				}
			};
		}
		getPOIModifiers(poi) {
			const modifiers = new MappedModifiers();
			const posMulti = game.cartography.hasCarthuluPet ? 2 : 1;
			modifiers.addModifiers(poi.activeModifiers, 1, posMulti);
			return modifiers;
		}
		createModifierTooltip(object, modifiers) {
			let tooltip = `<text class="justify-vertical-center font-w600 font-size-sm">${object.name}
			<span class="text-center">`;
			modifiers.getActiveModifierDescriptions().forEach(([text, textClass]) => {
				tooltip = tooltip + `<h5 class="font-size-2sm m-1 ${textClass}">${text}</h5>`;
			});
			tooltip = tooltip + `</span>`;
			return tooltip;
		}
		createPOITooltip(poi) {
			let tooltip = this.createModifierTooltip(poi, this.getPOIModifiers(poi));
			tooltip = tooltip + `<text class="font-sm-sb">${getLangString('TRAVEL_COST_COL')}
				<img class="poi-inline-icon" src=${cdnMedia('assets/media/main/coins.svg')}></img>
				<text id="GPCost">${formatNumber(this.getTravelCosts(poi).gp)}</text>
			</text>`;
			return tooltip;
		}
		getTravelCosts(poi) {
			if (poi.hex.map !== game.cartography.activeMap || !poi.isDiscovered)
				return new Costs(game);
			else
				return game.cartography.getTravelCosts(poi.hex.map.computePath(poi.hex.map.playerPosition, poi.hex));
		}
		updatePOICosts(poi) {
			let cost = formatNumber(this.getTravelCosts(poi).gp);
			this.getItemIcons(poi).forEach((icon) => {
				let pillCost = icon.text.childNodes[1],
					tooltipCost = icon.tooltip.popper.querySelector('#GPCost');
				if (poi.hex.map !== game.cartography.activeMap) {
					pillCost.textContent = 0;
					tooltipCost.textContent = 0;
					return;
				}
				pillCost.textContent = cost;
				tooltipCost.textContent = cost;
			});
		}
		updatePOIBg(poi) {
			this.getItemIcons(poi).forEach((icon) => {
				if (poi.hex.map !== game.cartography.activeMap) {
					icon.setPillbox('bg-danger');
					icon.setBg('redBg');
					return;
				} else
					icon.setPillbox('bg-secondary');

				if (poi.hex.isPlayerHere)
					icon.setBg('greenBg');
				else if (!poi.isDiscovered)
					icon.setBg('redBg');
				else if (!this.getTravelCosts(poi).checkIfOwned())
					icon.setBg('yellowBg');
				else
					icon.setBg('btn-light');
			});
		}
		filterObstacles() {
			let obstacles = [...game.agility.sortedMasteryActions, ...game.agility.pillars.allObjects, ...game.agility.elitePillars.allObjects];
			obstacles.filter(x => !this.data.settingFilter.some(y => y !== '' && x.id.toLowerCase().includes(y))).forEach((obstacle) => {
				let tooltip = this.createModifierTooltip(obstacle, game.agility.getObstacleModifiers(obstacle));
				for (var i = 0; i < this.data.skills.length; i++) {
					let isPositive = this.hasModifiers('GlobalSkill', 'Positive', this.data.skills[i], obstacle.modifiers);
					if (isPositive || this.hasModifiers('GlobalSkill', 'Negative', this.data.skills[i], obstacle.modifiers))
						this.createIcon(obstacle, this.data.skills[i], isPositive ? 2 : 3, tooltip, 'Obstacle');
				}
			});
		}
		obstacleOnClick(obstacle, icon) {
			let type = this.getObstacleType(obstacle);
			icon.container.onclick = () => {
				if (filterMode)
					this.filterIcon(icon);
				else {
					if (!game.agility.isUnlocked || game.agility.isObstacleBuilt(obstacle) || game.agility.isPillarBuilt(obstacle) || game.agility.isElitePillarBuilt(obstacle))
						return;
					SwalLocale.fire({
						html: this.createObstacleSelect(obstacle, type),
						showConfirmButton: this.canBuildObstacle(obstacle),
						confirmButtonText: getLangString('MENU_TEXT_BUILD'),
						showCancelButton: true,
					}).then((result) => {
						if (result.value) {
							if (type === 'Obstacle')
								game.agility.buildObstacle(obstacle);
							else if (type === 'Pillar')
								game.agility.buildPillar(obstacle);
							else if (type === 'Elite')
								game.agility.buildElitePillar(obstacle);
							this.renderObstacleBg();
						}
					});
				}
			};
		}
		createInlineRequirement(media, text, textClass) {
			let inlineContainer = createElement('span', { className: `no-wrap m-2` });
			inlineContainer.innerHTML = `<img src=${media} class='icon-xs-sb mr-1'/><span class="font-sm-sb font-w400 ${textClass}">${text}</span>`;
			return inlineContainer;
		}
		setObstacleCosts(items, gpReq, scReq, costsElem, tooltip) {
			if (tooltip)
				costsElem.textContent = getLangString('MENU_TEXT_COST');
			const addReq = (media, qty, name, currentQty, item = null) => {
				let text;
				if (item)
					text = `${formatNumber(currentQty)} / ${formatNumber(qty)}`;
				else
					text = formatNumber(qty);
				let newReq = this.createInlineRequirement(media, text, currentQty >= qty ? 'text-success' : 'text-danger');
				if (tooltip)
					this.createImageTooltip(newReq.children[0], name);
				costsElem.append(newReq);
			};
			items.forEach(({ item, quantity }) => {
				addReq(item.media, quantity, item.name, game.bank.getQty(item), item);
			});
			if (gpReq > 0) {
				addReq(cdnMedia('assets/media/main/coins.svg'), gpReq, getLangString('MENU_TEXT_GP'), game.gp.amount);
			}
			if (scReq > 0) {
				addReq(cdnMedia('assets/media/main/slayer_coins.svg'), scReq, getLangString('MENU_TEXT_SLAYER_COINS'), game.slayerCoins.amount);
			}
		}
		createImageTooltip(image, tooltip) {
			let imageTooltip = tippy(image, {
				placement: 'bottom',
				interactive: false,
				animation: false,
			});
			imageTooltip.setContent(tooltip);
		}
		getObstacleType(obstacle) {
			let type;
			if (obstacle instanceof AgilityObstacle)
				type = 'Obstacle';
			else if (obstacle.id.includes('melvorTotH'))
				type = 'Elite';
			else
				type = 'Pillar';
			return type;
		}
		getObstacleCost(obstacle, agiSetting = false) {
			let type = this.getObstacleType(obstacle);
			this.agiCosts = agiSetting;
			return type === 'Obstacle' ? game.agility.getObstacleBuildCosts(obstacle) : game.agility.getPillarBuildCosts(obstacle);
		}
		hasObstacleRequirements(obstacle) {
			let type = this.getObstacleType(obstacle);
			let hasRequirements = (type === 'Pillar' && game.agility.passivePillarUnlocked) || (type === 'Elite' && game.agility.elitePassivePillarUnlocked) || (type === 'Obstacle' && game.checkRequirements(obstacle.skillRequirements) && game.agility.level >= game.agility.obstacleUnlockLevels[obstacle.category]);
			return hasRequirements;
		}
		canBuildObstacle(obstacle) {
			return this.getObstacleCost(obstacle).checkIfOwned() && this.hasObstacleRequirements(obstacle);
		}
		createObstacleSelect(obstacle, type) {
			let destroy;
			if (type === 'Obstacle')
				destroy = game.agility.builtObstacles.get(obstacle.category);
			else if (type === 'Pillar')
				destroy = game.agility.builtPassivePillar;
			else
				destroy = game.agility.builtElitePassivePillar;
			let agilitySelect = new SBAgilitySelect(obstacle, destroy, this.data.agiSelectArr);
			return agilitySelect;
		}
		updateObstacleBg(obstacle) {
			let hasRequirements = this.hasObstacleRequirements(obstacle),
				cost = this.getObstacleCost(obstacle, true);

			this.getItemIcons(obstacle).forEach((icon) => {
				if (game.agility.isObstacleBuilt(obstacle) || game.agility.isPillarBuilt(obstacle) || game.agility.isElitePillarBuilt(obstacle))
					icon.setBg('greenBg');
				else if (hasRequirements) {
					if (!cost.checkIfOwned())
						icon.setBg('yellowBg');
					else
						icon.setBg('btn-light');
				} else
					icon.setBg('redBg');
			});
		}
		updateObstacleActive(obstacle) {
			let type = this.getObstacleType(obstacle),
				obst = type === 'Obstacle' && game.agility.activeObstacleCount - 1 < obstacle.category && game.agility.isObstacleBuilt(obstacle),
				pillar = type === 'Pillar' && game.agility.activeObstacleCount < 10 && game.agility.isPillarBuilt(obstacle),
				elite = type === 'Elite' && game.agility.activeObstacleCount < 15 && game.agility.isElitePillarBuilt(obstacle);

			this.getItemIcons(obstacle).forEach((icon) => {
				(obst || pillar || elite) ? showElement(icon.inactiveIcon): hideElement(icon.inactiveIcon);
			});
		}
		filterDungeonPets() {
			game.dungeons.filter(x => x.pet !== undefined && !this.data.settingFilter.some(y => y !== '' && x.pet.pet.id.toLowerCase().includes(y))).forEach((dungeon) => {
				let pet = dungeon.pet.pet;
				for (var i = 0; i < this.data.skills.length; i++)
					if ((!game.petManager.unlocked.has(pet) && !pet.ignoreCompletion) && this.hasModifiers('GlobalSkill', 'Positive', this.data.skills[i], pet.modifiers))
						this.createIcon(pet, this.data.skills[i], 4, this.createPetTooltip(pet), 'Pet');
			});
		}
		createPetTooltip(pet) {
			return `<div class="text-center"><span class="text-warning">${pet.name}</span><br><span class="text-info">${pet.description}</span></div>`;
		}
		petOnClick(icon) {
			icon.setBg('redBg');
			icon.container.onclick = () => {
				if (filterMode)
					this.filterIcon(icon);
			};
		}
		filterPurchases() {
			let tempArr = [];
			game.shop.purchases.allObjects.filter(x => (x.contains.modifiers !== undefined || x.contains.pet !== undefined) && !this.data.settingFilter.some(y => y !== '' && x.id.toLowerCase().includes(y))).forEach((purchase) => {
				if (game.shop.upgradesPurchased.has(purchase))
					return;
				for (var i = 0; i < this.data.skills.length; i++) {
					if (purchase.contains.pet !== undefined && this.hasModifiers('GlobalSkill', 'Positive', this.data.skills[i], purchase.contains.pet.modifiers))
						this.createIcon(purchase, this.data.skills[i], 4, this.createPurchaseTooltip(purchase), 'Purchase');
					else if (purchase.contains.modifiers !== undefined && this.hasModifiers('GlobalSkill', 'Positive', this.data.skills[i], purchase.contains.modifiers))
						tempArr.push({ skill: this.data.skills[i], purchase: purchase });
				}
			});
			tempArr.forEach((object) => { this.createIcon(object.purchase, object.skill, 4, this.createPurchaseTooltip(object.purchase), 'Purchase'); });
		}
		createPurchaseTooltip(purchase) {
			let tooltip = createElement('div', { classList: ['align-items-center'] });
			new ShopItem(purchase, game, tooltip);
			return tooltip;
		}
		purchaseOnClick(purchase, icon) {
			icon.tooltip.popper.children[0].children[0].classList.add('text-center');
			icon.tooltip.popper.querySelector('.flex-wrap').classList.remove('justify-horizontal-left');
			icon.container.onclick = () => {
				if (filterMode)
					this.filterIcon(icon);
				else if (game.shop.getPurchaseCosts(purchase, 1).checkIfOwned() && game.checkRequirements(purchase.purchaseRequirements) && game.checkRequirements(purchase.unlockRequirements)) {
					if (!game.settings.showShopConfirmations)
						game.shop.buyItemOnClick(purchase, true);
					else
						shopMenu.showConfirmBuyPrompt(purchase);
				}
			};
		}
		updatePurchaseBg(purchase) {
			let hasRequirements = game.checkRequirements(purchase.purchaseRequirements) && game.checkRequirements(purchase.unlockRequirements),
				canPurchase = game.shop.getPurchaseCosts(purchase, 1).checkIfOwned();
			this.getItemIcons(purchase).forEach((icon) => {
				if (hasRequirements && canPurchase)
					icon.setBg('greenBg');
				else if (hasRequirements && !canPurchase)
					icon.setBg('yellowBg');
				else
					icon.setBg('redBg');
			});
		}
		updatePurchaseCost(purchase) {
			let costs = purchase.costs;
			this.getItemIcons(purchase).forEach((icon) => {
				let id = 1,
					elems = icon.tooltip.popper.querySelectorAll('span');
				if (!isShopCostZero(costs.gp)) {
					toggleDangerSuccess(elems[id], game.gp.canAfford(costs.gp.cost));
					id += 2;
				}
				if (!isShopCostZero(costs.slayerCoins)) {
					toggleDangerSuccess(elems[id], game.slayerCoins.canAfford(game.shop.getCurrencyCost(costs.slayerCoins, 1, game.shop.getPurchaseCount(purchase))));
					id += 2;
				}
				costs.items.forEach(({ item, quantity }) => {
					toggleDangerSuccess(elems[id], game.bank.getQty(item) >= quantity);
					id += 2;
				});
			});
		}
		updatePurchaseRequirements(purchase) {
			let types = ['ArchaeologyItemsDonated', 'CartographyPOIDiscovery', 'TownshipBuilding'];
			this.getItemIcons(purchase).forEach((icon) => {
				let id = 2;
				purchase.purchaseRequirements.forEach((requirement) => {
					if (requirement.skill !== undefined || requirement.dungeon !== undefined || types.includes(requirement.type)) {
						toggleDangerSuccess(icon.tooltip.popper.querySelectorAll('.font-w600')[id].children[0], game.checkRequirement(requirement));
						id++;
					}
				});
			});
		}
		setClassByLength() {
			let innerWidth = window.innerWidth,
				isMobile = innerWidth < 768,
				isMedium = innerWidth >= 1250,
				isLarge = innerWidth >= 1600,
				num = isLarge ? 6 : 7,
				modified, lastParent;

			if (isMobile && this.skillPage === game.township.id)
				this.menu.iconMenu.classList.remove('plr-1rem-sb');
			else
				this.menu.iconMenu.classList.add('plr-1rem-sb');

			this.menu.iconParents.forEach((parent, i) => {
				let icons = parent.shownIcons,
					minIcons;
				if (!parent.className.includes('text-center'))
					parent.className = 'text-center no-wrap margin-lr-0p5 font-w600 max-14-icons-lg pb-2';

				if (icons === 0) {
					hideElement(parent);
					return;
				} else
					showElement(parent);

				if (isMobile) {
					if (icons <= 12 && lastParent !== undefined && lastParent.shownIcons <= 12) {
						let tIcons = icons + lastParent.shownIcons;
						lastParent.style.flex = `0 0 ${lastParent.shownIcons / tIcons * 98}%`; // 98% forces 3/3 icon pairs instead of 4/4 when rows fits 8 icons
						parent.style.flex = `0 0 ${icons / tIcons * 98}%`;
						modified = true;
					} else {
						parent.classList.add('col-8-sm-sb');
						parent.style.flex = '';
					}
					if (modified) { // Only modify in pairs
						lastParent = undefined;
						modified = false;
					} else
						lastParent = parent;
					return;
				}
				if (!isMedium && i === 4) {
					parent.style.flex = `0 0 99%`;
					return;
				}
				if (!isMedium && this.selectedSkill === game.thieving.id)
					icons -= 2;

				if (icons <= num)
					minIcons = 2;
				else if (icons <= num * 2)
					minIcons = isLarge ? 3 : isMedium ? 2 : 2;
				else if (icons <= num * 3)
					minIcons = isLarge ? 4 : isMedium ? 3 : 3;
				else if (icons <= num * 4)
					minIcons = isLarge ? 5 : isMedium ? 4 : 3;
				else if (icons <= num * 5)
					minIcons = isLarge ? 6 : isMedium ? 4 : 4;
				else
					minIcons = isLarge ? 6 : isMedium ? 5 : 5;

				if (game.archaeology && this.selectedSkill === game.archaeology.id && !isLarge && (i === 1 || i === 2)) // manual adjustments sadge
					minIcons = 3;
				else if (this.selectedSkill === game.firemaking.id && !isLarge && i === 1)
					minIcons = 4;
				else if (this.selectedSkill === game.thieving.id && !isLarge && i === 0)
					minIcons = 3;
				else if (this.selectedSkill === game.thieving.id && !isLarge && i === 2)
					minIcons = 4;

				if (!parent.className.includes(`min-${minIcons}-icons`)) {
					parent.classList.remove('min-2-icons', 'min-3-icons', 'min-4-icons', 'min-5-icons', 'min-6-icons');
					parent.classList.add(`min-${minIcons}-icons`);
				}
				parent.style.flex = `0 0 ${icons / (isMedium ? this.menu.container.totalIcons : this.menu.container.totalIcons - this.menu.iconParents[4].shownIcons) * 84}%`;
			});
		}
		updateAllPOIs() {
			this.getCategoryIcons('POI').forEach((poi) => { this.renderQueue.poi.cost.add(poi), this.renderQueue.poi.bg.add(poi); });
		}
		updateAllObstacles() {
			this.getCategoryIcons('Obstacle').forEach((obstacle) => { this.renderQueue.obstacle.bg.add(obstacle); });
		}
		addNewSkill(data) {
			this.data.skills.push(data.skill);
			this.data.headers.set(data.skill.id, data.header);
			sortModdedSkill(data);
		}
		addNewModifiers(data) {
			this.data.moddedModifiers.push({ skills: data.skills, scope: data.scope, pos: data.positive, neg: data.negative, inARPos: data.inRelicsPos, outARPos: data.outsideRelicsPos });
		}
		addModifiers(data) {
			if (data.positive)
				this.addModifiersToMap(data.scope, 'Positive', data.skill.id, data.positive);
			if (data.negative)
				this.addModifiersToMap(data.scope, 'Negative', data.skill.id, data.negative);
		}
		reInitSB() {
			this.data.icons.forEach((icon) => { icon.destroy(); });
			this.data.menus.forEach((menu) => { menu.remove(); });
			delete this.menu;
			this.data.menus.clear();
			this.data.icons = [];
			this.data.skills = [game.farming, game.township];
			this.data.settingFilter = [];
			this.data.agiSelectArr = [];
			this.initSB();
		}
	};

	let skillBoosts = new SkillBoosts();
	window.skillBoosts = skillBoosts;

onModsLoaded(() => {
	// Documenation can be found at https://mod.io/g/melvoridle/m/skill-boosts
	if (!mod.manager.getLoadedModList().includes('[Myth] Music')) //Replace with 'Skill Boosts'
		return;
	// Add [Myth] Music Skill data
	skillBoosts.addNewSkill({
		// Required
		skill: game.music,
		header: `skill-header-mythMusic:Music`,
		// Optional
		hasPreservation: true,
		//noMastery: boolean,
		//noSummon: boolean,
		//noPotion: boolean,
		noDoubling: true,
		//noInterval: boolean,
		//noConsumable: boolean,
	});
	// Base modifiers to easily create positive and negative versions
	function baseMods(inc, dec) {
		return [`${inc}GPFlat`, `${inc}GPGlobal`, `${inc}MusicGP`, `${dec}MusicHireCost`,
		`${inc}ChanceToObtainShrimpWhileTrainingMusic`, `${inc}SheetMusicDropRate`, `${inc}MusicAdditionalRewardRoll`];
	}
	// Add [Myth] Music Modifier data
	skillBoosts.addNewModifiers({
		// Required
		skills: [game.music],
		scope: 'Skill', // 'Global', 'Skill', 'Mapped'
		// Optional
		positive: ['bandPractice', ...baseMods('increased', 'decreased')],
		negative: baseMods('decreased', 'increased'),
		//onlyInRelicsPos: [],
		//onlyOutsideRelicsPos: [],
	});
});

	onInterfaceReady(() => {
		SBSave.initAndLoad();
		skillBoosts.initSB();

		let pageOnLoad = game.openPage.action;
		if (pageOnLoad !== undefined && pageOnLoad.id !== 'melvorD:Combat' && pageOnLoad.id !== 'melvorD:GolbinRaid')
			skillBoosts.initMenu(pageOnLoad.id);
		window.addEventListener("resize", skillBoosts.updateMenu.bind(skillBoosts));
	});
}