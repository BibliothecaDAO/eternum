# Contract Rules

## Configuration Synchronization

When making changes to Cairo contract configurations, ensure that all related TypeScript files are updated accordingly:

1. **When modifying config structs in `contracts/game/src/models/config.cairo`:**
   - Update the corresponding configuration in `config/environments/_shared_.ts`
   - Update the contract component types in `packages/types/src/dojo/contract-components.ts`
   - Update the deployer configuration in `config/deployer/config.ts`

2. **When modifying contract entrypoints or their inputs:**
   - Update the corresponding provider methods in `packages/provider/src/index.ts`
   - Update the TypeScript type definitions in `packages/types/src/types/provider.ts`
   - Ensure function signatures, parameter types, and calldata structures match the Cairo contract changes
   - Verify that all entrypoint calls use the correct parameter order and types

3. **Always ensure that:**
   - Field names in TypeScript match the Cairo contract field names (converted to camelCase)
   - Data types are correctly mapped (u16 → Number, u8 → Number, etc.)
   - New fields are included in all relevant configuration objects and deployment scripts

4. **Game Documentation Updates:**
   - When contracts or config values are changed, the game docs in `apps/client/game-docs` must be updated
   - **Best Practice:** Always use the `ETERNUM_CONFIG` object to access config values in the game-docs components
   - This ensures that the latest values are always displayed
   - Example:

     ```typescript
     import { ETERNUM_CONFIG } from "@/utils/config";

     export function MyComponent() {
       const config = ETERNUM_CONFIG();
       // Use config.exploration.relicDiscoveryIntervalSeconds instead of hardcoded values
     }
     ```

5. **Testing:**
   - Verify that the configuration deploys correctly
   - Ensure that the client can read the new configuration values
   - Check that game-docs display the correct updated values
