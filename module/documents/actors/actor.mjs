import { FUItem } from '../items/item.mjs';
import { FUHooks } from '../../hooks.mjs';
import { toggleStatusEffect } from '../../pipelines/effects.mjs';
import { SYSTEM } from '../../helpers/config.mjs';
import { Flags } from '../../helpers/flags.mjs';

/**
 * @typedef Actor
 * @description The client-side Actor document which extends the common BaseActor model.
 * @property {Boolean} isToken
 * @property {ActiveEffect[]} appliedEffects
 * @property {ActiveEffect[]} temporaryEffects
 * @property {Boolean} inCombat
 * @property {String} id The canonical identifier for this Document.
 * @property {String} uuid A Universally Unique Identifier (uuid) for this Document instance.
 * @property {Function<Boolean, Boolean,[Token]>} getActiveTokens Retrieve an Array of active tokens which represent this Actor in the current
 * canvas Scene. If the canvas is not currently active, or there are no linked actors, the returned Array will be empty.
 * If the Actor is a synthetic token actor, only the exact Token which it represents will be returned.
 */

/**
 * @typedef Token
 * @description A Token is an implementation of PlaceableObject which represents an Actor within a viewed Scene on the game canvas.
 * @property {String} name Convenience access to the token's nameplate string
 * @property {Actor} actor A convenient reference to the Actor object associated with the Token embedded document.
 * @property {Combatant} combatant Return a reference to a Combatant that represents this Token, if one is present in the current encounter.
 * @property {Boolean} isTargeted An indicator for whether the Token is currently targeted by the active game User
 * @property {Point} center The Token's current central position
 */

/**
 * @class
 * @description Extend the base Actor document by defining a custom roll data structure
 * @extends {Actor}
 * @property {CharacterDataModel | NpcDataModel} system
 * @remarks {@link https://foundryvtt.com/api/classes/client.Actor.html}
 * @inheritDoc
 */
export class FUActor extends Actor {
	/** @override */
	prepareData() {
		// Prepare data for the actor. Calling the super version of this executes
		// the following, in order: data reset (to clear active effects),
		// prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
		// prepareDerivedData().
		super.prepareData();
		Hooks.callAll(FUHooks.DATA_PREPARED_ACTOR, this);
	}

	async getData(options = {}) {
		const data = await super.getData(options);

		// Add the spTracker data to the actor's data
		data.spTracker = this.spTracker;

		//Add the tlTracker data to the actor's data
		data.tlTracker = this.tlTracker;

		return data;
	}

	/** @override */
	prepareBaseData() {
		// Data modifications in this step occur before processing embedded
		// documents or derived data.
	}

	/**
	 * @override
	 * Augment the basic actor data with additional dynamic data. Typically,
	 * you'll want to handle most of your calculated/derived data in this step.
	 * Data calculated in this step should generally not exist in template.json
	 * (such as ability modifiers rather than ability scores) and should be
	 * available both inside and outside of character sheets (such as if an actor
	 * is queried and has a roll executed directly from it).
	 */
	prepareDerivedData() {
		this.items.forEach((item) => item.applyActiveEffects());
	}

	/**
	 * @override
	 */
	toObject() {
		const result = super.toObject();
		result.uuid = this.uuid;
		return result;
	}

	get tlTracker() {
		return this.system.tlTracker;
	}

	get spTracker() {
		return this.system.spTracker;
	}

	/**
	 * Override getRollData() that's supplied to rolls.
	 */
	getRollData() {
		const data = super.getRollData();

		// Prepare character roll data.
		this._getCharacterRollData(data);
		this._getNpcRollData(data);

		return data;
	}

	/**
	 * Prepare character roll data.
	 */
	_getCharacterRollData() {
		// Copy the ability scores to the top level, so that rolls can use
		// formulas like `@str.mod + 4`.
		// if (data.abilities) {
		//   for (let [k, v] of Object.entries(data.abilities)) {
		//     data[k] = foundry.utils.deepClone(v);
		//   }
		// }
		// Add level for easier access, or fall back to 0.
		// if (data.attributes.level) {
		//   data.lvl = data.attributes.level.value ?? 0;
		// }
	}

	/**
	 * Prepare NPC roll data.
	 */
	_getNpcRollData() {
		// Process additional NPC data here.
	}

	async _preCreate(createData, options, user) {
		await super._preCreate(createData, options, user);

		if (this.type === 'character') {
			this.updateSource({
				prototypeToken: {
					actorLink: true,
					disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
				},
			});
		}
	}

	async _onCreate(createData, options, userId) {
		await super._onCreate(createData, options, userId);

		if (this.type === 'character' || this.type === 'npc') {
			// Load the compendium
			const pack = game.packs.get('projectfu.basic-equipment');
			const content = await pack.getDocuments();

			// Find the item with system.fuid === 'unarmed-strike'
			const unarmedStrikeItem = content.find((item) => foundry.utils.getProperty(item, 'system.fuid') === 'unarmed-strike');

			if (unarmedStrikeItem) {
				// Check if the item already exists in the character's inventory
				const existingItem = this.items.find((item) => foundry.utils.getProperty(item, 'system.fuid') === 'unarmed-strike');

				if (!existingItem) {
					// Add the item to the character
					await this.createEmbeddedDocuments('Item', [unarmedStrikeItem.toObject()]);
				}
			}
		}
	}

	async _preUpdate(changed, options, user) {
		const changedHP = changed.system?.resources?.hp;
		const currentHP = this.system.resources.hp;

		if (typeof changedHP?.value === 'number' && currentHP) {
			const hpChange = changedHP.value - currentHP.value;
			const levelChanged = !!changed.system && 'level' in changed.system;
			if (hpChange !== 0 && !levelChanged) {
				options.damageTaken = hpChange * -1;
			}
		}

		await super._preUpdate(changed, options, user);
	}

	/**
	 * @returns {Promise<void>}
	 * @private
	 * @override
	 */
	async _onUpdate(changed, options, userId) {
		const { hp } = this.system?.resources || {};

		if (hp && userId === game.userId) {
			const crisisThreshold = Math.floor(hp.max / 2);
			const shouldBeInCrisis = hp.value <= crisisThreshold;
			const isInCrisis = this.statuses.has('crisis');
			if (shouldBeInCrisis !== isInCrisis) {
				Hooks.call(
					FUHooks.CRISIS_EVENT,
					/** @type CrisisEvent **/
					{
						actor: this,
						token: this.resolveToken(),
					},
				);
				await toggleStatusEffect(this, 'crisis');
			}

			// Handle KO status
			const shouldBeKO = hp.value === 0; // KO when HP is 0
			const isKO = this.statuses.has('ko');
			if (shouldBeKO !== isKO) {
				Hooks.call(
					FUHooks.DEFEAT_EVENT,
					/** @type DefeatEvent **/
					{
						actor: this,
						token: this.resolveToken(),
					},
				);
				await toggleStatusEffect(this, 'ko');
			}
		}
		super._onUpdate(changed, options, userId);
	}

	async showFloatyText(input, fill) {
		if (!canvas.scene) {
			return;
		}

		const [token] = this.getActiveTokens();

		if (token && typeof input === 'number') {
			const gridSize = canvas.scene.grid.size;
			const scrollingTextArgs = [
				{ x: token.x + gridSize / 2, y: token.y + gridSize - 20 },
				Math.abs(input),
				{
					fill: fill ?? (input < 0 ? 'lightgreen' : 'white'),
					fontSize: 32,
					stroke: 0x000000,
					strokeThickness: 4,
				},
			];
			await token._animation;
			await canvas.interface?.createScrollingText(...scrollingTextArgs);
		} else {
			const gridSize = canvas.scene.grid.size;
			const scrollingTextArgs = [
				{ x: token.x + gridSize / 2, y: token.y + gridSize - 20 },
				input,
				{
					fill: fill ?? 'white',
					fontSize: 32,
					stroke: 0x000000,
					strokeThickness: 4,
				},
			];
			await token._animation;
			await canvas.interface?.createScrollingText(...scrollingTextArgs);
		}
	}

	*allApplicableEffects() {
		for (const effect of super.allApplicableEffects()) {
			const item = effect.parent;

			if (item instanceof FUItem) {
				if (item.system.transferEffects instanceof Function ? item.system.transferEffects() : true) {
					yield effect;
				}
			} else {
				// Effects exist directly on the actor
				yield effect;
			}
		}
	}

	/**
	 * @return {Generator<ActiveEffect, void, void>}
	 */
	*allEffects() {
		for (const effect of this.effects) {
			yield effect;
		}
		for (const item of this.items) {
			for (const effect of item.effects) {
				yield effect;
			}
		}
	}

	/**
	 * @override
	 * @returns {ActiveEffect[]}
	 */
	get temporaryEffects() {
		const effects = super.temporaryEffects;
		for (const item of this.items) {
			if (item.system.transferEffects instanceof Function ? item.system.transferEffects() : true) {
				for (const effect of item.effects) {
					if (effect.isTemporary && effect.target === item) {
						effects.push(effect);
					}
				}
			}
		}
		return effects;
	}

	applyActiveEffects() {
		if (this.system.prepareEmbeddedData instanceof Function) {
			this.system.prepareEmbeddedData();
		}
		return super.applyActiveEffects();
	}

	async gainMetaCurrency() {
		let metaCurrency;
		if (this.type === 'character') {
			metaCurrency = game.i18n.localize('FU.Fabula');
		}
		if (this.type === 'npc' && this.system.villain.value) {
			metaCurrency = game.i18n.localize('FU.Ultima');
		}

		if (metaCurrency) {
			await this.update({
				'system.resources.fp.value': this.system.resources.fp.value + 1,
			});
			/** @type ChatMessageData */
			const chatData = {
				user: game.user.id,
				speaker: ChatMessage.getSpeaker({ actor: this.name }),
				flavor: game.i18n.format('FU.GainMetaCurrencyChatFlavor', { type: metaCurrency }),
				content: game.i18n.format('FU.GainMetaCurrencyChatMessage', { actor: this.name, type: metaCurrency }),
			};
			ChatMessage.create(chatData);
		}
	}

	/**
	 * @param force
	 * @return {Promise<boolean>}
	 */
	async spendMetaCurrency(force = false) {
		let metaCurrency;
		if (this.type === 'character') {
			metaCurrency = game.i18n.localize('FU.Fabula');
		}
		if (this.type === 'npc' && this.system.villain.value) {
			metaCurrency = game.i18n.localize('FU.Ultima');
		}
		if (metaCurrency && this.system.resources.fp.value > 0) {
			const confirmed =
				force ||
				(await Dialog.confirm({
					title: game.i18n.format('FU.UseMetaCurrencyDialogTitle', { type: metaCurrency }),
					content: game.i18n.format('FU.UseMetaCurrencyDialogMessage', { type: metaCurrency }),
					options: { classes: ['projectfu', 'unique-dialog', 'dialog-reroll', 'backgroundstyle'] },
					rejectClose: false,
				}));
			if (confirmed && this.system.resources.fp.value > 0) {
				/** @type ChatMessageData */
				const data = {
					speaker: ChatMessage.implementation.getSpeaker({ actor: this }),
					flavor: game.i18n.format('FU.UseMetaCurrencyChatFlavor', { type: metaCurrency }),
					content: game.i18n.format('FU.UseMetaCurrencyChatMessage', { actor: this.name, type: metaCurrency }),
					flags: {
						[SYSTEM]: {
							[Flags.ChatMessage.UseMetaCurrency]: true,
						},
					},
				};
				ChatMessage.create(data);
				await this.update({
					'system.resources.fp.value': this.system.resources.fp.value - 1,
				});
				return true;
			}
		} else {
			ui.notifications.info(game.i18n.format('FU.UseMetaCurrencyNotificationInsufficientPoints', { actor: this.name, type: metaCurrency }));
			return false;
		}
	}

	/**
	 * @returns {Token}
	 * @remarks https://foundryvtt.com/api/classes/client.TokenDocument.html
	 */
	resolveToken() {
		// For unlinked actors (usually NPCs)
		if (this.token) {
			return this.token.object;
		}
		// For linked actors (PCs, sometimes villains?)
		const tokens = this.getActiveTokens();
		if (tokens) {
			return tokens[0];
		}
		throw Error(`Failed to get token for ${this.uuid}`);
	}

	/**
	 * Returns an array of items that match a given FUID and optionally an item type
	 * @param {string} fuid - The FUID of the item(s) which you want to retrieve
	 * @param {string} [type] - Optionally, a type name to restrict the search
	 * @returns {Array} - An array containing the found items
	 */
	getItemsByFuid(fuid, type) {
		const fuidFilter = (i) => i.system.fuid === fuid;
		if (!type) return this.items.filter(fuidFilter);
		const itemTypes = this.itemTypes;
		if (!Object.prototype.hasOwnProperty.call(itemTypes, type)) {
			throw new Error(`Type ${type} is invalid!`);
		}
		return itemTypes[type].filter(fuidFilter);
	}

	/**
	 * @description Deletes all temporary effets on the actor
	 */
	clearTemporaryEffects() {
		// Collect effects to delete
		const effectsToDelete = this.effects.filter((effect) => {
			// If it's a status effect
			const statusEffectId = CONFIG.statusEffects.find((e) => effect.statuses?.has(e.id))?.id;
			if (statusEffectId) {
				const immunity = this.system.immunities[statusEffectId];
				if (immunity) {
					return immunity;
				}
			}
			return effect.isTemporary;
		});

		// Delete all collected effects
		if (effectsToDelete.length > 0) {
			Promise.all(effectsToDelete.map((effect) => effect.delete()));
		}
	}

	/**
	 * Fetch an item that matches a given FUID and optionally an item type
	 * @param {string} fuid - The FUID of the item(s) which you want to retrieve
	 * @param {string} [type] - Optionally, a type name to restrict the search
	 * @returns {Object|undefined} - The matching item, or undefined if none was found.
	 */
	getSingleItemByFuid(fuid, type) {
		return this.getItemsByFuid(fuid, type)[0];
	}
}
