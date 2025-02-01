import { ImprovisedEffect } from '../helpers/improvised-effect.mjs';
import { MathHelper } from '../helpers/math-helper.mjs';
import { FUActor } from '../documents/actors/actor.mjs';
import { FUItem } from '../documents/items/item.mjs';

/**
 * @description Contains contextual objects used for evaluating expressions
 * @property {FUActor} actor The source of the action
 * @property {FUItem} item
 * @property {FUActor[]} targets
 * @remarks Do not serialize this class, as it references full objects. Instead, store their uuids
 * and resolve them with the static constructor
 */
export class ExpressionContext {
	constructor(actor, item, targets) {
		this.actor = actor;
		this.item = item;
		this.targets = targets;
	}

	/**
	 * @description Resolves the context based on the target type
	 * @param {FUActor|FUItem} target
	 */
	static resolveTarget(target) {
		if (target instanceof FUActor) {
			return new ExpressionContext(target, null, []);
		} else if (target instanceof FUItem) {
			return new ExpressionContext(null, target, []);
		}
	}

	/**
	 * @param {String} actorUuid
	 * @param {String} itemUuid
	 * @param {FUActor[]} targets
	 * @returns {ExpressionContext}
	 */
	static fromUuid(actorUuid, itemUuid, targets) {
		let actor = undefined;
		if (actorUuid !== undefined) {
			actor = fromUuidSync(actorUuid);
		}

		let item = undefined;
		if (itemUuid !== undefined) {
			item = fromUuidSync(itemUuid);
		}
		return new ExpressionContext(actor, item, targets);
	}

	/**
	 * @param {String} match
	 */
	assertActor(match) {
		if (this.actor == null) {
			ui.notifications.warn('FU.ChatEvaluateAmountNoActor', { localize: true });
			throw new Error(`No reference to an actor provided while evaluating expression "${match}"`);
		}
	}

	/**
	 * @param {String} match
	 */
	assertItem(match) {
		if (this.item == null) {
			ui.notifications.warn('FU.ChatEvaluateAmountNoItem', { localize: true });
			throw new Error(`No reference to an item provided while evaluating expression "${match}"`);
		}
	}

	/**
	 * @description Resolves the actor or the target with the highest level
	 * @returns {FUActor}
	 */
	resolveActorOrHighestLevelTarget() {
		if (this.actor) {
			return this.actor;
		} else {
			if (this.targets.length > 0) {
				return this.targets.reduce((prev, current) => {
					return prev.system.level.value > current.system.level.value ? prev : current;
				});
			}
		}

		ui.notifications.warn('FU.ChatEvaluateAmountNoActor', { localize: true });
		throw new Error(`No reference to an actor or targets provided while evaluating expression"`);
	}
}

// DSL supported by the inline amount expression
const referenceSymbol = '@';
const actorLabel = `actor`;
const itemLabel = `item`;

/**
 * @param expression The raw text of the amount
 * @returns {boolean} True if the expression requires a context to be evaluated
 */
function requiresContext(expression) {
	return !Number.isInteger(Number(expression));
}

// TODO: Provide a system of hooks
// Order of operations matters
const evaluationFunctions = [evaluateVariables, evaluateEffects, evaluateReferencedFunctions, evaluateReferencedProperties, evaluateMacros];

/**
 * @description Evaluates the given expression using the supported DSL
 * @param {String} expression
 * @param {ExpressionContext} context
 * @return {Number} The evaluated amount
 * @example (@actor.level.value*2+minor+@item.level.value)
 * @example @actor.byLevel(40,50,60)
 * @example (minor + 5)
 */
function evaluate(expression, context) {
	if (!requiresContext(expression)) {
		return Number(expression);
	}

	// Evaluate the expression's variables
	let substitutedExpression = expression;
	evaluationFunctions.forEach((evaluateFunction) => {
		substitutedExpression = evaluateFunction(substitutedExpression, context);
	});

	// Now that the expression's variables have been substituted, evaluate it arithmetically
	const result = MathHelper.evaluate(substitutedExpression);

	if (Number.isNaN(result)) {
		throw new Error(`Failed to evaluate expression ${substitutedExpression}`);
	}

	console.debug(`Evaluated expression ${expression} = ${substitutedExpression} = ${result}`);
	return result;
}

/**
 * @description Evaluates functions within the expression using the available context
 * @param {String}  expression
 * @param {ExpressionContext} context
 * @returns {String}
 */
function evaluateReferencedFunctions(expression, context) {
	const pattern = /@(?<label>[a-zA-Z]+)\.(?<path>(\w+\.?)+)\((?<args>.*?)\)/gm;

	function evaluate(match, label, path, p3, args, groups) {
		if (match.includes(actorLabel)) {
			context.assertActor(match);
			let splitArgs = args.split(',');

			const functionPath = `system.${path}`;
			const resolvedFunction = getFunctionFromPath(context.actor, functionPath);
			if (resolvedFunction === undefined) {
				throw new Error(`No function in path "${functionPath}" of object ${context.actor}`);
			}
			const result = resolvedFunction.apply(context.actor.system, splitArgs);
			console.info(`Resolved function ${functionPath}: ${result}`);
			return result;
		}
	}

	return expression.replace(pattern, evaluate);
}

/**
 * @description Evaluates improvised effects
 * @param {String} expression
 * @param {ExpressionContext} context
 * @returns {String}
 */
function evaluateEffects(expression, context) {
	const pattern = /(minor)|(heavy)|(massive)/gm;
	function evaluate(match) {
		return ImprovisedEffect.calculateAmountFromContext(match, context);
	}
	return expression.replace(pattern, evaluate);
}

/**
 * @description Evaluates special variables
 * @param expression
 * @param context
 * @example $sl*10
 * @example $cl/2
 * */
function evaluateVariables(expression, context) {
	const pattern = /\$(?<symbol>\w+)/gm;
	function evaluate(match, symbol) {
		switch (symbol) {
			// TODO: TARGET number of status effects (throw if more than 1 selected?)
			// TODO: CHARACTER highest strength among bonds
			// TODO: CHARACTER number of bonds
			// Improvised effects
			case 'minor':
			case 'heavy':
			case 'massive':
				return ImprovisedEffect.calculateAmountFromContext(symbol, context);
			// Character level
			case 'cl':
				context.assertActor(match);
				return context.actor.system.level.value;
			// Item level / skill level
			case 'il':
			case 'sl':
				context.assertItem(match);
				return context.item.system.level.value;
			default:
				throw new Error(`Unsupported symbol ${symbol}`);
		}
	}
	return expression.replace(pattern, evaluate);
}

/**
 * @description Custom functions provided by the expression engine
 * @param {String} expression
 * @param {ExpressionContext} context
 * @returns {String}
 * @example &step(40,50,60)
 */
function evaluateMacros(expression, context) {
	const pattern = /&(?<name>[a-zA-Z]+)\((?<params>.*?)\)/gm;
	function evaluateMacro(match, name, params) {
		const splitArgs = params.split(',');
		switch (name) {
			case `sl`: {
				context.assertActor(match);
				const skillId = splitArgs[0].match(/(\w+-*\s*)+/gm)[0];
				console.debug(`Resolved actor ${context.actor} from chat message`);
				const skill = context.actor.getSingleItemByFuid(skillId, 'skill');
				if (!skill) {
					ui.notifications.warn('FU.ChatEvaluateNoSkill', { localize: true });
					throw new Error(`The actor ${context.actor.name} does not have a skill with the Fabula Ultima Id ${skillId}`);
				}
				return skill.system.level.value;
			}
			case 'step':
				return stepByLevel(context, splitArgs[0], splitArgs[1], splitArgs[2]);
			default:
				throw new Error(`Unsupported macro ${name}`);
		}
	}
	return expression.replace(pattern, evaluateMacro);
}

/**
 * @description Given 3 amounts, picks the one for this characters' level
 * @param {ExpressionContext} context
 * @param {Number} first
 * @param {Number} second
 * @param {Number} third
 */
function stepByLevel(context, first, second, third) {
	const actor = context.resolveActorOrHighestLevelTarget();
	const tier = ImprovisedEffect.getCharacterTier(actor.system.level.value);
	switch (tier) {
		case 0:
			return first;
		case 1:
			return second;
		case 2:
			return third;
	}
	return null;
}

/**
 * Evaluates properties within the expression using the available context
 * @param {String}  expression
 * @param {ExpressionContext} context
 * @returns {String}
 * @example @system.value.thingie
 */
function evaluateReferencedProperties(expression, context) {
	const pattern = /(?<variable>@([a-zA-Z]+\.?)+)/gm;
	function evaluate(match, label, path, pN, offset, string, groups) {
		// TODO: Refactor
		let root = null;
		let propertyPath = '';

		if (match.includes(itemLabel)) {
			context.assertItem(match);
			root = context.item;
			propertyPath = match.replace(`${referenceSymbol}${itemLabel}.`, 'system.');
		} else if (match.includes(actorLabel)) {
			context.assertActor(match);
			root = context.actor;
			propertyPath = match.replace(`${referenceSymbol}${actorLabel}.`, 'system.');
		}
		// Don't evaluate the built-in expressions
		else {
			return match;
		}

		// Evaluate the property value
		const propertyValue = getPropertyValueByPath(root, propertyPath);
		if (propertyValue === undefined) {
			throw new Error(`Unexpected variable "${propertyPath}" in object ${root}`);
		}
		return propertyValue;
	}

	return expression.replace(pattern, evaluate);
}

/**
 * @param obj The object to resolve the function  from
 * @param path The path to the function, in dot notation
 * @returns {Function} The resolved function
 */
function getFunctionFromPath(obj, path) {
	if (typeof path !== 'string') {
		throw new Error('Path must be a string');
	}
	if (typeof obj !== 'object' || obj === null) {
		throw new Error('Invalid object provided');
	}

	const parts = path.split('.');
	let current = obj;

	for (const part of parts) {
		if (current[part] === undefined) {
			throw new Error(`Path not found in ${obj}: ${path}`);
		}
		current = current[part];
	}

	if (typeof current !== 'function') {
		throw new Error(`Path does not resolve to a function: ${path}`);
	}

	return current;
}

/**
 * @param obj The object to resolve the property from
 * @param path The path to the property, in dot notation
 * @returns {undefined|*} The value of the property
 */
function getPropertyValueByPath(obj, path) {
	const keys = path.split('.');
	let value = obj;

	for (let key of keys) {
		if (typeof value === 'object' && value !== null) {
			value = value[key];
		} else {
			return undefined;
		}
	}

	return value;
}

export const Expressions = {
	evaluate,
	requiresContext,
	getFunctionFromPath,
	getPropertyValueByPath,
};
