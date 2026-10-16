"""Construction checks for independent options; visual direction still requires rendered review."""

import json
import math
from pathlib import Path

import bmesh
import bpy


def validate(objects):
    radius = 1
    if bpy.context.scene.get("citadelSourceVersion", 0) >= 16:
        contract = json.loads(
            Path(__file__).with_name("citadel-tiers.json").read_text()
        )
        radius = contract[bpy.context.scene["citadelTier"]]["footprintRadius"]
    editable = bpy.data.collections["CITADEL_EDITABLE"].objects
    roofs = [o for o in editable if o.get("roofShell")]
    for obj in roofs:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        closed = all(e.is_manifold for e in bm.edges)
        volume = bm.calc_volume(signed=True)
        bm.free()
        if not closed or volume <= 0:
            raise ValueError(f"Roof {obj.name}: closed outward-facing shell required")
    points = [v.co for o in objects for v in o.data.vertices]
    for v in points:
        if v.z < -0.03001 or any(
            v.x * math.cos(i * math.pi / 3) + v.y * math.sin(i * math.pi / 3)
            > radius * math.sqrt(3) / 2 + 0.00001
            for i in range(6)
        ):
            raise ValueError(
                f"Geometry exceeds age footprint / one-hex contact skirt: {tuple(v)}"
            )
    for obj in editable:
        if obj.name.startswith("Curtain / dressed facing") and any(
            face.normal.x * face.center.x + face.normal.y * face.center.y <= 0
            for face in obj.data.polygons
        ):
            raise ValueError(
                "Preserve authored outward normals on open curtain cladding"
            )
    for prefix in ["Curtain / crown", "Curtain / merlon"]:
        parts = [o for o in editable if o.name.startswith(prefix)]
        if parts:
            tops = [max(v.co.z for v in o.data.vertices) for o in parts]
            if max(tops) - min(tops) > 0.00001:
                raise ValueError("Curtain must have one level all around the hex")
    for obj in editable:
        if obj.name.startswith("Curtain / core") and any(
            max(
                v.co.x * math.cos(i * math.pi / 3)
                + v.co.y * math.sin(i * math.pi / 3)
                for v in obj.data.vertices
            )
            > radius * (math.sqrt(3) / 2 - 0.0025)
            for i in range(6)
        ):
            raise ValueError(
                "Inset the mortar core behind ashlar; coplanar surfaces flicker"
            )
    gate = next(o for o in objects if o.get("citadelOrderSurface") == "gate")
    jamb = bpy.data.objects.get("Gate / jamb") or bpy.data.objects["Gate / body"]
    front = min(v.co.y for v in jamb.data.vertices)
    if any(
        abs(v.co.x) > 0.06 * radius or v.co.y > front - 0.001 or v.co.y < front - 0.04
        for v in gate.data.vertices
    ):
        raise ValueError("Mount the Order imprint directly on the gate's front face")
    bar = bpy.data.objects["Banner / anchored crossbar"]
    xs = [v.co.x for v in bar.data.vertices]
    zs = [v.co.z for v in bar.data.vertices]
    if max(xs) - min(xs) < 0.19 * radius or max(zs) - min(zs) > 0.025:
        raise ValueError(
            "Apply the horizontal banner anchor transform before production assembly"
        )
    return {
        "roofShells": len(roofs),
        "hexVertices": len(points),
        "direction": bpy.context.scene["realmDirection"],
    }
