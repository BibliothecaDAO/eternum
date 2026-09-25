"""Build a hunched stone-skinned Troll for the fallen-realm courtyard."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from beast_geometry import ellipsoid, fuse_anatomy, tapered_limb
from frontier_geometry import clear_scene, create_grained_surface, export_structure, material, mesh


def build_troll():
    clear_scene()
    skin = create_grained_surface("Troll moss-gray hide", ((0.16, 0.19, 0.12), (0.29, 0.33, 0.22)))
    shadow = material("Troll mouth and pupils", (0.018, 0.012, 0.009))
    ivory = material("Troll aged tusks", (0.68, 0.60, 0.38))
    eye = material("Troll amber eyes", (0.82, 0.42, 0.035), 0.45)
    leather = material("Troll hide belt", (0.14, 0.085, 0.037))
    build_troll_anatomy(skin)
    fuse_anatomy(skin)
    build_troll_face(shadow, ivory, eye)
    build_troll_loincloth(leather)
    build_stone_club(leather)
    export_structure("beast-troll")


def build_troll_anatomy(skin):
    ellipsoid("Barrel chest", (0, 0.025, 0.68), (0.205, 0.15, 0.235), skin)
    ellipsoid("Hunched back", (0, 0.08, 0.82), (0.22, 0.135, 0.16), skin)
    ellipsoid("Lower abdomen", (0, 0.025, 0.46), (0.125, 0.10, 0.16), skin)
    ellipsoid("Heavy skull", (0, -0.065, 0.98), (0.125, 0.115, 0.15), skin)
    ellipsoid("Square jaw", (0, -0.115, 0.895), (0.09, 0.086, 0.055), skin)
    ellipsoid("Broad nose", (0, -0.169, 0.945), (0.033, 0.042, 0.046), skin)
    for side in (-1, 1):
        ellipsoid("Heavy brow", (side * 0.048, -0.158, 1.002), (0.057, 0.043, 0.026), skin)
        tapered_limb("Pointed ear", (side * 0.10, -0.04, 1.01), (side * 0.17, -0.008, 1.055), 0.035, 0.004, skin)
        ellipsoid("Shoulder", (side * 0.18, 0.012, 0.80), (0.11, 0.105, 0.135), skin)
        tapered_limb("Long upper arm", (side * 0.20, 0.02, 0.78), (side * 0.28, -0.025, 0.53), 0.085, 0.070, skin)
        ellipsoid("Elbow", (side * 0.28, -0.025, 0.53), (0.07, 0.073, 0.08), skin)
        tapered_limb("Long forearm", (side * 0.28, -0.025, 0.54), (side * 0.26, -0.125, 0.28), 0.067, 0.055, skin)
        ellipsoid("Heavy fist", (side * 0.26, -0.125, 0.265), (0.07, 0.072, 0.082), skin)
        tapered_limb("Bent thigh", (side * 0.077, 0.025, 0.45), (side * 0.12, -0.045, 0.26), 0.076, 0.066, skin)
        tapered_limb("Shin", (side * 0.12, -0.045, 0.28), (side * 0.10, 0.005, 0.08), 0.058, 0.047, skin)
        ellipsoid("Broad foot", (side * 0.105, -0.047, 0.055), (0.075, 0.105, 0.054), skin)


def build_troll_face(shadow, ivory, eye):
    ellipsoid("Scowling mouth", (0, -0.194, 0.894), (0.058, 0.013, 0.014), shadow)
    for side in (-1, 1):
        ellipsoid("Amber eye", (side * 0.049, -0.186, 0.98), (0.020, 0.011, 0.011), eye)
        ellipsoid("Eye pupil", (side * 0.049, -0.197, 0.98), (0.005, 0.003, 0.008), shadow, 8, 6)
        tapered_limb("Lower tusk", (side * 0.044, -0.19, 0.88), (side * 0.052, -0.207, 0.933), 0.013, 0.001, ivory)
        ellipsoid("Nostril", (side * 0.014, -0.205, 0.94), (0.009, 0.005, 0.006), shadow, 8, 6)


def build_troll_loincloth(leather):
    mesh(
        "Worn hide apron",
        [(-0.12, -0.077, 0.48), (0.12, -0.077, 0.48), (0.115, -0.095, 0.32),
         (0.065, -0.10, 0.28), (0.005, -0.10, 0.31), (-0.095, -0.095, 0.285)],
        [(0, 1, 2, 3, 4, 5)], leather, thickness=0.008,
    )


def build_stone_club(leather):
    stone = material("Troll club stone", (0.22, 0.235, 0.20))
    tapered_limb("Club haft", (0.26, -0.12, 0.33), (0.19, -0.22, 0.085), 0.022, 0.032, leather)
    ellipsoid("Chipped stone club", (0.185, -0.235, 0.095), (0.095, 0.080, 0.075), stone, 8, 6)


if __name__ == "__main__":
    build_troll()
