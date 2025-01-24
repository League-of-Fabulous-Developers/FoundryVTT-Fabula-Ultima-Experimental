import { CheckHooks } from './check-hooks.mjs';
import { CHECK_ROLL } from './default-section-order.mjs';
import { SYSTEM } from '../helpers/config.mjs';
import { CheckConfiguration } from './check-configuration.mjs';
import { Flags } from '../helpers/flags.mjs';
import { CommonSections } from './common-sections.mjs';

function handleGenericBonus(actor, modifiers) {
	if (actor.system.bonuses.accuracy.accuracyCheck) {
		modifiers.push({
			label: 'FU.AccuracyCheckBonusGeneric',
			value: actor.system.bonuses.accuracy.accuracyCheck,
		});
	}
}

/**
 * @param {CheckV2} check
 * @param {FUActor} actor
 * @param {FUItem} [item]
 * @param {CheckCallbackRegistration} registerCallback
 */
const onPrepareCheck = (check, actor, item, registerCallback) => {
	const { type, modifiers } = check;
	if (type === 'accuracy') {
		CheckConfiguration.configure(check).setTargets(
			[...game.user.targets]
				.filter((token) => !!token.actor)
				.map((token) => ({
					name: token.name,
					uuid: token.actor.uuid,
					link: token.actor.link,
				})),
		);
		handleGenericBonus(actor, modifiers);
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
	if (type === 'accuracy') {
		const configurer = CheckConfiguration.configure(check);
		configurer.modifyTargetedDefense((value) => value ?? 'def');
		configurer.modifyTargets((targets) => {
			if (targets?.length) {
				const targetedDefense = CheckConfiguration.inspect(check).getTargetedDefense();
				for (const target of targets) {
					target.difficulty = fromUuidSync(target.uuid).system.derived[targetedDefense].value;
					let targetResult;
					if (critical) {
						targetResult = 'hit';
					} else if (fumble) {
						targetResult = 'miss';
					} else {
						targetResult = result >= target.difficulty ? 'hit' : 'miss';
					}
					target.result = targetResult;
				}
			}
			return targets;
		});
		configurer.modifyDamage((damage) => {
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
 * @param {CheckRenderData} data
 * @param {CheckResultV2} checkResult
 * @param {FUActor} actor
 * @param {FUItem} [item]
 * @param {Object} flags
 */
function onRenderCheck(data, checkResult, actor, item, flags) {
	if (checkResult.type === 'accuracy') {
		const inspector = CheckConfiguration.inspect(checkResult);

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

		/** @type TargetData[] */
		const targets = inspector.getTargets();
		CommonSections.damage(data, actor, item, targets, flags, accuracyData, damageData);

		(flags[SYSTEM] ??= {})[Flags.ChatMessage.Item] ??= item.toObject();
	}
}

const initialize = () => {
	Hooks.on(CheckHooks.prepareCheck, onPrepareCheck);
	Hooks.on(CheckHooks.processCheck, onProcessCheck);
	Hooks.on(CheckHooks.renderCheck, onRenderCheck);
};

export const AccuracyCheck = Object.freeze({
	initialize,
	configure: CheckConfiguration.configure,
	inspect: CheckConfiguration.inspect,
});
