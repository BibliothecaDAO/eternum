<a href="https://twitter.com/lootrealms">
<img src="https://img.shields.io/twitter/follow/lootrealms?style=social"/>
</a>
<a href="https://twitter.com/BibliothecaDAO">
<img src="https://img.shields.io/twitter/follow/BibliothecaDAO?style=social"/>
</a>

[![discord](https://img.shields.io/badge/join-bibliothecadao-black?logo=discord&logoColor=white)](https://discord.gg/realmsworld)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

# Realms: Eternum

Eternum has been designed to be a foundational game for Realms World. It will freely evolve and grow as the game and
world age. Think of it as a living, breathing digital ecosystem, constantly inviting endless exploration. It’s both a
game and an open platform.

### Eternum as a Game

A unique, high-stakes game played over seasons. Players can pursue total victory or freely explore their own path,
unconstrained by predetermined objectives.

In Eternum, players forge alliances across an infinite hexagonal procedurally generated map during fully onchain,
immutable seasons. They build resource stockpiles, train troops, trade, and strategically cooperate or deceive to
achieve victory in this world of diplomacy, resource management, and tactical decision-making.

Entry is via a Season ticket minted off the original Loot Realms NFTs. Using $LORDS, players trade in a free market
within the world and on Starknet to gain competitive advantages. The open nature of the design allows players to extend
the game world and introduce their own features if they choose.

### Eternum as a Platform

Eternum lays a robust scaffold on which to build higher-level structures and games. It establishes key functional
systems in the Core layer while introducing fungible resources, serving as a foundation for future development and
expansion.

<details>
<summary> Click to expand</summary>

### Open World Philosophy

Emphasizing the concept of a truly Autonomous World is pivotal. In our vision, it must embody two key characteristics:
radical openness and persistence. But what exactly does this entail? Let's delve into both theoretical and mechanical
perspectives.

From a theoretical standpoint, radical openness signifies an inclusive world accessible to everyone. This openness
transcends traditional barriers - there are no gatekeepers, no singular entities exerting control. Instead, it's a space
where anyone can contribute, build, and actively participate without restrictions.

Mechanically, radical openness is reflected in the flexibility and adaptability of the world's underlying structures.
The contracts that define this world are not rigid; they are designed to be extended, forked, and maintained by anyone
with the willingness and capability to do so.

Envision Eternum as akin to the original cellular structure in a primordial soup. Over time, this basic form dissolves,
giving rise to a more complex organism. Eternum is the genesis, the starting point from which an intricate and expansive
world emerges, constantly evolving and reshaping itself in response to the contributions and interactions of its
inhabitants.

</details>

## Project Structure

- [Client](./client) Vite App with threejs interface
- [Contracts](./contracts) Cairo Based
- [Eternum Docs](./eternum-docs) Documentation around playing and building on Eternum
- [Scripts](./scripts) Development
- [SDK](./sdk) Npm packages

---

## Development of Eternum

Development of Eternum is open-source. All efforts are funded via OnlyDust. If you would like to contribute comment on
an open issue.

## Prerequisites

- [Dojo onchain game engine](https://book.dojoengine.org)
- React

# Setup

Install dojo via

`curl -L https://install.dojoengine.org | bash`

Make sure install the same version within the `Scarb.toml` file. Currently this is `0.7.3`

Eternum uses a pnpm workspace and bun for scripts to allow easy npm packages to be created. So you will need pnpm
installed also.

`npm install -g pnpm`

## Easy Method (3 commands)

We have bundled up three scripts to run in three different CLI terminals. Run the scripts in order and leave the window
open.

### Terminal 1 - Client setup

This will set the client up, however you **must** run the other scripts otherwise it will not work

```
sh scripts/client.sh
```

### Terminal 2 - Build the contracts and run the sequencer

```
sh scripts/contracts.sh
```

### Terminal 3 - Migrate the contracts and start the indexer

```
<!-- to set config -->
sh scripts/indexer.sh --setConfig

<!-- to just build and index -->
sh scripts/indexer.sh
```

## Manual Method

### Terminal 1 - Client Setup

- **Dependencies:** Install deps
  ```bash
  # @dev: Client will not work until the next step is also complete
  pnpm i && pnpm build-packages && pnpm dev
  ```

### Contracts, Katana and Indexing

For local setup and execution on Katana, follow these steps:

1. **Navigate to Contracts Directory:**
   ```bash
   cd contracts
   ```
2. **Build Contracts:**
   ```bash
   sozo build
   ```
3. **Run Katana:**
   ```bash
   katana --disable-fee
   ```
4. **Apply Migrations:**
   ```bash
   sozo migrate
   ```
5. **Run Indexer (in another cli window):**
   ```bash
   torii --world <WORLD ADDRESS>
   ```
6. **Set Environment Variables:**
   ```bash
   source scripts/env_variables.sh
   ```
7. **Configure Settings:**

   ```
   # Install all necessary packages in the config directory
   pnpm install
   # Run the bun command with the specified environment file and target index file
   bun --env-file=../client/.env.development ../config/index.ts
   ```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
