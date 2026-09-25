"""Build one five-headed Hydra; deeper presentation scales this same model."""

import math
import sys
from pathlib import Path

from mathutils import Euler, Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from beast_geometry import curved_limb, ellipsoid, fuse_anatomy, tapered_limb
from frontier_geometry import clear_scene, create_grained_surface, export_structure, material

# Independent roots and opposing bends keep both the silhouette and shadow asymmetric.
HEADS = [
    {"path": [(-.08, 0, .24), (-.20, -.03, .42), (-.32, -.07, .61),
              (-.28, -.14, .77), (-.16, -.23, .85), (-.22, -.24, .92)], "pitch": 24, "yaw": -18},
    {"path": [(.08, -.015, .24), (.21, -.07, .36), (.30, -.11, .48),
              (.31, -.19, .64), (.21, -.23, .75), (.25, -.24, .83)], "pitch": 30, "yaw": 24},
    {"path": [(0, .025, .24), (.05, .065, .48), (-.07, .13, .78),
              (-.05, .08, 1.12), (.025, .04, 1.42), (.015, -.04, 1.60)], "pitch": 18, "yaw": -8},
    {"path": [(-.06, .02, .24), (-.12, .16, .40), (-.15, .25, .65),
              (-.30, .20, .91), (-.30, .12, 1.15), (-.24, .08, 1.26)], "pitch": 8, "yaw": -48},
    {"path": [(.06, .06, .23), (.18, .20, .40), (.28, .24, .70),
              (.23, .16, .94), (.15, .07, 1.09), (.23, 0, 1.20)], "pitch": 16, "yaw": 52},
]


def build_hydra():
    clear_scene()
    skin = create_grained_surface("Hydra scaled hide", ((0.34, 0.35, 0.32), (0.50, 0.53, 0.48)))
    horn = material("Hydra dark horn", (0.12, 0.13, 0.10))
    shadow = material("Hydra mouth and pupils", (0.012, 0.018, 0.018))
    eye = material("Hydra gold eyes", (0.93, 0.57, 0.035), 0.4)
    build_coiled_body(skin)
    for head in HEADS:
        build_hydra_neck(head, skin)
    body = fuse_anatomy(skin, 0.012)
    paint_hydra_hide(body)
    for head in HEADS:
        build_hydra_face(head, horn, shadow, eye)
    export_structure("beast-hydra")


def build_coiled_body(skin):
    ellipsoid("Hydra body", (0, 0.025, 0.17), (0.18, 0.16, 0.12), skin)
    points, radii = [], []
    for index in range(19):
        angle = index * math.tau / 18
        radius = 0.19 + 0.03 * math.sin(angle)
        points.append((radius * math.cos(angle), radius * math.sin(angle), 0.068 + 0.016 * math.sin(angle)))
        radii.append(0.055 * (1 - index / 23))
    curved_limb("Hydra tail coil", points, radii, skin)


def neck_centers(head):
    controls = [Vector(point) for point in head["path"]]
    centers = []
    for index in range(len(controls) - 1):
        a, b = controls[max(0, index - 1)], controls[index]
        c, d = controls[index + 1], controls[min(len(controls) - 1, index + 2)]
        for step in range(4):
            t = step / 4
            centers.append(0.5 * ((2 * b) + (-a + c) * t +
                           (2 * a - 5 * b + 4 * c - d) * t * t +
                           (-a + 3 * b - 3 * c + d) * t * t * t))
    return centers + [controls[-1]]


def pose_head_part(head, part):
    rotation = Euler((math.radians(head["pitch"]), 0, math.radians(head["yaw"]))).to_matrix().to_4x4()
    part.matrix_world = Matrix.Translation(Vector(head["path"][-1])) @ rotation @ part.matrix_world


def build_hydra_neck(head, skin):
    centers = neck_centers(head)
    radii = [0.048 - 0.018 * math.sin(math.pi * index / (len(centers) - 1)) for index in range(len(centers))]
    curved_limb("S-curved hydra neck", centers, radii, skin)
    parts = [ellipsoid("Hydra skull", (0, 0, 0), (.060, .080, .047), skin),
             ellipsoid("Hydra muzzle", (0, -.064, -.017), (.044, .065, .025), skin)]
    for side in (-1, 1):
        parts.append(ellipsoid("Hydra eye ridge", (side * .04, -.045, .023), (.035, .036, .017), skin))
    for part in parts:
        pose_head_part(head, part)


def build_hydra_face(head, horn, shadow, eye):
    parts = [ellipsoid("Hydra mouth seam", (0, -.088, -.026), (.042, .039, .005), shadow, 12, 6)]
    for side in (-1, 1):
        parts.append(ellipsoid("Hydra eye", (side * .045, -.064, .011), (.012, .010, .009), eye, 12, 6))
        parts.append(ellipsoid("Hydra pupil", (side * .045, -.073, .011), (.003, .002, .007), shadow, 8, 6))
        parts.append(tapered_limb("Hydra swept horn", (side * .044, .035, .025),
                                 (side * .068, .105, .085), .015, .001, horn))
    for part in parts:
        pose_head_part(head, part)


def paint_hydra_hide(body):
    necks = [(head["path"][-1][2], neck_centers(head)) for head in HEADS]
    colors = [hydra_hide_color(vertex.co, necks) for vertex in body.data.vertices]
    layer = body.data.color_attributes.new(name="Hydra hide", type="FLOAT_COLOR", domain="CORNER")
    for loop in body.data.loops:
        layer.data[loop.index].color = colors[loop.vertex_index]
    body.data.color_attributes.active_color = layer


def hydra_hide_color(point, necks):
    skin = (0.20, 0.49, 0.50, 1)
    if point.z < 0.35:
        return skin
    if any((point - centers[-1]).length < 0.14 for _, centers in necks):
        return skin
    closest_distance = float("inf")
    closest_offset = None
    for height, centers in necks:
        if point.z > height - 0.08:
            continue
        for start, end in zip(centers, centers[1:]):
            direction = end - start
            fraction = min(1, max(0, (point - start).dot(direction) / direction.length_squared))
            offset = point - (start + direction * fraction)
            if offset.length < closest_distance:
                closest_distance, closest_offset = offset.length, offset
    if closest_offset is not None and closest_offset.y < -closest_distance * 0.62:
        return (0.80, 0.82, 0.52, 1)
    return skin


if __name__ == "__main__":
    build_hydra()
