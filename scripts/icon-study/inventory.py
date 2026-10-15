"""Inventory local client imagery and all source-level rendering references."""
import csv
import html
import shutil
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
GAME = ROOT / 'apps/game'
BASE_OUT = Path(sys.argv[1])
OUT = BASE_OUT / datetime.now(timezone.utc).strftime("scan-%Y%m%dT%H%M%S%fZ")
OUT.mkdir(parents=True, exist_ok=False)
SOURCES = [p for base in [GAME / 'src', ROOT / 'packages/types/src/constants'] for p in base.rglob('*') if p.suffix in {'.ts', '.tsx', '.css'} and '.test.' not in p.name]
source_text = {p: p.read_text() for p in SOURCES}
reference_lines = [(p, n, line.strip()) for p, text in source_text.items() for n, line in enumerate(text.splitlines(), 1) if re.search(r'/(?:images|image-icons|assets)/', line)]


def family(path):
    name = str(path)
    path = Path(path)
    slug = path.stem.lower().removeprefix('ui-')
    if '/resources/' in name:
        return 'troop types and tiers' if path.stem.isdigit() and 26 <= int(path.stem) <= 34 else 'resources'
    if '/labels/' in name:
        return 'minimap and world labels'
    if '/orders/' in name:
        return 'Order emblems'
    if any(term in slug for term in ['attack', 'raid', 'deploy', 'transfer', 'explore', 'move', 'swap', 'construction', 'produce', 'production', 'trade', 'travel', 'claim', 'upgrade', 'pick-axe', 'pickaxe', 'digging', 'drill']):
        return 'actions'
    if any(term in slug for term in ['stamina', 'strength', 'hourglass', 'timeglass', 'clock', 'shield', 'lightning', 'warning', 'weight', 'capacity', 'store-limit', 'army-slots', 'protected', 'danger', 'network', 'lock', 'flag', 'skull', 'slots/']):
        return 'statuses'
    if '/image-icons/' in name:
        return 'HUD buttons and controls'
    if '/buildings/' in name:
        return 'structures and construction'
    if '/icons/' in name:
        return 'HUD buttons and controls'
    return 'other imagery (review for icon use)'


def dimensions(path):
    if path.suffix == '.svg':
        text = path.read_text()
        viewbox = re.search(r'viewBox=["\']([^"\']+)', text)
        width = re.search(r'\bwidth=["\']([^"\']+)', text)
        height = re.search(r'\bheight=["\']([^"\']+)', text)
        return viewbox.group(1) if viewbox else f'{width.group(1) if width else "?"} × {height.group(1) if height else "?"}'
    with Image.open(path) as img:
        return f'{img.width} × {img.height}'


assets = []
for base in [GAME / 'public', GAME / 'src/assets']:
    for path in sorted(base.rglob('*')):
        if path.suffix.lower() not in {'.svg', '.png', '.webp', '.jpg', '.jpeg', '.gif', '.ico'}:
            continue
        url = '/' + str(path.relative_to(GAME / 'public')) if 'public' in path.parts else str(path.relative_to(GAME))
        refs = []
        directory = str(path.parent.relative_to(GAME / 'public')) + '/' if 'public' in path.parts else url
        for source, number, line in reference_lines:
            if url in line or directory in line:
                refs.append({'source': str(source.relative_to(ROOT)), 'line': number, 'text': line})
        assets.append({'path': str(path.relative_to(ROOT)), 'url': url, 'family': family('/' + str(path.relative_to(GAME))), 'format': path.suffix[1:],
                       'size': dimensions(path), 'bytes': path.stat().st_size,
                       'references': refs, 'referenceKind': 'literal or directory-template candidate' if refs else 'no source match'})

occurrences = []
pattern = re.compile(r'<svg\b|<img\b|<image\b|(?:icon|Icon|iconSrc|src|image|texture)\s*[:=]|createGameIcon\(|(?:textContent\s*=.*[\u2300-\u2bff])|from ["\'][^"\']*(?:icons|lucide)|[\U0001f300-\U0001faff]')
for path, text in source_text.items():
    for number, line in enumerate(text.splitlines(), 1):
        if pattern.search(line):
            occurrences.append({'source': str(path.relative_to(ROOT)), 'line': number, 'text': line.strip()})
resources = [{'name': name, 'id': int(id)} for name, id in re.findall(r'^\s*(\w+)\s*=\s*(\d+),', (ROOT / 'packages/types/src/constants/resource-ids.ts').read_text(), re.M)]
game_icons = [{'name': name, 'path': path, 'rotation': rotation.strip(', ') or '0'} for name, path, rotation in re.findall(r'export const (\w+) = createGameIcon\("([^"]+)"([^)]*)\)', (GAME / 'src/ui/design-system/atoms/game-icons.ts').read_text())]
kit_source = (GAME / 'src/ui/design-system/kit/kit-icon.tsx').read_text().split('const ICONS = {')[1].split('} as const')[0]
kit_icons = [{'code': code, 'expression': expr.strip()} for code, expr in re.findall(r'^\s*(\w+): (.+),$', kit_source, re.M)]
counts = Counter(a['family'] for a in assets)
styles = [
    ('Painted resource cutouts', 'images/resources', 'Material colour and three-quarter objects; includes troops/relics.'),
    ('Painted menu cutouts', 'image-icons (outside kit)', 'Warm outlined object paintings; many tiny controls become miniature objects.'),
    ('Gilded kit', 'image-icons/kit', 'Gold sculpted reliefs; separate resource metaphors for wheat, labor, essence.'),
    ('Building render thumbnails', 'images/buildings', 'Perspective buildings and scenes used as UI images.'),
    ('Legacy vector glyphs', 'assets/icons and src/assets', 'Mixed filled/outline vectors, consolidated here as one broad visual family.'),
    ('Map label badges', 'images/labels', 'Owner-coloured raster badges; tier numerals added by canvas in strategic layer.'),
    ('Order emblems', 'assets/icons/orders; design-system/kit/order-emblem.ts', 'Heraldic identity sigils reused for attributes and training buildings.'),
    ('Text and procedural glyphs', 'inline JSX/SVG, emoji and minimap occupier circles', 'Platform-dependent emoji, geometric dots, text SAT symbol; no shared asset contract.'),
]
size_summary = {group: dict(Counter(a['format'] + ' ' + a['size'] for a in assets if a['family'] == group)) for group in counts}
result = {'sizeSummary': size_summary, 'baseCommit': '89cac2eee59', 'scope': 'All local client imagery is enumerated, including non-icon art, to avoid excluding dynamic filename consumers. References are conservative static candidates, not runtime reachability proof.', 'assets': assets, 'renderOccurrences': occurrences, 'menuManifest': json.loads((GAME / 'asset-sources/icons/menus/manifest.json').read_text())['icons'], 'resources': resources, 'gameIcons': game_icons, 'kitIcons': kit_icons, 'styleFamilies': styles, 'counts': dict(counts)}
(OUT / 'inventory.json').write_text(json.dumps(result, indent=2) + '\n')
with (OUT / 'assets.csv').open('w') as file:
    writer = csv.writer(file)
    writer.writerow(['path', 'family', 'format', 'intrinsic size / viewBox', 'bytes', 'source reference candidates'])
    for a in assets:
        writer.writerow([a['path'], a['family'], a['format'], a['size'], a['bytes'], '; '.join(f"{r['source']}:{r['line']}" for r in a['references'])])
lines = ['# Existing client icon inventory', '', result['scope'], '', f"One static scan at {result['baseCommit']}: {len(assets)} local image files; {len(occurrences)} source rendering candidates; {len(resources)} resource IDs; {len(game_icons)} named GameIcon exports; {len(kit_icons)} kit codes. These sets overlap; do not add their counts.", '', '| Asset family | Files |', '|---|---:|']
lines += [f'| {name} | {count} |' for name, count in counts.items()]
lines += ['', '## Visual styles', '', 'Eight broad visual families, counted by rendering grammar rather than file extension. This is a manual classification of the enumerated sources, not an automated aesthetic score. Legacy SVGs contain further substyles.', '', '| Style | Source | Grammar |', '|---|---|---|']
lines += [f'| {name} | {path} | {note} |' for name, path, note in styles]
lines += ['', '## Resource coverage', '', '| ID | Resource | Existing PNG |', '|---:|---|---|']
lines += [f"| {r['id']} | {r['name']} | {'yes' if (GAME / 'public/images/resources' / (str(r['id']) + '.png')).exists() else 'no; SAT uses a text glyph'} |" for r in resources]
lines += ['', '## Known semantic collisions', '', '- Status row: Bank, BitcoinMine, Rift, Ruin and Stragglers all use Crown; realm also uses Crown.', '- Strategic markers: camp and stragglers reuse village; rift reuses mine; ruin reuses realm.', '- Minimap selects own/enemy textures only; ally raster files exist but are not selected. No realm level or army strength band.', '- Minimap mine rendering requires mineKind, but readMinimapTiles does not populate it from the structure projection.', '- Donkey in ResourceIcon uses the trade building thumbnail, while a numbered resource PNG and a menu donkey also exist.', '- SAT is enum ID 58 but has no numbered resource PNG. Rendered as text in ResourceIcon.', '- Stamina and victory points both use the lightning emoji in world labels.', '', '## Sizes and source map', '', 'Every file, format, intrinsic size, byte size and reference candidate is in assets.csv and inventory.json. Render occurrences include inline SVG, image JSX, imported icon components, procedural icon assignments and emoji. Dynamic paths are retained as directory candidates, not claimed as certain consumers.', '', '- ResourceIcon: 8–80 CSS px depending on responsive size token; main HUD 16/24/32 px.', '- GameIcon: default 24 px, caller class/style may override; rotations reuse the same source.', '- KitIcon: default 20 px, caller size overrides.', '- HexMinimap: 15.4 world-SVG units × marker multiplier (army 0.9; hyperstructure 1.05/1.1), then current map scale.', '- StrategicMarkerLayer: 2.0 world-unit armies / 2.6 structures; 256 px canvas adds tier numeral.', '', 'Exact runtime sizes and dynamically fetched imagery cannot be proven by a static scan. No timing measurements are made.']
lines += ['', '## Intrinsic sizes by family', '', '| Family | Format and intrinsic size: file count |', '|---|---|']
lines += [f"| {group} | {', '.join(f'{size}: {count}' for size, count in sizes.items())} |" for group, sizes in size_summary.items()]
(OUT / 'inventory.md').write_text('\n'.join(lines) + '\n')
print(json.dumps({'assets': len(assets), 'renderOccurrences': len(occurrences), 'resources': len(resources), 'gameIcons': len(game_icons), 'kitIcons': len(kit_icons), 'families': dict(counts)}))

# A small source contact sheet grounds the visual-family count without loading all scenery.
samples = [
 ('Painted resources', ['images/resources/1.png', 'images/resources/35.png', 'images/resources/26.png', 'images/resources/39.png']),
 ('Menu paintings', ['image-icons/construction.png', 'image-icons/military.png', 'image-icons/ui-arrow-right.png', 'image-icons/hourglass.png']),
 ('Gilded kit', ['image-icons/kit/wheat.png', 'image-icons/kit/labor.png', 'image-icons/kit/ui-lightning.png', 'image-icons/kit/attack.png']),
 ('Building thumbnails', ['images/buildings/thumb/house.png', 'images/buildings/thumb/trade.png', 'images/buildings/thumb/silo.png']),
 ('Legacy vector glyphs', ['assets/icons/sword.svg', 'assets/icons/common/clock.svg', 'assets/icons/common/map.svg', 'assets/icons/common/shield.svg']),
 ('Map badges', ['images/labels/realm.png', 'images/labels/enemy_army.png', 'images/labels/allies_army.png', 'images/labels/fragment_mine.png']),
 ('Order emblems', ['assets/icons/orders/rage.svg', 'assets/icons/orders/skill.svg', 'assets/icons/orders/detection.svg']),
]
(OUT / 'samples').mkdir(exist_ok=True)
sections = []
for title, paths in samples:
    figures = []
    for path in paths:
        filename = path.replace('/', '-')
        shutil.copyfile(GAME / 'public' / path, OUT / 'samples' / filename)
        art = (GAME / 'public' / path).read_text() if path.endswith('.svg') else f'<img src="samples/{filename}">'
        figures.append(f'<figure>{art}<figcaption>{html.escape(path)}</figcaption></figure>')
    sections.append(f'<section><h2>{title}</h2><div>{"".join(figures)}</div></section>')
(OUT / 'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>Existing icon inventory</title><style>body{background:#151b1e;color:#eee5ce;font:16px sans-serif;padding:30px}a{color:#b8dbe9}section>div{display:flex;gap:24px}figure{width:180px;margin:8px}svg path:not([fill]){fill:currentColor}img,svg{width:64px;height:64px;object-fit:contain}figcaption{font-size:12px;overflow-wrap:anywhere;margin-top:10px}</style><h1>Eight visual families in the current client</h1><p>Seven asset families below; the eighth is inline text/procedural glyphs (stamina and victory ⚡, guild ⚔, SAT ₿, minimap dots). Source counts include non-icon imagery where a dynamic path could use it. Inline legacy vectors receive the surrounding text colour, as their client component does.</p><p><a href="inventory.md">Inventory report</a> · <a href="assets.csv">Every file and source reference</a> · <a href="inventory.json">Full machine-readable source map</a> · <a href="../../viewer/">Theme picker</a></p>' + ''.join(sections) + '</html>')

(BASE_OUT / "index.html").write_text(f'<meta http-equiv="refresh" content="0;url={OUT.name}/index.html"><a href="{OUT.name}/index.html">Latest inventory</a>')
print(str(OUT))
