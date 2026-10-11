"""A CI file selects the area that owns it, and a CI file nothing owns is named."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validation_areas import AREAS, PATH_SCOPED, selected_areas, unowned_ci_files


def areas_run_by(*files):
    return {area for area, selected in selected_areas(list(files), False).items() if selected}


class CiFileOwnership(unittest.TestCase):
    def test_a_called_workflow_selects_only_its_own_area(self):
        self.assertEqual(areas_run_by(".github/workflows/test-client.yml"), {"client"})

    def test_a_composite_action_selects_the_areas_whose_workflows_use_it(self):
        self.assertEqual(
            areas_run_by(".github/actions/fetch-cairo-dependencies/action.yml"),
            {"amm", "collectibles", "mmr", "season_pass"},
        )

    def test_static_owned_ci_files_select_no_further_area(self):
        for path in (
            ".github/workflows/validation.yml",
            ".github/workflows/shard-images.yml",
            ".github/scripts/validation_areas.py",
        ):
            with self.subTest(path=path):
                self.assertEqual(areas_run_by(path), set())

    def test_a_package_manifest_still_selects_every_area(self):
        self.assertEqual(areas_run_by("pnpm-lock.yaml"), set(selected_areas([], True)))

    def test_committed_contract_schemas_select_all_consuming_areas(self):
        for path in (
            "contracts/l2/ledger/schema/abi.json",
            "contracts/l3/world-native/schema/schema.json",
            "contracts/l3/world-native/schema/bindings.json",
            "contracts/l3/world-native/schema/client.gen.ts",
            "contracts/l3/world-native/schema/fixtures/row-set.json",
        ):
            with self.subTest(path=path):
                self.assertEqual(areas_run_by(path), {"client", "herald", "services", "native", "runtime"})

    def test_client_publisher_inputs_select_both_deployment_areas(self):
        self.assertEqual(areas_run_by("apps/game/package.json"), {"client", "native", "runtime"})
        self.assertEqual(areas_run_by("deploy/first/publish.test.ts"), {"native", "runtime"})

    def test_landing_with_no_optional_inputs_runs_only_core_areas(self):
        for files in ([], ["README.md"], ["apps/value-relay/src/relay.ts"], ["apps/game/src/shell/blitz.ts"]):
            with self.subTest(files=files):
                selected = selected_areas(files, False, landing=True)
                self.assertEqual({area for area, enabled in selected.items() if enabled}, set(AREAS) - PATH_SCOPED)

    def test_landing_runs_each_optional_job_only_for_its_inputs(self):
        for path, area in (
            ("contracts/l2/ammv2/src/lib.cairo", "amm"),
            ("contracts/l2/season_pass/src/lib.cairo", "season_pass"),
            ("apps/game/src/three/terrain.ts", "terrain"),
            ("apps/web/src/lib/rating-population.ts", "portal"),
            ("packages/db/src/schema.ts", "portal"),
            ("packages/identity/src/index.ts", "portal"),
            (".github/workflows/test-portal.yml", "portal"),
        ):
            with self.subTest(path=path):
                selected = selected_areas([path], False, landing=True)
                self.assertEqual({name for name in PATH_SCOPED if selected[name]}, {area})

    def test_lockfile_and_unknown_pr_base_keep_all_checks(self):
        self.assertTrue(all(selected_areas(["pnpm-lock.yaml"], False, landing=True).values()))
        self.assertTrue(all(selected_areas([], True).values()))

    def test_portal_workflow_is_owned_independently(self):
        self.assertEqual(areas_run_by(".github/workflows/test-portal.yml"), {"portal"})

    def test_a_ci_file_no_area_owns_is_named(self):
        self.assertEqual(
            unowned_ci_files([".github/workflows/new-check.yml", ".github/workflows/test-client.yml", "README.md"]),
            [".github/workflows/new-check.yml"],
        )


if __name__ == "__main__":
    unittest.main()
