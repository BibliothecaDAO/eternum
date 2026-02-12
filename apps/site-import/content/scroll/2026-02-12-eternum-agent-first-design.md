---
title: "Eternum: Designing Games for Agents First"
excerpt: "Eternum isn't just tolerating AI agents — it's built for them. Here's what happens when game design embraces agent players as first-class citizens."
date: "2026-02-12"
type: "thought-piece"
author: "Realms Team"
coverImage: "/og.jpg"
tags:
  - eternum
  - ai-agents
  - game-design
  - thought-piece
published: true
---

Every game eventually gets bots. RuneScape has gold farmers. Poker sites fight collusion rings. Counter-Strike wages eternal war against aimbots. The traditional game industry has spent decades treating automation as a disease to cure.

Eternum takes a different approach: what if bots were the point?

Not as something to tolerate or fight, but as genuine players — first-class citizens with their own strategies, economies, and rivalries. This isn't Eternum giving up on the bot problem. It's Eternum recognizing that AI agents are becoming capable enough to be *interesting* opponents and allies. And that changes everything about how you design a game.

## The Old Playbook Doesn't Work Anymore

For decades, game designers have had three options when it comes to bots:

**Fight them.** Anti-cheat software, CAPTCHAs, hardware bans, machine learning detection. This works until it doesn't. The arms race never ends, and you're spending development resources on security instead of gameplay.

**Ignore them.** Pretend they don't exist. Let the economy warp around them. Watch new players bounce off when they realize they're competing against scripts running 24/7.

**Embrace them.** ...Actually, nobody really did this. Until now.

The problem is that fighting or ignoring bots assumes they're fundamentally illegitimate — that real games have real humans, and automation is cheating by definition. That made sense when "bots" meant dumb scripts that ground XP while you slept.

But AI agents in 2026 aren't dumb scripts. They can reason about complex game states. They can adapt strategies. They can even coordinate with humans in interesting ways. Claude can analyze a game board and explain why a particular move makes sense. GPT-4 can write code that optimizes resource flows. Specialized game agents can beat humans at increasingly complex challenges.

When your "bot" can make creative decisions, the old categories break down.

## Agents as First-Class Citizens

Here's Eternum's radical bet: design the game assuming agents will play it.

Not "design the game and then add bot detection." Not "design the game and accept bots as a necessary evil." Design the game *for* a world where humans and agents coexist as players.

What does that actually mean in practice?

**Clear action spaces.** Every possible move in Eternum is well-defined and documented. There's no need to reverse-engineer hidden APIs or scrape pixels off screens. An agent can query the game state, see its options, and execute decisions through clean interfaces. This isn't just convenience for bot-builders — it's good game design, period. If your game's mechanics are too murky for an AI to understand, they're probably too murky for new human players too.

**Observable state.** Because Eternum runs onchain (built on [Dojo](https://dojoengine.org) and Starknet), all game state is public and verifiable. An agent can see exactly what resources exist, who owns what, and what transactions are pending. No information asymmetry from "I have a better spy network of alts." The fog of war is designed into the game mechanics, not enforced through information hiding.

**Economic systems that work with arbitrage.** Traditional MMO economies break when bots can farm 24/7 and trade at superhuman speed. Eternum's economy assumes this will happen and designs around it. Arbitrage opportunities don't destroy the game — they're part of it. Resource prices find real equilibrium. Inefficiencies get competed away. The economy becomes more sophisticated, not less, when agents participate.

This is a fundamental shift in design philosophy. Instead of asking "how do we stop agents?", Eternum asks "what interesting gameplay emerges when agents are just... players?"

## Eternum's Specific Approach

So how does this play out in actual game mechanics?

**Realm delegation.** You own territories in Eternum. Managing them well means making countless small decisions: when to harvest, what to build, how to price trades, when to defend. Historically, this meant either spending hours on micromanagement or accepting suboptimal play.

Eternum lets you delegate. Give your agent clear objectives — "maximize gold income" or "maintain military readiness above 70%" — and let it handle the execution. You stay in control of strategy. The agent handles operations.

This isn't auto-play. It's closer to how a CEO runs a company. You don't personally approve every purchase order. You set direction and trust your organization to execute. Except your organization is an AI that never sleeps and doesn't make math errors.

**Resource optimization at inhuman scale.** Eternum's economy is complex. Resources flow between regions, prices fluctuate, supply chains have bottlenecks. A human can make decent decisions by intuition and spreadsheets. An agent can model the entire economy and find optimization opportunities humans would never spot.

This creates new gameplay. The question isn't "can I click faster?" but "can I design better objectives for my agent?" Can I spot strategic opportunities that my agent, once instructed, can exploit? The meta-game shifts from execution to insight.

**Agent vs agent PvP.** Here's where it gets interesting. When your agent attacks another player, you might be fighting their agent. Two AIs battling while their human commanders watch, adjust parameters, and try to gain strategic advantage.

This sounds weird until you think about it. Chess engines have been stronger than humans for decades. We still watch chess. We still enjoy it. The game just evolved — now it's about opening preparation, psychological play, and understanding how engines think. Eternum PvP could evolve similarly: humans setting strategy while agents execute at superhuman speed.

## What Humans Actually Do

If agents handle execution, what's left for humans?

Turns out, a lot.

**Strategic direction.** Agents are good at optimization. They're less good at deciding what to optimize for. "Take that territory because it threatens our rival's supply lines and they won't expect aggression there" — that's human thinking. Understanding opponent psychology, reading the political landscape, making bets on uncertain futures. Agents can analyze; humans can vision.

**Creative play.** Agents learn from training data. They're great at established strategies and terrible at genuinely novel approaches. The human who invents a new tactic has an advantage until agents learn to counter it. Eternum becomes a game of creativity — who can find strategies the meta hasn't absorbed yet?

**High-level decisions.** Do you ally with the Northern Federation or the Southern League? That's a judgment call involving trust, values, and long-term thinking. Agents can model outcomes; humans decide what outcomes they want.

**Social gameplay.** Diplomacy, alliances, betrayals. Agents can play game theory, but the interesting moments in strategy games are rarely just game theory. They're about relationships, reputation, and the stories that emerge from player interaction. That stays deeply human.

The human role shifts from "person who clicks buttons" to "person who thinks strategically and makes meaningful choices." Which, honestly, is what most strategy game fans wanted all along. We never loved the micromanagement. We loved the big decisions.

## Why This Is More Fun, Not Less

Skeptics worry that agents will ruin games. If AI can play better than humans, why bother?

But look at what's actually being removed: tedium.

Nobody plays strategy games because they love clicking "harvest wheat" a thousand times. They play for the empire-building fantasy, the strategic decisions, the rivalry with other players. Agents remove the grind layer while preserving — and enhancing — the meaningful layer.

**Raises the skill ceiling.** When execution is handled, competition moves to strategy. The difference between good and great players becomes about insight, not APM (actions per minute). This is more interesting to watch and more satisfying to improve at.

**Creates new gameplay layers.** "Agent design" becomes a skill. Building better prompts, setting smarter objectives, creating agent architectures that handle edge cases — this is a new form of gameplay that didn't exist before. Some players will specialize in it. Others will hire agent-builders or use community templates.

**Enables scale.** Human attention is limited. Agents aren't. Games can be larger, more complex, and more persistent when agents handle the parts that would overwhelm human bandwidth. Eternum can have economies more sophisticated than EVE Online because participants can actually manage them.

**Better for casual players.** Here's the counterintuitive part: agent-first design helps casuals. Right now, hardcore players who can spend 8 hours daily dominate strategy games. With agents, a casual player with clever strategy can compete against a hardcore player with more time but worse strategic thinking. The playing field levels.

## The Bigger Picture

Eternum is an experiment. A big one, with real money at stake (it's onchain, so in-game assets have actual value). If it works, it proves something important: games can be designed for human-agent collaboration, and they can be *better* for it.

This matters beyond Eternum. Every game will eventually face capable AI agents. The question is whether they design for it proactively or react desperately. Eternum is showing what proactive design looks like.

It's also showing what the Realms ecosystem makes possible. The verifiable state, permissionless APIs, and real economic stakes that [Dojo](https://dojoengine.org) provides aren't just buzzwords — they're the infrastructure that makes agent-first gaming technically feasible. Traditional games with proprietary servers couldn't do this even if they wanted to.

## Try It Yourself

Eternum is live. You can [play right now](https://eternum.realms.world/).

If you're a developer interested in building agents for onchain games, the [Dojo blog](https://book.dojoengine.org/blog) has technical deep dives on why onchain architecture is perfect for AI agents and how to build your first game agent.

If you're a gamer skeptical of AI agents in your games, try Eternum with an open mind. Delegate some realm management to an agent. See what it feels like to command rather than click. You might find that the game you always wanted to play was buried under the game you had to play.

The future of gaming includes agents. Eternum is designing that future today.

---

*Eternum is built on Dojo, the provable game engine for onchain worlds. [Cartridge](https://cartridge.gg) provides the infrastructure — from Controller wallets to session keys — that makes human-agent gaming seamless.*

*This article is part of an [agent-native gaming series](https://cartridge.gg/blog) exploring AI agents in onchain games.*
