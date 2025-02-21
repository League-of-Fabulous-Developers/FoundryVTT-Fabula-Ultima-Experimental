import { Pipeline, PipelineRequest } from './pipeline.mjs';
import { FU, SYSTEM } from '../helpers/config.mjs';
import { InlineSourceInfo } from '../helpers/inline-helper.mjs';
import { Flags } from '../helpers/flags.mjs';
import { Targeting } from '../helpers/targeting.mjs';
import { FUHooks } from '../hooks.mjs';

/**
 * @property {Number} amount
 * @property {String} resourceType
 * @property {Boolean} uncapped
 * @extends PipelineRequest
 * @inheritDoc
 */
export class ResourceRequest extends PipelineRequest {
	constructor(sourceInfo, targets, resourceType, amount, uncapped = false) {
		super(sourceInfo, targets);
		this.resourceType = resourceType;
		this.amount = amount;
		this.uncapped = uncapped;
	}

	/**
	 * @returns {boolean} True if the resource is FP, EXP or ZENIT
	 */
	get isMetaCurrency() {
		return this.resourceType === 'fp' || this.resourceType === 'exp' || this.resourceType === 'zenit';
	}

	/**
	 * @returns {string} The key to the resource within the actor's data model
	 */
	get attributeKey() {
		return `resources.${this.resourceType}`;
	}

	/**
	 * @returns {string} The full path to the accessor for resource in an actor's data model
	 */
	get attributePath() {
		return `resources.${this.resourceType}.value`;
	}

	get resourceLabel() {
		return game.i18n.localize(FU.resources[this.resourceType]);
	}
}

const recoveryFlavor = {
	hp: 'FU.HealthPointRecovery',
	mp: 'FU.MindPointRecovery',
	ip: 'FU.InventoryPointRecovery',
	fp: 'FU.TextEditorButtonCommandGain',
	exp: 'FU.TextEditorButtonCommandGain',
	zenit: 'FU.TextEditorButtonCommandGain',
};

const recoveryMessages = {
	hp: 'FU.HealthPointRecoveryMessage',
	mp: 'FU.MindPointRecoveryMessage',
	ip: 'FU.InventoryPointRecoveryMessage',
	fp: 'FU.ChatResourceGain',
	exp: 'FU.ChatResourceGain',
	zenit: 'FU.ChatResourceGain',
};

/**
 * @param {FUActor} actor
 * @param {String} resourcePath
 * @returns {number|number}
 */
function getResourceValue(actor, resourcePath) {
	return parseInt(foundry.utils.getProperty(actor.system, resourcePath), 10) || 0;
}

/**
 * @param {FUActor} actor
 * @param {String} attributePath
 * @param {Number} amountRecovered
 * @returns {Promise<*>
 */
function createUpdateForRecovery(actor, attributePath, amountRecovered) {
	const currentValue = getResourceValue(actor, attributePath);
	const newValue = Math.floor(currentValue + amountRecovered);

	// Update the actor's resource directly
	const updateData = {
		[`system.${attributePath}`]: newValue,
	};
	return actor.update(updateData);
}

/**
 * @param {ResourceRequest} request
 * @return {Promise<Awaited<unknown>[]>}
 */
async function processRecovery(request) {
	const flavor = game.i18n.localize(recoveryFlavor[request.resourceType]);

	const updates = [];
	for (const actor of request.targets) {
		const recoveryBonus = actor.system.bonuses.incomingRecovery[request.resourceType] || 0;
		const amountRecovered = Math.max(0, Math.floor(request.amount + recoveryBonus));
		const attr = foundry.utils.getProperty(actor.system, request.attributeKey);
		const uncappedRecoveryValue = amountRecovered + attr.value;
		const updates = [];

		if (request.isMetaCurrency) {
			updates.push(createUpdateForRecovery(actor, request.attributePath, amountRecovered));
		} else {
			// Overheal recovery (uncapped)
			if (request.uncapped === true && uncappedRecoveryValue > (attr.max || 0)) {
				// Clone attribute
				const newValue = Object.defineProperties({}, Object.getOwnPropertyDescriptors(attr));
				newValue.value = uncappedRecoveryValue;
				updates.push(actor.modifyTokenAttribute(request.attributeKey, newValue, false, false));
			}
			// Normal recovery
			else {
				updates.push(actor.modifyTokenAttribute(request.attributeKey, amountRecovered, true));
			}
		}

		// Dispatch event
		/** @type GainEvent  **/
		const gainEvent = {
			amount: amountRecovered,
			resource: request.resourceType,
			actor: actor,
			token: actor.resolveToken(),
		};
		Hooks.call(FUHooks.GAIN_EVENT, gainEvent);

		actor.showFloatyText(`${amountRecovered} ${request.resourceType.toUpperCase()}`, `lightgreen`);
		updates.push(
			ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor }),
				flavor: flavor,
				flags: Pipeline.initializedFlags(Flags.ChatMessage.ResourceGain, true),
				content: await renderTemplate('systems/projectfu/templates/chat/chat-apply-recovery.hbs', {
					message: recoveryMessages[request.resourceType],
					actor: actor.name,
					uuid: actor.uuid,
					amount: amountRecovered,
					key: request.attributeKey,
					resource: request.resourceType,
					resourceLabel: request.resourceLabel,
					from: request.sourceInfo.name,
				}),
			}),
		);
	}
	return Promise.all(updates);
}

const lossFlavor = {
	hp: 'FU.HealthPointLoss',
	mp: 'FU.MindPointLoss',
	ip: 'FU.InventoryPointLoss',
	fp: 'FU.TextEditorButtonCommandLoss',
	exp: 'FU.TextEditorButtonCommandLoss',
	zenit: 'FU.TextEditorButtonCommandLoss',
};

/**
 * @param {ResourceRequest} request
 * @return {Promise<Awaited<unknown>[]>}
 */
async function processLoss(request) {
	const amountLost = -Math.floor(request.amount);
	const flavor = game.i18n.localize(lossFlavor[request.resourceType]);

	const updates = [];
	for (const actor of request.targets) {
		if (request.isMetaCurrency) {
			const currentValue = foundry.utils.getProperty(actor.system, request.attributePath) || 0;
			const newValue = currentValue + amountLost;
			// Update the actor's resource directly
			const updateData = {};
			updateData[`system.${request.attributePath}`] = newValue;
			updates.push(actor.update(updateData));
		} else {
			updates.push(actor.modifyTokenAttribute(request.attributeKey, amountLost, true));
		}

		// Dispatch event
		/** @type LossEvent  **/
		const lossEvent = {
			amount: amountLost,
			resource: request.resourceType,
			actor: actor,
			token: actor.resolveToken(),
		};
		Hooks.call(FUHooks.LOSS_EVENT, lossEvent);

		actor.showFloatyText(`${amountLost} ${request.resourceType.toUpperCase()}`, `lightyellow`);
		updates.push(
			ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor }),
				flavor: flavor,
				flags: Pipeline.initializedFlags(Flags.ChatMessage.ResourceLoss, true),
				content: await renderTemplate('systems/projectfu/templates/chat/chat-apply-loss.hbs', {
					message: 'FU.ChatResourceLoss',
					actor: actor.name,
					amount: Math.abs(amountLost),
					uuid: actor.uuid,
					key: request.attributeKey,
					resource: request.resourceType,
					resourceLabel: request.resourceLabel,
					from: request.sourceInfo.name,
				}),
			}),
		);
	}
	return Promise.all(updates);
}

/**
 * @typedef ResourceExpense
 * @property {String} resource
 * @property {Number} amount
 */

/**
 * @param {FUItem} item
 * @param {TargetData[]} targets
 * @return {ResourceExpense}
 */
function calculateExpense(item, targets) {
	let amount = item.system.cost.amount;
	let resource = item.system.cost.resource;
	const targeting = item.system.targeting;

	if (targeting.rule === Targeting.rule.multiple && targeting.max > 1) {
		if (targets.length === 0) {
			console.warn(`Wrong number of targets given (${targets.length}) for calculating resource expense. Using default of 1.`);
		} else {
			amount = amount * targets.length;
		}
	}

	return {
		resource: resource,
		amount: amount,
	};
}

/**
 * @param {Document} message
 * @param {jQuery} jQuery
 */
function onRenderChatMessage(message, jQuery) {
	if (!message.getFlag(SYSTEM, Flags.ChatMessage.ResourceLoss) && !message.getFlag(SYSTEM, Flags.ChatMessage.ResourceGain)) {
		return;
	}

	/**
	 * @param dataset
	 * @param {FUActor[]} targets
	 * @returns {Promise<Awaited<*>[]>}
	 */
	const applyResourceLoss = async (dataset) => {
		const sourceInfo = new InlineSourceInfo(dataset.name, dataset.actor, dataset.item);
		const actor = sourceInfo.resolveActor();
		const request = new ResourceRequest(sourceInfo, [actor], dataset.resource, dataset.amount);
		return ResourcePipeline.processLoss(request);
	};
	Pipeline.handleClick(message, jQuery, 'applyResourceLoss', applyResourceLoss);

	Pipeline.handleClickRevert(message, jQuery, 'revertResourceLoss', async (dataset) => {
		const actor = fromUuidSync(dataset.uuid);
		const amount = dataset.amount;
		const attributeKey = dataset.key;
		const updates = [];
		updates.push(actor.modifyTokenAttribute(attributeKey, amount, true));
		actor.showFloatyText(`${amount} ${dataset.resource.toUpperCase()}`, `lightgreen`);
		return Promise.all(updates);
	});

	Pipeline.handleClickRevert(message, jQuery, 'revertResourceGain', async (dataset) => {
		const actor = fromUuidSync(dataset.uuid);
		const amount = dataset.amount;
		const attributeKey = dataset.key;
		const updates = [];
		updates.push(actor.modifyTokenAttribute(attributeKey, -amount, true));
		actor.showFloatyText(`${amount} ${FU.resourcesAbbr[dataset.resource]}`, `red`);
		return Promise.all(updates);
	});
}

export const ResourcePipeline = {
	processRecovery,
	processLoss,
	onRenderChatMessage,
	calculateExpense,
};
