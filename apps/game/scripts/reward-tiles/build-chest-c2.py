"""Export the approved C2 chest without rebuilding the other reward studies."""

import argparse
import importlib.util
import json
import sys
from pathlib import Path

import bpy


def load_reward_builder():
    path = Path(__file__).with_name("build-reward-tiles.py")
    spec = importlib.util.spec_from_file_location("reward_tiles", path)
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    return builder


def prepare_scene(builder, output_dir):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    builder.RNG.seed(731)
    builder.OUTPUT = output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    builder.COLLECTION = bpy.data.collections.new("C2 chest")
    bpy.context.scene.collection.children.link(builder.COLLECTION)
    builder.create_materials()
    scene = bpy.context.scene
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = 241


def build_chest(output_dir=None):
    builder = load_reward_builder()
    prepare_scene(builder, output_dir or builder.OUTPUT)
    root = builder.empty("chest-c2")
    root["concept"] = "chest-c2"
    builder.build_arcane_chest(root)
    print(json.dumps(builder.export_asset(root, "chest-c2")))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path)
    arguments = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    build_chest(arguments.output_dir)
