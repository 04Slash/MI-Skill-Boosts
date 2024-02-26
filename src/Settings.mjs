const { settings, onInterfaceReady, characterStorage, loadModule } = mod.getContext(import.meta),
	generalSettings = settings.section('General'),
	lang = await loadModule('localization.mjs'), { SkillBoostIcon } = await loadModule('src/SBIcon.mjs'), { SBSave } = await loadModule('src/Saving.mjs');
const getLang = (key) => {
	if (!lang['lang'][key]) {
		return `SkillBoosts: Undefined Lang`;
	}
	return lang['lang'][key][setLang] ? lang['lang'][key][setLang] : lang['lang'][key]['en'];
};

generalSettings.add([{
	type: 'dropdown',
	name: 'state',
	label: getLang('SETTING_MENU_STATE'),
	options: [{ value: 0, display: getLang('SETTING_MENU_STATE_1') }, { value: 1, display: getLang('SETTING_MENU_STATE_2') }, { value: 2, display: getLang('SETTING_MENU_STATE_3') }],
	default: 0
}, {
	type: 'text',
	name: 'filter',
	label: getLang('SETTING_FILTER'),
	hint: getLang('SETTING_FILTER_DESC'),
	default: ''
}, {
	type: 'number',
	name: 'allbutx',
	label: getLang('SETTING_ALLBUTX'),
	hint: getLang('SETTING_ALLBUTX_DESC'),
	default: 0,
	onChange: () => skillBoosts.getCategoryIcons('Consumable').forEach((consumable) => { skillBoosts.renderQueue.consumable.bg.add(consumable), skillBoosts.renderQueue.consumable.qty.add(consumable); })
}, {
	type: 'button',
	name: 'reset',
	display: getLang('SETTING_RESET_DATA'),
	color: 'danger',
	onClick: () => resetFilteredIcons()
}]);

function resetFilteredIcons() {
	Swal.fire({
		html: `<span class="text-warning">${getLang('SETTING_RESET_DATA')}</span> ${getLang('DELETE_DATA_2')}`,
		showConfirmButton: true,
		confirmButtonColor: "#e56767",
		confirmButtonText: getLang('RESET'),
		showCancelButton: true,
		cancelButtonColor: "#5cace5",
	}).then((result) => {
		if (result.value) {
			let agiSetting = skillBoosts.data.filteredItems.get('agi');
			characterStorage.removeItem('saveData');
			skillBoosts.data.icons.filter(x => x.isFiltered).forEach((icon) => {
				icon.isFiltered = false;
				icon.show();
				if (icon.skill === skillBoosts.selectedSkill) {
					skillBoosts.menu.updateSkillIcons(icon);
					icon.container.parentElement.parentElement.shownIcons++;
					skillBoosts.menu.container.totalIcons++;
				}
			});
			skillBoosts.data.filteredItems.clear();
			skillBoosts.data.filteredItems.set('agi', agiSetting);
			skillBoosts.setClassByLength();
			SBSave.save();
		};
	});
};

class AgilityCostSetting {
	constructor(parent) {
		this.parent = parent;
		this.items = [game.items.getObjectByID('melvorF:Agility_Skillcape')];
		this.icons = new Map();
		if (cloudManager.hasTotHEntitlement)
			this.items.push(game.items.getObjectByID('melvorTotH:Superior_Agility_Skillcape'));
		if (game.currentGamemode.id === 'melvorAoD:AncientRelics')
			this.items.push(game.items.getObjectByID('melvorAoD:Agility_Lesser_Relic'));
		this.label = createElement('label', {
			className: 'font-weight-normal',
			text: getLang('SETTING_AGILITY_COST')
		});
		this.itemsContainer = createElement('div', {
			className: `row no-gutters justify-content-center`
		});
		this.parent.append(this.label, this.itemsContainer);
		this.createIcons();
		this.updateBgs();
	}
	createIcons() {
		this.items.forEach((item) => {
			let icon = new SkillBoostIcon(item, item.media, createElement('div', { text: item.name }));
			this.itemsContainer.append(icon.container);
			icon.container.onclick = () => {
				this.updateItem(item, icon);
			};
			this.icons.set(item.id, icon);
		});
	}
	updateBgs() {
		let items = skillBoosts.data.filteredItems.get('agi');
		this.icons.forEach((icon, item) => {
			if (items.includes(item))
				icon.setBg('greenBg');
			else
				icon.setBg('redBg');
		});
	}
	updateItem(item, icon) {
		let items = skillBoosts.data.filteredItems.get('agi');
		if (!items.includes(item.id)) {
			icon.setBg('greenBg');
			items.push(item.id);
		} else {
			icon.setBg('redBg');
			items.splice(items.indexOf(item.id), 1);
		}
		SBSave.save();
		skillBoosts.updateAllObstacles();
	}
}

onInterfaceReady(() => {
	generalSettings.add([{
		type: 'custom',
		name: 'agilityCost',
		label: '',
		default: [],
		onChange: (value) => { },
		render(name, onChange, config) {
			let container = createElement('div', { className: 'text-center' });
			new AgilityCostSetting(container);
			return container;
		},
		get: function (root) { },
		set: function (root, value) { }
	}]);
});