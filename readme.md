<a href="https://twitter.com/lootrealms">
<img src="https://img.shields.io/twitter/follow/lootrealms?style=social"/>
</a>
<a href="https://twitter.com/BibliothecaDAO">
<img src="https://img.shields.io/twitter/follow/BibliothecaDAO?style=social"/>
</a>

[![discord](https://img.shields.io/badge/join-bibliothecadao-black?logo=discord&logoColor=white)](https://discord.gg/realmsworld)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

# Realms: Eternum

## Table of Contents

1. [Introduction to Eternum](#what-is-eternum)
2. [Open World Philosophy](#open-world-philosophy)
3. [Roadmap](#eternum-roadmap)
4. [Prerequisites for Getting Started](#prerequisites-for-getting-started)
5. [Project Structure](#project-structure)
6. [Local Client Building Instructions](#local-client-building-instructions)
7. [Local Contracts Building Instructions](#local-contracts-building-instructions)

## What is Eternum

Eternum represents the culmination of two years of dedicated effort, aimed at crafting a world that transcends the
bounds of its creators. It's not just a game; it's a sophisticated fusion of economic and social frameworks, forming the
backbone of a burgeoning digital society. Eternum is designed to evolve and grow, offering a dynamic experience far
removed from the conventional notion of a 'finished game' like Civilization 6. Think of it as a living, breathing
digital ecosystem, constantly evolving and inviting endless exploration.

Eternum is built on Cairo smart contracts and runs on the [Dojo game engine](https://dojoengine.org). It's open-source,
licensed under both MIT for software freedom and CC0 for public domain use, ensuring wide accessibility and
community-driven development.

## L3 Network

Eternum will exist on the Realms World L3 network. Read the documentation here: [dev](https://dev.realms.world/)

## Open World Philosophy

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

## Eternum Roadmap

Below are the key goals for Eternum, but they're adaptable:

1. [x] Trading
2. [ ] Banking & AMM
3. [ ] Combat
4. [ ] World Governance

## Prerequisites for Getting Started

To begin, familiarize yourself with the [dojo](https://book.dojoengine.org) and react.

## Project Structure

- [Client](./client/)
- [Contracts](./contracts/)

## Local Client Building Instructions

To build the client locally:

1. Clone the repo.
2. Install dependencies with `pnpm`.
3. From the main directory:
   - Install dependencies: `pnpm install`
   - Build the packages: `pnpm run build-packages`
   - Run the client: `cd client && pnpm run dev`

## Local Contracts Building Instructions

To build contracts locally:

1. **Terminal 1 - Katana**:

```console
cd contracts && katana --disable-fee
```

2. **Terminal 2 - Contracts**:

```console
cd contracts && sozo build && sozo migrate
```

3. **Terminal 3 - Indexer**:

```console
torii --world <world printout from previous step>
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
