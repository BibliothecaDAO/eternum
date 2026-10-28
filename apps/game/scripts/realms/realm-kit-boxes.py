"""Write the procedural realm kit's module boxes for one realm source.

Every shipped realm is baked from named editable parts. This records, per kit module, the bounds of the parts it is
made of (glTF axes, model space), so the lab can sort the shipped model's loose blocks into modules without re-exporting
art. Run once per level; the lab reads the merged JSON.

blender --background <source.blend> --python realm-kit-boxes.py -- <level> <out.json>
"""

import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

SIDE_SPLIT = 0.05

# Module of each editable family, by level; a "*" module takes the part's side: <module>L or <module>R.
FAMILIES = {
    "settlement": {
        "cottage*": [
            "Uneven limewashed walls", "Lapped hand-bound straw", "Rough hewn gable verge", "Infilled gable",
            "Rubble foundation", "Wrapped ridge bundle", "Closed split plank door", "Door jamb", "Door lintel",
            "Recessed doorway", "Recessed warm window", "Window mullion", "Window surround", "Worn sill",
            "Worn doorstep", "Crooked oak frame", "Gable diagonal brace", "Gable king post", "Heavy gable tie",
            "Side fieldstone footing", "Side wall brace",
        ],
        "shelter": [
            "Patched sagging canvas shelter", "Canvas ridge lashing", "Rear shelter post", "Shelter stake",
            "Sheltered provision chest", "Chest lid binding", "Provision barrel staves", "Barrel iron hoop",
            "Stacked split firewood",
        ],
        "tent": ["Sewn canvas tent", "Open tent flap", "Tent ownership seam", "Tent ridge pole", "Tent ridge upright"],
    },
    "city": {
        "wing*": ["Forum / upper court arcade", "Forum / upper arcade rear wall"],
        "hall": ["Forum / council hall", "Forum / main door", "Forum / upper side window", "Solid oak / Forum"],
        "roof": ["Roof / Forum", "Ridge / Forum", "Bargeboard / Forum", "Lapped roof course / Forum"],
    },
    "kingdom": {
        "elder": ["Twin Ward / elder"],
        "younger": ["Twin Ward / younger"],
        "tower-roof*": ["Roof"],
        "bridge": ["Twin Ward / bridge", "Twin Ward / open parapet"],
    },
    "empire": {
        "palace": ["Palace", "Solid oak / Palace entrance window"],
        "tower*": ["Flanking tower"],
        "bridge*": ["Bridge"],
    },
}
# City roofs sit on the hall or on a wing: outside this half-width they belong to the wing on their side.
CITY_WING_EDGE = 0.35


def family_of(name: str, families: list[str]) -> bool:
    base = name.split(".")[0]
    return any(base == family or base.startswith(f"{family} /") or base.startswith(f"{family} ") for family in families)


def module_of(level: str, name: str, center_x: float) -> str | None:
    side = "L" if center_x < 0 else "R"
    for module, families in FAMILIES[level].items():
        if not family_of(name, families):
            continue
        if level == "city" and module == "roof":
            return f"wing{side}" if abs(center_x) > CITY_WING_EDGE else "hall"
        if level == "kingdom" and module == "tower-roof*":
            return "elder" if center_x < 0 else "younger"
        if module.endswith("*"):
            return module[:-1] + side
        return module
    return None


def gltf_bounds(obj) -> tuple[list[float], list[float]]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = [min(point[axis] for point in points) for axis in range(3)]
    high = [max(point[axis] for point in points) for axis in range(3)]
    # Blender is Z-up; glTF is Y-up with Blender's -Y as +Z.
    return [low[0], low[2], -high[1]], [high[0], high[2], -low[1]]


def main() -> None:
    level, out = sys.argv[sys.argv.index("--") + 1 :]
    modules: dict[str, list[list[float]]] = {}
    for obj in bpy.data.objects:
        collections = {collection.name for collection in obj.users_collection}
        if obj.type != "MESH" or collections & {"CITADEL_PRODUCTION", "OUTPOST_PRODUCTION"}:
            continue
        low, high = gltf_bounds(obj)
        module = module_of(level, obj.name, (low[0] + high[0]) / 2)
        if module:
            modules.setdefault(module, []).append([round(value, 4) for value in low + high])
    path = Path(out)
    merged = json.loads(path.read_text()) if path.exists() else {}
    merged[level] = dict(sorted(modules.items()))
    path.write_text(json.dumps(merged, separators=(",", ":")) + "\n")
    print(f"{level}: " + ", ".join(f"{name} {len(boxes)}" for name, boxes in sorted(modules.items())))


main()
