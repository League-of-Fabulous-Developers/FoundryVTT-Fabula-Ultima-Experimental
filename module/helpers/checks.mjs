import { getTargeted } from './target-handler.mjs';
import { StudyRollHandler } from './study-roll.mjs';

/**
 * @typedef {"dex","ins","mig","wpl"} Attribute
 */
/**
 * @typedef CheckAttribute
 * @property {Attribute} attribute
 * @property {number} dice
 */
/**
 * @typedef CheckData
 * @property {CheckAttribute} attr1
 * @property {CheckAttribute} attr2
 * @property {number} modifier
 * @property {number} bonus
 * @property {string} [title]
 */

/**
 * @typedef CheckResult
 * @property {number} attr1
 * @property {number} attr2
 * @property {number} modifier
 * @property {number} bonus
 * @property {number} [push]
 * @property {number} total
 * @property {boolean} fumble
 * @property {boolean} crit
 * @property {Roll} roll
 */

/**
 * @typedef CheckReroll
 * @property {"identity" | "theme" | "origin" | "trait"} trait
 * @property {string} value
 * @property {"attr1" | "attr2" | ("attr1"| "attr2")[] } selection
 */

/**
 * @typedef CheckPush
 * @property {string} name
 * @property {("Admiration"|"Inferiority"|"Loyalty"|"Mistrust"|"Affection"|"Hatred")[]} feelings
 * @property {number} strength
 */

/**
 * @typedef CheckDetails
 * @extends CheckWeapon
 * @extends CheckSpell
 * @extends CheckBasic
 * @extends CheckAbility
 */

/**
 * @typedef CheckWeapon
 * @property {"weapon"} _type
 * @property {string} name
 * @property {string} img
 * @property {string} id
 * @property {WeaponCategory} category
 * @property {Handedness} hands
 * @property {string} quality
 * @property {WeaponType} type
 * @property {Defense} defense
 * @property {string} summary
 * @property {string} description
 */

/**
 * @typedef CheckSpell
 * @property {"spell"} _type
 * @property {string} name
 * @property {string} img
 * @property {string} id
 * @property {string} mpCost
 * @property {string} target
 * @property {string} duration
 * @property {"mdef"} defense
 * @property {string} opportunity
 * @property {string} summary
 * @property {string} description
 */

/**
 * @typedef CheckBasic
 * @property {"basic"} _type
 * @property {string} name
 * @property {string} img
 * @property {string} id
 * @property {string} quality
 * @property {WeaponType} type
 * @property {Defense} defense
 * @property {string} summary
 * @property {string} description
 */

/**
 * @typedef AbilityWeapon
 * @property {string} name
 * @property {string} slot
 */

/**
 * @typedef CheckAbility
 * @property {"ability"} _type
 * @property {string} name
 * @property {string} img
 * @property {string} id
 * @property {Defense} defense
 * @property {string} quality
 * @property {string} summary
 * @property {string} description
 * @property {AbilityWeapon} [weapon]
 */

/**
 * @typedef CheckDamage
 * @property {boolean} hrZero
 * @property {number} bonus
 * @property {DamageType} type
 * @property {number} [total]
 */

/**
 * @typedef CheckTarget
 * @property {string} target
 * @property {string} link
 * @property {number} difficulty
 * @property {"hit", "miss"} [result]
 */

/**
 * @typedef CheckParameters
 * @property {CheckData} check
 * @property {CheckDetails} details
 * @property {CheckResult} [result]
 * @property {CheckReroll} [reroll]
 * @property {ChatSpeakerData} [speaker]
 * @property {CheckPush} [push]
 * @property {boolean} [offensive] implied true if damage is set
 * @property {CheckDamage} [damage]
 * @property {number} [difficulty]
 * @property {CheckTarget[]} [targets]
 */

import { FU, SYSTEM } from './config.mjs';
import { SETTINGS } from '../settings.js';
import { FUActor } from '../documents/actors/actor.mjs';
import { Flags } from './flags.mjs';
import { ChecksV2 } from '../checks/checks-v2.mjs';
import { CheckHooks } from '../checks/check-hooks.mjs';
import { CheckConfiguration } from '../checks/check-configuration.mjs';

/**
 *
 * @param {number} modifier
 * @param {string} name
 * @return {string}
 */
function getOptionalPart(modifier, name) {
	if (modifier) {
		const signum = modifier < 0 ? '-' : '+';
		const namePart = name ? `[${name}]` : '';
		return ` ${signum} ${Math.abs(modifier)}${namePart}`;
	} else {
		return '';
	}
}

/**
 * @param {CheckParameters} check
 * @returns {Promise<void>}
 */
async function handleRoll(check) {
	const { attr1: attribute1, attr2: attribute2, modifier, bonus } = check.check;
	const modPart = getOptionalPart(modifier, 'mod');
	const bonusPart = getOptionalPart(bonus, 'bonus');
	const formula = `d${attribute1.dice}[${attribute1.attribute}] + d${attribute2.dice}[${attribute2.attribute}]${modPart}${bonusPart}`;
	/** @type Roll */
	const roll = await new Roll(formula).roll();

	/** @type number */
	const roll1 = roll.dice[0].total;
	/** @type number */
	const roll2 = roll.dice[1].total;
	/** @type number */
	const roll1Die = roll.dice[0].faces;
	/** @type number */
	const roll2Die = roll.dice[1].faces;

	console.log(roll.dice[0]);
	check.result = {
		attr1: roll1,
		attr2: roll2,
		die1: roll1Die,
		die2: roll2Die,
		modifier: modifier,
		bonus: bonus,
		total: roll.total,
		fumble: roll1 === 1 && roll2 === 1,
		crit: roll1 === roll2 && roll1 >= 6 && roll2 >= 6,
		roll: roll,
	};
}

/**
 * @param {CheckParameters} check
 */
function handleDamage(check) {
	if (check.damage) {
		const { bonus, hrZero } = check.damage;
		const { attr1, attr2 } = check.result;

		const damageRoll = hrZero ? 0 : Math.max(attr1, attr2);

		const total = damageRoll + bonus;

		check.damage = {
			...check.damage,
			total,
		};
	}
}

/**
 * @param {CheckParameters} params
 * @returns {Promise<CheckParameters>}
 */
export async function rollCheck(params) {
	/** @type CheckParameters */
	const check = { ...params, offensive: params.offensive || !!params.damage };

	await handleRoll(check);
	handleDamage(check);
	handleTargets(check);

	return check;
}

/**
 * @param {CheckParameters} check
 */
function handleTargets(check) {
	async function showFloatyText(target) {
		const actor = await fromUuid(target.uuid);
		if (actor instanceof FUActor) {
			actor.showFloatyText(game.i18n.localize(target.result === 'hit' ? 'FU.Hit' : 'FU.Miss'));
		}
	}

	for (const target of check.targets ?? []) {
		let result;
		if (check.result.crit) {
			result = 'hit';
		} else if (check.result.fumble) {
			result = 'miss';
		} else {
			result = check.result.total >= target.difficulty ? 'hit' : 'miss';
		}
		target.result = result;
		showFloatyText(target);
	}
}

/**
 * @param {Defense} targetedDefense
 * @return {CheckTarget[]}
 */
export function getTargets(targetedDefense) {
	return [...game.user.targets]
		.filter((token) => !!token.actor)
		.map((token) => ({
			name: token.actor.name,
			uuid: token.actor.uuid,
			link: token.actor.link,
			difficulty: token.actor.system.derived[targetedDefense].value,
		}));
}

/**
 * @param {CheckParameters} check
 * @returns {Promise<void>}
 */
async function handleReroll(check) {
	const { attr1: attribute1, attr2: attribute2, modifier, bonus } = check.check;
	const selection = check.reroll.selection;

	let { attr1: attr1Result, attr2: attr2Result } = check.result;

	const modPart = getOptionalPart(modifier, 'mod');
	const bonusPart = getOptionalPart(bonus, 'bonus');
	let attribute1Part;
	const rerollAttr1 = selection === 'attr1' || (Array.isArray(selection) && selection.includes('attr1'));
	if (rerollAttr1) {
		attribute1Part = `d${attribute1.dice}[${attribute1.attribute}]`;
	} else {
		attribute1Part = `${attr1Result}[${attribute1.attribute}]`;
	}

	let attribute2Part;
	const rerollAttr2 = selection === 'attr2' || (Array.isArray(selection) && selection.includes('attr2'));
	if (rerollAttr2) {
		attribute2Part = `d${attribute2.dice}[${attribute2.attribute}]`;
	} else {
		attribute2Part = `${attr2Result}[${attribute2.attribute}]`;
	}

	let pushPart = '';
	if (check.push) {
		const { strength, with: bond } = check.push;
		pushPart = getOptionalPart(strength, bond);
	}

	const formula = `${attribute1Part} + ${attribute2Part}${modPart}${bonusPart}${pushPart}`;
	/** @type Roll */
	const roll = await new Roll(formula).roll();

	if (rerollAttr1 && rerollAttr2) {
		attr1Result = roll.dice[0].total;
		attr2Result = roll.dice[1].total;
	} else if (rerollAttr1) {
		attr1Result = roll.dice[0].total;
	} else if (rerollAttr2) {
		attr2Result = roll.dice[0].total;
	}

	/** @type CheckResult */
	check.result = {
		attr1: attr1Result,
		attr2: attr2Result,
		modifier: modifier,
		bonus: bonus,
		push: check.result.push,
		total: roll.total,
		fumble: attr1Result === 1 && attr2Result === 1,
		crit: attr1Result === attr2Result && attr1Result >= 6 && attr2Result >= 6,
		roll: roll,
	};
}

/**
 * @param {CheckParameters} params
 * @param {CheckReroll} reroll
 * @returns {Promise<CheckParameters|false>}
 */
export async function rerollCheck(params, reroll) {
	if (!(await ChatMessage.getSpeakerActor(params.speaker)?.spendMetaCurrency(true))) {
		return false;
	}

	/** @type CheckParameters */
	const check = { ...params };

	check.reroll = reroll;
	await handleReroll(check);
	handleDamage(check);
	handleTargets(check);

	return check;
}

/**
 * Retargets the check with updated targets.
 *
 * @param {CheckParameters} params - The original check parameters.
 * @returns {Promise<CheckParameters>} - The updated check parameters with new targets.
 */
export async function retargetCheck(params) {
	// Create a copy of the original check parameters
	const check = { ...params };

	// Fetch newly targeted tokens
	const targets = await getTargeted();

	// Update targets in the check object
	check.targets = targets;

	// Further refine targets based on defense details
	check.targets = getTargets(check.details.defense);

	// Handle damage and targets updates
	handleDamage(check);
	handleTargets(check);

	return check;
}

/**
 * @param {jQuery} html
 * @param {ContextMenuEntry[]} options
 */
export function addRollContextMenuEntries(html, options) {
	// Retarget Tokens
	options.unshift({
		name: 'FU.ChatContextRetarget',
		icon: '<i class="fas fa-bullseye"></i>',
		group: SYSTEM,
		condition: (li) => {
			const messageId = li.data('messageId');
			/** @type ChatMessage | undefined */
			const message = game.messages.get(messageId);
			const flag = message?.getFlag(SYSTEM, Flags.ChatMessage.CheckParams);
			const speakerActor = ChatMessage.getSpeakerActor(message?.speaker);
			return message && message.isRoll && flag && speakerActor?.type === 'character' && !flag.result?.fumble;
		},
		callback: async (li) => {
			const messageId = li.data('messageId');
			/** @type ChatMessage | undefined */
			const message = game.messages.get(messageId);
			if (message) {
				const checkParams = message.getFlag(SYSTEM, Flags.ChatMessage.CheckParams);
				if (checkParams) {
					// Delete the existing message
					await message.delete();

					// Retarget and create a new message
					const flags = foundry.utils.duplicate(message.flags);
					delete flags[SYSTEM][Flags.ChatMessage.CheckParams];
					const newMessage = await retargetCheck(checkParams);
					await createCheckMessage(newMessage, flags);
				}
			}
		},
	});

	// Character reroll
	options.unshift({
		name: 'FU.ChatContextRerollFabula',
		icon: '<i class="fas fa-dice"></i>',
		group: SYSTEM,
		condition: (li) => {
			const messageId = li.data('messageId');
			/** @type ChatMessage | undefined */
			const message = game.messages.get(messageId);
			const flag = message?.getFlag(SYSTEM, Flags.ChatMessage.CheckParams);
			const speakerActor = ChatMessage.getSpeakerActor(message?.speaker);
			return message && message.isRoll && flag && speakerActor?.type === 'character' && !flag.result?.fumble;
		},
		callback: async (li) => {
			const messageId = li.data('messageId');
			/** @type ChatMessage | undefined */
			const message = game.messages.get(messageId);
			if (message) {
				const checkParams = message.getFlag(SYSTEM, Flags.ChatMessage.CheckParams);
				const rerollParams = await getRerollParams(checkParams, ChatMessage.getSpeakerActor(message.speaker));
				if (rerollParams) {
					const flags = foundry.utils.duplicate(message.flags);
					delete flags[SYSTEM][Flags.ChatMessage.CheckParams];
					const newMessage = await rerollCheck(checkParams, rerollParams);
					if (newMessage) {
						await createCheckMessage(newMessage, flags);
					}
				}
			}
		},
	});

	// Character push
	options.unshift({
		name: 'FU.ChatContextPush',
		icon: '<i class="fas fa-arrow-up-right-dots"></i>',
		group: SYSTEM,
		condition: (li) => {
			const messageId = li.data('messageId');
			/** @type ChatMessage | undefined */
			const message = game.messages.get(messageId);
			const flag = message?.getFlag(SYSTEM, Flags.ChatMessage.CheckParams);
			const speakerActor = ChatMessage.getSpeakerActor(message?.speaker);
			return message && message.isRoll && flag && speakerActor?.type === 'character' && !flag.push && !flag.result?.fumble;
		},
		callback: async (li) => {
			const messageId = li.data('messageId');
			/** @type ChatMessage | undefined */
			const message = game.messages.get(messageId);
			if (message) {
				const checkParams = message.getFlag(SYSTEM, Flags.ChatMessage.CheckParams);
				const pushParams = await getPushParams(ChatMessage.getSpeakerActor(message.speaker));
				if (pushParams) {
					const flags = foundry.utils.duplicate(message.flags);
					delete flags[SYSTEM][Flags.ChatMessage.CheckParams];
					const newMessage = await pushCheck(checkParams, pushParams);
					if (newMessage) {
						await createCheckMessage(newMessage, flags);
					}
				}
			}
		},
	});

	// Villain reroll
	options.unshift({
		name: 'FU.ChatContextRerollUltima',
		icon: '<i class="fas fa-dice"></i>',
		group: SYSTEM,
		condition: (li) => {
			const messageId = li.data('messageId');
			/** @type ChatMessage | undefined */
			const message = game.messages.get(messageId);
			const flag = message?.getFlag(SYSTEM, Flags.ChatMessage.CheckParams);
			const speakerActor = ChatMessage.getSpeakerActor(message?.speaker);
			return message && message.isRoll && flag && speakerActor?.type === 'npc' && speakerActor.system.villain.value && !flag.result?.fumble;
		},
		callback: async (li) => {
			const messageId = li.data('messageId');
			/** @type ChatMessage | undefined */
			const message = game.messages.get(messageId);
			if (message) {
				const checkParams = message.getFlag(SYSTEM, Flags.ChatMessage.CheckParams);
				const rerollParams = await getRerollParams(checkParams, ChatMessage.getSpeakerActor(message.speaker));
				if (rerollParams) {
					const flags = foundry.utils.duplicate(message.flags);
					delete flags[SYSTEM][Flags.ChatMessage.CheckParams];
					const newMessage = await rerollCheck(checkParams, rerollParams);
					if (newMessage) {
						await createCheckMessage(newMessage, flags);
					}
				}
			}
		},
	});
}

/**
 * @param {CheckParameters} check
 * @returns {Promise<void>}
 */
async function handlePush(check) {
	const { result: oldResult, push } = check;

	const {
		attr1: { attribute: attribute1 },
		attr2: { attribute: attribute2 },
		modifier,
		bonus,
	} = check.check;
	const { attr1: attr1Roll, attr2: attr2Roll } = oldResult;
	const attr1Part = `${attr1Roll}[${attribute1}]`;
	const attr2Part = `${attr2Roll}[${attribute2}]`;
	const modPart = getOptionalPart(modifier, 'mod');
	const bonusPart = getOptionalPart(bonus, 'bonus');
	const pushPart = getOptionalPart(push.strength, push.name);
	const roll = await new Roll(`${attr1Part} + ${attr2Part}${modPart}${bonusPart}${pushPart}`).roll();

	/** @type CheckResult */
	check.result = {
		...oldResult,
		push: push.strength,
		total: roll.total,
		roll: roll,
	};
}

/**
 *
 * @param {CheckParameters} params
 * @param {CheckPush} push
 * @returns {Promise<CheckParameters|false>}
 */
async function pushCheck(params, push) {
	if (!(await ChatMessage.getSpeakerActor(params.speaker)?.spendMetaCurrency(true))) {
		return false;
	}

	/** @type CheckParameters */
	const check = { ...params };
	check.push = push;

	await handlePush(check);
	handleTargets(check);

	return check;
}

/**
 *
 * @param {FUActor} actor
 * @returns {Promise<CheckPush | undefined>}
 */
async function getPushParams(actor) {
	/** @type CheckPush[] */
	const bonds = actor.system.bonds.map((value) => {
		const feelings = [];
		value.admInf.length && feelings.push(value.admInf);
		value.loyMis.length && feelings.push(value.loyMis);
		value.affHat.length && feelings.push(value.affHat);

		return {
			with: value.name,
			feelings: feelings,
			strength: value.strength,
		};
	});

	/** @type CheckPush */
	const push = await Dialog.prompt({
		title: game.i18n.localize('FU.DialogPushTitle'),
		label: game.i18n.localize('FU.DialogPushLabel'),
		content: await renderTemplate('systems/projectfu/templates/dialog/dialog-check-push.hbs', { bonds }),
		options: { classes: ['projectfu', 'unique-dialog', 'dialog-reroll', 'backgroundstyle'] },
		/** @type {(jQuery) => CheckPush} */
		callback: (html) => {
			const index = +html.find('input[name=bond]:checked').val();
			return bonds[index];
		},
	});

	if (!push) {
		ui.notifications.error('FU.DialogPushMissingBond', { localize: true });
		return;
	}

	return push;
}

/**
 *
 * @param {CheckParameters} params
 * @param {Actor} actor
 * @returns {Promise<CheckReroll | undefined>}
 */
async function getRerollParams(params, actor) {
	const traits = [];
	if (actor.type === 'character') {
		const {
			identity: { name: identity },
			theme: { name: theme },
			origin: { name: origin },
		} = actor.system.resources;
		traits.push({ type: 'identity', value: identity });
		traits.push({ type: 'theme', value: theme });
		traits.push({ type: 'origin', value: origin });
	}
	if (actor.type === 'npc') {
		actor.system.traits.value
			.split(',')
			.map((trait) => ({
				type: 'trait',
				value: trait,
			}))
			.forEach((trait) => traits.push(trait));
	}

	const attr1 = {
		...params.check.attr1,
		result: params.result.attr1,
	};

	const attr2 = {
		...params.check.attr2,
		result: params.result.attr2,
	};

	/** @type CheckReroll */
	const reroll = await Dialog.prompt({
		title: game.i18n.localize('FU.DialogRerollTitle'),
		label: game.i18n.localize('FU.DialogRerollLabel'),
		content: await renderTemplate('systems/projectfu/templates/dialog/dialog-check-reroll.hbs', {
			traits,
			attr1,
			attr2,
		}),
		options: { classes: ['projectfu', 'unique-dialog', 'dialog-reroll', 'backgroundstyle'] },
		/** @type {(jQuery) => CheckReroll} */
		callback: (html) => {
			const trait = html.find('input[name=trait]:checked');

			const selection = html
				.find('input[name=results]:checked')
				.map((_, el) => el.value)
				.get();

			return {
				trait: trait.val(),
				value: trait.data('value'),
				selection: selection,
			};
		},
	});

	if (!reroll.trait) {
		ui.notifications.error('FU.DialogRerollMissingTrait', { localize: true });
		return;
	}

	if (!reroll.selection || !reroll.selection.length) {
		ui.notifications.error('FU.DialogRerollMissingDice', { localize: true });
		return;
	}

	return reroll;
}

/**
 * Enrich HTML content.
 * @param {string} htmlContent - The HTML content to enrich.
 * @returns {string} - The enriched content.
 */
async function EnrichHTML(htmlContent) {
	return TextEditor.enrichHTML(htmlContent);
}

/**
 * Create a chat message with enriched content.
 * @param {CheckParameters} checkParams
 * @param {Object} [additionalFlags]
 * @return {Promise<ChatMessage>}
 */
export async function createChatMessage(checkParams, additionalFlags = {}) {
	const content = checkParams.description
		? await renderTemplate('systems/projectfu/templates/chat/chat-description.hbs', {
				flavor: checkParams.details?.name || '',
				description: await EnrichHTML(checkParams.description),
			})
		: '';

	/** @type Partial<ChatMessageData> */
	const chatMessage = {
		content: content,
		type: foundry.utils.isNewerVersion(game.version, '12.0.0') ? undefined : CONST.CHAT_MESSAGE_TYPES.ROLL,
		rolls: foundry.utils.isNewerVersion(game.version, '12.0.0') ? [] : undefined,
		speaker: checkParams.speaker,
		flags: foundry.utils.mergeObject(
			{
				[SYSTEM]: {
					[Flags.ChatMessage.CheckParams]: checkParams,
				},
			},
			additionalFlags,
		),
	};

	return ChatMessage.create(chatMessage);
}

/**
 * Create a check message.
 * @param {CheckParameters} checkParams
 * @param {Object} [additionalFlags]
 * @return {Promise<ChatMessage>}
 */
export async function createCheckMessage(checkParams, additionalFlags = {}) {
	const flavor = await (async () => {
		if (checkParams.details) {
			return renderTemplate('systems/projectfu/templates/chat/chat-check-flavor-item.hbs', {
				name: checkParams.details.name,
				img: checkParams.details.img,
			});
		} else {
			return renderTemplate('systems/projectfu/templates/chat/chat-check-flavor-check.hbs', {
				title: checkParams.check.title || 'FU.RollCheck',
			});
		}
	})();

	/** @type Partial<ChatMessageData> */
	const chatMessage = {
		flavor: flavor,
		content: await renderTemplate('systems/projectfu/templates/chat/chat-check.hbs', {
			...checkParams,
			translation: { damageTypes: FU.damageTypes, damageIcon: FU.affIcon },
		}),
		rolls: [checkParams.result.roll],
		type: foundry.utils.isNewerVersion(game.version, '12.0.0') ? undefined : CONST.CHAT_MESSAGE_TYPES.ROLL,
		speaker: checkParams.speaker,
		flags: foundry.utils.mergeObject(
			{
				[SYSTEM]: {
					[Flags.ChatMessage.CheckParams]: checkParams,
				},
			},
			additionalFlags,
		),
	};

	return ChatMessage.create(chatMessage);
}

const KEY_RECENT_CHECKS = 'fabulaultima.recentChecks';

/**
 * @param {FUActor} actor
 * @param {string} title
 * @param {String} action
 * @returns {Promise<ChatMessage|Object>}
 */
export async function promptCheck(actor, title, action) {
	const recentChecks = JSON.parse(sessionStorage.getItem(KEY_RECENT_CHECKS) || '{}');
	let check = recentChecks[actor.uuid] || (recentChecks[actor.uuid] = {});
	try {
		const attributes = actor.system.attributes;
		if (action === 'study') {
			check.primary = 'ins';
			check.secondardy = 'ins';
		}
		if (action === 'open') {
			check.difficulty = 0;
			check.modifier = actor.system.bonuses.accuracy.opposedCheck;
		}

		check = await ChecksV2.promptConfiguration(actor, check, title);
		// Legacy compatibility
		check.attr1 = check.primary;
		check.attr2 = check.secondary;

		sessionStorage.setItem(KEY_RECENT_CHECKS, JSON.stringify(recentChecks));

		if (game.settings.get(SYSTEM, SETTINGS.checksV2)) {
			if (check.modifier) {
				// Beware of shadowing!
				Hooks.once(CheckHooks.prepareCheck, (_check) =>
					_check.modifiers.push({
						value: check.modifier,
						label: 'FU.CheckSituationalModifier',
					}),
				);
			}

			let hasRenderCheckHookRegistered = false;

			// Register the renderCheck hook
			if (!hasRenderCheckHookRegistered) {
				Hooks.once('projectfu.renderCheck', (sections, check, actor, item) => {
					const description = game.i18n.localize(FU.actionRule[action]);
					if (description) {
						sections.push(
							TextEditor.enrichHTML(`<div class="chat-desc"><p>${description}</p></div>`).then((v) => ({
								content: v,
								order: -1050,
							})),
						);
					}
				});

				hasRenderCheckHookRegistered = true;
			}

			return ChecksV2.attributeCheck(actor, { primary: check.attr1, secondary: check.attr2 }, CheckConfiguration.initDifficulty(check.difficulty));
		}
		const speaker = ChatMessage.implementation.getSpeaker({ actor });

		/**
		 * @type CheckParameters
		 */
		let params = {
			check: {
				attr1: {
					attribute: check.attr1,
					dice: attributes[check.attr1].current,
				},
				attr2: {
					attribute: check.attr2,
					dice: attributes[check.attr2].current,
				},
				modifier: check.modifier,
				title: title || 'FU.RollCheck',
			},
			difficulty: check.difficulty,
			speaker: speaker,
		};
		const rolledCheck = await rollCheck(params);

		const rollResult = rolledCheck.result.total;
		return { rollResult, message: await createCheckMessage(rolledCheck) };
	} catch (e) {
		console.log(e);
		return { rollResult: 0, message: null };
	}
}

/**
 * @param {FUActor} actor
 * @param {string} title
 * @returns {Promise<ChatMessage|Object>}
 */
export async function promptOpenCheck(actor, title, action) {
	const recentChecks = JSON.parse(sessionStorage.getItem(KEY_RECENT_CHECKS) || '{}');
	const recentActorChecks = recentChecks[actor.uuid] || (recentChecks[actor.uuid] = {});
	try {
		const attributes = actor.system.attributes;
		const bonus = actor.system.bonuses.accuracy.openCheck;

		const titleMain = title || 'FU.DialogCheckOpenCheck';

		if (action === 'study') {
			recentActorChecks.attr1 = 'ins';
			recentActorChecks.attr2 = 'ins';
		}

		const { attr1, attr2, modifier } = await Dialog.wait(
			{
				title: game.i18n.localize(titleMain),
				content: await renderTemplate('systems/projectfu/templates/dialog/dialog-opencheck.hbs', {
					attributes: FU.attributes,
					attributeAbbr: FU.attributeAbbreviations,
					attributeValues: Object.entries(attributes).reduce(
						(previousValue, [attribute, { current }]) => ({
							...previousValue,
							[attribute]: current,
						}),
						{},
					),
					attr1: recentActorChecks.attr1 || 'mig',
					attr2: recentActorChecks.attr2 || 'mig',
					modifier: recentActorChecks.modifier || 0,
					bonus: bonus,
				}),
				buttons: [
					{
						icon: '<i class="fas fa-dice"></i>',
						label: game.i18n.localize('FU.DialogCheckRoll'),
						callback: (jQuery) => {
							return {
								attr1: jQuery.find('*[name=attr1]:checked').val(),
								attr2: jQuery.find('*[name=attr2]:checked').val(),
								modifier: +jQuery.find('*[name=modifier]').val(),
							};
						},
					},
				],
			},
			{
				classes: ['projectfu', 'unique-dialog', 'backgroundstyle'],
			},
		);

		recentActorChecks.attr1 = attr1;
		recentActorChecks.attr2 = attr2;
		recentActorChecks.modifier = modifier;
		sessionStorage.setItem(KEY_RECENT_CHECKS, JSON.stringify(recentChecks));

		if (game.settings.get(SYSTEM, SETTINGS.checksV2)) {
			if (modifier) {
				Hooks.once(CheckHooks.prepareCheck, (check) =>
					check.modifiers.push({
						value: modifier,
						label: 'FU.CheckSituationalModifier',
					}),
				);
			}

			// Handle the result of the check
			const handleResults = async (checkResult) => {
				if (action === 'study') {
					try {
						const studyRollHandler = new StudyRollHandler(actor, checkResult.result);
						await studyRollHandler.handleStudyRoll();
						return { rollResult: checkResult.result, message: null };
					} catch (error) {
						console.error('Error processing study roll:', error);
						return { rollResult: 0, message: null };
					}
				}
				return { rollResult: checkResult.result, message: null };
			};

			// Register the result handler
			Hooks.once('projectfu.processCheck', handleResults);

			let hasRenderCheckHookRegistered = false;

			// Register the renderCheck hook
			if (!hasRenderCheckHookRegistered) {
				Hooks.once('projectfu.renderCheck', (sections, check, actor, item) => {
					const description = game.i18n.localize(FU.actionRule[action]);
					if (description) {
						sections.push(
							TextEditor.enrichHTML(`<div class="chat-desc"><p>${description}</p></div>`).then((v) => ({
								content: v,
								order: -1050,
							})),
						);
					}
				});

				hasRenderCheckHookRegistered = true;
			}

			return ChecksV2.openCheck(actor, { primary: attr1, secondary: attr2 });
		}
		const speaker = ChatMessage.implementation.getSpeaker({ actor });

		/**
		 * @type CheckParameters
		 */
		let params = {
			check: {
				attr1: {
					attribute: attr1,
					dice: attributes[attr1].current,
				},
				attr2: {
					attribute: attr2,
					dice: attributes[attr2].current,
				},
				modifier: modifier + bonus,
				title: title || 'FU.DialogCheckOpenCheck',
			},
			speaker: speaker,
		};
		const rolledCheck = await rollCheck(params);

		const rollResult = rolledCheck.result.total;
		return { rollResult, message: await createCheckMessage(rolledCheck) };
	} catch (e) {
		console.log(e);
		return { rollResult: 0, message: null };
	}
}
