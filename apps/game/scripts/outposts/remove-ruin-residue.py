"""Remove the retired violet surfaces from the packed ruin; retain every masonry face."""

import sys
import hashlib
import json
from pathlib import Path

import bmesh
import bpy


def remove_residue(source):
    bpy.ops.wm.open_mainfile(filepath=str(source))
    before = masonry_fingerprint()
    removed = 0
    for geometry in bpy.data.meshes:
        slots = {
            index
            for index, material in enumerate(geometry.materials)
            if material and material.name == "Violet rift residue"
        }
        if not slots:
            continue
        mesh = bmesh.new()
        mesh.from_mesh(geometry)
        faces = [face for face in mesh.faces if face.material_index in slots]
        removed += len(faces)
        bmesh.ops.delete(mesh, geom=faces, context="FACES")
        mesh.to_mesh(geometry)
        mesh.free()
        for index in sorted(slots, reverse=True):
            geometry.materials.pop(index=index)
    material = bpy.data.materials.get("Violet rift residue")
    if material and not material.users:
        bpy.data.materials.remove(material)
    after = masonry_fingerprint()
    if before != after:
        raise ValueError("Residue removal changed masonry; source was not saved")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
    print(json.dumps({"removedResidueFaces": removed, "masonryBefore": before, "masonryAfter": after}))


def masonry_fingerprint():
    faces = []
    for geometry in bpy.data.meshes:
        for face in geometry.polygons:
            material = geometry.materials[face.material_index] if face.material_index < len(geometry.materials) else None
            if material and material.name == "Violet rift residue":
                continue
            faces.append((geometry.name, sorted(tuple(geometry.vertices[i].co) for i in face.vertices)))
    return hashlib.sha256(json.dumps(sorted(faces)).encode()).hexdigest()


if __name__ == "__main__":
    remove_residue(Path(sys.argv[sys.argv.index("--") + 1]).resolve())
