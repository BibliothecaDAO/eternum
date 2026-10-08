"""Read-only, collection-scoped geometry evidence, executed inside Blender.

Python: review_collection('Asset', '/new/review-directory', render=False)
CLI: blender --background source.blend --python blender_review.py -- \
         --collection Asset --output /new/review-directory [--no-render]

Default coordinates are Blender Z-up, -Y-front. Every orthographic image uses
one shared scale and original evaluated geometry at the current frame. This is
geometry evidence, not animation review or an automatic visual acceptance gate.
A saved .blend hash is reported separately from live evaluated geometry and never
qualifies a live capture for exact-source reuse by itself.
Source geometry, materials, transforms and selection are never saved or edited.
A requested frame is temporarily evaluated and the original scene frame restored. Temporary datablocks are removed even if audit/rendering fails. Existing
output directories are refused; an interrupted run retains its partial evidence.
"""

import argparse
import hashlib
import html
import json
import math
import struct
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector


GEOMETRY_TYPES = {'MESH', 'CURVE', 'SURFACE', 'FONT', 'META'}
AXES = {'X': (1, 0, 0), 'Y': (0, 1, 0), 'Z': (0, 0, 1)}
VIEW_NAMES = ('front', 'back', 'left', 'right', 'top', 'bottom', 'elevated-front', 'elevated-rear')
MATERIAL_MODES = ('material', 'clay')


def review_collection(collection_name, output_dir, *, render=True, forward='-Y',
                      up='Z', resolution=768, max_samples=100, framing=None,
                      views=None, modes=None, frame=None):
    """Audit evaluated geometry and capture selected views without saving source edits.

    Default capture is all eight directions in material and clay (16 images).
    `framing` is a JSON-compatible {'center': [x,y,z], 'orthographic_scale': n}
    shared across candidates. A frame override is restored after evaluation.
    """
    basis = _validate_options(forward, up, resolution, max_samples)
    views = _selection(views, VIEW_NAMES, 'views')
    modes = _selection(modes, MATERIAL_MODES, 'modes')
    framing = _validate_framing(framing)
    sources = _resolve_collection(collection_name)
    source_scene = bpy.context.scene
    original_frame = source_scene.frame_current
    source_dirty_reported = bool(bpy.data.is_dirty)
    if frame is not None and not isinstance(frame, int):
        raise ValueError('frame must be an integer')
    output = Path(output_dir).expanduser().resolve()
    output.mkdir(parents=True, exist_ok=False)
    owned = []
    try:
        if frame is not None:
            source_scene.frame_set(frame)
        scene = _create_scene(owned)
        objects = _copy_evaluated_geometry(sources, scene, owned)
        bounds = _world_bounds(objects)
        if framing is None:
            framing = _framing_from_bounds(bounds)
        report = _build_report(collection_name, objects, bounds, basis, max_samples)
        report['frame'] = source_scene.frame_current
        report['framing'] = framing
        report['capture_selection'] = {'views': views, 'modes': modes}
        report['source_saved_sha256'] = _saved_source_hash()
        report['source_dirty_reported'] = source_dirty_reported
        report['evaluated_geometry_sha256'] = _evaluated_geometry_hash(objects)
        # Blender's dirty flag does not reliably record direct Python mesh writes.
        # A saved-file hash alone cannot certify what the live dependency graph rendered.
        report['exact_source_reuse_eligible'] = False
        report['source_reuse_note'] = (
            'Saved .blend hash identifies only disk bytes. Evaluated geometry hash identifies this capture; '
            'neither proves material state or that the live scene matches the saved file. '
            'Rebuild from immutable inputs and compare the capture fingerprint before reusing evidence.'
        )
        _write_report(output, report)
        if render:
            report['images'] = _capture_views(scene, bounds, basis, output, resolution,
                                              owned, framing, views, modes)
            report['render_status'] = 'captured; human inspection pending'
            _write_report(output, report)
        _write_index(output, report)
        return report
    finally:
        try:
            _remove_owned_datablocks(owned)
        finally:
            if source_scene.frame_current != original_frame:
                source_scene.frame_set(original_frame)


def _selection(values, allowed, label):
    if values is None:
        return list(allowed)
    if isinstance(values, str):
        values = values.split(',')
    selected = list(values)
    if not selected or len(selected) != len(set(selected)) or any(item not in allowed for item in selected):
        raise ValueError(f'{label} must contain unique values from: ' + ', '.join(allowed))
    return selected


def _validate_framing(framing):
    if framing is None:
        return None
    if isinstance(framing, (str, Path)):
        framing = json.loads(Path(framing).read_text(encoding='utf-8'))
    if not isinstance(framing, dict) or set(framing) != {'center', 'orthographic_scale'}:
        raise ValueError('framing requires center and orthographic_scale')
    center, scale = framing['center'], framing['orthographic_scale']
    if not isinstance(center, list) or len(center) != 3 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in center):
        raise ValueError('framing center requires three finite coordinates')
    if not isinstance(scale, (int, float)) or not math.isfinite(scale) or scale <= 0:
        raise ValueError('framing orthographic_scale must be positive and finite')
    return {'center': [float(v) for v in center], 'orthographic_scale': float(scale)}


def _framing_from_bounds(bounds):
    return {'center': _position((bounds[0] + bounds[1]) * 0.5),
            'orthographic_scale': max((bounds[1] - bounds[0]).length, 1e-5) * 1.15}


def _saved_source_hash():
    path = Path(bpy.data.filepath)
    if not bpy.data.filepath or not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def _evaluated_geometry_hash(objects):
    """Fingerprint evaluated world-space geometry, independent of saved-file status.

    This covers vertices, polygons and object transforms. It does not fingerprint
    materials, UVs, armatures or renderer state, so it is not a visual cache key.
    """
    object_hashes = []
    for obj in objects:
        digest = hashlib.sha256()
        digest.update(obj['review_source'].encode('utf-8'))
        digest.update(b'\0instance=' + (b'1' if obj['review_instance'] else b'0'))
        for row in obj.matrix_world:
            digest.update(struct.pack('<4d', *row))
        for vertex in obj.data.vertices:
            digest.update(struct.pack('<3d', *vertex.co))
        for polygon in obj.data.polygons:
            digest.update(struct.pack('<II', len(polygon.vertices), polygon.material_index))
            for index in polygon.vertices:
                digest.update(struct.pack('<I', index))
        object_hashes.append(digest.digest())
    aggregate = hashlib.sha256()
    for digest in sorted(object_hashes):
        aggregate.update(digest)
    return aggregate.hexdigest()


def _write_index(output, report):
    items = ''.join('<figure><a href="' + html.escape(item['file'], quote=True) + '"><img src="' +
                    html.escape(item['file'], quote=True) + '"></a><figcaption>' +
                    html.escape(item['view'] + ' / ' + item['mode']) + '</figcaption></figure>'
                    for item in report['images'])
    summary = {'source_saved_sha256': report['source_saved_sha256'],
               'source_dirty_reported': report['source_dirty_reported'],
               'evaluated_geometry_sha256': report['evaluated_geometry_sha256'],
               'exact_source_reuse_eligible': report['exact_source_reuse_eligible'],
               'source_reuse_note': report['source_reuse_note'], 'frame': report['frame'],
               'framing': report['framing'], 'capture_selection': report['capture_selection'],
               'visual_inspection_status': report['visual_inspection_status'],
               'objects': len(report['objects']),
               'finding_counts': {key: sum(obj[key]['count'] for obj in report['objects'])
                                  for key in ('boundary_edges', 'non_manifold_edges',
                                              'degenerate_edges', 'degenerate_faces')}}
    (output / 'review.html').write_text('<!doctype html><meta charset="utf-8"><title>Geometry review</title>'
                                       '<style>body{font:14px sans-serif;background:#222;color:#eee}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}img{width:100%}figure{margin:8px}</style>'
                                       '<pre>' + html.escape(json.dumps(summary, indent=2)) + '</pre><main>' +
                                       items + '</main>', encoding='utf-8')


def _validate_options(forward, up, resolution, max_samples):
    def axis(label):
        sign = -1 if label.startswith('-') else 1
        key = label.lstrip('+-')
        if key not in AXES or label not in (key, '+' + key, '-' + key):
            raise ValueError('Axes must be X, Y, Z, +X, -X, +Y, -Y, +Z, or -Z')
        return Vector(AXES[key]) * sign
    front, vertical = axis(forward), axis(up)
    if abs(front.dot(vertical)) > 0.001:
        raise ValueError('Forward and up axes must be perpendicular')
    if not isinstance(resolution, int) or not 64 <= resolution <= 4096:
        raise ValueError('resolution must be an integer between 64 and 4096')
    if not isinstance(max_samples, int) or not 1 <= max_samples <= 10000:
        raise ValueError('max_samples must be an integer between 1 and 10000')
    return {'front': front, 'up': vertical, 'right': vertical.cross(front),
            'forward_label': forward, 'up_label': up}


def _resolve_collection(name):
    if not isinstance(name, str) or not name.strip():
        raise ValueError('An explicit asset collection name is required')
    collection = bpy.data.collections.get(name)
    if collection is None:
        raise ValueError('Asset collection does not exist: ' + name)
    objects = set(collection.all_objects)
    if not objects:
        raise ValueError('Asset collection is empty: ' + name)
    unsupported = [obj.name for obj in objects if obj.type in {'VOLUME', 'POINTCLOUD', 'CURVES', 'GREASEPENCIL', 'GPENCIL'}]
    if unsupported:
        raise ValueError('Unsupported geometry cannot be silently omitted: ' + ', '.join(unsupported))
    outside = [obj.name for obj in objects if obj.name not in bpy.context.scene.objects]
    if outside:
        raise ValueError('Asset objects must belong to the current scene: ' + ', '.join(outside))
    return objects


def _own(owned, datablocks, item):
    owned.append((datablocks, item))
    return item


def _create_scene(owned):
    return _own(owned, bpy.data.scenes, bpy.data.scenes.new('__geometry_review__'))


def _copy_evaluated_geometry(sources, scene, owned):
    graph = bpy.context.evaluated_depsgraph_get()
    copies = []
    represented = set()
    for instance in graph.object_instances:
        original = instance.object.original
        parent = instance.parent.original if instance.parent else None
        belongs = parent in sources if instance.is_instance else original in sources
        if not belongs:
            continue
        if instance.object.type not in GEOMETRY_TYPES:
            continue
        mesh = bpy.data.meshes.new_from_object(instance.object, preserve_all_data_layers=True,
                                               depsgraph=graph)
        _own(owned, bpy.data.meshes, mesh)
        obj = _own(owned, bpy.data.objects, bpy.data.objects.new('__review__' + original.name, mesh))
        scene.collection.objects.link(obj)
        obj.matrix_world = instance.matrix_world.copy()
        # Object-linked overrides are separate from mesh material slots.
        for target, source in zip(obj.material_slots, instance.object.material_slots):
            if source.link == 'OBJECT':
                target.link = 'OBJECT'
                target.material = source.material
        obj['review_source'] = original.name
        obj['review_instance'] = bool(instance.is_instance)
        copies.append(obj)
        represented.add(original)
        if parent:
            represented.add(parent)
    missing = [obj.name for obj in sources if obj.type in GEOMETRY_TYPES and obj not in represented]
    if missing:
        raise ValueError('Geometry excluded from dependency graph; cannot silently omit: ' + ', '.join(missing))
    if not copies or not any(len(obj.data.vertices) for obj in copies):
        raise ValueError('The collection has no evaluated mesh geometry')
    return copies


def _world_bounds(objects):
    minimum = Vector((math.inf,) * 3)
    maximum = Vector((-math.inf,) * 3)
    for obj in objects:
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            if not all(math.isfinite(value) for value in point):
                raise ValueError('Non-finite evaluated geometry: ' + obj['review_source'])
            for axis in range(3):
                minimum[axis] = min(minimum[axis], point[axis])
                maximum[axis] = max(maximum[axis], point[axis])
    return minimum, maximum


def _position(point):
    return [float(value) for value in point]


def _finding(items, max_samples):
    count, samples = 0, []
    for item in items:
        count += 1
        if len(samples) < max_samples:
            samples.append(item)
    return {'count': count, 'samples': samples, 'samples_truncated': count > max_samples}


def _audit_mesh(obj, tolerance, max_samples):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(obj.data)
        mesh.transform(obj.matrix_world)
        mesh.verts.index_update()
        mesh.edges.index_update()
        mesh.faces.index_update()
        def edge_record(edge):
            return {'edge': edge.index, 'position': _position(sum((v.co for v in edge.verts), Vector()) / 2),
                    'endpoints': [_position(v.co) for v in edge.verts], 'face_count': len(edge.link_faces)}
        boundary = (edge_record(e) for e in mesh.edges if e.is_boundary)
        nonmanifold = (edge_record(e) for e in mesh.edges if not e.is_manifold)
        wire = (edge_record(e) for e in mesh.edges if e.is_wire)
        degenerate_edges = (edge_record(e) for e in mesh.edges if e.calc_length() <= tolerance)
        degenerate_faces = ({'face': f.index, 'position': _position(f.calc_center_median()),
                             'area': f.calc_area()} for f in mesh.faces if f.calc_area() <= tolerance ** 2)
        inconsistent = (edge_record(e) for e in mesh.edges if e.is_manifold and not e.is_contiguous)
        isolated = ({'vertex': v.index, 'position': _position(v.co)} for v in mesh.verts if not v.link_edges)
        components = _connected_components(mesh)
        return {'source_object': obj['review_source'], 'instance': obj['review_instance'],
                'matrix_world': [list(row) for row in obj.matrix_world],
                'vertices': len(mesh.verts), 'edges': len(mesh.edges), 'faces': len(mesh.faces),
                'boundary_edges': _finding(boundary, max_samples),
                'non_manifold_edges': _finding(nonmanifold, max_samples),
                'wire_edges': _finding(wire, max_samples),
                'degenerate_edges': _finding(degenerate_edges, max_samples),
                'degenerate_faces': _finding(degenerate_faces, max_samples),
                'inconsistent_winding_edges': _finding(inconsistent, max_samples),
                'isolated_vertices': _finding(isolated, max_samples),
                'connected_components': _finding(components, max_samples)}
    finally:
        mesh.free()


def _connected_components(mesh):
    unseen = set(mesh.verts)
    for seed in mesh.verts:
        if seed not in unseen:
            continue
        unseen.remove(seed)
        pending, vertices = [seed], []
        while pending:
            vertex = pending.pop()
            vertices.append(vertex)
            for edge in vertex.link_edges:
                neighbor = edge.other_vert(vertex)
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    pending.append(neighbor)
        minimum = [min(v.co[axis] for v in vertices) for axis in range(3)]
        maximum = [max(v.co[axis] for v in vertices) for axis in range(3)]
        yield {'vertex_count': len(vertices), 'first_vertex': min(v.index for v in vertices),
               'position': _position(sum((v.co for v in vertices), Vector()) / len(vertices)),
               'bounds_min': minimum, 'bounds_max': maximum}


def _build_report(name, objects, bounds, basis, max_samples):
    minimum, maximum = bounds
    tolerance = max((maximum - minimum).length * 1e-7, 1e-10)
    return {'schema_version': 2, 'collection': name, 'source_file': bpy.data.filepath,
            'source_scene': bpy.context.scene.name, 'frame': bpy.context.scene.frame_current,
            'geometry': 'evaluated current-frame meshes and dependency-graph instances',
            'coordinate_space': 'world', 'forward': basis['forward_label'], 'up': basis['up_label'],
            'bounds_min': _position(minimum), 'bounds_max': _position(maximum),
            'degenerate_length_tolerance': tolerance, 'degenerate_area_tolerance': tolerance ** 2,
            'interpretation': ['Findings require human review; intentional seams/openings and separate components are legal.',
                               'Non-manifold counts include boundary and wire edges; categories overlap.',
                               'Components use vertex-edge connectivity per evaluated object; no welding is performed.',
                               'A closed topology does not prove correct shape, normals, lack of intersections, or visual quality.',
                               'Material views use neutral review lighting; scene-dependent shaders may differ.'],
            'objects': [_audit_mesh(obj, tolerance, max_samples) for obj in objects],
            'images': [], 'render_status': 'not requested or not completed',
            'visual_inspection_status': 'pending; image capture is not visual inspection'}


def _write_report(output, report):
    # Only this run's newly reserved output directory is written.
    (output / 'topology.json').write_text(json.dumps(report, indent=2, allow_nan=False) + '\n', encoding='utf-8')


def _select_render_engine(scene):
    # Blender 5 uses EEVEE; 4.2–4.5 used EEVEE_NEXT. Assignment queries the
    # registered engines correctly even when static RNA enum metadata does not.
    for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            scene.render.engine = engine
            return
        except (TypeError, ValueError):
            continue
    raise RuntimeError('No supported EEVEE engine is registered in this Blender build')


def _configure_render_scene(scene, bounds, resolution, owned):
    _select_render_engine(scene)
    scene.render.resolution_x = scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.world = _own(owned, bpy.data.worlds, bpy.data.worlds.new('__review_world__'))
    scene.world.use_nodes = True
    background = next(node for node in scene.world.node_tree.nodes if node.type == 'BACKGROUND')
    background.inputs['Color'].default_value = (0.12, 0.12, 0.12, 1)
    background.inputs['Strength'].default_value = 0.5
    camera_data = _own(owned, bpy.data.cameras, bpy.data.cameras.new('__review_camera__'))
    camera = _own(owned, bpy.data.objects, bpy.data.objects.new('__review_camera__', camera_data))
    scene.collection.objects.link(camera)
    scene.camera = camera
    diagonal = max((bounds[1] - bounds[0]).length, 1e-5)
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = diagonal * 1.15
    camera_data.clip_start = max(diagonal * 0.001, 1e-6)
    camera_data.clip_end = diagonal * 20
    light_data = _own(owned, bpy.data.lights, bpy.data.lights.new('__review_light__', 'AREA'))
    light = _own(owned, bpy.data.objects, bpy.data.objects.new('__review_light__', light_data))
    scene.collection.objects.link(light)
    light_data.energy = 60 * diagonal ** 2
    light_data.shape = 'DISK'
    light_data.size = diagonal * 2
    clay = _own(owned, bpy.data.materials, bpy.data.materials.new('__review_clay__'))
    clay.use_nodes = True
    shader = next(node for node in clay.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (0.55, 0.55, 0.55, 1)
    shader.inputs['Roughness'].default_value = 0.8
    return camera, light, clay, diagonal


def _view_directions(basis):
    front, up, right = basis['front'], basis['up'], basis['right']
    return [('front', front, up), ('back', -front, up), ('left', -right, up),
            ('right', right, up), ('top', up, -front), ('bottom', -up, front),
            ('elevated-front', (front + up).normalized(), up),
            ('elevated-rear', (-front + up).normalized(), up)]


def _aim(object_, center, screen_up):
    direction = (object_.location - center).normalized()
    right = screen_up.cross(direction).normalized()
    vertical = direction.cross(right).normalized()
    from mathutils import Matrix
    object_.rotation_euler = Matrix((right, vertical, direction)).transposed().to_euler()


def _capture_views(scene, bounds, basis, output, resolution, owned, framing, views, modes):
    camera, light, clay, diagonal = _configure_render_scene(scene, bounds, resolution, owned)
    center = Vector(framing['center'])
    camera.data.ortho_scale = framing['orthographic_scale']
    diagonal = max(diagonal, framing['orthographic_scale'])
    camera.data.clip_end = diagonal * 20
    images = []
    for name, direction, vertical in _view_directions(basis):
        if name not in views:
            continue
        camera.location = center + direction * diagonal * 3
        _aim(camera, center, vertical)
        light.location = center + direction * diagonal * 2 + vertical * diagonal
        _aim(light, center, vertical)
        for material_mode in modes:
            scene.view_layers[0].material_override = clay if material_mode == 'clay' else None
            filename = f'{name}-{material_mode}.png'
            scene.render.filepath = str(output / filename)
            # This temporary scene is deliberately inactive. Its dependency graph
            # must receive camera/light transforms before each render invocation.
            scene.view_layers[0].update()
            bpy.ops.render.render(write_still=True, scene=scene.name)
            images.append({'file': filename, 'view': name, 'mode': material_mode,
                           'render_engine': scene.render.engine,
                           'orthographic_scale': camera.data.ortho_scale,
                           'camera_world_position': _position(camera.location),
                           'camera_matrix_world': [list(row) for row in camera.matrix_world]})
    return images


def _remove_owned_datablocks(owned):
    # Reverse creation order removes objects before their meshes, and scene last.
    for datablocks, item in reversed(owned):
        datablocks.remove(item, do_unlink=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--collection', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--forward', default='-Y')
    parser.add_argument('--up', default='Z')
    parser.add_argument('--resolution', type=int, default=768)
    parser.add_argument('--max-samples', type=int, default=100)
    parser.add_argument('--no-render', action='store_true')
    parser.add_argument('--framing', help='JSON file with shared center and orthographic_scale')
    parser.add_argument('--views', help='comma-separated named views; default all eight')
    parser.add_argument('--modes', help='comma-separated material,clay; default both')
    parser.add_argument('--frame', type=int, help='evaluate this frame, then restore source frame')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    report = review_collection(args.collection, args.output, render=not args.no_render,
                               forward=args.forward, up=args.up, resolution=args.resolution,
                               max_samples=args.max_samples, framing=args.framing,
                               views=args.views, modes=args.modes, frame=args.frame)
    print(json.dumps({'collection': report['collection'], 'objects': len(report['objects']),
                      'images': len(report['images']), 'output': args.output,
                      'visual_inspection_status': report['visual_inspection_status'],
                      'source_dirty_reported': report['source_dirty_reported'],
                      'exact_source_reuse_eligible': report['exact_source_reuse_eligible']}))


if __name__ == '__main__':
    main()
