import { CheckHooks } from './check-hooks.mjs';
import { CHECK_ROLL } from './default-section-order.mjs';
import { SYSTEM } from '../helpers/config.mjs';
import { CheckConfiguration } from './check-configuration.mjs';
import { Flags } from '../helpers/flags.mjs';
import { CommonSections } from './common-sections.mjs';

/**
 * @param {CheckV2} check
 * @param {FUActor} actor
 * @param {FUItem} [item]
 * @param {CheckCallbackRegistration} registerCallback
 */
const onPrepareCheck = (check, actor, item, registerCallback) => {
	const { type, modifiers } = check;
	if (type === 'magic') {
		CheckConfiguration.configure(check)
			.setTargetedDefense('mdef')
			.setTargets(
				[...game.user.targets]
					.filter((token) => !!token.actor)
					.map((token) => ({
						name: token.name,
						uuid: token.actor.uuid,
						link: token.actor.link,
						difficulty: token.actor.system.derived.mdef.value,
					})),
			);

		if (actor.system.bonuses.accuracy.magicCheck) {
			modifiers.push({
				label: 'FU.MagicCheckBonusGeneric',
				value: actor.system.bonuses.accuracy.magicCheck,
			});
		}
	}
};

/**
 * Hook called to process the result of the roll
 * @param {CheckResultV2} check
 * @param {FUActor} actor
 * @param {FUItem} [item]
 */
const onProcessCheck = (check, actor, item) => {
	const { type, result, critical, fumble, primary, secondary } = check;
	if (type === 'magic') {
		CheckConfiguration.configure(check)
			.modifyTargets((targets) =>
				(targets ?? []).map((target) => {
					let targetResult;
					if (critical) {
						targetResult = 'hit';
					} else if (fumble) {
						targetResult = 'miss';
					} else {
						targetResult = result >= target.difficulty ? 'hit' : 'miss';
					}
					target.result = targetResult;
					return target;
				}),
			)
			.modifyDamage((damage) => {
				if (damage) {
					damage.modifierTotal = damage.modifiers.reduce((agg, curr) => agg + curr.value, 0);
					if (CheckConfiguration.inspect(check).getHrZero()) {
						damage.total = damage.modifierTotal;
					} else {
						damage.total = Math.max(primary.result, secondary.result) + damage.modifierTotal;
					}
				}
				return damage;
			});
	}
};

/**
 * @param {CheckResultV2} checkResult
 * @param {CheckInspector} inspector
 * @param {CheckRenderData} data
 */
function renderCombatMagicCheck(checkResult, inspector, data, actor, item, flags) {
	const accuracyData = inspector.getAccuracyData();
	const damageData = inspector.getDamageData();

	// Push combined data for accuracy and damage
	data.push({
		order: CHECK_ROLL,
		partial: 'systems/projectfu/templates/chat/chat-check-container.hbs',
		data: {
			accuracy: accuracyData,
			damage: damageData,
		},
	});

	const targets = inspector.getTargets();
	CommonSections.damage(data, actor, item, targets, flags, accuracyData, damageData);
}

/**
 * @param {CheckResultV2} checkResult
 * @param {CheckInspector} inspector
 * @param {CheckRenderData} data
 */
function renderNonCombatMagicCheck(checkResult, inspector, data) {
	data.push({
		order: CHECK_ROLL,
		partial: 'systems/projectfu/templates/chat/partials/chat-default-check.hbs',
		data: {
			result: {
				attr1: checkResult.primary.result,
				attr2: checkResult.secondary.result,
				die1: checkResult.primary.dice,
				die2: checkResult.secondary.dice,
				modifier: checkResult.modifierTotal,
				total: checkResult.result,
				crit: checkResult.critical,
				fumble: checkResult.fumble,
			},
			check: {
				attr1: {
					attribute: checkResult.primary.attribute,
				},
				attr2: {
					attribute: checkResult.secondary.attribute,
				},
			},
			difficulty: inspector.getDifficulty(),
			modifiers: checkResult.modifiers,
		},
	});
}

/**
 * @param {CheckRenderData} data
 * @param {CheckResultV2} checkResult
 * @param {FUActor} actor
 * @param {FUItem} [item]
 * @param {Object} flags
 */
function onRenderCheck(data, checkResult, actor, item, flags) {
	if (checkResult.type === 'magic') {
		const inspector = CheckConfiguration.inspect(checkResult);

		if (inspector.getDifficulty()) {
			renderNonCombatMagicCheck(checkResult, inspector, data);
		} else {
			renderCombatMagicCheck(checkResult, inspector, data, actor, item, flags);
		}

		(flags[SYSTEM] ??= {})[Flags.ChatMessage.Item] ??= item.toObject();
	}
}

const initialize = () => {
	Hooks.on(CheckHooks.prepareCheck, onPrepareCheck);
	Hooks.on(CheckHooks.processCheck, onProcessCheck);
	Hooks.on(CheckHooks.renderCheck, onRenderCheck);
};

export const MagicCheck = Object.freeze({
	initialize,
	configure: CheckConfiguration.configure,
});
