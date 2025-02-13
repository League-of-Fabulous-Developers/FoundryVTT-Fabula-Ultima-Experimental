/**
 * @description An enumeration of all the hooks provided by the system, usable by the built-in Hooks API
 * @example Hooks.on(FUHooks.DAMAGE_PIPELINE_BEFORE_AFFINITIES, modifyAmountJustBecause);
 * @remarks For most callbacks returning false will prevent anything further down the call-chain from being invoked.
 */
export const FUHooks = {
	/**
	 * @description Add/modify the bonuses and modifiers before the result is calculated.
	 * @example callback(context) { context.modifiers.set("foobar", 42); return true; }
	 * @example callback(context) { context.modifiers.delete("affinity"); return true; }
	 */
	DAMAGE_PIPELINE_PRE_CALCULATE: 'projectfu.pipelines.damage.preCalculate',
	/**
	 * @description Modify the result after it's been calculated.
	 * @example callback(context) { context.result += 42; return true; }
	 */
	DAMAGE_PIPELINE_POST_CALCULATE: 'projectfu.pipelines.damage.postCalculate',
	/**
	 * @deprecated Replaced by {DAMAGE_PIPELINE_PRE_CALCULATE}
	 * @example calllback(data) { ... }
	 */
	DAMAGE_APPLY_BEFORE: 'projectfu.damage.beforeApply',
	/**
	 * @deprecated Replaced by {DAMAGE_PIPELINE_POST_CALCULATE}
	 * @example calllback(data) { ... }
	 */
	DAMAGE_APPLY_TARGET: 'projectfu.damage.applyTarget',
	/**
	 * @description Invoked when the data model for an FUActor is set
	 * @example callback(actor { ... }
	 */
	DATA_PREPARED_ACTOR: 'projectfu.actor.dataPrepared',
	/**
	 * @description Invoked when the data model for an FUItem is set
	 * @example callback(item) { ... }
	 */
	DATA_PREPARED_ITEM: 'projectfu.item.dataPrepared',
	/**
	 * @description Invoked when a study roll is made
	 * @example callback(actor, journalEntry) { ... }
	 */
	ROLL_STUDY: 'studyRoll',
	/**
	 * @description Invoked when there's a change in the combat state
	 * @example callback(event)
	 * @remarks Uses {@link CombatEvent}
	 */
	COMBAT_EVENT: 'projectfu.events.combat',
	/**
	 * @description Invoked after damage has been applied to an actor
	 * @example callback(event)
	 * @remarks Uses {@link DamageEvent}
	 */
	DAMAGE_EVENT: 'projectfu.events.damage',
	/**
	 * @description Invoked after resource gain has been applied to an actor
	 * @example callback(event)
	 * @remarks Uses {@link GainEvent}
	 */
	GAIN_EVENT: 'projectfu.events.gain',
	/**
	 * @description Dispatched after resource loss has been applied to an actor
	 * @example callback(event)
	 * @remarks Uses {@link LossEvent}.
	 */
	LOSS_EVENT: 'projectfu.events.loss',
	/**
	 * @description Dispatched after an actor enters or exits crisis.
	 * @example callback(event)
	 * @remarks Uses {@link CrisisEvent}. This can happen after a {@link DAMAGE_EVENT}.
	 */
	CRISIS_EVENT: 'projectfu.events.crisis',
	/**
	 * @description Invoked after an actor is reduced to 0 hit points
	 * @example callback(event)
	 * @remarks Uses {@link DefeatEvent}. This can happen after a {@link DAMAGE_EVENT}.
	 */
	DEFEAT_EVENT: 'projectfu.events.defeat',
	/**
	 * @description Dispatched after an actor has a status effect applied on them.
	 * @example callback(event)
	 * @remarks Uses {@link StatusEvent}. It happens AFTER the status effect has been applied.
	 */
	STATUS_EVENT: 'projectfu.events.status',
};

/**
 * @description Dispatched when an actor suffers damage
 * @typedef DamageEvent
 * @property {FU.damageTypes} type
 * @property {Number} amount
 * @property {FUActor} actor
 * @property {Token} token
 * @property {FUActor} sourceActor
 * @property {Token} sourceToken
 * @property {Set<String>} traits
 */

/**
 * @description Dispatched when an actor recovers resources (such as HP, MP)
 * @typedef GainEvent
 * @property {FU.resources} resource
 * @property {Number} amount
 * @property {FUActor} actor
 * @property {Token} token
 */

/**
 * @description Dispatched when an actor loses resources (such as HP, MP)
 * @typedef LossEvent
 * @property {FU.resources} resource
 * @property {Number} amount
 * @property {FUActor} actor
 * @property {Token} token
 */

/**
 * @description Dispatched when an actor enters crisis
 * @typedef CrisisEvent
 * @property {FUActor} actor
 */

/**
 * @description Dispatched when an actor is reduced to 0 HP
 * @typedef DefeatEvent
 * @property {FUActor} actor
 */

/**
 * @description Dispatched when an actor has a status toggled.
 * @typedef StatusEvent
 * @property {FUActor} actor
 * @property {Token} token
 * @property {String} status The id of the status effect
 * @property {String} enabled Whether the effect is enabled
 */
