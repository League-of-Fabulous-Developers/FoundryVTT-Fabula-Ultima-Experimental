/**
 * @typedef ClickModifiers
 * @prop {boolean} alt
 * @prop {boolean} ctrl
 * @prop {boolean} shift
 */

import { SYSTEM } from '../helpers/config.mjs';
import { Flags } from '../helpers/flags.mjs';

/**
 * @property {InlineSourceInfo} sourceInfo
 * @property {FUActor[]} targets
 * @property {Set<String>} traits
 * @property {Event | null} event
 */
export class PipelineRequest {
	constructor(sourceInfo, targets) {
		this.sourceInfo = sourceInfo;
		this.targets = targets;
		this.traits = new Set();
	}
}

/**
 * @property {InlineSourceInfo} sourceInfo
 * @property {FUActor} sourceActor The actor whose action triggered the pipeline
 * @property {FUActor} actor The actor the pipeline is modifying
 * @property {Set<String>} traits
 * @property {Event | null} event
 * @property {?} result The result output
 */
export class PipelineContext {
	constructor(request, actor) {
		Object.assign(this, request);
		this.actor = actor;
		this.sourceActor = request.sourceInfo.resolveActor();
	}
}

/**
 * @callback PipelineStep
 * @param {PipelineContext} context
 * @returns {Boolean} False if the no further calls in the pipeline are needed
 * @remarks Only to be used synchronously
 */

/**
 * @param {PipelineRequest} request
 * @param {Function} getUpdatesForActor
 * @returns {Promise<Awaited<unknown>[]>}
 */
async function process(request, getUpdatesForActor) {
	const updates = [];
	for (const actor of request.targets) {
		updates.push(getUpdatesForActor(actor));
	}
	return Promise.all(updates);
}

/**
 * @param {Event} event
 * @returns {FUActor[]}
 */
function getSingleTarget(event) {
	const dataId = $(event.target).closest('a').data('id');
	const actor = fromUuidSync(dataId);
	if (!actor) {
		ui.notifications.warn('FU.ChatApplyEffectNoActorsTargeted', { localize: true });
		return [];
	}
	return [actor];
}

/**
 * @param {Event} event
 * @param {Object} dataset
 * @param {Function<FUActor[]>} getTargetsFunction
 * @param {Function<Event, Object, FUActor[], Promise>} defaultAction
 * @param {Function<Event, Object, FUActor[], Promise>} alternateAction
 */
async function handleClick(event, dataset, getTargetsFunction, defaultAction, alternateAction = null) {
	event.preventDefault();
	const targets = getTargetsFunction ? await getTargetsFunction(event) : [];
	if (event.ctrlKey || event.metaKey) {
		if (alternateAction) {
			await alternateAction(event, dataset, targets);
		}
	} else {
		await defaultAction(event, dataset, targets);
	}
}

/**
 * @param {ChatMessage} message
 * @param {jQuery} jQuery
 * @param {String} actionName The name of the data-action in the html, e.g: `a[data-action=...]`
 * @param {Function<Object, Promise>} action
 * @returns {Promise<*>}
 */
async function handleClickRevert(message, jQuery, actionName, action) {
	const revert = jQuery.find(`a[data-action=${actionName}]`);
	if (revert) {
		if (message.getFlag(SYSTEM, Flags.ChatMessage.RevertedAction)?.includes(actionName)) {
			jQuery.find('.message-content').addClass('strikethrough');
			revert.addClass('action-disabled');
		} else {
			revert.click(async (event) => {
				event.preventDefault();
				await action(revert.data());
				const revertedActions = message.getFlag(SYSTEM, Flags.ChatMessage.RevertedAction) ?? [];
				revertedActions.push(actionName);
				message.setFlag(SYSTEM, Flags.ChatMessage.RevertedAction, revertedActions);
			});
		}
	}
}

/**
 * @param {Map} flags
 * @param {String} key
 * @remarks Documented in {@link Flags}
 */
function toggleFlag(flags, key) {
	(flags[SYSTEM] ??= {})[key] ??= true;
}

/**
 * @param {Map} flags
 * @param {String} key
 * @param {*} value
 * @returns {Map}
 * @remarks Documented in {@link Flags}
 */
function setFlag(flags, key, value) {
	(flags[SYSTEM] ??= {})[key] ??= value;
	return flags;
}

/**
 * @description Constructs an initialized flags object to be assigned in a ChatMessage
 * @param {String} key
 * @param {*} value
 * @returns {Object}
 * @remarks Documented in {@link Flags}
 */
function initializedFlags(key, value) {
	return { [SYSTEM]: { [key]: value } };
}

export const Pipeline = {
	getSingleTarget,
	process,
	handleClick,
	handleClickRevert,
	toggleFlag,
	setFlag,
	initializedFlags,
};
