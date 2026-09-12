"""Overlapping roof tiles share one material and retain the existing roof silhouette."""

import math
import random

from settlement_geometry import mesh


def build_pitched_tiles(m, name, x, y, width, depth, eave, ridge, finish, hip):
    rng = random.Random(name)
    wear = m[finish]["tileWear"]
    columns = max(3, round(depth / 0.065))
    for row in range(7):
        low, high = row / 7, (row + 1) / 7
        for sign in [-1, 1]:
            for column in range(columns):
                start = column / columns + 0.008
                end = (column + 1) / columns - 0.008
                lift = 0.003 + rng.random() * wear
                corners = []
                for t, u, raised in [
                    (low, start, lift), (low, end, lift + rng.uniform(-wear / 2, wear / 2)),
                    (high, end, 0.001), (high, start, 0.001),
                ]:
                    run = depth / 2 * (1 - 0.64 * t) if hip else depth / 2
                    corners.append((
                        x + sign * width / 2 * (1 - t), y + (u * 2 - 1) * run,
                        eave + (ridge - eave) * t + raised,
                    ))
                mesh(name + " hand laid tile", corners, [(0, 1, 2, 3)], m[finish], thickness=0.0015)


def build_radial_tiles(m, name, x, y, profile, finish):
    rng = random.Random(name)
    wear = m[finish]["tileWear"]
    bottom, peak = profile[0][1], profile[-1][1]
    rows = max(4, round((peak - bottom) / 0.065))
    for row in range(rows):
        low = bottom + (peak - bottom) * row / rows
        high = bottom + (peak - bottom) * (row + 1) / rows
        low_radius, high_radius = radius_at_height(profile, low), radius_at_height(profile, high)
        segments = max(16, round(math.tau * low_radius / 0.06))
        for column in range(segments):
            start = (column + 0.018 + (row % 2) * 0.45) / segments * math.tau
            end = (column + 0.982 + (row % 2) * 0.45) / segments * math.tau
            lift = 0.002 + rng.random() * wear
            corners = [
                (x + (radius + raised) * math.cos(angle), y + (radius + raised) * math.sin(angle), height)
                for radius, height, angle, raised in [
                    (low_radius, low, start, lift), (low_radius, low, end, lift),
                    (high_radius, high, end, 0.0005), (high_radius, high, start, 0.0005),
                ]
            ]
            # The existing closed roof supports the open underside; only exposed tile lips need geometry.
            corners.extend((px, py, pz - 0.0015) for px, py, pz in corners[:2])
            mesh(name + " hand laid tile", corners, [(0, 1, 2, 3), (1, 0, 4, 5)], m[finish])


def radius_at_height(profile, height):
    for (low_radius, low), (high_radius, high) in zip(profile, profile[1:]):
        if height <= high:
            fraction = (height - low) / (high - low)
            return low_radius + (high_radius - low_radius) * fraction
    return profile[-1][0]
