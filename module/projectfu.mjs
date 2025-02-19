// Import document classes.
import { FUActor } from './documents/actors/actor.mjs';
import { FUItem } from './documents/items/item.mjs';
// Import sheet classes.
import { FUStandardActorSheet } from './sheets/actor-standard-sheet.mjs';
import { FUItemSheet } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { FU, SYSTEM } from './helpers/config.mjs';
import { registerSystemSettings, SETTINGS } from './settings.js';
import { addRollContextMenuEntries, createCheckMessage, promptCheck, promptOpenCheck, rollCheck } from './helpers/checks.mjs';
import { FUCombatTracker } from './ui/combat-tracker.mjs';
import { FUCombat } from './ui/combat.mjs';
import { FUCombatant } from './ui/combatant.mjs';
import { GroupCheck } from './helpers/group-check.mjs';
import { CharacterDataModel } from './documents/actors/character/character-data-model.mjs';
import { NpcDataModel } from './documents/actors/npc/npc-data-model.mjs';
import { AccessoryDataModel } from './documents/items/accessory/accessory-data-model.mjs';
import { ArmorDataModel } from './documents/items/armor/armor-data-model.mjs';
import { BasicItemDataModel } from './documents/items/basic/basic-item-data-model.mjs';
import { BehaviorDataModel } from './documents/items/behavior/behavior-data-model.mjs';
import { ClassDataModel } from './documents/items/class/class-data-model.mjs';
import { ConsumableDataModel } from './documents/items/consumable/consumable-data-model.mjs';
import { HeroicSkillDataModel } from './documents/items/heroic/heroic-skill-data-model.mjs';
import { MiscAbilityDataModel } from './documents/items/misc/misc-ability-data-model.mjs';
import { ProjectDataModel } from './documents/items/project/project-data-model.mjs';
import { RitualDataModel } from './documents/items/ritual/ritual-data-model.mjs';
import { RuleDataModel } from './documents/items/rule/rule-data-model.mjs';
import { ShieldDataModel } from './documents/items/shield/shield-data-model.mjs';
import { SkillDataModel } from './documents/items/skill/skill-data-model.mjs';
import { SpellDataModel } from './documents/items/spell/spell-data-model.mjs';
import { TreasureDataModel } from './documents/items/treasure/treasure-data-model.mjs';
import { ZeroPowerDataModel } from './documents/items/zeropower/zero-power-data-model.mjs';
import { WeaponDataModel } from './documents/items/weapon/weapon-data-model.mjs';
import { EffectDataModel } from './documents/items/effect/effect-data-model.mjs';
import { onSocketLibReady } from './socket.mjs';
import { statusEffects } from './helpers/statuses.mjs';

import { ClassFeatureTypeDataModel } from './documents/items/classFeature/class-feature-type-data-model.mjs';
import { FUClassFeatureSheet } from './documents/items/classFeature/class-feature-sheet.mjs';
import { ClassFeatureDataModel, RollableClassFeatureDataModel } from './documents/items/classFeature/class-feature-data-model.mjs';
import { registerClassFeatures } from './documents/items/classFeature/class-features.mjs';

import { OptionalFeatureTypeDataModel } from './documents/items/optionalFeature/optional-feature-type-data-model.mjs';
import { FUOptionalFeatureSheet } from './documents/items/optionalFeature/optional-feature-sheet.mjs';
import { OptionalFeatureDataModel, RollableOptionalFeatureDataModel } from './documents/items/optionalFeature/optional-feature-data-model.mjs';
import { registerOptionalFeatures } from './documents/items/optionalFeature/optional-features.mjs';

import { rolldataHtmlEnricher } from './helpers/rolldata-html-enricher.mjs';
import { FUActiveEffect } from './documents/effects/active-effect.mjs';
import { InlineDamage } from './helpers/inline-damage.mjs';
import { CanvasDragDrop } from './helpers/canvas-drag-drop.mjs';
import { InlineResources } from './helpers/inline-resources.mjs';
import { InlineChecks } from './helpers/inline-check.mjs';
import { Flags } from './helpers/flags.mjs';
import { InlineIcon } from './helpers/inline-icons.mjs';
import { TextEditorCommandDropdown } from './helpers/text-editor-command-dropdown.mjs';
import { InlineEffects } from './helpers/inline-effects.mjs';
import { SystemControls } from './helpers/system-controls.mjs';
import { PlayerListEnhancements } from './helpers/player-list-enhancements.mjs';
import { ChecksV2 } from './checks/checks-v2.mjs';
import { CheckConfiguration } from './checks/check-configuration.mjs';
import { slugify } from './util.mjs';
import { ActionHandler } from './helpers/action-handler.mjs';
import { StudyRollHandler } from './helpers/study-roll.mjs';
import { ItemCustomizer } from './helpers/item-customizer.mjs';
import { FUHooks } from './hooks.mjs';
import { DamagePipeline } from './pipelines/damage-pipeline.mjs';
import { ResourcePipeline } from './pipelines/resource-pipeline.mjs';
import { InlineWeapon } from './helpers/inline-weapon.mjs';
import { Targeting } from './helpers/targeting.mjs';
import { InlineHelper } from './helpers/inline-helper.mjs';
import { InlineAffinity } from './helpers/inline-affinity.mjs';
import { Effects } from './pipelines/effects.mjs';

globalThis.projectfu = {
	ClassFeatureDataModel,
	RollableClassFeatureDataModel,
	OptionalFeatureDataModel,
	RollableOptionalFeatureDataModel,
	SYSTEM,
	Flags,
	SystemControls,
	ChecksV2,
	CheckConfiguration,
	ActionHandler,
	StudyRollHandler,
	ItemCustomizer,
};

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

// System Data Model
// Hooks.on("init", () => {
//   CONFIG.Actor.systemDataModels.character = CharacterData;
// });

/**
 * Monkey patch foundry.data.fields.DataField._applyChangeCustom to return the initial value instead of "undefined" when the value was not changed in a way detectable by "!==".
 */
function monkeyPatchDataFieldApplyCustomChange() {
	if (game.release.isNewer('12')) {
		const original = foundry.data.fields.DataField.prototype._applyChangeCustom;
		foundry.data.fields.DataField.prototype._applyChangeCustom = function (value, delta, model, change) {
			const result = original(value, delta, model, change);
			if (result === undefined) {
				return foundry.utils.getProperty(model, change.key);
			} else {
				return result;
			}
		};
	}
}

Hooks.once('init', async () => {
	// Add utility classes to the global game object so that they're more easily
	// accessible in global contexts.
	game.projectfu = {
		FUActor,
		FUItem,
		rollItemMacro,
		rollCheck,
		createCheckMessage,
		GroupCheck: GroupCheck,
		ClassFeatureDataModel,
		RollableClassFeatureDataModel,
		OptionalFeatureDataModel,
		RollableOptionalFeatureDataModel,
		ChecksV2,
		CheckConfiguration,
		ActionHandler,
		ItemCustomizer,
		util: {
			slugify,
		},
	};

	// Add custom constants for configuration.
	CONFIG.FU = FU;

	/**
	 * Set an initiative formula for the system
	 * @type {String}
	 */
	CONFIG.Combat.initiative = {
		formula: '1d@attributes.dex.current + 1d@attributes.ins.current + @derived.init.value',
		decimals: 2,
	};

	monkeyPatchDataFieldApplyCustomChange();

	// Define custom Document classes
	CONFIG.Actor.documentClass = FUActor;
	CONFIG.Actor.dataModels = {
		character: CharacterDataModel,
		npc: NpcDataModel,
	};
	CONFIG.Actor.trackableAttributes = {
		character: {
			bar: ['resources.hp', 'resources.mp', 'resources.ip'],
			value: ['resources.fp.value', 'resources.exp.value'],
		},
		npc: {
			bar: ['resources.hp', 'resources.mp'],
			value: ['resources.fp.value'],
		},
	};
	CONFIG.Item.documentClass = FUItem;
	CONFIG.Item.dataModels = {
		accessory: AccessoryDataModel,
		armor: ArmorDataModel,
		basic: BasicItemDataModel,
		behavior: BehaviorDataModel,
		class: ClassDataModel,
		classFeature: ClassFeatureTypeDataModel,
		optionalFeature: OptionalFeatureTypeDataModel,
		consumable: ConsumableDataModel,
		heroic: HeroicSkillDataModel,
		miscAbility: MiscAbilityDataModel,
		project: ProjectDataModel,
		ritual: RitualDataModel,
		rule: RuleDataModel,
		shield: ShieldDataModel,
		skill: SkillDataModel,
		spell: SpellDataModel,
		treasure: TreasureDataModel,
		weapon: WeaponDataModel,
		zeroPower: ZeroPowerDataModel,
		effect: EffectDataModel,
	};
	CONFIG.ActiveEffect.documentClass = FUActiveEffect;

	// Register system settings
	registerSystemSettings();

	if (game.settings.get(SYSTEM, SETTINGS.experimentalCombatTracker)) {
		console.log(`${SYSTEM} | Initializing experimental combat tracker`);
		CONFIG.Combat.documentClass = FUCombat;
		CONFIG.Combatant.documentClass = FUCombatant;
		CONFIG.Combat.initiative = {
			formula: '1',
			decimals: 0,
		};
		CONFIG.ui.combat = FUCombatTracker;
	}

	// Register status effects
	CONFIG.ActiveEffect.legacyTransferral = false;
	CONFIG.statusEffects = statusEffects;
	CONFIG.specialStatusEffects.DEFEATED = 'ko';

	// Register sheet application classes
	Actors.unregisterSheet('core', ActorSheet);
	Actors.registerSheet('projectfu', FUStandardActorSheet, {
		makeDefault: true,
		label: 'Standard Actor Sheet',
	});
	Items.unregisterSheet('core', ItemSheet);
	Items.registerSheet('projectfu', FUItemSheet, {
		makeDefault: true,
		label: 'Standard Item Sheet',
	});
	Items.registerSheet(SYSTEM, FUClassFeatureSheet, {
		types: ['classFeature'],
		makeDefault: true,
		label: 'Class Feature Sheet',
	});
	Items.registerSheet(SYSTEM, FUOptionalFeatureSheet, {
		types: ['optionalFeature'],
		makeDefault: true,
		label: 'Optional Feature Sheet',
	});

	Hooks.on('getChatLogEntryContext', addRollContextMenuEntries);
	DamagePipeline.initialize();
	Effects.initialize();
	Hooks.on(`renderChatMessage`, ResourcePipeline.onRenderChatMessage);
	Hooks.on(`renderChatMessage`, Targeting.onRenderChatMessage);

	registerClassFeatures(CONFIG.FU.classFeatureRegistry);
	registerOptionalFeatures(CONFIG.FU.optionalFeatureRegistry);

	CONFIG.TextEditor.enrichers.push(rolldataHtmlEnricher);

	CONFIG.TextEditor.enrichers.push(InlineDamage.enricher);
	Hooks.on('renderChatMessage', InlineDamage.activateListeners);
	Hooks.on('renderApplication', InlineDamage.activateListeners);
	Hooks.on('renderActorSheet', InlineDamage.activateListeners);
	Hooks.on('renderItemSheet', InlineDamage.activateListeners);
	Hooks.on('dropActorSheetData', InlineDamage.onDropActor);

	CONFIG.TextEditor.enrichers.push(...InlineResources.enrichers);
	Hooks.on('renderChatMessage', InlineResources.activateListeners);
	Hooks.on('renderApplication', InlineResources.activateListeners);
	Hooks.on('renderActorSheet', InlineResources.activateListeners);
	Hooks.on('renderItemSheet', InlineResources.activateListeners);
	Hooks.on('dropActorSheetData', InlineResources.onDropActor);

	CONFIG.TextEditor.enrichers.push(InlineChecks.enricher);
	Hooks.on('renderChatMessage', InlineChecks.activateListeners);
	Hooks.on('renderApplication', InlineChecks.activateListeners);
	Hooks.on('renderActorSheet', InlineChecks.activateListeners);
	Hooks.on('renderItemSheet', InlineChecks.activateListeners);

	CONFIG.TextEditor.enrichers.push(InlineWeapon.enricher);
	Hooks.on('renderChatMessage', InlineWeapon.activateListeners);
	Hooks.on('renderApplication', InlineWeapon.activateListeners);
	Hooks.on('renderActorSheet', InlineWeapon.activateListeners);
	Hooks.on('renderItemSheet', InlineWeapon.activateListeners);
	Hooks.on('dropActorSheetData', InlineWeapon.onDropActor);

	InlineHelper.registerEnricher(InlineAffinity.enricher, InlineAffinity.activateListeners, InlineAffinity.onDropActor);

	CONFIG.TextEditor.enrichers.push(InlineIcon.enricher);

	InlineEffects.initialize();

	Hooks.on('dropCanvasData', CanvasDragDrop.onDropCanvasData);

	TextEditorCommandDropdown.initialize();

	SystemControls.initialize();

	PlayerListEnhancements.initialize();

	// Preload Handlebars templates.
	return preloadHandlebarsTemplates();
});

Hooks.once('setup', () => {});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here are a few useful examples:
Handlebars.registerHelper('concat', function () {
	var outStr = '';
	for (var arg in arguments) {
		if (typeof arguments[arg] != 'object') {
			outStr += arguments[arg];
		}
	}
	return outStr;
});

Handlebars.registerHelper('toLowerCase', function (str) {
	return str.toLowerCase();
});

Handlebars.registerHelper('translate', function (str) {
	const result = Object.assign(
		{
			spell: 'FU.Spell',
			hp: 'FU.HealthAbbr',
			mp: 'FU.MindAbbr',
			ip: 'FU.InventoryAbbr',
			shields: 'FU.Shield',
			arcanism: 'FU.Arcanism',
			chimerism: 'FU.Chimerism',
			elementalism: 'FU.Elementalism',
			entropism: 'FU.Entropism',
			ritualism: 'FU.Ritualism',
			spiritism: 'FU.Spiritism',
		},
		CONFIG.FU.damageTypes,
		CONFIG.FU.itemTypes,
		CONFIG.FU.weaponTypes,
	);

	return result?.[str] ?? str;
});

Handlebars.registerHelper('getGameSetting', function (settingKey) {
	return game.settings.get('projectfu', settingKey);
});

Handlebars.registerHelper('capitalize', function (str) {
	if (str && typeof str === 'string') {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
	return str;
});

Handlebars.registerHelper('uppercase', function (str) {
	if (str && typeof str === 'string') {
		return str.toUpperCase();
	}
	return str;
});

Handlebars.registerHelper('neq', function (a, b, options) {
	if (a !== b) {
		return options.fn(this);
	}
	return '';
});

Handlebars.registerHelper('half', function (value) {
	var num = Number(value);
	if (isNaN(num)) {
		return '';
	}
	return Math.floor(num / 2);
});

Handlebars.registerHelper('calculatePercentage', function (value, max) {
	value = parseFloat(value);
	max = parseFloat(max);
	const percentage = (value / max) * 100;
	return percentage.toFixed(2) + '%';
});

Handlebars.registerHelper('crisis', function (value, max) {
	value = parseFloat(value);
	max = parseFloat(max);
	const half = max / 2;
	return value <= half;
});

Handlebars.registerHelper('lookupItemById', function (items, itemId) {
	return items.find((item) => item._id === itemId);
});

Handlebars.registerHelper('isItemEquipped', function (item, equippedItems) {
	if (!item || !equippedItems) {
		console.error('Item or equippedItems is missing.');
		return false;
	}

	// Ensure equippedItems is an object and includes the item ID
	if (typeof equippedItems === 'object' && Object.values(equippedItems).includes(item._id)) {
		return true;
	}

	return false;
});

// Define a Handlebars helper to get the icon class based on item properties
Handlebars.registerHelper('getIconClass', function (item, equippedItems) {
	if (!item || !item._id || !equippedItems) {
		return '';
	}

	const itemId = item._id;

	// Check if item is equipped in any slot
	const isEquipped = Object.values(equippedItems).includes(itemId);

	// Default icon if the item is not equipped
	if (!isEquipped) {
		return 'fas fa-circle ra-1xh';
	}

	// Special case: if item is equipped in both mainHand and offHand
	if (itemId === equippedItems.mainHand && itemId === equippedItems.offHand) {
		return 'is-two-weapon equip ra-1xh';
	}
	// Special case: if shield is equipped in mainHand
	if (itemId === equippedItems.mainHand && item.type === 'shield') {
		return 'ra ra-heavy-shield ra-1xh';
	}
	// Special case: if item is in the phantom slot
	if (item.type === 'weapon' && itemId === equippedItems.phantom) {
		return 'ra ra-daggers ra-1xh';
	}
	if (item.type === 'weapon') {
		if (itemId === equippedItems.mainHand) {
			return 'ra ra-sword ra-1xh ra-flip-horizontal';
		} else if (itemId === equippedItems.offHand) {
			return 'ra ra-plain-dagger ra-1xh ra-rotate-180';
		}
	} else if (item.type === 'shield') {
		if (itemId === equippedItems.offHand) {
			return 'ra ra-shield ra-1xh';
		} else if (itemId === equippedItems.mainHand) {
			return 'ra ra-heavy-shield ra-1xh';
		}
	} else if (item.type === 'armor') {
		if (itemId === equippedItems.armor) {
			return 'ra ra-helmet ra-1xh';
		}
	} else if (item.type === 'accessory') {
		if (itemId === equippedItems.accessory) {
			return 'fas fa-leaf ra-1xh';
		}
	}

	return 'fas fa-circle ra-1xh';
});

Handlebars.registerHelper('getSlot', function (item) {
	if (!item || !item.system) return '';
	if (item.type === 'weapon') {
		return item.system.hands.value === 'two-handed' ? 'mainHand' : 'offHand';
	} else if (item.type === 'shield') {
		return 'offHand';
	} else if (item.type === 'armor') {
		return 'armor';
	} else if (item.type === 'accessory') {
		return 'accessory';
	}
	return '';
});

Handlebars.registerHelper('mathAbs', function (value) {
	return Math.abs(value);
});

Handlebars.registerHelper('formatMod', function (value) {
	if (value > 0) {
		return '+' + value;
	} else if (value < 0) {
		return value;
	}
	return value;
});

Handlebars.registerHelper('inArray', function (item, array, options) {
	if (Array.isArray(array) && array.includes(item)) {
		return options.fn(this);
	} else {
		return options.inverse ? options.inverse(this) : '';
	}
});

Handlebars.registerHelper('inSet', function (item, set) {
	return set.has(item);
});

Handlebars.registerHelper('formatResource', function (resourceValue, resourceMax, resourceName) {
	// Convert value to a string to split into 3 digits
	const valueString = resourceValue.toString().padStart(3, '0');
	const isCrisis = resourceValue <= resourceMax / 2 && resourceName == 'HP';
	const digitBoxes = valueString
		.split('')
		.map(
			(digit) =>
				`<div class="digit-box${isCrisis ? ' crisis' : ''}">
            <span class="inner-shadow">
                <span class="number">${digit}</span>
            </span>
        </div>`,
		)
		.join('');

	return new Handlebars.SafeString(`<span>${resourceName}</span><span class="digit-row">${digitBoxes}</span>`);
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', async function () {
	// Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
	Hooks.on('hotbarDrop', (bar, data, slot) => createItemMacro(data, slot));

	Hooks.on('rollEquipment', (actor, slot) => {
		// Detect if the shift key is currently pressed
		const isShift = game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.SHIFT);

		// Call the rollEquipment function
		rollEquipment(actor, slot, isShift);
	});

	function handleNoActor(actor) {
		if (!actor) {
			ui.notification.error('No character for this user');
			return true;
		}
		return false;
	}

	Hooks.on('promptOpenCheckCalled', (actor) => {
		if (handleNoActor(actor)) return;
		promptOpenCheck(actor);
	});

	Hooks.on('promptAttributeCheckCalled', (actor) => {
		if (handleNoActor(actor)) return;
		promptCheck(actor);
	});

	Hooks.on('promptGroupCheckCalled', (actor) => {
		if (handleNoActor(actor)) return;
		let isShift = false;
		GroupCheck.promptCheck(actor, isShift);
	});

	Hooks.on('promptInitiativeCheckCalled', (actor) => {
		if (handleNoActor(actor)) return;
		let isShift = true;
		GroupCheck.promptCheck(actor, isShift);
	});

	Hooks.on('preCreateItem', (itemData, options, userId) => {
		if (!itemData.system.fuid && itemData.name) {
			// Generate FUID using the slugify utility
			const fuid = game.projectfu.util.slugify(itemData.name);

			// Check if slugify returned a valid FUID
			if (fuid) {
				itemData.updateSource({ 'system.fuid': fuid });
			} else {
				console.error('FUID generation failed for Item:', itemData.name, 'using slugify.');
			}
		}
	});

	Hooks.on('preCreateActiveEffect', (effect, options, userId) => {
		const actor = effect.parent;
		if (!actor || !actor.system || !actor.system.immunities) return true;

		// Check if the effect is a status effect
		const statusEffectId = CONFIG.statusEffects.find((e) => effect.statuses?.has(e.id))?.id;

		// Check for immunity using statusEffectId
		if (statusEffectId) {
			const immunityData = actor.system.immunities[statusEffectId];

			// If immune, block effect creation
			if (immunityData?.base) {
				const message = game.i18n.format('FU.ImmunityDescription', {
					status: statusEffectId,
				});

				ChatMessage.create({
					content: message,
					speaker: ChatMessage.getSpeaker({ actor: actor }),
				});

				return false; // Prevent the effect from being created
			}
		}

		return true; // Allow the effect to be created
	});

	Hooks.on(FUHooks.DATA_PREPARED_ACTOR, (actor) => {
		if (!actor.system || !actor.system.immunities) return;

		// Iterate over the actor's active effects
		for (let effect of actor.effects) {
			const statusEffectId = CONFIG.statusEffects.find((e) => effect.statuses?.has(e.id))?.id;

			if (statusEffectId) {
				const immunityData = actor.system.immunities[statusEffectId];

				// If immune, deletes the effect from the actor
				if (immunityData?.base) {
					effect.delete();
				}
			}
		}
	});

	Hooks.on('preUpdateActor', async (actor, updateData, options, userId) => {
		const equipped = foundry.utils.getProperty(updateData, 'system.equipped');

		if (!equipped) return;

		// Check if main hand or off hand is being unequipped
		const mainHandUnequipped = equipped.mainHand === null;
		const offHandUnequipped = equipped.offHand === null;

		// If neither hand is unequipped, exit early
		if (!mainHandUnequipped && !offHandUnequipped) return;

		// Get the Unarmed Strike item
		const unarmedStrike = actor.getSingleItemByFuid('unarmed-strike');
		if (!unarmedStrike) return;

		// Prepare updates only if necessary
		const updates = {};
		if (mainHandUnequipped) updates['system.equipped.mainHand'] = unarmedStrike.id;
		if (offHandUnequipped) updates['system.equipped.offHand'] = unarmedStrike.id;

		// Perform the update if there are changes
		if (Object.keys(updates).length > 0) {
			await actor.update(updates);
		}
	});
});

Hooks.once('socketlib.ready', onSocketLibReady);

/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {null | false}
 */
function createItemMacro(data, slot) {
	// First, determine if this is a valid owned item.
	if (data.type !== 'Item') return;
	if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
		ui.notifications.warn('You can only create macro buttons for owned Items');
		return false;
	}
	// If it is, retrieve it based on the uuid.
	Item.fromDropData(data).then((item) => {
		// Create the macro command using the uuid.
		const command = `game.projectfu.rollItemMacro("${data.uuid}");`;
		let macro = game.macros.find((m) => m.name === item.name && m.command === command);
		if (!macro) {
			Macro.create({
				name: item.name,
				type: 'script',
				img: item.img,
				command: command,
				flags: { 'projectfu.itemMacro': true },
			}).then((macro) => game.user.assignHotbarMacro(macro, slot));
		} else {
			game.user.assignHotbarMacro(macro, slot);
		}
	});
	return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
	// Reconstruct the drop data so that we can load the item.
	const dropData = {
		type: 'Item',
		uuid: itemUuid,
	};
	// Load the item from the uuid.
	Item.fromDropData(dropData).then((item) => {
		// Determine if the item loaded and if it's an owned item.
		if (!item || !item.parent) {
			const itemName = item?.name ?? itemUuid;
			return ui.notifications.warn(`Could not find item ${itemName}. You may need to delete and recreate this macro.`);
		}

		// Trigger the item roll
		item.roll();
	});
}

/**
 * Rolls equipment for the specified actor and slot.
 * @param {Actor} actor The actor whose equipment will be rolled.
 * @param {string} slot The slot of the equipment to roll ('mainHand', 'offHand', 'armor', or 'accessory').
 * @param {boolean} isShift Indicates whether the shift key is pressed.
 */
function rollEquipment(actor, slot, isShift) {
	// Check if the slot is valid
	const validSlots = ['mainHand', 'offHand', 'armor', 'accessory', 'phantom', 'arcanum'];
	if (!validSlots.includes(slot)) {
		ui.notifications.warn(`Invalid slot: ${slot}!`);
		return;
	}

	// Get the equipped item for the specified slot from actor.system.equipped
	const equippedItemId = actor.system.equipped[slot];

	// If no item is equipped in the specified slot
	if (!equippedItemId) {
		ui.notifications.warn(`No item equipped in ${slot} slot!`);
		return;
	}

	// Find the item in the actor's items by ID
	const item = actor.items.get(equippedItemId);

	// If the item exists, roll it
	if (item) {
		item.roll(isShift);
	} else {
		ui.notifications.warn(`Equipped item in ${slot} slot not found!`);
	}
}
