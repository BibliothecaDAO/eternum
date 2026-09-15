"""Export only baked static production meshes from the open representative source."""
import bpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
APP = ROOT / 'apps/game'
SOURCE = APP / 'asset-sources/ethereal/bitcoin-mine/bitcoin-mine.blend'
if Path(bpy.data.filepath).resolve() != SOURCE.resolve():
    raise RuntimeError('Open bitcoin-mine.blend before exporting')
output = APP / 'public/models/ethereal/bitcoin-mine.glb'
if '--' in sys.argv:
    arguments = sys.argv[sys.argv.index('--') + 1:]
    if arguments:
        output = Path(arguments[0]).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
objects = list(bpy.data.collections['BITCOIN_MINE_PRODUCTION'].objects)
if len(objects) != 6 or any(obj.name.startswith('land /') for obj in objects):
    raise RuntimeError('Export requires the six base-free mine material groups; terrain owns the support surface')
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    if obj.type != 'MESH' or obj.parent or any(abs(obj.matrix_world[r][c] - (r == c)) > 1e-6 for r in range(4) for c in range(4)):
        raise RuntimeError(f'{obj.name}: instancing requires baked identity mesh nodes')
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True, export_yup=True,
    export_materials='EXPORT', export_vertex_color='ACTIVE', export_all_vertex_colors=False,
    export_animations=False, export_cameras=False, export_lights=False, export_extras=False,
    export_morph=False, export_draco_mesh_compression_enable=False)
print(f'Exported {output}')
