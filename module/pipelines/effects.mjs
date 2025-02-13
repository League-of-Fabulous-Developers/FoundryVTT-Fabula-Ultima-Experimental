import { FUActor } from '../documents/actors/actor.mjs';
import { FU, SYSTEM } from '../helpers/config.mjs';
import { FUActiveEffect } from '../documents/effects/active-effect.mjs';
import { InlineHelper } from '../helpers/inline-helper.mjs';
import { FUHooks } from '../hooks.mjs';
import { Pipeline } from './pipeline.mjs';
import { Flags } from '../helpers/flags.mjs';
import { Targeting } from '../helpers/targeting.mjs';

/**
 * @typedef EffectChangeData
 * @property {String} key The attribute path in the Actor or Item data which the change modifies
 * @property {String} value The value of the change effect
 * @property {Number} mode The modification mode with which the change is applied
 * @property {Number} priority The priority level with which this change is applied
 * @remarks https://foundryvtt.com/api/interfaces/foundry.types.EffectChangeData.html
 */

/**
 * @typedef EffectDurationData
 * @property {String} combat The _id of the CombatEncounter in which the effect first started
 * @property {Number} rounds The maximum duration of the effect, in combat rounds
 * @property {Number} turns The maximum duration of the effect, in combat turns
 * @property {Number} startRound The round of the CombatEncounter in which the effect first started
 * @property {Number} startTurn The turn of the CombatEncounter in which the effect first started
 */

/**
 * @typedef {Object} ActiveEffectData
 * @property {string} _id The unique identifier of the active effect.
 * @property {string} name - The name of the which describes the name of the ActiveEffect
 * @property {string} img - An image path used to depict the ActiveEffect as an icon
 * @property {EffectChangeData[]} changes - The array of EffectChangeData objects which the ActiveEffect applies
 * @property {boolean} disabled - Whether the active effect is disabled.
 * @property {EffectDurationData} duration - The duration data of the active effect.
 * @property {string} description - The description of the active effect.
 * @property {string} origin - A UUID reference to the document from which this ActiveEffect originated
 * @property {string} tint - A color string which applies a tint to the ActiveEffect icon
 * @property {Boolean} transfer - Does this ActiveEffect automatically transfer from an Item to an Actor?
 * @property {Set<string>} statuses - Special status IDs that pertain to this effect
 * @property {Object} flags - An object of optional key/value flags
 * @remarks https://foundryvtt.com/api/interfaces/foundry.types.ActiveEffectData.html
 */

/**
 * @param {Actor|Item} owner The owning document which manages this effect
 * @param {String} effectType
 * @param {String} name
 * @returns {*}
 */
function createTemporaryEffect(owner, effectType, name) {
	return owner.createEmbeddedDocuments('ActiveEffect', [
		{
			label: name ?? game.i18n.localize('FU.NewEffect'),
			img: 'icons/svg/aura.svg',
			origin: owner.uuid,
			'duration.rounds': effectType === 'temporary' ? 1 : undefined,
			disabled: effectType === 'inactive',
		},
	]);
}

/**
 * Manage Active Effect instances through the Actor Sheet via effect control buttons.
 * @param {MouseEvent} event      The left-click event on the effect control
 * @param {Actor|Item} owner      The owning document which manages this effect
 */
export async function onManageActiveEffect(event, owner) {
	event.preventDefault();
	const anchor = event.currentTarget;
	const listItem = anchor.closest('li');

	/**
	 * @returns {FUActiveEffect}
	 */
	const resolveEffect = () => {
		const effectId = listItem.dataset.effectId;
		let effect;
		// We check allEffects in order to get effects from the ITEMS as well
		if (owner instanceof FUActor) {
			effect = Array.from(owner.allEffects()).find((value) => value.id === effectId);
		} else {
			effect = owner.effects.get(effectId);
		}
		return effect;
	};

	switch (anchor.dataset.action) {
		case 'create':
			return createTemporaryEffect(owner, listItem.dataset.effectType);
		case 'edit':
			return resolveEffect().sheet.render(true);
		case 'delete':
			return resolveEffect().delete();
		case 'toggle': {
			const effect = resolveEffect();
			return effect.update({ disabled: !effect.disabled });
		}
		case 'copy-inline': {
			await handleCopyInlineEffect(resolveEffect());
			break;
		}
		case 'roll': {
			return await handleRollEffect(resolveEffect(), owner);
		}
	}
}

/**
 * Prepare the data structure for Active Effects which are currently applied to an Actor or Item.
 * @param {ActiveEffect[]} effects    The array of Active Effect instances to prepare sheet data for
 * @return {object}                   Data for rendering
 */
export function prepareActiveEffectCategories(effects) {
	// Define effect header categories
	const categories = {
		temporary: {
			type: 'temporary',
			label: game.i18n.localize('FU.TemporaryEffects'),
			effects: [],
		},
		passive: {
			type: 'passive',
			label: game.i18n.localize('FU.PassiveEffects'),
			effects: [],
		},
		inactive: {
			type: 'inactive',
			label: game.i18n.localize('FU.InactiveEffects'),
			effects: [],
		},
	};

	// Iterate over active effects, classifying them into categories
	for (let e of effects) {
		if (e.disabled) categories.inactive.effects.push(e);
		else if (e.isTemporary) categories.temporary.effects.push(e);
		else categories.passive.effects.push(e);
	}
	return categories;
}

/**
 * A helper function to toggle a status effect on an Actor.
 * Designed based off TokenDocument#toggleActiveEffect to properly interact with token hud.
 * @param {FUActor} actor the actor the status should get applied to
 * @param {string} statusEffectId The status effect id based on CONFIG.statusEffects
 * @param {string} [source] the UUID of the document that caused the effect
 * @returns {Promise<boolean>} Whether the ActiveEffect is now on or off
 */
export async function toggleStatusEffect(actor, statusEffectId, source = undefined) {
	const existing = actor.effects.filter((effect) => isActiveEffectForStatusEffectId(effect, statusEffectId));
	if (existing.length > 0) {
		await Promise.all(
			existing.map((e) => {
				Hooks.call(
					FUHooks.STATUS_EVENT,
					/** @type StatusEvent **/
					{
						actor: actor,
						token: actor.resolveToken(),
						status: statusEffectId,
						enabled: false,
					},
				);
				return e.delete();
			}),
		);
		return false;
	} else {
		const statusEffect = CONFIG.statusEffects.find((e) => e.id === statusEffectId);
		if (statusEffect) {
			await ActiveEffect.create({ ...statusEffect, statuses: [statusEffectId], origin: source }, { parent: actor });
			Hooks.call(
				FUHooks.STATUS_EVENT,
				/** @type StatusEvent **/
				{
					actor: actor,
					token: actor.resolveToken(),
					status: statusEffectId,
					enabled: true,
				},
			);
		}
		return true;
	}
}

// Helper function to generate the @EFFECT format string
export function formatEffect(effect) {
	const encodedEffect = InlineHelper.toBase64(effect.toJSON());
	return `@EFFECT[${encodedEffect}]`;
}

/**
 * Generate encoded effect and copy to clipboard.
 * @param {ActiveEffect} effect - The ActiveEffect to encode and copy
 */
export async function handleCopyInlineEffect(effect) {
	try {
		const encodedEffect = formatEffect(effect);

		await navigator.clipboard.writeText(encodedEffect);

		if (ui && ui.notifications) {
			ui.notifications.info('Inline effect copied to clipboard.');
		}
	} catch (error) {
		console.error('Failed to copy effect to clipboard:', error);
	}
}

export function isActiveEffectForStatusEffectId(effect, statusEffectId) {
	return effect.statuses.size === 1 && effect.statuses.has(statusEffectId);
}

/**
 * Handle rolling the effect and creating a chat message.
 * @param {ActiveEffect} effect  The ActiveEffect to be rolled and encoded
 * @param {Actor|Item} owner     The owning document (actor or item)
 */
async function handleRollEffect(effect, owner) {
	if (!effect) {
		ui.notifications.error('Effect not found.');
		return;
	}

	const formattedEffect = formatEffect(effect);
	const description = effect.description ? effect.description : game.i18n.localize('FU.NoItem');

	const messageContent = `
		<div class="chat-effect-message">
			<header class="title-desc chat-header flexrow"><h2>${effect.name}</h2></header>
			<div class="chat-desc">
				${description}
				${formattedEffect ? `<div><hr>${formattedEffect}</div>` : ''}
			</div>
		</div>
	`;

	await ChatMessage.create({
		content: messageContent,
		speaker: ChatMessage.getSpeaker({ actor: owner }),
	});
}

function onRemoveEffectFromActor(actor, source, effect) {
	if (!actor) return;

	const existingEffect = actor.effects.find(
		(e) =>
			e.getFlag(SYSTEM, FUActiveEffect.TEMPORARY_FLAG) &&
			e.origin === source &&
			e.changes.length === effect.changes.length &&
			e.changes.every((change, index) => change.key === effect.changes[index].key && change.mode === effect.changes[index].mode && change.value === effect.changes[index].value),
	);

	if (existingEffect) {
		console.log(`Removing effect: ${existingEffect.name}`);
		existingEffect.delete();
	} else {
		console.log('No matching effect found to remove.');
	}
}

/**
 * @param {FUActor|FUItem} actor
 * @param {String} sourceUuid
 * @param {ActiveEffectData} effect
 */
async function onApplyEffectToActor(actor, sourceUuid, effect) {
	if (actor) {
		return await ActiveEffect.create(
			{
				...effect,
				origin: sourceUuid,
				flags: foundry.utils.mergeObject(effect.flags ?? {}, { [SYSTEM]: { [FUActiveEffect.TEMPORARY_FLAG]: true } }),
			},
			{ parent: actor },
		);
	}
}

/**
 * @description Manages active effects during a combat
 * @param {FUActor} actor
 * @param {CombatEvent} event
 * @returns {Promise<void>}
 */
async function manageEffectDuration(actor, event) {
	// TODO: Support later
	if (event.type !== '42') {
		return;
	}

	console.debug(`Managing effects for ${actor.name} on ${event.type}`);

	// TODO: Filter by the event
	const effects = actor.temporaryEffects.filter((e) => {
		// Tick down duration here?
		switch (event.type) {
			case FU.combatEvent.endOfTurn:
				break;
			case FU.combatEvent.endOfRound:
				break;
		}

		console.debug(`Will manage duration of ${e.name}: ${JSON.stringify(e.duration)}`);

		return true;
	});

	if (effects.length === 0) {
		return;
	}

	ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		flags: Pipeline.initializedFlags(Flags.ChatMessage.Effects, true),
		content: await renderTemplate('systems/projectfu/templates/chat/chat-manage-effects.hbs', {
			message: 'FU.ChatManageEffects',
			actor: actor.name,
			uuid: actor.uuid,
			effects: effects,
			round: event.round,
			event: event.type,
		}),
	});
}

/**
 * @param {CombatEvent} event
 * @returns {Promise<void>}
 */
async function promptEffectRemoval(event) {
	let count = 0;
	if (
		event.actors.every((actor) => {
			count += actor.temporaryEffects.length;
			return actor.temporaryEffects.length === 0;
		})
	) {
		return;
	}

	let message;
	switch (event.type) {
		case FU.combatEvent.startOfCombat:
			message = 'FU.ChatCombatStart';
			break;
		case FU.combatEvent.endOfCombat:
			message = 'FU.ChatCombatEnd';
			break;
	}

	const serializeddActors = Targeting.serializeTargetData(event.actors);
	ChatMessage.create({
		flags: Pipeline.initializedFlags(Flags.ChatMessage.Effects, true),
		content: await renderTemplate('systems/projectfu/templates/chat/chat-combat-end.hbs', {
			message: message,
			actors: JSON.stringify(serializeddActors),
			round: event.round,
			count: count,
		}),
	});
}

/**
 * @param {Document} message
 * @param {jQuery} jQuery
 */
function onRenderChatMessage(message, jQuery) {
	if (!message.getFlag(SYSTEM, Flags.ChatMessage.Effects)) {
		return;
	}

	Pipeline.handleClick(message, jQuery, 'removeEffect', (dataset) => {
		const effectId = dataset.id;
		const actorId = dataset.actorId;
		console.debug(`Removing effect ${effectId} on ${actorId}`);
		/** @type FUActor **/
		const actor = fromUuidSync(actorId);
		// TODO: Add revert-like behaviour
		const effect = actor.effects.get(effectId);
		if (effect) {
			effect.delete();
		}
	});

	Pipeline.handleClick(message, jQuery, 'clearEffects', (dataset) => {
		const actors = Targeting.deserializeTargetData(dataset.actors);
		actors.forEach((actor) => {
			actor.clearTemporaryEffects();
		});
	});
}

/**
 * @param {CombatEvent} event
 * @returns {Promise<void>}
 */
async function onCombatEvent(event) {
	switch (event.type) {
		case FU.combatEvent.startOfCombat:
		case FU.combatEvent.endOfCombat:
			await promptEffectRemoval(event);
			break;

		// TODO: Set up active effect data model with duration, in order to make use of these
		case FU.combatEvent.startOfTurn:
		case FU.combatEvent.endOfTurn:
			await manageEffectDuration(event.actor, event);
			break;

		case FU.combatEvent.endOfRound:
			{
				event.actors.forEach((actor) => {
					manageEffectDuration(actor, event);
				});
			}
			break;
	}
}

const BOONS_AND_BANES = Object.freeze(
	Object.fromEntries(['dex-up', 'ins-up', 'mig-up', 'wlp-up', 'dex-down', 'ins-down', 'mig-down', 'wlp-down', 'guard', 'cover', 'aura', 'barrier', 'flying', 'provoked'].map((value) => [value, FU.statusEffects[value]])),
);
const DAMAGE_TYPES = Object.freeze((({ untyped, ...rest }) => rest)(FU.damageTypes));
const STATUS_EFFECTS = Object.freeze({ ...FU.temporaryEffects });

/**
 * @description Initialize the pipeline's hooks
 */
function initialize() {
	Hooks.on(FUHooks.COMBAT_EVENT, onCombatEvent);
	Hooks.on('renderChatMessage', onRenderChatMessage);
}

/**
 * @description Contains key functions and properties for dealing with ActiveEffect documents in the system
 */
export const Effects = Object.freeze({
	initialize,
	onRemoveEffectFromActor,
	onApplyEffectToActor,
	BOONS_AND_BANES,
	DAMAGE_TYPES,
	STATUS_EFFECTS,
});
