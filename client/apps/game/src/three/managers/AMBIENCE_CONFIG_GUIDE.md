# Ambience System Configuration Guide

## Overview

The ambience system manages environmental and time-of-day sounds that play automatically based on the game's cycle
progress and weather state. It supports **multiple sound variations** and two playback modes: **continuous looping** and
**random intervals**.

## Key Features

✅ **Sound Variations** - Define arrays of sounds that are randomly selected ✅ **Two Playback Modes** - Loop
continuously or play at random intervals ✅ **Time-of-Day Aware** - Sounds activate based on cycle progress ✅
**Weather-Dependent** - Different sounds for different weather ✅ **Smooth Fading** - Gradual fade in/out transitions

## Architecture

```
AmbienceManager
├── Monitors: cycleProgress (0-100), weather state
├── Manages: Sound layer activation/deactivation
└── Uses: AudioManager (robust audio playback system)
```

## Adding New Ambient Sounds

### Step 1: Add Sound Files

Place your sound files in `/public/sound/ambient/` directory:

- `birds_morning.mp3`
- `crickets_night.mp3`
- `wolves_night.mp3`
- `rain_light.mp3`
- etc.

### Step 2: Register Sounds in Audio Registry

Edit `/src/audio/config/registry.ts`:

**For a single sound:**

```typescript
"ambient.your_sound_name": {
  id: "ambient.your_sound_name",
  url: "/sound/ambient/your_sound_file.mp3",
  category: AudioCategory.AMBIENT,  // or ENVIRONMENT for weather sounds
  priority: 5,                       // 1-10, higher = loads first
  poolSize: 1,                       // Number of concurrent instances
  spatial: false,                    // true for 3D positional audio
  loop: true,                        // true for continuous, false for one-shot
  volume: 0.4,                       // Base volume (0-1)
},
```

**For multiple variations:**

```typescript
// Register each variation separately
"ambient.birds.morning.1": {
  id: "ambient.birds.morning.1",
  url: "/sound/ambient/birds_morning_1.mp3",
  category: AudioCategory.AMBIENT,
  priority: 5,
  poolSize: 1,
  spatial: false,
  loop: true,
  volume: 0.4,
},
"ambient.birds.morning.2": {
  id: "ambient.birds.morning.2",
  url: "/sound/ambient/birds_morning_2.mp3",
  category: AudioCategory.AMBIENT,
  priority: 5,
  poolSize: 1,
  spatial: false,
  loop: true,
  volume: 0.4,
},
// ... more variations
```

### Step 3: Configure Sound Layer in AmbienceManager

Edit `/src/three/managers/ambience-manager.ts`, add to the `soundLayers` array:

**Single sound (loop mode):**

```typescript
{
  assetId: "ambient.your_sound_name",
  timeOfDay: [TimeOfDay.DAY, TimeOfDay.DUSK],
  weather: [WeatherType.CLEAR],  // Optional
  baseVolume: 0.4,
  fadeInDuration: 5.0,
  fadeOutDuration: 5.0,
  playbackMode: "loop",  // Plays continuously
},
```

**Multiple variations (loop mode):**

```typescript
{
  assetId: [
    "ambient.birds.morning.1",
    "ambient.birds.morning.2",
    "ambient.birds.morning.3",
  ],
  timeOfDay: [TimeOfDay.DAWN, TimeOfDay.DAY],
  weather: [WeatherType.CLEAR],
  baseVolume: 0.4,
  fadeInDuration: 5.0,
  fadeOutDuration: 5.0,
  playbackMode: "loop",  // One random variation loops
},
```

**Random intervals (one-shot sounds):**

```typescript
{
  assetId: [
    "ambient.wolves.night.1",
    "ambient.wolves.night.2",
    "ambient.wolves.night.3",
  ],
  timeOfDay: [TimeOfDay.NIGHT],
  weather: [WeatherType.CLEAR],
  baseVolume: 0.3,
  fadeInDuration: 1.0,
  fadeOutDuration: 1.0,
  playbackMode: "random_interval",  // Plays at random times
  minInterval: 15,  // Min seconds between plays
  maxInterval: 45,  // Max seconds between plays
},
```

## Time of Day Periods

Based on `cycleProgress` (0-100):

- **NIGHT**: 0-12.5, 87.5-100
- **DAWN**: 12.5-25
- **DAY**: 25-62.5
- **DUSK**: 62.5-75
- **EVENING**: 75-87.5

## Weather Types

- **CLEAR**: No weather
- **RAIN**: Light rain
- **STORM**: Heavy rain + thunder

## Playback Modes

### Loop Mode (`playbackMode: "loop"`)

- Plays sound continuously
- When multiple variations provided, picks one randomly at start
- Best for: ambient background sounds (wind, rain, crickets)
- Sound must have `loop: true` in registry

### Random Interval Mode (`playbackMode: "random_interval"`)

- Plays sound at random intervals
- Each play randomly selects from variations
- Define `minInterval` and `maxInterval` in seconds
- Best for: occasional sounds (wolves, dogs, thunder)
- Sound must have `loop: false` in registry

## Sound Layer Configuration Examples

### Example 1: Birds chirping with variations (loop mode)

```typescript
{
  assetId: [
    "ambient.birds.morning.1",
    "ambient.birds.morning.2",
    "ambient.birds.morning.3",
  ],
  timeOfDay: [TimeOfDay.DAWN, TimeOfDay.DAY],
  weather: [WeatherType.CLEAR],
  baseVolume: 0.4,
  fadeInDuration: 5.0,
  fadeOutDuration: 5.0,
  playbackMode: "loop",
},
```

### Example 2: Wolves howling with variations (random interval mode)

```typescript
{
  assetId: [
    "ambient.wolves.night.1",
    "ambient.wolves.night.2",
    "ambient.wolves.night.3",
  ],
  timeOfDay: [TimeOfDay.NIGHT],
  weather: [WeatherType.CLEAR],
  baseVolume: 0.3,
  fadeInDuration: 1.0,
  fadeOutDuration: 1.0,
  playbackMode: "random_interval",
  minInterval: 15,  // 15-45 seconds between howls
  maxInterval: 45,
},
```

### Example 2b: Dogs barking (random interval mode)

```typescript
{
  assetId: [
    "ambient.dog.bark.1",
    "ambient.dog.bark.2",
    "ambient.dog.bark.3",
    "ambient.dog.bark.4",
  ],
  timeOfDay: [TimeOfDay.EVENING, TimeOfDay.NIGHT],
  weather: [WeatherType.CLEAR],
  baseVolume: 0.25,
  fadeInDuration: 1.0,
  fadeOutDuration: 1.0,
  playbackMode: "random_interval",
  minInterval: 20,  // 20-60 seconds between barks
  maxInterval: 60,
},
```

### Example 3: Rain sound (all times, only during rain weather)

```typescript
{
  assetId: "ambient.rain.light",
  timeOfDay: [TimeOfDay.DAWN, TimeOfDay.DAY, TimeOfDay.DUSK, TimeOfDay.EVENING, TimeOfDay.NIGHT],
  weather: [WeatherType.RAIN],  // Only when weather is rain
  baseVolume: 0.5,
  fadeInDuration: 3.0,
  fadeOutDuration: 3.0,
},
```

### Example 4: Wind (day only, all weather)

```typescript
{
  assetId: "ambient.wind.day",
  timeOfDay: [TimeOfDay.DAY],
  baseVolume: 0.25,
  fadeInDuration: 4.0,
  fadeOutDuration: 4.0,
},
```

## Current Sound Layers (Pre-configured)

### Time-Based Sounds:

- **Birds chirping** - 3 variations, loop mode, Dawn + Day (clear)
- **Crickets** - 2 variations, loop mode, Night + Evening (clear)
- **Wolves howling** - 3 variations, random interval (15-45s), Night (clear)
- **Dogs barking** - 4 variations, random interval (20-60s), Evening + Night (clear)
- **Wind** - 2 variations, loop mode, Day (all weather)

### Weather-Based Sounds:

- **Light rain** - Single sound, loop mode, All times (rain)
- **Heavy rain** - Single sound, loop mode, All times (storm)
- **Distant thunder** - 3 variations, random interval (5-20s), All times (storm)

## Volume Control

The final volume is calculated as:

```
finalVolume = baseVolume × masterVolume × categoryVolume
```

Where:

- `baseVolume` - Set in sound layer config (0-1)
- `masterVolume` - AmbienceManager master volume (0-1)
- `categoryVolume` - AudioManager category volume (AMBIENT or ENVIRONMENT)

## Fading Behavior

- **Fade In**: When conditions match, sound fades from 0 → baseVolume over `fadeInDuration`
- **Fade Out**: When conditions no longer match, sound fades from current → 0 over `fadeOutDuration`
- Smooth transitions prevent abrupt starts/stops

## GUI Controls

The ambience system has GUI controls in the "Ambience System" folder:

- **Enable Ambience** - Toggle system on/off
- **Master Volume** - Overall ambience volume
- **Debug Info** - Shows current time of day, weather, active sounds

## Testing

1. Open GUI (default: press `G`)
2. Navigate to "Ambience System" folder
3. Use "Day/Night Cycle" folder to manually adjust time
4. Use "Weather System" folder to change weather
5. Observe sounds starting/stopping based on conditions

## Common Issues

### Sound not playing?

- Check sound file exists in `/public/sound/ambient/`
- Verify asset is registered in `audio/config/registry.ts`
- Ensure sound layer is configured in `AmbienceManager.soundLayers`
- Check time of day and weather conditions match

### Volume too loud/quiet?

- Adjust `baseVolume` in sound layer config
- Check "Ambience System" → "Master Volume" in GUI
- Check AudioManager category volumes (Settings)

### Abrupt transitions?

- Increase `fadeInDuration` and `fadeOutDuration`
- Default recommendation: 3-5 seconds for smooth transitions

## Performance Considerations

- **Pool Size**: Set to 1 for most ambient sounds (only need one instance)
- **Loop**: Always `true` for ambient sounds
- **Priority**: Set 4-6 (ambient sounds don't need high priority)
- **Spatial Audio**: Set `false` for ambient sounds (they're environmental, not positional)

## Advanced: Dynamic Volume Changes

To make sounds louder/quieter based on conditions, create multiple variations:

```typescript
// Quiet wind during day
{
  assetId: "ambient.wind.day.quiet",
  timeOfDay: [TimeOfDay.DAY],
  weather: [WeatherType.CLEAR],
  baseVolume: 0.2,
  fadeInDuration: 4.0,
  fadeOutDuration: 4.0,
},

// Strong wind during storm
{
  assetId: "ambient.wind.day.strong",
  timeOfDay: [TimeOfDay.DAY],
  weather: [WeatherType.STORM],
  baseVolume: 0.6,
  fadeInDuration: 2.0,
  fadeOutDuration: 3.0,
},
```

## How Variations Work

When you provide an **array of assetIds**:

- **Loop mode**: System picks one random variation when the layer activates, loops it continuously
- **Random interval mode**: Each time the sound plays, system randomly picks from all variations

This creates **natural variety** - you won't hear the same bird chirp or wolf howl repeatedly!

## File Naming Convention

For clarity, name your variations with numbers:

```
birds_morning_1.mp3
birds_morning_2.mp3
birds_morning_3.mp3

wolves_night_1.mp3
wolves_night_2.mp3
wolves_night_3.mp3
```

## Summary

To add a new ambient sound:

1. ✅ Add sound file(s) to `/public/sound/ambient/`
2. ✅ Register each variation in `audio/config/registry.ts`
3. ✅ Add layer config in `AmbienceManager.soundLayers` with array of IDs
4. ✅ Choose playback mode (`loop` or `random_interval`)
5. ✅ Test with GUI controls

The system handles:

- Random variation selection ✓
- Smooth fade in/out ✓
- Time-based activation ✓
- Weather filtering ✓
- Random interval scheduling ✓
