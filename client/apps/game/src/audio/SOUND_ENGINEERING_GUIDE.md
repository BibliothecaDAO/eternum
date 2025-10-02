# Sound Engineering Guide for Eternum

## Audio Hierarchy & Mixing Philosophy

### 1. Volume Hierarchy (Importance)

```
Priority 1: UI Feedback (immediate user actions)
Priority 2: Combat/Events (gameplay critical)
Priority 3: Buildings/Resources (gameplay actions)
Priority 4: Music (background emotional layer)
Priority 5: Environment (weather, effects)
Priority 6: Ambient (subtle atmosphere)
```

### 2. Recommended Category Volumes

```typescript
categoryVolumes: {
  [AudioCategory.UI]: 0.8,          // High - needs to be heard
  [AudioCategory.COMBAT]: 0.7,      // High - important gameplay
  [AudioCategory.BUILDING]: 0.5,    // Medium - frequent, shouldn't dominate
  [AudioCategory.RESOURCE]: 0.5,    // Medium - frequent, shouldn't dominate
  [AudioCategory.MUSIC]: 0.4,       // Low - background layer
  [AudioCategory.ENVIRONMENT]: 0.45, // Low-Medium - weather effects
  [AudioCategory.AMBIENT]: 0.3,     // Very Low - subtle atmosphere
}
```

### 3. Individual Sound Volume Guidelines

**Individual volumes should be normalized to similar loudness:**

- **UI Sounds**: 0.5-0.6 (frequent feedback)
  - Clicks/hovers: 0.4-0.5 (very frequent)
  - Actions: 0.5-0.6 (frequent)
  - Events: 0.6-0.7 (occasional)

- **Building Sounds**: 0.5-0.6 (can be frequent)

- **Resource Sounds**: 0.5-0.6 (very frequent)

- **Combat Sounds**: 0.6-0.8 (important, occasional)

- **Music**: 1.0 (controlled by category volume)

- **Ambient**: 0.4-0.6 (very subtle, controlled by AmbienceManager)

### 4. Audio Ducking System

Implement ducking to automatically lower background layers when foreground sounds play:

```typescript
interface DuckingConfig {
  category: AudioCategory;
  duckCategories: AudioCategory[]; // Which categories to duck
  duckAmount: number; // 0-1, how much to reduce volume
  fadeTime: number; // seconds to fade down/up
}

const DUCKING_RULES: DuckingConfig[] = [
  {
    category: AudioCategory.UI,
    duckCategories: [AudioCategory.MUSIC, AudioCategory.AMBIENT],
    duckAmount: 0.7, // Reduce to 70% of current volume
    fadeTime: 0.1,
  },
  {
    category: AudioCategory.COMBAT,
    duckCategories: [AudioCategory.MUSIC, AudioCategory.AMBIENT, AudioCategory.ENVIRONMENT],
    duckAmount: 0.5, // Reduce to 50%
    fadeTime: 0.2,
  },
];
```

### 5. Spatial Audio Improvements

For spatial sounds (buildings, resources, combat):

- **Distance attenuation**: Max distance should vary by importance
  - UI: No spatial (always full volume)
  - Combat: 50 units
  - Building: 40 units
  - Resource: 35 units
  - Ambient: No spatial (global atmosphere)

### 6. Anti-Spam System

Prevent audio fatigue from repetitive actions:

```typescript
interface AntiSpamConfig {
  category: AudioCategory;
  maxConcurrent: number; // Max simultaneous sounds
  minInterval: number; // Min ms between same sound
  volumeReduction: number; // Reduce volume for rapid repeats
}

const ANTI_SPAM_RULES: AntiSpamConfig[] = [
  {
    category: AudioCategory.RESOURCE,
    maxConcurrent: 3,
    minInterval: 100,
    volumeReduction: 0.8, // Each rapid repeat plays at 80% of previous
  },
  {
    category: AudioCategory.BUILDING,
    maxConcurrent: 2,
    minInterval: 200,
    volumeReduction: 0.9,
  },
];
```

### 7. Dynamic Range Compression

Apply gentle compression to prevent jarring peaks:

- **Threshold**: -12dB
- **Ratio**: 3:1
- **Attack**: 5ms
- **Release**: 50ms

This keeps the mix cohesive without squashing dynamics.

### 8. Ambient Sound Design

Current implementation is good! Key principles:

- ✅ Random intervals prevent mechanical loops
- ✅ Low volume (0.125-0.3 base)
- ✅ Long intervals (25-225 seconds)
- ✅ Multiple variations for each sound type

**Improvements:**

- Add more variations per sound type (currently 1-3, aim for 4-6)
- Consider time-of-day intensity curves (birds louder at dawn, quieter at noon)
- Add seasonal variations

### 9. Music System

Current music volume (0.5 category × 1.0 individual = 0.5) is too high.

**Recommendations:**

- Reduce category to 0.4
- Implement dynamic music intensity based on gameplay state
- Duck music during important events
- Crossfade between tracks (500ms-1000ms)

### 10. Implementation Priority

**Phase 1** (Quick wins):

1. Rebalance category volumes (5 min)
2. Normalize individual sound volumes (30 min)
3. Reduce music volume (1 min)

**Phase 2** (Medium effort):

1. Implement basic ducking for UI sounds (2 hours)
2. Add anti-spam for resource collection (1 hour)
3. Adjust spatial audio distances (30 min)

**Phase 3** (Advanced):

1. Full ducking system for all categories (4 hours)
2. Dynamic range compression (6 hours)
3. Advanced anti-spam with volume reduction (3 hours)

## Testing Checklist

After implementing changes, test these scenarios:

- [ ] Rapid clicking doesn't create wall of noise
- [ ] Resource collection at multiple locations sounds clear
- [ ] Music doesn't overpower gameplay sounds
- [ ] Combat sounds are clearly audible during battles
- [ ] Ambient sounds are noticeable but not distracting
- [ ] UI feedback is immediate and clear
- [ ] Multiple buildings constructing simultaneously sounds balanced
- [ ] Day/night transitions feel smooth and natural

## Measurement Tools

Add these debug metrics to AudioManager:

```typescript
getAudioMetrics(): {
  peakLevel: number;        // Current peak in dB
  rmsLevel: number;         // RMS loudness
  activeByCategory: Map<AudioCategory, number>;
  duckingActive: boolean;
  clipping: boolean;        // Warn if clipping occurs
}
```

---

**Note**: The current system has a solid foundation. These improvements will make the audio feel more polished and
professional without requiring a complete rewrite.
