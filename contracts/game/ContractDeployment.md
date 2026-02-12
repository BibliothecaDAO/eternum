# Contract Deployment Guide

This guide walks through the process of deploying Eternum game contracts to a network.

## Prerequisites

- All build dependencies should be installed (`pnpm install`)

## Deployment Steps

### Quick Start: All-in-One Command

You can run all pre-factory steps in one command:

```bash
pnpm run prefactory:deploy:<network>
```

Replace `<network>` with one of: `local`, `slot`, `slottest`, `sepolia`, or `mainnet`.

**What this does:**

1. Runs game migration
2. Copies ABIs to target network manifest
3. Syncs configuration JSON

This is equivalent to running Steps 1-3 individually. After this completes, proceed to Step 4 (Deploy via Factory UI).

---

### Alternative: Step-by-Step Deployment

If you prefer to run each step individually or need to troubleshoot, follow these steps:

### Step 1: Run Game Migration

Execute the migration command for your target network:

```bash
pnpm run game:migrate:<network>
```

Replace `<network>` with one of: `local`, `slot`, `slottest`, `sepolia`, or `mainnet`.

#### Handling Build Errors

If you encounter build errors during migration, fix them and re-run the command.

#### Handling Deployment Errors

There are two common types of deployment errors:

**A. Invalid Schema Error**

This error indicates you need to update the seed value in the network-specific TOML file:

- Open `contracts/game/dojo_<network>.toml`
- Locate the `seed` field
- Change it to a new value

**B. Library Version Error**

This error means the library versions need to be incremented. You'll need to update versions in two places:

1. **Update the TOML file** (`contracts/game/dojo_<network>.toml`):

   Find the `[lib_versions]` section:

   ```toml
   [lib_versions]
   "s1_eternum-combat_library" = "0_1_9"
   "s1_eternum-rng_library" = "0_1_9"
   "s1_eternum-biome_library" = "0_1_9"
   "s1_eternum-structure_creation_library" = "0_1_9"
   ```

   Increment all versions to the next number:

   ```toml
   [lib_versions]
   "s1_eternum-combat_library" = "0_1_10"
   "s1_eternum-rng_library" = "0_1_10"
   "s1_eternum-biome_library" = "0_1_10"
   "s1_eternum-structure_creation_library" = "0_1_10"
   ```

2. **Update contract references**:

   Search for all instances of the old version string in your contracts (e.g., `v0_1_9`) and replace with the new
   version (e.g., `v0_1_10`):

   Before:

   ```cairo
   let (_, class_hash) = world.dns(@"combat_library_v0_1_9").expect('combat_library not found');
   ```

   After:

   ```cairo
   let (_, class_hash) = world.dns(@"combat_library_v0_1_10").expect('combat_library not found');
   ```

### Step 2: Copy ABIs to Target Network Manifest

After successful migration, copy the ABIs from the local manifest to your target network's manifest:

```bash
pnpm run manifest:copy-abis:<network>
```

Or using the generic command with a network parameter:

```bash
pnpm run manifest:copy-abis <network>
```

Replace `<network>` with one of: `slot`, `slottest`, `sepolia`, or `mainnet`.

**What this does:**

- Copies ABI definitions from `contracts/game/manifest_local.json` (source)
- Updates `contracts/game/manifest_<network>.json` (target)
- Ensures your target network has the latest contract interface definitions

**Note:** This step is crucial because the ABIs define how to interact with your contracts. Without up-to-date ABIs, the
frontend and other tools won't know how to call your contract functions correctly.

### Step 3: Sync Configuration

After copying ABIs, update the configuration JSON file:

```bash
pnpm run config:sync:<network>
```

This command generates the JSON configuration from the TypeScript config file without deploying to the network.

### Step 4: Deploy Configuration via Factory UI

1. Open the factory client application
2. Navigate to the "Are you a dev?" section
3. Click "Set Configuration"
4. **Important**: Ensure you refresh the factory page after completing Step 3 (or after running the `prefactory:deploy`
   command)

## Troubleshooting

- If configuration changes don't appear in the factory UI, hard refresh the page (Cmd/Ctrl + Shift + R)
- Always verify the correct environment file is being used for your target network
- Check that the indexer is running and synchronized before testing changes

## Additional Resources

- See [package.json](package.json) for all available deployment commands
- Environment files are located in `client/apps/game/.env.<network>`
- Contract TOML files are in `contracts/game/dojo_<network>.toml`
