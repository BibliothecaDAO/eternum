# GameJam Guide

A template for games to help new developers mod their games. Please fill out this guide and add it to your project's
repo!

## Development

### Prerequisites

- [Dojo](https://book.dojoengine.org)
- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)

### Installation

1. Install Dojo:

   ```bash
   curl -L https://install.dojoengine.org | bash
   ```

2. Install pnpm:

   ```bash
   npm install -g pnpm
   ```

3. Install project dependencies:

   ```bash
   pnpm install
   ```

4. Build shared packages:
   ```bash
   pnpm run build:packages
   ```

### Running Locally

To run the game locally:

1. Navigate to the game client directory:

   ```bash
   cd client/apps/game
   ```

2. Make a copy of `.env.local.sample` and rename it to `.env.local`.

3. Update the following environment variables in `.env.local` based on your target environment:

   - `VITE_PUBLIC_TORII="http://127.0.0.1:8080"`
   - `VITE_PUBLIC_NODE_URL="http://127.0.0.1:5050"`

4. Run `pnpm run dev` to start the development server.

## Design and Architecture

### Basic Concepts

- **Entities**: Represent game objects such as armies, realms, and structures.
- **Components**: Define properties and behaviors of entities.
- **Systems**: Manage interactions and logic between entities and components.

### Key Source Files

- **Client**: React apps built with Vite, located in the `client` directory.
- **Contracts**: Cairo/Dojo smart contracts, located in the `contracts` directory.
- **Packages**: Shared libraries, located in the `packages` directory.

## Modification Ideas

### Mechanics to Change

- **Custom Game Mode**: Create a unique game mode with custom rules and objectives.
- **Enrichment UI Mods**: Enhance the user interface with additional features and visual improvements.
- **Onchain Casino**: Implement a casino feature that operates on the blockchain, allowing players to gamble with
  in-game resources.
- **God Mode**: Enable a mode where players can place any army, realm, or structure to easily test game scenarios.
- **Road Building**: Allow players to build roads between structures to increase transfer times.
- **Structure/Army Renaming**: Permit players to rename their structures or armies in exchange for $LORDS.
- **Wall Creation**: Enable players to create walls on the map to increase defenses.
- **New Unit Types**: Introduce new unit types with long-range fire capabilities.
- **Hex Messages**: Allow players to add messages to hexes by spending $LORDS, similar to Dark Souls messages, which
  persist between seasons.
- **Realm Orders**: Reintroduce the 16 Realm orders into gameplay.
- **Roaming Bandits**: Implement a feature where bandits intercept donkey shipments, charging a ransom or dueling donkey
  guards. Players can hire bandits to target specific players, creating deeper strategic and social dynamics.
- **Return to Base Feature**: Add a feature for armies to return to their base.

### Interface Improvements

- **Additional Stats**: Display more detailed statistics for players and entities.
- **Interesting Views**: Create new visualizations or dashboards for game data.

## Contact List

For any inquiries or collaboration, feel free to reach out to the following Discord users:

- **credence0x**
- **raschel**
- **loaf1337**
- **1337**

Join our Discord server for more information: [Discord Server](https://discord.gg/realmsworld)

## Contract Deployment

Eternum supports multiple deployment environments:

| Environment | Description                 |
| ----------- | --------------------------- |
| Local       | For development and testing |
| Slot        | Staging environment         |
| Sepolia     | Public testnet              |
| Mainnet     | Production environment      |

### Deploying to Local

Before deploying to any environment, confirm that you have a `.env.{environment}` file in the `contracts/common`
directory, as well as in the `client/apps/game` directory. <br>

To deploy and run the game locally:

```bash
# Start local game contracts
pnpm run contract:start:local
```

### Deploying to Sepolia

To deploy the contracts to Sepolia testnet, run these commands in order:

1. Deploy game contracts:

```bash
pnpm run game:migrate:sepolia
```

2. Deploy season pass contracts:

```bash
pnpm run seasonpass:deploy:sepolia
```

3. Deploy season resources contracts:

```bash
pnpm run seasonresources:deploy:sepolia
```

4. Update TOML configuration:

```bash
pnpm run toml:update:sepolia
```

5. Start the indexer:

```bash
pnpm run indexer:start:sepolia
```

6. Deploy game configuration:

```bash
pnpm run config:deploy:sepolia
```
