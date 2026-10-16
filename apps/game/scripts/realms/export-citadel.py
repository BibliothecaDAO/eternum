"""Export the approved packed realm sources with their geometry and heraldry contracts."""
import argparse
import hashlib
import importlib.util
import json
import math
import re
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

APP = Path(__file__).resolve().parents[2]
CANVAS_SOURCE = APP / 'asset-sources/outposts/village-canvas-thatch.blend'
SOURCES = {*((APP / 'asset-sources/realms').rglob('*.blend')), CANVAS_SOURCE}

TIERS = json.loads((Path(__file__).parent / 'citadel-tiers.json').read_text())


def tier_contract():
    return TIERS[bpy.context.scene.get('citadelTier', 'empire')]


def validate_age(objects):
    if bpy.context.scene.get('realmDirection') == 'canvas-thatch':
        return validate_canvas_source(objects)
    option = 'realmDirection' in bpy.context.scene
    spec = importlib.util.spec_from_file_location('validate_realm_ages', Path(__file__).with_name('validate-realm-options.py' if option else 'validate-realm-ages.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.validate(objects) if option else module.validate_age(objects, tier_contract())


def validate_canvas_source(objects):
    painting = CANVAS_SOURCE.parent / bpy.context.scene['conceptPainting']
    if hashlib.sha256(painting.read_bytes()).hexdigest() != bpy.context.scene['conceptSha256']:
        raise ValueError('Preserve the approved Canvas & Thatch painting')
    yard = []
    for obj in objects:
        marker = obj.data.attributes.get('_YARD_ARCHITECTURE')
        if marker:
            yard.extend(v.co for v, mark in zip(obj.data.vertices, marker.data) if mark.value > 0.5)
    fence = json.loads((APP / 'scripts/outposts/village-yard.json').read_text())
    inner_apothem = fence['fenceRadius'] * math.sqrt(3) / 2 - fence['postRadius']
    if not yard:
        raise ValueError('Preserve Canvas & Thatch yard architecture markers')
    clearance = inner_apothem - max(v.x * math.cos(side * math.pi / 3) + v.y * math.sin(side * math.pi / 3)
                                    for v in yard for side in range(6))
    if clearance < fence['clearance']:
        raise ValueError(f'Keep Canvas & Thatch architecture {fence["clearance"]} inside the fence; got {clearance}')
    body = next(obj for obj in objects if obj.name.endswith(' / painted body'))
    colors = [entry.color[0] for entry in body.data.color_attributes['Surface tint'].data]
    if max(colors) - min(colors) < 0.05:
        raise ValueError('Preserve the village vertex contact bake and painted tint')
    return {'direction': 'canvas-thatch', 'fenceClearance': clearance}


def production_meshes(crown):
    if bpy.app.version[:3] != (5, 2, 1):
        raise ValueError('Use Blender 5.2.1 for the authored citadel source')
    if Path(bpy.data.filepath).resolve() not in {source.resolve() for source in SOURCES}:
        raise ValueError('Open a packed citadel family source before exporting')
    collection = bpy.data.collections.get('CITADEL_PRODUCTION')
    if not collection or not collection.objects:
        raise ValueError('The authored CITADEL_PRODUCTION collection is missing')
    objects = list(collection.objects)
    crowns = bpy.data.collections.get('WONDER_CROWNS')
    if crowns:
        candidates = [obj for obj in crowns.objects if obj.get('wonderCrown') == crown]
        if len(crowns.objects) != 7 or len(candidates) != 1:
            raise ValueError('Select one of the seven authored wonder crowns through --design')
        objects += candidates
    elif crown is not None and not bpy.context.scene.get('citadelWonder'):
        raise ValueError('Only the wonder source accepts --crown')
    if any(obj.type != 'MESH' for obj in objects):
        raise ValueError('CITADEL_PRODUCTION must contain only the authored static meshes')
    return objects


def validate_geometry(objects):
    if any(obj.matrix_world != Matrix.Identity(4) for obj in objects):
        raise ValueError('Apply the authored production transforms before export')
    if any(not {'Baked surface', 'Surface grain'} <= set(obj.data.uv_layers.keys()) or
           'Surface tint' not in obj.data.color_attributes for obj in objects):
        raise ValueError('Preserve both authored UV sets and the Surface tint color attribute')
    vertices = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
    height = max(v.z for v in vertices) - min(v.z for v in vertices)
    minimum, maximum = tier_contract()['height']
    if not minimum <= height <= maximum:
        raise ValueError(f'Citadel height {height:.3f}: retain the tier interval {minimum}–{maximum}')
    for vertex in vertices:
        outside = any(vertex.x * math.cos(i * math.pi / 3) + vertex.y * math.sin(i * math.pi / 3)
                      > math.sqrt(3) / 2 + .00001 for i in range(6))
        if outside or vertex.z < -.03001:
            raise ValueError('Citadel geometry leaves the radius-one gameplay hex or its contact skirt')
    triangles = sum(len(face.vertices) - 2 for obj in objects for face in obj.data.polygons)
    if not 1 <= triangles <= 25000:
        raise ValueError(f'Citadel has {triangles} triangles; retain the 25k maximum review budget')
    contact = validate_terrain_contact(objects) if tier_contract()['age'] == 4 else {}
    return {'height': height, 'triangles': triangles, **contact}


def validate_terrain_contact(objects):
    """Keep the support surface in the terrain and curtain thickness inside all six edges."""
    apothem = math.sqrt(3) / 2
    boundary_intervals = [[] for _ in range(6)]
    corners = set()
    for obj in objects:
        mesh = obj.data
        for face in mesh.polygons:
            points = [mesh.vertices[index].co for index in face.vertices]
            if max(v.z for v in points) < .4:
                continue
            for edge in range(6):
                angle = edge * math.pi / 3
                nx, ny = math.cos(angle), math.sin(angle)
                if all(abs(v.x * nx + v.y * ny - apothem) < .00001 for v in points):
                    along = [-v.x * ny + v.y * nx for v in points]
                    boundary_intervals[edge].append((min(along), max(along)))
        for vertex in mesh.vertices:
            if vertex.co.z > .9:
                continue
            for corner in range(6):
                angle = math.pi / 6 + corner * math.pi / 3
                if math.hypot(vertex.co.x - math.cos(angle), vertex.co.y - math.sin(angle)) < .00001:
                    corners.add(corner)
    boundary_lengths = [covered_edge_length(intervals) for intervals in boundary_intervals]
    if len(corners) != 6 or any(length < .5 for length in boundary_lengths):
        raise ValueError('Place curtain outer faces on all six pointy hex edges, corners at radius one, feet at -0.030')
    return {'contactSkirt': .030, 'boundaryFaceLengths': boundary_lengths, 'hexCorners': len(corners)}


def covered_edge_length(intervals):
    covered_end = -math.inf
    length = 0.
    for start, end in sorted(intervals):
        length += max(0., end - max(start, covered_end))
        covered_end = max(covered_end, end)
    return length


def validate_curtain_height(objects):
    """Require one crown and merlon elevation, including the two gate approaches."""
    editable = bpy.data.collections['CITADEL_EDITABLE'].objects
    elevations = {}
    for part in ('boundary core', 'continuous crown', 'merlon'):
        sections = [obj for obj in editable if obj.name.startswith('Curtain / ' + part)]
        if len(sections) < 6 or (part != 'merlon' and len(sections) != 6):
            raise ValueError('Retain all six curtain sections and their battlements')
        tops = [max((obj.matrix_world @ v.co).z for v in obj.data.vertices) for obj in sections]
        if max(tops) - min(tops) > .00001:
            raise ValueError(f'Level every curtain {part}; the battlement line must not step down toward the gate')
        elevations[part] = tops[0]
    # Read the actual production geometry in the middle of each hex edge, clear of the gate tower.
    apothem = math.sqrt(3) / 2
    vertices = [obj.matrix_world @ v.co for obj in objects for v in obj.data.vertices]
    edge_tops = []
    for edge in range(6):
        nx, ny = math.cos(edge * math.pi / 3), math.sin(edge * math.pi / 3)
        band = [v.z for v in vertices if abs(v.x * nx + v.y * ny - apothem) < .005 and
                abs(-v.x * ny + v.y * nx) < .16]
        if not band or abs(max(band) - elevations['merlon']) > .00001:
            raise ValueError('Rebuild production from the level curtain; all six delivered battlement lines must agree')
        edge_tops.append(max(band))
    return {'curtainCoreTop': elevations['boundary core'], 'curtainCrownTop': elevations['continuous crown'],
            'curtainMerlonTop': elevations['merlon'], 'curtainEdgeTops': edge_tops}


def validate_materials(objects):
    materials = {slot.material for obj in objects for slot in obj.material_slots}
    if None in materials or not 1 <= len(materials) <= 8:
        raise ValueError('Citadel must use no more than eight production materials')
    images = {node.image for mat in materials for node in mat.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image}
    if not 1 <= len(images) <= 6 or any(not image.packed_file or max(image.size) > 480 for image in images):
        raise ValueError('Pack at most six production textures, each no larger than 480 pixels')
    if bpy.context.scene.get('realmDirection') == 'canvas-thatch':
        return {'materials': len(materials), 'textures': len(images)}
    for name in ('Citadel Ambient occlusion', 'Citadel Curvature'):
        image = bpy.data.images.get(name)
        if not image or not image.packed_file:
            raise ValueError(f'Bake and pack {name} in the authored source')
        samples = list(image.pixels)[0::4]
        if max(samples) - min(samples) < .05:
            raise ValueError(f'{name} is flat; rebake it from the modeled surfaces')
    return {'materials': len(materials), 'textures': len(images)}


def validate_order_surfaces(objects):
    surfaces = {obj.get('citadelOrderSurface'): obj for obj in objects if obj.get('citadelOrderSurface')}
    if set(surfaces) != {'cloth', 'gate'}:
        raise ValueError('Keep separate cloth and gate Order meshes with citadelOrderSurface metadata')
    for obj in surfaces.values():
        if obj.get('orderCloth') != 'banner':
            raise ValueError('Mark both Order surfaces orderCloth=banner for the settlement atlas')
        uv = obj.data.uv_layers['Baked surface']
        coordinates = [entry.uv for entry in uv.data]
        if any(any(value < -.00001 or value > 1.00001 for value in pair) for pair in coordinates):
            raise ValueError('Each Order panel must retain normalized UV0, independent of the architecture atlas')
        if any(max(pair[axis] for pair in coordinates) < .99999 or
               min(pair[axis] for pair in coordinates) > .00001 for axis in range(2)):
            raise ValueError('Order UV0 must span the entire emblem texture')
    return surfaces


def validate_corner_passage(objects, gate):
    if any(v.co.y > -.90 or abs(v.co.x) > .11 for v in gate.data.vertices):
        raise ValueError('The gate Order imprint belongs on the front corner bastion')
    if any(face.normal.y > -.99 for face in gate.data.polygons):
        raise ValueError('Face the gate imprint toward the front camera, not into the bastion')
    architecture = next(obj for obj in objects if not obj.get('citadelOrderSurface'))
    hit, point, _, face = architecture.ray_cast(Vector((.04, -1.2, .25)), Vector((0, 1, 0)))
    material = architecture.data.materials[architecture.data.polygons[face].material_index] if hit else None
    if not material or 'Dark details' not in material.name or point.y > -.80:
        raise ValueError('Cut the front-corner arch through the stone to expose the recessed door')


def validate_essence():
    material = bpy.data.materials.get('Citadel / Refined essence')
    shader = material.node_tree.nodes.get('Principled BSDF') if material else None
    if not shader or shader.inputs['Emission Strength'].default_value <= 1:
        raise ValueError('Preserve the named Refined essence material and HDR emissive strength')
    red, green, blue, _ = shader.inputs['Emission Color'].default_value
    if not green > blue > red:
        raise ValueError('Mastered essence must emit teal')
    return material.name


def validate_order_and_essence(objects):
    surfaces = validate_order_surfaces(objects)
    validate_corner_passage(objects, surfaces['gate'])
    validate_sanctum_window_clearance(objects)
    material = validate_essence()
    return {'orderSurfaces': sorted(surfaces), 'frontCornerPassage': True, 'emissiveMaterial': material}


def validate_sanctum_window_clearance(objects):
    if bpy.data.objects.get('Sanctum / mortar core') is None:
        return
    architecture = next(obj for obj in objects if not obj.get('citadelOrderSurface'))
    hit, _, _, face = architecture.ray_cast(Vector((.04, -.5, .6)), Vector((0, 1, 0)))
    material = architecture.data.materials[architecture.data.polygons[face].material_index] if hit else None
    if not material or 'Dark details' not in material.name:
        raise ValueError('Keep the sanctum front window exposed; split the core at deformation boundaries before varying proportions')


def validate_banner_clearance():
    editable = bpy.data.collections['CITADEL_EDITABLE'].objects
    banners = [obj for obj in editable if obj.get('citadelOrderSurface') == 'cloth']
    windows = [obj for obj in editable if 'window / inset panel' in obj.name and
               min(v.co.y for v in obj.data.vertices) < 0]
    if len(banners) != 2 or not windows:
        raise ValueError('Retain the two supported Order banners and the authored front windows')
    camera_source = (APP / 'src/three/scenes/worldmap-camera-view-profile.ts').read_text()
    presets = [(float(d), float(p)) for d, p in re.findall(r'\[(10|20|45), (\d+)\]', camera_source)]
    if len(presets) != 3:
        raise ValueError('Update the banner clearance proof for the current client camera presets')
    for distance, pitch in presets:
        for banner in banners:
            cloth = projected_bounds(banner, distance, pitch)
            for window in windows:
                opening = projected_bounds(window, distance, pitch)
                overlap = all(min(cloth[axis + 2], opening[axis + 2]) -
                              max(cloth[axis], opening[axis]) > .00001 for axis in range(2))
                if overlap:
                    raise ValueError(f'Move {banner.name} off {window.name}; it covers the opening at distance {distance:g}')
    return {'bannerWindowChecks': len(presets) * len(banners) * len(windows)}


def projected_bounds(obj, distance, pitch_degrees):
    pitch = math.radians(pitch_degrees)
    target = .85 if distance == 10 else 0.
    camera = Vector((0., -math.cos(pitch) * distance, target + math.sin(pitch) * distance))
    forward = Vector((0., math.cos(pitch), -math.sin(pitch)))
    up = Vector((0., math.sin(pitch), math.cos(pitch)))
    points = [obj.matrix_world @ v.co - camera for v in obj.data.vertices]
    projected = [(v.x / v.dot(forward), v.dot(up) / v.dot(forward)) for v in points]
    return [min(p[0] for p in projected), min(p[1] for p in projected),
            max(p[0] for p in projected), max(p[1] for p in projected)]


def validate_crown_seating():
    parts = {obj.get('citadelCrownPart'): obj for obj in bpy.data.collections['CITADEL_EDITABLE'].objects
             if obj.get('citadelCrownPart')}
    if set(parts) != {'collar', 'dome'}:
        raise ValueError('Author a matched crown collar and dome root, marked with citadelCrownPart')
    collar = [parts['collar'].matrix_world @ v.co for v in parts['collar'].data.vertices]
    dome = [parts['dome'].matrix_world @ v.co for v in parts['dome'].data.vertices]
    top, bottom = max(v.z for v in collar), min(v.z for v in dome)
    seat = [v for v in collar if abs(v.z - top) < .00001]
    root = [v for v in dome if abs(v.z - bottom) < .00001]
    error = max(min((v - p).length for p in seat) for v in root)
    if abs(top - bottom) > .00001 or error > .00001:
        raise ValueError('Seat every dome-root vertex on the collar top ring; no gap or unsupported overhang')
    center = sum(root, Vector()) / len(root)
    for face in parts['dome'].data.polygons:
        radial = Vector((face.center.x - center.x, face.center.y - center.y, 0))
        if abs(face.normal.z) < .99 and face.normal.dot(radial) <= 0:
            raise ValueError('Face the crown roof outward; inward winding invalidates its silhouette')
    return {'crownSeatError': error, 'crownSeatVertices': len(root)}


def validate_window_facing():
    core = bpy.data.objects.get('Sanctum / mortar core')
    if core is None:
        return
    origin = sum((v.co for v in core.data.vertices), Vector()) / len(core.data.vertices)
    for obj in bpy.data.collections['CITADEL_EDITABLE'].objects:
        if 'window / inset panel' not in obj.name or len(obj.data.polygons) != 1:
            continue
        center = sum((v.co for v in obj.data.vertices), Vector()) / len(obj.data.vertices)
        outward = Vector((center.x - origin.x, center.y - origin.y, 0.))
        if obj.data.polygons[0].normal.dot(outward) <= 0:
            raise ValueError(f'Face {obj.name} outward from the sanctum, not into the stone')


def validate_attachments():
    validate_window_facing()
    return {**validate_banner_clearance(), **validate_crown_seating()}


def wonder_point(point, proportions):
    """Connected drum and dome deformation; the altar and crown translate together."""
    point = point.copy()
    z = point.z
    if z <= 1.1:
        return point
    drum = proportions['drumHeight']
    dome = proportions['domeHeight']
    if z <= 1.84:
        point.z = 1.1 + (z - 1.1) * drum
    elif z <= 2.36:
        point.z = 1.1 + .74 * drum + (z - 1.84) * dome
    else:
        point.z = 1.1 + .74 * drum + .52 * dome + z - 2.36
    width = 1 + (proportions['width'] - 1) * min(1, (z - 1.1) / .34)
    point.x *= width
    point.y = .25 + (point.y - .25) * width
    return point


def deform_wonder_mesh(obj, proportions):
    group = obj.vertex_groups.get('Wonder upper body')
    upper = obj.get('wonderPart') == 'upper' or obj.get('wonderCrown')
    for vertex in obj.data.vertices:
        tagged = group and any(g.group == group.index for g in vertex.groups)
        if upper or tagged:
            point = wonder_point(vertex.co, proportions)
            if obj.get('wonderCrown'):
                point.x, point.y = vertex.co.x, vertex.co.y
            vertex.co = point
    obj.data.update()


def tint_wonder_mesh(obj, colors):
    tint = obj.data.color_attributes.get('Surface tint')
    if not tint or obj.get('citadelOrderSurface'):
        return
    for face in obj.data.polygons:
        name = obj.data.materials[face.material_index].name
        color = None
        if 'Pale limestone' in name:
            color = colors['stone']
        elif 'Imperial gold' in name:
            vault = not obj.get('wonderCrown') and all(1.84 <= obj.data.vertices[i].co.z <= 2.36 for i in face.vertices)
            color = colors['dome' if vault else 'gold']
        elif 'Refined essence' in name:
            color = colors['crystal']
        if color:
            for index in face.loop_indices:
                tint.data[index].color = (*color, 1)


def apply_wonder_design(objects, design):
    if tier_contract()['age'] < 4:
        for obj in objects:
            if obj.get('citadelOrderSurface'):
                continue
            tint = obj.data.color_attributes['Surface tint']
            for face in obj.data.polygons:
                if obj.data.materials[face.material_index].get('constructionRole') != 'Roof':
                    continue
                for index in face.loop_indices:
                    original = tint.data[index].color
                    tint.data[index].color = (*[original[i] * design['roofTint'][i] for i in range(3)], 1)
            obj['wonderEntityId'] = design['wonderId']
            obj['wonderArchitecture'] = design['crown']
            obj['wonderPalette'] = design['colors']['name']
        return
    proportions, colors = design['proportions'], design['colors']
    if not (.86 <= proportions['drumHeight'] <= 1.10 and
            .65 <= proportions['domeHeight'] <= 1.12 and .88 <= proportions['width'] <= 1.10):
        raise ValueError('Resolve wonder proportions within the authored bounds')
    editable = list(bpy.data.collections['CITADEL_EDITABLE'].objects)
    for obj in objects + editable:
        tint_wonder_mesh(obj, colors)
        deform_wonder_mesh(obj, proportions)
    material = bpy.data.materials['Citadel / Refined essence']
    material.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (*colors['crystal'], 1)
    for obj in objects:
        obj['wonderEntityId'] = design['wonderId']
        obj['wonderPalette'] = colors['name']
        obj['wonderProportions'] = proportions


def export(output, design=None):
    if Path(bpy.data.filepath).resolve() == CANVAS_SOURCE.resolve():
        spec = importlib.util.spec_from_file_location('prepare_canvas_settlement', Path(__file__).with_name('prepare-canvas-settlement.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.prepare()
    objects = production_meshes(design['crown'] if design else None)
    if 'citadelTier' in bpy.context.scene:
        for obj in objects:
            obj['citadelTier'] = bpy.context.scene['citadelTier']
    if design:
        apply_wonder_design(objects, design)
    summary = {**validate_geometry(objects), **validate_materials(objects)}
    if tier_contract()['age'] == 4:
        summary.update({**validate_curtain_height(objects), **validate_order_and_essence(objects), **validate_attachments()})
    else:
        surfaces = validate_order_surfaces(objects)
        summary.update({**validate_age(objects), 'orderSurfaces': sorted(surfaces)})
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.hide_render = False
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format='GLB', use_selection=True,
        export_yup=True, export_extras=True, export_attributes=True, export_materials='EXPORT',
        export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_animations=False,
        export_cameras=False, export_lights=False, export_morph=False,
        export_draco_mesh_compression_enable=False,
    )
    print(json.dumps({**summary, 'output': str(output), 'bytes': output.stat().st_size}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--design', type=Path, help='Seeded wonder descriptor written by the family exporter')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    export(args.output.resolve(), json.loads(args.design.read_text()) if args.design else None)
