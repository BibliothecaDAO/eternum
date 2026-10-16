"""Bake the approved warm upper glass and lower oak shutters into the realm sources."""

import json
import math
from pathlib import Path
import struct
import tempfile
import zlib

import bpy

REVISION = 23
UV_NAME = 'Window infill'
TREATMENT = 'shutters-below-warm-glass-above'
SIZE = 256


def point_key(point):
    return tuple(round(value, 6) for value in point)


def window_panels():
    return [obj for obj in bpy.data.collections['CITADEL_EDITABLE'].objects
            if (' / recessed window' in obj.name or 'window / inset panel' in obj.name)
            and not any(word in obj.name for word in ('main door', 'portal', 'entrance'))]


def is_lower(panel):
    return bpy.context.scene.get('citadelTier', 'empire') == 'empire' and min(v.co.z for v in panel.data.vertices) < .9


def window_coordinates(panels):
    coordinates = {}
    for panel in panels:
        points = [v.co for v in panel.data.vertices]
        axis = 0 if max(v.x for v in points) - min(v.x for v in points) > .001 else 1
        left, right = min(v[axis] for v in points), max(v[axis] for v in points)
        bottom, top = min(v.z for v in points), max(v.z for v in points)
        lower = is_lower(panel)
        for point in points:
            u = (point[axis] - left) / (right - left)
            v = (point.z - bottom) / (top - bottom)
            # Four-pixel gutters keep compressed mips away from the neighbouring infill.
            coordinates[point_key(point)] = ((4 + u * 120 + (0 if lower else 128)) / SIZE,
                                              (20 + v * 232) / SIZE)
    return coordinates


def mix_color(first, second, amount):
    return tuple(round(a + (b - a) * amount) for a, b in zip(first, second))


def infill_pixel(x, y):
    if y < 16:
        return (255, 255, 255), (0, 0, 0)
    # Match the approved painted infill: wood on the left, warm leaded glass on the right.
    u = min(1, max(0, ((x % 128) - 4) / 120))
    v = 1 - min(1, max(0, (y - 20) / 232))
    px, py = u * 128, v * 256
    if x < 128:
        grain = .07 + (math.sin(px * 13.7) + 1) * .06
        color = mix_color((148, 112, 75), (48, 30, 17), grain)
        if min(px % 16, 16 - px % 16) < 1:
            color = (80, 59, 43)
        if any(start <= py < start + 9 for start in (65, 187)) and 4 <= px < 124:
            color = (88, 70, 48)
        if any(start <= py < start + 4 for start in (67, 189)) and (5 <= px < 28 or 100 <= px < 123):
            color = (69, 59, 50)
        if 62 <= px < 66:
            color = (69, 59, 50)
        return color, (0, 0, 0)
    gradient = (u + 4 * v) / 5
    color = (mix_color((164, 103, 36), (219, 166, 79), gradient / .55) if gradient < .55
             else mix_color((219, 166, 79), (244, 188, 104), (gradient - .55) / .45))
    if px < 4 or px > 124 or py < 4 or py > 252 or any(abs(px - a) < 2 for a in (42, 86)) or any(abs(py - a) < 2 for a in (64, 128, 192)):
        color = (53, 65, 74)
    return color, color


def pack_atlas(name, channel):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    rows = bytearray()
    for y in reversed(range(SIZE)):
        rows.append(0)
        for x in range(SIZE):
            rows.extend((*infill_pixel(x, y)[channel], 255))
    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(bytes(rows))) + chunk(b'IEND', b''))
    with tempfile.TemporaryDirectory(prefix='realm-window-atlas-') as directory:
        path = Path(directory) / (name + '.png')
        path.write_bytes(png)
        image = bpy.data.images.load(str(path))
        image.name = name
        image.pack()
        image.filepath = '//textures/' + name + '.png'
    return image


def apply_infill_uvs(objects, coordinates):
    matched = set()
    for obj in objects:
        if obj.get('citadelOrderSurface'):
            continue
        mesh = obj.data
        uv = mesh.uv_layers.get(UV_NAME) or mesh.uv_layers.new(name=UV_NAME)
        tint = mesh.color_attributes.get('Surface tint')
        if tint is None:
            tint = mesh.color_attributes.new(name='Surface tint', type='FLOAT_COLOR', domain='CORNER')
        for face in mesh.polygons:
            keys = [point_key(mesh.vertices[index].co) for index in face.vertices]
            window = all(key in coordinates for key in keys)
            for loop, key in zip(face.loop_indices, keys):
                uv.data[loop].uv = coordinates[key] if window else (4 / SIZE, 4 / SIZE)
                if window:
                    tint.data[loop].color = (1, 1, 1, 1)
                    matched.add(key)
    if matched != set(coordinates):
        raise ValueError(f'Window atlas missed {len(set(coordinates) - matched)} authored vertices')
    return len(matched)


def apply_window_material(material, base, emission):
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.get('Principled BSDF')
    for node in list(nodes):
        if node.type == 'TEX_IMAGE' and node.image and node.image.name == 'Citadel Imperial glass':
            nodes.remove(node)
    uv = nodes.new('ShaderNodeUVMap')
    uv.uv_map = UV_NAME
    for image, socket in ((base, 'Base Color'), (emission, 'Emission Color')):
        texture = nodes.new('ShaderNodeTexImage')
        texture.image = image
        links.new(uv.outputs['UV'], texture.inputs['Vector'])
        links.new(texture.outputs['Color'], shader.inputs[socket])
    shader.inputs['Emission Strength'].default_value = .25
    material['realmWindowTreatment'] = TREATMENT


def revise(save=False):
    if bpy.context.scene.get('realmWindowRevision') == REVISION:
        return
    panels = window_panels()
    tier = bpy.context.scene.get('citadelTier', 'empire')
    if tier not in ('city', 'kingdom', 'empire') or not panels or bpy.context.scene.get('citadelWonder'):
        raise ValueError('Open a normal Forum, Twin Ward or empire source')
    coordinates = window_coordinates(panels)
    production = list(bpy.data.collections['CITADEL_PRODUCTION'].objects)
    tagged = apply_infill_uvs(production, coordinates)
    apply_infill_uvs(panels, coordinates)
    materials = {obj.data.materials[face.material_index] for obj in production for face in obj.data.polygons
                 if all(point_key(obj.data.vertices[i].co) in coordinates for i in face.vertices)}
    materials.update(material for panel in panels for material in panel.data.materials)
    base = pack_atlas('Citadel Window oak and amber', 0)
    emission = pack_atlas('Citadel Window light', 1)
    for material in materials:
        apply_window_material(material, base, emission)
    bpy.context.scene['realmWindowRevision'] = REVISION
    if save:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, compress=True)
    print(json.dumps({'tier': tier, 'panels': len(panels), 'lowerShutters': sum(is_lower(p) for p in panels),
                      'matchedVertices': tagged, 'materials': [m.name for m in materials]}))


if __name__ == '__main__':
    revise(save=True)
