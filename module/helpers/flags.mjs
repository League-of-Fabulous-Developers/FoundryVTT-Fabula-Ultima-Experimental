/**
 * @description The keys for scoped flags commonly used by the system. They are stored and accessed by documents such as actors,
 * chat messages.
 * @example actor.getFlag(Flags.Scope, Flags.CurrentTurn)
 */
export const Flags = Object.freeze({
	CombatantsTurnTaken: 'CombatantsTurnTaken',
	CurrentTurn: 'CurrentTurn',
	FirstTurn: 'FirstTurn',
	ChatMessage: Object.freeze({
		CheckParams: 'CheckParams',
		CheckV2: 'CheckV2',
		GroupCheck: 'GroupCheck',
		GroupCheckV2: 'GroupCheckV2',
		GroupCheckConfig: 'GroupCheckConfig',
		SupportCheck: 'Supporter',
		GroupCheckSupporters: 'GroupCheckSupporters',
		Item: 'Item',
		Damage: 'Damage',
		Source: 'Source',
		ResourceGain: 'ResourceGain',
		ResourceLoss: 'ResourceLoss',
		UseMetaCurrency: 'UseMetaCurrency',
		Targets: 'Targets',
		RevertedAction: 'RevertedAction',
	}),
	Scope: 'projectfu',
	Modifier: Object.freeze({
		ScaleIncomingDamage: 'scaleIncomingDamage',
	}),
});
