# ThreeJS Memory Optimization Roadmap

Based on analysis of the Eternum ThreeJS client codebase, this document outlines memory optimization opportunities ranked by implementation difficulty and potential impact.

## Quick Reference: Lowest Hanging Fruit

| Priority | Optimization | Effort | Impact | Risk |
|----------|-------------|--------|---------|------|
| 🟢 P1 | Material Sharing | 1-2h | High | Low |
| 🟢 P1 | Hex Geometry Sharing | 1-2h | High | Low |
| 🟢 P1 | Update Frequency Optimization | 1-2h | Medium | Low |
| 🟢 P1 | CSS2D Label Pooling | 2h | Medium | Low |

---

## 🟢 Immediate Wins (1-2 hours each)

### 1. Material Sharing
**Impact: High | Risk: Low | Effort: 1-2h**

- **Problem**: Army/structure materials are likely recreated for each instance
- **Solution**: Create shared materials and reuse them across similar objects
- **Implementation**: 
  - Create MaterialPool class
  - Share materials between armies of same type
  - Use material.clone() only when necessary for unique properties
- **Expected Reduction**: 15-25% material memory usage

### 2. Geometry Sharing for Hexes
**Impact: High | Risk: Low | Effort: 1-2h**

- **Problem**: Each hex probably creates its own geometry instance
- **Solution**: One shared hex geometry for all instances
- **Implementation**: 
  - Create single HexGeometry instance
  - Reuse across all hex meshes
  - Use instanced rendering if not already implemented
- **Expected Reduction**: ~90% hex geometry memory usage

### 3. Update Frequency Optimization
**Impact: Medium | Risk: Low | Effort: 1-2h**

- **Problem**: All armies update every frame regardless of distance/visibility
- **Solution**: Update distant armies less frequently
- **Implementation**: 
  - Add distance-based update intervals
  - Skip updates for off-screen armies
  - Already have distance/visibility logic to build on
- **Expected Reduction**: 10-20% CPU usage, indirect memory benefits

### 4. CSS2D Label Pooling
**Impact: Medium | Risk: Low | Effort: 2h**

- **Problem**: Labels created/destroyed during army movement cause GC pressure
- **Solution**: Object pool pattern for CSS2D labels
- **Implementation**: 
  - Create LabelPool class
  - Reuse label DOM elements
  - Reset content instead of creating new labels
- **Expected Reduction**: Eliminate label-related memory spikes

---

## 🟡 Quick Wins (3-6 hours each)

### 5. Animation Pausing for Off-screen Objects
**Impact: Medium | Risk: Low | Effort: 3-4h**

- **Problem**: Animations run for all objects regardless of visibility
- **Solution**: Pause animations for culled objects
- **Implementation**: Build on existing frustum culling
- **Expected Reduction**: 15-30% animation memory/CPU usage

### 6. Buffer Management (TypedArrays)
**Impact: Medium | Risk: Low | Effort: 3-4h**

- **Problem**: Matrix calculations create new TypedArrays frequently
- **Solution**: Pool and reuse Float32Arrays
- **Implementation**: Reuse existing arrays in ArmyModel, managers
- **Expected Reduction**: Reduce GC pressure, smoother performance

### 7. Distance-Based Culling Enhancement
**Impact: Medium | Risk: Low | Effort: 4-6h**

- **Problem**: Objects render at all distances
- **Solution**: Add distance thresholds for rendering
- **Implementation**: Build on existing chunk system
- **Expected Reduction**: 10-20% rendering memory usage

### 8. Effects System Pooling
**Impact: Medium | Risk: Low | Effort: 4-6h**

- **Problem**: Particle effects created/destroyed frequently
- **Solution**: Pool effects and reuse them
- **Implementation**: Extend existing FXManager
- **Expected Reduction**: Eliminate effects-related memory spikes

---

## 🟠 Medium Effort (1-2 days each)

### 9. Army Instance Pooling
**Impact: High | Risk: Medium | Effort: 1-2 days**

- **Problem**: Army instances created/destroyed during gameplay
- **Solution**: Pool army instances and reuse them
- **Complexity**: Handle different army types/states carefully
- **Expected Reduction**: 20-30% army-related memory usage

### 10. Texture Atlasing for Small Textures
**Impact: Medium | Risk: Medium | Effort: 1-2 days**

- **Problem**: Many small textures cause memory fragmentation
- **Solution**: Combine into texture atlases
- **Implementation**: Remap UV coordinates, update shaders
- **Expected Reduction**: 15-25% texture memory usage

### 11. Disposal Management Improvements
**Impact: Medium | Risk: Low | Effort: 1-2 days**

- **Problem**: Potential memory leaks from improper disposal
- **Solution**: Systematic cleanup review and fixes
- **Implementation**: Add proper dispose() calls throughout
- **Expected Reduction**: Prevent memory leaks over time

### 12. Chunk Data Compression
**Impact: Medium | Risk: Low | Effort: 1-2 days**

- **Problem**: Cached chunk data uses uncompressed formats
- **Solution**: Compress matrix data, use binary formats
- **Implementation**: Replace JSON with binary serialization
- **Expected Reduction**: 30-50% chunk cache memory usage

---

## 🔴 Significant Effort (3+ days each)

### 13. LOD System Implementation
**Impact: Very High | Risk: Medium | Effort: 1 week**

- **Problem**: All objects render at full quality regardless of distance
- **Solution**: Multiple quality levels based on distance
- **Complexity**: Requires creating multiple model variants
- **Expected Reduction**: 40-60% geometry/texture memory usage

### 14. Geometry Compression & Optimization
**Impact: High | Risk: Low | Effort: 3-5 days**

- **Problem**: Geometries not optimized for memory usage
- **Solution**: Compress vertex data, use quantization
- **Implementation**: Reprocess 3D assets, optimize BufferGeometry
- **Expected Reduction**: 20-40% geometry memory usage

### 15. Texture Streaming System
**Impact: High | Risk: High | Effort: 1-2 weeks**

- **Problem**: All textures loaded at full resolution
- **Solution**: Async loading of appropriate quality textures
- **Complexity**: Complex async system, multiple quality levels needed
- **Expected Reduction**: 30-50% texture memory usage

### 16. Animation System Overhaul
**Impact: High | Risk: High | Effort: 1-2 weeks**

- **Problem**: Individual AnimationMixers for each object
- **Solution**: Shared mixers, animation LOD, selective updates
- **Complexity**: Major changes to army animation system
- **Expected Reduction**: 25-40% animation memory usage

### 17. Memory-Aware Adaptive Systems
**Impact: Medium | Risk: High | Effort: 2 weeks**

- **Problem**: No automatic quality scaling based on available memory
- **Solution**: Dynamic quality adjustment system
- **Complexity**: Complex decision-making logic, extensive testing needed
- **Expected Reduction**: Prevent out-of-memory crashes

### 18. Hierarchical Frustum Culling
**Impact: High | Risk: High | Effort: 2-3 weeks**

- **Problem**: Individual object culling is inefficient
- **Solution**: Group-based culling system
- **Complexity**: Major rendering pipeline changes
- **Expected Reduction**: 15-30% culling overhead, better scalability

---

## Implementation Roadmap

### Week 1: Foundation (20-30% memory reduction)
- ✅ Material sharing 
- ✅ Hex geometry sharing 
- ✅ CSS2D label pooling
- ✅ Update frequency optimization

### Week 2: Optimization (Additional 15-20% reduction)
- ✅ Animation pausing for off-screen objects
- ✅ Buffer management improvements
- ✅ Effects system pooling
- ✅ Distance-based culling enhancements

### Week 3: Advanced Pooling (Additional 20-25% reduction)
- ✅ Army instance pooling
- ✅ Disposal management improvements
- ✅ Basic texture atlasing

### Week 4: Data Optimization (Additional 10-15% reduction)
- ✅ Chunk data compression
- ✅ Memory monitoring improvements
- ✅ Performance profiling integration

### Future Phases (Major architectural changes)
- 🔄 LOD system implementation
- 🔄 Geometry compression
- 🔄 Texture streaming
- 🔄 Animation system overhaul

---

## Monitoring & Validation

### Memory Tracking Integration
- Leverage existing MemoryMonitor system
- Add specific tracking for each optimization
- Before/after measurement for each implementation

### Success Metrics
- **Target**: 50-70% memory usage reduction
- **Measurement**: Peak memory usage during gameplay
- **Validation**: Extended play sessions without memory growth

### Risk Mitigation
- Implement optimizations incrementally
- A/B testing with memory monitoring
- Rollback capability for each change

---

## Technical Notes

### Current Memory Bottlenecks (Based on Codebase Analysis)
1. **Army System**: Heavy instancing, frequent updates
2. **Hex Grid**: Large geometry arrays, matrix caching
3. **Materials**: Likely many duplicate materials
4. **Labels**: DOM manipulation during movement
5. **Effects**: Particle system creation/destruction

### Architecture Considerations
- Build on existing chunk-based loading
- Leverage instanced rendering patterns
- Maintain compatibility with current save/load system
- Preserve visual quality where possible

### Browser Compatibility
- Memory API monitoring (already implemented)
- Graceful degradation for lower-end devices
- Consider mobile memory constraints

---

*Last Updated: [Current Date]*
*Based on analysis of Eternum ThreeJS client codebase*