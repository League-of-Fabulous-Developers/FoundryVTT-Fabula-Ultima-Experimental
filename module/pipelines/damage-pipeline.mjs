import { FUHooks } from '../hooks.mjs';
import { FU, SYSTEM } from '../helpers/config.mjs';
import { Pipeline, PipelineContext, PipelineRequest } from './pipeline.mjs';
import { Flags } from '../helpers/flags.mjs';
import { ChecksV2 } from '../checks/checks-v2.mjs';
import { CheckConfiguration } from '../checks/check-configuration.mjs';
import { DamageCustomizer } from './damage-customizer.mjs';
import { getSelected, getTargeted } from '../helpers/target-handler.mjs';
import { InlineSourceInfo } from '../helpers/inline-helper.mjs';
import { ApplyTargetHookData, BeforeApplyHookData } from './legacy-hook-data.mjs';
import { ResourcePipeline, ResourceRequest } from './resource-pipeline.mjs';
import { ChatMessageHelper } from '../helpers/chat-message-helper.mjs';
import { ExpressionContext, Expressions } from '../expressions/expressions.mjs';

/**
 * @typedef {"incomingDamage.all", "incomingDamage.air", "incomingDamage.bolt", "incomingDamage.dark", "incomingDamage.earth", "incomingDamage.fire", "incomingDamage.ice", "incomingDamage.light", "incomingDamage.poison"} DamagePipelineStepIncomingDamage
 */

/**
 * @typedef {"initial", "scaleIncomingDamage", "affinity", DamagePipelineStepIncomingDamage} DamagePipelineStep
 */

const PIPELINE_STEP_LOCALIZATION_KEYS = {
	initial: 'FU.DamagePipelineStepInitial',
	extra: 'FU.Extra',
	scaleIncomingDamage: 'FU.DamagePipelineStepScaleIncomingDamage',
	affinity: 'FU.DamagePipelineStepAffinity',
	incomingDamage: {
		all: 'FU.DamagePipelineStepIncomingDamageAll',
		physical: 'FU.DamagePipelineStepIncomingDamagePhysical',
		air: 'FU.DamagePipelineStepIncomingDamageAir',
		bolt: 'FU.DamagePipelineStepIncomingDamageBolt',
		dark: 'FU.DamagePipelineStepIncomingDamageDark',
		earth: 'FU.DamagePipelineStepIncomingDamageEarth',
		fire: 'FU.DamagePipelineStepIncomingDamageFire',
		ice: 'FU.DamagePipelineStepIncomingDamageIce',
		light: 'FU.DamagePipelineStepIncomingDamageLight',
		poison: 'FU.DamagePipelineStepIncomingDamagePoison',

		beast: `FU.Beast`,
		construct: 'FU.Construct',
		demon: 'FU.Demon',
		elemental: 'FU.Elemental',
		humanoid: 'FU.Humanoid',
		monster: 'FU.Monster',
		plant: 'FU.Plant',
		undead: 'FU.Undead',
	},
	// TODO: Better way to not duplicate?
	damage: {
		beast: `FU.Beast`,
		construct: 'FU.Construct',
		demon: 'FU.Demon',
		elemental: 'FU.Elemental',
		humanoid: 'FU.Humanoid',
		monster: 'FU.Monster',
		plant: 'FU.Plant',
		undead: 'FU.Undead',
	},
};

/**
 * @typedef ApplyTargetOverrides
 * @prop {number | null} affinity
 * @prop {number | null} total
 */

/**
 * @property {BaseDamageInfo} baseDamageInfo
 * @property {ExtraDamageInfo} extraDamageInfo
 * @property {FU.damageTypes} damageType
 * @property {ApplyTargetOverrides} overrides *
 * @extends PipelineRequest
 */
export class DamageRequest extends PipelineRequest {
	constructor(sourceInfo, targets, baseDamageInfo, extraDamageInfo = {}) {
		super(sourceInfo, targets);
		this.baseDamageInfo = baseDamageInfo;
		this.extraDamageInfo = extraDamageInfo;
		this.damageType = this.extraDamageInfo.damageType || this.baseDamageInfo.type;
		this.overrides = {};
	}

	/**
	 * @returns {FUActor[]}
	 */
	get allTargets() {
		return this.extraDamageInfo.targets || this.targets;
	}

	/**
	 * @returns {boolean} Whether the request is in a valid state
	 */
	validate() {
		if (!this.allTargets) {
			console.error(`No targets assigned to request`);
			return;
		}

		if (!Array.isArray(this.targets)) {
			console.error('Targets is not an array:', this.targets);
			return false;
		}

		return true;
	}
}

/**
 * @typedef DamageBreakdown
 * @property {String} step
 * @property {String} effect
 * @property {String} total
 */

// TODO: Decide whether to define in config.mjs. Though it's probably fine if they are all in english
const Traits = {
	IgnoreResistance: 'ignore-resistance',
	IgnoreImmunity: 'ignore-immunity',
};

/**
 * @property {Number} affinity The index of the affinity
 * @property {String} affinityMessage The localized affinity message to use
 * @property {FU.damageTypes} damageType
 * @property {String} extra An optional expression to evaluate for extra damage
 * @property {Number} amount The base amount before bonuses or modifiers are applied
 * @property {Map<String, Number>} bonuses Increments
 * @property {Map<String, Number>} modifiers Multipliers
 * @property {DamageBreakdown[]} breakdown
 * @extends PipelineContext
 */
export class DamagePipelineContext extends PipelineContext {
	constructor(request, actor) {
		super(request, actor);
		this.bonuses = new Map();
		this.modifiers = new Map();
		this.breakdown = [];
		this.extra = request.baseDamageInfo.extra;
		this.calculateAmount();
	}

	calculateAmount() {
		this.amount = this.extraDamageInfo.hrZero
			? this.extraDamageInfo.damageBonus + this.baseDamageInfo.modifierTotal + (this.extraDamageInfo.extraDamage || 0)
			: this.baseDamageInfo.total + (this.extraDamageInfo.damageBonus || 0) + (this.extraDamageInfo.extraDamage || 0);
	}

	addBonus(key, value) {
		if (value !== 0) {
			this.bonuses.set(key, value);
			return true;
		}
		return false;
	}

	addModifier(key, value) {
		if (value !== 1) {
			this.modifiers.set(key, value);
			return true;
		}
		return false;
	}

	/**
	 * @param {DamagePipelineStep} step
	 * @param {String} effect
	 * @param {Number} total
	 */
	recordStep(step, effect, total) {
		this.breakdown.push({
			step: this.#localizeStep(step),
			effect: effect,
			total: total,
		});
	}

	#localizeStep(step) {
		return foundry.utils.getProperty(PIPELINE_STEP_LOCALIZATION_KEYS, step) ?? step;
	}
}

// TODO: Provide variant option to modify resistance/vulnerability scaling
/**
 * @type {Record<Number, Number>}
 * @description Index : Multiplier
 */
const affinityDamageModifier = {
	[FU.affValue.vulnerability]: 2,
	[FU.affValue.none]: 1,
	[FU.affValue.resistance]: 0.5,
	[FU.affValue.immunity]: 0,
	[FU.affValue.absorption]: -1,
};

/**
 * @param {DamagePipelineContext} context
 * @return {Boolean}
 */
function resolveAffinity(context) {
	// Default to no affinity
	let affinity = FU.affValue.none;
	let affinityMessage = 'FU.ChatApplyDamageNormal';

	if (context.overrides?.affinity) {
		affinity = context.overrides.affinity;
	} else if (context.damageType in context.actor.system.affinities) {
		affinity = context.actor.system.affinities[context.damageType].current;
	}

	// Check if affinity should be ignored
	if (affinity === FU.affValue.vulnerability) {
		affinityMessage = 'FU.ChatApplyDamageVulnerable';
		if (context.extraDamageInfo.ignoreVulnerable) {
			affinity = FU.affValue.none;
		}
	}
	if (affinity === FU.affValue.resistance) {
		if (context.extraDamageInfo.ignoreResistance || context.traits.has(Traits.IgnoreResistance)) {
			affinity = FU.affValue.none;
			affinityMessage = 'FU.ChatApplyDamageResistantIgnored';
		} else {
			affinityMessage = `FU.ChatApplyDamageResistant`;
		}
	}
	if (affinity === FU.affValue.immunity) {
		if (context.extraDamageInfo.ignoreImmunities || context.traits.has(Traits.IgnoreImmunity)) {
			affinity = FU.affValue.none;
			affinityMessage = `FU.ChatApplyDamageImmuneIgnored`;
		} else {
			affinityMessage = `FU.ChatApplyDamageImmune`;
		}
	}
	if (affinity === FU.affValue.absorption) {
		if (context.extraDamageInfo.ignoreAbsorption) {
			affinity = FU.affValue.none;
		} else {
			affinityMessage = 'FU.ChatApplyDamageAbsorb';
		}
	}

	context.affinityMessage = affinityMessage;
	context.affinity = affinity;
	return true;
}

/**
 * @param {DamagePipelineContext} context
 * @return {Boolean} True if the result was overridden
 */
function overrideResult(context) {
	if (context.overrides?.total) {
		context.result = context.overrides.total;
		return true;
	}
	return false;
}

/**
 * @param {DamagePipelineContext} context
 * @return {Promise<Boolean>}
 */
async function collectIncrements(context) {
	// Target
	if (context.actor.system.bonuses) {
		const incoming = context.actor.system.bonuses.incomingDamage;

		context.addBonus(`incomingDamage.all`, incoming.all);
		context.addBonus(`incomingDamage.${context.damageType}`, incoming[context.damageType] ?? 0);

		// Potentially modify damage FROM a specific species (NPC)
		if (context.sourceActor.system.species) {
			const species = context.sourceActor.system.species.value;
			context.addBonus(`incomingDamage.${species}`, incoming[species] ?? 0);
		}

		// Potentially modify damage TO a specific species (from a PC)
		if (context.actor.system.species) {
			const species = context.actor.system.species.value;
			const outgoing = context.sourceActor.system.bonuses.damage;
			context.addBonus(`damage.${species}`, outgoing[species] ?? 0);
		}
	}

	// Expression
	if (context.extra) {
		const exprCtx = new ExpressionContext(context.sourceActor, context.item, [context.actor]);
		const bonusValue = await Expressions.evaluateAsync(context.extra, exprCtx);
		if (bonusValue > 0) {
			context.addBonus(`extra`, bonusValue);
		}
	}
}

/**
 * @param {DamagePipelineContext} context
 * @return {Boolean}
 * @remarks These flags can be set on an active effect with the key: `flags.projectfu.<SKILL>`, change mode: `Override`, effect value: `true`.
 */
function collectMultipliers(context) {
	const target = context.actor;

	// Custom Modifiers
	const scaleIncomingDamage = target.getFlag(Flags.Scope, Flags.Modifier.ScaleIncomingDamage);
	if (scaleIncomingDamage) {
		context.addModifier('scaleIncomingDamage', scaleIncomingDamage);
	}

	context.addModifier('affinity', affinityDamageModifier[context.affinity]);
}

/**
 * @description
 * @param {DamagePipelineContext} context
 * @return {Boolean}
 */
function calculateResult(context) {
	// We invoke the hook here since the increment order doesn't matter; multipliers shouldn't matter outside of affinity going last.
	Hooks.call(FUHooks.DAMAGE_PIPELINE_PRE_CALCULATE, context);

	let result = context.amount;

	/** @type DamageBreakdown[] */
	context.recordStep('initial', '', context.amount);

	// Increments (+-)
	for (const [key, value] of context.bonuses) {
		result += value;
		context.recordStep(key, value > 0 ? `+${value}` : value, result);
	}
	// Multipliers (*)
	for (const [key, value] of context.modifiers) {
		result *= value;
		context.recordStep(key, `*${value}`, result);
	}

	context.result = Math.floor(result);
	Hooks.call(FUHooks.DAMAGE_PIPELINE_POST_CALCULATE, context);
	return true;
}

/**
 * @param {DamageRequest} request
 * @return {Promise<Awaited<unknown>[]>}
 */
async function process(request) {
	if (!request.validate()) {
		return Promise.reject('Request was not valid');
	}

	// TODO: Remove once users have migrated from legacy hooks
	const beforeApplyHookData = new BeforeApplyHookData(request);
	Hooks.call(FUHooks.DAMAGE_APPLY_BEFORE, beforeApplyHookData);
	request.baseDamageInfo = beforeApplyHookData.baseDamageInfo;
	request.extraDamageInfo = beforeApplyHookData.extraDamageInfo;

	const updates = [];
	for (const actor of request.targets) {
		// Create an initial context then run the pipeline
		let context = new DamagePipelineContext(request, actor);

		resolveAffinity(context);
		if (!overrideResult(context)) {
			await collectIncrements(context);
			collectMultipliers(context);
			calculateResult(context);
		}
		if (context.result === undefined) {
			throw new Error('Failed to generate result during pipeline');
		}

		// TODO: Remove once users have migrated from legacy hooks
		const applyTargetHookData = new ApplyTargetHookData(request, actor, context.result);
		Hooks.call(FUHooks.DAMAGE_APPLY_TARGET, applyTargetHookData);
		context.result = applyTargetHookData.total;

		// Damage application
		const damageTaken = -context.result;
		updates.push(actor.modifyTokenAttribute('resources.hp', damageTaken, true));
		actor.showFloatyText(`${damageTaken} HP`, `red`);

		// Dispatch event
		/** @type DamageEvent  **/
		const damageEvent = {
			amount: context.result,
			type: request.damageType,
			actor: actor,
			token: actor.resolveToken(),
			sourceActor: context.sourceActor,
			sourceToken: context.sourceActor ? context.sourceActor.resolveToken() : null,
			traits: context.traits,
		};
		Hooks.call(FUHooks.DAMAGE_EVENT, damageEvent);

		// Chat message
		const affinityString = await renderTemplate('systems/projectfu/templates/chat/partials/inline-damage-icon.hbs', {
			damage: context.result,
			damageType: game.i18n.localize(FU.damageTypes[request.damageType]),
			affinityIcon: FU.affIcon[context.damageType],
		});

		let flags = Pipeline.initializedFlags(Flags.ChatMessage.Damage, context.result);
		Pipeline.setFlag(flags, Flags.ChatMessage.Source, context.sourceInfo);

		updates.push(
			ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor }),
				flavor: game.i18n.localize(FU.affType[context.affinity]),
				flags: flags,
				content: await renderTemplate('systems/projectfu/templates/chat/chat-apply-damage.hbs', {
					message: context.affinityMessage,
					actor: actor.name,
					uuid: actor.uuid,
					damage: context.result,
					type: affinityString,
					from: request.sourceInfo.name,
					sourceActorUuid: request.sourceInfo.actorUuid,
					sourceItemUuid: request.sourceInfo.itemUuid,
					breakdown: context.breakdown,
				}),
			}),
		);
	}
	return Promise.all(updates);
}

function getSourceInfoFromChatMessage(message) {
	const sourceActorUuid = message.getFlag(SYSTEM, Flags.ChatMessage.CheckV2)?.actorUuid;
	const sourceItemUuid = message.getFlag(SYSTEM, Flags.ChatMessage.CheckV2)?.itemUuid;
	const sourceName = message.getFlag(SYSTEM, Flags.ChatMessage.Item)?.name;
	return new InlineSourceInfo(sourceName, sourceActorUuid, sourceItemUuid);
}

// TODO: Move elsewhere
/**
 * @param {Document} message
 * @param {jQuery} jQuery
 */
function onRenderChatMessage(message, jQuery) {
	let disabled = false;

	/** @type BaseDamageInfo **/
	let baseDamageInfo;
	/** @type InlineSourceInfo **/
	let sourceInfo = null;
	let traits = [];

	if (ChecksV2.isCheck(message)) {
		const inspector = CheckConfiguration.inspect(message);
		const damage = inspector.getDamage();
		traits = inspector.getTraits();

		if (damage) {
			sourceInfo = getSourceInfoFromChatMessage(message);
			baseDamageInfo = damage;
		}
	}

	const customizeDamage = async (event, targets) => {
		DamageCustomizer(
			baseDamageInfo,
			targets,
			async (extraDamageInfo) => {
				await handleDamageApplication(event, targets, sourceInfo, baseDamageInfo, extraDamageInfo, traits);
				disabled = false;
			},
			() => {
				disabled = false;
			},
		);
	};

	const applyDefaultDamage = async (event, targets) => {
		return handleDamageApplication(event, targets, sourceInfo, baseDamageInfo, {}, traits);
	};

	const handleClick = async (event, getTargetsFunction, action, alternateAction) => {
		event.preventDefault();
		if (!disabled) {
			disabled = true;
			const targets = await getTargetsFunction(event);
			if (event.ctrlKey || event.metaKey) {
				await alternateAction(event, targets);
				disabled = false;
			} else {
				await action(event, targets);
				disabled = false;
			}
		}
	};

	jQuery.find(`a[data-action=applyDamage]`).click((event) => handleClick(event, Pipeline.getSingleTarget, applyDefaultDamage, customizeDamage));
	jQuery.find(`a[data-action=applyDamageSelected]`).click((event) => handleClick(event, getSelected, applyDefaultDamage, customizeDamage));

	jQuery.find(`a[data-action=selectDamageCustomizer]`).click(async (event) => {
		if (!disabled) {
			disabled = true;
			const targets = await getTargeted();
			DamageCustomizer(
				baseDamageInfo,
				targets,
				(extraDamageInfo) => {
					handleDamageApplication(event, targets, sourceInfo, baseDamageInfo, extraDamageInfo, traits);
					disabled = false;
				},
				() => {
					disabled = false;
				},
			);
		}
	});

	Pipeline.handleClickRevert(message, jQuery, 'revertDamage', async (dataset) => {
		const uuid = dataset.uuid;
		const actor = fromUuidSync(uuid);
		const updates = [];
		const amountRecovered = dataset.amount;
		updates.push(actor.modifyTokenAttribute('resources.hp', amountRecovered, true));
		actor.showFloatyText(`${amountRecovered} HP`, `lightgreen`);
		return Promise.all(updates);
	});

	jQuery.find(`a[data-action=toggleBreakdown]`).click(function (event) {
		event.preventDefault();
		jQuery.find('#breakdown').toggleClass('hidden');
	});
}

/**
 *
 * @param {Event} event
 * @param {FUActor[]} targets
 * @param {InlineSourceInfo} sourceInfo
 * @param {import('../helpers/typedefs.mjs').BaseDamageInfo} baseDamageInfo
 * @param {import('./damage-customizer.mjs').ExtraDamageInfo} extraDamageInfo
 * @param {String[]} traits
 * @returns {void}
 */
async function handleDamageApplication(event, targets, sourceInfo, baseDamageInfo, extraDamageInfo, traits) {
	const request = new DamageRequest(sourceInfo, targets, baseDamageInfo, extraDamageInfo);
	request.event = event;
	traits.forEach((t) => request.traits.add(t));
	if (event.shiftKey) {
		request.traits.add(Traits.IgnoreResistance);
		if (event.ctrlKey || event.metaKey) {
			request.traits.add(Traits.IgnoreImmunity);
		}
	}
	await DamagePipeline.process(request);
}

/**
 * @description Initialize the pipeline's hooks
 */
function initialize() {
	Hooks.on('renderChatMessage', onRenderChatMessage);

	const absorbDamage = async (message, resource) => {
		const amount = message.getFlag(SYSTEM, Flags.ChatMessage.Damage) * 0.5;
		const sourceInfo = message.getFlag(SYSTEM, Flags.ChatMessage.Source);
		const targets = await getSelected();
		const request = new ResourceRequest(sourceInfo, targets, resource, amount, false);
		ResourcePipeline.processRecovery(request);
	};

	ChatMessageHelper.registerContextMenuItem(Flags.ChatMessage.Damage, `FU.ChatAbsorbMindPoints`, FU.resourceIcons.mp, (message) => {
		absorbDamage(message, 'mp');
	});
	ChatMessageHelper.registerContextMenuItem(Flags.ChatMessage.Damage, `FU.ChatAbsorbHitPoints`, FU.resourceIcons.hp, (message) => {
		absorbDamage(message, 'hp');
	});
}

export const DamagePipeline = {
	initialize,
	process,
};
