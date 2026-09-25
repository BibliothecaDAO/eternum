"""Build a two-legged Wyvern with folded, upright wings and a tucked tail."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from beast_geometry import curved_limb, ellipsoid, fuse_anatomy, tapered_limb
from frontier_geometry import clear_scene, create_grained_surface, export_structure, material, mesh


def build_wyvern():
    clear_scene()
    skin = create_grained_surface("Wyvern ember scales", ((0.22, 0.052, 0.025), (0.39, 0.13, 0.052)))
    membrane = material("Wyvern folded wing membrane", (0.39, 0.22, 0.11), 0.92)
    horn = material("Wyvern horn and talons", (0.34, 0.26, 0.16))
    shadow = material("Wyvern mouth and pupils", (0.018, 0.011, 0.008))
    eye = material("Wyvern amber eyes", (0.92, 0.51, 0.028), 0.4)
    build_wyvern_anatomy(skin)
    fuse_anatomy(skin, 0.012)
    build_folded_wings(skin, membrane, horn)
    build_wyvern_face(shadow, eye, horn)
    build_talons(horn)
    export_structure("beast-wyvern")


def build_wyvern_anatomy(skin):
    ellipsoid("Wyvern chest", (0, 0.035, 0.60), (0.125, 0.115, 0.23), skin)
    ellipsoid("Wyvern pelvis", (0, 0.075, 0.38), (0.13, 0.105, 0.14), skin)
    curved_limb(
        "Arched wyvern neck",
        [(0, 0.035, 0.69), (0, 0.01, 0.81), (0, -0.035, 0.94), (0, -0.095, 1.075)],
        [0.105, 0.083, 0.062, 0.060], skin,
    )
    ellipsoid("Wyvern skull", (0, -0.10, 1.10), (0.08, 0.105, 0.075), skin)
    ellipsoid("Wyvern long muzzle", (0, -0.19, 1.076), (0.059, 0.095, 0.040), skin)
    curved_limb(
        "Tucked wyvern tail",
        [(0, 0.12, 0.37), (0.07, 0.22, 0.23), (0.19, 0.235, 0.11),
         (0.29, 0.145, 0.075), (0.28, 0.035, 0.13), (0.23, 0.025, 0.25)],
        [0.075, 0.061, 0.046, 0.032, 0.021, 0.002], skin,
    )
    for side in (-1, 1):
        tapered_limb("Wyvern thigh", (side * 0.085, 0.07, 0.41), (side * 0.14, -0.025, 0.24), 0.075, 0.054, skin)
        tapered_limb("Wyvern hock", (side * 0.14, -0.025, 0.25), (side * 0.12, 0.065, 0.095), 0.049, 0.027, skin)
        tapered_limb("Wyvern ankle", (side * 0.12, 0.065, 0.105), (side * 0.115, -0.04, 0.035), 0.025, 0.034, skin)
        ellipsoid("Wyvern foot", (side * 0.115, -0.073, 0.031), (0.059, 0.075, 0.030), skin)
        ellipsoid("Wyvern eye ridge", (side * 0.052, -0.145, 1.14), (0.046, 0.060, 0.023), skin)


def build_folded_wings(skin, membrane, horn):
    for side in (-1, 1):
        shoulder = (side * 0.08, 0.075, 0.72)
        elbow = (side * 0.23, 0.12, 0.89)
        wrist = (side * 0.24, 0.11, 1.29)
        finger_tips = [
            (side * 0.36, 0.13, 1.10),
            (side * 0.31, 0.155, 0.68),
            (side * 0.20, 0.17, 0.41),
        ]
        tapered_limb("Wing upper arm", shoulder, elbow, 0.038, 0.026, skin)
        tapered_limb("Folded wing forearm", elbow, wrist, 0.027, 0.018, skin)
        tapered_limb("Wing thumb claw", wrist, (side * 0.28, 0.08, 1.335), 0.016, 0.001, horn)
        for tip in finger_tips:
            tapered_limb("Wing finger", wrist, tip, 0.016, 0.006, skin)
        mesh(
            "Pleated wing sail", [wrist, *finger_tips, shoulder, elbow],
            [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 5)], membrane, thickness=0.004,
        )


def build_wyvern_face(shadow, eye, horn):
    ellipsoid("Wyvern mouth seam", (0, -0.222, 1.061), (0.053, 0.054, 0.007), shadow)
    for side in (-1, 1):
        ellipsoid("Wyvern eye", (side * 0.061, -0.176, 1.12), (0.018, 0.013, 0.012), eye)
        ellipsoid("Wyvern pupil", (side * 0.062, -0.186, 1.12), (0.004, 0.004, 0.009), shadow, 8, 6)
        tapered_limb("Swept wyvern horn", (side * 0.058, -0.055, 1.15), (side * 0.09, 0.045, 1.23), 0.022, 0.001, horn)
        tapered_limb("Wyvern fang", (side * 0.036, -0.237, 1.065), (side * 0.036, -0.237, 1.041), 0.007, 0.001, horn)


def build_talons(horn):
    for side in (-1, 1):
        for toe in (-1, 0, 1):
            x = side * 0.115 + toe * 0.030
            tapered_limb("Wyvern talon", (x, -0.11, 0.034), (x + toe * 0.008, -0.18, 0.006), 0.012, 0.001, horn)


if __name__ == "__main__":
    build_wyvern()
