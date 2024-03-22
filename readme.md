<a href="https://twitter.com/lootrealms">
<img src="https://img.shields.io/twitter/follow/lootrealms?style=social"/>
</a>
<a href="https://twitter.com/BibliothecaDAO">
<img src="https://img.shields.io/twitter/follow/BibliothecaDAO?style=social"/>
</a>

[![discord](https://img.shields.io/badge/join-bibliothecadao-black?logo=discord&logoColor=white)](https://discord.gg/realmsworld)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

# Realms: Eternum

Eternum is built on Cairo smart contracts and runs on the [Dojo game engine](https://dojoengine.org). It's open-source,
licensed under both MIT for software freedom and CC0 for public domain use, ensuring wide accessibility and
community-driven development.

Eternum represents the culmination of two years of dedicated effort, aimed at crafting a world that transcends the
bounds of its creators. It's not just a game; it's a sophisticated fusion of economic and social frameworks, forming the
backbone of a burgeoning digital society. Eternum is designed to evolve and grow, offering a dynamic experience far
removed from the conventional notion of a 'finished game' like Civilization 6. Think of it as a living, breathing
digital ecosystem, constantly evolving and inviting endless exploration.

<details>
<summary> Click to expand</summary>

### L3 Network

Eternum will exist on the Realms World L3 network. Read the documentation here: [dev](https://dev.realms.world/)

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

- [Client Readme](./client/readme.md)
- [Contracts Readme](./contracts/readme.md)

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

Make sure install the same version within the `Scarb.toml` file. Currently this is `v0.6.0-alpha.4`

Eternum uses a pnpm workspace to allow easy npm packages to be created. So you will need pnpm install also.

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

   ```bash
   # Make sure to set a delay in seconds of at least 0.1 seconds between each transaction
   ./scripts/set_config.sh
   ```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
