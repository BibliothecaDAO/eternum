# Eternum ship direction

User-approved brief, September 2026:

- All T1, T2, and T3 ships have the same overall gameplay size and occupy one hex, including turning and sailing motion.
- T1 is simple, T2 sophisticated, T3 glorious. Progression must change the visual design, not just add more equipment to
  the same hull.
- Warcraft 3 Battleships references establish broad, solid curved hulls, integrated bows, full rounded sails, two large
  uninterrupted sails on T3 (one per mast; the user replaced the initial stacked-sail concept), and bold heraldry that
  reads from an RTS camera.
- Match the real biome assets' visual quality. Review on real water and biomes in the Model Lab.
- Preserve player-specific sail colors and custom prints, with army-type markings for Knight, Crossbowman, and Paladin.
- Animate sailing and wind-filled sails. Boarding and unloading animations were explicitly dropped.
- Cloth must remain attached to its rigging and clear the masts through the supported wind range; inspect the entire
  cycle.
- Establish one army family's tier concepts, choose the visual direction with the user, and prove one ship in-game
  before producing all nine variants.
- The project has Blender MCP and a reproducible fleet builder. Inspect their current state before relying on earlier
  implementation details.

- The user explicitly requires a fresh ship model from the approved concept. Do not reuse geometry or equipment from the
  earlier procedural fleet; preserve the runtime animation/customization contract. T2 Ironwind is the representative
  asset to validate before replacing other variants.

- The user approved the detailed T2 Knight rebuild and authorized extending it to all nine ships. Class-specific
  equipment is explicitly approved: Knight cannons, Crossbowman ballistae, Paladin sacred ornament. Maintain equal
  craftsmanship rather than identical equipment.
