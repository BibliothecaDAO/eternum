"""Fit solid oak leaves and iron hardware to the authored realm entrances."""

import importlib.util
import json
from pathlib import Path

import bmesh
import bpy

spec = importlib.util.spec_from_file_location('realm_accents', Path(__file__).with_name('revise-realm-accents.py'))
accents = importlib.util.module_from_spec(spec)
spec.loader.exec_module(accents)


def erase_parts(parts, production):
    points = {accents.key(v.co) for obj in parts for v in obj.data.vertices}
    for obj in production.objects:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if accents.key(v.co) in points], context='VERTS')
        bm.to_mesh(obj.data)
        bm.free()
    for obj in parts:
        bpy.data.objects.remove(obj, do_unlink=True)


def front_outline(parts):
    points = [v.co for obj in parts for v in obj.data.vertices]
    front = min(v.y for v in points)
    candidates = [obj.data.vertices[i].co for obj in parts for face in obj.data.polygons if face.normal.y < -.5 for i in face.vertices]
    # Convex arched leaves: a monotone hull retains the authored arch or rectangular head.
    planar = sorted(set((round(v.x, 7), round(v.z, 7)) for v in candidates))
    def cross(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    sides = []
    for sequence in (planar, planar[::-1]):
        side = []
        for point in sequence:
            while len(side) > 1 and cross(side[-2], side[-1], point) <= 0:
                side.pop()
            side.append(point)
        sides += side[:-1]
    if len(sides) < 3:
        raise ValueError(f'No front door contour: {parts[0].name}')
    return sides, front


def clip_at_x(polygon, x, keep_right):
    clipped = []
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        inside_a = a[0] >= x if keep_right else a[0] <= x
        inside_b = b[0] >= x if keep_right else b[0] <= x
        if inside_a:
            clipped.append(a)
        if inside_a != inside_b:
            t = (x - a[0]) / (b[0] - a[0])
            clipped.append((x, a[1] + t * (b[1] - a[1])))
    return clipped


def add_door_faces(name, polygon, front, architecture, editable, production, hardware_only=False):
    vertices, faces, colors = [], [], []
    left, right = min(p[0] for p in polygon), max(p[0] for p in polygon)
    bottom, top = min(p[1] for p in polygon), max(p[1] for p in polygon)
    width, height = right - left, top - bottom
    def face(points, depth, color):
        start = len(vertices)
        vertices.extend((x, front - depth, z) for x, z in points)
        faces.append(tuple(range(start, len(vertices))))
        colors.append((*color, 1))
    def rectangle(x, z, w, h, depth, color):
        face([(x-w/2, z-h/2), (x+w/2, z-h/2), (x+w/2, z+h/2), (x-w/2, z+h/2)], depth, color)
    if not hardware_only:
        # Adjacent leaves completely fill the opening; seams are shallow timber tones, never holes.
        for i in range(8):
            a, b = left + width * i / 8, left + width * (i + 1) / 8
            plank = clip_at_x(clip_at_x(polygon, a, True), b, False)
            shade = .92 + (i % 3) * .06
            face(plank, .003, (.34 * shade, .18 * shade, .073 * shade))
            if i > 0:
                seam = clip_at_x(clip_at_x(polygon, a - width * .004, True), a + width * .004, False)
                face(seam, .0035, (.13, .072, .034))
    for elevation in (.24, .65):
        z = bottom + height * elevation
        for side in (-1, 1):
            center = (left + right) / 2 + side * width * .245
            rectangle(center, z, width * .44, height * .055, .007, (.075, .095, .105))
            for offset in (-.16, .16):
                x = center + width * offset
                r = width * .019
                face([(x-r, z), (x, z-r), (x+r, z), (x, z+r)], .0085, (.36, .39, .40))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    # Existing dark-detail material uses vertex tint; keep the same draw/material budget.
    role = 'Cool mortar' if bpy.context.scene.get('citadelTier', 'empire') == 'empire' else 'Dark details'
    material = next((m for m in architecture.data.materials if role in m.name), architecture.data.materials[0])
    mesh.materials.append(material)
    marker = mesh.attributes.new(name='_SOLID_REALM_DOOR', type='FLOAT', domain='POINT')
    for value in marker.data:
        value.value = 1
    for uv_name in ('Baked surface', 'Surface grain'):
        layer = mesh.uv_layers.new(name=uv_name)
        for value in layer.data:
            value.uv = (.5, .5)
    tint = mesh.color_attributes.new(name='Surface tint', type='FLOAT_COLOR', domain='CORNER')
    for polygon_face, color in zip(mesh.polygons, colors):
        for index in polygon_face.loop_indices:
            tint.data[index].color = color
    obj = bpy.data.objects.new(name, mesh)
    obj['solidRealmDoor'] = True
    editable.objects.link(obj)
    clone = obj.copy()
    clone.data = mesh.copy()
    production.objects.link(clone)
    accents.join_into(architecture, clone)
    return len(faces)


def door_groups(editable):
    groups = []
    for obj in editable.objects:
        name = obj.name
        if name == 'Gate / timber door':
            groups.append([editable.objects['Recess / corner gate']])
        elif name in ('Gate / recessed oak door', 'Gate / ornate arched door') or (
            ' / recessed window' in name and ('main door' in name or '/ portal /' in name)
        ) or name == 'Palace entrance window / inset panel' or name == 'Timber sanctuary / doorway oak door':
            groups.append([obj])
        elif name.startswith('Closed split plank door'):
            groups.append([obj])
    split_gate = [obj for obj in editable.objects if obj.name.startswith('Gate / split oak door')]
    if split_gate:
        groups.append(split_gate)
    return groups


def revise(save=False):
    if bpy.context.scene.get('solidRealmDoors') == 22:
        return
    editable = bpy.data.collections['CITADEL_EDITABLE']
    production = bpy.data.collections['CITADEL_PRODUCTION']
    architecture = next(obj for obj in production.objects if not obj.get('citadelOrderSurface') and not obj.get('orderCloth'))
    groups = door_groups(editable)
    old_bars = [obj for obj in editable.objects if obj.name.startswith(('Gate / gilded door rib', 'Gate / iron crossrail', 'Gate / door plank seam'))]
    details = 0
    for parts in groups:
        polygon, front = front_outline(parts)
        # A short rectangular wonder gate sat below a full arch. Use the arch contour and its frame seat.
        if parts[0].name == 'Recess / corner gate':
            front = min(v.co.y for v in editable.objects['Gate / timber door'].data.vertices)
        details += add_door_faces('Solid oak / ' + parts[0].name, polygon, front, architecture, editable, production,
                                  hardware_only=parts[0].name.startswith('Closed split plank door'))
    erase_parts(old_bars, production)
    bpy.context.scene['solidRealmDoors'] = 22
    if save:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, compress=True)
    print(json.dumps({'source':bpy.data.filepath, 'solidEntrances':len(groups), 'hardwareAndPlankFaces':details, 'removedBars':len(old_bars)}))


if __name__ == '__main__':
    revise(save=True)
