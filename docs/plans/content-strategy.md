# Content strategy: the game makes the content, people choose what to post

Written 2026-11-06, three days before Frontier Season 1 opens on Nov 9. It draws on a read of this repo (what each
surface already produces) and on market research (sources at the end). The research figures are mostly self-reported by
vendors and developers, so treat them as direction, not proof.

## 0. The answer in one paragraph

Don't build a content team that writes about the game. Every move in Realms is already a recorded fact: Herald folds it,
and the client can draw it. So treat content as something the game produces. **Moments** come out of Herald's history
and get scored for rarity and stakes. They are rendered with the capture pipeline we already have (lab fixtures,
headless Chromium, the recap deck's 16:9 and 4:5 cuts). One editor picks the best from a queue in 30 minutes a day.
Players carry most of it through share cards, and every shared link carries attribution. The success measure is not
impressions. It is **activated players**: people who signed up through a piece of content, founded a realm and cleared a
site. The Devcon referral rule already defines and counts exactly that.

## 1. What the research says, and what we do about it

| Finding                                                                                                                                                                                                                                                                                    | What we do                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wordle took off after a **spoiler-free, compact share** was added. Players had been typing the emoji grid by hand, and the share made each player a billboard. A daily cap made it a ritual. [Smithsonian], [Northeastern]                                                                 | Frontier is already a daily game, but it has **no daily share**. A Day card is the biggest single lever (§4.1).                                                                                                   |
| Short-form video is a key way 36% of players find games, but it suits fast, visual genres more than strategy. Long-form YouTube does more for niche and strategy games. [GameDiscoverCo via indie-games.eu], [GameDiscoverCo short-form guide]                                             | Use Shorts and TikTok only for **moments**: a chest found, a golden reveal, a last-minute Hyperstructure flip. Get depth from long-form creators and Blitz broadcasts. Don't post "here's our strategy game" ads. |
| Viral short views convert poorly. One developer got about 200 wishlists from 1M views. YouTube Shorts keep being found through search for months; TikTok clips fade. [Cinevva], [Bugnet]                                                                                                   | Post every clip to YouTube Shorts first, because it lasts. Test TikTok and Reels for 4 weeks and drop them if activations stay at zero.                                                                           |
| In January 2026, X cut off "InfoFi" apps that pay people to post. Kaito ended Yaps. Product head Nikita Bier: "CT is dying from suicide, not from the algorithm." [The Block], [Decrypt]                                                                                                   | **No paid-to-post, engage-to-earn or yap campaigns.** Reward playing (referrals count a friend only after they clear a site). Never reward posting.                                                               |
| The link penalty on X is disputed. Musk said in July 2026 that links aren't throttled. A study of 28k posts found link posts get about 1.05× the reach of posts without links. Native media still does better. [Siècle Digital], [OpenTweet]                                               | Every post carries a **native image or video** and the link. We already do this ("Copy image" first, then "Post on X"). Give the link a **dynamic preview** (§4.3).                                               |
| Web3 games that lead with earnings attract mercenaries who churn. Gameplay-led marketing retains. About 93% of Web3 games since 2020 are dead. [data40], [salmangul] (agency sources)                                                                                                      | Lead with the game. LORDS show up as **receipts** (paid out, on chain, verifiable), never as yield.                                                                                                               |
| In one campaign, 91% of creator keys went to a long pre-launch program and produced 8% of views. Personal outreach to top and mid creators used 2.7% of keys and produced 71% of views. Creators who had covered the game before converted at 7× the rate of cold contacts. [Inven Global] | No mass creator program. Contact **15–20 creators personally** (strategy, onchain, AI). Give each a referral link and re-engage those who post.                                                                   |
| Claude Plays Pokémon (Feb 2025) drew attention because viewers could **watch the model think**. Other labs copied it, and Pokémon progress became a benchmark. [TechCrunch]                                                                                                                | Hired agents (`docs/plans/hired-agents-*`) are a format we can own: **agents vs. humans in Blitz**, with their reasoning on screen (§3, pillar 4).                                                                |
| "Sessionability" (a complete experience in a short session) drives discovery. [GameDiscoverCo]                                                                                                                                                                                             | A Blitz is 60 minutes, the length of a stream. It is our broadcast format.                                                                                                                                        |

## 2. The surface area we already have

Each row is a surface across the games and what it produces today. **Gap** marks the leverage we're missing.

| Surface                                      | Game              | Produces today                                                                                       | Gap                                                                              |
| -------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Season recap deck (`season-recap.tsx`)       | Frontier          | Four cards (place, podium, sites, haul) in 16:9 and 4:5 cuts, plus a Post on X with a results link   | Only at season end, once every few weeks                                         |
| Frontier day                                 | Frontier          | Today's lines, the day-end notice, the 1/10,000 wild chest, the ruin chest per depth                 | **No share at all.** The most frequent loop in the game has no share             |
| Blitz Results board, rank-band chests        | Blitz             | Places, points, chests                                                                               | **No share card**                                                                |
| Spectator end map (`?spectate=true`)         | Blitz, Frontier   | Any finished game's final state, open to anyone                                                      | Not used as a clip source                                                        |
| World history, Log, Today                    | All               | Every clear, find, fight and site use as a readable line                                             | Not scored, not surfaced outside the game                                        |
| Lab fixtures + `capture-media.mjs`           | All               | Deterministic WebP and H.264 captures at desktop and phone sizes, under a size budget                | Used only for docs. **This is the renderer we need**                             |
| Referral links, golden odds, counted friends | Frontier (Devcon) | Per-account links; "counted" means founded a realm and cleared a site                                | Tied to the Devcon campaign; should become the attribution layer for all content |
| Link preview (`index.html` `%LINK_PREVIEW%`) | All               | One static image for every link                                                                      | **A shared result or invite link unfurls as a generic card**                     |
| Patch notes (`content/patch-notes`)          | All               | Dated, per-mode, icon-tagged notes rendered in What's new                                            | Not turned into posts or clips                                                   |
| Push, comeback email                         | Frontier, Blitz   | Day open, armies rested, season over, Blitz settled                                                  | Could carry "your recap is ready" and the weekly dispatch                        |
| Chat (one Global room)                       | All               | Live talk, place chips                                                                               | The place to find candidate moments                                              |
| docs.realms.party + `llm.txt`                | All               | Rules with live constants, captured media                                                            | Already ready for AI answer engines; add a "what happened this season" page      |
| realms.world (`apps/web`)                    | Ecosystem         | Game pages (Blitz, Eternum, Loot Survivor, Dark Shuffle, Pistols at Dawn and others), stats, revenue | Cross-promotion slot for the weekly dispatch                                     |
| GitHub (open source, MIT)                    | All               | Procedural character and animation research, art passes, plans                                       | Build-in-public material nobody posts                                            |
| X, Discord, Telegram                         | All               | Official channels                                                                                    | No defined role per channel                                                      |

## 3. Content pillars

Every piece of content belongs to exactly one pillar. If a piece fits none, don't make it.

1. **Moments.** Made by players, detected automatically. Wild chest found (1 in 10,000 tiles). Golden ticket or golden
   link. Podium change. A Blitz lead change in the last 5 minutes. A Hyperstructure taken and held. A Legendary V
   research. The first Ethereal depth of the season. _Format:_ a card, or a 9–15 s clip from the spectator end map.
   _Carried by_ players' shares, then reposted by us.
2. **Ritual.** A fixed rhythm. The Frontier Day card, each Blitz slot's results, Season board standings, the season
   recap. _Format:_ the same template every time, so a glance tells you which game and which day it is. _Carried by_
   players, with an automatic post in Discord.
3. **Craft.** Building in public from the repo: art passes (ethereal depths, Wonder and Devcon home levels), procedural
   animation, patch notes cut as 30 s lab clips, and the fact that it runs on our own appchain. _Format:_ threads,
   YouTube devlogs, GitHub links. _Audience:_ developers and onchain-curious players. This pillar reaches players other
   games can't, because almost nobody else is fully onchain and open source.
4. **Machines vs. humans.** Hired agents play Blitz against humans and against each other, with their reasoning shown
   beside the map. Run an agent leaderboard next to the human one. _Format:_ a weekly featured Blitz broadcast and its
   clips. It depends on the hired-agents milestones, so it starts when an agent can finish a Blitz.
5. **Receipts.** LORDS paid out, prize transactions, the revenue dashboard. Always a fact with a link to the
   transaction, never a promise. _Format:_ one line and a transaction link, posted after each payout.

## 4. What to build (smallest first, each with a gate)

### 4.1 Frontier Day card

At day end, or from Today, offer a card in the recap deck's two cuts. It shows the day number, tiles revealed, sites
cleared (with the site marks already in `TARGET_MARKS`), chests found, XP gained, Season board rank and the change since
yesterday. It works like Wordle's grid: compact, a flex, and the same shape every day. Each player's map is their own,
so there's nothing to spoil. Reuse `share-card.ts` and `openXPost`. The words come from the words module, and the
figures from the store and the leaderboard Herald already serves. **Gate:** a share rate (Day cards posted ÷ players who
finished a day) can be read per day.

### 4.2 Blitz Results card

The same deck component, fed by the Results board: place, points by source (explore, crates, camps, rifts,
Hyperstructures), the chest band, and the end map as a thumbnail. **Gate:** a test fails when the card misses a score
source the Results board shows. This follows `AGENTS.md`'s one-source rule.

### 4.3 Dynamic link previews and attribution

Every shared URL (results, a recap, an invite) gets two things. First, a rendered preview image, produced at the Worker
edge from the same card. Second, a `via` parameter that records which artifact type and which player sent it. The
referral rule ("counted" = founded a realm and cleared a site) becomes the activation event for **all** content, not
only Devcon. **Gate:** a dashboard row per artifact type: clicks → sign-ups → counted.

### 4.4 Moment feed and curation queue

A job reads Herald's immutable history. Story logs are allowed as SQL read models under `AGENTS.md` rule 1. The job
emits moments with a score: rarity × stakes × recency. A wild chest scores high on rarity. A last-minute Blitz swing
scores high on stakes. Each moment is rendered through the lab fixture and `capture-media.mjs` path, as a card plus a
vertical clip, and posted to a private Discord channel with buttons: **Post / Hold / Drop**. Post publishes to the
official X and Discord, with a caption drafted from the moment's own log line. **Gate:** the editor clears the queue in
≤30 minutes a day, and fewer than 1 in 5 approved posts need a caption rewrite.

### 4.5 Weekly dispatch

One artifact, cut three ways: an X thread, a Discord post and an email/push digest. It carries the Season board top 10,
the three best moments, the patch notes of the week, a receipt, and one slot for an ecosystem game from realms.world. It
is assembled automatically from 4.1–4.4 and edited by a person.

### 4.6 Featured Blitz broadcast

One scheduled slot a week, cast live on X and YouTube from the spectator view, then cut into Shorts from the moment
feed. When pillar 4 is ready, one seat goes to a hired agent with its reasoning on screen.

## 5. Each game's role

| Game         | Role in the funnel                                           | Lead content                                                               | Channel weight              |
| ------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------- |
| **Frontier** | Acquisition: free, daily, plays on a phone, safe from attack | Day card, chest moments, season recap, IRL campaigns like Devcon           | X, Shorts, referrals, push  |
| **Blitz**    | Spectacle and the competitive top                            | Broadcasts, Results cards, last-5-minute clips, agents vs. humans          | YouTube, X video, Discord   |
| **Eternum**  | Long arcs and lore (when a season runs)                      | A weekly "war correspondent" chronicle of tribes, wars and Hyperstructures | Threads, long-form, Discord |
| Ecosystem    | Shared audience                                              | One slot in the weekly dispatch                                            | realms.world, X             |

Funnel: a Frontier moment brings a new player in → their Day card brings in friends → the season board and recap give
them a reason to stay → Blitz is where engaged players compete and where viewers watch.

## 6. Channel roles

- **X:** where content is published and where players share. Always native media plus a link. Post 1–3 times a day: the
  best moment, a ritual, and a craft or receipt post when there is one. No "gm" posts and no reply farming.
- **Discord:** the curation hub (the queue), the automatic results feed, and the community. Every post-worthy moment
  appears here first.
- **YouTube:** Shorts as the lasting archive of moments; long-form for broadcasts and devlogs.
- **Telegram:** alerts only (day open, payouts, broadcast starting).
- **TikTok and Reels:** a 4-week test with moment clips. Keep them only if the content produces counted players.
- **Farcaster or Base mini app:** Frontier fits the daily, phone-sized shape, but the evidence is thin and mostly from
  vendors. Defer it until 4.1–4.3 show a share rate worth sending there.
- **docs.realms.party:** the source for AI answer engines (`llm.txt` exists). Add one "Season N in numbers" page per
  season.

## 7. What not to do

- Pay or reward people for posting (X banned it in January 2026, and it attracts slop).
- Lead with LORDS amounts, APY or "earn". Prizes appear as receipts after they're paid.
- Run a mass creator or key program months ahead.
- Pay for TikTok ads for a strategy game.
- Hand-write numbers in posts. Captions take their figures from the same sources the game does, as `AGENTS.md` rule 3
  already requires.

## 8. Measurement

- **North star:** counted players per week from content-attributed links, per artifact type.
- **Share rate:** shares ÷ eligible moments, per card type. The target to beat is the recap deck's current rate, which
  we should measure first.
- **K-factor:** counted friends per sharing player.
- **Cohort retention:** D1 and D7 for content-acquired players versus everyone else. If content brings in players who
  churn faster, change the content, not the targets.
- **Editor load:** minutes a day on the queue.

## 9. Order of work

| When                      | Ship                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Before or at S1 (Nov 9)   | Measure the recap deck's share rate (baseline). Draft the Day card in the app lab.                             |
| Weeks 1–2                 | 4.1 Day card, 4.3 `via` attribution and dynamic previews                                                       |
| Weeks 3–4                 | 4.2 Blitz Results card, 4.4 moment feed and the Discord queue                                                  |
| Weeks 5–8                 | 4.5 weekly dispatch, 4.6 weekly featured Blitz, personal outreach to 15–20 creators, each with a referral link |
| From hired-agents M-ready | Agents vs. humans Blitz, agent leaderboard                                                                     |
| Season end                | A season trailer cut from end maps and the moment archive, and the "Season N in numbers" docs page             |

## 10. Open decisions

1. Does "all of our games" include the ecosystem games on realms.world, or only Frontier, Blitz and Eternum? This plan
   gives the ecosystem one slot a week.
2. Who is the editor? The plan assumes one person for 30 minutes a day.
3. What budget, if any, goes to creators beyond referral links?

## Sources

- [Smithsonian: why Wordle went viral](https://www.smithsonianmag.com/smart-news/heres-why-the-word-game-wordle-went-viral-180979439/)
- [Northeastern: what makes Wordle so great](https://news.northeastern.edu/2022/01/21/what-makes-wordle-so-g-r-e-a-t/)
- [indie-games.eu: short-form video in game marketing (GameDiscoverCo Steam Fan Snapshot)](https://www.indie-games.eu/?p=40375)
- [GameDiscoverCo: everything about short-form video](https://newsletter.gamediscover.co/p/everything-you-want-to-know-about)
- [GameDiscoverCo: why sessionability affects discovery](https://newsletter.gamediscover.co/p/why-sessionability-radically-affects)
- [Cinevva: promoting an indie game with no budget (2026)](https://app.cinevva.com/guides/promote-indie-game-no-budget)
- [Bugnet: YouTube Shorts for indie game marketing](https://bugnet.io/blog/youtube-shorts-for-indie-game-marketing)
- [The Block: Kaito token falls after X bans InfoFi](https://www.theblock.co/post/385805/kaito-token-plummets-x-revises-api-policies-ban-infofi-crypto-projects)
- [Decrypt: X bans InfoFi crypto projects](https://decrypt.co/354736/elon-musks-x-bans-access-infofi-crypto-projects-ai-slop-backlash)
- [Siècle Digital: Musk says X no longer penalises links (Jul 2026)](https://siecledigital.fr/2026/07/31/elon-musk-affirme-que-x-ne-penalise-plus-les-publications-contenant-un-lien-externe/)
- [OpenTweet: does X penalize links in 2026](https://opentweet.io/answers/does-x-penalize-links-2026)
- [data40: gameplay instead of tokens](https://data40.com/articles/gameplay-instead-of-tokens-the-new-era-of-web3-game-marketing/)
- [salmangul: Web3 gaming in 2026](https://salmangul.com/web3-blockchain-gaming-gcc/)
- [Inven Global: 91% of keys produced 8% of views](https://labs.invenglobal.com/articles/25451/blinded-code-blast-to-streamers-fail-proof-creator-campaign-strategies)
- [TechCrunch: Claude plays Pokémon on Twitch](https://techcrunch.com/2025/02/25/anthropics-claude-ai-is-playing-pokemon-on-twitch-slowly)
- [Bankless: Daydreams and onchain agents](https://www.bankless.com/read/daydreams-ai-agents-gaming)
