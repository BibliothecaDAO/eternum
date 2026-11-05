"""Controlled Blender-native fixtures. Never run against a live asset session.

blender --background --factory-startup --python test_blender_review.py
Add `-- --render-smoke` to capture the closed cuboid's full 16-image packet.
Add `--evidence-dir /new/output` after `--render-smoke` to retain that packet
and the open-top topology report only after all fixtures succeed. Existing
output directories are refused. Fixture objects remain isolated in this process.
"""

import argparse
import importlib.util
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile

import bpy


spec = importlib.util.spec_from_file_location('blender_review', Path(__file__).with_name('blender_review.py'))
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)

VERTICES = [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
            (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]
FACES = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
         (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]


def fixture(name, vertices=VERTICES, faces=FACES, edges=()):
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, edges, faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return collection, obj


def state_snapshot():
    # Includes source topology, material references, transforms, viewport state,
    # scene camera/settings and the datablock inventory (detects leaked helpers).
    return {
        'inventory': {key: sorted(item.name for item in getattr(bpy.data, key))
                      for key in ('objects', 'meshes', 'scenes', 'cameras', 'lights',
                                  'materials', 'worlds', 'collections')},
        'context': (bpy.context.scene.name, bpy.context.mode,
                    bpy.context.view_layer.objects.active.name if bpy.context.view_layer.objects.active else None,
                    sorted(o.name for o in bpy.context.selected_objects)),
        'objects': {o.name: (o.type, tuple(tuple(row) for row in o.matrix_world),
                             o.hide_viewport, o.hide_render, o.hide_get(),
                             tuple((m.link, m.material.name if m.material else None) for m in o.material_slots),
                             tuple((m.name, m.type, m.show_viewport, m.show_render) for m in o.modifiers))
                    for o in bpy.context.scene.objects},
        'meshes': {m.name: (tuple(tuple(v.co) for v in m.vertices),
                            tuple(tuple(e.vertices) for e in m.edges),
                            tuple(tuple(p.vertices) for p in m.polygons),
                            tuple(mat.name if mat else None for mat in m.materials)) for m in bpy.data.meshes},
        'materials': {m.name: (tuple(m.diffuse_color), m.use_nodes,
                              tuple((n.name, tuple(n.inputs['Base Color'].default_value),
                                     n.inputs['Roughness'].default_value)
                                    for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
                              if m.node_tree else ()) for m in bpy.data.materials},
        'scene': (bpy.context.scene.frame_current, bpy.context.scene.render.engine,
                  bpy.context.scene.render.filepath,
                  bpy.context.scene.camera.name if bpy.context.scene.camera else None,
                  bpy.context.scene.world.name if bpy.context.scene.world else None),
    }


def require_raises(exception, action):
    try:
        action()
    except exception:
        return
    raise AssertionError('Expected ' + exception.__name__)


def assert_material_clay_differ(output, images):
    for view in {item['view'] for item in images}:
        pixels = []
        for mode in ('material', 'clay'):
            image = bpy.data.images.load(str(output / f'{view}-{mode}.png'), check_existing=False)
            try:
                pixels.append(tuple(image.pixels))
            finally:
                bpy.data.images.remove(image)
        difference = sum(abs(a - b) for a, b in zip(*pixels)) / len(pixels[0])
        assert difference > 0.001, f'{view}: material and clay captures do not differ ({difference})'


def material_silhouette(output, view):
    image = bpy.data.images.load(str(output / f'{view}-material.png'), check_existing=False)
    try:
        width, height = image.size
        pixels = tuple(image.pixels)
    finally:
        bpy.data.images.remove(image)
    points = []
    for index in range(width * height):
        red, green, blue = pixels[index * 4:index * 4 + 3]
        if blue - red > 0.04 and blue - green > 0.04:
            points.append((index % width, index // width))
    assert len(points) > width * height * 0.03, f'{view}: blue fixture silhouette missing or washed out'
    return (max(x for x, y in points) - min(x for x, y in points) + 1,
            max(y for x, y in points) - min(y for x, y in points) + 1)


def assert_view_silhouettes(output):
    front = material_silhouette(output, 'front')
    right = material_silhouette(output, 'right')
    top = material_silhouette(output, 'top')
    elevated = material_silhouette(output, 'elevated-front')
    assert abs(front[0] - elevated[0]) <= 3, (front, elevated)
    assert elevated[1] > front[1] * 1.3, f'Elevated camera was not evaluated: {front}, {elevated}'
    assert top[1] > front[1] * 1.2, f'Top camera was not evaluated: {front}, {top}'
    assert right[0] < front[0] * 0.8, f'Right camera was not evaluated: {front}, {right}'
    return {'front': front, 'right': right, 'top': top, 'elevated-front': elevated}


def fixture_options():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--render-smoke', action='store_true')
    parser.add_argument('--evidence-dir', type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if args.evidence_dir:
        if not args.render_smoke:
            parser.error('--evidence-dir requires --render-smoke')
        args.evidence_dir = args.evidence_dir.expanduser().resolve()
        if args.evidence_dir.exists():
            raise FileExistsError(args.evidence_dir)
    return args


def retain_evidence(root, destination):
    destination.mkdir(parents=True, exist_ok=False)
    shutil.copytree(root / 'rendered', destination / 'rendered')
    shutil.copy2(root / 'open' / 'topology.json', destination / 'open-top-topology.json')


def main():
    options = fixture_options()
    if not bpy.app.background:
        raise RuntimeError('Fixtures must run in an isolated background Blender process')
    # Distinct dimensions make top/right/elevated silhouettes independently testable.
    cuboid_vertices = [(x * 1.5, y, z * 0.7) for x, y, z in VERTICES]
    closed, cube = fixture('__fixture_closed__', vertices=cuboid_vertices)
    opened, open_cube = fixture('__fixture_open_top__', faces=[face for i, face in enumerate(FACES) if i != 1])
    open_cube.location = (3, 2, 4)
    defects, _ = fixture('__fixture_defects__', vertices=[(0, 0, 0), (0, 0, 0), (2, 0, 0), (3, 0, 0),
                                                        (5, 0, 0), (6, 0, 0), (7, 0, 0)],
                         edges=[(0, 1), (2, 3)], faces=[(4, 5, 6)])
    material = bpy.data.materials.new('__fixture_material__')
    material.diffuse_color = (0.02, 0.1, 0.8, 1)
    material.use_nodes = True
    shader = next(node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = material.diffuse_color
    shader.inputs['Roughness'].default_value = 0.6
    cube.data.materials.append(material)
    bpy.context.view_layer.update()
    before = state_snapshot()
    with tempfile.TemporaryDirectory(prefix='blender-review-fixture-') as temporary:
        root = Path(temporary)
        closed_report = review.review_collection(closed.name, root / 'closed', render=False)
        assert len(closed_report['objects']) == 1, 'Unrelated objects entered the report'
        closed_mesh = closed_report['objects'][0]
        for field in ('boundary_edges', 'non_manifold_edges', 'wire_edges', 'degenerate_edges', 'degenerate_faces'):
            assert closed_mesh[field]['count'] == 0, (field, closed_mesh[field])
        assert closed_mesh['connected_components']['count'] == 1
        assert state_snapshot() == before, 'Source changed during no-render review'
        open_report = review.review_collection(opened.name, root / 'open', render=False)
        boundaries = open_report['objects'][0]['boundary_edges']
        assert boundaries['count'] == 4, boundaries
        assert all(abs(sample['position'][2] - 5) < 1e-6 for sample in boundaries['samples'])
        assert open_report['images'] == []
        assert 'pending' in open_report['visual_inspection_status']
        assert state_snapshot() == before, 'Source changed during missing-top audit'
        shared = closed_report['framing']
        selected = review.review_collection(opened.name, root / 'selected', render=False,
                                            framing=shared, views=['front', 'top'],
                                            modes=['material'], frame=3)
        assert selected['frame'] == 3
        assert selected['framing'] == shared
        assert selected['capture_selection'] == {'views': ['front', 'top'], 'modes': ['material']}
        assert (root / 'selected' / 'review.html').is_file()
        assert state_snapshot() == before, 'Frame selection changed the source scene'
        require_raises(ValueError, lambda: review.review_collection(closed.name, root / 'bad-view',
                       render=False, views=['front', 'front']))
        require_raises(ValueError, lambda: review.review_collection(closed.name, root / 'bad-framing',
                       render=False, framing={'center': [0, 0, 0], 'orthographic_scale': 0}))

        defect_report = review.review_collection(defects.name, root / 'defects', render=False, max_samples=1)
        defect_mesh = defect_report['objects'][0]
        assert defect_mesh['wire_edges']['count'] == 2
        assert defect_mesh['wire_edges']['samples_truncated']
        assert defect_mesh['degenerate_edges']['count'] == 1
        assert defect_mesh['degenerate_faces']['count'] == 1
        assert defect_mesh['connected_components']['count'] == 3
        assert state_snapshot() == before
        persisted = json.loads((root / 'open' / 'topology.json').read_text())
        assert persisted == open_report
        require_raises(FileExistsError, lambda: review.review_collection(closed.name, root / 'closed', render=False))
        require_raises(ValueError, lambda: review.review_collection('missing collection', root / 'missing', render=False))
        require_raises(ValueError, lambda: review.review_collection(closed.name, root / 'bad-axis', render=False, forward='Z'))
        assert not (root / 'bad-axis').exists()
        capture = review._capture_views
        def fail_after_setup(scene, bounds, basis, output, resolution, owned, framing, views, modes):
            review._configure_render_scene(scene, bounds, resolution, owned)
            raise RuntimeError('Deliberate fixture render failure')
        review._capture_views = fail_after_setup
        try:
            require_raises(RuntimeError, lambda: review.review_collection(closed.name, root / 'failed'))
        finally:
            review._capture_views = capture
        assert state_snapshot() == before, 'Temporary objects leaked or source changed after failure'
        bevel = cube.modifiers.new('__fixture_evaluated_bevel__', 'BEVEL')
        bevel.width = 0.1
        bevel.segments = 2
        bpy.context.view_layer.update()
        modified_before = state_snapshot()
        evaluated = review.review_collection(closed.name, root / 'evaluated', render=False)
        assert evaluated['objects'][0]['vertices'] > len(cube.data.vertices), 'Audit ignored evaluated modifier geometry'
        assert state_snapshot() == modified_before
        cube.modifiers.remove(bevel)
        bpy.context.view_layer.update()
        assert state_snapshot() == before
        directions = {name: direction for name, direction, _ in review._view_directions(review._validate_options('-Y', 'Z', 64, 1))}
        assert tuple(directions['right']) == (1, 0, 0)
        assert tuple(directions['top']) == (0, 0, 1)
        silhouettes = None
        if options.render_smoke:
            rendered = review.review_collection(closed.name, root / 'rendered', resolution=128)
            assert len(rendered['images']) == 16
            targeted = review.review_collection(closed.name, root / 'targeted', resolution=128,
                                                framing=rendered['framing'], views=['front'],
                                                modes=['material'])
            assert len(targeted['images']) == 1
            assert targeted['images'][0]['orthographic_scale'] == rendered['framing']['orthographic_scale']
            assert state_snapshot() == before
            assert len({item['orthographic_scale'] for item in rendered['images']}) == 1
            assert all((root / 'rendered' / item['file']).stat().st_size > 0 for item in rendered['images'])
            assert_material_clay_differ(root / 'rendered', rendered['images'])
            silhouettes = assert_view_silhouettes(root / 'rendered')
            assert state_snapshot() == before, 'Source changed during capture'
        if options.evidence_dir:
            retain_evidence(root, options.evidence_dir)
        saved_blend = root / 'saved-source.blend'
        bpy.ops.wm.save_as_mainfile(filepath=str(saved_blend))
        disk_hash = hashlib.sha256(saved_blend.read_bytes()).hexdigest()
        saved_report = review.review_collection(closed.name, root / 'saved-source', render=False)
        assert saved_report['source_saved_sha256'] == disk_hash
        assert not saved_report['source_dirty_reported']
        assert not saved_report['exact_source_reuse_eligible']
        cube.data.vertices[0].co.x += 0.25  # Direct script edit may bypass Blender's dirty flag.
        cube.data.update()
        bpy.context.view_layer.update()
        unsaved_report = review.review_collection(closed.name, root / 'unsaved-edit', render=False)
        assert unsaved_report['source_saved_sha256'] == disk_hash
        assert unsaved_report['evaluated_geometry_sha256'] != saved_report['evaluated_geometry_sha256']
        assert not unsaved_report['exact_source_reuse_eligible']
        assert 'Saved .blend hash' in unsaved_report['source_reuse_note']
        print('BLENDER_REVIEW_FIXTURES_OK ' + json.dumps({'missing_top_boundary_edges': boundaries['count'],
                                                        'evaluated_vertices': evaluated['objects'][0]['vertices'],
                                                        'render_smoke': options.render_smoke,
                                                        'silhouette_pixel_bounds': silhouettes,
                                                        'evidence_dir': str(options.evidence_dir) if options.evidence_dir else None,
                                                        'human_visual_inspection': 'not performed by fixtures'}))


if __name__ == '__main__':
    main()
