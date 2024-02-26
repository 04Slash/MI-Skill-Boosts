const { characterStorage } = mod.getContext(import.meta);

//Credits to Psycast (Equipment Presents) for the following saving system
//https://mod.io/g/melvoridle/m/psy-equipment-presets
// crc32
class SBSaving {
	constructor() {
		this.crcTable = [];
		this.crcMap = undefined;
		this.SAVE_VERSION = 1;
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
			...game.items.allObjects,
			...game.agility.actions.allObjects,
			...game.agility.pillars.allObjects,
			...game.agility.elitePillars.allObjects,
			...game.pets.allObjects,
			...game.shop.purchases.allObjects,
			...game.skills.allObjects
		];
		if (cloudManager.hasAoDEntitlement) {
			game.cartography.worldMaps.forEach((map) => {
				crcStrings.push(...map.pointsOfInterest.allObjects);
			});
		};
		let mappedIDs = crcStrings.map(item => item.id);
		mappedIDs.push('0', '1', 'mf', 'agi');
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
			this.decode(compressedData, skillBoosts.data.filteredItems, skillBoosts.data.menuStates);
	}
	save() {
		const compressedData = this.encode(skillBoosts.data.filteredItems, skillBoosts.data.menuStates);
		try {
			characterStorage.setItem('saveData', compressedData);
		} catch (e) {
			notifyPlayer(game.combat, `[Skill Boosts]: ${e}`, 'danger');
		}
	}
	decode(saveString, filteredItems, menuStates) {
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
					skills.push(this.readMapping(reader.getUint32()));
				};
				filteredItems.set(item, skills);
			}
			len = reader.getUint16();
			for (let i = 0; i < len; i++) {
				menuStates.set(this.readMapping(reader.getUint32()), this.readMapping(reader.getUint32()));
			}
		} catch (_a) {
			console.error("[Skill Boosts] Config Reader Error", _a);
		}
		this.removeNullEntries(filteredItems, menuStates);
	}
	encode(filteredItems, menuStates) {
		const writeUint32 = (value) => writer.writeUint32(this.crcMap.to.get(value) || 0);
		let writer = new SaveWriter('Write', 128);

		writer.writeString('PLMV');
		writer.writeUint16(this.SAVE_VERSION);

		writer.writeUint16(filteredItems.size);
		filteredItems.forEach((skill, item) => {
			writeUint32(item);
			writer.writeUint16(skill.length);
			skill.forEach((skill) => {
				writeUint32(skill);
			});
		});
		writer.writeUint16(menuStates.size);
		menuStates.forEach((state, skill) => {
			writeUint32(skill);
			writeUint32(state);
		});

		const rawSaveData = writer.getRawData();
		const compressedData = fflate.strFromU8(fflate.zlibSync(new Uint8Array(rawSaveData)), true);
		const saveString = btoa(compressedData);
		return saveString;
	};
	removeNullEntries(filteredItems, menuStates) {
		menuStates.delete(null);
		filteredItems.delete(null);
		filteredItems.forEach((skillArr) => {
			if (skillArr.includes(null))
				skillArr.splice(skillArr.indexOf(null), 1);
		});
	}
}

let SBSave = new SBSaving();
export { SBSave };