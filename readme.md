<a href="https://twitter.com/lootrealms">
<img src="https://img.shields.io/twitter/follow/lootrealms?style=social"/>
</a>
<a href="https://twitter.com/BibliothecaDAO">
<img src="https://img.shields.io/twitter/follow/BibliothecaDAO?style=social"/>
</a>


[![discord](https://img.shields.io/badge/join-bibliothecadao-black?logo=discord&logoColor=white)](https://discord.gg/realmsworld)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

![background](./bg.webp)

# Realms: Eternum

## Table of Contents
1. [Introduction to Eternum](#introduction-to-eternum)
2. [Open World Philosophy](#open-world-philosophy)
3. [Eternum's Client Approach](#eternums-client-approach)
4. [Eternum Roadmap](#eternum-roadmap)
5. [Prerequisites for Getting Started](#prerequisites-for-getting-started)
6. [Vision for Development](#vision-for-development)
7. [Project Structure](#project-structure)
8. [Local Client Building Instructions](#local-client-building-instructions)
9. [Local Contracts Building Instructions](#local-contracts-building-instructions)

## Introduction to Eternum
Eternum serves as one of the pioneering nodes in the Realms Autonomous World, constructed atop the [dojo](https://github.com/dojoengine/dojo) platform. Its primary objective is to establish the foundational economic layer of the Realms Autonomous World, with its structure built around the original Realm NFTs.

Eternum represents an ambitious endeavor to forge an open and composable world, one that is collectively owned and governed by its user community. More than just a collection, Eternum encompasses a suite of smart contracts, crafted to be both composable and extensible. These contracts are not only designed to be utilized by various other contracts and applications but also to encourage a versatile and innovative ecosystem.

As a developer you could deploy a set of systems in this world and ecourage players to use these systems, and in the process earn a small fee in resources or the native token lords.

## Open World Philosophy
The term 'open' in this context means anyone can deploy a dojo system in Eternum, expanding its functionality or even adjusting its governing rules. For an in-depth understanding of its mechanics and ideology, consider delving into the dojo book.

## Eternum's Client Approach
Eternum operates in a headless manner. The provided client in this repository is just a reference. There's no obligation to use it. Instead, we champion the development of various clients, promoting diverse interactions with the contracts. You can choose your preferred client or even interact directly with the contracts.

## Eternum Roadmap
Below are the key goals for Eternum, but they're adaptable:
1. [x] Trading and Hyperstructures
2. [ ] Banking
3. [ ] Combat
4. [ ] World Governance

## Prerequisites for Getting Started
To begin, familiarize yourself with the [dojo](https://book.dojoengine.org) and react.

## Vision for Development
From a high-level perspective, we envision:
- Guilds
- Player opt-in communism
- Player-operated casinos
- Balancing chaos and order
- Introducing resources external to Eternums

## Project Structure
- [Client](./client/)
- [Contracts](./contracts/)

## Local Client Building Instructions
To build the client locally:

1. Clone the repo.
2. Install dependencies with `bun`.
3. Use bun workspaces. Install bun using `curl -fsSL https://bun.sh/install | bash`.
4. From the main directory:
   - Install dependencies: `bun install`
   - Build the packages: `bun run build-packages`
   - Run the client: `cd client && bun run dev`

## Local Contracts Building Instructions
To build contracts locally:

1. **Terminal 1 - Katana**:
```console
cd dojo-starter && katana --disable-fee
```
2. **Terminal 2 - Contracts**:
```console
cd clients && sozo build && sozo migrate
```

---

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
