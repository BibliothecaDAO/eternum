#!/usr/bin/env python3
"""Live data: pull prod's public Herald and chain, then answer the balance and usage questions from the pull.

Usage (run from the folder that keeps the pulls; they land in its raw/, never in the repository):
  python3 -I live-data.py pull    [herald-url] [game-id]   # writes raw/<UTC stamp>/, read-only GETs
  python3 -I live-data.py analyse [raw-dir]                # prints every table, writes usage.json; newest pull by default
  python3 -I live-data.py all     [herald-url] [game-id]   # pull, then analyse that pull
  python3 -I live-data.py usage   [raw-dir]                # (re)write the pull's usage.json (the lab's Data → UI usage)
  python3 -I live-data.py ledger  [raw-dir]                # read the mainnet value ledger into a pull
  python3 -I live-data.py lag     [samples] [seconds]      # Herald's confirmed block against the shard's head

The usage step decodes the Games contract's events with Herald's decoder (usage.ts, through bun), so it needs the
repository's dependencies installed.

Defaults: https://herald.realms.party, game 1. Only public data is stored: the Herald's history, the per-player
snapshots its own client reads, the leaderboard, closed days' ranks and the players' public names.
"""
import collections
import gzip
import json
import math
import os
import re
import subprocess
import sys
import time
import urllib.request
from datetime import UTC, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(os.getcwd(), "raw")
PROFILES = "https://play.realms.party/api/profiles?accounts="


def get(url):
    # The edge refuses urllib's default agent with 403.
    request = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code < 500 or attempt == 2:
                raise
        except urllib.error.URLError:
            if attempt == 2:
                raise
        time.sleep(2)


def save(folder, name, body):
    with open(os.path.join(folder, name), "w") as out:
        json.dump(body, out, separators=(",", ":"))


def pull(base="https://herald.realms.party", game=1):
    base = base.rstrip("/")
    started = datetime.now(UTC)
    folder = os.path.join(RAW, started.strftime("%Y%m%dT%H%M%SZ"))
    os.makedirs(folder)
    directory = get(f"{base}/games")
    entry = next(g for g in directory["games"] if g["game_id"] == int(game))
    save(folder, "game.json", entry)
    save(folder, "games.json", directory)
    items, offset = [], 0
    while True:
        page = get(f"{base}/games/{game}/history?limit=100&offset={offset}")
        items += page["items"]
        offset += 100
        if offset >= page["total"]:
            break
    save(folder, "history.json", {"complete_through_block": page["complete_through_block"], "items": items})
    save(folder, "leaderboard.json", get(f"{base}/games/{game}/leaderboard"))
    ranks = {}
    for day in range(int(entry.get("day_index") or 0)):
        try:
            ranks[day] = get(f"{base}/games/{game}/days/{day}/ranks")
        except urllib.error.HTTPError as error:
            ranks[day] = {"error": error.code}
    save(folder, "day-ranks.json", ranks)
    save(folder, "rules.json", get(f"{base}/games/{game}/snapshot"))
    players = sorted(
        {
            i["value"]["owner"]
            for i in items
            if i["model"] == "StoryEvent" and "RealmCreatedStory" in (i["value"].get("story") or {})
        }
    )
    snapshots = {}
    for player in players:
        snap = get(f"{base}/games/{game}/snapshot?actor={player}")
        # Rule rows repeat in every actor's scope; rules.json keeps them once.
        rules = {m["model"] for m in get_rules(folder)["models"] if m["rows"]}
        snapshots[player] = {
            "confirmed_block": snap["confirmed_block"],
            "models": {m["model"]: m["rows"] for m in snap["models"] if m["rows"] and m["model"] not in rules},
        }
    save(folder, "players.json", snapshots)
    snapshots_at = datetime.now(UTC)
    pull_blitz(folder, base)
    pull_ledger(folder)
    named = set(players)
    for g in load(folder, "blitz.json").values():
        named |= {r["account"] for r in g["entry"]["roster"]} | {e["address"] for e in g["leaderboard"]["entries"]}
    named = sorted(named)
    names = {}
    for start in range(0, len(named), 20):
        chunk = get(PROFILES + ",".join(named[start : start + 20]))["profiles"] or {}
        names.update({address: profile.get("name") for address, profile in chunk.items()})
    save(folder, "names.json", names)
    first = min(i["block_number"] for i in items if i["model"] == "StoryEvent")
    pull_chain(folder, base, first, int(page["complete_through_block"]))
    pull_events(folder, base, int(page["complete_through_block"]))
    # "Now" for the analysis is when the player snapshots were read, not when the chain scan ended.
    save(folder, "pulled.json", {"at": snapshots_at.isoformat(), "herald": base, "game": int(game)})
    print(folder)
    return folder


BLITZ_MODELS = (
    "BlitzResult", "BlitzRoster", "SettlementProgress", "Hyperstructure", "HyperstructureShares", "PlayerPoints",
    "RelicChest", "GameRegistry", "PlayerEntry",
)


def history_of(base, game):
    items, offset = [], 0
    while True:
        page = get(f"{base}/games/{game}/history?limit=100&offset={offset}")
        items += page["items"]
        offset += 100
        if offset >= page["total"]:
            return page["complete_through_block"], items


def pull_blitz(folder, base):
    """Every Blitz game the Herald lists: its directory entry, history, leaderboard and frozen review rows."""
    games = {}
    for entry in get(f"{base}/games")["games"]:
        if entry["mode"] != "blitz":
            continue
        game = entry["game_id"]
        _, items = history_of(base, game)
        try:
            review = get(f"{base}/games/{game}/review/snapshot")
            rows = {m["model"]: m["rows"] for m in review["models"] if m["model"] in BLITZ_MODELS and m["rows"]}
        except urllib.error.HTTPError as error:
            rows = {"error": error.code}
        games[game] = {"entry": entry, "history": items, "leaderboard": get(f"{base}/games/{game}/leaderboard"), "review": rows}
    save(folder, "blitz.json", games)


# The production value ledger on Starknet mainnet (contracts/common/addresses/production.json) and the selectors of the
# events and views read here (contracts/l2/ledger/src/contract.cairo; sn_keccak of each name).
LEDGER = "0x46ce2227913f9935ca977c499c51ff128162f0569955eafb0a8b40234f179f2"
LEDGER_DEPLOYMENT_BLOCK = 16705306
LORDS_DECIMALS = 10**18
LEDGER_EVENTS = {
    "0x1da975eab8e7944fcb2ed48b9613603229c3ea6fdcfed39c534a8266752760e": "FrontierFunded",
    "0x1ca152528100f36cbf679c73bb7073502ebfd0d14fac257b52d1bf752210a41": "WithdrawalPaid",
    "0x1f42e845f27e8320a5aa7f0dfa2e6dece8afa3cb97aee0b618a09789be6b942": "FrontierClosed",
    "0x27fbb17a4d3deb81636699bdac05d477f33c92622d8b7081da53fb6c1953bc8": "PresetRegistered",
    "0xa112f65fcf2ff46cde96c28c34a2e0400ada59e98dec8c97132c5ecdc435a8": "SlotOpened",
    "0x1d2e174878da0d37d30e459c46a086c396c158c8b5d33d7ec5b32e77902c084": "Registered",
    "0x17f70118592a9339e8dbfb66879b2f30460df139d08ff9e37aaa27d1cf8cf4f": "SlotCancelled",
    "0x25a524c3eb60ff1b669263ecc957ea8bb36ddbc7f00474b77f76801c05543c1": "SlotAborted",
    "0x1e3aa8099bfbb7b9fee513355876c379349ac1dca81cd9eb4e0653e784ff985": "Refunded",
    "0x8257b3ba6b95af40ef8c4520f5165308992e1e96f735ace25bf833d2f1ecdd": "RegistrationRefundable",
    "0x1321eaf15640d26bf5975bd010eb8465b4cd826d8c2e1ac6bea34fb1f184893": "SeasonOpened",
    "0xdea6f4986122008caee1a4eb1ab084edc87f763a1c7913e0fb602a45aeb986": "SeasonTopPosted",
    "0x1fb955e14b7e74e2f9421f10450e7a957d340c8d9d5926174094f0b3dd95189": "SeasonChallenged",
    "0x206b0eca313c0f3cba8b376f0e1fc2e3a749d31917283e9b17c0ce0d67d0cb1": "SeasonPaid",
    "0x329a8bfb6251b431d1683b2862325d22bed5fc34511228f34bebfe8b83f5ba6": "ResultsApplied",
    "0x1a311692f383d44c55593ce9abc0b11d4572d881ccb1d423d79aef6b2714f87": "ChestMinted",
    "0xb829cf3ad2181a7f0d43937e98fa085355fdaf8859c2e0bf28f306c3a7c695": "ChestOpened",
    "0x2f8ae18f9740c9ba5cac6326369aedfe970959eb402bf1853c82e989527d3ee": "ChestRequested",
    "0x9d4a59b844ac9d98627ddba326ab3707a7d7e105fd03c777569d0f61a91f1e": "RoleGranted",  # AccessControl, at deployment
}
GET_SLOT = "0x114e93eb40ffe7d58f1486efe6e559a3db5b339b5024b727e000c9611abb3fc"
GET_PRESET = "0x395a3e5cdaf5342cb8947613c8861748f6b2bc818969048cd7c49a711373d74"
GET_REGISTRATION = "0x2d8a20487210168ef381fb56fb03b3ccbd20ddf9a8ac117fe74b7bfdb159aae"


PUBLIC_MAINNET_RPC = "https://starknet-rpc.publicnode.com"  # keyless public endpoint


def pull_ledger(folder):
    """The ledger's events and the slots, presets and registrations they name, read-only (getEvents and calls).

    Reads the keyless public endpoint; L2_RPC_URL overrides it and is never printed or written."""
    rpc = os.environ.get("L2_RPC_URL") or PUBLIC_MAINNET_RPC
    try:
        events, token = [], None
        while True:
            flt = {"from_block": {"block_number": LEDGER_DEPLOYMENT_BLOCK}, "to_block": "latest", "address": LEDGER,
                   "chunk_size": 1000}
            if token:
                flt["continuation_token"] = token
            page = rpc_batch(rpc, [("starknet_getEvents", {"filter": flt})])[0]
            events += [
                {"name": LEDGER_EVENTS.get(hex(int(e["keys"][0], 16)), e["keys"][0]), "keys": e["keys"], "data": e["data"],
                 "block": e.get("block_number"), "tx": e.get("transaction_hash")}
                for e in page["events"]
            ]
            token = page.get("continuation_token")
            if not token:
                break
        call = lambda selector, calldata: ("starknet_call", {  # noqa: E731
            "request": {"contract_address": LEDGER, "entry_point_selector": selector, "calldata": calldata},
            "block_id": "latest"})
        slots = sorted({(e["keys"][1], e["keys"][2]) for e in events if e["name"] == "SlotOpened"})
        slot_rows = rpc_batch(rpc, [call(GET_SLOT, list(k)) for k in slots]) if slots else []
        presets = sorted({int(r[2], 16) for r in slot_rows if r})
        preset_rows = rpc_batch(rpc, [call(GET_PRESET, [hex(p)]) for p in presets]) if presets else []
        seats = sorted({(e["keys"][1], e["keys"][2], e["keys"][3]) for e in events if e["name"] == "Registered"})
        reg_rows = []
        for start in range(0, len(seats), 32):
            reg_rows += rpc_batch(rpc, [call(GET_REGISTRATION, list(k)) for k in seats[start : start + 32]])
        blocks = sorted({e["block"] for e in events if e["block"] is not None})
        times = {}
        for start in range(0, len(blocks), 32):
            heads = rpc_batch(rpc, [("starknet_getBlockWithTxHashes", [{"block_number": b}]) for b in blocks[start : start + 32]])
            times.update({h["block_number"]: h["timestamp"] for h in heads if h})
    except Exception as error:  # the message of a failed request can name its URL; keep only the kind of failure
        print(f"ledger: read failed ({type(error).__name__})", file=sys.stderr)
        return
    save(folder, "ledger.json", {
        "ledger": LEDGER,
        "events": [dict(e, at=times.get(e["block"])) for e in events],
        "slots": [{"key": list(k), "row": r} for k, r in zip(slots, slot_rows)],
        "presets": [{"id": p, "row": r} for p, r in zip(presets, preset_rows)],
        "registrations": [{"key": list(k), "row": r} for k, r in zip(seats, reg_rows)],
    })


def rpc_batch(url, calls):
    body = [{"jsonrpc": "2.0", "id": n, "method": m, "params": p} for n, (m, p) in enumerate(calls)]
    request = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers={"content-type": "application/json", "User-Agent": "curl/8"}
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                answers = sorted(json.load(response), key=lambda a: a["id"])
            return [a.get("result") for a in answers]
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2)


def pull_chain(folder, base, first_block, last_block):
    """Every transaction from the game's first block on and whether it reverted (the public RPC, 32 calls a request).

    Reverted transactions emit no event, so the Herald's history cannot show them. Scanned blocks are kept in
    raw/chain-cache.json, so a rerun reads only the blocks added since."""
    rpc = get(f"{base}/manifest")["rpcUrl"]
    cache_path = os.path.join(RAW, "chain-cache.json")
    cache = {"first_block": first_block, "scanned_through": first_block - 1, "transactions": []}
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            cache = json.load(f)
        if cache["first_block"] != first_block:
            cache = {"first_block": first_block, "scanned_through": first_block - 1, "transactions": []}
    hashes = []
    for start in range(cache["scanned_through"] + 1, last_block + 1, 32):
        blocks = rpc_batch(
            rpc,
            [("starknet_getBlockWithTxHashes", [{"block_number": n}]) for n in range(start, min(start + 32, last_block + 1))],
        )
        hashes += [(b["block_number"], b["timestamp"], h) for b in blocks if b for h in b["transactions"]]
        time.sleep(0.1)
    out = []
    for start in range(0, len(hashes), 32):
        chunk = hashes[start : start + 32]
        answers = rpc_batch(rpc, [("starknet_getTransactionReceipt", [h]) for *_, h in chunk])
        for (block, at, h), receipt in zip(chunk, answers):
            out.append(
                {
                    "block": block,
                    "at": at,
                    "hash": h,
                    "status": (receipt or {}).get("execution_status"),
                    "revert": ((receipt or {}).get("revert_reason") or "")[-400:],
                    "events": len((receipt or {}).get("events") or []),
                }
            )
        time.sleep(0.1)
    cache["transactions"] += out
    cache["scanned_through"] = max(cache["scanned_through"], last_block)
    with open(cache_path + ".part", "w") as f:
        json.dump(cache, f, separators=(",", ":"))
    os.replace(cache_path + ".part", cache_path)
    save(folder, "chain.json", cache)


EVENT_SEGMENT = re.compile(r"^(\d+)-(\d+)\.jsonl\.gz$")


def events_folder(games_contract):
    """Where one Games contract's events are kept across pulls: one immutable segment a pull, named by its blocks."""
    return os.path.join(RAW, "games-events", hex(int(games_contract, 16)))


def events_scanned_through(folder):
    """The last block a published segment holds; a segment cut short is only ever a .part file, never counted."""
    ends = [int(m.group(2)) for m in map(EVENT_SEGMENT.match, os.listdir(folder)) if m]
    return max(ends, default=-1)


def pull_events(folder, base, last_block):
    """Every event the Games contract emitted, through `last_block`, and the schema that decodes them (getEvents).

    A command's story is not enough to name it (a move writes rows but tells no story), so the usage step reads the
    rows too. Each pull writes the blocks it adds as one segment, raw/games-events/<contract>/<from>-<to>.jsonl.gz,
    staged as .part and published by one rename: the segment is the checkpoint, so a run stopped at any point leaves
    every published segment whole and the next run starts after the last one."""
    manifest = get(f"{base}/manifest")
    games_contract = manifest["contracts"]["games"]
    newest_release = max(manifest["releaseSchemas"], key=int)
    save(folder, "manifest.json", manifest)
    save(folder, "schema.json", get(f"{base}/schemas/{manifest['releaseSchemas'][newest_release]}"))
    segments = events_folder(games_contract)
    os.makedirs(segments, exist_ok=True)
    first = events_scanned_through(segments) + 1
    if first > last_block:
        return
    token, events = None, []
    while True:
        flt = {"from_block": {"block_number": first}, "to_block": {"block_number": last_block},
               "address": games_contract, "chunk_size": 1000}
        if token:
            flt["continuation_token"] = token
        page = rpc_batch(manifest["rpcUrl"], [("starknet_getEvents", {"filter": flt})])[0]
        events += [{k: e[k] for k in ("block_number", "transaction_hash", "transaction_index", "event_index", "keys", "data")}
                   for e in page["events"]]
        token = page.get("continuation_token")
        if not token:
            break
    segment = os.path.join(segments, f"{first}-{last_block}.jsonl.gz")
    with gzip.open(segment + ".part", "wt") as out:
        out.writelines(json.dumps(e, separators=(",", ":")) + "\n" for e in events)
    os.replace(segment + ".part", segment)


def usage(folder):
    """The pull's usage.json: every transaction named by its command, counted for the lab's Data → UI usage."""
    subprocess.run(["bun", os.path.join(HERE, "usage.ts"), folder, RAW], check=True, stdout=sys.stderr)


_rules_cache = {}


def get_rules(folder):
    if folder not in _rules_cache:
        with open(os.path.join(folder, "rules.json")) as f:
            _rules_cache[folder] = json.load(f)
    return _rules_cache[folder]


def newest_pull():
    root = RAW
    return os.path.join(root, sorted(d for d in os.listdir(root) if d[0].isdigit())[-1])


# ---------------------------------------------------------------- analysis

P = 10**9
SESSION_GAP = 30 * 60
# Release 2 (#5087 at da9e10a130d: a whole merge keeps the army with more XP plus level prices) reached game 1 in this
# transaction on 10-23 (evidence/infra/prod-rollout-1/98-release-advance-production.json).
RELEASE_2_TX = 0x4E661E33D9C99C2C28665A1497DD96F84D721C07415D9270058788A50F1D73A
# Codes and rules as release 1 (963db0884de) has them: contracts/l3/world-native/src taxonomy.cairo, resources.cairo,
# buildings.cairo, research.cairo, troops.cairo; config/source/frontier/base.ts and native.ts.
SITE = {0x7: "camp", 0x9: "rift", 0xA: "ruin", 0xB: "beasts"}
RESOURCE = {23: "Labor", 26: "Knight", 35: "Wheat", 37: "LORDS", 38: "Essence"}
BUILDING = {1: "Hut", 25: "Workshop", 28: "Barracks", 37: "Farm", 41: "War hall", 42: "Supply yard", 43: "Scouts' lodge", 44: "Hearth"}
OCCUPIER = {34: "chest", 40: "shrine", 41: "well"}
# research.cairo:110-193: (row, name, tier bit, tier width, choice bit, choice width, sides)
RESEARCH = [
    (0, "Farm", 0, 3, 3, 1, ("Fields", "Granary")),
    (1, "Workshop", 7, 3, 10, 1, ("Tools", "Storeroom")),
    (2, "Barracks", 14, 3, 17, 1, ("Drill", "Rations")),
    (3, "Hut", 21, 3, None, 0, ()),
    (4, "War hall", 24, 3, None, 0, ()),
    (5, "Supply yard", 27, 3, None, 0, ()),
    (6, "Scouts' lodge", 30, 3, 36, 2, ("camp", "rift", "beasts")),
    (7, "Hearth", 33, 3, None, 0, ()),
    (8, "Shrine", 44, 1, None, 0, ()),
    (9, "Well", 45, 1, None, 0, ()),
    (10, "Depth", 46, 2, None, 0, ()),
]
DEPLOY_CAP = [3000, 9000, 25000, 60000]  # by realm level; a store holds 2 deploys, +50% per store pick
REVEAL_STAMINA, ATTACK_STAMINA, STAMINA_MAX, STAMINA_PER_HOUR = 20, 30, 120, 30
LOGISTICS_BONUS = {1: 0, 2: 20, 3: 50, 4: 90, 5: 150}


def num(value):
    return int(value, 16) if isinstance(value, str) else int(value or 0)


def load(folder, name):
    with open(os.path.join(folder, name)) as f:
        return json.load(f)


def spread(values):
    """n, min, median, p90, max of a list of numbers, as one short string."""
    v = sorted(values)
    if not v:
        return "n=0"
    pick = lambda q: v[min(len(v) - 1, int(q * (len(v) - 1) + 0.5))]  # noqa: E731
    return f"n={len(v)} min={v[0]} med={pick(0.5)} p90={pick(0.9)} max={v[-1]}"


def table(header, rows):
    print("| " + " | ".join(header) + " |")
    print("|" + "---|" * len(header))
    for row in rows:
        print("| " + " | ".join(str(c) for c in row) + " |")
    print()


class World:
    """The pull, read once: stories in chain order, the day each one fell on, and every player's current rows."""

    def __init__(self, folder):
        self.folder = folder
        self.game = load(folder, "game.json")
        self.pulled = load(folder, "pulled.json")
        self.items = sorted(load(folder, "history.json")["items"], key=lambda i: (i["block_number"], i["event_index"]))
        self.players = load(folder, "players.json")
        self.names = load(folder, "names.json")
        self.board = load(folder, "leaderboard.json")
        self.rules = {m["model"]: m["rows"] for m in load(folder, "rules.json")["models"] if m["rows"]}
        ranks = load(folder, "day-ranks.json")
        start = self.game["clock"]["start_main_at"]
        ends = [r["ends_at"] for _, r in sorted(ranks.items(), key=lambda kv: int(kv[0])) if "ends_at" in r]
        self.days = list(zip([start] + ends, ends + [self.game["day_ends_at"]]))
        self.now = int(datetime.fromisoformat(self.pulled["at"]).timestamp())
        self.stories = []
        for item in self.items:
            value = item["value"]
            story = value.get("story")
            when = num(value.get("timestamp", "0x0"))
            if item["model"] == "StoryEvent" and isinstance(story, dict):
                kind, body = next(iter(story.items()))
                self.stories.append({"kind": kind, "body": body, "owner": value["owner"], "at": when, "item": item})
            elif item["model"] == "BattleEvent":
                self.stories.append(
                    {"kind": "Battle", "body": value, "owner": value["attacker"]["player"], "at": when, "item": item}
                )
        self.realm_of = {s["owner"]: num(s["item"]["value"]["entity_id"]) for s in self.of("RealmCreatedStory")}
        # The block that moved the game to release 2 (stronger-army merge), when the chain scan holds it.
        self.release_2 = None
        if os.path.exists(os.path.join(folder, "chain.json")):
            self.release_2 = next(
                ((t["block"], t["at"]) for t in load(folder, "chain.json")["transactions"] if int(t["hash"], 16) == RELEASE_2_TX),
                None,
            )

    def release(self, story):
        return 2 if self.release_2 and story["item"]["block_number"] > self.release_2[0] else 1

    def of(self, *kinds):
        return [s for s in self.stories if s["kind"] in kinds]

    def day(self, at):
        for index, (start, end) in enumerate(self.days):
            if start <= at < end:
                return index
        return len(self.days) - 1

    def who(self, address):
        return self.names.get(address) or address[:8]

    def rows(self, player, model):
        return [r["value"] for r in self.players.get(player, {}).get("models", {}).get(model, [])]


def section_players(w):
    print("## Players\n")
    acts = [s for s in w.stories if s["kind"] != "RealmCreatedStory"]
    joined = {s["owner"]: w.day(s["at"]) for s in w.of("RealmCreatedStory")}
    active = {d: set() for d in range(len(w.days))}
    for s in acts:
        active[w.day(s["at"])].add(s["owner"])
    rows = []
    for d, (start, end) in enumerate(w.days):
        open_ = " (open)" if end > w.now else ""
        seen_before = set().union(*(active[x] for x in range(d))) if d else set()
        rows.append(
            [
                f"{d}{open_}",
                datetime.fromtimestamp(start, UTC).strftime("%m-%d %H:%M"),
                f"{(min(end, w.now) - start) / 3600:.1f}",
                sum(1 for j in joined.values() if j == d),
                len(active[d]),
                len(active[d] & seen_before),
                len(active[d - 1] - active[d]) if d else "",
            ]
        )
    table(["day", "starts (UTC)", "hours so far", "realms created", "active", "of them active before", "left"], rows)
    never = sorted(w.who(p) for p in joined if not any(p in a for a in active.values()))
    print(f"Realms: {len(joined)}. Never acted after settling: {len(never)} ({', '.join(never)}).\n")
    # Cohorts: the players who settled on a day, and how many of them acted on each day since.
    days = range(len(w.days))
    rows = []
    for j in days:
        cohort = {p for p, d in joined.items() if d == j}
        if cohort:
            rows.append([j, len(cohort)] + [len(cohort & active[d]) if d >= j else "" for d in days])
    table(["settled on day", "players"] + [f"active day {d}" for d in days], rows)
    # Sessions: a player's actions with gaps under 30 minutes.
    sessions = {}
    for s in acts:
        runs = sessions.setdefault(s["owner"], [])
        if runs and s["at"] - runs[-1][1] < SESSION_GAP:
            runs[-1][1] = s["at"]
            runs[-1][2] += 1
        else:
            runs.append([s["at"], s["at"], 1])
    lengths = [round((b - a) / 60) for runs in sessions.values() for a, b, _ in runs]
    actions = [n for runs in sessions.values() for *_, n in runs]
    per_player = [len(runs) for runs in sessions.values()]
    print(f"Sessions (actions less than {SESSION_GAP // 60} min apart): {sum(per_player)} over {len(sessions)} players.")
    print(f"- sessions per player: {spread(per_player)}")
    print(f"- minutes per session: {spread(lengths)}")
    print(f"- actions per session: {spread(actions)}\n")
    rows = []
    for d in days:
        runs = [r for rs in sessions.values() for r in rs if w.day(r[0]) == d]
        rows.append([d, len(runs), spread([round((b - a) / 60) for a, b, _ in runs]), spread([n for *_, n in runs]),
                     spread(list(collections.Counter(p for p, rs in sessions.items() for r in rs if w.day(r[0]) == d).values()))])
    table(["day", "sessions", "minutes per session", "actions per session", "sessions per active player"], rows)
    rows = []
    for p in sorted(sessions, key=lambda p: -sum(n for *_, n in sessions[p])):
        runs = sessions[p]
        rows.append(
            [
                w.who(p),
                sum(n for *_, n in runs),
                len(runs),
                " ".join(str(len([1 for a, *_ in runs if w.day(a) == d])) for d in range(len(w.days))),
                datetime.fromtimestamp(runs[-1][1], UTC).strftime("%m-%d %H:%M"),
                f"{(w.now - runs[-1][1]) / 3600:.1f}",
            ]
        )
    table(["player", "actions", "sessions", "sessions per day", "last action (UTC)", "hours idle"], rows)


def armies(w):
    """Every army from its muster: owner, day, troops through battles and transfers, XP by source, how it ended."""
    xp_rules = w.rules["ArmyProgressionRules"][0]["value"]
    reveal_xp, shrine_xp = num(xp_rules["reveal_xp"]), num(xp_rules["fixed_xp"])
    first_guard, out = {}, {}
    for s in w.of("Battle"):
        first_guard.setdefault(num(s["body"]["defender_id"]), num(s["body"]["defender"]["before"]) // P)
    live = {}
    for p in w.players:
        for row in w.rows(p, "ArmyProgress"):
            live[num(row["explorer_id"])] = {"xp": num(row["xp"])}
        for row in w.rows(p, "ExplorerTroops"):
            live.setdefault(num(row["explorer_id"]), {})["troops"] = num(row["troops"]["count"]) // P
    # The stories that name each army, to tell after a whole merge which of the two went on.
    named = collections.defaultdict(list)
    for n, s in enumerate(w.stories):
        b = s["body"]
        for key in ("explorer_id", "attacker_id"):
            if key in b:
                named[num(b[key])].append(n)
        for key in ("source", "target"):
            if isinstance(b.get(key), dict) and "Explorer" in b[key]:
                named[num(b[key]["Explorer"])].append(n)
    merges = []
    for n, s in enumerate(w.stories):
        b = s["body"]
        if s["kind"] == "ExplorerCreateStory":
            out[num(b["explorer_id"])] = {
                "id": num(b["explorer_id"]),
                "owner": s["owner"],
                "born": s["at"],
                "day": w.day(s["at"]),
                "troops": num(b["amount"]) // P,
                "mustered": num(b["amount"]) // P,
                "xp": 0,
                "reveals": 0,
                "reveal_days": collections.Counter(),
                "clears": [],
                "clear_xp": 0,
                "shrines": 0,
                "spent": 0,
                "tiers": [],
                "fights": 0,
                "end": None,
            }
            continue
        if s["kind"] == "Battle":
            a = out.get(num(b["attacker_id"]))
            if a:
                a["fights"] += 1
                a["troops"] = num(b["attacker"]["after"]) // P
                if a["troops"] == 0:
                    a["end"] = ("lost in battle", s["at"])
            continue
        if s["kind"] == "ExplorationReward":
            a = out[num(b["explorer_id"])]
            a["reveals"] += 1
            a["reveal_days"][w.day(s["at"])] += 1
            a["xp"] += reveal_xp
        elif s["kind"] == "SitePayout":
            a = out[num(b["explorer_id"])]
            gained = math.isqrt(first_guard.get(num(b["site_id"]), 0) * 25) // 2
            a["clears"].append((SITE.get(num(b["category"]), b["category"]), s["at"]))
            a["clear_xp"] += gained
            a["xp"] += gained
        elif s["kind"] == "SkillPointSpent":
            a = out[num(b["explorer_id"])]
            price = num(b["price"])
            if a["xp"] < price:  # a Shrine leaves no story: the fewest that pay for this level-up
                count = -(-(price - a["xp"]) // shrine_xp)
                a["shrines"] += count
                a["xp"] += count * shrine_xp
            a["xp"] -= price
            a["spent"] += price
            a["tiers"].append((b["attribute"], num(b["tier"]), price, s["at"]))
        elif s["kind"] == "TroopsTransferred" and "Explorer" in b["source"] and "Explorer" in b["target"]:
            source, target = out.get(num(b["source"]["Explorer"])), out.get(num(b["target"]["Explorer"]))
            amount = num(b["amount"]) // P
            if source and target and amount >= source["troops"]:
                # A whole merge. The story keeps the clicked direction; from release 2 the contract keeps the army with
                # more unspent XP plus level prices (troops.cairo source_wins_merge). The survivor is the one named
                # again later or alive now; the rule decides only when neither or both are.
                value = lambda a: a["xp"] + a["spent"]  # noqa: E731
                release = w.release(s)
                by_rule = release == 2 and value(source) > value(target)
                later = {a["id"]: any(m > n for m in named[a["id"]]) or a["id"] in live for a in (source, target)}
                seen = later[source["id"]] if later[source["id"]] != later[target["id"]] else None
                source_won = by_rule if seen is None else seen
                winner, loser = (source, target) if source_won else (target, source)
                merges.append({
                    "release": release, "at": s["at"], "owner": s["owner"], "source_won": source_won,
                    "seen": seen, "by_rule": by_rule, "lost_xp": loser["xp"], "lost_value": value(loser),
                    "kept_value": value(winner), "clicked_value": value(source),
                })
                winner["troops"] += loser["troops"]
                loser["troops"] = 0
                loser["end"] = ("merged whole", s["at"])
                loser["merged_xp_lost"] = loser["xp"]
                continue
            if source:
                source["troops"] -= amount
            if target:
                target["troops"] += amount
    for a in out.values():
        now = live.get(a["id"])
        if now and "xp" in now:
            # The stored XP settles the Shrines the stories cannot show.
            extra = now["xp"] - a["xp"]
            if extra > 0 and extra % shrine_xp == 0:
                a["shrines"] += extra // shrine_xp
                a["xp"] += extra
            a["xp_check"] = now["xp"] - a["xp"]
            a["end"] = a["end"] or ("live", None)
        elif not a["end"]:
            a["end"] = ("gone at day end", None) if a["day"] < len(w.days) - 1 else ("gone", None)
    return out, merges


def section_progression(w):
    print("## Progression\n")
    A, merges = armies(w)
    xp_rules = w.rules["ArmyProgressionRules"][0]["value"]
    reveal_xp, shrine_xp = num(xp_rules["reveal_xp"]), num(xp_rules["fixed_xp"])
    rows = []
    for d in range(len(w.days)):
        day = [a for a in A.values() if a["day"] == d]
        rows.append(
            [
                d,
                len(day),
                len({a["owner"] for a in day}),
                sum(a["reveals"] for a in day) * reveal_xp,
                sum(a["clear_xp"] for a in day),
                sum(a["shrines"] for a in day) * shrine_xp,
                sum(a["spent"] for a in day),
                spread([a["reveals"] * reveal_xp + a["clear_xp"] + a["shrines"] * shrine_xp for a in day]),
            ]
        )
    table(["day", "armies mustered", "players", "XP reveals", "XP clears", "XP shrines", "XP spent", "XP earned per army"], rows)
    mismatched = [a for a in A.values() if a.get("xp_check")]
    print(
        f"Live armies checked against their stored XP: {sum(1 for a in A.values() if 'xp_check' in a)},"
        f" off: {len(mismatched)} {[(a['id'], a['xp_check']) for a in mismatched]}.\n"
    )
    ends = collections.Counter(a["end"][0] for a in A.values())
    print("How armies ended: " + ", ".join(f"{k} {v}" for k, v in ends.most_common()) + ".")
    lost_xp = [a.get("merged_xp_lost", 0) for a in A.values() if a["end"][0] == "merged whole"]
    print(f"XP destroyed by whole merges: {sum(lost_xp)} ({spread(lost_xp)}).\n")
    print("Whole merges by release (value = unspent XP + the prices of levels bought; release 2 keeps the higher):\n")
    rows = []
    for release in (1, 2):
        ms = [m for m in merges if m["release"] == release]
        if not ms:
            continue
        rows.append([
            release, len(ms), len({m["owner"] for m in ms}),
            f"{datetime.fromtimestamp(ms[0]['at'], UTC):%m-%d %H:%M} – {datetime.fromtimestamp(ms[-1]['at'], UTC):%m-%d %H:%M}",
            sum(m["lost_xp"] for m in ms), spread([m["lost_xp"] for m in ms]), sum(m["lost_value"] for m in ms),
            sum(1 for m in ms if m["lost_value"] > m["kept_value"]),
            sum(1 for m in ms if m["source_won"]),
            sum(m["clicked_value"] for m in ms),
            f"{sum(1 for m in ms if m['seen'] is not None)}; rule agrees {sum(1 for m in ms if m['seen'] is not None and m['seen'] == m['by_rule'])}",
        ])
    table(["release", "whole merges", "players", "first – last (UTC)", "unspent XP lost", "per merge", "value lost",
           "merges that lost the stronger army", "clicked army kept (direction reversed)",
           "value of the clicked army (what release 1 destroys)", "survivor seen in later stories; rule agrees"], rows)
    tiers = [(a, t) for a in A.values() for t in a["tiers"]]
    print(f"Level-ups bought: {len(tiers)} by {len({a['owner'] for a, _ in tiers})} players on {len({a['id'] for a, _ in tiers})} armies.\n")
    by = collections.Counter((t[0], t[1], t[2]) for _, t in tiers)
    table(["attribute", "tier", "price", "bought"], [[k[0], k[1], k[2], v] for k, v in sorted(by.items())])
    rows = []
    for a in sorted({id(a): a for a, _ in tiers}.values(), key=lambda a: a["born"]):
        rows.append(
            [
                w.who(a["owner"]),
                a["id"] & 0xFFFF,
                a["day"],
                " → ".join(f"{t[0]} {t[1]} (+{(t[3] - a['born']) / 3600:.1f}h)" for t in a["tiers"]),
                a["reveals"],
                len(a["clears"]),
                a["shrines"],
            ]
        )
    table(["player", "army", "day", "level-ups in order (hours after muster)", "reveals", "clears", "shrines"], rows)
    return A


def section_standings(w, A):
    """Every realm on the leaderboard beside what its owner did, to show who is far ahead and how."""
    print("## Standings\n")
    xp_rules = w.rules["ArmyProgressionRules"][0]["value"]
    reveal_xp, shrine_xp = num(xp_rules["reveal_xp"]), num(xp_rules["fixed_xp"])
    acts, days = collections.Counter(), collections.defaultdict(set)
    for s in w.stories:
        if s["kind"] != "RealmCreatedStory":
            acts[s["owner"]] += 1
            days[s["owner"]].add(w.day(s["at"]))
    rows = []
    for e in sorted(w.board["entries"], key=lambda e: e["rank"]):
        p, mine = e["address"], [a for a in A.values() if a["owner"] == e["address"]]
        sites = e["sites_cleared"]
        rows.append([
            e["rank"], w.who(p), e["level"], sites["total"],
            f"{sites['camps']}/{sites['rifts']}/{sites['ruins']}/{sites['beasts']}", e["chests_earned"],
            int(e["rewards"]["lords"]), int(e["rewards"]["essence"]) // P, int(e["rewards"]["labor"]) // P,
            e["deepest_depth"], acts[p], len(days[p]), len(mine),
            sum(a["reveals"] * reveal_xp + a["clear_xp"] + a["shrines"] * shrine_xp for a in mine),
            sum(len(a["tiers"]) for a in mine),
        ])
    table(["rank", "player", "realm level", "sites cleared", "camp/rift/ruin/beasts", "chests", "LORDS", "Essence", "Labor",
           "deepest depth", "actions", "days active", "armies", "XP earned", "level-ups"], rows)


def section_fights(w):
    print("## Fights\n")
    outcome = collections.Counter()
    by_site, losses = collections.defaultdict(list), []
    for s in w.of("Battle"):
        b = s["body"]
        att, dfn = num(b["attacker"]["after"]) // P, num(b["defender"]["after"]) // P
        kind = (
            "both fall" if att == 0 and dfn == 0 else "victory" if dfn == 0 else "army lost" if att == 0 else "guard holds"
        )
        outcome[kind] += 1
        by_site[num(b["defender_id"])].append((kind, num(b["attacker"]["before"]) // P, num(b["defender"]["before"]) // P, att, dfn))
        if kind == "army lost":
            losses.append(num(b["attacker"]["before"]) // P)
    print(f"Battles: {sum(outcome.values())} — " + ", ".join(f"{k} {v}" for k, v in outcome.most_common()) + ".\n")
    category = {num(s["body"]["site_id"]): SITE.get(num(s["body"]["category"]), "?") for s in w.of("SitePayout")}
    rows = []
    for kind in sorted(set(category.values()) | {"never cleared"}):
        sites = [f for f, c in ((f, category.get(f, "never cleared")) for f in by_site) if c == kind]
        if not sites:
            continue
        attacks = [len(by_site[f]) for f in sites]
        guards = [by_site[f][0][2] for f in sites]
        ratio = [round(by_site[f][0][1] / max(1, by_site[f][0][2]), 2) for f in sites]
        rows.append([kind, len(sites), spread(attacks), spread(guards), spread(ratio)])
    table(["site", "sites fought", "attacks per site", "starting guard", "first attack: army/guard"], rows)
    clears_without_battle = [f for f in category if f not in by_site]
    print(f"Sites cleared with no battle on record: {len(clears_without_battle)}.")
    print(f"Armies lost in battle: {len(losses)} (troops before: {spread(losses)}).\n")
    depth = collections.Counter(e["deepest_depth"] for e in w.board["entries"])
    print("Deepest depth per realm (leaderboard): " + ", ".join(f"depth {k}: {v}" for k, v in sorted(depth.items())) + ".\n")


def section_exploration(w, A):
    print("## Exploration\n")
    rows = []
    for d in range(len(w.days)):
        per_army = [a["reveal_days"][d] for a in A.values() if a["reveal_days"][d]]
        per_player = collections.Counter()
        for a in A.values():
            per_player[a["owner"]] += a["reveal_days"][d]
        rewards = collections.Counter(
            RESOURCE.get(num(s["body"]["resource_type"]), s["body"]["resource_type"])
            for s in w.of("ExplorationReward")
            if w.day(s["at"]) == d
        )
        rows.append(
            [
                d,
                sum(per_army),
                spread(per_army),
                spread([v for v in per_player.values() if v]),
                ", ".join(f"{k} {v}" for k, v in rewards.most_common()),
            ]
        )
    table(["day", "reveals", "per army that revealed", "per player that revealed", "paid in"], rows)
    pay = collections.defaultdict(list)
    for s in w.of("ExplorationReward"):
        pay[RESOURCE.get(num(s["body"]["resource_type"]), "?")].append(round(num(s["body"]["amount"]) / P))
    for kind, amounts in sorted(pay.items()):
        print(f"- one reveal's pay in {kind}: {spread(amounts)}")
    print()


def research_of(learned):
    """Learned tiers by row, each with the side picked at every tier."""
    out = {}
    for row, name, bit, width, choice, cwidth, sides in RESEARCH:
        tier = (learned >> bit) % (1 << width)
        if not tier:
            continue
        picks = [sides[(learned >> (choice + cwidth * k)) % (1 << cwidth)] for k in range(tier)] if sides else []
        out[name] = (tier, picks)
    return out


def realm_row(w, player):
    return next(s for s in w.rows(player, "Structure") if s["owner"] == player and num(s["base"]["category"]) == 1)


def store_limit(level, store_picks):
    return DEPLOY_CAP[level] * 2 * (10000 + store_picks * 5000) // 10000


def section_stamina(w, A):
    """Stamina an army is known to have spent (20 a reveal, 30 an attack; moves leave no story, so this is a floor) against
    the most it could have had without paying: a full bar of 120 at muster, 30 an hour after, 30 per level-up. More than
    that needs a LORDS refill or a Well, neither of which leaves a story."""
    print("## Stamina\n")
    last = collections.defaultdict(int)
    for s in w.stories:
        b = s["body"]
        army = b.get("explorer_id") or b.get("attacker_id")
        if army:
            last[num(army)] = max(last[num(army)], s["at"])
    rows, over = [], []
    for d in range(len(w.days)):
        spent, ratio = [], []
        for a in A.values():
            if a["day"] != d or not (a["reveals"] or a["fights"]):
                continue
            used = a["reveals"] * REVEAL_STAMINA + a["fights"] * ATTACK_STAMINA
            hours = max(0, last[a["id"]] - a["born"]) / 3600
            bound = STAMINA_MAX + STAMINA_PER_HOUR * hours + 30 * len(a["tiers"])
            spent.append(used)
            ratio.append(round(used / bound, 2))
            if used > bound:
                over.append((w.who(a["owner"]), a["id"] & 0xFFFF, d, used, round(bound)))
        rows.append([d, spread(spent), spread(ratio)])
    table(["day", "stamina spent per army (reveals + attacks)", "spent / most it could have had unpaid"], rows)
    print(f"Armies that spent more than a free bar allows (so refilled or used a Well): {len(over)}")
    for who, army, d, used, bound in over:
        print(f"- {who} army {army} day {d}: spent at least {used}, free bound {bound}")
    print()
    bars = [num(r["stamina"]["amount"]) for p in w.players for r in w.rows(p, "ArmySlot") if num(r["explorer_id"])]
    print(f"Live armies' stamina bar now (as last settled): {spread(bars)}.\n")


def section_discovery(w, A):
    """The current day's finds, per realm: its reveals in chain order, each marked by what its tile holds now.

    A reveal makes one ExplorationReward, empty or not (map.cairo:440-498). A camp, rift, ruin or beasts find leaves an
    ExpeditionSite at the reward's coord; an unused shrine, well or chest leaves its tile occupant. A used shrine or well
    vacates its tile and leaves no trace but the Shrine XP, so those finds have no place in the sequence. The rebuilt
    final streak is checked against the realm's own ExpeditionDiscovery.empty_reveals."""
    print("## Discovery (current day, rebuilt per realm)\n")
    rules = {k: num(v) for k, v in w.rules["FrontierDiscoveryRules"][0]["value"].items() if k != "game_id"}
    totals, rows, floor_hits, streak_checks = collections.Counter(), [], 0, []
    clean = collections.Counter()
    for p in w.players:
        realm = realm_row(w, p)
        ns = num(realm["entity_id"]) >> 32
        for disc in w.rows(p, "ExpeditionDiscovery"):
            epoch = num(disc["epoch"])
            found = {}
            for site in w.rows(p, "ExpeditionSite"):
                found[(num(site["col"]), num(site["row"]))] = SITE.get(num(site["category"]), "?")
            for tile in w.rows(p, "TileOccupancy"):
                kind = OCCUPIER.get(num(tile["category"]))
                if kind:
                    found[(num(tile["col"]), num(tile["row"]))] = kind
            reveals = [
                s for s in w.of("ExplorationReward")
                if num(s["body"]["explorer_id"]) >> 32 == ns and num(s["body"]["coord"]["y"]) // 100 == 4 * epoch
            ]
            if not reveals:
                continue
            tree = research_of(next((num(r["learned"]) for r in w.rows(p, "RealmKnowledge")), 0))
            complete = "Shrine" not in tree and "Well" not in tree  # no find here can vanish from the map
            streak, kinds = 0, collections.Counter()
            for s in reveals:
                kind = found.get((num(s["body"]["coord"]["x"]), num(s["body"]["coord"]["y"])))
                if kind:
                    hit = streak >= rules["empty_reveal_limit"]
                    floor_hits += hit
                    if complete:
                        clean["finds"] += 1
                        clean["floor"] += hit
                    streak = 0
                    kinds[kind] += 1
                else:
                    streak += 1
                    kinds["empty"] += 1
            shrines = sum(a["shrines"] for a in A.values() if a["owner"] == p and a["day"] == epoch)
            kinds["shrine (used)"] += shrines
            kinds["empty"] -= shrines
            totals.update(kinds)
            if complete:
                clean["realms"] += 1
                clean["reveals"] += len(reveals)
            streak_checks.append((w.who(p), streak, num(disc["empty_reveals"])))
            rows.append([w.who(p), len(reveals)] + [kinds[k] for k in DISCOVERY_KINDS] + [f"{streak}/{num(disc['empty_reveals'])}"])
    table(["player", "reveals"] + list(DISCOVERY_KINDS) + ["final empty streak rebuilt/stored"], rows)
    n = sum(totals.values())
    weights = {"beasts": rules["beasts_bps"], "camp": rules["camp_bps"], "rift": rules["rift_bps"], "ruin": rules["ruin_bps"]}
    print(
        f"All {n} reveals: "
        + ", ".join(f"{k} {totals[k]} ({100 * totals[k] / max(1, n):.1f}%, rule {weights[k] / 100:.0f}%)" if k in weights else f"{k} {totals[k]} ({100 * totals[k] / max(1, n):.1f}%)" for k in DISCOVERY_KINDS)
        + "."
    )
    print(f"Finds that came right after {rules['empty_reveal_limit']} or more empties (the floor): {floor_hits}.")
    print(
        f"In the {clean['realms']} realms without the Shrine or Well node (every find stays on the map, so the sequence is"
        f" complete): {clean['reveals']} reveals, {clean['finds']} finds ({100 * clean['finds'] / max(1, clean['reveals']):.1f}%),"
        f" {clean['floor']} of them forced by the floor ({100 * clean['floor'] / max(1, clean['finds']):.0f}% of finds)."
    )
    matched = sum(1 for _, a, b in streak_checks if a == b)
    print(f"Rebuilt final streak equals the stored one in {matched} of {len(streak_checks)} realms.\n")


DISCOVERY_KINDS = ("beasts", "camp", "rift", "ruin", "shrine", "shrine (used)", "well", "chest", "empty")


def section_research(w):
    print("## Research and storage\n")
    rows, uptake = [], collections.Counter()
    picks = collections.Counter()
    for p in w.players:
        realm = realm_row(w, p)
        level = num(realm["base"]["level"])
        learned = next((num(r["learned"]) for r in w.rows(p, "RealmKnowledge")), 0)
        tree = research_of(learned)
        uptake[(level, bool(tree))] += 1
        for name, (tier, sides) in tree.items():
            picks[name] += 1
            for side in sides:
                picks[f"{name}: {side}"] += 1
        if tree:
            rows.append(
                [w.who(p), level, "; ".join(f"{n} {t}" + (f" ({', '.join(sd)})" if sd else "") for n, (t, sd) in tree.items())]
            )
    print(
        "Realms with any research: "
        + ", ".join(f"level {lv} {'with' if has else 'without'}: {n}" for (lv, has), n in sorted(uptake.items()))
        + ".\n"
    )
    table(["player", "realm level", "research learned (side per tier)"], rows)
    print("Picks by node: " + ", ".join(f"{k} {v}" for k, v in sorted(picks.items())) + ".")
    never = [name for _, name, *_ in RESEARCH if name not in picks]
    never += [f"{name}: {side}" for _, name, _, _, _, _, sides in RESEARCH for side in sides if f"{name}: {side}" not in picks]
    print("Never picked by anyone: " + ", ".join(never) + ".\n")
    # Storage: wheat and labor settle up to 2 deploys of the level's cap, +50% per Granary/Storeroom pick.
    rows, at_cap = [], collections.Counter()
    for p in w.players:
        realm = realm_row(w, p)
        level = num(realm["base"]["level"])
        tree = research_of(next((num(r["learned"]) for r in w.rows(p, "RealmKnowledge")), 0))
        cells = [w.who(p), level]
        for resource, row, store in ((35, "Farm", "Granary"), (23, "Workshop", "Storeroom")):
            limit = store_limit(level, tree.get(row, (0, []))[1].count(store))
            balance = next(
                (num(r["balance"]) for r in w.rows(p, "ResourceBalance")
                 if num(r["entity_id"]) == num(realm["entity_id"]) and num(r["resource_type"]) == resource), 0)
            production = next(
                (r for r in w.rows(p, "ResourceProduction")
                 if num(r["entity_id"]) == num(realm["entity_id"]) and num(r["resource_type"]) == resource), None)
            if production and num(production["building_count"]):
                balance += num(production["production_rate"]) * max(0, w.now - num(production["last_settled_at"]))
            settled = min(limit * P, balance) // P
            hours = ""
            if production and num(production["production_rate"]) and settled < limit:
                hours = f", full in {(limit * P - balance) / num(production['production_rate']) / 3600:.1f}h"
            if settled >= limit:
                at_cap[RESOURCE[resource]] += 1
            cells.append(f"{settled}/{limit}{hours}")
        rows.append(cells)
    print(
        f"Stores at their limit now: "
        + (", ".join(f"{k} {v}" for k, v in at_cap.items()) or "none")
        + f" of {len(w.players)} realms.\n"
    )
    table(["player", "level", "Wheat now/limit", "Labor now/limit"], rows)
    clipped = [
        (w.who(p), round(num(g["amount"]) / P))
        for p in w.players for g in w.rows(p, "LaborGrant") if num(g["amount"]) < 1000 * P
    ]
    print(f"Labor grants clipped by the store limit (stored < 1000): {clipped or 'none'}.\n")


def section_realm(w):
    print("## Realm\n")
    ups = sorted(w.of("StructureLevelUpStory"), key=lambda s: s["at"])
    start = w.days[0][0]
    print(
        f"Realm level-ups: {len(ups)} — "
        + ", ".join(f"{w.who(s['owner'])} to {num(s['body']['new_level'])} at +{(s['at'] - start) / 3600:.1f}h" for s in ups)
        + ".\n"
    )
    levels = collections.Counter(e["level"] for e in w.board["entries"])
    print("Realm level now: " + ", ".join(f"level {k}: {v}" for k, v in sorted(levels.items())) + ".\n")
    built = collections.defaultdict(collections.Counter)
    labor = collections.Counter()
    for s in w.of("BuildingPaymentStory"):
        built[s["owner"]][BUILDING.get(num(s["body"]["category"]), s["body"]["category"])] += 1
        for cost in s["body"]["cost"]:
            labor[RESOURCE.get(num(cost["resource_type"]), cost["resource_type"])] += num(cost["amount"]) // P
    kinds = sorted({k for c in built.values() for k in c})
    total = collections.Counter()
    for c in built.values():
        total.update(c)
    print(
        f"Buildings placed: {sum(total.values())} by {len(built)} players — "
        + ", ".join(f"{k} {total[k]}" for k in kinds)
        + f". Paid: {', '.join(f'{v} {k}' for k, v in labor.items())}.\n"
    )
    per_player = [sum(c.values()) for c in built.values()]
    print(f"- buildings per building player: {spread(per_player)}\n")
    # Flows the stories show. Labor in: reveals paid in labor (as computed; a full store clips them) and camp payouts
    # (as stored). Labor out: buildings and realm level-ups (4000 to level 1, 15000 to 2, 40000 to 3; base.ts:80-86).
    # Wheat out: 2 a troop mustered, 0.02 a troop per reveal (troops.cairo:306-338). Research spends are not stories.
    level_cost = {1: 4000, 2: 15000, 3: 40000}
    troops_at = {}
    rows = []
    for d in range(len(w.days)):
        flow = collections.Counter()
        for st in w.stories:
            if w.day(st["at"]) != d:
                continue
            b = st["body"]
            if st["kind"] == "ExplorerCreateStory":
                troops_at[num(b["explorer_id"])] = num(b["amount"]) // P
                flow["troops mustered"] += num(b["amount"]) // P
                flow["wheat: musters"] += 2 * num(b["amount"]) // P
            elif st["kind"] == "ExplorationReward":
                if num(b["resource_type"]) == 23:
                    flow["labor: reveals"] += num(b["amount"]) // P
                else:
                    flow["essence: reveals"] += num(b["amount"]) // P
                flow["wheat: reveals"] += troops_at.get(num(b["explorer_id"]), 0) * 2 // 100
            elif st["kind"] == "SitePayout" and b["reward"]:
                kind = {23: "labor: camps", 38: "essence: rifts", 37: "lords: ruins"}[num(b["reward"]["resource_type"])]
                flow[kind] += num(b["reward"]["amount"]) // P
            elif st["kind"] == "BuildingPaymentStory":
                flow["labor: buildings"] += sum(num(c["amount"]) // P for c in b["cost"] if num(c["resource_type"]) == 23)
            elif st["kind"] == "StructureLevelUpStory":
                flow["labor: level-ups"] += level_cost[num(b["new_level"])]
            elif st["kind"] == "Battle" and num(b["attacker_id"]) in troops_at:
                troops_at[num(b["attacker_id"])] = num(b["attacker"]["after"]) // P
        rows.append(
            [d, flow["labor: reveals"], flow["labor: camps"], flow["labor: buildings"], flow["labor: level-ups"],
             flow["essence: reveals"], flow["essence: rifts"], flow["troops mustered"], flow["wheat: musters"], flow["wheat: reveals"]]
        )
    table(
        ["day", "labor in: reveals", "labor in: camps", "labor out: buildings", "labor out: level-ups",
         "Essence in: reveals", "Essence in: rifts", "troops mustered", "wheat out: musters", "wheat out: reveals"],
        rows,
    )
    rates = collections.defaultdict(list)
    for p in w.players:
        realm = num(realm_row(w, p)["entity_id"])
        for r in w.rows(p, "ResourceProduction"):
            if num(r["entity_id"]) == realm and num(r["building_count"]):
                rates[RESOURCE.get(num(r["resource_type"]), r["resource_type"])].append(round(num(r["production_rate"]) * 3600 / P))
    for kind, values in sorted(rates.items()):
        print(f"- {kind} produced an hour per realm now: {spread(values)}")
    print()


def section_economy(w):
    """LORDS out (ruin payouts, opened chests, withdrawals) against the pool's linear unlock (lords_budget.cairo)."""
    print("## Economy (LORDS)\n")
    budget = {k: num(v) for k, v in w.rules["LordsBudget"][0]["value"].items() if k != "game_id"}
    clock = w.game["clock"]
    span = clock["end_at"] - clock["start_main_at"]
    rows, paid_total = [], 0
    for d, (start, end) in enumerate(w.days):
        ruins = [s for s in w.of("SitePayout") if num(s["body"]["category"]) == 0xA and w.day(s["at"]) == d]
        ruin_lords = sum(num(s["body"]["reward"]["amount"]) // P for s in ruins if s["body"]["reward"])
        chests = [s for s in w.of("RewardChestOpened") if w.day(s["at"]) == d]
        chest_lords = sum(num(s["body"]["amount"]) for s in chests)
        withdrawn = sum(num(s["body"].get("amount", 0)) for s in w.of("LordsWithdrawn") if w.day(s["at"]) == d)
        unlocked_today = budget["pool"] * (min(end, clock["end_at"]) - start) // span
        paid_total += ruin_lords + chest_lords
        rows.append([d, len(ruins), ruin_lords, len(chests), chest_lords, withdrawn, unlocked_today])
    table(["day", "ruins cleared", "LORDS from ruins", "chests opened", "LORDS from chests", "LORDS withdrawn", "pool unlocked that day"], rows)
    print(
        f"Pool {budget['pool']} for the season ({span / 3600:.0f} h), unlocked linearly: {budget['pool'] * 3600 // span} an hour."
        f" Left {budget['pool_left']}; paid out per the stories {paid_total}; so refills paid back"
        f" {budget['pool_left'] - (budget['pool'] - paid_total)} (pool_left = pool − paid + refills)."
    )
    print(
        f"Today: price {budget['price']} LORDS a share (ceiling {num(w.rules['ChestRules'][0]['value']['price_ceiling'])}),"
        f" {budget['rolled_shares']} shares rolled, {budget['open']} LORDS reserved by found ruins and chests."
        f" Yesterday: {budget['yesterday_shares']} shares over {budget['yesterday_ticks']} ticks."
    )
    reserved = collections.Counter()
    shares = {k: num(v) for k, v in w.rules["ChestRules"][0]["value"]["shares"].items()}
    tiers = ["common", "uncommon", "rare", "epic", "legendary"]
    for p in w.players:
        for c in w.rows(p, "SiteChest"):
            if num(c["reservation_day"]) == budget["day"]:
                reserved[w.who(p)] += shares[tiers[num(c["tier"])]]
                print(f"- chest held by {w.who(p)}: {tiers[num(c['tier'])]}, {num(c['amount'])} LORDS")
    print(
        f"Shares held by today's chests: {sum(reserved.values())} of {budget['rolled_shares']} rolled"
        f" (a ruin the budget cannot cover is refused and turns empty, but its shares still count as rolled).\n"
    )
    lords = [(w.who(e["address"]), int(e["rewards"]["lords"])) for e in w.board["entries"] if int(e["rewards"]["lords"])]
    print(f"Leaderboard LORDS earned: {lords}.")
    held = [(w.who(p), num(r["balance"]) // P) for p in w.players for r in w.rows(p, "ResourceBalance") if num(r["resource_type"]) == 37]
    print(f"LORDS held in realms now: {held}.\n")
    grants = collections.defaultdict(list)
    for p in w.players:
        for g in w.rows(p, "LaborGrant"):
            grants[(p, num(g["day"]))].append(num(g["amount"]) / P)
    print("## Labor grants (one row per Realm NFT an account holds and UTC day it claimed)\n")
    for (p, day), amounts in sorted(grants.items(), key=lambda kv: -len(kv[1])):
        when = datetime.fromtimestamp(day * 86400, UTC).strftime("%m-%d")
        print(f"- {w.who(p)} on {when}: {len(amounts)} grants, {round(sum(amounts))} Labor stored")
    print()


def section_health(w):
    print("## Running smoothly\n")
    chain = load(w.folder, "chain.json")
    txs = chain["transactions"]
    status = collections.Counter(t["status"] for t in txs)
    print(
        f"Transactions on chain from block {chain['first_block']} to {chain['scanned_through']}: {len(txs)} — "
        + ", ".join(f"{k} {v}" for k, v in status.most_common())
        + "."
    )
    reasons = collections.Counter(t["revert"][-200:] for t in txs if t["status"] != "SUCCEEDED")
    for reason, count in reasons.most_common(15):
        print(f"- {count}× {reason!r}")
    story_txs = {int(i["transaction_hash"], 16) for i in w.items}
    on_chain = {int(t["hash"], 16) for t in txs}
    print(f"Game 1 history transactions: {len(story_txs)}; found on chain: {len(story_txs & on_chain)}.")
    reverted = collections.Counter(w.day(t["at"]) for t in txs if t["status"] != "SUCCEEDED")
    print("Reverted transactions by game day: " + (", ".join(f"day {d}: {n}" for d, n in sorted(reverted.items())) or "none") + ".")
    rejected = [i for i in w.items if i["model"] == "GameplayRejected"]
    print(f"Gameplay rejections recorded: {len(rejected)}.\n")
    when = {}
    for t in txs:
        when[int(t["hash"], 16)] = t["at"]
    rows = []
    for reason, n in collections.Counter(i["value"]["reason"] for i in rejected).most_common():
        mine = [i for i in rejected if i["value"]["reason"] == reason]
        per_actor = collections.Counter(w.who(i["value"]["actor"]) for i in mine)
        per_day = collections.Counter(w.day(when.get(int(i["transaction_hash"], 16), 0)) for i in mine)
        rows.append([reason, n, ", ".join(f"{k} {v}" for k, v in per_actor.most_common()),
                     ", ".join(f"day {d}: {v}" for d, v in sorted(per_day.items()))])
    table(["reason", "rejections", "by player", "by day"], rows)


DROPOUT_MINUTES = 15


def section_blitz(folder, who):
    """Blitz on the same shard: every listed game, from the directory, its history, leaderboard and review rows."""
    games = load(folder, "blitz.json")
    print("# Blitz\n")
    fmt = lambda t: datetime.fromtimestamp(t, UTC).strftime("%m-%d %H:%M")  # noqa: E731
    rows, sources, winners, dropouts, accounts = [], collections.Counter(), [], [], collections.Counter()
    for gid in sorted(games, key=int):
        g = games[gid]
        entry, items, board, review = g["entry"], g["history"], g["leaderboard"], g["review"]
        clock = entry["clock"]
        roster = [r["account"] for r in entry["roster"]]
        for a in roster:
            accounts[a] += 1
        last = {}
        kinds = collections.Counter()
        for i in items:
            v = i["value"]
            story = v.get("story")
            kind = next(iter(story)) if isinstance(story, dict) else i["model"]
            kinds[kind] += 1
            owner = v.get("owner") or (v.get("attacker") or {}).get("player")
            if owner and kind not in ("RealmCreatedStory", "GuardAddStory", "BlitzFinalized"):
                last[owner] = max(last.get(owner, 0), num(v.get("timestamp", "0x0")))
        entries = sorted(board["entries"], key=lambda e: e["rank"])
        scored = [e for e in entries if e["totalPoints"]]
        for e in entries:
            for source, b in e["activityBreakdown"].items():
                sources[source] += b["points"]
        for a in roster:
            if a not in last:
                dropouts.append((gid, who(a), "never acted"))
            elif last[a] < clock["end_at"] - DROPOUT_MINUTES * 60:
                dropouts.append((gid, who(a), f"last action {(clock['end_at'] - last[a]) / 60:.0f} min before the end"))
        hypers = review.get("Hyperstructure", []) if isinstance(review, dict) else []
        complete = sum(1 for h in hypers if h["value"]["stage"] == "Complete")
        top = entries[0] if entries else None
        if top:
            winners.append((gid, who(top["address"]), top["totalPoints"], top["activityBreakdown"]))
        rows.append(
            [
                gid,
                fmt(clock["start_main_at"]),
                f"{(clock['end_at'] - clock['start_main_at']) / 3600:.1f}",
                f"{entry['registration']['count']}/{entry['registration']['max']}",
                len([a for a in roster if a in last]),
                len(scored),
                f"{who(top['address'])} {top['totalPoints']}" if top else "",
                entries[1]["totalPoints"] if len(entries) > 1 else "",
                f"{complete}/{len(hypers)}",
                kinds["RelicChestOpened"],
                kinds["StructureCapturedStory"],
                kinds["BattleEvent"],
                kinds["ExplorationReward"],
            ]
        )
    print(f"Games listed: {len(games)}. Accounts registered: {len(accounts)}; games per account: {spread(list(accounts.values()))}.")
    sizes = [len(g["entry"]["roster"]) for g in games.values()]
    print(f"Players per game: {spread(sizes)}; " + ", ".join(f"{k} players: {v} games" for k, v in sorted(collections.Counter(sizes).items()))
          + f". Solo games: {sizes.count(1)} of {len(sizes)}.\n")
    table(
        ["game", "main starts (UTC)", "hours", "registered/max", "acted", "scored", "winner, points", "2nd points",
         "hyperstructures complete/on map", "relic crates opened", "captures", "battles", "reveals"],
        rows,
    )
    total = sum(sources.values())
    print("Points by source, all games: " + ", ".join(f"{k} {v} ({100 * v / max(1, total):.0f}%)" for k, v in sources.most_common()) + ".\n")
    table(
        ["game", "winner", "points", "by source"],
        [[g, w, p, ", ".join(f"{k} {b['points']}" for k, b in br.items() if b["points"])] for g, w, p, br in winners],
    )
    print(f"Registered players who never acted or stopped more than {DROPOUT_MINUTES} min before the end: {len(dropouts)}")
    for gid, name, why in dropouts:
        print(f"- game {gid}: {name}, {why}")
    print()


def felt_text(value):
    raw = int(value, 16).to_bytes(32, "big").lstrip(b"\0")
    return raw.decode("ascii") if raw and all(32 <= c < 127 for c in raw) else value


def u256(low, high):
    return int(low, 16) + (int(high, 16) << 128)


def section_ledger(folder, who):
    """The value ledger on mainnet: Blitz slots, entries, refunds, results and chests; Frontier funding and withdrawals."""
    print("# Value ledger (Starknet mainnet, read-only)\n")
    path = os.path.join(folder, "ledger.json")
    if not os.path.exists(path):
        print("Not read in this pull.\n")
        return
    led = load(folder, "ledger.json")
    events = led["events"]
    account_of = {}
    if os.path.exists(os.path.join(folder, "blitz.json")):
        for g in load(folder, "blitz.json").values():
            account_of.update({hex(int(r["wallet"], 16)): r["account"] for r in g["entry"]["roster"]})
    named = who
    who = lambda wallet: named(account_of.get(hex(int(wallet, 16)), wallet))  # noqa: E731
    lords = lambda v: f"{v / LORDS_DECIMALS:,.2f}".rstrip("0").rstrip(".")  # noqa: E731
    fmt = lambda t: datetime.fromtimestamp(t, UTC).strftime("%m-%d %H:%M") if t else "?"  # noqa: E731
    print(f"Ledger {led['ledger']}: {len(events)} events — " + ", ".join(
        f"{k} {v}" for k, v in collections.Counter(e["name"] for e in events).most_common()) + ".\n")
    fee = {}
    for pr in led["presets"]:
        r = pr["row"]
        if r:
            fee[pr["id"]] = {"entry": u256(r[0], r[1]), "cut_bps": int(r[2], 16), "chest_bps": int(r[3], 16),
                             "sword": u256(r[6], r[7]), "shield": u256(r[8], r[9])}
    for pid, f in sorted(fee.items()):
        print(f"- preset {pid}: entry {lords(f['entry'])} LORDS, protocol cut {f['cut_bps'] / 100}%, chest share"
              f" {f['chest_bps'] / 100}%, sword {lords(f['sword'])}, shield {lords(f['shield'])}")
    print()
    regs = collections.defaultdict(list)
    for r in led["registrations"]:
        row = r["row"]
        if row:
            regs[(r["key"][0], r["key"][1])].append({
                "owner": r["key"][2], "sword": int(row[1], 16), "shield": int(row[2], 16), "paid": u256(row[5], row[6]),
                "refundable": int(row[7], 16), "game": int(row[8], 16)})
    by_slot = collections.defaultdict(collections.Counter)
    refunds = collections.defaultdict(int)
    for e in events:
        if e["name"] in ("SlotCancelled", "SlotAborted", "Registered", "RegistrationRefundable", "Refunded"):
            by_slot[(e["keys"][1], e["keys"][2])][e["name"]] += 1
        if e["name"] == "Refunded":
            refunds[(e["keys"][1], e["keys"][2])] += u256(e["data"][0], e["data"][1])
    opened = {(e["keys"][1], e["keys"][2]): e for e in events if e["name"] == "SlotOpened"}
    results = {(e["keys"][1], int(e["data"][0], 16)): e for e in events if e["name"] == "ResultsApplied"}
    rows, per_day = [], collections.defaultdict(collections.Counter)
    for sl in sorted(led["slots"], key=lambda sl: int(sl["key"][1], 16)):
        key, r = tuple(sl["key"]), sl["row"]
        if not r:
            continue
        preset, close, pool, count, cancelled = int(r[2], 16), int(r[3], 16), u256(r[5], r[6]), int(r[7], 16), int(r[8], 16)
        seats = regs.get(key, [])
        games = sorted({x["game"] for x in seats if x["game"]})
        res = results.get((key[0], int(key[1], 16)))
        day = per_day[fmt(opened[key].get("at"))[:5]]
        day["opened"] += 1
        day["filled"] += bool(count)
        day["seats"] += count
        day["paid"] += sum(x["paid"] for x in seats)
        if not count:
            continue
        rows.append([
            int(key[1], 16), fmt(opened[key].get("at")), fmt(close), preset, count,
            ",".join(map(str, games)) or "–", sum(1 for x in seats if not x["game"]),
            lords(sum(x["paid"] for x in seats)), sum(x["sword"] for x in seats), sum(x["shield"] for x in seats),
            "cancelled" if cancelled else ("aborted" if by_slot[key]["SlotAborted"] else ""),
            f"{by_slot[key]['Refunded']} ({lords(refunds[key])})", sum(1 for x in seats if x["refundable"]),
            lords(pool), lords(u256(res["data"][3], res["data"][4])) if res else "–",
        ])
    table(["opened on (UTC)", "slots opened", "slots with a registration", "registrations", "LORDS paid in"],
          [[d, c["opened"], c["filled"], c["seats"], lords(c["paid"])] for d, c in sorted(per_day.items())])
    print(f"Slots that took a registration ({len(rows)} of {sum(c['opened'] for c in per_day.values())}):\n")
    table(["slot", "opened (UTC)", "closes (UTC)", "preset", "registered", "game", "unseated", "LORDS paid in",
           "swords", "shields", "state", "refunds (LORDS)", "refund owed", "pool now", "pool at results"], rows)
    minted = [e for e in events if e["name"] == "ChestMinted"]
    opened_chests = [e for e in events if e["name"] == "ChestOpened"]
    print(f"Chests minted to Blitz players: {len(minted)}; requested {sum(1 for e in events if e['name'] == 'ChestRequested')};"
          f" opened {len(opened_chests)}, paying {lords(sum(u256(e['data'][2], e['data'][3]) for e in opened_chests))} LORDS.\n")
    holders = collections.defaultdict(lambda: [0, 0, collections.Counter()])
    for e in minted:  # keys: shard, game, wallet
        holders[hex(int(e["keys"][3], 16))][0] += 1
        holders[hex(int(e["keys"][3], 16))][2][int(e["data"][3], 16)] += 1
    for e in opened_chests:  # keys: token id (low, high), wallet
        holders[hex(int(e["keys"][3], 16))][1] += 1
    table(["holder", "chests minted", "opened", "bands minted"],
          [[f"{who(h)} ({h[:8]})", m, o, ", ".join(f"band {k}: {v}" for k, v in sorted(bands.items()))]
           for h, (m, o, bands) in sorted(holders.items(), key=lambda kv: -kv[1][0])])
    for e in [e for e in events if e["name"] in ("FrontierFunded", "WithdrawalPaid", "FrontierClosed", "SeasonPaid")]:
        if e["name"] == "FrontierFunded":
            print(f"- FrontierFunded {felt_text(e['keys'][1])} season {int(e['keys'][2], 16)}: {lords(u256(e['data'][2], e['data'][3]))} LORDS")
        elif e["name"] == "WithdrawalPaid":
            print(f"- WithdrawalPaid {fmt(e.get('at'))} to {who(e['data'][1])}: {lords(u256(e['data'][2], e['data'][3]))} LORDS")
        else:
            print(f"- {e['name']} {fmt(e.get('at'))}")
    print()


def analyse(folder):
    w = World(folder)
    print(f"# Frontier live data, game {w.game['game_id']}, pulled {w.pulled['at']}\n")
    section_players(w)
    A = section_progression(w)
    section_standings(w, A)
    section_fights(w)
    section_exploration(w, A)
    section_discovery(w, A)
    section_stamina(w, A)
    section_research(w)
    section_realm(w)
    section_economy(w)
    if os.path.exists(os.path.join(folder, "chain.json")):
        section_health(w)
    if os.path.exists(os.path.join(folder, "blitz.json")):
        section_blitz(folder, w.who)
    section_ledger(folder, w.who)
    if os.path.exists(os.path.join(folder, "schema.json")):
        usage(folder)


def lag(samples="10", gap="30", base="https://herald.realms.party"):
    """Herald's confirmed block against the shard's head, read one after the other, every `gap` seconds."""
    rpc = get(f"{base}/manifest")["rpcUrl"]
    for n in range(int(samples)):
        herald = get(f"{base}/health")["confirmed_block"]
        chain = rpc_batch(rpc, [("starknet_blockNumber", [])])[0]
        print(f"{datetime.now(UTC):%Y-%m-%dT%H:%M:%SZ} herald {herald} chain {chain} lag {chain - herald}", flush=True)
        if n + 1 < int(samples):
            time.sleep(int(gap))


if __name__ == "__main__":
    command, args = sys.argv[1], sys.argv[2:]
    if command == "pull":
        pull(*args)
    elif command == "ledger":  # (re)read the value ledger into an existing pull
        pull_ledger(args[0] if args else newest_pull())
    elif command == "lag":
        lag(*args)
    elif command == "usage":
        usage(args[0] if args else newest_pull())
    elif command == "analyse":
        analyse(args[0] if args else newest_pull())
    elif command == "all":
        analyse(pull(*args))
