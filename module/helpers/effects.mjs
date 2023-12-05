/**
 * Manage Active Effect instances through the Actor Sheet via effect control buttons.
 * @param {MouseEvent} event      The left-click event on the effect control
 * @param {Actor|Item} owner      The owning document which manages this effect
 */
export function onManageActiveEffect(event, owner) {
	event.preventDefault();
	const a = event.currentTarget;
	const li = a.closest('li');
	const effect = li.dataset.effectId ? owner.effects.get(li.dataset.effectId) : null;
	switch (a.dataset.action) {
		case 'create':
			return owner.createEmbeddedDocuments('ActiveEffect', [
				{
					label: 'New Effect',
					icon: 'icons/svg/aura.svg',
					origin: owner.uuid,
					'duration.rounds': li.dataset.effectType === 'temporary' ? 1 : undefined,
					disabled: li.dataset.effectType === 'inactive',
				},
			]);
		case 'edit':
			return effect.sheet.render(true);
		case 'delete':
			return effect.delete();
		case 'toggle':
			return effect.update({ disabled: !effect.disabled });
	}
}

/**
 * Prepare the data structure for Active Effects which are currently applied to an Actor or Item.
 * @param {ActiveEffect[]} effects    The array of Active Effect instances to prepare sheet data for
 * @return {object}                   Data for rendering
 */
export function prepareActiveEffectCategories(effects) {
	// Define effect header categories
	const categories = {
		temporary: {
			type: 'temporary',
			label: 'Temporary Effects',
			effects: [],
		},
		passive: {
			type: 'passive',
			label: 'Passive Effects',
			effects: [],
		},
		inactive: {
			type: 'inactive',
			label: 'Inactive Effects',
			effects: [],
		},
	};

	// Iterate over active effects, classifying them into categories
	for (let e of effects) {
		e._getSourceName(); // Trigger a lookup for the source name
		if (e.disabled) categories.inactive.effects.push(e);
		else if (e.isTemporary) categories.temporary.effects.push(e);
		else categories.passive.effects.push(e);
	}
	return categories;
}

/**
 * A helper function to toggle a status effect which includes an ActiveEffect template.
 * Designed based off TokenDocument#toggleActiveEffect to properly interact with token hud.
 * @param {{id: string, label: string, icon: string}} effectData The ActiveEffect data
 * @returns {Promise<boolean>}                                   Whether the ActiveEffect is now on or off
 */
export async function toggleEffect(actor, effectData) {
	const existing = actor.effects.reduce((arr, e) => {
		if ( (e.statuses.size === 1) && e.statuses.has(effectData.id) ) arr.push(e.id);
		return arr;
	}, []);
	if ( existing.length > 0 ){
		await actor.deleteEmbeddedDocuments("ActiveEffect", existing);
		return false;
	}
	else {
		const cls = getDocumentClass("ActiveEffect");
		const createData = foundry.utils.deepClone(effectData);
		createData.statuses = [effectData.id];
		delete createData.id;
		cls.migrateDataSafe(createData);
		cls.cleanData(createData);
		createData.name = game.i18n.localize(createData.name);
		await cls.create(createData, {parent: actor});
		return true;
	}
}