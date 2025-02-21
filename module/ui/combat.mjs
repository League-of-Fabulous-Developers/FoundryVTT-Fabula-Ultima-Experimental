import { SETTINGS } from '../settings.js';
import { Flags } from '../helpers/flags.mjs';
import { MESSAGES, SOCKET } from '../socket.mjs';
import { CombatHUD } from './combat-hud.mjs';
import { FU, SYSTEM } from '../helpers/config.mjs';
import { FUHooks } from '../hooks.mjs';

export const FRIENDLY = 'friendly';
export const HOSTILE = 'hostile';

/**
 * @description Dispatched by the combat during its lifetime
 * @property {FU.combatEvent} type The type of event
 * @property {Number} round The round the event is taking place in
 * @property {Combatant} combatant The current combatant taking a turn, which can be null.
 * @property {FUActor|*} actor The actor involved in the event, which can be null.
 * @property {Token|*} token The token of the combatant taking a turn, which can be null.
 * @property {Combatant[]} combatants The actors involved in the combat
 * @property {FUActor[]} actors The actors involved in the combat
 * @remarks Depending on the {@linkcode type} of the event, some properties will be assigned and others will not.
 * Combat and round events will include all combatants, whereas turn events are relegated to the single combatant.
 */
export class CombatEvent {
	constructor(type, round) {
		this.type = type;
		this.round = round;
	}

	forCombatants(combatants) {
		this.combatants = combatants;
		return this;
	}

	forCombatant(combatant) {
		this.combatant = combatant;
		return this;
	}

	get token() {
		return this.combatant.token;
	}

	get actor() {
		return this.combatant.actor;
	}

	get actors() {
		return Array.from(this.combatants.map((c) => c.actor));
	}
}

/**
 * @typedef CombatHistoryData
 * @property {Number} round
 * @property {Number} turn
 * @property {Number} tokenId
 * @property {Number} combatantId
 * @remarks {@link https://foundryvtt.com/api/interfaces/client.CombatHistoryData.html}
 */

/**
 * @typedef Combat
 * @property {Combatant[]} turns
 * @property {Combatant} combatant Get the Combatant who has the current turn.
 * @property {CombatHistoryData} current  Record the current round, turn, and tokenId to understand changes in the encounter state
 * @property {CombatHistoryData} previous Track the previous round, turn, and tokenId to understand changes in the encounter state
 * @property {Boolean} started
 * @property {Boolean} isActive Is this combat active in the current scene?
 * @property {Function<Promise>} startCombat Begin the combat encounter, advancing to round 1 and turn 1
 * @property {Function<Promise>} endCombat Display a dialog querying the GM whether they wish to end the combat encounter and empty the tracker
 * @remarks {@link https://foundryvtt.com/api/classes/client.Combat.html}
 */

/**
 * @property {Collection<FUCombatant>} combatants
 * @extends Combat
 */
export class FUCombat extends Combat {
	/**
	 * @override
	 */
	get nextCombatant() {
		return null;
	}

	/**
	 * @override
	 */
	async rollInitiative(ids, options) {
		return this;
	}

	/**
	 * @override
	 * @returns {Combatant} Get the Combatant who has the current turn.
	 */
	get combatant() {
		const id = this.getFlag(SYSTEM, Flags.CombatantId);
		return id != null ? this.combatants.get(id) : null;
	}

	setCombatant(combatant) {
		this.setFlag(SYSTEM, Flags.CombatantId, combatant != null ? combatant.id : null);
	}

	/**
	 * @param {CombatData} data
	 * @param context
	 */
	constructor(data, context) {
		super(data, context);
		console.debug('Constructed combat');
		if (this.isActive && game.settings.get(SYSTEM, SETTINGS.experimentalCombatHud)) CombatHUD.init();
	}

	/**
	 * @return {string[]}
	 */
	get currentRoundTurnsTaken() {
		const allRoundsTurnsTaken = this.getTurnsTaken();
		return allRoundsTurnsTaken[this.round] ?? [];
	}

	/**
	 * @return {Object<number, string[]>}
	 */
	getTurnsTaken() {
		return this.getFlag(SYSTEM, Flags.CombatantsTurnTaken) ?? {};
	}

	/**
	 * @param {Object<number,string[]>} flag
	 */
	async setTurnsTaken(flag) {
		return this.setFlag(SYSTEM, Flags.CombatantsTurnTaken, flag);
	}

	/**
	 * @param {Object<number,string[]>} flag
	 */
	async setTurnStarted(flag) {
		return this.setFlag(SYSTEM, Flags.CombatantsTurnStarted, flag);
	}

	/**
	 * @return {Object<number, string[]>}
	 */
	getTurnsStarted() {
		return this.getFlag(SYSTEM, Flags.CombatantsTurnStarted) ?? {};
	}

	/**
	 * @returns {Number} The total number of turns among factions
	 */
	get totalTurns() {
		return this.combatants.reduce((sum, combatant) => sum + combatant.totalTurns, 0);
	}

	/**
	 * @override
	 */
	async startCombat() {
		const factions = [
			{
				value: FRIENDLY,
				translation: `FU.DialogFirstTurnFactionsFriendly`,
			},
			{
				value: HOSTILE,
				translation: `FU.DialogFirstTurnFactionsHostile`,
			},
		];

		const firstTurnFaction = await Dialog.prompt({
			title: game.i18n.localize('FU.DialogFirstTurnTitle'),
			label: game.i18n.localize('FU.DialogFirstTurnLabel'),
			content: await renderTemplate('systems/projectfu/templates/dialog/dialog_first_turn.hbs', {
				factions,
				selected: FRIENDLY,
			}),
			options: { classes: ['dialog-first-turn'] },
			rejectClose: false,
			/** @type {(jQuery) => "friendly"|"hostile"} */
			callback: (html) => html.find('select[name=faction]').val(),
		});

		if (!firstTurnFaction) {
			console.warn(`No faction was selected to start the conflict`);
			return this;
		}

		await this.setFirstTurn(firstTurnFaction);
		await this.setCurrentTurn(firstTurnFaction);
		console.debug(`Combat started for ${this.combatants.length} combatants`);
		Hooks.callAll(FUHooks.COMBAT_EVENT, new CombatEvent(FU.combatEvent.startOfCombat, this.round).forCombatants(this.combatants));
		return super.startCombat();
	}

	/**
	 * @override
	 */
	async endCombat() {
		const end = await super.endCombat();
		if (end) {
			console.debug(`Combat ended for ${this.combatants.length} combatants`);
			Hooks.callAll(FUHooks.COMBAT_EVENT, new CombatEvent(FU.combatEvent.endOfCombat, this.round).forCombatants(this.combatants));
		}
	}

	/**
	 * Manage the execution of Combat lifecycle events.
	 * This method orchestrates the execution of four events in the following order, as applicable:
	 * 1. End Turn
	 * 2. End Round
	 * 3. Begin Round
	 * 4. Begin Turn
	 * Each lifecycle event is an async method, and each is awaited before proceeding.
	 * @returns {Promise<void>}
	 * @protected
	 */
	async _manageTurnEvents(adjustedTurn) {
		if (!game.users.activeGM?.isSelf) {
			console.debug(`_manageTurnEvents: Only the GM can manage turn events`);
			return;
		}

		let prior = undefined;
		if (this.previous) {
			prior = this.combatants.get(this.previous.combatantId);
		}

		// Adjust the turn order before proceeding. Used for embedded document workflows
		if (Number.isNumeric(adjustedTurn)) await this.update({ turn: adjustedTurn }, { turnEvents: false });
		if (!this.started) {
			console.debug(`_manageTurnEvents: Combat not yet started`);
			return;
		}

		// Identify what progressed
		const advanceRound = this.current.round > (this.previous.round ?? -1);
		const advanceTurn = this.current.turn > (this.previous.turn ?? -1);
		if (!(advanceTurn || advanceRound)) {
			//console.debug(`_manageTurnEvents: Cannot advance turn or round`);
			return;
		}

		// Conclude prior turn
		if (prior) {
			console.debug(`_manageTurnEvents: Ending combat turn`);
			await this._onEndTurn(prior);
		}

		// Conclude prior round
		if (advanceRound && this.previous.round !== null) {
			console.debug(`_manageTurnEvents: Ending combat round`);
			await this._onEndRound();
		}

		// Begin new round
		if (advanceRound) {
			console.debug(`_manageTurnEvents: Starting combat round`);
			await this._onStartRound();
		}

		console.debug(`_manageTurnEvents: Finished`);
	}

	/**
	 * @param {FUCombatant} combatant
	 * @returns {Promise<void>}
	 */
	async startTurn(combatant) {
		if (this.isTurnStarted) {
			console.error(`Turn already started by ${combatant.id}`);
			return;
		}

		if (game.user?.isGM) {
			this.setCombatant(combatant);
			this.current.combatantId = combatant?.id || null;
			this.current.tokenId = combatant?.tokenId || null;

			console.debug(`Combat turn started for ${combatant.actor.uuid}`);
			Hooks.callAll(FUHooks.COMBAT_EVENT, new CombatEvent(FU.combatEvent.startOfTurn, this.round).forCombatant(combatant));

			// FROM BASE
			// Determine the turn order and the current turn
			const turns = this.combatants.contents.sort(this._sortCombatants);
			if (this.turn !== null) this.turn = Math.clamp(this.turn, 0, turns.length - 1);
			this.current = this._getCurrentState(combatant);
			// Notify
			this.setupTurns();
			// Set flags
			const flag = this.getTurnsStarted();
			flag[this.round] ??= [];
			flag[this.round].push(combatant.id);
			await this.setTurnStarted(flag);
			this.notifyCombatTurnChange();
			SOCKET.executeForOthers(MESSAGES.TurnChanged);
		} else {
			console.debug(`Executing message ${MESSAGES.TurnStarted} as GM`);
			await SOCKET.executeAsGM(MESSAGES.TurnStarted, this.id, combatant.id);
		}

		await this._onStartTurn(combatant);
	}

	notifyCombatTurnChange() {
		console.debug(`Invoking 'combatTurnChange' for previous: ${JSON.stringify(this.previous)}, current: ${JSON.stringify(this.current)}`);
		Hooks.callAll('combatTurnChange', this, this.previous, this.current);
		// Inform clients too?
	}

	/**
	 * @param {FUCombatant} combatant
	 */
	async endTurn(combatant) {
		if (game.user?.isGM) {
			console.info(`Combat turn ended for ${combatant.actor.uuid}`);

			// Set flags
			const flag = this.getTurnsTaken();
			flag[this.round] ??= [];
			flag[this.round].push(combatant.id);
			await this.setTurnsTaken(flag);

			// Invoke event
			Hooks.callAll(FUHooks.COMBAT_EVENT, new CombatEvent(FU.combatEvent.endOfTurn, this.round).forCombatant(combatant));
			this.setCombatant(null);

			// Setup
			this.setupTurns();
			await this.nextTurn();
			this.notifyCombatTurnChange();
		} else {
			console.debug(`Executing message ${MESSAGES.TurnEnded} as GM`);
			await SOCKET.executeAsGM(MESSAGES.TurnEnded, this.id, combatant.id);
		}
	}

	/**
	 * @returns {Boolean}
	 */
	get isTurnStarted() {
		return this.combatant != null;
	}

	/**
	 * @param {FUCombatant} combatant
	 * @returns {Boolean} True if the given combatant is that has started their turn
	 */
	isCurrentCombatant(combatant) {
		if (!this.isTurnStarted) {
			return false;
		}
		if (!combatant) {
			return false;
		}
		return combatant.id === this.combatant.id;
	}

	/**
	 * @returns {string|"friendly"|"hostile"|undefined|"hostile"|"friendly"} The faction that has the next turn
	 */
	determineNextTurn() {
		if (!this.started) {
			return undefined;
		}

		const turnsTaken = this.currentRoundTurnsTaken;
		if (turnsTaken.length) {
			const lastTurn = this.combatants.get(turnsTaken.at(-1)).faction;
			const nextTurn = lastTurn === HOSTILE ? FRIENDLY : HOSTILE;
			let turnsNotTaken = this.currentRoundTurnsLeft;

			const skip = this.settings.skipDefeated;
			if (skip) {
				turnsNotTaken = turnsNotTaken.filter((combatant) => !combatant.isDefeated);
			}

			const factionsWithTurnsLeft = turnsNotTaken.map((combatant) => combatant.faction);
			return factionsWithTurnsLeft.includes(nextTurn) ? nextTurn : lastTurn;
		} else {
			return this.getFirstTurn();
		}
	}

	/**
	 * @return {Array<FUCombatant>}
	 */
	get currentRoundTurnsLeft() {
		const countTurnsTaken = this.currentRoundTurnsTaken.reduce((agg, currentValue) => {
			agg[currentValue] = (agg[currentValue] ?? 0) + 1;
			return agg;
		}, {});

		return this.combatants.filter((combatant) => (countTurnsTaken[combatant.id] ?? 0) < combatant.totalTurns);
	}

	/**
	 * @return {"hostile" | "friendly"} The faction whose turn it is
	 */
	getCurrentTurn() {
		return this.getFlag(SYSTEM, Flags.CurrentTurn);
	}

	/**
	 * @description Sets the faction that has the current turn
	 * @param {"hostile" | "friendly"} flag
	 */
	setCurrentTurn(flag) {
		if (game.user === game.users.activeGM) {
			if (flag) {
				return this.setFlag(SYSTEM, Flags.CurrentTurn, flag);
			} else {
				return this.unsetFlag(SYSTEM, Flags.CurrentTurn);
			}
		}
	}

	_onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
		super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
	}

	/**
	 * @description The Array of combatants sorted into initiative order, breaking ties alphabetically by name.
	 * @override
	 * @returns {Combatant[]}
	 */
	setupTurns() {
		this.previous ??= {};
		const result = (this.turns = this.combatants.contents);
		return result;
	}

	/**
	 * @override
	 */
	async previousTurn() {
		const turnsTaken = this.getTurnsTaken();

		if (turnsTaken[this.round]) {
			turnsTaken[this.round].pop();
			await this.setTurnsTaken(turnsTaken);
		}

		await super.previousTurn();
		await this.setCurrentTurn(this.determineNextTurn());
		return this;
	}

	/**
	 * @override
	 */
	async previousRound() {
		const flag = this.getTurnsTaken();

		if (flag[this.round]) {
			delete flag[this.round];
		}
		flag[this.round - 1]?.pop();
		await this.setTurnsTaken(flag);

		await this.setCurrentTurn(this.determineNextTurn());
		await super.previousRound();

		if (!this.started) {
			await this.setCurrentTurn(undefined);
		}
		return this;
	}

	/**
	 * @override
	 */
	async nextTurn() {
		await this.setCurrentTurn(this.determineNextTurn());

		// Determine the next turn number
		const turnsTaken = this.currentRoundTurnsTaken.map((id) => this.combatants.get(id));
		let turnsNotTaken = this.currentRoundTurnsLeft;

		const skip = this.settings.skipDefeated;
		if (skip) {
			turnsNotTaken = turnsNotTaken.filter((combatant) => !combatant.isDefeated);
		}

		const next = turnsNotTaken.length ? turnsTaken.length : null;

		// Maybe advance to the next round
		let round = this.round;
		if (this.round === 0 || next === null) {
			return this.nextRound();
		}

		// Update the document, passing data through a hook first
		const updateData = { round, turn: next };
		const updateOptions = { advanceTime: CONFIG.time.turnTime, direction: 1 };
		Hooks.callAll('combatTurn', this, updateData, updateOptions);

		SOCKET.executeForOthers(MESSAGES.TurnChanged);
		return this.update(updateData, updateOptions);
	}

	/**
	 * @override
	 */
	async nextRound() {
		await this.setCurrentTurn(this.getFirstTurn());

		let turn = this.turn === null ? null : 0; // Preserve the fact that it's no-one's turn currently.
		let advanceTime = Math.max(this.totalTurns - this.turn, 0) * CONFIG.time.turnTime;
		advanceTime += CONFIG.time.roundTime;
		let nextRound = this.round + 1;

		// Update the document, passing data through a hook first
		const updateData = { round: nextRound, turn };
		const updateOptions = { advanceTime, direction: 1 };
		Hooks.callAll(`combatRound`, this, updateData, updateOptions);
		SOCKET.executeForOthers(MESSAGES.RoundChanged);
		// Invoke our custom event
		console.debug(`Round ended for ${this.combatants.length} combatants`);
		Hooks.callAll(FUHooks.COMBAT_EVENT, new CombatEvent(FU.combatEvent.endOfRound, this.round).forCombatants(this.combatants));
		// Update the internals
		return this.update(updateData, updateOptions);
	}

	/**
	 * @return {"hostile" | "friendly"} The facton who has the first turn in the combat
	 */
	getFirstTurn() {
		return this.getFlag(SYSTEM, Flags.FirstTurn);
	}

	/**
	 * @description Sets the faction that has the first turn in the combat
	 * @param {"hostile" | "friendly"} flag
	 */
	async setFirstTurn(flag) {
		return this.setFlag(SYSTEM, Flags.FirstTurn, flag);
	}

	/**
	 * @returns {FUActor[]}
	 */
	getActors() {
		return Array.from(this.combatants.map((c) => c.actor));
	}
}
