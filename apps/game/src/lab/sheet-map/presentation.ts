import * as THREE from "three";
import { ActionType } from "@bibliothecadao/eternum";
import { MAP_SHEET, mapAgeAccent } from "@/tokens";
import { createCasedHexagonBandGeometry } from "@/three/geometry/hexagon-geometry";
import { HoverHexManager } from "@/three/managers/hover-hex-manager";
import { HighlightHexManager } from "@/three/managers/highlight-hex-manager";
import { StrategicMarkerLayer } from "@/three/managers/strategic-marker-layer";
import { PathRenderer } from "@/three/managers/path-renderer";
import { resolveHoverVisualPalette, OWNERSHIP_RING_LOOK } from "@/three/managers/worldmap-interaction-palette";
import {
  createHexRingShapes,
  drapeHexRingCopies,
  createHexRingMaterials,
  applyHexRingLook,
} from "@/three/managers/hex-ring";
import type { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import { playerColorManager } from "@/three/systems/player-colors";
import { iconUrl, type IconMeaning } from "@/ui/design-system/icon-meaning";
import { MAP_CHAPTERS, MAP_COLUMNS, specimenHex, type MapChapter, type MapColumn } from "./fixture";

const ACTIONS = [
  ActionType.Move,
  ActionType.Explore,
  ActionType.Attack,
  ActionType.Help,
  ActionType.Build,
  ActionType.CreateArmy,
  ActionType.Chest,
  ActionType.SpireTravel,
];
const SITE_ICONS: IconMeaning[] = ["camp", "mine", "hyperstructure", "spire", "chest"];
const OWNERS = ["you", "ally", "enemy", "neutral", "unowned", "you"] as const;

/** Lab adapter over the shipped terrain, rings, hover manager, action layers and path renderer. */
export class MapSheetPresentation {
  private strategic = new Map<MapColumn, StrategicMarkerLayer>();
  private releases: (() => void)[] = [];
  private updates: ((dt: number) => void)[] = [];
  private labels: { element: HTMLSpanElement; position: THREE.Vector3 }[] = [];
  readonly target = new THREE.Vector3();
  frame(camera: THREE.PerspectiveCamera, aspect: number) {
    const rows = this.chapter === "hexes" ? 20 : this.chapter === "sites" || this.chapter === "strategic" ? 14 : 11;
    const a = terrainHexToWorld(0, 0),
      b = terrainHexToWorld(30, rows - 1);
    this.target.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    const distance =
      (Math.max((b.x - a.x + 4) / (2 * aspect), (b.z - a.z + 4) / 2) / Math.tan((camera.fov * Math.PI) / 360)) * 1.12;
    camera.position.copy(this.target).add(new THREE.Vector3(0, distance, distance * 0.28));
    camera.lookAt(this.target);
  }
  private group = new THREE.Group();
  constructor(
    private scene: THREE.Scene,
    private terrain: ProceduralTerrain,
    private chapter: MapChapter,
    private overlay: HTMLDivElement,
  ) {
    scene.add(this.group);
    MAP_COLUMNS.forEach((column, c) =>
      MAP_CHAPTERS[chapter].forEach((name, index) => {
        const hex = specimenHex(c, index),
          p = terrainHexToWorld(hex.col, hex.row);
        const position = new THREE.Vector3(p.x, terrain.sampleSurface(p.x, p.z).height, p.z);
        this.addLabel(name, position);
        this.addSpecimen(column, index, position);
      }),
    );
  }
  update(dt: number, camera: THREE.Camera, width: number, height: number) {
    this.updates.forEach((update) => update(dt));
    for (const label of this.labels) {
      const p = label.position
        .clone()
        .add(new THREE.Vector3(0, 0.03, 1.15))
        .project(camera);
      label.element.style.transform = `translate(${(p.x * 0.5 + 0.5) * width}px,${(-p.y * 0.5 + 0.5) * height}px) translate(-50%,0)`;
    }
  }
  dispose() {
    this.releases.forEach((release) => release());
    this.labels.forEach(({ element }) => element.remove());
    this.group.traverse((node) => {
      if (node instanceof THREE.Mesh || node instanceof THREE.Line) {
        node.geometry.dispose();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.scene.remove(this.group);
  }
  private addLabel(name: string, position: THREE.Vector3) {
    const element = document.createElement("span");
    element.className = "map-sheet-label";
    element.textContent = name;
    this.overlay.append(element);
    this.labels.push({ element, position });
  }
  private addSpecimen(column: MapColumn, index: number, p: THREE.Vector3) {
    const today = column === "today",
      accent = today ? new THREE.Color(OWNERSHIP_RING_LOOK.color).getStyle() : mapAgeAccent(column);
    if (this.chapter === "strategic") return this.addStrategic(column, index, p);
    if (this.chapter === "hexes") return this.addHex(column, index, p, accent);
    if (this.chapter === "routes") return this.addRoute(column, index, p, accent);
    if (this.chapter === "ownership") return this.addOwnership(column, index, p, accent);
    this.addSite(column, index, p, accent);
  }
  private addOwnership(column: MapColumn, index: number, p: THREE.Vector3, accent: string) {
    const today = column === "today";
    const owner = OWNERS[index];
    const color = today ? this.shippedOwner(owner) : MAP_SHEET.ownership[owner];
    if (today && owner !== "you") return;
    this.ring(
      p,
      today ? new THREE.Color(OWNERSHIP_RING_LOOK.color).getStyle() : color,
      owner === "unowned" ? 0.14 : 0.32,
      1,
      !today,
    );
    if (index === 5) this.ring(p, accent, 0.48, 1, !today);
    if (!today) this.ownerGlyph(p, owner, color);
  }
  private addSite(column: MapColumn, index: number, p: THREE.Vector3, accent: string) {
    const today = column === "today";
    if (index < 5) {
      // The gameplay plate owns the icon. This specimen draws that same painted asset at the site's ground anchor.
      const texture = new THREE.TextureLoader().load(iconUrl(SITE_ICONS[index]));
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
      sprite.position.copy(p).add(new THREE.Vector3(0, 0.5, 0));
      sprite.scale.setScalar(MAP_SHEET.marker.size);
      sprite.renderOrder = 900;
      this.group.add(sprite);
      this.releases.push(() => {
        texture.dispose();
        sprite.material.dispose();
      });
      if (!today) this.ring(p, MAP_SHEET.ownership.neutral, 0.2);
    } else if (index === 5 && !today) {
      this.line(
        [
          p.clone().add(new THREE.Vector3(-1, 0, -0.5)),
          p.clone().add(new THREE.Vector3(0, 0, -0.85)),
          p.clone().add(new THREE.Vector3(1, 0, -0.5)),
        ],
        accent,
        MAP_SHEET.fogEdge.width,
        MAP_SHEET.fogEdge.opacity,
      );
    }
  }
  private addStrategic(column: MapColumn, index: number, p: THREE.Vector3) {
    const today = column === "today";
    let markers = this.strategic.get(column);
    if (!markers) {
      markers = new StrategicMarkerLayer();
      markers.setViewPitch(Math.atan(0.28));
      this.strategic.set(column, markers);
      this.group.add(markers.object3d);
      const owned = markers;
      this.releases.push(() => owned.dispose());
    }
    const owner = index % 3 === 0 ? "you" : index % 3 === 1 ? "ally" : "enemy";
    const color = new THREE.Color(today ? this.shippedOwner(owner) : MAP_SHEET.ownership[owner]);
    if (index < 5)
      markers.setStructure(
        index + 1,
        (["realm", "village", "hyperstructure", "mine", "bank"] as const)[index],
        p.x,
        p.z,
        color,
      );
    else markers.setArmy(index + 1, (["T1", "T2", "T3"] as const)[index - 5], p.x, p.z, color);
    markers.commit();
    markers.object3d.position.y = p.y;
  }
  private addHex(column: MapColumn, index: number, p: THREE.Vector3, accent: string) {
    const today = column === "today";
    if (index < 2) {
      const hover = new HoverHexManager(this.scene, this.terrain);
      const palette = {
        ...resolveHoverVisualPalette({ hasSelection: index === 1, actionType: index === 1 ? ActionType.Move : null }),
      };
      if (!today) palette.baseColor = palette.rimColor = new THREE.Color(accent).getHex();
      hover.applyHoverPalette(palette);
      hover.showHover(p.x, p.z);
      if (!today) this.casing(p, accent);
      this.updates.push((dt) => hover.update(dt));
      this.releases.push(() => hover.dispose());
      if (!today && index === 1) this.fill(p, accent, MAP_SHEET.fill.selected);
      return;
    }
    if (today && index <= 10) {
      const highlight = new HighlightHexManager(this.scene, this.terrain);
      const h = specimenHex(0, index),
        actionType = index === 10 ? ActionType.Move : ACTIONS[index - 2];
      highlight.highlightHexes([
        {
          hex: h,
          actionType,
          kind: index === 10 ? "route" : actionType === ActionType.Explore ? "frontier" : "destination",
          isEndpoint: index !== 10,
          isSharedRoute: false,
          pathDepth: 1,
        },
      ]);
      this.updates.push(() => highlight.updateHighlightPulse(Math.abs(Math.sin((performance.now() / 1000) * 2) / 16)));
      this.releases.push(() => highlight.dispose());
      return;
    }
    if (today && index >= 10) return;
    const danger = index === 4 || index === 11;
    const color = danger ? MAP_SHEET.danger : index === 5 ? MAP_SHEET.ownership.ally : accent;
    this.ring(p, color, index === 10 ? 0.12 : 0.32);
    if (index !== 11) this.fill(p, color, index === 10 ? MAP_SHEET.fill.range : MAP_SHEET.fill.endpoint);
    if (index === 11) this.cross(p, color);
    else if (index === 4) this.chevron(p, color);
    else if (index === 7) this.cross(p, color, true);
    else if (index === 3 || index === 10) this.dots(p, color);
    else if (index === 2) this.chevron(p, color);
    else if (index >= 5) this.actionIcon(p, index);
  }
  private addRoute(column: MapColumn, index: number, p: THREE.Vector3, accent: string) {
    if (index >= 4) {
      if (column === "today") return;
      this.ring(p, index === 5 ? MAP_SHEET.danger : accent, 0.32);
      if (index === 5) this.cross(p, MAP_SHEET.danger);
      else this.dots(p, accent);
      return;
    }
    const points = [
      p.clone().add(new THREE.Vector3(-1.6, 0, 0.3)),
      p.clone().add(new THREE.Vector3(-0.1, 0, -0.3)),
      p.clone().add(new THREE.Vector3(1.3, 0, -0.1)),
    ];
    if (column === "today") {
      const paths = new PathRenderer();
      paths.initialize(this.scene);
      // The row's state, as the map sets it: the selected army, the army under the pointer, another army, a preview.
      const colour = playerColorManager.getSelfProfile().primary;
      if (index === 3) paths.showPreview(points, colour);
      else paths.createPath(index + 1, points, colour);
      if (index === 0) paths.setSelectedPath(index + 1);
      if (index === 1) paths.setHoveredPath(index + 1);
      paths.update(0);
      this.releases.push(() => paths.dispose());
    } else {
      const opacity = index === 3 ? MAP_SHEET.line.previewOpacity : MAP_SHEET.line.opacity;
      this.line(points, MAP_SHEET.casing, MAP_SHEET.line.casingWidth, opacity);
      this.line(points, accent, MAP_SHEET.line.width, opacity);
      this.chevron(points[2], accent);
      if (index !== 1) this.ring(points[2], accent, 0.2, 0.35);
    }
  }
  private ring(p: THREE.Vector3, color: string, intensity: number, scale = 1, cased = true) {
    if (cased && scale > 0.3) this.casing(p, color, scale);
    const shapes = createHexRingShapes(),
      materials = createHexRingMaterials();
    applyHexRingLook(materials, new THREE.Color(color), intensity);
    for (const name of ["halo", "glow", "outline"] as const) {
      if (scale !== 1) shapes[name].scale(scale, scale, 1);
      const geometry = drapeHexRingCopies(shapes[name], [p], this.terrain, 0.04);
      const object =
        name === "outline"
          ? new THREE.LineSegments(geometry, materials[name])
          : new THREE.Mesh(geometry, materials[name]);
      object.renderOrder = 48;
      this.group.add(object);
      shapes[name].dispose();
    }
  }
  private casing(p: THREE.Vector3, color: string, scale = 1) {
    const shape = createCasedHexagonBandGeometry(
      MAP_SHEET.ring.outerRadius * scale,
      MAP_SHEET.ring.innerRadius * scale,
      MAP_SHEET.ring.casingWidth * scale,
      {
        core: new THREE.Color(color).toArray() as [number, number, number],
        casing: new THREE.Color(MAP_SHEET.casing).toArray() as [number, number, number],
      },
    );
    const geometry = drapeHexRingCopies(shape, [p], this.terrain, 0.07);
    geometry.setAttribute("color", shape.getAttribute("color").clone());
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: MAP_SHEET.ring.opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    mesh.renderOrder = 53;
    this.group.add(mesh);
    shape.dispose();
  }
  private fill(p: THREE.Vector3, color: string, opacity: number) {
    const geometry = new THREE.CircleGeometry(0.85, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++)
      positions.setY(
        i,
        this.terrain.sampleSurface(p.x + positions.getX(i), p.z + positions.getZ(i)).height + 0.025 - p.y,
      );
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color, opacity, transparent: true, depthWrite: false, toneMapped: false }),
    );
    mesh.position.copy(p);
    mesh.renderOrder = 5;
    this.group.add(mesh);
  }
  private line(points: THREE.Vector3[], color: string, width = MAP_SHEET.line.width as number, opacity = 1) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        direction = b.clone().sub(a),
        length = direction.length();
      const geometry = new THREE.PlaneGeometry(width, length, 1, Math.max(1, Math.ceil(length * 12)))
        .rotateX(-Math.PI / 2)
        .rotateY(-Math.atan2(direction.z, direction.x) + Math.PI / 2);
      const centre = a.clone().lerp(b, 0.5),
        vertices = geometry.getAttribute("position");
      for (let v = 0; v < vertices.count; v++)
        vertices.setY(
          v,
          this.terrain.sampleSurface(centre.x + vertices.getX(v), centre.z + vertices.getZ(v)).height +
            0.065 -
            centre.y,
        );
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      mesh.position.copy(centre);
      mesh.renderOrder = 52;
      this.group.add(mesh);
    }
  }
  private chevron(p: THREE.Vector3, color: string) {
    this.line(
      [
        p.clone().add(new THREE.Vector3(-0.3, 0, -0.3)),
        p.clone().add(new THREE.Vector3(0.15, 0, 0)),
        p.clone().add(new THREE.Vector3(-0.3, 0, 0.3)),
      ],
      color,
    );
  }
  private cross(p: THREE.Vector3, color: string, plus = false) {
    const vectors = plus
      ? [
          [-0.3, 0, 0.3, 0],
          [0, -0.3, 0, 0.3],
        ]
      : [
          [-0.3, -0.3, 0.3, 0.3],
          [-0.3, 0.3, 0.3, -0.3],
        ];
    vectors.forEach(([x, z, x2, z2]) =>
      this.line([p.clone().add(new THREE.Vector3(x, 0, z)), p.clone().add(new THREE.Vector3(x2, 0, z2))], color),
    );
  }
  private dots(p: THREE.Vector3, color: string) {
    for (let i = -1; i <= 1; i++) this.ring(p.clone().add(new THREE.Vector3(i * 0.35, 0, 0)), color, 0.2, 0.075);
  }
  private actionIcon(p: THREE.Vector3, index: number) {
    const meaning: IconMeaning = index === 5 ? "transfer" : index === 6 ? "build" : index === 8 ? "chest" : "spire";
    const texture = new THREE.TextureLoader().load(iconUrl(meaning));
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.position.copy(p).add(new THREE.Vector3(0, 0.22, 0));
    sprite.scale.setScalar(0.52);
    sprite.renderOrder = 900;
    this.group.add(sprite);
    this.releases.push(() => {
      texture.dispose();
      sprite.material.dispose();
    });
  }
  private ownerGlyph(p: THREE.Vector3, owner: (typeof OWNERS)[number], color: string) {
    if (owner === "you") return this.ring(p, color, 0.2, 0.15);
    const shapes = {
      ally: [
        [-0.22, -0.22],
        [0.22, -0.22],
        [0.22, 0.22],
        [-0.22, 0.22],
        [-0.22, -0.22],
      ],
      enemy: [
        [0, -0.3],
        [0.28, 0.2],
        [-0.28, 0.2],
        [0, -0.3],
      ],
      neutral: [
        [0, -0.3],
        [0.3, 0],
        [0, 0.3],
        [-0.3, 0],
        [0, -0.3],
      ],
      unowned: [],
    };
    this.line(
      shapes[owner].map(([x, z]) => p.clone().add(new THREE.Vector3(x, 0, z))),
      color,
    );
  }
  private shippedOwner(owner: (typeof OWNERS)[number]): string {
    return (
      owner === "you"
        ? playerColorManager.getSelfProfile()
        : owner === "ally"
          ? playerColorManager.getAllyProfile()
          : owner === "enemy"
            ? playerColorManager.getEnemyProfile("0x123")
            : playerColorManager.getNeutralProfile()
    ).primary.getStyle();
  }
}
