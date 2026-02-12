---
title: "The Infrastructure Stack Powering Autonomous Worlds"
excerpt: "Onchain games need more than smart contracts. Here's what the modern stack looks like and why it matters."
date: "2026-02-12"
type: "thought-piece"
author: "Realms Team"
coverImage: "/og.jpg"
tags:
  - infrastructure
  - thought-piece
  - onchain
  - builders
published: true
---

Building an autonomous world is not just about writing game logic in Cairo. It requires a full stack that handles everything from transaction execution to player identity.

The Realms ecosystem runs on infrastructure that has matured significantly over the past year. Here is what that stack looks like in practice.

## The Layers

### Execution: Rollups Built for Games

Games cannot compete for blockspace with DeFi traders. They need dedicated execution environments optimized for game-specific workloads.

[Cartridge's Slot](https://cartridge.gg) provides application-specific rollups that handle this. Games like Eternum run on infrastructure where every action — movement, combat, resource transfers — executes with game-appropriate latency and cost.

The key insight: games need their own chains, not shared ones.

### Framework: Entity Component Systems Onchain

Traditional game engines use ECS (Entity Component System) patterns. [Dojo](https://dojoengine.org) brings that same architecture onchain.

This matters because game developers think in entities and components, not raw storage slots. Dojo bridges that gap while generating typed clients that sync state automatically.

The Realms ecosystem was an early adopter of Dojo, and that bet has paid off in development velocity.

### Identity: Wallets That Feel Like Accounts

Players should not need to understand gas fees or transaction signing. [Cartridge Controller](https://cartridge.gg) handles account abstraction so onboarding feels like creating any game account.

Session keys let players perform actions without constant wallet popups. This is not optional for real games — it is table stakes.

### Indexing: State You Can Query

Onchain state is authoritative, but querying it directly is slow. Torii (part of the Dojo stack) indexes world state into queryable databases.

Games need to render UI fast. Indexers make that possible without sacrificing the benefits of onchain logic.

## Why This Matters for Builders

The infrastructure layer is no longer the bottleneck. Teams building in the Realms ecosystem can focus on game design rather than reinventing execution layers.

This is how ecosystems compound: shared infrastructure reduces repeated work, letting builders ship faster and learn from each other.

## What's Next

Infrastructure keeps improving. Faster provers, better indexers, smoother onboarding. Each improvement benefits every game built on top.

The teams shipping games today are also stress-testing the infra for tomorrow's builders. That feedback loop is what makes ecosystems grow.

---

*The Realms ecosystem builds on [Cartridge](https://cartridge.gg) infrastructure and the [Dojo](https://dojoengine.org) engine. Explore current games at [realms.world](https://realms.world).*
