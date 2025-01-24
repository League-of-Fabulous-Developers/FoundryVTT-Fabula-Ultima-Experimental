import { onManageActiveEffect, prepareActiveEffectCategories } from '../documents/effects/effects.mjs';
import { ChecksV2 } from '../checks/checks-v2.mjs';
import { FU } from '../helpers/config.mjs';
import { InlineHelper } from '../helpers/inline-helper.mjs';

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class FUItemSheet extends ItemSheet {
	// Initialize drag counter
	dragCounter = 0;

	/** @override */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ['projectfu', 'sheet', 'item', 'backgroundstyle'],
			width: 700,
			tabs: [
				{
					navSelector: '.sheet-tabs',
					contentSelector: '.sheet-body',
					initial: 'description',
				},
			],
			dragDrop: [
				{
					dragSelector: '.directory-item.document.item, .effects-list .effect', // Selector for draggable items
					dropSelector: '.desc.drop-zone', // Selector for item sheet
				},
			],
		});
	}

	/** @override */
	get template() {
		const path = 'systems/projectfu/templates/item';
		// Return a single sheet for all item types.
		// return `${path}/item-sheet.hbs`;

		// Alternatively, you could use the following return statement to do a
		// unique item sheet by type, like `weapon-sheet.hbs`.
		return `${path}/item-${this.item.type}-sheet.hbs`;
	}

	/* -------------------------------------------- */

	/**
	 * @remarks Used for rendering the sheets
	 */
	/** @override */
	async getData() {
		// Retrieve base data structure.
		const context = super.getData();

		// Use a safe clone of the actor data for further operations.
		const actor = this.object?.parent ?? null;
		const actorData = actor ? actor.toObject(false) : null;

		// Use a safe clone of the item data for further operations.
		const itemData = context.item;

		// Retrieve the roll data for TinyMCE editors.
		context.rollData = {};
		if (actor) {
			context.rollData = actor.getRollData();
		}

		// Add the actor's data to context.data for easier access, as well as flags.
		context.system = itemData.system;
		context.flags = itemData.flags;

		// Prepare active effects for easier access
		context.effects = prepareActiveEffectCategories(this.item.effects);

		// Combine all effects into a single array
		context.allEffects = [...context.effects.temporary.effects, ...context.effects.passive.effects, ...context.effects.inactive.effects];

		// Enrich each effect's description
		for (const effect of context.allEffects) {
			effect.enrichedDescription = effect.description ? await TextEditor.enrichHTML(effect.description) : '';
		}

		// Add CONFIG data required
		context.attrAbbr = CONFIG.FU.attributeAbbreviations;
		context.damageTypes = CONFIG.FU.damageTypes;
		context.wpnType = CONFIG.FU.weaponTypes;
		context.handedness = CONFIG.FU.handedness;
		context.weaponCategoriesWithoutCustom = CONFIG.FU.weaponCategoriesWithoutCustom;
		context.heroicType = CONFIG.FU.heroicType;
		context.miscCategories = CONFIG.FU.miscCategories;
		context.consumableType = CONFIG.FU.consumableType;
		context.treasureType = CONFIG.FU.treasureType;
		context.defenses = CONFIG.FU.defenses;
		context.resAbbr = CONFIG.FU.resourcesAbbr;
		context.targetingRules = CONFIG.FU.targetingRules;

		// Add the actor object to context for easier access
		context.actor = actorData;

		// Enriches description fields within the context object
		context.enrichedHtml = {
			description: await TextEditor.enrichHTML(context.system.description ?? ''),
			zeroTrigger: await TextEditor.enrichHTML(context.system?.zeroTrigger?.description ?? ''),
			zeroEffect: await TextEditor.enrichHTML(context.system?.zeroEffect?.description ?? ''),
		};

		context.FU = FU;

		return context;
	}

	/* -------------------------------------------- */

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);

		// [PDFPager Support] Opening Journal PDF pages from PDF Code
		$('#pdfLink').click(function () {
			const inputValue = $('input[name="system.source.value"]').val();
			const match = inputValue.match(/([A-Za-z]+)\s*(\d+)/);

			if (match) {
				const pdfCode = match[1];
				const pageNumber = match[2];

				// Check if the openPDFByCode function exists
				if (ui.pdfpager && ui.pdfpager.openPDFByCode) {
					ui.pdfpager.openPDFByCode(pdfCode, { page: pageNumber });
				} else {
					// TODO: Create Fallback method using a normal Foundry link
				}
			} else {
				console.error('Invalid input format. Please use proper syntax "PDFCode PageNumber"');
			}
		});

		// Render the active effect sheet for viewing/editing when middle-clicking
		html.find('.effect').mouseup((ev) => {
			if (ev.button === 1 && !$(ev.target).hasClass('effect-control')) {
				const li = $(ev.currentTarget);
				const simulatedEvent = {
					preventDefault: () => {},
					currentTarget: {
						dataset: { action: 'edit' },
						closest: () => li[0],
						classList: {
							contains: (cls) => li.hasClass(cls),
						},
					},
				};

				onManageActiveEffect(simulatedEvent, this.item);
			}
		});

		// Active Effect Roll management
		html.on('click', '.effect-roll', (ev) => onManageActiveEffect(ev, this.item));

		// -------------------------------------------------------------
		// Everything below here is only needed if the sheet is editable
		if (!this.isEditable) return;

		// Roll handlers, click handlers, etc. would go here.

		// Cast Spell Button

		html.find('.regenerate-fuid-button').click(async (event) => {
			event.preventDefault();

			// Call the regenerateFUID method on the item
			const newFUID = await this.item.regenerateFUID();

			if (newFUID) {
				this.render();
			}
		});

		// Active Effect management
		html.on('click', '.effect-control', (ev) => onManageActiveEffect(ev, this.item));

		// Martial/Offensive Toggle
		html.find('#offensive-header').click(this._toggleMartial.bind(this, 'offensive'));
		html.find('#martial-header').click(this._toggleMartial.bind(this, 'martial'));

		// dropzone event listeners
		const dropZone = html.find('.desc.drop-zone');
		dropZone.on('dragenter', this._onDragEnter.bind(this));
		dropZone.on('dragleave', this._onDragLeave.bind(this));
		dropZone.on('drop', this._onDropReset.bind(this));
	}

	/* -------------------------------------------- */

	_onDragEnter(event) {
		event.preventDefault();
		this.dragCounter++;
		const dropZone = $(event.currentTarget);
		dropZone.addClass('highlight-drop-zone');
	}

	_onDragLeave(event) {
		event.preventDefault();
		this.dragCounter--;
		if (this.dragCounter === 0) {
			const dropZone = $(event.currentTarget);
			dropZone.removeClass('highlight-drop-zone');
		}
	}

	_onDropReset(event) {
		this.dragCounter = 0;
		const dropZone = $(event.currentTarget);
		dropZone.removeClass('highlight-drop-zone');
	}

	_onDragStart(event) {
		const li = event.currentTarget;
		if ('link' in event.target.dataset) return;

		// Create drag data
		let dragData;

		// Active Effect
		if (li.dataset.effectId) {
			const effect = this.item.effects.get(li.dataset.effectId);
			dragData = effect.toDragData();
		}

		if (!dragData) return;

		// Set data transfer
		event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
	}

	/* -------------------------------------------- */

	async _onDrop(event) {
		console.log('Drop event detected');
		event.preventDefault();

		// Retrieve drag data using TextEditor
		const data = TextEditor.getDragEventData(event);

		if (data.type === 'Item') {
			return this.#handleItemDrop(data, event);
		}
		if (data.type === 'ActiveEffect') {
			const effect = await ActiveEffect.implementation.fromDropData(data);
			if (!this.item.isOwner || !effect) return false;
			if (effect.target === this.item) return false;
			return ActiveEffect.create(effect.toObject(), { parent: this.item });
		}
	}

	async #handleItemDrop(data, event) {
		const itemData = await Item.implementation.fromDropData(data);

		// Determine the configuration based on item type
		const config = this._findItemConfig(itemData.type);
		if (config) {
			// Check if there is an active ProseMirror editor
			const activeEditor = document.querySelector('.editor-content.ProseMirror');
			if (itemData.type === 'effect') {
				if (activeEditor) {
					// Handle effect drop into ProseMirror editor
					await this._handleEditorEffectDrop(itemData, event);
				} else {
					// Handle effect drop into actor sheet
					await this._importEffectData(itemData);
				}
			} else {
				// Handle other item drops
				await this._processItemDrop(itemData, config);
			}
		}
	}

	// Helper function to find the appropriate update configuration
	_findItemConfig(type) {
		const itemTypeConfigs = [
			{
				types: ['effect'],
				update: async (itemData) => {
					// Effects are handled separately
					return;
				},
			},
		];

		return itemTypeConfigs.find((config) => config.types.includes(type));
	}

	// Process item drop based on the configuration
	async _processItemDrop(itemData, config) {
		const existingItem = this.actor.items.find((i) => i.name === itemData.name && i.type === itemData.type);
		if (existingItem) {
			await config.update(itemData, existingItem);
		} else {
			await super._onDrop(event);
		}
	}

	// Import effect data into the specific item's effects array
	async _importEffectData(itemData) {
		const newEffects = itemData.effects || [];

		// Get existing effect IDs from the item
		const existingEffectIds = this.item.effects.map((effect) => effect._id);

		// Filter out new effects that are already present
		const filteredNewEffects = newEffects.filter((effect) => !existingEffectIds.includes(effect._id));

		// Create new ActiveEffect documents for the filtered effects
		if (filteredNewEffects.length > 0) {
			const effectsToCreate = filteredNewEffects.map((effectData) => ({
				...effectData,
				parent: this.item,
			}));

			// Create the new ActiveEffect documents
			await ActiveEffect.createDocuments(effectsToCreate, { parent: this.item });

			// console.log('Created New Effects:', createdEffects);
		} else {
			console.log('No new effects to add');
		}
	}

	// Handle dropping effects into a text editor
	async _handleEditorEffectDrop(itemData, event) {
		const activeEditor = document.querySelector('.editor-content.ProseMirror');
		if (activeEditor) {
			const effects = itemData.effects || [];
			// Use an arrow function to ensure `this` context is correct
			const formattedEffects = effects.map((effect) => this._formatEffect(effect)).join(' ');

			// Prevent the default behavior of creating a link
			event.preventDefault();
			event.stopPropagation();

			// Get the current content of the editor
			const currentContent = activeEditor.innerHTML;

			// Append the formatted effects to the current content of the editor
			activeEditor.innerHTML = currentContent + formattedEffects;

			console.log(`Appended formatted effects to the ProseMirror editor.`);
		} else {
			console.log('No active ProseMirror editor found.');
		}
	}

	// Helper function to generate the @EFFECT format string
	_formatEffect(effect) {
		const encodedEffect = InlineHelper.toBase64(effect);
		return `@EFFECT[${encodedEffect}]`;
	}

	_canDragDrop() {
		console.log('Checking drag drop capability');
		return this.isEditable;
	}

	/* -------------------------------------------- */

	_toggleMartial(type) {
		const system = this.item?.system;

		if (system) {
			const updateKey = type === 'offensive' ? 'isOffensive' : 'isMartial';
			this.item.update({ [`system.${updateKey}.value`]: !system[updateKey].value });
		}
	}

	_getSubmitData(updateData = {}) {
		const data = super._getSubmitData(updateData);
		// Prevent submitting overridden values
		const overrides = foundry.utils.flattenObject(this.item.overrides);
		for (let k of Object.keys(overrides)) {
			delete data[k];
		}
		return data;
	}

	_getHeaderButtons() {
		const buttons = super._getHeaderButtons();
		buttons.unshift({
			label: game.i18n.localize('FU.ChatMessageSend'),
			class: 'send-to-chat',
			icon: 'fas fa-comment',
			onclick: this._onSendToChat.bind(this),
		});
		return buttons;
	}

	_onSendToChat(event) {
		event.preventDefault();
		const item = this.item;

		// Call the display method
		ChecksV2.display(this, item);
	}
}
