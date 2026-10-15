"""Construction checks for age-specific sources, without imposing imperial architecture on a timber settlement."""
import math
import bmesh
import bpy
from mathutils import Vector


def validate_age(objects, contract):
    editable = list(bpy.data.collections['CITADEL_EDITABLE'].objects)
    names = [o.name for o in editable]
    age = contract['age']
    wonder = bpy.context.scene.get('citadelWonder', False)
    if any(name.startswith(('Palace /', 'Sanctum /', 'Fore bastion /')) for name in names):
        raise ValueError('Build this age with its own construction; do not scale imperial palace parts')
    required = {(1, False): ['Hall thatch roof', 'West croft', 'East croft'],
                (2, False): ['Civic hall / first stone storey', 'Civic hall / timber upper storey', 'Market /'],
                (3, False): ['Royal donjon masonry', 'Donjon crown roof', 'Castle / west round tower'],
                (1, True): ['Sacred grove / rough monolith', 'Timber sanctuary'],
                (2, True): ['Temple / portico shaft', 'Temple / terracotta pediment roof'],
                (3, True): ['Basilica / long nave', 'Basilica / square bell tower', 'Basilica / high slate nave roof']}[(age, wonder)]
    if any(not any(name.startswith(prefix) for name in names) for prefix in required):
        raise ValueError('Restore the authored age silhouette: ' + ', '.join(required))
    timber = [o for o in editable if o.name.startswith('Palisade / split timber')]
    stone = [o for o in editable if o.name.startswith('Curtain / dressed core')]
    if age < 3 and (len(timber) < 100 or stone):
        raise ValueError('Early ages need a timber palisade, not a scaled stone curtain')
    if age == 3 and (len(stone) != 6 or timber):
        raise ValueError('Kingdom needs six dressed stone curtains')
    for obj in stone:
        if any(v.co.x * math.cos(i * math.pi / 3) + v.co.y * math.sin(i * math.pi / 3) > math.sqrt(3) / 2 - .0025 for v in obj.data.vertices for i in range(6)):
            raise ValueError('Recess the mortar core behind the boundary stones; coplanar surfaces flicker')
    defenses = timber if age < 3 else [o for o in editable if o.name.startswith('Curtain / level merlon')]
    tops = [max(v.co.z for v in o.data.vertices) for o in defenses]
    if max(tops) - min(tops) > .00001:
        raise ValueError('Keep the complete defensive perimeter at one battlement or stake height')
    intervals = [[] for _ in range(6)]
    for obj in objects:
        for face in obj.data.polygons:
            vertices = [obj.data.vertices[i].co for i in face.vertices]
            if face.normal.z > .99 and max(v.z for v in vertices) < .15 and face.area > .7:
                raise ValueError('The terrain owns the ground; remove broad support slabs')
            if max(v.z for v in vertices) < .2:
                continue
            for edge in range(6):
                nx, ny = math.cos(edge * math.pi / 3), math.sin(edge * math.pi / 3)
                if all(abs(v.x * nx + v.y * ny - math.sqrt(3) / 2) < .00001 for v in vertices):
                    along = [-v.x * ny + v.y * nx for v in vertices]
                    intervals[edge].append((min(along), max(along)))
    coverage = []
    for edge in intervals:
        end, length = -math.inf, 0.
        for low, high in sorted(edge):
            length += max(0., high - max(low, end))
            end = max(end, high)
        coverage.append(length)
    if min(coverage) < .65:
        raise ValueError('Keep the palisade or curtain outer faces on all six radius-one hex edges')
    roofs = [o for o in editable if o.name.endswith(' roof')]
    for obj in roofs:
        validate_roof(obj)
    if not roofs:
        raise ValueError('Retain the age-specific authored roofs')
    for obj in objects:
        for material in obj.data.materials:
            shader = material.node_tree.nodes.get('Principled BSDF')
            if shader and shader.inputs['Emission Strength'].default_value > 1:
                raise ValueError('Reserve mastered HDR teal essence for the approved empire')
    architecture = next(obj for obj in objects if not obj.get('citadelOrderSurface'))
    hit, point, _, face = architecture.ray_cast(Vector((.03, -1.2, .20)), Vector((0, 1, 0)))
    material = architecture.data.materials[architecture.data.polygons[face].material_index] if hit else None
    if not material or material.get('constructionRole') not in ('Timber', 'Dark details') or point.y > -.80:
        raise ValueError('Expose the actual oak door through the front-corner gate passage')
    for obj in objects:
        if obj.get('citadelOrderSurface') == 'gate' and any(v.co.y > -.90 or abs(v.co.x) > .11 for v in obj.data.vertices):
            raise ValueError('Keep the Order imprint on the front-corner gate')
    cloth = next(o for o in editable if o.get('citadelOrderSurface') == 'cloth')
    bar = next(o for o in editable if o.name == 'Banner / anchored crossbar')
    top = max(v.co.z for v in cloth.data.vertices)
    if min(abs(v.co.z - top) for v in bar.data.vertices) > .02:
        raise ValueError('Suspend the Order cloth from its physical crossbar')
    return {'constructionAge': age, 'wonder': wonder, 'defense': contract['defense'],
            'levelPerimeterTop': tops[0], 'boundaryFaceLengths': coverage, 'outwardRoofs': len(roofs)}


def validate_roof(obj):
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    closed = all(edge.is_manifold for edge in mesh.edges)
    volume = mesh.calc_volume(signed=True)
    mesh.free()
    if not closed or volume <= 0:
        raise ValueError(f'{obj.name}: author a closed outward-facing roof; inward winding invalidates the silhouette')
