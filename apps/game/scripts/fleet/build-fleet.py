"""Rebuild all nine approved ships using the detailed fleet model source."""

import json
import runpy
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[4]
ART = ROOT / ".context/model-lab"


def remove_retired_studies():
    for name in ["Eternum Fleet", "Ironwind From Scratch"]:
        collection = bpy.data.collections.get(name)
        if collection:
            for obj in list(collection.objects):
                bpy.data.objects.remove(obj, do_unlink=True)
            bpy.data.collections.remove(collection)


def build_fleet():
    model = runpy.run_path(str(Path(__file__).with_name("fleet-model.py")))
    remove_retired_studies()
    report = []
    for row, army in enumerate(model["CLASSES"]):
        for tier in (1, 2, 3):
            root = model["build_ship"](army, tier)
            triangles = 0
            for obj in root.children:
                obj.data.calc_loop_triangles()
                triangles += len(obj.data.loop_triangles)
            root.location = ((tier - 2) * 5.4, row * 5.5, 0)
            report.append(
                {
                    "army": army,
                    "tier": tier,
                    "triangles": triangles,
                    "bytes": (model["OUTPUT"] / f"{army}-t{tier}.glb").stat().st_size,
                }
            )
    ART.mkdir(parents=True, exist_ok=True)
    (ART / "fleet-build.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report))


if __name__ == "__main__":
    build_fleet()
