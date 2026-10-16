"""Verify the delivered citadel's geometry and texture budget, without certifying visual quality."""
import argparse
import json
import struct
from pathlib import Path


def read_glb(path):
    data = path.read_bytes()
    if data[:4] != b'glTF' or struct.unpack_from('<I', data, 4)[0] != 2:
        raise ValueError('Expected a glTF 2 binary')
    json_size = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + json_size])
    return document, data[28 + json_size:], len(data)


def texture_dimensions(document, binary):
    dimensions = []
    for image in document.get('images', []):
        if image.get('mimeType') != 'image/ktx2' or 'bufferView' not in image:
            raise ValueError('Use the shared structure optimizer to embed KTX2 textures')
        view = document['bufferViews'][image['bufferView']]
        offset = view.get('byteOffset', 0)
        if binary[offset:offset + 12] != b'\xabKTX 20\xbb\r\n\x1a\n':
            raise ValueError('Texture payload is not KTX2')
        dimensions.append(struct.unpack_from('<II', binary, offset + 20))
    return dimensions


def verify_order_and_essence(document):
    surfaces = {node.get('extras', {}).get('citadelOrderSurface'): node
                for node in document['nodes'] if node.get('extras', {}).get('citadelOrderSurface')}
    if set(surfaces) != {'cloth', 'gate'}:
        raise ValueError('Export independent cloth and gate Order meshes with their runtime metadata')
    for role, node in surfaces.items():
        if node['extras'].get('orderCloth') != 'banner':
            raise ValueError('Preserve orderCloth=banner on both Order surfaces')
        primitives = document['meshes'][node['mesh']]['primitives']
        if len(primitives) != 1:
            raise ValueError('Each Order role must own one independently swappable material')
        material = document['materials'][primitives[0]['material']]
        expected = 'Citadel / Order ' + ('cloth' if role == 'cloth' else 'imprint')
        if material['name'] != expected or 'baseColorTexture' not in material['pbrMetallicRoughness']:
            raise ValueError('Preserve the named Order texture slots')
    essence = next((m for m in document['materials'] if m.get('name') == 'Citadel / Refined essence'), None)
    tiers = {node.get('extras', {}).get('citadelTier', 'empire') for node in document['nodes'] if 'mesh' in node}
    if tiers & {'settlement', 'city'}:
        if essence:
            raise ValueError('Settlement and city must not inherit mastered essence')
        return
    if tiers == {'kingdom'} and not essence:
        return
    if not essence or essence.get('extensions', {}).get('KHR_materials_emissive_strength', {}).get('emissiveStrength', 0) <= 1:
        raise ValueError('Export named Refined essence with KHR_materials_emissive_strength above one')
    red, green, blue = essence['emissiveFactor']
    if not green > blue > red:
        raise ValueError('Mastered essence must remain teal after export')


def verify(path):
    document, binary, byte_count = read_glb(path)
    verify_order_and_essence(document)
    primitives = [primitive for mesh in document['meshes'] for primitive in mesh['primitives']]
    positions = [document['accessors'][p['attributes']['POSITION']] for p in primitives]
    height = max(p['max'][1] for p in positions) - min(p['min'][1] for p in positions)
    triangles = sum(document['accessors'][p['indices']]['count'] // 3 for p in primitives)
    dimensions = texture_dimensions(document, binary)
    materials = len(document.get('materials', []))
    failures = []
    tiers = {node.get('extras', {}).get('citadelTier', 'empire') for node in document['nodes'] if 'mesh' in node}
    if len(tiers) != 1:
        raise ValueError('Every delivered body must belong to one realm tier')
    tier = tiers.pop()
    contracts = json.loads((Path(__file__).parent / 'citadel-tiers.json').read_text())
    minimum, maximum = contracts[tier]['height']
    if not minimum <= height <= maximum:
        failures.append(f'height {height:.3f}; retain {tier} interval {minimum}–{maximum}')
    if not 1 <= triangles <= 25000:
        failures.append(f'{triangles} triangles; retain the 25k maximum budget')
    if not 1 <= materials <= 8:
        failures.append(f'{materials} materials; share at most eight production materials')
    if not 1 <= len(dimensions) <= 6 or any(max(size) > 480 for size in dimensions):
        failures.append(f'textures {dimensions}; use at most six packed images at <=480 px')
    if document.get('animations') or any(any(key in n for key in ('matrix', 'scale', 'rotation', 'translation')) for n in document['nodes']):
        failures.append('apply production transforms and export static geometry')
    if any('KHR_draco_mesh_compression' not in p.get('extensions', {}) for p in primitives):
        failures.append('run the shared structure optimizer to compress every primitive with Draco')
    if any(not {'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0'} <= p['attributes'].keys() for p in primitives):
        failures.append('export the baked response UV, surface UV and material tint from the packed source')
    if failures:
        raise ValueError('; '.join(failures))
    return {'path': str(path), 'tier': tier, 'height': height, 'triangles': triangles, 'materials': materials,
            'textures': dimensions, 'bytes': byte_count, 'primitives': len(primitives)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.model)))
    except (ValueError, KeyError, struct.error) as error:
        parser.exit(1, f'{args.model}: {error}\n')
