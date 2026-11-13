# Frontier Season 1: the frozen design

The design the Season 1 build follows, frozen on 2026-11-12. Changes from here go through the playtest.

It describes rules the game does not have yet. For what is live today, read the player docs in `apps/game-docs` and
`apps/game/FEATURE-MAP.md`; each build change updates those as it lands. The build list at the end names every change by
id.

Marks: (new) is a rule the code does not have today; (first value) is a number the playtest will check. Code paths under
`src/` are `contracts/l3/world-native/src/`; `frontier/` is `config/source/frontier/`.

## The season in five lines

1. Every day is one expedition: grow your Realm, send Knights to fight and Scouts to explore, find a spire and go down.
   Armies end with the day.
2. Do the daily quest: its reward pays your Realm. Your armies earn skill points as they fight: at each one, take 1 of 3
   boons for the day, or rest for stamina now.
3. The Deep has 3 sites: the Quarry pays you, the Foundation builds your Aspect's hyperstructure, the Altar stops a
   rival's. Take one, alone or with mates, and hold it.
4. A tick is 120 seconds. Each tick in the Deep, every army gains 1 stamina and loses 200 troops, and a held site pays
   its guards. You hold a site for as long as your troops last.
5. The first hyperstructure to reach a height of 10,000 wins the age, in 50 days at most. A rival's Altar can stop yours
   for a day, until your Aspect ends the bane by doing its bane quest. Money buys stamina above the Deep and the pass,
   never a result in the Deep.

## Every rule a player holds (47 rules, 89 numbers)

| System         | Rule                                                                                                                                                                                                                                                                                | Numbers                                                  | Need                                                     | Payoff                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Day            | A day is 8 to 24 hours with a new map; armies, their boons and relics end with it                                                                                                                                                                                                   | 8–24 h                                                   | A run that fits one day                                  | A late start never loses the season                                      |
| Day            | A season lasts 50 days at most                                                                                                                                                                                                                                                      | 50                                                       | A season short enough to stay a race                     | One end everyone knows                                                   |
| Realm          | Four levels; each adds 1 army, makes armies bigger, gives ×2 castle labor and opens buildings                                                                                                                                                                                       | 2.5k, 15k, 50k, 3 armies, +1 per level, 3k, 9k, 25k, 60k | Growth you can see                                       | Bigger armies hold longer in the Deep                                    |
| Realm          | Eight buildings open by level, each with one job: the Hearth out, the Storeroom in                                                                                                                                                                                                  | 8 buildings                                              | A town that fits a plan                                  | More labor, troops or reach                                              |
| Realm          | The Conscription Hall: +20% troops an hour, −0.2 wheat a troop sent out                                                                                                                                                                                                             | +20%, −0.2                                               | Troops for the Deep                                      | More ticks of holding from the same wheat                                |
| Realm          | A lore ladder at the castle: Well, then Shrine, then Spire (Spire lore lets your armies find spires)                                                                                                                                                                                | 2.5k, 5k, 10k                                            | A gate to the layers below                               | Something to unlock on each of the first three days                      |
| Realm          | The Storeroom doubles the Realm's store of labor and wheat: 1 per Realm, from City, 10,000 labor                                                                                                                                                                                    | ×2, 10,000                                               | A Realm that keeps what it makes while you are away      | 3 to 4 days away kept, from City up                                      |
| Troops         | Knights fight; Scouts explore for 10 stamina (Knights: 20) and deal 25% less damage                                                                                                                                                                                                 | 20, 10, −25%                                             | Two jobs for an army                                     | A split to choose each day                                               |
| Stamina        | An army holds 180 stamina at most and regains 30 an hour; an attack costs 30                                                                                                                                                                                                        | 180, 30                                                  | Every move is a decision                                 | A planned route                                                          |
| Stamina        | Logistics adds 20% of the stamina bar per tier; a Well refills 90 stamina                                                                                                                                                                                                           | +20%, +90                                                | Longer days for a dedicated Realm                        | A bar of 360 at tier 5                                                   |
| Stamina        | At any skill point an army can rest: 20 stamina per rank, now                                                                                                                                                                                                                       | 20 per rank                                              | A use for every point                                    | One more fight in this sitting                                           |
| Skills         | An army that earns a skill point (the first at 60 XP) is shown 3 boons, one from each of its 3 givers, and takes 1 for the day. A boon is the point's rank in steps (1 to 5), 5 steps per boon. Knights are offered War, Ward and Spoils; Scouts are offered Paths, Ward and Spoils | 60 XP, 3 boons, 5 steps                                  | An army that grows during its day                        | A striker, a holder or a finder by evening; a reason to keep playing     |
| Skills         | Charge, the Knights' skill, in every fight: 10 to 50% of the opening hit lands before the other side answers, beast or army                                                                                                                                                         | 10–50%                                                   | A skill of the Knights' own                              | A strike that tilts a fight toward the attacker                          |
| Combat         | One formula; send 150% of the guard's troops to win; guards keep their losses                                                                                                                                                                                                       | 1.5×                                                     | A fight you can read before you commit                   | Several armies, yours or your mates', share a guard                      |
| Combat         | Armies fight other armies in the Deep only, and never an ally's                                                                                                                                                                                                                     | —                                                        | A contest with people                                    | Fights where the stakes are                                              |
| Map            | The day's spire: a 10% chance on a layer's first reveal, +10% on each next reveal, so it is found within 10 reveals; 1 per layer per day                                                                                                                                            | 10%, 10 reveals                                          | A way down with a known cost                             | About 110 stamina to the Deep, every day                                 |
| Map            | 5 kinds of guard, each with one kind of reward: wheat, XP, labor, Essence, a relic; guards are ×2 on each layer down                                                                                                                                                                | ×2 per layer                                             | A glance says what a fight is for                        | Targets picked by need                                                   |
| Map            | A ruin's beast is as big as its relic is rare: 1,000, 2,500, 5,000, 10,000 or 25,000                                                                                                                                                                                                | 1,000, 25,000                                            | No big fight for a small prize                           | You see the beast, you know the relic                                    |
| Map            | A Troll camp your Realm cleared is a supply post: armies next to it are refilled with troops                                                                                                                                                                                        | —                                                        | Reinforcing below the Surface                            | A full army at the door of the Deep                                      |
| Relics         | 5 relics, 3 per army; a 4th replaces one you choose                                                                                                                                                                                                                                 | 3                                                        | Power you time yourself                                  | A loadout spent in the fight it was built for                            |
| Relics         | Each relic gains 1 step per tier and works 30 minutes per tier: Blade +10% damage, Ward −5% damage taken, Plunder +20% loot, Tome +40% XP, Far-Eye 6 tiles revealed                                                                                                                 | +10%, −5%, +20%, +40%, 6 tiles, 30 min                   | Rarity that means something                              | A rarer relic is plainly better                                          |
| Quest          | 1 quest per day, the same for everyone, from a set of 7: each comes 1 time per week                                                                                                                                                                                                 | 7                                                        | A reason to play today                                   | A day unlike yesterday                                                   |
| Quest          | Its count is the quest's base count times the Realm's level (1 to 4)                                                                                                                                                                                                                | a base count, × level                                    | A quest sized to your Realm                              | Every level is asked a fair share                                        |
| Quest          | Its reward is 1,000 labor and 1,500 Essence, ×2 at each Realm level                                                                                                                                                                                                                 | 1,000, 1,500, ×2 per level                               | Resources for the Realm                                  | The next building or level sooner                                        |
| Banes          | From day 2 the mist rolls for a world bane at the start of each day, on all 4 Aspects: 0% the day after one, +20% for each day without one. It stops for the season when the first team bane is issued                                                                              | +20%                                                     | A hardship everyone faces before teams punish each other | A day nobody could predict; 1 to 3 in a season                           |
| Banes          | Holding the Altar fills your Aspect's bar, +5 each tick; at 1,500 a team bane is issued, and it starts at the start of the next day                                                                                                                                                 | 1,500                                                    | A way to stop a rival                                    | A rival's hyperstructure stopped while you play                          |
| Banes          | The team bane hits the Aspect that is first on the board; if it already has a team bane, the next one. An Aspect never has both banes                                                                                                                                               | —                                                        | Pressure on the leader                                   | A race that stays open                                                   |
| Banes          | A team bane does one thing: its Aspect's hyperstructure doesn't grow. A world bane affects everyone: Blood Moon (beasts +50%), Mist Tide (stamina regenerates at 50%), Ash Fall (production at 50%)                                                                                 | +50%, 50%                                                | A harm worth answering                                   | The Altar is worth a hold; a world bane is a day to rally                |
| Banes          | Under a bane, the bane quest replaces the daily quest and pays the daily reward: the Stand (guarded sites cleared), the Lights (tiles revealed) or the Cull (guard troops beaten). Every Realm can finish them on the Surface                                                       | 3 × level, 20 × level, 2,500 to 15,000                   | A bane answered by playing                               | Most of a sitting, played a different way each time                      |
| Banes          | A bane lasts 1 day at most. The Aspect ends it when the members who finished the quest reach 25% of those who sent out an army the day before. Ending a world bane pays the daily reward a second time; ending a team bane makes the hyperstructure grow again                      | 1 day, 25%                                               | A bane that always ends                                  | A day to call your Aspect in, with the number on the banner: "4 of 6"    |
| Deep           | One fixed, shared map: its sites stand where everyone sees them                                                                                                                                                                                                                     | —                                                        | A place every Realm meets                                | No search: straight to the fight                                         |
| Deep           | Three sites, always there, never used up: the Foundation (my team), the Quarry (me), the Altar (against a rival)                                                                                                                                                                    | 3                                                        | Something to fight for, and a say in what                | My growth, my team's, or a rival's loss                                  |
| Deep           | Each day, each site starts guarded by a beast of 10,000; a hold ends when the guard has no troops left, a rival beats it, or the day ends                                                                                                                                           | 10,000                                                   | A first fight every day                                  | A site two Cities take together                                          |
| Deep           | Each tick a site is held, it pays its guards: the Foundation 5 Glory and +5 height, the Quarry 500 labor and 500 Essence, the Altar 5 Glory and +5 on the bane bar                                                                                                                  | 5, 500                                                   | A reason to hold                                         | Every tick counts                                                        |
| Deep           | A tick is 120 seconds. Each tick in the Deep an army gains 1 stamina and loses 200 troops                                                                                                                                                                                           | 120 s, 200                                               | Nobody camps                                             | A trade on one clock; you hold as long as your town's troops last        |
| Deep           | A site's guard has 4 slots, 1 per player, from the holder's Aspect; every slot loses its 200 troops each tick; each tick's pay is split by troops; mates take a site together                                                                                                       | 4                                                        | Holding as a team act                                    | A City takes a site with a mate; a full site is too strong for one army  |
| Deep           | A push when a site held by another Aspect can be taken by your largest army; at most 1 per site per day                                                                                                                                                                             | —                                                        | No waiting on screen                                     | You come back for the moment a site can be taken                         |
| Hyperstructure | Only holding the Foundation adds height; nothing for troops beaten                                                                                                                                                                                                                  | —                                                        | Reward the interactive                                   | A fight is for taking the site                                           |
| Hyperstructure | The hyperstructure has a height of 10,000, in 5 stages of 2,000. Each of the first 4 stages gives the Aspect a Triumph the next day, above the Deep: Clear Mist, Second Wind, Pale Moon, Spoils                                                                                     | 10,000, 2,000, 4 Triumphs                                | A project to see rise                                    | A day the whole Aspect shares, four times a season                       |
| Hyperstructure | The first finished wins and ends the age; on the last day the mist wins                                                                                                                                                                                                             | —                                                        | One winner a season                                      | One condition anyone can say                                             |
| Aspects        | Four Aspects of four Orders; pick freely, invite friends; allies can't attack each other                                                                                                                                                                                            | 4                                                        | A team to play for                                       | Friends on the same side                                                 |
| Money          | A credit costs 1 cent and gives 2 points of stamina outside the Deep; on the web it is paid in LORDS at the day's price                                                                                                                                                             | 1 cent, 2 points                                         | A way to pay that buys time                              | Back in the field sooner                                                 |
| Money          | A quest reroll 50 credits; a name, banner line or badge 200                                                                                                                                                                                                                         | 50, 200                                                  | Small sinks                                              | A bad quest redrawn; a look                                              |
| Money          | The pass, $9.99, or $4.99 for a holder: 150% of the daily quest's labor, credits, a skin. A held Realm or a Devcon ticket has the labor bonus free; a held Wonder or a golden ticket has the credits free too                                                                       | $9.99, $4.99, +50%                                       | A reason to play every day                               | More labor from every quest                                              |
| Money          | The pass also pays 10 credits for each daily quest done, and gives the Season 1 Realm skin, worn by choice                                                                                                                                                                          | 10                                                       | Value for playing daily                                  | A count that moves every day; a look that stays                          |
| Rewards        | 500,000 LORDS when the age ends: 100,000 to the Aspect that finishes, 400,000 shared by the height each Aspect built                                                                                                                                                                | 500k, 100k, 400k                                         | A stake for the whole Aspect                             | Every point of height is worth the same; finishing is worth 100,000 more |
| Rewards        | Glory, the one score a member reads: 5 each tick at the Foundation or the Altar, split by troops. It sets a member's share of its Aspect's reward; paid to anyone with 100 Glory, no other gate                                                                                     | 100                                                      | A fair share for each member who went down               | LORDS in your wallet when the age ends                                   |

## The systems and their numbers

### 1. Clock

- **Need:** A run that fits one day, and a season short enough to stay a race.
- **Gets you to:** Plan each day as one expedition: armies, their boons and their relics live one day.
- **Payoff:** A 24 h day gives an army 900 stamina (180 + 24 × 30), an 8 h day 420.
- **Depth:** Day lengths come shuffled, 8 to 24 h, so no two days play the same.
- **Choices:** None, by design: the clock is the same for everyone.
- **Against today:** The clock is today's. The season's length is set, the stamina bar is longer, and the Deep runs on
  the army tick.

| Timer                  | Season 1                                                                                                               | In code today                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Army tick              | **a tick is 120 seconds.** +1 stamina each tick: 30 an hour                                                            | the same · `frontier/clock.ts:1`                                                  |
| Day                    | 2 to 6 units of 4 h: 8 to 24 h, 16 h on average                                                                        | the same · `src/days.cairo:1-4,75-81`                                             |
| Bag                    | 5 days, one of each length: 80 h                                                                                       | the same · `src/days.cairo:12-15`                                                 |
| Season                 | **50 game days at most** (10 bags); it ends sooner when the first hyperstructure is finished                           | unset: `durationSeconds` 0; the live record is 10 days · `frontier/base.ts:62-68` |
| Stamina, empty to full | 6 h (a bar of 180)                                                                                                     | 4 h (120)                                                                         |
| The Deep's tick (new)  | the army tick: +1 stamina, −200 troops, and a held site pays                                                           | —                                                                                 |
| The mist's banes (new) | a roll at the start of each day from day 2: +20% for each day without one. It stops when the first team bane is issued | —                                                                                 |

Watch in the playtest:

- **A short day still works with no store on a site:** a hold ends with the day, as every army does, and a shorter day
  pays every Aspect fewer ticks alike.

Sources: `frontier/clock.ts:1-2`, `src/days.cairo:1-15,67-81`

### 2. Realm

- **Need:** Growth you can see, and one place that says what you can build next.
- **Gets you to:** Choose between levelling up and building more now: both cost labor.
- **Payoff:** Each level adds an army, multiplies its size by 2.4 to 3, doubles the castle's labor and opens new
  buildings.
- **Depth:** The prices grow faster than the income: the next level always competes with the next building.
- **Choices:** Level up or build: a real choice at every level.
- **Against today:** The level stays the one spine. New: the castle pays by level, buildings open by level, each level's
  labor store holds the next level's price, and the daily quest replaces the daily claim.

| Level      | Labor to reach | Plots | Armies | Max army | Castle labor an hour | Labor store | It opens                         |
| ---------- | -------------- | ----- | ------ | -------- | -------------------- | ----------- | -------------------------------- |
| Settlement | start          | 6     | 3      | 3,000    | 100                  | 5,000       | Farm, Workshop, Barracks         |
| City       | 2,500          | 18    | 4      | 9,000    | 200                  | 15,000      | Scouts' Lodge, Conscription Hall |
| Kingdom    | 15,000         | 36    | 5      | 25,000   | 400                  | 50,000      | War Hall, Supply Yard            |
| Empire     | 50,000         | 60    | 6      | 60,000   | 800                  | 100,000     | the largest army                 |

Level prices 2,500 / 15,000 / 50,000 (tune): sized for a 50-day season. Today: 4,000 / 15,000 / 40,000, castle labor
100.8 an hour at every level (`frontier/base.ts:28-32`), training buildings gated by research. Plots, armies, army sizes
and the troop and wheat stores are today's. A level-up spends its whole price at once
(`src/logic/construction.cairo:241-297`), so each level's labor store holds the next level's price. **A City goes to the
Deep**: with a mate's army it takes a site (see the Deep).

| Item         | Season 1                                                                      | In code today                                                                                              |
| ------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Castle labor | 100 / 200 / 400 / 800 an hour by level                                        | 100.8 an hour · `frontier/base.ts:28-32`                                                                   |
| Start        | **3,000 Knights in two armies of 1,500**, 6,000 wheat, 2,000 labor, 0 Essence | 1,500 Knights, 4,500 wheat · `frontier/base.ts:71-75`                                                      |
| Daily reward | the daily quest, for every home                                               | one claim of 1,000 labor, none for a free home · `frontier/native.ts:124`, `src/logic/entry.cairo:172-231` |
| Population   | none                                                                          | base 6, +6 a Hut                                                                                           |

#### The daily quest (new)

- **Need:** A reason to play today, and a day that asks for something different from yesterday.
- **Gets you to:** Do the day's action: hunt, break camps, close rifts, seek relics, earn skill points, find sites, map.
- **Payoff:** Labor and Essence for your Realm, sized to it.
- **Depth:** Seven quests in a bag, one of each a week, each a plain count: its base count times your Realm level (1 to
  4).
- **Choices:** Do the quest first or play your own day; which armies to spend on it.
- **Against today:** It replaces the daily claim. The grant that pays labor and Essence exists
  (`src/logic/entry.cairo:237-268`); it is paid once, when the count is reached.

| One quest a day, the same for everyone | Season 1                                                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| The quest                              | drawn from a bag of the seven below: each comes once a week, never the same two days running                                                  |
| Its size                               | the quest's base count × your Realm level: a City clears 2 Troll camps, an Empire 4                                                           |
| Done                                   | you collect its reward by hand: it pays your Realm. On a day your Aspect is under a bane, the bane quest replaces it (see Banes and Triumphs) |
| No unlock needed                       | **every quest can be done by every Realm from day 1**: none asks for a lore, a building or a layer                                            |

| Quest             | It counts                             | Base count (× level) |
| ----------------- | ------------------------------------- | -------------------- |
| **The Hunt**      | Cyclops herds or Wraith bands cleared | 1                    |
| **Camp-breakers** | Troll camps cleared                   | 1                    |
| **Rift-closers**  | Dark fey rifts cleared                | 1                    |
| **Relic-seekers** | ruins found                           | 1                    |
| **Veterans**      | skill points earned                   | 1                    |
| **Pathfinders**   | finds made, of any kind               | 2                    |
| **Cartographers** | tiles revealed                        | 15                   |

| The quest's reward (tune)                                       | Settlement    | City          | Kingdom       | Empire         |
| --------------------------------------------------------------- | ------------- | ------------- | ------------- | -------------- |
| Done: 1,000 labor and 1,500 Essence, ×2 at each Realm level     | 1,000 + 1,500 | 2,000 + 3,000 | 4,000 + 6,000 | 8,000 + 12,000 |
| With the labor bonus (the pass, or a holder): 150% of the labor | 1,500         | 3,000         | 6,000         | 12,000         |

| A new Settlement finishes, with the whole day's stamina (on two bars) | Round 42: 1,500 Knights, one army | **Now: 3,000 Knights in two armies** | … and camp and rift guards at 1,000 |
| --------------------------------------------------------------------- | --------------------------------- | ------------------------------------ | ----------------------------------- |
| The Hunt: 1 herd or band                                              | 92% (69%)                         | 100% (94%)                           | 100% (93%)                          |
| Camp-breakers: 1 camp                                                 | 64% (19%)                         | 90% (43%)                            | 97% (83%)                           |
| Rift-closers: 1 rift                                                  | 57% (0%)                          | 84% (10%)                            | 97% (83%)                           |
| Relic-seekers: 1 ruin found (cleared)                                 | 73% (45% cleared)                 | 93% (71% cleared)                    | 93% (70%)                           |
| Veterans: 1 skill point                                               | 100% (84%)                        | 100% (99%)                           | 100% (100%)                         |
| Pathfinders: 2 finds                                                  | 100%                              | 100%                                 | 100%                                |
| Cartographers: 15 tiles                                               | 100%                              | 100%                                 | 100%                                |

| The count is found in a day                 | Reveals a day | Camp-breakers, Rift-closers | Relic-seekers | The Hunt |
| ------------------------------------------- | ------------- | --------------------------- | ------------- | -------- |
| City (× 2): 2 Knight armies, 1 of Scouts    | 82            | 84%                         | 71%           | 96%      |
| Kingdom (× 3): 2 Knight armies, 2 of Scouts | 132           | 90%                         | 76%           | 99%      |
| Empire (× 4): 2 Knight armies, 3 of Scouts  | 182           | 94%                         | 80%           | 100%     |

**What held a new Settlement back was finding, not fighting.** One Knight army makes about 25 reveals in a day: it finds
a camp two days in three, whatever the camp's guard. So the lever is the starting troops: **3,000 Knights in two
armies**, two bars, twice the reveals, and a second army to finish a guard the first one wore down. With it every kind
passes 80% with today's guards. **Relic-seekers counts ruins found:** half the Surface's ruins are beyond a Settlement
(an Uncommon beast is 2,500), and finding the ruin is the quest; clearing it pays the relic. Smaller camp and rift
guards would lift the two-bar numbers too; they would also cut what a camp and a rift pay, so they stay as they are.

A Settlement finds a Troll camp on 86% of days and a City two on 91%. Each quest comes 7 times in a 50-day season; its
count grows with the Realm, so the same quest asks more each time you level. **One quest for everyone, and a new
Settlement can finish every kind in its day** (see the table). Nothing depends on the Realm but the count. **Descent and
Pilgrims left the bag:** each needed a lore, so a Realm without it had no quest that day. Veterans (earn a skill point:
any army does, by fighting) and Pathfinders (find 2 sites: any reveal can) replace them; a shrine or a spire still
counts, so the lores help and are never needed. Once the quest is done, the day is yours.

#### The interface opens as you play (new)

- **Need:** A first session that shows about seven things, not twenty-two.
- **Gets you to:** Play. Each new part of the screen arrives when you first earn or unlock what it is for, with one line
  that explains it.
- **Payoff:** Nothing on screen that you can't use yet; every new thing comes with its reason.
- **Depth:** The order is the game's own: what you earn decides what you see. No timer, no forced steps.
- **Choices:** None: it follows what you do. One setting shows everything at once.
- **Against today:** No tutorial exists in the game. It lights the first plot to build on, hides what a state doesn't
  have, and links to a guide on the docs site.

| When you first…                         | This appears                                                                                                                                                                                   | The one line that explains it                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| launch the game                         | **7 things:** your Realm and its level · labor and wheat · a lit plot to build on · your 2 armies of Knights, each with its stamina · the map and its mist · the day's quest · the day's clock | "This is your Realm. Build on the lit plot, then send an army into the mist."                                      |
| build a Barracks                        | troops at home; the list of buildings for your Realm level                                                                                                                                     | "A Barracks raises 100 Knights an hour. Knights fill your armies."                                                 |
| find a guard                            | the guard's card and the fight preview                                                                                                                                                         | "Send 150% of the guard's troops to win."                                                                          |
| win a fight                             | XP on the army's card                                                                                                                                                                          | "Armies earn XP by fighting. Enough XP gives a skill point."                                                       |
| earn a skill point                      | the boon sheet: 3 boons, and rest                                                                                                                                                              | "Take 1 boon for today, or rest for stamina now."                                                                  |
| collect a quest reward, or earn Essence | Essence; the Research page; the Today page with the week's quests                                                                                                                              | "Essence buys research and lores."                                                                                 |
| run out of stamina                      | the shop: credits                                                                                                                                                                              | "Stamina refills 30 an hour. A credit refills 2 points now."                                                       |
| find a relic                            | the army's 3 relic slots                                                                                                                                                                       | "A relic works for 30 minutes per tier. An army carries 3."                                                        |
| buy Well, Shrine or Spire lore          | wells, shrines, or the spire's odds, on the map                                                                                                                                                | "Your armies can now find wells." · "… shrines." · "Each reveal adds 10% to the odds of the spire. It leads down." |
| go down a spire                         | the layer switch; supply posts, at the first camp cleared below                                                                                                                                | "Guards are ×2 on each layer down. A cleared camp refills your armies."                                            |
| reach City                              | Scouts; the Storeroom and the Conscription Hall in the building list                                                                                                                           | "Scouts reveal for 10 stamina, not 20."                                                                            |
| enter the Deep                          | the 3 sites and their slots; each army's troops draining; your Glory; the Aspect page; the offer to turn the site alert on                                                                     | "Every tick (120 seconds) here, each army loses 200 troops. Hold a site to earn."                                  |
| have a bane on your Aspect              | the bane's banner and its bane quest; the Aspect page, if not yet open                                                                                                                         | "A bane. Today's quest is the bane quest. Your Aspect ends the bane when enough members finish it."                |

| Things on screen                  | Minute 0 | Minute 5 | Day 3, a daily player | After the Deep and the first bane |
| --------------------------------- | -------- | -------- | --------------------- | --------------------------------- |
| Before: everything from the start | 22       | 22       | 22                    | 22                                |
| **Opening as you play**           | **7**    | 12       | 18                    | all                               |

**Never a gate.** A thing appears because of what the Realm holds or has done, read from the game's state, never from a
tutorial step: a returning player, or one who skipped every line, sees everything already earned. A line shows once per
account. An experienced player turns on **Show everything** in Settings. The Aspect is picked at founding, before the
game opens; its page appears with the Deep, the first bane or the first stage built, whichever comes first.

**In the code** (`origin/next`, `apps/game/src/ui/features/frontier/`). **Reused:** the first build, lit on the board
and opened in the build sheet (`build/first-build.ts:12-16`); a place bar that already hides what a state lacks: no
Research for a spectator, the layer switch only once the Realm has an Ethereal layer (`hud/frontier-nav.tsx:28-35`); the
locked look with one line saying what a thing waits on (`build/build-view.tsx:77,335`, `research/research-tree.ts:520`);
the "+N XP" flourish (`attributes/progress-moment.ts:5-9`); the guide link in the Menu (`hud/menu-page.tsx:17,35`).
**New:** one table, each part of the screen with the state that shows it; the one line, shown once; the Show everything
setting. There is no onboarding, hint or tutorial code to replace.

**Day 1 with it: a new Settlement, 9 minutes.** 0:00 seven things, one line: build on the lit plot. 0:30 Workshop,
Barracks, Farm with the 2,000 labor; troops at home appear. 1:30 the quest: Veterans, 1 skill point; both armies go into
the mist. 3:00 a Cyclops herd: the guard's card and the fight preview appear; won, 1,400 wheat. XP appears and passes
60: the first skill point, and its 3 boons. The quest is done: its reward brings Essence and the Research page. **5:00:
twelve things.** 6:00 a Common ruin (beast 1,000), the two armies one after the other: the first relic, and its 3 slots
appear. 8:00 both armies are out of stamina: the shop appears. **9:00: fourteen things, each one met with its line.**

Watch in the playtest:

- **A plain count can be out of reach on a day:** a Settlement finds no Troll camp on 1 day in 7. A reroll (50 credits)
  or the next day's draw answers it.

Sources: `frontier/base.ts:96-139`, `frontier/native.ts:84-85,124`, `src/logic/entry.cairo:172-268`,
`src/logic/construction.cairo:241-297`

### 3. Buildings

- **Need:** Turn labor into an engine: more labor, more troops, better armies.
- **Gets you to:** Decide what the next plot and the next labor go to.
- **Payoff:** A board that fits your plan: more Barracks to hold longer in the Deep, more Lodges to find more, Workshops
  to build faster.
- **Depth:** Every next copy costs more (1×, 2×, 5×, 10×, 17×, 26× the first), so one more Workshop competes with the
  next level and with the research that upgrades every copy.
- **Choices:** Which building, which copy, which research tier, or level up instead.
- **Against today:** Eight buildings, each opened by the Realm level, each with one job. New: the Conscription Hall, and
  the Storeroom, which doubles your store. Huts, the Hearth, the Forge and the research gates go.

| Building                | Its one job                                                                                                                                | Opens at   | First one costs             | More than one | Its research row          | Each tier                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------- | ------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Castle                  | **Makes labor, and decides what your armies can find.** 100 / 200 / 400 / 800 an hour by level                                             | start      | the level-ups               | —             | lore: Shrine, Well, Spire | a lore makes that find possible                                                                      |
| Farm                    | **Feeds the armies.** 300 wheat an hour                                                                                                    | Settlement | 500 labor                   | yes           | Fields                    | +20% wheat: 600 an hour at tier 5                                                                    |
| Workshop                | **Makes labor.** 200 an hour                                                                                                               | Settlement | 1,000 labor                 | yes           | Tools                     | +20% labor: 400 an hour at tier 5                                                                    |
| Barracks                | **Raises Knights.** 100 an hour                                                                                                            | Settlement | 500 labor                   | yes           | Charge (new)              | Knights strike first: 10 / 20 / 30 / 40 / 50% of the opening hit lands before the other side answers |
| Scouts' Lodge           | **Raises Scouts.** 100 an hour                                                                                                             | City       | 500 labor                   | yes           | Scouting                  | +10 / 15 / 20 / 25 / 30% to the odds of one kind of find: camps, rifts or sanctuaries                |
| Storeroom (new)         | **Doubles your Realm's store of labor and of wheat,** so the town keeps what it makes while you are away. The Realm's level is its upgrade | City       | 10,000 labor                | 1 per Realm   | —                         | no research, no upgrade of its own                                                                   |
| Conscription Hall (new) | **Raises more troops from the same wheat.**                                                                                                | City       | 5,000 Essence + 1,000 labor | one           | Conscription              | +20% troops an hour on every Barracks and Lodge, −0.2 wheat a troop sent out                         |
| War Hall                | **Makes every army hit harder.**                                                                                                           | Kingdom    | 5,000 Essence + 1,000 labor | one           | Battle                    | +10 / 25 / 45 / 70 / 100% damage                                                                     |
| Supply Yard             | **Makes every army's bar longer.**                                                                                                         | Kingdom    | 5,000 Essence + 1,000 labor | one           | Logistics                 | +20% of the bar: 360 at tier 5                                                                       |

A research row needs its building standing; a hall's price is its row's tier 1; the castle's lores need none. **Today:**
Huts (population), the four training buildings behind two Barracks research purchases, a Lodge that trains nobody, a
Workshop at 2,000, and a Hearth. Conscription is today's Barracks row with its two sides, Drill and Rations, made one
row on its own hall (`src/buildings.cairo:129-131`, `src/research.cairo:26`): the Barracks' row is Charge.

| What each one costs, in labor | 1st   | 2nd   | 3rd   | 4th    | 5th    | 6th    |
| ----------------------------- | ----- | ----- | ----- | ------ | ------ | ------ |
| Farm, Barracks, Scouts' Lodge | 500   | 1,000 | 2,500 | 5,000  | 8,500  | 13,000 |
| Workshop                      | 1,000 | 2,000 | 5,000 | 10,000 | 17,000 | 26,000 |

| The Storeroom: days away before the labor store is full | The town makes, a day | Labor store | Without a Storeroom | With it      | Its 10,000 labor is       |
| ------------------------------------------------------- | --------------------- | ----------- | ------------------- | ------------ | ------------------------- |
| Settlement                                              | 4,800                 | 5,000       | 1 day               | not open yet | —                         |
| City                                                    | 9,600                 | 15,000      | 1.6 days            | **3.1 days** | 1 day of the town's labor |
| Kingdom                                                 | 26,900                | 50,000      | 1.9 days            | **3.7 days** | 0.4 day                   |
| Empire                                                  | 51,200                | 100,000     | 2 days              | **3.9 days** | 0.2 day                   |

**One rule for every building, today's:** the nth costs the first one's price × (1 + (n−1)²). Demolition refunds half
the labor. The Workshop's first price is 1,000, from 2,000: a new Realm builds a Workshop, a Barracks and a Farm with
its 2,000 labor in its first minute: 1,000 + 500 + 500. **Farm, Barracks and Lodge start at 500**, where the code has
400 (`frontier/base.ts:17-22`).

**The Storeroom doubles your Realm's store** of labor and of wheat. 1 per Realm, 1 plot. It has no upgrade of its own:
when the Realm levels up, the store it doubles is bigger. **It opens at City and costs 10,000 labor:** 1 day of a City's
labor, 2/3 of its whole store, the most expensive building a City can build. It can't be cheap where it opens. **A late
buyer pays the same 10,000** (0.4 day of a Kingdom's labor, 0.2 of an Empire's), as with every building: a price that
doesn't change is the simplest, and whoever waited went without it. **A Kingdom back after 10 days** finds 100,000 labor
(50,000 without a Storeroom): Empire at once, and 50,000 more. The troop store is unchanged: 2 full armies.

**In the code** (`origin/next`). The store's limit is the level's store plus research steps
(`src/logic/resources.cairo:48-74`): it becomes the level's store, ×2 while a Storehouse stands. The engine's Storehouse
is already in Frontier's building list, free and with no effect on a board (`frontier/native.ts:11`,
`frontier/base.ts:16-21,46`, `src/logic/construction.cairo:342`): it gets its price, its City level, and the 1-per-Realm
check the training buildings have (`construction.cairo:417-430`). The store side of the Farm's and the Workshop's
research goes (`src/research.cairo:25-27`).

| Troops in a 16 h day | Troop homes | No Conscription | Tier 3 | Tier 5 | … which is, in the Deep   |
| -------------------- | ----------- | --------------- | ------ | ------ | ------------------------- |
| City                 | 4           | 6,400           | 10,240 | 12,800 | 32 to 64 ticks of holding |
| Kingdom              | 7           | 11,200          | 17,920 | 22,400 | 56 to 112 ticks           |
| Empire               | 11          | 17,600          | 28,160 | 35,200 | 88 to 176 ticks           |

**Troops are what the Deep spends:** every tick there costs an army 200. A Realm holds for as many ticks a day as its
town raises troops ÷ 200, awake or asleep. That is what a Barracks and Conscription are for now, and what bounds an
account that never sleeps.

Watch in the playtest:

- **Wheat is the army's other price:** 2 wheat a troop sent out, 1 with Conscription 5; 2 Farms feed 3 Barracks. Cyclops
  herds pay wheat (see Sites).

Sources: `frontier/base.ts:16-47,89-92`, `src/buildings.cairo:129-131,204-215`,
`src/logic/construction.cairo:398-430,671-677`

### 4. Research

- **Need:** A goal for Essence, and the tier every army starts its day with.
- **Gets you to:** Clear rifts, explore and hold the Quarry for Essence, then pick the row that fits how you play.
- **Payoff:** Each army is created with the Realm's tiers: research is the part of an army that outlives the day.
- **Depth:** Seven rows and a lore ladder of three: 1.0M Essence, 11 days of an Empire's income and 36 of a City's.
  Early you specialise, late you finish.
- **Choices:** Which row next. Every row upgrades one building.
- **Against today:** One row a building, and one ladder in round numbers. Charge, Conscription and Spire lore are new;
  the Hut and Hearth rows, Depth research and the store side of the Farm's and the Workshop's rows go: storing is a
  building now.

| Row                                        | Belongs to                          | T1        | T2         | T3          | T4        | T5         | Row total (Essence / labor) |
| ------------------------------------------ | ----------------------------------- | --------- | ---------- | ----------- | --------- | ---------- | --------------------------- |
| Fields                                     | Farm                                | 500 / 500 | 1k / 1k    | 2.5k / 2.5k | 5k / 5k   | 10k / 10k  | 19k / 19k                   |
| Tools                                      | Workshop                            | 500 / 500 | 1k / 1k    | 2.5k / 2.5k | 5k / 5k   | 10k / 10k  | 19k / 19k                   |
| Charge (new)                               | Barracks                            | 5k / 1k   | 10k / 2.5k | 25k / 5k    | 50k / 10k | 100k / 25k | 190k / 43.5k                |
| Scouting                                   | Scouts' Lodge                       | 5k / 1k   | 10k / 2.5k | 25k / 5k    | 50k / 10k | 100k / 25k | 190k / 43.5k                |
| Conscription (new)                         | Conscription Hall                   | 5k / 1k   | 10k / 2.5k | 25k / 5k    | 50k / 10k | 100k / 25k | 190k / 43.5k                |
| Battle                                     | War Hall                            | 5k / 1k   | 10k / 2.5k | 25k / 5k    | 50k / 10k | 100k / 25k | 190k / 43.5k                |
| Logistics                                  | Supply Yard                         | 5k / 1k   | 10k / 2.5k | 25k / 5k    | 50k / 10k | 100k / 25k | 190k / 43.5k                |
| Well lore → Shrine lore → Spire lore (new) | the castle: a ladder, in this order | 2.5k      | 5k         | 10k         | —         | —          | 17.5k / 0                   |

| Effect                      | Each tier                                                                                                                                          | At tier 5          | In code today                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| Fields / Tools              | +20% of base output                                                                                                                                | ×2                 | a choice at each tier between output and storage · `frontier/native.ts:79-80` |
| Charge (new), Knights       | 10 / 20 / 30 / 40 / 50% of the opening hit lands before the guard answers                                                                          | 50%                | —                                                                             |
| Scouting, Scouts            | +10 / 15 / 20 / 25 / 30% to one kind's odds: camps, rifts or sanctuaries                                                                           | ×2                 | the same, for every army                                                      |
| Conscription (new)          | +20% troops an hour, −0.2 wheat a troop sent out                                                                                                   | ×2 troops, 1 wheat | Drill and Rations, the Barracks row's two sides                               |
| Battle, every army          | +10 / 25 / 45 / 70 / 100% damage                                                                                                                   | +100%              | the same                                                                      |
| Logistics, every army       | +20% of the bar                                                                                                                                    | 360: the bar ×2    | +20 / 45 / 75 / 110 / 150 flat                                                |
| Well lore, then Shrine lore | your armies recognise wells (2,500 Essence), then shrines (5,000), 3% a reveal each: a daily player has the first on day 1 and the second on day 2 | —                  | shrines 2,000 and wells 6,000, in any order · `frontier/native.ts:97-98`      |
| Spire lore (new)            | your armies can find spires (10,000 Essence), after the two others: day 3 for a daily player, day 2 for the most active                            | —                  | Depth research I to III, 850k                                                 |

**The whole tree: 1.0M Essence and 0.26M labor** (today 3.84M and 0.80M; the last round 3.6M, 39 Empire days: longer
than the season). The ladder is 5,000 / 10,000 / 25,000 / 50,000 / 100,000 Essence (tune), where the code has 6k / 16k /
48k / 144k / 360k (`frontier/native.ts:87-105`). Research is copied into an army when it is created.

**Research is where an army starts; boons are how far it goes in a day.** A boon's steps add to what research gives, so
the two never repeat each other (see Army boons).

Watch in the playtest:

- **The tree fits the season:** an engaged Realm finishes it around day 30; a casual one picks two or three rows. After
  it, Essence has no sink but the next season: watch it.

Sources: `frontier/native.ts:14-26,87-105`, `src/research.cairo:12-26,95-104`, `src/rules.cairo:9-80`

### 5. Troops

- **Need:** Two jobs that play differently: one army to win fights, one to open the map.
- **Gets you to:** Split your 3 to 6 army slots between fighters and explorers each day.
- **Payoff:** A Scout reveals two tiles for the stamina a Knight spends on one; a Knight wins the fights a Scout can't.
- **Depth:** The split changes with the day: Scouts to find the spires and the ruins, Knights for the fights and the
  Deep.
- **Choices:** How many slots each, and how many Barracks or Lodges on the board.
- **Against today:** Today there is one troop, the Knight. Scouts are new: the Paladin army, raised by the Scouts'
  Lodge.

| Troop       | Its line                  | Home                     | An hour        | Sent out for    | Damage | Explore · move      | Its own research |
| ----------- | ------------------------- | ------------------------ | -------------- | --------------- | ------ | ------------------- | ---------------- |
| Knight      | **Knights strike first.** | Barracks, from the start | 100 a Barracks | 2 wheat a troop | full   | 20 · 10 stamina     | Charge           |
| Scout (new) | **Scouts find more.**     | Scouts' Lodge, from City | 100 a Lodge    | 2 wheat a troop | −25%   | **10** · 10 stamina | Scouting         |

**You start with 3,000 Knights, in two armies of 1,500.** One of them wins the first fight in one hit (a Cyclops herd of
300 to 400, 155 lost) and bring home 1,400 wheat. Scouts open at City, when there is a spire to look for. **In code:**
`create_explorer` already accepts a Paladin army (`src/logic/troops.cairo:705-748`); the Lodge must produce it
(`src/buildings.cairo:204-215`); the two Scout traits are new. One tier of troops, as today
(`frontier/base.ts:139-142`).

Watch in the playtest:

- The reveal reward counts at most 10,000 troops, which keeps a big Scout army from being an Essence engine without
  limit.

Sources: `src/troops.cairo:10-32,254-304`, `frontier/base.ts:27-32,49-52,139-142`

### 6. Armies and stamina

- **Need:** A budget that makes every move a decision.
- **Gets you to:** Choose, tile by tile, between revealing, walking and fighting.
- **Payoff:** A planned route: a full bar is 18 Scout reveals, or 6 attacks, or an 18-tile walk, and Logistics doubles
  it.
- **Depth:** The bar refills in 6 h, so what you spend now you miss tonight. In the Deep the same tick that refills it
  costs 200 troops.
- **Choices:** Every action draws on the same bar.
- **Against today:** The bar goes from 120 to 180, Logistics doubles it, a Well refills 90 stamina, a skill point rested
  gives 20 per rank, stamina is bought only outside the Deep, and an army can be reinforced beside a Troll camp its
  Realm cleared.

| Rule                   | Season 1                                                                                            | In code today                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Armies · max army      | 3 / 4 / 5 / 6 · 3k / 9k / 25k / 60k by level                                                        | the same · `frontier/base.ts:125-139`                                                |
| Stamina bar            | 180, 1 a tick (30 an hour)                                                                          | 120 · `frontier/base.ts:112`                                                         |
| Explore                | Knights 20 · Scouts 10                                                                              | 20                                                                                   |
| Move                   | 10, + 0.02 wheat a troop a tile                                                                     | the same · `frontier/base.ts:117-120`                                                |
| Attack                 | needs and costs 30                                                                                  | the same                                                                             |
| Logistics              | +20% of the bar a tier, 360 at tier 5                                                               | +20 to +150 flat · `src/rules.cairo:28-44`                                           |
| Well                   | +90: half the base bar                                                                              | half the army's whole bar · `src/logic/relics.cairo:224-231`                         |
| Rest, at a skill point | 20 stamina per rank, now: 20 / 40 / 60 / 80 / 100                                                   | +20 to +60 flat, ×2 as a pure trade · `src/progression.cairo:269-304`                |
| Bought                 | **1 credit for 2 points ($0.005 a point)**, outside the Deep only                                   | 1 LORDS a point, anywhere · `src/logic/lords.cairo:56-100` on `origin/next`          |
| Reinforce (new)        | beside the home tile, and beside a Troll camp your Realm cleared today, on any layer above the Deep | beside the home tile, at the Surface only · `src/logic/troops.cairo:486-494,897-906` |
| Defence                | no stamina rule                                                                                     | a defender under 40 stamina deals ×0.7                                               |
| Day end                | **the army is gone, with its boons, XP and relics**: no survivors come home                         | Homecoming returns a share · `src/logic/troops.cairo:912-958`                        |

#### The way down: a known cost (new)

| The day's spire on a layer                            | Reveals a layer, mean (9 days in 10 · most) | A Scout army's stamina to the Deep, three layers | Days its bar of 180 is enough | Wait for stamina              |
| ----------------------------------------------------- | ------------------------------------------- | ------------------------------------------------ | ----------------------------- | ----------------------------- |
| 10% a reveal, flat (the last round)                   | 10.0 (23 · no limit)                        | 299 (520 · no limit)                             | 27%                           | 266 min (680 min 1 day in 10) |
| **The odds rise 10% each reveal: found by the tenth** | 3.7 (6 · 10)                                | 110 (150 · 300)                                  | 99%                           | none                          |

**The commute is play when its cost is known.** At a flat 10% a Scout army spent 299 stamina on average to find three
spires and waited 266 minutes for its bar on average; with odds that rise 10% a reveal (10%, 20%, … found by the tenth)
it spends about 110 and its bar is enough 99 days in 100. Knights pay double (220), so a Realm sends its Scouts to find
and its Knights to follow. No extra base stamina is needed, and wheat is untouched.

**Why the Well refills the base bar.** Back per stamina spent = odds × refill ÷ the reveal's cost; at 1.0 an army
reveals without ever stopping, which automated play would run all day. With half the base bar the best Scout army gets
0.84 back at any Logistics tier.

Watch in the playtest:

- **Sessions:** a City's four armies hold 720 stamina in full bars: 24 attacks or 72 Scout tiles a visit, before wells.
  Three full visits fit a 16 h day.
- **Four ways to more stamina:** the Well, Logistics, a skill point, and credits outside the Deep. No relic adds
  stamina.

Sources: `frontier/base.ts:105-142`, `src/logic/army_slot_storage.cairo:69-83`, `src/logic/relics.cairo:205-231`

### 7. Army boons and XP

- **Need:** An army that grows during its day, so the tenth fight plays differently from the first: it is what keeps a
  session going.
- **Gets you to:** Keep one army alive and busy; hunt Wraiths and shrines for skill points; at each point take 1 of 3
  boons, or rest.
- **Payoff:** An army shaped for today: a striker, a holder or a finder. Or the stamina for one more fight.
- **Depth:** Three givers per army, nine boons, five ranks. No boon is best in every column, and rest wins some.
- **Choices:** Each point: 1 of the 3 boons shown, or rest.
- **Against today:** XP, ranks and shrines work as today. New: the first point at 60 XP, an offer of three boons drawn
  on chain, rest at 20 stamina per rank. Today a point buys a tier of Battle, Logistics or Scouting, the same tiers
  research buys.

**An army that earns a skill point is shown three boons, one from each of its three givers. It takes one for the day, or
rests.**

| XP source    | Season 1                                                                                                       | In code today                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Reveal       | 2 + depth (2 to 5)                                                                                             | the same · `frontier/native.ts:116-117`                           |
| Clear        | ⌊√(25 × guard)⌋ ÷ 2 × (2 + depth) ÷ 2: a Surface Troll camp 70, a Deep site's beast 625                        | the same · `src/progression.cairo:341-345`                        |
| Wraith       | ×3 a normal clear: about 160 at the Surface (tune)                                                             | a normal clear                                                    |
| Shrine       | 1 skill point, rank 50 / 30 / 15 / 4 / 1%, +1 rank per layer down                                              | the same · `src/rules.cairo:1-5`, `src/progression.cairo:241-257` |
| Skill points | at **60** · 200 · 400 · 800 · 1,500 XP, then every 1,500 again. Its rank, Common to Legendary, is 1 to 5 steps | the first at 75 · `src/progression.cairo:217-312`                 |

| The pick (new)         | Rule                                                                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The offer              | **three boons, one from each of the army's three givers.** Drawn on chain when the point is earned, stored with the army, readable by all. Nothing is drawn again                                    |
| Givers                 | four Orders of your Aspect. **Ward and Spoils give to every army. War gives to Knights only, Paths to Scouts only.** Every Aspect has the same boons under its own crests                            |
| A boon                 | the point's rank in steps, for the day; **5 steps per boon**. A boon at 5 is no longer offered. Steps over 5 come back as 20 stamina each: a Legendary into a boon at 3 gives 2 steps and 60 stamina |
| Rest                   | **20 stamina per rank, now.** Always offered                                                                                                                                                         |
| Several points at once | one sheet, one pick after the other                                                                                                                                                                  |
| A point not picked     | waits on the army. No timer                                                                                                                                                                          |
| The end of the day     | boons end with the army                                                                                                                                                                              |

| Giver  | Gives to           | Its boons               | Might  | Harmony       | Chaos   | Guile      |
| ------ | ------------------ | ----------------------- | ------ | ------------- | ------- | ---------- |
| War    | Knights            | Battle · Charge         | Power  | Perfection    | Fury    | Twins      |
| Ward   | Knights and Scouts | Guard · Vigour          | Giants | Protection    | Rage    | Reflection |
| Spoils | Knights and Scouts | Plunder · Lore          | Titans | Enlightenment | Vitriol | Fox        |
| Paths  | Scouts             | Camps · Rifts · Shrines | Skill  | Brilliance    | Anger   | Detection  |

| Boon    | A step                                                             | Common · Uncommon · Rare · Epic · Legendary    |
| ------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| Battle  | +10% damage                                                        | +10% · +20% · +30% · +40% · +50%               |
| Charge  | +5% of the opening hit lands before the other side answers         | 5% · 10% · 15% · 20% · 25%                     |
| Guard   | −5% damage taken                                                   | −5% · −10% · −15% · −20% · −25%                |
| Vigour  | +10% stamina regeneration (30 an hour becomes 33)                  | 33 · 36 · 39 · 42 · 45 an hour                 |
| Plunder | +10% of what a reveal pays                                         | +10% · +20% · +30% · +40% · +50%               |
| Lore    | +10% XP                                                            | +10% · +20% · +30% · +40% · +50%               |
| Camps   | +25% of the odds of a camp (4% per reveal becomes 5%)              | 5% · 6% · 7% · 8% · 9% per reveal              |
| Rifts   | +25% of the odds of a rift (4% becomes 5%)                         | 5% · 6% · 7% · 8% · 9% per reveal              |
| Shrines | +15% of the odds of a shrine and of a well (3% each becomes 3.45%) | 3.45% · 3.9% · 4.35% · 4.8% · 5.25% per reveal |

**Knights have six boons, Scouts seven, nine in all.** No new art, and no effect the game doesn't already have or the
build doesn't already add. Knights: War, Ward, Spoils. Scouts: Paths, Ward, Spoils. Every giver has at least two boons,
so no card is a certainty: Knights see 8 different offers, Scouts 12. **A Scout army has no Battle:** Scouts find,
Knights fight. Guard is the Scouts' fighting boon.

**Also part of the design:** which Order gives what is a first value from the names, for the playtest; Shrines stays the
code's one kind, shrines and wells together (`src/research.cairo:34`), at +15% a step; no Duo boons in Season 1; no boon
slows the troops lost each tick; the next offer is not shown before it is earned.

| How boons meet          | Rule                                                                                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Research                | sets what an army starts the day with. A boon's steps add to it, 5 per boon. Vigour, Plunder, Lore and Guard have no research row: they start at 0                                                                                                                          |
| Relics                  | the same effects, for 30 minutes per tier: Blade and Battle, Ward and Guard, Plunder and Plunder, Tome and Lore. They add up. In the code a relic overwrites the field Battle writes (`src/relics.cairo:353-358`, `src/logic/army_slots.cairo:20`); the build keeps the sum |
| Shrines                 | a point of the shrine's rank; it opens the same sheet                                                                                                                                                                                                                       |
| The Wraith's XP ×3      | about 160 XP in one fight: the best single fight for a pick                                                                                                                                                                                                                 |
| The Veterans quest      | counts points earned, taken or rested                                                                                                                                                                                                                                       |
| Taking a site           | Battle and Charge are the striker's: 25,000 on a guard of 20,000 keeps 12,900 with nothing, 16,500 with Battle 5                                                                                                                                                            |
| Holding a slot          | Guard is the holder's. Each army in a slot fights with its own boons; nothing is shared between mates                                                                                                                                                                       |
| A Triumph's Second Wind | Vigour's percentage is taken on the ×2 rate                                                                                                                                                                                                                                 |

| Knights: troops kept · rounds of 30 stamina | Nothing    | Battle 5   | Guard 5    | Charge 5   | Battle 5 and Guard 5 |
| ------------------------------------------- | ---------- | ---------- | ---------- | ---------- | -------------------- |
| 1,500 on 1,000                              | 908 · 2    | 1,053 · 2  | 1,058 · 2  | 975 · 2    | 1,165 · 2            |
| 4,500 on 2,000                              | 3,642 · 2  | 3,809 · 1  | 3,857 · 2  | 3,777 · 2  | 3,982 · 1            |
| 12,000 on 10,000                            | 5,489 · 4  | 7,451 · 3  | 7,314 · 4  | 5,777 · 4  | 8,665 · 3            |
| 25,000 on 20,000                            | 12,908 · 5 | 16,522 · 3 | 16,344 · 4 | 13,406 · 5 | 18,744 · 3           |

| A City's Scout army, the whole day: it always takes | Reveals  | Reveal pay | XP      | Finds    | Camps   | Rifts   | Shrines |
| --------------------------------------------------- | -------- | ---------- | ------- | -------- | ------- | ------- | ------- |
| Rest                                                | **85.1** | 85.1       | **170** | 22.2     | 3.9     | 3.9     | 2.9     |
| Guard                                               | 78.1     | 78.1       | 156     | 20.3     | 3.5     | 3.5     | 2.6     |
| Vigour                                              | 82.6     | 82.6       | 165     | 21.5     | 3.7     | 3.7     | 2.8     |
| Plunder                                             | 78.3     | **89.3**   | 157     | 20.4     | 3.5     | 3.5     | 2.7     |
| Lore                                                | 78.6     | 78.6       | 164     | 20.5     | 3.6     | 3.6     | 2.7     |
| Camps                                               | 80.3     | 80.3       | 161     | 21.5     | **4.4** | 3.6     | 2.7     |
| Rifts                                               | 80.1     | 80.1       | 160     | 21.5     | 3.6     | **4.4** | 2.7     |
| Shrines                                             | 84.5     | 84.5       | 169     | **22.7** | 3.8     | 3.8     | **3.3** |

| A sitting                           | Picks     | No pick | A Rare or better |
| ----------------------------------- | --------- | ------- | ---------------- |
| New Settlement, one bar             | 0.7 (0–1) | 36%     | 0%               |
| New Settlement, the whole first day | 1.8 (1–3) | 0%      | 16%              |
| City Knights, one bar               | 1.1 (0–2) | 18%     | 6%               |
| City Knights, the whole day         | 3.7 (3–5) | 0%      | 77%              |
| City Scouts, one bar                | 1.0 (0–3) | 41%     | 15%              |
| Kingdom, two bars, Ethereal II      | 4.3 (2–7) | 0%      | 91%              |

A new Settlement's first bar ends with a pick 64% of the time at 60 XP, against 54% at 75. Two Knight armies with two
points each have the same boons 3% of the time.

| Research rows: where an army starts the day | Who        | Research of   | Tiers 1 to 5                                                              |
| ------------------------------------------- | ---------- | ------------- | ------------------------------------------------------------------------- |
| Battle                                      | every army | War Hall      | +10 / 25 / 45 / 70 / 100% damage                                          |
| Logistics                                   | every army | Supply Yard   | +20% of the bar per tier: 216 / 252 / 288 / 324 / 360                     |
| Charge (new)                                | Knights    | Barracks      | 10 / 20 / 30 / 40 / 50% of the opening hit lands before the guard answers |
| Scouting                                    | Scouts     | Scouts' Lodge | +10 / 15 / 20 / 25 / 30% to camps, rifts or sanctuaries                   |

**Charge: Knights strike first, in every fight.** On a fight's opening hit, a share of the Knights' damage lands before
the other side answers: a beast, or an army guarding a site. In a sized fight against a beast Charge 5 saves 9 to 21% of
the Knights lost.

| An attacker and a guard of 20,000 each  | The attacker is left with | The guard is left with |
| --------------------------------------- | ------------------------- | ---------------------- |
| No Charge                               | 2,750                     | 2,750                  |
| Charge 3 (30%)                          | 3,400                     | 2,200                  |
| Charge 5 (50%)                          | 3,850                     | 1,800                  |
| Charge 5 and the Charge boon at 5 (75%) | 4,400                     | 1,350                  |

**In the Deep** an army earns XP as anywhere: beating a site's beast is 625 XP, three skill points in one sheet, picked
for the hold that follows.

Watch in the playtest:

- **What the playtest should measure**: how often each boon is taken when offered (under 10% or over 50%: its step is
  mis-sized; watch Charge in the Deep and Shrines for Scouts); rest by rank (Season 0 traded 64%); armies with three
  points or more on one boon only (Season 0: 44%).
- **The top ranks rarely arrive:** a Legendary point needs 1,500 XP in one army's day; a Tome and Lore together are the
  way there.

Sources: `src/progression.cairo:217-345`, `src/rules.cairo:1-80`

### 8. Combat

- **Need:** A fight you can read before you commit to it.
- **Gets you to:** Size the army to the guard, or beat a guard with several armies, one after the other, yours or your
  mates'.
- **Payoff:** Bigger armies lose far less: against a 1,300 guard, 1,600 Knights lose 57% and 3,000 lose 19%.
- **Depth:** Above the Deep the answer is quick to learn: send 150% of the guard's troops. The depth is in the Deep,
  where the guard is players, and time is on nobody's side.
- **Choices:** In the Deep: strike now or wait while the guard loses troops; alone or with a mate; which site; when to
  switch a relic on.
- **Against today:** One formula, today's, for guards and, in the Deep, for armies. Two of its terms go; Charge and the
  Scouts' −25% come in.

**Attacker deals** round(2 × Na ÷ (Na+Ng)0.2 × (1 + Battle + Blade)), ×0.75 for Scouts. **Defender deals** round(2 × Ng
÷ (Na+Ng)0.2), less the other side's Ward. Losses land at once (`src/combat.cairo:198-403`).

| Term                                     | Season 1                                                                                                                   | In code today                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Scaling factor · exponent                | 2 · 0.2                                                                                                                    | the same · `arena/troop.ts:11`, `src/combat.cairo:129-132`           |
| Knight assaulting a guard · Knight guard | ×1 · ×1                                                                                                                    | ×1.15 · takes ×0.85, which net to ×0.98 · `src/combat.cairo:163-196` |
| Defender under 40 stamina                | no rule                                                                                                                    | deals ×0.7 · `src/combat.cairo:253-265`                              |
| Scouts (new)                             | deal −25%                                                                                                                  | —                                                                    |
| Charge (new)                             | on a fight's opening hit, against a beast or an army, 10 to 50% of the Knights' damage lands before the other side answers | —                                                                    |
| Army against army (new)                  | in the Deep only, the same formula, Charge included; never against an ally                                                 | no army fights in Frontier                                           |
| Guards                                   | keep losses, never regain troops: several armies, of one Realm or of mates, can beat one, one after the other              | the same · `src/troops.cairo:431-442`                                |

| Clear (Knights, 1.5× the guard) | Guard         | Hits | Knights lost | Pays                                   |
| ------------------------------- | ------------- | ---- | ------------ | -------------------------------------- |
| Cyclops, Surface                | 350           | 2    | 228 (43%)    | 1,400 wheat                            |
| Wraith, Surface                 | 450           | 2    | 288 (43%)    | about 160 XP                           |
| Troll camp, Surface             | 1,300         | 2    | 747 (38%)    | 650 labor, and a supply post           |
| Dark fey rift, Surface          | 1,500         | 2    | 848 (38%)    | 4,500 Essence                          |
| Uncommon ruin                   | 2,500         | 3    | 1,367 (36%)  | a relic                                |
| A Deep site's beast             | 10,000 (tune) | 3    | 5,105 (34%)  | the site: your army stays as its guard |

#### Where the depth is

| In the Deep       | The choice                                                                                                                            | What makes it real                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Army against army | strike now, or wait while every slot of the guard loses 200 troops each tick                                                          | a guard of 21,500 is beyond a Kingdom's 15,000 at once, and can be beaten by it after 50 ticks; waiting in the Deep costs the same 200 a tick, waiting above it costs a spire's walk, and a rival may strike first |
| Mates             | fill a slot in a mate's guard, attack with a mate, or take another site                                                               | a slot is paid by its troops: you share the site's ticks; a site of your own pays you all of them                                                                                                                  |
| Relics and boons  | the Blade for the assault, the Ward as you leave your guard; the beast's three skill points: Battle to strike, Guard to hold, or rest | 30 minutes a tier: a Ward covers the hours you choose, not the night                                                                                                                                               |
| Which site        | the Foundation, the Quarry or the Altar                                                                                               | the Foundation is the most fought over: it changes hands about 4 times a day at 27 Realms down                                                                                                                     |

Watch in the playtest:

- **An equal army still loses:** the guard hits back at full, so clears want 1.5× the guard or more. It is the rule to
  teach first.
- **Battle 5 (+100%) outweighs every other modifier,** a Legendary Blade (+50%) included.

Sources: `src/combat.cairo:129-403`

### 9. Exploration

- **Need:** An unknown map every day, with something worth finding on it.
- **Gets you to:** Spend stamina on reveals to find the day's sites, its ruins and its spire.
- **Payoff:** Every reveal pays the Realm; nearly one in four finds something; the spire is found by the tenth at the
  latest.
- **Depth:** Where to look and when to stop: Scouting tilts the finds, a Far-Eye opens tiles at once.
- **Choices:** Reveal more or go fight what you found; which kind Scouting favours.
- **Against today:** Find odds are today's. New: spires are found, at rising odds; Scouts reveal for 10; the reveal
  reward counts up to 10,000 troops; the Deep has nothing to reveal.

| Find             | Odds a reveal                                                                                                                                      | Scouting raises it | In code today                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------- |
| Cyclops · Wraith | 3% · 3%                                                                                                                                            | no                 | one 6% beasts find, weak or strong band |
| Troll camp       | 4%                                                                                                                                                 | to 8%              | the same                                |
| Dark fey rift    | 4%                                                                                                                                                 | to 8%              | the same                                |
| Ruin             | 3%, no daily limit                                                                                                                                 | no                 | 3%; 0 once cleared at that depth today  |
| Shrine · Well    | 3% · 3% (each needs its lore)                                                                                                                      | to 6%              | the same                                |
| Spire (new)      | **10% on the day's first reveal of a layer, 10% more each reveal**: found by the tenth. One a layer a day for each Realm, once Spire lore is known | no                 | a home-ring tile that moves daily       |
| Nothing found    | 77%: the reveal still pays the Realm                                                                                                               | —                  | the same                                |

| A reveal         | Season 1                                                                                             | In code today                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Costs            | Knights 20 · Scouts 10 stamina, + 0.02 wheat a troop                                                 | 20 for every army                                                                           |
| Pays the Realm   | 10 / 15 / 20% of the army's troops by layer, in Essence or labor; troops count up to 10,000          | the same with no cap; the cap exists, unset · `src/exploration_rewards.cairo:57-70,104-115` |
| Pity             | after 7 empty reveals the next one finds                                                             | the same · `frontier/native.ts:113`                                                         |
| Going down (new) | enter the spire you found: one layer down, to the nearest free tile; from Ethereal II, into the Deep | `EnterDepth` beside the home-ring spire, behind Depth research                              |
| The Deep (new)   | **no tiles to reveal**: its map and its three sites are fixed and known                              | each Realm's own region, drawn each day · `src/expeditions.cairo:136-141`                   |

| Reveal reward, a tile | Surface | Ethereal II |
| --------------------- | ------- | ----------- |
| 1,600 Scouts          | 160     | 320         |
| 9,000 Knights         | 900     | 1,800       |
| 25,000 Knights        | 1,000   | 2,000       |

Watch in the playtest:

- **Is a 77% empty reveal a dead turn? No:** it pays 10 to 20% of the army's troops in labor or Essence every time, and
  the pity finds on the eighth.
- Depth doesn't change find odds: deeper only means bigger guards and rewards. No find pays LORDS.

Sources: `frontier/native.ts:106-117,135-177`, `src/discovery.cairo:24-28,85-123`, `src/expeditions.cairo:78-134`

### 10. Sites and beasts

- **Need:** Something worth a fight, chosen by what you lack today.
- **Gets you to:** Pick targets by need: wheat for the road, XP for the army, labor or Essence for the Realm, a relic
  for the Deep.
- **Payoff:** Each guard has one reward, so a glance at the map tells you what a fight is for.
- **Depth:** Guards double with each layer and keep their losses: several armies can share one.
- **Choices:** Which site, with which army, and whether to finish it today.
- **Against today:** Five guards, one reward each. New: the Cyclops pays wheat, the Wraith pays XP, a cleared Troll camp
  is also a supply post, and ruins pay relics.

| Guard                   | Site   | Pays                                                    | Surface     | Ethereal I  | Ethereal II |
| ----------------------- | ------ | ------------------------------------------------------- | ----------- | ----------- | ----------- |
| Cyclops                 | a herd | wheat, guard × 4                                        | 300–400     | 600–800     | 1,200–1,600 |
| Wraith                  | a band | XP ×3, nothing else                                     | 400–500     | 800–1,000   | 1,600–2,000 |
| Troll                   | a camp | labor, guard ÷ 2, and a supply post                     | 1,200–1,400 | 2,400–2,800 | 4,700–5,700 |
| Dark fey                | a rift | Essence, guard × 3                                      | 1,400–1,600 | 2,800–3,200 | 5,400–6,600 |
| Ammit, Basilisk, Wyvern | a ruin | one relic: **the beast is as big as the relic is rare** | by rarity   | by rarity   | by rarity   |

| A ruin's relic (new) | Its beast, any layer (tune) | Army to send | It loses |
| -------------------- | --------------------------- | ------------ | -------- |
| Common               | 1,000                       | 1,500        | 590      |
| Uncommon             | 2,500                       | 3,750        | 1,370    |
| Rare                 | 5,000                       | 7,500        | 2,680    |
| Epic                 | 10,000                      | 15,000       | 5,100    |
| Legendary            | 25,000                      | 37,500       | 12,290   |

**You see the beast, you know the relic.** The tier is rolled when the ruin appears and sets the beast (each ±10%).
Today every ruin of a layer is one size (3,000 / 5,500 / 11,000 · `frontier/native.ts:137-138,151-152,165-166`) and the
tier is rolled on the clear (`src/relics.cairo:145`). Rewards × (2 + depth) ÷ 2, as today. Sites never move or respawn
and go with the day's map. **Today:** both beast bands pay labor, guard ÷ 4; every ruin pays a LORDS chest
(`src/expeditions.cairo:44-61`, `frontier/native.ts:133-190`).

#### Supply posts (new)

**The rule:** a Troll camp your Realm cleared today is your supply post until the day's map goes: your armies beside it
are reinforced from the Realm's troop stores, as beside the home tile. On every layer above the Deep; the Deep has no
camps. **Why it stays:** the troops your Barracks train during the day can't reach an army below the Surface otherwise.
A camp on Ethereal II is where an army fills up before it enters the Deep, where every 200 troops are a tick of holding.
Today reinforcing accepts one tile, the home tile at the Surface (`src/logic/troops.cairo:486-494,897-906`); a cleared
site already keeps the home that cleared it (`src/expeditions.cairo:4,24-27`).

Watch in the playtest:

- A Common ruin (1,000) is within a Settlement's reach with its starting army: relics start on day one. A Legendary one
  (25,000) waits for a bigger Realm.

Sources: `frontier/native.ts:133-190`, `src/expeditions.cairo:44-61`

### 11. The Deep: three sites

- **Need:** One map every Realm shares, where armies fight armies for things your Realm, your Aspect and your rivals
  feel.
- **Gets you to:** Go down, take one of the Deep's three sites, alone or with mates, and hold it; come back to see who
  attacked it, who joined it, and how many troops it has left.
- **Payoff:** Every tick held pays: the Quarry pays you, the Foundation builds your Aspect's hyperstructure, the Altar
  fills the bar that stops a rival's.
- **Depth:** One clock: each tick an army gains a point of stamina and loses 200 troops. A hold lasts as long as its
  troops, so what you can hold in a day is what your town raised.
- **Choices:** Which of the three: my growth, my team's, or a rival's loss. Strike now, or wait for the guard to lose
  troops. Take a site, attack with a mate, or fill a slot in a mate's guard.
- **Against today:** Today each Realm has its own region on every layer, no army fights, and every ruin pays a LORDS
  chest to its own Realm. Season 1: one shared Deep, three held sites, and troops lost each tick.

| The Deep's three sites (new) | For             | A tick held pays its guards                                                                           |
| ---------------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| **The Foundation**           | my team         | **5 Glory**, and +5 to the height of the Aspect's hyperstructure                                      |
| **The Quarry**               | me              | **500 labor and 500 Essence**, to the guards' Realms                                                  |
| **The Altar**                | against a rival | **5 Glory**, and +5 on the Aspect's bane bar; at 1,500 a team bane is issued (see Banes and Triumphs) |

| Rule                    | Season 1                                                                                                                                                                                                                                                                                                                          | In code today                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The Deep (new)          | Ethereal III is one map of 50 × 50 shared by every Realm, with army fights. **Fixed and known**: the three sites and the four hyperstructures stand where everyone can see them, every day                                                                                                                                        | each Realm has its own region on every layer, drawn each day · `src/expeditions.cairo:114-141`                                                                                                         |
| The sites (new)         | **three, always there, never used up.** Each day each one starts behind a beast of 10,000 (tune); when its guard is gone it stands open to the next army                                                                                                                                                                          | ruins are a 3% find on every layer                                                                                                                                                                     |
| The tick (new)          | **one clock, the army tick: 120 seconds.** Each tick in the Deep an army gains 1 stamina and **loses 200 troops** (tune), and a held site pays its guards. Each army shows a draining bar and the ticks it has left                                                                                                               | the tick gives stamina · `frontier/clock.ts:1`                                                                                                                                                         |
| Holding (new)           | the army that beats a site's guard stays as its guard with what it has left, until it has no troops left, a rival beats it, or the day ends. Any rival may attack it; allies can't                                                                                                                                                | guards keep their losses · `src/troops.cairo:431-442`                                                                                                                                                  |
| Slots (new)             | **a site's guard has 4 slots, 1 per player.** Any member of the holder's Aspect may fill a free slot with one army. Every slot loses 200 troops each tick. **Each tick is split among the slots by their troops.** Mates also take a site together: a guard keeps its losses, so each army's attack counts                        | guard slots hold 4, of one Realm · `src/logic/troops.cairo:298-299`                                                                                                                                    |
| Wait, then strike (new) | guards lose 200 troops each tick like every army in the Deep: a rival who waits attacks a weaker guard. Waiting costs nothing above the Deep, and the same 200 troops each tick inside it                                                                                                                                         | —                                                                                                                                                                                                      |
| Glory (new)             | **the one score a member reads.** Earned only by holding the Foundation or the Altar: 5 each tick, split among the guards by their troops. Nothing for troops beaten. Foundation ticks also add 5 to the hyperstructure's height                                                                                                  | —                                                                                                                                                                                                      |
| The site alert (new)    | **a push when a site held by another Aspect can be taken:** its guard, all slots together, has dropped to the point where your largest army outside the Deep is 150% of it. Only for a Realm with Spire lore. At most 1 per site per game day; none while the game is open. On by default at the Important level; off in Settings | the push exists, with levels Off, Important and All, and a watch that wakes when an army is rested · `packages/notifications/src/notification-kinds.ts:13-22`, `apps/realms/server/army-rest.ts:23-45` |

| Waiting for a guard to weaken: an Empire's guard of 21,500 | Ticks waited | The guard then | A Kingdom's 15,000 takes it and keeps |
| ---------------------------------------------------------- | ------------ | -------------- | ------------------------------------- |
| Strike at once                                             | 0            | 21,500         | it fails                              |
| Wait 25 ticks                                              | 25 (0.8 h)   | 16,500         | it fails                              |
| Wait 50 ticks                                              | 50 (1.7 h)   | 11,500         | 8,600                                 |
| Wait 75 ticks                                              | 75 (2.5 h)   | 6,500          | 12,900                                |

| A full site: four slots   | Troops  | Lasts, ticks (hours) | An attacker needs, to take it and keep half |
| ------------------------- | ------- | -------------------- | ------------------------------------------- |
| Four Cities (8,000 each)  | 32,000  | 40 (1.3 h)           | 40,000                                      |
| Four Kingdoms (15,000)    | 60,000  | 75 (2.5 h)           | 75,000                                      |
| Four Empires (25,000)     | 100,000 | 125 (4.2 h)          | 125,000                                     |
| Four full armies (60,000) | 240,000 | 300 (10 h)           | 330,000                                     |

**What four slots do.** They don't make a hold longer: every slot loses its own 200 troops each tick, so a site lasts as
long as its largest slot. They make it harder to take: a full site of four Empires wants 125,000, more than any one
army, so it is taken by mates attacking one after the other, or by waiting. 1 slot per player keeps a single Realm from
filling a site alone, and sends its other armies to the Quarry and the Altar. **The split:** by troops, tick by tick: a
slot with 25% of the troops takes 25% of the tick, for pay and for a member's share of the reward. Equal shares would
pay a token army 25%.

| Who can take a site                     | Against the day's beast of 10,000 | Holds with | For, ticks (hours) |
| --------------------------------------- | --------------------------------- | ---------- | ------------------ |
| A City, a day of its troops (8,000)     | leaves it at 5,000                | —          | —                  |
| Two Cities, mates, one after the other  | take it                           | 5,500      | 28 (0.9 h)         |
| Three Cities                            | take it                           | 13,500     | 68 (2.3 h)         |
| A Kingdom, a day of its troops (15,000) | takes it                          | 9,900      | 49 (1.6 h)         |
| An Empire, a day of its troops (25,000) | takes it                          | 21,500     | 108 (3.6 h)        |

| Realms in the Deep a day | The Foundation is held | It changes hands, a day | The Quarry · the Altar are held | Slots filled while held | Round-the-clock gain |
| ------------------------ | ---------------------- | ----------------------- | ------------------------------- | ----------------------- | -------------------- |
| 16                       | 46% of the day         | 1.9                     | 26% · 25%                       | 1.1                     | 1.1×                 |
| 27                       | 58%                    | 3.9                     | 39% · 38%                       | 1.1                     | 1.4×                 |
| 54                       | 75%                    | 8.6                     | 60% · 57%                       | 1.3                     | 1.7×                 |

**Why no store, and fixed sites.** A site that is never used up needs no rule for rising, collapsing or moving: troop
loss and rivals end every hold. The more Realms come down, the more it is fought over (1.9 to 8.6 hand-overs a day), and
the race's pace is bounded by the clock, not by the crowd: one Foundation pays at most 720 ticks a day. From 100 players
to 2,000 the age ends between day 40 and day 27 (see Aspects). It deletes the count of sites by Realms down, the store
and the random root.

**Three sites, three reasons.** The Foundation is where the season is won, and the most fought over. The Quarry is the
pick of a growing Realm: a Kingdom's hold of 49 ticks is 49,000, half a day of its income. The Altar is the pick of an
Aspect behind: it earns nothing and stops the leader. Cities come mostly to the Quarry and the Altar, where Empires come
less; with one slot a player, a Realm's second army goes there too.

**The tick is the trade, and troops are the bound.** Stamina comes in and troops go out on the same clock. A Realm holds
for as many ticks a day as its town raises troops ÷ 200: about 40 for a City, 75 for a Kingdom, 125 for an Empire. An
account that never sleeps has the same troops as any Empire: it earns 1.3 to 1.7 times the mean Empire's points, by
holding the hours nobody contests. (Earlier rounds gave every army full strength each day and read 3×: the troop count
is the correction.) **Lore:** the Spires' roots hold up what the mist has buried.

Watch in the playtest:

- **Numbers for the first playtest:** the beast at 10,000, 200 troops a tick, 4 slots. With ×2 the troops a day the
  Foundation is held about 80% of the day, not 58%.
- **A season of 2,000 players wants more than one Foundation** to be played, not to be paced: a second set of three
  sites is one preset value, with 5 a tick halved.
- **Watch the Quarry late:** once a Realm's research is bought it has little to offer; that is the intent.

Sources: `src/expeditions.cairo:114-141`, `src/logic/movement.cairo:234-243`, `src/logic/troops.cairo:298-299`

### 12. Relics and banes

- **Need:** A short burst of power that you time yourself.
- **Gets you to:** Clear ruins on the way down with the army that will need the relic, then choose the moment to switch
  it on.
- **Payoff:** A loadout built during the day and spent in the fight it was built for.
- **Depth:** Five relics, five tiers, three an army: a fourth replaces one you choose, and each ruin costs the army that
  takes it about 33% of its troops.
- **Choices:** Which army clears the ruin; which three it keeps; when to switch each one on.
- **Against today:** Relics are off in Frontier today. Season 1 turns five on, in five tiers, held by the army that won
  them and gone with it at day end, switched on anywhere. The Forge stays off.

| Relic                       | Does                                  | Each tier (tune) | Common | Legendary |
| --------------------------- | ------------------------------------- | ---------------- | ------ | --------- |
| Blade                       | damage dealt                          | +10%             | +10%   | +50%      |
| Ward                        | damage taken                          | −5%              | −5%    | −25%      |
| Plunder                     | labor and Essence from a cleared site | +20%             | +20%   | +100%     |
| Far-Eye                     | reveals the nearest tiles at once     | 6 tiles          | 6      | 30        |
| Tome (new)                  | XP the army earns                     | +40%             | +40%   | +200%     |
| Lasts (all but the Far-Eye) |                                       | 30 min           | 30 min | 2 h 30    |

One relic for each thing an army does: hit, last, loot, look, grow. Four are the code's army relics (damage, damage
taken, exploration reward, reveal radius · `packages/types/src/constants/relics.ts:70-160`, `src/relics.cairo:5-11`), in
five tiers where the code has two; the Tome is one new modifier on the XP grant; the stamina relic stays off. A
Legendary Blade against a Legendary Ward nets ×1.13. Six Surface camps give 420 XP, a Rare skill point; with a Rare Tome
924, an Epic one.

| Relic rule        | Season 1                                                                                   | In code today                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Tiers             | 5, rolled when the ruin appears, at the layer's odds below                                 | 2 levels                                                                         |
| Who holds it      | the army that lands the last hit on the ruin; gone with it at day end                      | the opening army or the Realm's store · `src/logic/relics.cairo:568-597,437-476` |
| The loadout (new) | **three relics an army.** A fourth takes the place of one you choose. One running per kind | no limit                                                                         |
| Switching on      | free, anywhere, the Deep included                                                          | costs Essence, Surface only · `src/logic/relics.cairo:84-113`                    |
| Trading           | never sold, traded or passed to another army                                               | —                                                                                |

| Relic tier odds | Common | Uncommon | Rare | Epic | Legendary |
| --------------- | ------ | -------- | ---- | ---- | --------- |
| Surface         | 50%    | 27%      | 14%  | 6%   | 3%        |
| Ethereal I      | —      | 50%      | 28%  | 15%  | 7%        |
| Ethereal II     | —      | —        | 55%  | 30%  | 15%       |

#### Banes and Triumphs (new)

- **Need:** Hard days that call an Aspect's players in: first from the mist, on everyone, then from a rival.
- **Gets you to:** Under a bane, do the bane quest: it replaces the daily quest. To send one, hold the Altar until your
  Aspect's bar is full.
- **Payoff:** Under a world bane, the daily reward a second time when your Aspect ends it. Under a team bane, your
  hyperstructure growing again.
- **Depth:** Three bane quests, three ways to play: many small fights, wide exploring, few big fights. Each is most of a
  sitting.
- **Choices:** Under a bane: the quest on the Surface or faster below; the quest first or the Deep first. The Altar or
  the Foundation.
- **Against today:** There is no bane and no Triumph in the code. Nobody casts or picks one.

**A bane is a hard day for an Aspect. Its members get a bane quest in place of the daily quest, and they end the bane
together.**

| Bane rule          | Season 1                                                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. When it starts  | at the start of a day; it lasts that day at most. Nobody casts it, nobody picks a target                                                                                          |
| 2. The day's quest | that day every member of the Aspect has 1 quest: the bane quest. There is no daily quest that day                                                                                 |
| 3. Its reward      | finishing the bane quest pays the daily reward                                                                                                                                    |
| 4. Ending it       | the Aspect ends the bane when enough members have finished the quest. **Enough is 25% of the members who sent out an army the day before.** The banner shows it all day: "4 of 6" |
| 5. Never both      | an Aspect never has both banes. World banes come first in the season; team banes take over                                                                                        |

|                      | World bane                                                                                                                                                                                                                                                                    | Team bane                                                                                                                                                                                                                 | Triumph                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| When                 | the mist rolls at the start of each day, from day 2. The chance is 0% the day after a world bane, then **+20% for each day without one**: about 1 every 3 days. **The mist stops for the season when the first team bane is issued**, for all 4 Aspects. Nobody knows the day | a rival Aspect fills its bane bar by holding the Altar: +5 per tick, full at **1,500**. The bane is issued when the bar is full and starts at the start of the next day. The first one of the season ends the world banes | the day after your Aspect builds a stage of its hyperstructure: at 2,000, 4,000, 6,000 and 8,000 |
| Who it hits          | all 4 Aspects                                                                                                                                                                                                                                                                 | the Aspect that is first on the board. If it already has a team bane: the next one                                                                                                                                        | every member of your Aspect                                                                      |
| What it does         | 1 of 3. **Blood Moon**: beasts +50%. **Mist Tide**: stamina regenerates at 50%. **Ash Fall**: production at 50%                                                                                                                                                               | the Aspect's hyperstructure stops growing                                                                                                                                                                                 | a different bonus at each stage, above the Deep, for 1 day (below)                               |
| What the player does | the bane quest. Blood Moon: the Stand. Mist Tide: the Lights. Ash Fall: the Cull                                                                                                                                                                                              | the bane quest: 1 of the same 3, never the same 2 times running                                                                                                                                                           | plays the day the bonus makes better                                                             |
| What the player gets | the daily reward for the quest. **The daily reward a second time if the Aspect ends the bane**                                                                                                                                                                                | the daily reward for the quest. **The hyperstructure grows again when the Aspect ends the bane.** The building it missed is not given back                                                                                | the bonus. The daily quest as usual                                                              |
| How it ends          | for your Aspect: when enough members finished the quest. If not, at the end of the day                                                                                                                                                                                        | the same                                                                                                                                                                                                                  | at the end of the day                                                                            |

| Bane quest (tune) | It counts                                                    | Comes with                                               | Settlement · City · Kingdom · Empire |
| ----------------- | ------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------ |
| **The Stand**     | guarded sites cleared, of any kind                           | Blood Moon: each site is +50% harder                     | 3 · 6 · 9 · 12                       |
| **The Lights**    | tiles revealed                                               | Mist Tide: stamina comes back at 50%                     | 20 · 40 · 60 · 80                    |
| **The Cull**      | guard troops beaten: the size of every guard you beat, added | Ash Fall: troops are made at 50%, and fights cost troops | 2,500 · 6,000 · 10,000 · 15,000      |

| What each takes, on the Surface only | Minutes: Settlement · City · Kingdom · Empire | Finished with the day's stamina | Stamina it takes, of the day's |
| ------------------------------------ | --------------------------------------------- | ------------------------------- | ------------------------------ |
| The Stand                            | 17 · 21 · 26 · 34                             | 90% · 100% · 100% · 100%        | 59% · 35% · 29% · 28%          |
| The Lights                           | 10 · 20 · 30 · 40                             | 100% at every level             | 48% · 32% · 36% · 38%          |
| The Cull                             | 17 · 18 · 27 · 39                             | 90% · 100% · 100% · 100%        | 59% · 28% · 29% · 33%          |

**Progress counts on every layer, and every Realm can finish all 3 on the Surface.** The Cull is faster below the
Surface, where guards are ×2 on each layer: fewer fights, bigger losses. The smallest quest is 20 actions, and an action
is one reveal or one hit: 30 seconds. A new Settlement with its 2 armies of 1,500 Knights finishes the Stand and the
Cull on 90% of days, and the Lights on 100%.

| Stage built | Triumph, the next day (new) | Plain rule                                | In the Deep                                          |
| ----------- | --------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| 1, at 2,000 | **Clear Mist**              | a reveal finds something 2 times as often | nothing: the Deep has nothing to reveal              |
| 2, at 4,000 | **Second Wind**             | stamina regenerates ×2: 60 per hour       | nothing: the Deep has its own +1 per tick            |
| 3, at 6,000 | **Pale Moon**               | beasts are at 50%                         | nothing: the beasts of the 3 sites keep their 10,000 |
| 4, at 8,000 | **Spoils**                  | a cleared site pays ×2                    | nothing: the Quarry pays the same                    |

**Two Triumph rules.** A Triumph and a bane on the same day multiply: Pale Moon on a Blood Moon day is 150% × 50% = 75%.
The 5th stage ends the age, so there is no 5th Triumph. All 4 work above the Deep only: the 3 sites, their beasts, the
200 troops lost per tick and the Quarry are untouched. Every Aspect gets its 4 Triumphs in almost every season; the
leader only gets them sooner.

| Players | The first team bane is issued on day | World banes a season (1 season in 10 · 9 in 10) | Seasons with none | The first world bane, day |
| ------- | ------------------------------------ | ----------------------------------------------- | ----------------- | ------------------------- |
| 100     | 12 (11–14)                           | 3 (2–4)                                         | 0%                | 3 (2–5)                   |
| 200     | 8 (8–9)                              | 2 (1–3)                                         | 0%                | 3 (2–5)                   |
| 2,000   | 5 (4–6)                              | 1 (1–2)                                         | 5%                | 3 (2–5)                   |

| The season, 2,000 seasons a row                                           | 100 players   | 200           | 2,000         |
| ------------------------------------------------------------------------- | ------------- | ------------- | ------------- |
| World banes · team banes                                                  | 3 · 12        | 2 · 17        | 1 · 22        |
| Bane days: the first · second · third · fourth Aspect                     | 9 · 7 · 5 · 4 | 9 · 7 · 5 · 3 | 9 · 7 · 6 · 4 |
| Days with the daily quest, the first · fourth Aspect                      | 31 · 36       | 23 · 29       | 18 · 23       |
| The leader on day 25 wins                                                 | 74%           | 64%           | 60%           |
| The age ends on day                                                       | 40 (37–43)    | 32 (30–34)    | 27 (26–28)    |
| A season's quest rewards, the first Aspect, against a season with no bane | 106%          | 105%          | 104%          |

| What a bane day pays, labor + Essence | Settlement    | City          | Kingdom        | Empire          | Against a normal day |
| ------------------------------------- | ------------- | ------------- | -------------- | --------------- | -------------------- |
| A normal day                          | 1,000 + 1,500 | 2,000 + 3,000 | 4,000 + 6,000  | 8,000 + 12,000  | 100%                 |
| A world bane day, ended by the Aspect | 2,000 + 3,000 | 4,000 + 6,000 | 8,000 + 12,000 | 16,000 + 24,000 | 200%                 |
| A world bane day, not ended           | 1,000 + 1,500 | 2,000 + 3,000 | 4,000 + 6,000  | 8,000 + 12,000  | 100%                 |
| A team bane day                       | 1,000 + 1,500 | 2,000 + 3,000 | 4,000 + 6,000  | 8,000 + 12,000  | 100%                 |

**Why the mist stops at the first team bane.** A world bane hits all 4 Aspects the same, so it never moves the race.
Once team banes exist, a world bane on the same day would hide the team bane's quest behind its own. With the stop, each
bane has its own days. The step is +20% so that every crowd still meets a world bane: at +10%, 3 seasons in 10 at 2,000
players had none.

**In the code** there is no bane and no Triumph. A bane's stop is one check where the hyperstructure is built
(`src/logic/hyperstructures.cairo:149`). The second reward is a second record for the same day: the code keeps 1 grant
per home and day (`src/logic/entry.cairo:82,209-219,310-314`). The day has an index (`src/days.cairo:29`).

Watch in the playtest:

- **First values for the playtest**: the bar of 1,500, the 25%, the quest sizes, the 3 world bane effects, the roll's
  step.
- **The 25% is the number to watch.** A bane is ended by the Aspect on 69% · 75% · 98% of bane days (100 · 200 · 2,000
  players) when 15% of members finish the quest. At 10% of members finishing, 38 to 41% of banes are ended.

Sources: `src/relics.cairo:5-20,320-397`, `src/logic/relics.cairo:59-128,437-476,568-603`,
`packages/types/src/constants/relics.ts:70-160`

### 13. Aspects and the hyperstructure

- **Need:** A team to play for all season, its work rising in the Deep, and one board anyone can read.
- **Gets you to:** Pick an Aspect. Go down and hold the Foundation with your mates: every tick builds your Aspect's
  hyperstructure. The first finished wins the age.
- **Payoff:** Your Aspect's hyperstructure rises in the Deep, stage by stage, seen by all.
- **Depth:** One Foundation for four Aspects: holding it is the race. Rivals stop you with the Altar.
- **Choices:** Which Aspect, once. Then each day: the Foundation, the Quarry or the Altar; strike now or wait; take a
  site, or a slot in a mate's.
- **Against today:** Orders exist on every Realm and no contract reads them. Season 1 groups the sixteen in fours, as
  the Master Scroll's alignments do, names the four Might, Harmony, Chaos and Guile, and makes the board one thing: how
  far each Aspect's hyperstructure is built.

**Might Harmony Chaos Guile**

| Fact                   | Season 1                                                                                                                                                                                                                         | In code today                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Teams (new)            | **four Aspects of four Orders: Might, Harmony, Chaos and Guile**, the four alignments of [the Master Scroll, "The Orders"](https://bibliotheca.gitbook.io/lootverse-master-scroll/the-realms/the-orders) under the owner's names | none; guild commands are off · `packages/types/src/constants/orders.ts:3-106`                       |
| The Order              | stays on the Realm and on the banner: the crest. The Aspect is the team                                                                                                                                                          | on the Realm's metadata; no contract reads it · `src/structures.cairo:57-91`                        |
| A Realm's Aspect (new) | a campaign home **picks it freely** at first launch, and its Order is drawn among the Aspect's four; a held Realm's Aspect is its Order's                                                                                        | a campaign home's Realm is drawn from its id · `src/logic/settlement_domain.cairo:341-394`          |
| Invites (new)          | a shared link lands a friend in your Aspect; no Aspect is ever closed; no switching                                                                                                                                              | a shared link of one kind, a Frontier day · `packages/identity/src/shares.ts:6-15` on `origin/next` |
| Mates (new)            | armies of one Aspect can't attack each other in the Deep; a member fills a slot in a mate's guard, and mates take sites together                                                                                                 | no army fights in Frontier                                                                          |
| The board (new)        | **the four hyperstructures**: the finished one first, then by what is built                                                                                                                                                      | players by sites cleared · `apps/herald/src/native/frontier-leaderboard.ts:35-42`                   |
| The Aspect page (new)  | the hyperstructure's bar and stage; each member's Glory, who guards which site, who was wiped and by which Aspect; the bane bar                                                                                                  | the facts are published; no page reads them by team                                                 |

| Why four                                   | An Aspect (4 teams) | An Order (16 teams) |
| ------------------------------------------ | ------------------- | ------------------- |
| Members at 200 players                     | 50                  | 12                  |
| Active on a median day (the smallest team) | 22 (18)             | 5 (2)               |
| Days a team has nobody on the quest        | 0%                  | 14%                 |

Season 0's rates: 43% of players active on a day, 15% doing the one daily thing. The 16 Orders become the teams at about
2,000 players: one preset value and one table. A free choice gave Aspects of 91, 49, 35 and 25 in the model: the crowded
one holds the Foundation more. On the playtest list.

#### The hyperstructure: build it, finish first (new)

| Hyperstructure rule | Season 1                                                                                                                                                                                                     | In code today                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| How many, where     | **one an Aspect, at a fixed tile of the Deep**, seen by everyone, open from the start                                                                                                                        | found on the map or reserved at the start, off in Frontier · `src/rules.cairo:271,284`, `frontier/base.ts:152-165` |
| What builds it      | **holding the Foundation only**: each tick it is held adds 5 to the height, split among its guards by their troops, each for their own Aspect. Nothing from the Surface, nothing for troops beaten           | resources given from a Realm, by its owner or guild · `src/logic/hyperstructures.cairo:149-188,342-354`            |
| Its size            | **a height of 10,000, in 5 stages of 2,000**: 2,000 ticks of the Foundation, 400 per stage                                                                                                                   | three states · `apps/game/src/three/constants/scene-constants.ts:101-105`                                          |
| A stage built (new) | the hyperstructure visibly grows, every Aspect is told, and **the next game day is a Triumph for the whole Aspect**: Clear Mist, Second Wind, Pale Moon, then Spoils (see Banes and Triumphs)                | —                                                                                                                  |
| The end             | **the first finished wins and ends the age**: every hyperstructure is consumed and the Spires go dark. Day 50 closes the season if none is finished: the mist wins. The others are placed by what they built | progress stored and published, each contribution credited · `src/logic/hyperstructures.cairo:149-188,370-411`      |

| How the 50 days go, 2,000 seasons, four Aspects, a bar of 1,500 | 100 players | 200        | 2,000      |
| --------------------------------------------------------------- | ----------- | ---------- | ---------- |
| The Deep opens (the first City down) on day                     | 2           | 2          | 2          |
| The first hyperstructure is finished, and the age ends, on day  | 40 (37–43)  | 32 (30–34) | 27 (26–28) |
| The mist wins                                                   | 0%          | 0%         | 0%         |
| The Aspect leading on day 25 wins                               | 74%         | 64%        | 60%        |
| World banes · team banes                                        | 3 · 12      | 2 · 17     | 1 · 22     |

**One Foundation makes the season's length hold whatever the crowd:** it pays 720 ticks a day at most, so ten times the
players end the age two days sooner, not ten times sooner. At 100 players the mist wins 2% of the time; at 50, most
seasons: that is the floor. With a bar of 1,500 the Aspect leading on day 25 wins 74% · 64% · 60% of seasons at 100 ·
200 · 2,000 players. 5 a tick and the bar of 1,500 are first values.

**The stage's Triumph.** Each of the first 4 stages gives the whole Aspect a different day, above the Deep only: it
reaches the members who never go down, and it adds no holding. Every Aspect gets its Triumphs as it builds, the leader
only sooner. The 5th stage ends the age.

| Player against player                                | When                                                                                                         | Who it hurts                                                | The answer                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Attacking a held site                                | in the Deep, whenever you play, or after waiting for its guard to weaken; its guards don't need to be online | the guards: their armies and the ticks they would have held | mates fill its slots, retake it, or go to another site                                        |
| A team bane on the Aspect that is first on the board | at the start of the day after an Aspect's bar is full                                                        | the target Aspect: its hyperstructure stops for a day       | enough of its members finish the bane quest: 25% of those who sent out an army the day before |
| Anything else                                        | never                                                                                                        | —                                                           | each Realm's maps above the Deep are its own and armies end with the day                      |

#### Rewards: when the age ends (new)

- **Need:** A stake for the whole Aspect, and a fair share for each member who went down.
- **Gets you to:** Build more than the others, finish first if you can, and hold the sites that serve your Aspect.
- **Payoff:** 500,000 LORDS, paid to wallets the moment the age ends.
- **Depth:** Two pools: finishing is worth 100,000; every point of height built is worth the same to every Aspect.
- **Choices:** The Foundation or the Altar: both give Glory, which sets your share. The Quarry pays you in labor and
  Essence instead.
- **Against today:** Today the top 10 players are paid by rank (`src/frontier_prizes.cairo:1-18`). No LORDS are paid
  inside the game: the ledger pays, outside it.

| Reward rule      | Season 1                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The budget       | **500,000 LORDS**, in two pools                                                                                                                                 |
| The finish       | **100,000** to the Aspect whose hyperstructure is finished. If the mist wins, it isn't paid and goes back to the treasury                                       |
| The build        | **400,000** shared by the four Aspects by the height each has built. No places: every point of height is worth the same                                         |
| A member's share | of its Aspect's reward, by **its Glory**: 5 each tick at the Foundation or the Altar, split by troops. Quarry ticks give no Glory: they paid the member already |
| Who is paid      | **anyone with at least 100 Glory**: 20 ticks on a site, held alone. No other gate: no Realm, ticket or pass needed. No cap                                      |
| When, and how    | when the age ends, by the ledger, to each member's wallet. One ledger upgrade: amounts posted by the relay, and an end that can come early                      |

| 500,000 on the 50-day race, 2,000 seasons, 200 players         | First · second · third · fourth | First to fourth | 1,000 more height is worth, to the fourth |
| -------------------------------------------------------------- | ------------------------------- | --------------- | ----------------------------------------- |
| By place, 40 / 30 / 20 / 10%                                   | 200k · 150k · 100k · 50k        | 4.0 : 1         | 81,800                                    |
| By place, 250 / 200 / 150 / 100 fitted to 500,000              | 179k · 143k · 107k · 71k        | 2.5 : 1         | 58,400                                    |
| **Two pools: 100,000 for the finish, 400,000 by points built** | 204k · 102k · 99k · 95k         | 2.2 : 1         | 5,300                                     |
| Two pools: 200,000 and 300,000                                 | 278k · 76k · 75k · 71k          | 3.9 : 1         | 4,000                                     |

| A member's share, 14 paid members an Aspect | The top member | Cities | A cap of 20% would move | The account that never sleeps | The median member, of 125,000 |
| ------------------------------------------- | -------------- | ------ | ----------------------- | ----------------------------- | ----------------------------- |
| Foundation ticks only                       | 23%            | 6%     | 4.1% of the reward      | 1.7× the mean Empire          | 7,400 LORDS                   |
| **Foundation and Altar ticks**              | 18%            | 12%    | 0.8%                    | 1.6×                          | 7,700 LORDS                   |
| All three sites                             | 16%            | 14%    | 0.0%                    | 1.5×                          | 7,800 LORDS                   |

**Why two pools and no places.** The race ends close: in 73% of seasons two of the three others finish within 200 of
height of each other. By place, those 200 points move 50,000 LORDS, and 1,000 more points are worth 58,000 to 82,000 to
the fourth Aspect: a lottery at the line. With a pool by points built, a point is worth the same from the first day to
the last, about 5 LORDS, to every Aspect. The finish pool keeps the first place worth about ×2 any other (2.2 : 1; the
owner's 250 / 200 / 150 / 100 is 2.5 : 1, and sums to 700,000).

**If the mist wins** (86% of seasons at 50 players, none at 200): the build pool is paid in full, by points built, and
the finish pool isn't: 400,000 out. **Why the Altar counts:** a tick there builds nothing for its guard's Aspect, so
without a share nobody would hold it; with it, an Altar tick and a Foundation tick are worth the same to the member.
**Why no cap:** a member's holding is bounded by the troops its town raises; a cap of 20% would move 0.8% of a reward.

**The ledger path.** Today the ledger checks each prize against a rank share
(`contracts/l2/ledger/src/contract.cairo:619-640`), pays only once the season's fixed end has passed (`:739-741`) and
can only extend a season (`:768`). The one upgrade: prize amounts posted by the relay, which `pay` already bounds by the
prize left; and a co-signed end that can only shorten the season, to the moment the first hyperstructure is finished.
What isn't paid goes back to the treasury when the season closes.

Watch in the playtest:

- **The hyperstructure must not pay the Realm:** a production bonus would make the leading Aspect richer. A Triumph is a
  bonus above the Deep, for 1 day.
- **A free choice of Aspect:** the crowded Aspect holds more. Measure the sizes before adding any rule.
- **Accounts opened only to add holding** raise troops like any other, and a share is split by troops: watch it in the
  playtest, through that split.
- **Members who never go down** build their Realms, and are paid nothing: a City goes down with a mate from day 2, and
  20 ticks on a site are all a reward asks.

Sources: `src/hyperstructures.cairo:5-61`, `src/logic/hyperstructures.cairo:84-188,342-411`,
`src/logic/settlement_domain.cairo:341-394`, `src/structures.cairo:57-91`,
`apps/herald/src/native/frontier-leaderboard.ts:35-42`

### 14. Economy and money

- **Need:** Enough each day to make one meaningful purchase choice, and a way to pay for the game that never buys a
  result.
- **Gets you to:** Decide where the day's labor and Essence go; spend money, if at all, on time above the Deep.
- **Payoff:** A Realm that visibly grows week over week, and an army worth sending down.
- **Depth:** The Surface has one job now: make the army. Labor is the town, Essence the research, wheat and Barracks the
  troops the Deep spends.
- **Choices:** Buildings, the next level, research, or troops for the Deep. Stamina, a reroll or the pass.
- **Against today:** Not a system but their sum, and the shop. Nothing on the Surface scores; everything on it feeds
  what does.

| Labor in a 16 h day: the most active Realm | Castle | Workshops           | Quest | Reveals | Troll camps | A day                                   |
| ------------------------------------------ | ------ | ------------------- | ----- | ------- | ----------- | --------------------------------------- |
| Settlement, Surface                        | 1,600  | 3,200 (1)           | 1,000 | 2,600   | 800         | **9,200**                               |
| City, Ethereal I                           | 3,200  | 6,400 (2)           | 2,000 | 11,800  | 6,300       | **29,700**                              |
| Kingdom, Ethereal II                       | 6,400  | 20,500 (4, Tools 3) | 4,000 | 44,500  | 17,100      | **92,500**                              |
| Empire, Ethereal II and the Deep           | 12,800 | 38,400 (6, Tools 5) | 8,000 | 44,500  | 17,100      | **120,800**, + 500 a tick on the Quarry |

| Essence in a day: the most active Realm | Reveals | One rift | The quest | A day                                  | The tree (1.0M) is |
| --------------------------------------- | ------- | -------- | --------- | -------------------------------------- | ------------------ |
| Settlement, Surface                     | 2,600   | 4,500    | 1,500     | **8,600**                              | 116 days           |
| City, Ethereal I                        | 11,800  | 13,500   | 3,000     | **28,300**                             | 36 days            |
| Kingdom, Ethereal II                    | 44,500  | 36,000   | 6,000     | **86,500**                             | 12 days            |
| Empire, Ethereal II and the Deep        | 44,500  | 36,000   | 12,000    | **92,500**, + 500 a tick on the Quarry | 11 days            |

| The Surface, in a 50-day season | Round 38             | Round 39, as approved        | Now                                                                                            |
| ------------------------------- | -------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Buildings                       | 8                    | 7                            | 8: the Hearth out, the Storeroom in                                                            |
| Research rows · tiers to buy    | 8 · 40               | 7 · 35                       | 7 · 35                                                                                         |
| Lores                           | 3                    | 2                            | 3: Shrine lore is back                                                                         |
| The tree, in Essence            | 3.6M: 39 Empire days | 1.0M                         | 1.0M: 11 Empire days                                                                           |
| An army grows in its day        | yes                  | no                           | yes: XP, skill points, boons, shrines                                                          |
| Guards                          | 5                    | 4                            | 5: the Wraith is back                                                                          |
| Relics                          | 5                    | 4                            | 5: the Tome is back                                                                            |
| Daily quests                    | 6                    | 6                            | 7, in a weekly bag; none needs an unlock                                                       |
| The Storeroom                   | out                  | out                          | back, as one building that doubles the store                                                   |
| Banes                           | 4 kinds              | 1, lifted by the day's quest | world banes (3, rolled) and team banes; 3 bane quests that replace the daily quest; 4 Triumphs |

**Judged by sessions, not by counts.** A cut that takes something a player does out of a sitting comes with content that
fills the time, or it isn't made. Round 39's cut of XP took one action in nine out of a sitting; it is reversed. **What
stays out, and why it costs no minute:** the Hearth (Homecoming happened at day end, with nothing to tap); the golden
ticket's double (a number on a claim). The mist's banes are back, as world banes. **What a sitting gains over Season
0:** a longer bar and Scouts (about twice the map actions), a quest, relics to time, the Deep and its mates, bane
quests.

#### What money buys (new)

- **Need:** A way to pay for the game that buys time on the Surface and never a result in the Deep.
- **Gets you to:** Buy credits; spend them on stamina outside the Deep, a quest reroll, a name. Or take the pass and
  play daily.
- **Payoff:** Armies back in the field sooner; more labor from every quest.
- **Depth:** One currency priced in dollars: a credit is one cent, and two points of stamina. On the web it is paid in
  LORDS at the day's market price.
- **Choices:** Whether to spend at all, and on what.
- **Against today:** Today a refill costs 1 LORDS a point from the Realm's LORDS or a deposit
  (`src/logic/lords.cairo:56-100` on `origin/next`); the apps have no store purchase yet (`apps/ios/package.json`; no
  Play Billing, `docs/store-submission.md:248`).

| What money buys (new)            | On the web: LORDS from the wallet                                                    | In the apps: the store                          | What the player gets                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| **Credits**, 1 cent each (tune)  | any amount at the day's LORDS price: 100 credits for about 275 LORDS today           | 100 for $0.99 · 500 for $4.99 · 1,000 for $9.99 | the one currency for everything below                                         |
| Stamina, outside the Deep        | 1 credit for 2 points                                                                | the same                                        | a refill above the Deep: a full bar is 90 credits, $0.90                      |
| A quest reroll, once a day       | 50 credits: $0.50                                                                    | the same                                        | today's quest drawn again                                                     |
| A name, a banner line or a badge | 200 credits: $2                                                                      | the same                                        | how others see you                                                            |
| **The pass**, or gifting one     | $10 in LORDS at the day's price: about 2,750 today; $4.99, about 1,372, for a holder | $9.99; $4.99 for a holder                       | below                                                                         |
| Not sold                         | —                                                                                    | —                                               | an army slot, troops, extra quests, stamina in the Deep: they would add Glory |

| The pass (new)          | What it is                                                                                                            | Worth             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------- |
| The labor bonus         | the daily quest pays **150% of its labor**                                                                            | the holder's part |
| The quest credits       | **10 credits for each daily quest done**: 500 credits over the 50 quests of a season. Quests done before buying count | $5                |
| The Season 1 Realm skin | **new art, the owner's**. Worn by choice: a toggle, never forced on. Kept on the account after the season             | $5                |

| Who                                   | Has free                            | Pays, for the rest                                   |
| ------------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| Anyone                                | —                                   | **$9.99**: the labor bonus, the credits and the skin |
| A held Realm or a Devcon ticket home  | the labor bonus                     | **$4.99**: the credits and the skin                  |
| A held Wonder or a golden ticket home | the labor bonus **and the credits** | **$4.99**: the skin                                  |

**One pass, two holder levels.** The prices are settled: $9.99, and $4.99 for a holder; in LORDS at the day's price,
about 2,750 and 1,372. Nobody has the skin free: it costs a held Wonder or a golden ticket home $4.99 too.

**How each is recognised, and what the credits given away cost.** A golden ticket home is a campaign home of tier 2
(`packages/core/src/utils/home-claim.ts:10` on `origin/next`; it already wears the Golden Devcon skin,
`apps/game/src/three/structures/realm-skins.ts:29`). A Wonder is set when a held Realm settles (`has_wonder`,
`src/logic/structures.cairo:399`). **Golden tickets:** 15 codes, 8 opened into homes in Season 0. **Wonders:** 50 of the
8,000 Realms (`packages/core/src/data/full-realms.json`); how many are held, and by how many wallets, isn't in the data
I have. So: 500 credits a season each, $5: $40 for the 8 golden homes, $75 if all 15 codes are used, at most $250 for
the Wonders. It also gives the golden ticket something back after its double was cut. A Wonder home keeps its own Wonder
castle, which the game already has (`realm-design.ts:8-15`); nothing is added for it.

**Does the pass pay for itself? In feel, not in credits handed back.** The credits return $5 over 50 quests, half the
price: a reroll every five days, or a name or a badge by quest 20. The other half is the skin, kept. And the labor on
every quest (107,500 over a season, about three bars' worth). **Who pays:** Season 0's 187 players came by ticket, so
they start with the labor bonus and are the $4.99 buyers; players who arrive after pay $9.99. Season 0's stamina sink
was 14,274 LORDS in 10 days: the pass is the revenue.

**Granting the skin.** Frontier dresses a home by where it comes from: Devcon and Golden Devcon, with a model for each
Realm level, read from its founding record (`apps/game/src/three/structures/realm-skins.ts:24-30`, `realm-skins.json`).
The Season 1 skin is a third entry there, with its own models, worn when the account's pass record says so and the
toggle is on. It needs one record of the pass that outlives the game. The cosmetics registry's skins and auras are
collectibles some players own; they are not sold for credits.

| Dollars first: what a dollar buys             | A point of stamina | A bar of 180        | A day's regeneration (720) | $1 buys                                     | The smallest bundle, $0.99 |
| --------------------------------------------- | ------------------ | ------------------- | -------------------------- | ------------------------------------------- | -------------------------- |
| Round 39: 1 credit = $0.001, a point a credit | $0.001             | $0.18               | $0.72                      | 1,000 points: 100 Scout reveals, 50 minutes | 1,000 credits              |
| **1 credit = 1 cent, 2 points a credit**      | $0.005             | $0.90               | $3.60                      | 200 points: 20 Scout reveals, 10 minutes    | 100 credits                |
| 1 credit = 10 cents, sold by the bar          | $0.0056            | $1.00               | $4.00                      | one bar                                     | 10 credits                 |
| Small credits kept, 5 credits a point         | $0.005             | $0.90 (900 credits) | $3.60                      | 200 points                                  | 1,000 credits              |
| Season 0: 1 LORDS a point                     | $0.0036            | $0.65               | $2.62                      | 275 points                                  | —                          |

| What it costs the player                           | Stamina bought | Round 39 | **1 credit = 1 cent** | 10 cents, by the bar |
| -------------------------------------------------- | -------------- | -------- | --------------------- | -------------------- |
| A new Settlement, day 1: one bar, to take the ruin | 180            | $0.18    | $0.90                 | $1.00                |
| A City with 15 minutes: one bar for the Scouts     | 180            | $0.18    | $0.90                 | $1.00                |
| An Empire evening: two bars of 360                 | 720            | $0.72    | $3.60                 | $4.00                |
| A returning player: a bar for each of three armies | 540            | $0.54    | $2.70                 | $3.00                |
| A season: one bar a week                           | 1,260          | $1.26    | $6.30                 | $7.00                |
| A season: one bar a day                            | 9,000          | $9.00    | $45.00                | $50.00               |

| The pass, credits back to a player who does the quest on | 25 days of 50 | 40 days | every day                     | What they buy                                                         |
| -------------------------------------------------------- | ------------- | ------- | ----------------------------- | --------------------------------------------------------------------- |
| Round 39: 100 credits a quest at $0.001                  | $2.50         | $4.00   | $5.00                         | 28 bars a season                                                      |
| 20 credits a quest at 1 cent                             | $5.00         | $8.00   | $10.00: ×2 what a holder pays | 11 bars                                                               |
| **10 credits a quest**                                   | $2.50         | $4.00   | $5.00                         | 5 bars and a half; or a reroll every five days; or a name by quest 20 |

**Why $0.001 was too cheap.** A dollar bought 1,000 points of stamina: five and a half bars, 50 minutes of play; a whole
day's regeneration cost $0.72, and a bar a day all season $9, less than the pass. Only stamina was cheap: the reroll
($0.50) and a look ($2) were already priced in dollars. **At 1 credit = 1 cent** a credit is a unit a player can count,
a bar is $0.90 (Season 0 charged $0.65 at today's LORDS price), a day's regeneration $3.60, and the numbers are small
and round: 50 for a reroll, 200 for a look, 10 a quest from the pass.

**How a payment works. Web:** the shop quotes the credits in whole LORDS at the day's price; the wallet signs one LORDS
transfer on L2 (`apps/game/src/shell/value/deposit-payment.tsx:26-35` on `origin/next`); the relay verifies it and
co-signs a receipt (`apps/value-relay/src/deposit-verifier.ts`, `deposits.ts`); the game delivers the receipt once to
the account's balance (`src/logic/deposits.cairo:54-93`) and spends from it (`:120`). **Apps:** a store purchase of a
bundle; the app sends the store's receipt to the server, which checks it with the store and signs the same kind of
receipt. Nothing of it exists yet (`apps/ios/package.json`, `docs/store-submission.md:248`), and the stores keep 15 to
30%. **One change to today's deposit:** it sweeps unspent LORDS back at the season's end (`:104-118`); credits are
priced in dollars, so they stay with the account for the next season instead.

**Dollars first.** Every price is set in dollars, the stores' unit; the LORDS amount comes from the market. The server
reads LORDS's price once a game day, as the comeback email already does (`apps/realms/scripts/comeback-email.ts:166-170`
on `origin/next`), publishes it as the day's price and keeps the last one if a read fails. At $0.003637, $1 is 275
LORDS: 100 credits are 275 LORDS, the pass 2,750, a full bar 248.

**Why stamina never buys the Deep.** What holds a site is troops, and troops aren't sold. Stamina buys the way down, and
with the spire found by the tenth reveal the way down is short for everyone: a buyer saves minutes.

**Deposits and withdrawals stay in the code, for Eternum, and are off for Frontier:** its preset doesn't offer them
(`config/source/frontier/native.ts:67-68`), it sets no deposit source (`src/games.cairo:74`), and the client gates on
`isCommandEnabled`. The web purchase reuses the deposit's co-signed hand-off to credit spend-only credits
(`src/logic/deposits.cairo:54,120` on `origin/next`); credits never come back out. The holder's pass reads the home's
source, recorded when a Realm settles (`src/settlement.cairo:4-7`, `src/logic/settlement.cairo:283-286`,
`apps/realms/server/realm-holdings.ts:75,124` on `origin/next`).

Watch in the playtest:

- **The weakest number is how many troops a Realm brings down a day** (8,000 / 15,000 / 25,000 in the model). In Season
  0, 52 of 187 players ever levelled up their Realm. It sets how much of the day the sites are held.
- **The money rule holds:** money buys time above the Deep, never a result in it. A bar ($0.90) adds up to 36,000 labor
  or Essence, a third of an Empire's day, toward a town and a tree that both have a ceiling.
- **What round 39 did to the sinks:** the way down costs about 110 stamina, so stamina no longer buys the Deep sooner;
  it buys Surface income. Troops are not sold. The reroll gives the bag's next quest.

Sources:

## Not in Season 1

- **LORDS inside the game:** chests, LORDS ruins, a Realm's LORDS, LORDS paid by play. Deposits and withdrawals stay in
  the code for Eternum, off for Frontier.
- **Rewards by place, a cap on a member's share, Quarry ticks in a member's share, LORDS for anything on the Surface.**
  Two pools; Foundation and Altar ticks.
- **Sites that rise, run out or move:** pulses, a count of sites by Realms down, a store, a random root, tiles to reveal
  in the Deep, extraction and carrying. Three fixed sites, never used up.
- **A guardian, a last tide, banes softened by building, gifts to the hyperstructure, a build in labor and Essence,
  Glory for troops beaten.** Only the held Foundation builds.
- **A caster or a pick, kinds of team bane, Restless Dead, a bane's share by Realm level, a bane quest in addition to
  the daily quest, a second reward for a team bane or for a bane that wasn't ended, four team-bane quests below the
  Surface, a quest done by sending 1 army, one stage bonus for all five stages, a world bane on a team bane's day.** The
  bane quest replaces the daily quest; three bane quests any Realm can finish on the Surface; four Triumphs.
- **Homecoming and the Hearth; skill points that buy research's own tiers, or a fixed menu of three skills; a Scout army
  with Battle; Duo boons; a boon that slows the troops lost each tick; the Storeroom and the Granary as research sides;
  several Storerooms; a Storeroom with steps of its own.** Armies end with the day; a skill point shows three boons; one
  Storeroom doubles the store.
- **Daily quests that need an unlock (Descent, Pilgrims); world banes on fixed days; Charge kept to beasts; a guard
  filled by one Realm's armies.**
- **Direct descent, more base stamina.** The day's spire is found by the tenth reveal.
- **The golden ticket's double, a stepped pass track, pass cosmetics.** One pass: the labor bonus, 10 credits a quest,
  the Season 1 skin. The winter set and the registry's skins are not in it.
- **The registry's skins and auras sold for credits.** They are collectibles some players own.
- **Switching Aspect, sending troops or resources to an ally.** Value would move between accounts, which pays botting
  activity. Mates share a guard, not their stores.
- **Anything bought that adds Glory:** troops, an army slot, extra quests, stamina in the Deep.
- **Army tiers (T2, T3), the Forge, a market, Huts, Crossbowmen, biome modifiers, dice in fights, wandering beasts.**
- **The sixteen Orders as teams.** Four Aspects; the Orders come back as teams at about 2,000 players.

## First values, to check in the playtest

- **The Deep:** the beast at 10,000; 200 troops a tick; 4 slots, 1 per player; 5 each tick from the Foundation and the
  Altar, 1,000 from the Quarry; the site alert, at most 1 per site per day.
- **Army boons:** the first point at 60 XP; the nine boons' steps (Battle +10%, Charge +5%, Guard −5%, Vigour +10%,
  Plunder +10%, Lore +10%, Camps and Rifts +25%, Shrines +15%); 5 steps per boon; rest at 20 stamina per rank; which
  Order gives what.
- **Banes:** the roll's step (+20% for each day without a world bane); beasts +50%, regeneration and production at 50%;
  the bane quests' sizes: the Stand 3 × level, the Lights 20 × level, the Cull 2,500 · 6,000 · 10,000 · 15,000; the 25%.
- **The race:** 10,000 in five stages of 2,000; a bane bar of 1,500. **The four Triumphs:** a reveal finds something 2
  times as often; stamina regenerates ×2; beasts at 50%; a cleared site pays ×2.
- **Prices, in dollars first:** a credit at 1 cent; stamina at $0.005 a point (2 a credit); the bundles (100 / 500 /
  1,000); the reroll at $0.50, a look at $2; the pass at $9.99, $4.99 for a holder, and 10 credits a quest.
- **Level prices** 2,500 / 15,000 / 50,000, and the labor stores that hold them.
- **The research ladder** 5,000 / 10,000 / 25,000 / 50,000 / 100,000 Essence; the lore ladder: Well 2,500, Shrine 5,000,
  Spire 10,000. **Buildings:** Farm, Barracks and Lodge from 500; the Storeroom at 10,000 labor, from City. **The
  start:** 3,000 Knights in two armies, 6,000 wheat.
- **The quest:** its seven base counts and its reward (1,000 labor and 1,500 Essence, ×2 at each Realm level).
- **The relics' steps** (Blade +10%, Ward −5%, Plunder +20%, Tome +40%, Far-Eye 6 tiles a tier) and 30 minutes a tier;
  ruin beasts 1,000 to 25,000.
- **Charge** 10 to 50%; **the Scout's** −25%; the spire's odds, +10% a reveal.
- **Not needed for the playtest:** the shop, the store builds and the day's LORDS price.

## What a playtest will measure

- **How many troops a Realm brings down a day:** it sets how much of the day the three sites are held (58% for the
  Foundation in the model).
- **The race:** the day the age ends (day 32 in the model at 200 players), and how often the leader on day 25 wins
  (64%).
- **Which site players go to,** by Realm level; whether the Quarry and the Altar are held; whether Cities come down.
- **Slots:** whether members fill a mate's slots, attack together, or wait for a guard to weaken and take a site of
  their own (1.1 slots filled in the model).
- **The round-the-clock gain** (1.3 to 1.7× the mean Empire in the model).
- **Accounts opened only to add holding to an Aspect,** watched through the split by troops.
- **Aspect sizes under a free choice,** and whether the crowded one holds the Foundation.
- **Session length** against Season 0's 15 minutes and 30 actions, and how points are spent: how often each boon is
  taken when offered, and how often an army rests.
- **Bane quests:** whether a 20-minute quest draws as many members as Season 0's daily claim (15%), and how often an
  Aspect ends a bane (75% of bane days at 200 players in the model). **The bar:** 17 team banes a season at 1,500 in the
  model.
- **The way down:** minutes from the first reveal to the Deep, by Realm level.
- **The seven quests:** which ones a Settlement can't finish, and which ones players reroll.

## The build list: 48 changes

**S**: a preset value or one check. **M**: a new rule in a module that exists. **L**: a new module, or a change to how
regions, armies or currencies are stored.

Slices: 1 the first playtest · 2 the town and the troops · 3 the shop and the rewards.

### Contracts (18)

| Id  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Size | It deletes                                                                                                                                                                                                                                                       | Needs       | Slice |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----- |
| C1  | **Spires are found, at a known cost.** A roll on each reveal once Spire lore is known, 10% on a layer's first reveal of the day and 10% more each reveal; one a layer a day for each Realm; entering goes one layer down, from Ethereal II into the Deep (`src/discovery.cairo:85-123`, `src/logic/movement.cairo:234-238`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | M    | the home-ring spire that moves each day; Depth research I to III                                                                                                                                                                                                 | —           | 1     |
| C2  | **The Deep is one fixed, shared map.** Every Realm's armies in Ethereal III stand on the same 50 × 50, with no reveals (`src/expeditions.cairo:114-141`, `src/logic/movement.cairo:234-243`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | L    | the Deep's daily draw for each Realm                                                                                                                                                                                                                             | C1          | 1     |
| C3  | **Army against army, in the Deep only,** with the guard formula; never an ally (`src/combat.cairo:198-403`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | M    | nothing                                                                                                                                                                                                                                                          | C2, C21     | 1     |
| C4  | **Three fixed sites.** The Foundation, the Quarry and the Altar at fixed tiles of the Deep, each behind a beast of 10,000 at the day's start; never used up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | S    | the LORDS chest system: shares, the daily price, the even unlock, the reverting blow (`src/logic/lords_budget.cairo:27-230`); the 0.05% chest; the one-ruin-a-layer rule                                                                                         | C2          | 1     |
| C5  | **Held sites, and the tick.** The army that beats a site's guard becomes it; members of its Aspect can each fill one of its 4 slots; on the army tick every army in the Deep, guards included, loses 200 troops, and each held site pays its slots by their troops: 5 Glory and 5 of height (Foundation), 500 labor and 500 Essence (Quarry), 5 Glory and 5 on the Aspect's bar (Altar)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | M    | LORDS paid to the Realm on the killing blow                                                                                                                                                                                                                      | C3, C4      | 1     |
| C6  | **Relics on: five relics, five tiers, three an army.** A ruin's tier is rolled when it appears and sets its beast; one step a tier, 30 minutes a tier; free to switch on, anywhere; a fourth replaces one; gone at day end; the Tome's XP modifier (`src/logic/relics.cairo:84-113,437-476,568-597`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | M    | the Essence price to switch one on; the Realm's relic store; the Surface-only check; the rule that relics and chests can't both be on (`src/logic/preset_record.cairo:431-449`); the Forge                                                                       | —           | 1     |
| C8  | **The daily quest.** A bag of seven, one a day, none needing an unlock; its base count × the Realm level; its reward, collected once, is 1,000 labor and 1,500 Essence, ×2 at each Realm level, 150% of the labor with the labor bonus, for every home (`src/logic/entry.cairo:172-268`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | M    | the daily claim; the rule that a free home claims nothing; the eight point grants that are all 0; the ticket and golden claim amounts                                                                                                                            | —           | 1     |
| C9  | **Banes.** A bane starts at the start of a day and lasts that day at most. World banes: the mist's roll from day 2, 0% the day after one and +20% for each day without one, on all 4 Aspects, stopped for the season by the first team bane issued; each one modifier on a rule that exists (beasts, stamina regeneration, production). Team banes: a bar of 1,500 each Aspect fills at the Altar; issued when full, it starts the next day on the Aspect that is first on the board, or the next one if that Aspect already has a team bane; its hyperstructure stops, one check where it is built (`src/logic/hyperstructures.cairo:149`). The bane quest replaces the daily quest and pays the daily reward: the Stand and the Lights reuse the daily quests' counts, the Cull counts guard troops beaten. A count per Aspect and day of members who sent out an army; the bane ends when the members who finished the quest reach 25% of the day before's count. Ending a world bane pays a second grant for the same day (`src/logic/entry.cairo:82,209-219,310-314`); ending a team bane lets the hyperstructure grow again | M    | nothing: there is no such thing today                                                                                                                                                                                                                            | C5, C8      | 1     |
| C10 | **Combat clean-up.** No ×1.15 and ×0.85 in Frontier (`src/combat.cairo:163-196`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | S    | two code paths that net to ×0.98                                                                                                                                                                                                                                 | —           | 1     |
| C17 | **The hyperstructures.** Four, one an Aspect, at fixed tiles of the Deep, created with the season; built by Foundation ticks, each credited to a member as a contribution; 5 stages of 2,000; each of the first 4 stages makes the Aspect's next day a Triumph, above the Deep only: Clear Mist (a reveal finds something 2 times as often), Second Wind (stamina regenerates ×2), Pale Moon (beasts at 50%), Spoils (a cleared site pays ×2); a Triumph and a bane on one day multiply; the first finish is stored and ends the season, day 50 at most (`src/logic/hyperstructures.cairo:84-188,342-411`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | M    | the guild access check, the shares and their points, and resource contributions, for Frontier                                                                                                                                                                    | C2, C5, C21 | 1     |
| C21 | **Aspects.** An Aspect chosen freely at settling; a campaign home's Realm drawn among the Aspect's four Orders (`src/logic/settlement_domain.cairo:341-394`); a held Realm's Aspect read from its Order (`src/structures.cairo:57-91`); a member count an Aspect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | M    | the draw of a home's Realm among all 8,000                                                                                                                                                                                                                       | —           | 1     |
| C11 | **Scouts.** The Lodge produces the Paladin army (`src/buildings.cairo:204-215`); Scouts explore for 10 and deal −25%; Scouting is theirs alone                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | M    | the Lodge that only taught                                                                                                                                                                                                                                       | —           | 2     |
| C12 | **Charge.** The Barracks' research row; the opening-hit rule in every fight, against a beast or an army                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | S    | the Barracks row's two sides (they move to C13)                                                                                                                                                                                                                  | —           | 2     |
| C13 | **The town.** Buildings open by Realm level; castle labor by level; one row a building; the Conscription Hall (Drill and Rations as one row); the Storeroom: 1 Storehouse per board, from City, the store's limit ×2 while it stands (`src/logic/resources.cairo:48-74`, `src/logic/construction.cairo:417-430`); the lore ladder Well, Shrine, Spire                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | M    | Huts and population; the Hearth and Homecoming (`src/logic/troops.cairo:912-958`); the research gate on training buildings (`src/logic/construction.cairo:417-430`); the Hut row; the store side of the Farm's and Workshop's tiers (`src/research.cairo:25-27`) | —           | 2     |
| C14 | **Army boons.** The first point at 60 XP; when a point is earned, three boons are drawn on chain, one from each of the army's three givers (War, Ward, Spoils for Knights; Paths, Ward, Spoils for Scouts), and stored with the army's progress, beside `shrine_point` (`src/progression.cairo:74-126,241-257`). The pick: one of the three, or rest at 20 stamina per rank; several in one transaction; 5 steps per boon, steps over 5 back as 20 stamina each (`src/progression.cairo:274-312`, `src/logic/relics.cairo:144-185`). Effects: Guard, Plunder and Vigour as day steps added to a relic's value, never overwritten by it (`src/combat.cairo:318-350`, `src/exploration_rewards.cairo:130`, `src/stamina.cairo:59-70`); Lore and Charge read the boon's steps. The Well gives 90 stamina (`src/logic/relics.cairo:224-231`); Logistics a share of the bar (`src/rules.cairo:28-44`)                                                                                                                                                                                                                                  | M    | points that buy research's tiers; the four skills on an army's record; Homecoming as a skill-point choice; the flat trade and its ×2 mode; the flat Logistics steps                                                                                              | C11, C12    | 2     |
| C15 | **Site rewards.** Cyclops herds pay wheat, Wraith bands pay XP ×3 (`src/expeditions.cairo:44-61`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | S    | the beasts' labor line                                                                                                                                                                                                                                           | —           | 2     |
| C16 | **Supply posts.** Reinforcing also accepts a tile beside a Troll camp the Realm cleared today, above the Deep (`src/logic/troops.cairo:486-494,897-906`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | S    | nothing                                                                                                                                                                                                                                                          | —           | 2     |
| C22 | **Credits.** A Realm's credit balance, credited by the deposit's co-signed hand-off as spend-only credits (`src/logic/deposits.cairo:54,120` on `origin/next`), for the web and for the store relay; spent on stamina outside the Deep (2 points a credit), a reroll, a look, the pass; never withdrawn                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | M    | the refill for 1 LORDS a point anywhere (`src/logic/lords.cairo:56-100` on `origin/next`)                                                                                                                                                                        | C8          | 3     |

### Presets (9)

| Id  | Change                                                                                                                                                                                                                                                                                                                                                                                      | Size | It deletes                                                             | Needs       | Slice |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- | ----------- | ----- |
| P1  | **Clock.** The season's length, 50 days (`frontier/base.ts:62-68`); stamina 180 (`frontier/base.ts:112`); no low-stamina defender rule (`staminaDefenseReq` 0)                                                                                                                                                                                                                              | S    | the ×0.7 defender rule, by its number                                  | —           | 1     |
| P2  | **Commands.** Army battle, relic use and the quest reward join Frontier's list; deposits and withdrawals stay off (`frontier/native.ts:51-72`)                                                                                                                                                                                                                                              | S    | nothing                                                                | C3, C6, C8  | 1     |
| P3  | **Sites and finds.** Guard sizes; ruin beasts by rarity; ruins with no daily limit; the reveal reward counts up to 10,000 troops (`explore_reward_strength_cap`, unset today)                                                                                                                                                                                                               | S    | nothing                                                                | —           | 1     |
| P4  | **Relics.** The five relics and their steps (`relics: []` today, `frontier/native.ts:36`); three an army                                                                                                                                                                                                                                                                                    | S    | the chest share table and price ceiling (`frontier/native.ts:126-131`) | C6          | 1     |
| P5  | **Quests.** The seven quests and their base counts, the reward; the three bane quests and their sizes; the roll's step; the four Triumphs' factors; 60 XP, 20 stamina per rank and the table of givers by Order (`config/source/frontier/native.ts:115-122`)                                                                                                                                | S    | the claim amounts (`frontier/native.ts:124`)                           | C8          | 1     |
| P8  | **The Deep.** The three sites' tiles, the beast, the troops lost a tick, the three pays, the bane bar and the five stages of the build (`src/logic/preset_record.cairo:400-420`)                                                                                                                                                                                                            | S    | nothing                                                                | C4, C5, C17 | 1     |
| P9  | **Aspects.** The table from Order to Aspect, 16 rows: the Order ids are not in the Loot suffix order (`packages/types/src/constants/orders.ts:3-106`)                                                                                                                                                                                                                                       | S    | nothing                                                                | C21         | 1     |
| P6  | **Town prices.** Level prices and labor stores; castle labor by level; the Workshop at 1,000; Farm, Barracks and Lodge at 500; the Storeroom at 10,000 labor (free today, `frontier/base.ts:46`); the start at 3,000 Knights and 6,000 wheat (`frontier/base.ts:71-75`); unlock levels; the rows and the ladder of 5,000 to 100,000 (`frontier/base.ts:16-47`, `frontier/native.ts:87-105`) | S    | the Hut, Hearth and Depth rows                                         | C13         | 2     |
| P7  | **Scouts.** Rate and wheat price (`frontier/base.ts:27-32,49-52`)                                                                                                                                                                                                                                                                                                                           | S    | nothing                                                                | C11         | 2     |

### Relay and indexer (7)

| Id  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Size | It deletes                                                                            | Needs    | Slice |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------- | -------- | ----- |
| H1  | **Read the new facts.** The quest's reward, banes, relics, the three sites and who guards them, Aspects, Glory and height (`apps/herald/src/native/decoder.ts`, `read-models.ts`, `schema.ts`)                                                                                                                                                                                                                                                                     | M    | nothing                                                                               | C4 to C9 | 1     |
| H2  | **The board and the Aspect feed.** The four hyperstructures by progress, from the rows the contract already publishes; each member's Glory, who guards which site, who was wiped (`apps/herald/src/native/frontier-leaderboard.ts:35-42`)                                                                                                                                                                                                                          | S    | the ranking by sites cleared, and the day ranks built on it (`frontier-day-ranks.ts`) | C17, H1  | 1     |
| H5  | **Invites.** A second kind of shared link, "aspect", beside "frontier-day": the visit it records offers the new account its sender's Aspect first (`packages/identity/src/shares.ts:6-15`, `packages/identity/src/client.ts:176-201,539-575` on `origin/next`)                                                                                                                                                                                                     | S    | nothing                                                                               | C21      | 2     |
| H3  | **The day's LORDS price.** Read once a game day as the comeback email does (`apps/realms/scripts/comeback-email.ts:166-170` on `origin/next`), published, the last one kept if a read fails; web prices quoted in whole LORDS from it                                                                                                                                                                                                                              | S    | nothing                                                                               | —        | 3     |
| H4  | **The pass:** the labor bonus read from the home's source; the quest credits free for a held Wonder (`has_wonder`, `src/logic/structures.cairo:399`) or a golden ticket home (tier 2, `packages/core/src/utils/home-claim.ts:10`); the pass bought at $9.99, or $4.99 by a holder; quests done, 10 credits each; a record of the pass on the account, so its skin is kept                                                                                          | S    | nothing                                                                               | C8, C22  | 3     |
| H7  | **The site alert.** A new kind of push beside "army rested": a watch per player and site that wakes when the guard, which loses 200 troops per slot each tick, drops to where the player's largest army outside the Deep is 150% of it; at most 1 per site per game day; the Important level (`packages/notifications/src/notification-kinds.ts:13-22`, `apps/realms/server/army-rest.ts:23-45`, `shard-notifier.ts:169-183,224-263`)                              | S    | nothing                                                                               | C5, H1   | 1     |
| H6  | **Rewards.** Each member's Glory read from the shard; when the age ends the relay posts the amount of each member with 100 Glory or more (the finish pool to the finisher, the build pool by height built, then the member's share by Glory). The ledger upgrade: posted amounts in place of the rank check (`contracts/l2/ledger/src/contract.cairo:619-640`; `pay` already bounds them, `:739-741`) and a co-signed end that only shortens (`:768` only extends) | M    | the top 10 and its day ranks; the rank-share check                                    | H2, C17  | 3     |

### Client (14)

| Id  | Change                                                                                                                                                                                                                                                                                                                                                                                                    | Size | It deletes                                                   | Needs        | Slice |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------ | ------------ | ----- |
| U16 | **The boon sheet.** Three cards with the Order's crest and name, the boon, its stars and one number; rest; several points one after the other; the army's boons on its line and in the feed (`apps/game/src/ui/features/frontier/army/army-panel.tsx`, `army-detail.ts`); Herald reads the new record                                                                                                     | M    | the skill menu of Battle, Logistics and Scouting             | C14, H1      | 2     |
| U15 | **The interface opens as you play.** One table: each part of the screen and the state of the Realm that shows it; one line of explanation, shown once per account; a Show everything setting. It reuses the lit first build and the place bar that hides what a state lacks (`apps/game/src/ui/features/frontier/build/first-build.ts:12-16`, `hud/frontier-nav.tsx:28-35`)                               | M    | nothing: there is no tutorial today                          | U1, U3       | 1     |
| U1  | **The day's banner.** The quest, its count ("1 of 2 camps") and its reward; a bane on your Aspect, the mist's or a rival's, told apart by colour, name and sender; the bane quest in place of the daily quest and the count that ends the bane ("4 of 6"); your Aspect's bane bar; a Triumph, by name                                                                                                     | M    | the daily claim button                                       | H1           | 1     |
| U2  | **Spires.** A found spire on the map, the rising odds, entering it, the marked arrival tile; the fix for "landing is taken"                                                                                                                                                                                                                                                                               | M    | the home-ring spire and the Depth research panel             | C1           | 1     |
| U3  | **The Deep.** Other players' armies on one map, allies marked, attacking an army; the three sites, their four slots, who fills each and what a tick pays; taking a slot; each army's draining bar and the ticks it has left                                                                                                                                                                               | L    | nothing                                                      | C2 to C5, H1 | 1     |
| U4  | **Relics.** An army's three slots, switching one on, its timer, choosing which one a fourth replaces                                                                                                                                                                                                                                                                                                      | M    | nothing                                                      | C6           | 1     |
| U5  | **The Aspect page.** The four hyperstructures ranked; your Aspect's stage, its height and each member's Glory; the feed; the stage's model (three exist, `apps/game/src/three/constants/scene-constants.ts:101-105`)                                                                                                                                                                                      | M    | the sites-cleared board                                      | H2, C17      | 1     |
| U12 | **Pick an Aspect.** First launch: four cards and their members; one tap                                                                                                                                                                                                                                                                                                                                   | S    | nothing                                                      | C21, P9      | 1     |
| U6  | **The town.** The build panel by Realm level; one research row a building; the castle's lores; art for the Conscription Hall                                                                                                                                                                                                                                                                              | M    | Huts, the population counter, the research gates, the Hearth | C13, C14, P6 | 2     |
| U7  | **Scouts and Charge.** Choosing the troop for an army; the Scout look; Charge in the fight preview                                                                                                                                                                                                                                                                                                        | M    | nothing                                                      | C11, C12     | 2     |
| U8  | **Supply posts.** A banner on a cleared camp; reinforcing beside it                                                                                                                                                                                                                                                                                                                                       | S    | nothing                                                      | C16          | 2     |
| U14 | **The Season 1 Realm skin.** New art, from the owner: a model for each Realm level, a third entry beside Devcon and Golden Devcon (`apps/game/src/three/structures/realm-skins.json` on `origin/next`)                                                                                                                                                                                                    | M    | nothing                                                      | —            | 3     |
| U13 | **Invite a friend.** The share sheet on the Aspect page; the landing naming the sender and the Aspect (`apps/game/src/shell/share/shared-link-page.tsx:18-24` on `origin/next`)                                                                                                                                                                                                                           | S    | nothing                                                      | H5, U12      | 2     |
| U11 | **The shop.** Credits (web: LORDS at the day's price; apps: store bundles, a store purchase that doesn't exist yet), stamina outside the Deep, the reroll, looks, the pass, what each holder has free, and the count; the Season 1 skin on a pass home, with a toggle to wear it or not (the function that dresses a Devcon home, `apps/game/src/three/structures/realm-skins.ts:24-30` on `origin/next`) | L    | nothing                                                      | C22, H3, H4  | 3     |
