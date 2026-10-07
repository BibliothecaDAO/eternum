"""A CI file selects the area that owns it, and a CI file nothing owns is named."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validation_areas import selected_areas, unowned_ci_files


def areas_run_by(*files):
    return {area for area, selected in selected_areas(list(files), False).items() if selected}


class CiFileOwnership(unittest.TestCase):
    def test_a_called_workflow_selects_only_its_own_area(self):
        self.assertEqual(areas_run_by(".github/workflows/test-client.yml"), {"client"})

    def test_the_contract_workflow_selects_the_native_area_and_its_world_suite(self):
        self.assertEqual(areas_run_by(".github/workflows/native-world.yml"), {"native", "native_world"})

    def test_a_composite_action_selects_the_areas_whose_workflows_use_it(self):
        self.assertEqual(
            areas_run_by(".github/actions/fetch-cairo-dependencies/action.yml"),
            {"amm", "collectibles", "mmr", "season_pass"},
        )

    def test_static_owned_ci_files_select_no_further_area(self):
        for path in (
            ".github/workflows/validation.yml",
            ".github/workflows/deploy-workers.yml",
            ".github/workflows/shard-images.yml",
            ".github/scripts/validation_areas.py",
        ):
            with self.subTest(path=path):
                self.assertEqual(areas_run_by(path), set())

    def test_a_package_manifest_still_selects_every_area(self):
        self.assertEqual(areas_run_by("pnpm-lock.yaml"), set(selected_areas([], True)))

    def test_a_ci_file_no_area_owns_is_named(self):
        self.assertEqual(
            unowned_ci_files([".github/workflows/new-check.yml", ".github/workflows/test-client.yml", "README.md"]),
            [".github/workflows/new-check.yml"],
        )


if __name__ == "__main__":
    unittest.main()
