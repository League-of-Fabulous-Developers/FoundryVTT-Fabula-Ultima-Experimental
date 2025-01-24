import { ClassFeatureRegistry } from '../documents/items/classFeature/class-feature-registry.mjs';
import { OptionalFeatureRegistry } from '../documents/items/optionalFeature/optional-feature-registry.mjs';

export const SYSTEM = 'projectfu';

export const FU = {};

/**
 * The set of Ability Scores used within the system.
 * @typedef {"dex", "ins", "mig", "wlp"} Attribute
 */
/**
 * @type {Object<Attribute, string>}
 */
FU.attributes = {
	dex: 'FU.AttributeDex',
	ins: 'FU.AttributeIns',
	mig: 'FU.AttributeMig',
	wlp: 'FU.AttributeWlp',
};

/**
 * @type {Object<Attribute, string>}
 */
FU.attributeAbbreviations = {
	dex: 'FU.AttributeDexAbbr',
	ins: 'FU.AttributeInsAbbr',
	mig: 'FU.AttributeMigAbbr',
	wlp: 'FU.AttributeWlpAbbr',
};

FU.currencies = {
	zenit: {
		label: 'FU.Zenit',
		abbreviation: 'FU.ZenitAbbr',
		conversion: 1,
	},
};

/**
 * @typedef {"untyped" | "physical" | "air" | "bolt" | "dark" | "earth" | "fire" | "ice" | "light" | "poison"} DamageType
 */
/**
 * @type {Object<DamageType, string>}
 */
FU.damageTypes = {
	physical: 'FU.DamagePhysical',
	air: 'FU.DamageAir',
	bolt: 'FU.DamageBolt',
	dark: 'FU.DamageDark',
	earth: 'FU.DamageEarth',
	fire: 'FU.DamageFire',
	ice: 'FU.DamageIce',
	light: 'FU.DamageLight',
	poison: 'FU.DamagePoison',
	untyped: 'FU.DamageNone',
};

/**
 * @typedef {"physical","air","bolt","dark","earth","fire","ice","light","poison"} AffIcon
 */
/**
 * @type {Object<DamageType, string>}
 */
FU.affIcon = {
	physical: 'fua fu-phys',
	air: 'fua fu-wind',
	bolt: 'fua fu-bolt',
	dark: 'fua fu-dark',
	earth: 'fua fu-earth',
	fire: 'fua fu-fire',
	ice: 'fua fu-ice',
	light: 'fua fu-light',
	poison: 'fua fu-poison',
};

FU.allIcon = {
	offensive: 'is-offensive',
	martial: 'is-martial',
	melee: 'is-melee',
	range: 'is-range',
	spell: 'is-spell',
	skill: 'is-skill',
	twoweapon: 'is-two-weapon',
	header: 'is-header',
	diamond: 'is-diamond',
	club: 'is-club',
	heart: 'is-heart',
	spade: 'is-spade',
	physical: 'fua fu-phys',
	air: 'fua fu-wind',
	bolt: 'fua fu-bolt',
	dark: 'fua fu-dark',
	earth: 'fua fu-earth',
	fire: 'fua fu-fire',
	ice: 'fua fu-ice',
	light: 'fua fu-light',
	poison: 'fua fu-poison',
	weaponEnchant: 'fu-weapon-enchant',
};

FU.affType = {
	'-1': 'FU.AffinityVulnerable',
	0: 'FU.AffinityNormal',
	1: 'FU.AffinityResistance',
	2: 'FU.AffinityImmune',
	3: 'FU.AffinityAbsorption',
};

FU.affTypeAbbr = {
	'-1': 'FU.AffinityVulnerableAbbr',
	0: 'FU.AffinityNormalAbbr',
	1: 'FU.AffinityResistanceAbbr',
	2: 'FU.AffinityImmuneAbbr',
	3: 'FU.AffinityAbsorptionAbbr',
};

FU.affValue = {
	vulnerability: -1,
	none: 0,
	resistance: 1,
	immunity: 2,
	absorption: 3,
};

FU.species = {
	beast: 'FU.Beast',
	construct: 'FU.Construct',
	demon: 'FU.Demon',
	elemental: 'FU.Elemental',
	humanoid: 'FU.Humanoid',
	monster: 'FU.Monster',
	plant: 'FU.Plant',
	undead: 'FU.Undead',
	custom: 'FU.Custom',
};

FU.companionSpecies = {
	beast: 'FU.Beast',
	construct: 'FU.Construct',
	elemental: 'FU.Elemental',
	plant: 'FU.Plant',
	custom: 'FU.Custom',
};

FU.villainTypes = {
	minor: 'FU.VillainMinor',
	major: 'FU.VillainMajor',
	supreme: 'FU.VillainSupreme',
};

FU.speciesRule = {
	beast: 'FU.BeastRule',
	construct: 'FU.ConstructRule',
	demon: 'FU.DemonRule',
	elemental: 'FU.ElementalRule',
	humanoid: 'FU.HumanoidRule',
	monster: 'FU.MonsterRule',
	plant: 'FU.PlantRule',
	undead: 'FU.UndeadRule',
	custom: 'FU.CustomRule',
};

FU.itemTypes = {
	basic: 'TYPES.Item.basic',
	weapon: 'TYPES.Item.weapon',
	shield: 'TYPES.Item.shield',
	armor: 'TYPES.Item.armor',
	accessory: 'TYPES.Item.accessory',
	consumable: 'TYPES.Item.consumable',
	treasure: 'TYPES.Item.treasure',
	class: 'TYPES.Item.class',
	classFeature: 'TYPES.Item.classFeature',
	optionalFeature: 'TYPES.Item.optionalFeature',
	skill: 'TYPES.Item.skill',
	heroic: 'TYPES.Item.heroic',
	spell: 'TYPES.Item.spell',
	miscAbility: 'TYPES.Item.miscAbility',
	rule: 'TYPES.Item.rule',
	behavior: 'TYPES.Item.behavior',
	ritual: 'TYPES.Item.ritual',
	project: 'TYPES.Item.project',
	zeroPower: 'TYPES.Item.zeroPower',
	effect: 'TYPES.Item.effect',
};

FU.actionTypes = {
	attack: 'FU.Attack',
	equipment: 'FU.Equipment',
	guard: 'FU.Guard',
	hinder: 'FU.Hinder',
	inventory: 'FU.Inventory',
	objective: 'FU.Objective',
	spell: 'FU.Spell',
	study: 'FU.Study',
	skill: 'FU.Skill',
};

FU.actionRule = {
	attack: 'FU.AttackRule',
	equipment: 'FU.EquipmentRule',
	guard: 'FU.GuardRule',
	hinder: 'FU.HinderRule',
	inventory: 'FU.InventoryRule',
	objective: 'FU.ObjectiveRule',
	spell: 'FU.SpellRule',
	study: 'FU.StudyRule',
	skill: 'FU.SkillRule',
};

FU.temporaryEffects = {
	slow: 'FU.Slow',
	dazed: 'FU.Dazed',
	weak: 'FU.Weak',
	shaken: 'FU.Shaken',
	enraged: 'FU.Enraged',
	poisoned: 'FU.Poisoned',
};

FU.statusEffects = {
	aura: 'FU.Aura',
	barrier: 'FU.Barrier',
	crisis: 'FU.Crisis',
	cover: 'FU.Cover',
	flying: 'FU.Flying',
	guard: 'FU.Guard',
	provoked: 'FU.Provoked',
	slow: 'FU.Slow',
	dazed: 'FU.Dazed',
	weak: 'FU.Weak',
	shaken: 'FU.Shaken',
	enraged: 'FU.Enraged',
	poisoned: 'FU.Poisoned',
	'wlp-down': 'FU.WLPDown',
	'wlp-up': 'FU.WLPUp',
	'dex-down': 'FU.DEXDown',
	'dex-up': 'FU.DEXUp',
	'ins-down': 'FU.INSDown',
	'ins-up': 'FU.INSUp',
	'mig-down': 'FU.MIGDown',
	'mig-up': 'FU.MIGUp',
};

FU.statusEffectRule = {
	aura: 'FU.Aura',
	barrier: 'FU.Barrier',
	crisis: 'FU.CrisisRule',
	cover: 'FU.CoverRule',
	flying: 'FU.FlyingRule',
	guard: 'FU.GuardRule',
	provoked: 'FU.Provoked',
	slow: 'FU.SlowRule',
	dazed: 'FU.DazedRule',
	weak: 'FU.WeakRule',
	shaken: 'FU.ShakenRule',
	enraged: 'FU.EnragedRule',
	poisoned: 'FU.PoisonedRule',
	'wlp-down': 'FU.WLPDownRule',
	'wlp-up': 'FU.WLPUpRule',
	'dex-down': 'FU.DEXDownRule',
	'dex-up': 'FU.DEXUpRule',
	'ins-down': 'FU.INSDownRule',
	'ins-up': 'FU.INSUpRule',
	'mig-down': 'FU.MIGDownRule',
	'mig-up': 'FU.MIGUpRule',
};

/**
 * @typedef {"arcane", "bow", "brawling", "dagger", "firearm", "flail", "heavy", "spear", "sword", "thrown", "custom"} WeaponCategory
 */
/**
 * @type {Object.<WeaponCategory, string>}
 */
FU.weaponCategories = {
	arcane: 'FU.Arcane',
	bow: 'FU.Bow',
	brawling: 'FU.Brawling',
	dagger: 'FU.Dagger',
	firearm: 'FU.Firearm',
	flail: 'FU.Flail',
	heavy: 'FU.Heavy',
	spear: 'FU.Spear',
	sword: 'FU.Sword',
	thrown: 'FU.Thrown',
	custom: 'FU.Custom',
};

/**
 * @typedef {"custom", "arcana", "deck", "dance", "gift", "magiseed", "invention", "invocation", "therioform", "symbol", "infusion", "quirk", "other"} MiscCategory
 */
/**
 * @type {Object.<MiscCategory, string>}
 */
FU.miscCategories = {
	other: 'FU.Other',
	quirk: 'FU.Quirk',
};

/**
 * @typedef {"arcane", "bow", "brawling", "dagger", "firearm", "flail", "heavy", "spear", "sword", "thrown"} weaponCategoriesWithoutCustom
 */
/**
 * @type {Object.<weaponCategoriesWithoutCustom, string>}
 */
FU.weaponCategoriesWithoutCustom = {
	arcane: 'FU.Arcane',
	bow: 'FU.Bow',
	brawling: 'FU.Brawling',
	dagger: 'FU.Dagger',
	firearm: 'FU.Firearm',
	flail: 'FU.Flail',
	heavy: 'FU.Heavy',
	spear: 'FU.Spear',
	sword: 'FU.Sword',
	thrown: 'FU.Thrown',
};

/**
 * @typedef {"skill", "style"} HeroicType
 */
/**
 * @type {Object.<HeroicType, string>}
 */
FU.heroicType = {
	skill: 'FU.Heroic',
	style: 'FU.HeroicStyle',
};

/**
 * @typedef {"potion", "utility"} ConsumableType
 */
/**
 * @type {Object.<ConsumableType, string>}
 */
FU.consumableType = {
	potion: 'FU.Potion',
	utility: 'FU.Utility',
};

/**
 * @typedef {"treasure", "material", "artifact"} TreasureType
 */
/**
 * @type {Object.<TreasureType, string>}
 */
FU.treasureType = {
	treasure: 'FU.Treasure',
	material: 'FU.Material',
	artifact: 'FU.Artifact',
};

/**
 * @typedef {"melee", "ranged"} WeaponType
 */
/**
 * @type {Object.<WeaponType, string>}
 */
FU.weaponTypes = {
	melee: 'FU.Melee',
	ranged: 'FU.Ranged',
};

/**
 * @typedef {"def", "mdef"} Defense
 */
/**
 * @type {Object.<Defense, Object.<"name"|"abbr", string>>}
 */
FU.defenses = {
	def: {
		name: 'FU.Defense',
		abbr: 'FU.DefenseAbbr',
	},
	mdef: {
		name: 'FU.MagicDefense',
		abbr: 'FU.MagicDefenseAbbr',
	},
};

/**
 * @typedef {"one-handed", "two-handed"} Handedness
 */
/**
 * @type {Object.<Handedness, string>}
 */
FU.handedness = {
	'one-handed': 'FU.OneHanded',
	'two-handed': 'FU.TwoHanded',
};

FU.classFeatureRegistry = new ClassFeatureRegistry();
FU.optionalFeatureRegistry = new OptionalFeatureRegistry();

FU.resources = {
	hp: 'FU.HealthPoints',
	mp: 'FU.MindPoints',
	ip: 'FU.InventoryPoints',
	fp: 'FU.FabulaPoints',
	exp: 'FU.Exp',
	zenit: 'FU.Zenit',
};

FU.resourcesAbbr = {
	hp: 'FU.HealthAbbr',
	mp: 'FU.MindAbbr',
	ip: 'FU.InventoryAbbr',
	fp: 'FU.FabulaAbbr',
	exp: 'FU.ExpAbbr',
	zenit: 'FU.Zenit',
};

FU.resourceIcons = {
	hp: 'fas fa-heart',
	mp: 'fas fa-hat-wizard',
	ip: 'ra ra-gear-hammer',
	fp: 'fas fa-pen-fancy',
	exp: 'fas fa-feather-pointed',
};

FU.combatHudResources = foundry.utils.mergeObject(FU.resources, {
	zeropower: 'ITEM.TypeZeroPower',
	none: 'FU.None',
});

/**
 * @typedef {"attribute", "accuracy", "magic", "open", "opposed", "group", "support", "initiative", "display"} CheckType
 */
/**
 * @type {Object<CheckType, string>}
 */
FU.checkTypes = {
	accuracy: 'FU.AccuracyCheck',
	attribute: 'FU.AttributeCheck',
	group: 'FU.GroupCheck',
	magic: 'FU.MagicCheck',
	open: 'FU.OpenCheck',
	opposed: 'FU.OpposedCheck',
	support: 'FU.SupportCheck',
	initiative: 'FU.InitiativeCheck',
	display: 'FU.DisplayItem',
};

FU.classFeatures = {};

FU.studyRoll = {
	core: [10, 13, 16],
	revised: [7, 10, 13],
};

FU.attributeDice = {
	6: 'FU.D6',
	8: 'FU.D8',
	10: 'FU.D10',
	12: 'FU.D12',
};

FU.bonds = {
	admInf: {
		Admiration: 'FU.Admiration',
		Inferiority: 'FU.Inferiority',
	},
	loyMis: {
		Loyalty: 'FU.Loyalty',
		Mistrust: 'FU.Mistrust',
	},
	affHat: {
		Affection: 'FU.Affection',
		Hatred: 'FU.Hatred',
	},
};

FU.potency = {
	minor: 'FU.PotencyMinor',
	medium: 'FU.PotencyMedium',
	major: 'FU.PotencyMajor',
	extreme: 'FU.PotencyExtreme',
};

FU.area = {
	individual: 'FU.AreaIndividual',
	small: 'FU.AreaSmall',
	large: 'FU.AreaLarge',
	huge: 'FU.AreaHuge',
};

FU.uses = {
	consumable: 'FU.Consumable',
	permanent: 'FU.Permanent',
};

FU.improvisedEffect = {
	minor: 'FU.ImprovisedEffectMinor',
	heavy: 'FU.ImprovisedEffectHeavy',
	massive: 'FU.ImprovisedEffectMassive',
};

FU.duration = {
	instantaneous: 'FU.Instantaneous',
	scene: 'FU.Scene',
	special: 'FU.Special',
};

FU.target = {
	self: 'FU.Self',
	oneCreature: 'FU.OneCreature',
	twoCreature: 'FU.TwoCreatures',
	threeCreature: 'FU.ThreeCreatures',
	fourCreature: 'FU.FourCreatures',
	fiveCreature: 'FU.FiveCreatures',
	oneWeapon: 'FU.OneWeapon',
};

FU.combatHudThemes = {
	'fu-default': 'FU.CombatHudDefault',
	'fu-modern': 'FU.CombatHudModern',
	'fu-mother': 'FU.CombatHudMother',
};

FU.combatHudThemeTemplates = {
	'fu-default': 'combat-hud-default',
	'fu-modern': 'combat-hud-modern',
	'fu-mother': 'combat-hud-mother',
};

FU.rank = {
	soldier: 'FU.Soldier',
	elite: 'FU.Elite',
	champion: 'FU.Champion',
	companion: 'FU.Companion',
};

/**
 * @typedef {"custom", "brute", "hunter", "mage", "saboteur", "sentinel", "support"} RoleType
 */

/**
 * @type {Object<RoleType, string>}
 */
FU.role = {
	custom: 'FU.Custom',
	brute: 'FU.Brute',
	hunter: 'FU.Hunter',
	mage: 'FU.Mage',
	saboteur: 'FU.Saboteur',
	sentinel: 'FU.Sentinel',
	support: 'FU.Support',
};

/**
 * @typedef {"easy", "normal", "hard", "veryHard" } DifficultyLevel
 */

/**
 * @type {Object<DifficultyLevel, string>}
 */
FU.difficultyLevel = {
	easy: 'FU.Easy',
	normal: 'FU.Normal',
	hard: 'FU.Hard',
	veryHard: 'FU.VeryHard',
};

/**
 * @typedef {"self", "single", "multiple", "weapon", "special"} TargetingRule
 */
FU.targetingRules = {
	self: 'FU.Self',
	single: 'FU.Single',
	multiple: 'FU.Multiple',
	weapon: `FU.Weapon`,
	special: `FU.Special`,
};
