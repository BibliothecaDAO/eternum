"""Generate the immutable gameplay traits from the bundled 8,000 realm metadata records."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "packages/core/src/data/full-realms.json"
TARGET = ROOT / "config/deployer/clean/world/native/realm-traits.json"


# Canonical realm NFT IDs. These differ from the game resource IDs.
RESOURCE_IDS = {
    "Stone": 1,
    "Coal": 2,
    "Wood": 3,
    "Copper": 4,
    "Ironwood": 5,
    "Obsidian": 6,
    "Gold": 7,
    "Silver": 8,
    "Mithral": 9,
    "Alchemical Silver": 10,
    "Cold Iron": 11,
    "Deep Crystal": 12,
    "Ruby": 13,
    "Diamonds": 14,
    "Hartwood": 15,
    "Ignium": 16,
    "Twilight Quartz": 17,
    "True Ice": 18,
    "Adamantine": 19,
    "Sapphire": 20,
    "Ethereal Silica": 21,
    "Dragonhide": 22
}

ORDER_IDS = {
    "The Order of Giants": 1,
    "The Order of Perfection": 2,
    "The Order of Rage": 3,
    "The Order of the Fox": 4,
    "The Order of the Twins": 5,
    "The Order of Fury": 6,
    "The Order of Reflection": 7,
    "The Order of Detection": 8,
    "The Order of Skill": 9,
    "The Order of Brilliance": 10,
    "The Order of Protection": 11,
    "The Order of Power": 12,
    "The Order of Titans": 13,
    "The Order of Vitriol": 14,
    "The Order of Anger": 15,
    "The Order of Enlightenment": 16
}

WONDER_IDS = {
    "None": 1,
    "The Eternal Orchard": 2,
    "The Glowing Geyser": 3,
    "The Pearl Summit": 4,
    "The Pearl River": 5,
    "Altar Of Divine Will": 6,
    "The Fading Yew": 7,
    "Pantheon Of Chaos": 8,
    "The Ancient Lagoon": 9,
    "The Exalted Basin": 10,
    "The Amaranthine Rock": 11,
    "The Pale Pillar": 12,
    "The Mythic Trees": 13,
    "Sanctum Of The Oracle": 14,
    "The Ancestral Willow": 15,
    "The Pale Vertex": 16,
    "Cathedral Of Agony": 17,
    "The Omen Graves": 18,
    "The Crying Oak": 19,
    "The Perpetual Ridge": 20,
    "The Sanctified Fjord": 21,
    "Altar Of Perfection": 22,
    "The Argent Catacombs": 23,
    "The Mirror Grotto": 24,
    "The Mother Grove": 25,
    "The Dark Mountain": 26,
    "The Origin Oasis": 27,
    "The Cerulean Reliquary": 28,
    "Sanctum Of Purpose": 29,
    "Altar Of The Void": 30,
    "Pagoda Of Fortune": 31,
    "The Weeping Willow": 32,
    "Synagogue Of Collapse": 33,
    "Mosque Of Mercy": 34,
    "The Perpetual Fjord": 35,
    "The Ethereal Isle": 36,
    "The Azure Lake": 37,
    "The Celestial Vertex": 38,
    "The Exalted Maple": 39,
    "The Oracle Pool": 40,
    "Infinity Spire": 41,
    "The Exalted Geyser": 42,
    "The Glowing Pinnacle": 43,
    "The Ancestral Trees": 44,
    "The Immortal Hot Spring": 45,
    "The Pure Stone": 46,
    "The Cerulean Chamber": 47,
    "Sanctuary Of The Ancients": 48,
    "The Solemn Catacombs": 49,
    "The Devout Summit": 50,
    "Sky Mast": 51
}

def realm_trait_records():
    realms = json.loads(SOURCE.read_text())
    assert set(realms) == {str(i) for i in range(1, 8001)}, "Expected all 8000 canonical realms"
    resources = RESOURCE_IDS
    orders = ORDER_IDS
    wonders = WONDER_IDS
    packed = []
    for realm_id in range(1, 8001):
        attributes = realms[str(realm_id)]["attributes"]
        mask = sum(1 << (resources[a["value"]] - 1) for a in attributes if a["trait_type"] == "Resource")
        order = next(orders[a["value"]] for a in attributes if a["trait_type"] == "Order")
        wonder = next((wonders[a["value"]] for a in attributes if a["trait_type"] == "Wonder (translated)"), 1)
        assert mask > 0 and mask < (1 << 22) and 1 <= order <= 16 and 1 <= wonder <= 63
        packed.append(mask | ((order - 1) << 22) | (wonder << 26))
    return packed


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    records = realm_trait_records()
    if args.check:
        assert json.loads(TARGET.read_text()) == records, "Regenerate native realm metadata"
    else:
        TARGET.write_text(json.dumps(records, indent=2) + "\n")
