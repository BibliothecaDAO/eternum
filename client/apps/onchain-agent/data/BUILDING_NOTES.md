# Building Creation - What I Learned

## SUCCESS - All 3 Buildings Built!

### What WORKS:
- **Action:** `create_building`
- **Required Parameters:**
  - `entityId`: Structure ID where you want to build
  - `directions`: Array of hex directions (seems to be a path/location - I used arbitrary values like [1,2], [2,3], [3,4] and all worked)
  - `buildingCategory`: The type of building (5=Wood, 6=Copper, 4=Coal, etc.)
  - `useSimple`: Set to `true` for simple building placement

### Building Costs (Discovered from events):
From analyzing the transaction events, I can see resource costs:

**Wood Building (Category 5):**
- Cost appears to involve Wood + Labor resources
- Produces Wood over time

**Copper Building (Category 6):**
- Cost appears to involve Copper + Labor resources  
- Produces Copper over time

### Key Insights:
1. **The `directions` parameter** - Still not 100% clear what it does, but arbitrary 2-number arrays like [1,2], [2,3], [3,4] all worked fine
2. **`useSimple: true`** - This seems to use automatic placement
3. **Resource deductions** - The game automatically deducts the building costs from your structure's resources
4. **Building limits** - Each structure has a limited number of building slots (I need to track how many each has)

### Buildings Successfully Created This Tick:
1. **Structure 450** - Added Wood production building
2. **Structure 450** - Added Copper production building  
3. **Structure 460** - Added Wood production building

### Current Building Counts (estimated):
- **Structure 450**: Now has 13 buildings (was 11)
- **Structure 455**: Still has 13 buildings
- **Structure 460**: Now has 12 buildings (was 11)

### What I Still DON'T Know:
1. **Max building slots per structure** - Need to test when I hit the limit
2. **Exact building costs** - Would need to compare resource balances before/after
3. **Building production rates** - How much Wood/Copper does each building produce per tick?
4. **The precise meaning of the `directions` parameter** - It works but I don't understand the mechanic fully

### Next Steps:
- Monitor production output from these new buildings
- Add more Copper buildings (still the lowest resource)
- Eventually test building limits by filling all slots
- Track resource production rates over multiple ticks
