import { AudioAsset, AudioCategory } from '../types';

export const AUDIO_REGISTRY: Record<string, AudioAsset> = {
  // === UI SOUNDS ===
  'ui.click': {
    id: 'ui.click',
    url: '/sound/ui/click-2.wav',
    category: AudioCategory.UI,
    priority: 10,
    poolSize: 8,
    spatial: false,
    loop: false,
    volume: 0.7,
    variations: ['/sound/ui/click-2.wav', '/sound/ui/ui-click-1.wav']
  },
  'ui.hover': {
    id: 'ui.hover',
    url: '/sound/ui/ui-click-1.wav',
    category: AudioCategory.UI,
    priority: 9,
    poolSize: 4,
    spatial: false,
    loop: false,
    volume: 0.5
  },
  'ui.whoosh': {
    id: 'ui.whoosh',
    url: '/sound/ui/whoosh.mp3',
    category: AudioCategory.UI,
    priority: 7,
    poolSize: 3,
    spatial: false,
    loop: false,
    volume: 0.6
  },
  'ui.levelup': {
    id: 'ui.levelup',
    url: '/sound/ui/level-up.mp3',
    category: AudioCategory.UI,
    priority: 5,
    poolSize: 2,
    spatial: false,
    loop: false,
    volume: 0.8
  },
  'ui.explore': {
    id: 'ui.explore',
    url: '/sound/ui/explore.mp3',
    category: AudioCategory.UI,
    priority: 6,
    poolSize: 3,
    spatial: false,
    loop: false,
    volume: 0.7
  },
  'ui.sign': {
    id: 'ui.sign',
    url: '/sound/ui/sign.mp3',
    category: AudioCategory.UI,
    priority: 5,
    poolSize: 2,
    spatial: false,
    loop: false,
    volume: 0.6
  },
  'ui.summon': {
    id: 'ui.summon',
    url: '/sound/ui/summon.mp3',
    category: AudioCategory.UI,
    priority: 4,
    poolSize: 2,
    spatial: false,
    loop: false,
    volume: 0.8
  },
  'ui.shovel': {
    id: 'ui.shovel',
    url: '/sound/ui/shovel_1.mp3',
    category: AudioCategory.UI,
    priority: 8,
    poolSize: 4,
    spatial: false,
    loop: false,
    volume: 0.5,
    variations: ['/sound/ui/shovel_1.mp3', '/sound/ui/shovel_2.mp3']
  },

  // === BUILDING SOUNDS ===
  'building.construct.castle': {
    id: 'building.construct.castle',
    url: '/sound/buildings/castle.mp3',
    category: AudioCategory.BUILDING,
    priority: 6,
    poolSize: 3,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'building.construct.farm': {
    id: 'building.construct.farm',
    url: '/sound/buildings/farm.mp3',
    category: AudioCategory.BUILDING,
    priority: 6,
    poolSize: 3,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'building.construct.mine': {
    id: 'building.construct.mine',
    url: '/sound/buildings/mine.mp3',
    category: AudioCategory.BUILDING,
    priority: 6,
    poolSize: 3,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'building.construct.barracks': {
    id: 'building.construct.barracks',
    url: '/sound/buildings/barracks.mp3',
    category: AudioCategory.BUILDING,
    priority: 6,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'building.construct.archer_range': {
    id: 'building.construct.archer_range',
    url: '/sound/buildings/archer_range.mp3',
    category: AudioCategory.BUILDING,
    priority: 6,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'building.construct.mage_tower': {
    id: 'building.construct.mage_tower',
    url: '/sound/buildings/mage_tower.mp3',
    category: AudioCategory.BUILDING,
    priority: 6,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'building.construct.stables': {
    id: 'building.construct.stables',
    url: '/sound/buildings/stables.mp3',
    category: AudioCategory.BUILDING,
    priority: 6,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'building.construct.storehouse': {
    id: 'building.construct.storehouse',
    url: '/sound/buildings/storehouse.mp3',
    category: AudioCategory.BUILDING,
    priority: 6,
    poolSize: 3,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'building.construct.market': {
    id: 'building.construct.market',
    url: '/sound/buildings/market.mp3',
    category: AudioCategory.BUILDING,
    priority: 6,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'building.construct.fishing_village': {
    id: 'building.construct.fishing_village',
    url: '/sound/buildings/fishing_village.mp3',
    category: AudioCategory.BUILDING,
    priority: 6,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'building.construct.lumber_mill': {
    id: 'building.construct.lumber_mill',
    url: '/sound/buildings/lumber_mill.mp3',
    category: AudioCategory.BUILDING,
    priority: 6,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'building.construct.workhut': {
    id: 'building.construct.workhut',
    url: '/sound/buildings/workhut.mp3',
    category: AudioCategory.BUILDING,
    priority: 6,
    poolSize: 3,
    spatial: true,
    loop: false,
    volume: 0.7,
    variations: ['/sound/buildings/workhut.mp3', '/sound/buildings/workhuts.mp3']
  },
  'building.construct.military': {
    id: 'building.construct.military',
    url: '/sound/buildings/military.mp3',
    category: AudioCategory.BUILDING,
    priority: 6,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'building.construct.finish': {
    id: 'building.construct.finish',
    url: '/sound/buildings/construction_finish.mp3',
    category: AudioCategory.BUILDING,
    priority: 5,
    poolSize: 3,
    spatial: true,
    loop: false,
    volume: 0.8
  },
  'building.destroy.stone': {
    id: 'building.destroy.stone',
    url: '/sound/buildings/destroy_stone.mp3',
    category: AudioCategory.BUILDING,
    priority: 5,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.8
  },
  'building.destroy.wooden': {
    id: 'building.destroy.wooden',
    url: '/sound/buildings/destroy_wooden.mp3',
    category: AudioCategory.BUILDING,
    priority: 5,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.8
  },

  // === RESOURCE SOUNDS ===
  'resource.collect.wood': {
    id: 'resource.collect.wood',
    url: '/sound/resources/wood.mp3',
    category: AudioCategory.RESOURCE,
    priority: 8,
    poolSize: 4,
    spatial: true,
    loop: false,
    volume: 0.6
  },
  'resource.collect.stone': {
    id: 'resource.collect.stone',
    url: '/sound/resources/stone.mp3',
    category: AudioCategory.RESOURCE,
    priority: 8,
    poolSize: 4,
    spatial: true,
    loop: false,
    volume: 0.6
  },
  'resource.collect.coal': {
    id: 'resource.collect.coal',
    url: '/sound/resources/coal.mp3',
    category: AudioCategory.RESOURCE,
    priority: 7,
    poolSize: 3,
    spatial: true,
    loop: false,
    volume: 0.6
  },
  'resource.collect.copper': {
    id: 'resource.collect.copper',
    url: '/sound/resources/copper.mp3',
    category: AudioCategory.RESOURCE,
    priority: 7,
    poolSize: 3,
    spatial: true,
    loop: false,
    volume: 0.6
  },
  'resource.collect.gold': {
    id: 'resource.collect.gold',
    url: '/sound/resources/gold.mp3',
    category: AudioCategory.RESOURCE,
    priority: 7,
    poolSize: 3,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'resource.collect.silver': {
    id: 'resource.collect.silver',
    url: '/sound/resources/silver.mp3',
    category: AudioCategory.RESOURCE,
    priority: 7,
    poolSize: 3,
    spatial: true,
    loop: false,
    volume: 0.6
  },
  'resource.collect.wheat': {
    id: 'resource.collect.wheat',
    url: '/sound/resources/wheat.mp3',
    category: AudioCategory.RESOURCE,
    priority: 8,
    poolSize: 4,
    spatial: true,
    loop: false,
    volume: 0.6
  },
  'resource.collect.fish': {
    id: 'resource.collect.fish',
    url: '/sound/resources/fish.mp3',
    category: AudioCategory.RESOURCE,
    priority: 8,
    poolSize: 4,
    spatial: true,
    loop: false,
    volume: 0.6
  },
  'resource.collect.obsidian': {
    id: 'resource.collect.obsidian',
    url: '/sound/resources/obsidian.mp3',
    category: AudioCategory.RESOURCE,
    priority: 6,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.6
  },
  'resource.collect.ironwood': {
    id: 'resource.collect.ironwood',
    url: '/sound/resources/ironwood.mp3',
    category: AudioCategory.RESOURCE,
    priority: 6,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.6
  },
  'resource.collect.cold_iron': {
    id: 'resource.collect.cold_iron',
    url: '/sound/resources/cold_iron.mp3',
    category: AudioCategory.RESOURCE,
    priority: 5,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.6
  },
  'resource.collect.hartwood': {
    id: 'resource.collect.hartwood',
    url: '/sound/resources/hartwood.mp3',
    category: AudioCategory.RESOURCE,
    priority: 5,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.6
  },
  'resource.collect.diamonds': {
    id: 'resource.collect.diamonds',
    url: '/sound/resources/diamonds.mp3',
    category: AudioCategory.RESOURCE,
    priority: 4,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'resource.collect.sapphire': {
    id: 'resource.collect.sapphire',
    url: '/sound/resources/sapphire.mp3',
    category: AudioCategory.RESOURCE,
    priority: 4,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'resource.collect.ruby': {
    id: 'resource.collect.ruby',
    url: '/sound/resources/ruby.mp3',
    category: AudioCategory.RESOURCE,
    priority: 4,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'resource.collect.deep_crystal': {
    id: 'resource.collect.deep_crystal',
    url: '/sound/resources/deep_crystal.mp3',
    category: AudioCategory.RESOURCE,
    priority: 4,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'resource.collect.ignium': {
    id: 'resource.collect.ignium',
    url: '/sound/resources/ignium.mp3',
    category: AudioCategory.RESOURCE,
    priority: 4,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'resource.collect.ethereal_silica': {
    id: 'resource.collect.ethereal_silica',
    url: '/sound/resources/ethereal_silica.mp3',
    category: AudioCategory.RESOURCE,
    priority: 4,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'resource.collect.true_ice': {
    id: 'resource.collect.true_ice',
    url: '/sound/resources/true_ice.mp3',
    category: AudioCategory.RESOURCE,
    priority: 4,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'resource.collect.twilight_quartz': {
    id: 'resource.collect.twilight_quartz',
    url: '/sound/resources/twilight_quartz.mp3',
    category: AudioCategory.RESOURCE,
    priority: 4,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'resource.collect.alchemical_silver': {
    id: 'resource.collect.alchemical_silver',
    url: '/sound/resources/alchemical_silver.mp3',
    category: AudioCategory.RESOURCE,
    priority: 4,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'resource.collect.adamantine': {
    id: 'resource.collect.adamantine',
    url: '/sound/resources/adamantine.mp3',
    category: AudioCategory.RESOURCE,
    priority: 3,
    poolSize: 1,
    spatial: true,
    loop: false,
    volume: 0.8
  },
  'resource.collect.mithral': {
    id: 'resource.collect.mithral',
    url: '/sound/resources/mithral.mp3',
    category: AudioCategory.RESOURCE,
    priority: 3,
    poolSize: 1,
    spatial: true,
    loop: false,
    volume: 0.8
  },
  'resource.collect.dragonhide': {
    id: 'resource.collect.dragonhide',
    url: '/sound/resources/dragonhide.mp3',
    category: AudioCategory.RESOURCE,
    priority: 3,
    poolSize: 1,
    spatial: true,
    loop: false,
    volume: 0.8
  },
  'resource.collect.lords': {
    id: 'resource.collect.lords',
    url: '/sound/resources/lords.mp3',
    category: AudioCategory.RESOURCE,
    priority: 2,
    poolSize: 1,
    spatial: true,
    loop: false,
    volume: 0.9
  },
  'resource.burn_donkey': {
    id: 'resource.burn_donkey',
    url: '/sound/resources/burn_donkey.mp3',
    category: AudioCategory.RESOURCE,
    priority: 5,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.7
  },

  // === COMBAT & UNIT SOUNDS ===
  'combat.victory': {
    id: 'combat.victory',
    url: '/sound/events/battle_victory.mp3',
    category: AudioCategory.COMBAT,
    priority: 4,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.9
  },
  'combat.defeat': {
    id: 'combat.defeat',
    url: '/sound/events/battle_defeat.mp3',
    category: AudioCategory.COMBAT,
    priority: 4,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.9
  },
  'unit.march': {
    id: 'unit.march',
    url: '/sound/units/marching1.mp3',
    category: AudioCategory.COMBAT,
    priority: 7,
    poolSize: 4,
    spatial: true,
    loop: false,
    volume: 0.6,
    variations: ['/sound/units/marching1.mp3', '/sound/units/marching2.mp3']
  },
  'unit.running': {
    id: 'unit.running',
    url: '/sound/units/running.mp3',
    category: AudioCategory.COMBAT,
    priority: 7,
    poolSize: 4,
    spatial: true,
    loop: false,
    volume: 0.6,
    variations: ['/sound/units/running.mp3', '/sound/units/running_2.mp3']
  },
  'unit.selected': {
    id: 'unit.selected',
    url: '/sound/units/army_selected1.mp3',
    category: AudioCategory.COMBAT,
    priority: 8,
    poolSize: 4,
    spatial: true,
    loop: false,
    volume: 0.7,
    variations: ['/sound/units/army_selected1.mp3', '/sound/units/army_selected2.mp3', '/sound/units/army_selected3.mp3']
  },
  'unit.snap': {
    id: 'unit.snap',
    url: '/sound/units/snap_1.mp3',
    category: AudioCategory.COMBAT,
    priority: 6,
    poolSize: 3,
    spatial: true,
    loop: false,
    volume: 0.6
  },
  'unit.sword': {
    id: 'unit.sword',
    url: '/sound/units/sword_1.mp3',
    category: AudioCategory.COMBAT,
    priority: 6,
    poolSize: 3,
    spatial: true,
    loop: false,
    volume: 0.7
  },
  'unit.drum': {
    id: 'unit.drum',
    url: '/sound/units/subtle_drum_tap_1.mp3',
    category: AudioCategory.COMBAT,
    priority: 5,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.5
  },

  // === EVENT SOUNDS ===
  'event.gong': {
    id: 'event.gong',
    url: '/sound/events/gong.mp3',
    category: AudioCategory.UI,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: false,
    volume: 0.8
  },
  'event.blitz_gong': {
    id: 'event.blitz_gong',
    url: '/sound/events/blitz_gong.mp3',
    category: AudioCategory.UI,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: false,
    volume: 0.8
  },

  // === RELIC SOUNDS ===
  'relic.chest': {
    id: 'relic.chest',
    url: '/sound/relics/chest1.mp3',
    category: AudioCategory.UI,
    priority: 4,
    poolSize: 2,
    spatial: true,
    loop: false,
    volume: 0.8,
    variations: ['/sound/relics/chest1.mp3', '/sound/relics/chest2.mp3', '/sound/relics/chest3.mp3']
  },

  // === MUSIC TRACKS ===
  'music.blitz': {
    id: 'music.blitz',
    url: '/sound/music/minstrels/blitz.flac',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.order_of_anger': {
    id: 'music.order_of_anger',
    url: '/sound/music/minstrels/OrderOfAnger.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.order_of_rage': {
    id: 'music.order_of_rage',
    url: '/sound/music/minstrels/OrderOfRage.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.light_through_darkness': {
    id: 'music.light_through_darkness',
    url: '/sound/music/minstrels/LightThroughTheDarkness.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.daybreak': {
    id: 'music.daybreak',
    url: '/sound/music/DayBreak.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.morning_ember': {
    id: 'music.morning_ember',
    url: '/sound/music/MorningEmber.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.beyond_horizon': {
    id: 'music.beyond_horizon',
    url: '/sound/music/BeyondTheHorizon.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.celestial_shores': {
    id: 'music.celestial_shores',
    url: '/sound/music/CelestialShores.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.frostfall': {
    id: 'music.frostfall',
    url: '/sound/music/Frostfall.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.nomads_ballad': {
    id: 'music.nomads_ballad',
    url: '/sound/music/NomadsBallad.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.rain_pool': {
    id: 'music.rain_pool',
    url: '/sound/music/RainPool.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.shadow_song': {
    id: 'music.shadow_song',
    url: '/sound/music/ShadowSong.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.shining_realms': {
    id: 'music.shining_realms',
    url: '/sound/music/ShiningRealms.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.strangers_arrival': {
    id: 'music.strangers_arrival',
    url: '/sound/music/StrangersArrival.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.twilight_harvest': {
    id: 'music.twilight_harvest',
    url: '/sound/music/TwilightHarvest.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.wanderers_chronicle': {
    id: 'music.wanderers_chronicle',
    url: '/sound/music/WanderersChronicle.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  },
  'music.happy_realm': {
    id: 'music.happy_realm',
    url: '/sound/music/happy_realm.mp3',
    category: AudioCategory.MUSIC,
    priority: 3,
    poolSize: 1,
    spatial: false,
    loop: true,
    volume: 1.0
  }
};

export function getAudioAsset(id: string): AudioAsset | undefined {
  return AUDIO_REGISTRY[id];
}

export function getAssetsByCategory(category: AudioCategory): AudioAsset[] {
  return Object.values(AUDIO_REGISTRY).filter(asset => asset.category === category);
}

export function getAllAssets(): AudioAsset[] {
  return Object.values(AUDIO_REGISTRY);
}