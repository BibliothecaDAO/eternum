"""Visible craftsmanship progresses from rough fieldstone to fine imperial ashlar."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ConstructionStyle:
    stone_shades: tuple
    mortar_color: tuple
    joint_width: float
    joint_depth: float
    crack_threshold: float
    crack_depth: float
    edge_wear: float
    coping_tint: float
    facet_min: float


STYLES = {
    "settlement": ConstructionStyle(
        ((0.45, 0.40, 0.31, 1), (0.56, 0.50, 0.39, 1)),
        (0.30, 0.28, 0.22, 1), 0.003, 0.010, 0.58, 0.32, 0.003, 0.76, 0.86,
    ),
    "city": ConstructionStyle(
        ((0.53, 0.48, 0.39, 1), (0.65, 0.59, 0.48, 1)),
        (0.36, 0.33, 0.27, 1), 0.0025, 0.008, 0.62, 0.26, 0.0025, 0.84, 0.90,
    ),
    "kingdom": ConstructionStyle(
        ((0.65, 0.60, 0.49, 1), (0.75, 0.70, 0.60, 1)),
        (0.49, 0.46, 0.39, 1), 0.0018, 0.006, 0.66, 0.20, 0.0015, 0.92, 0.94,
    ),
    "empire": ConstructionStyle(
        ((0.79, 0.76, 0.68, 1), (0.88, 0.85, 0.78, 1)),
        (0.64, 0.61, 0.54, 1), 0.0009, 0.003, 0.74, 0.10, 0.0007, 1.0, 0.97,
    ),
}
