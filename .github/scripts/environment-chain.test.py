"""The checked-in Worker config owns its environment chain; deployment never overrides it."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]

class EnvironmentChain(unittest.TestCase):
    def test_one_source(self):
        config = (ROOT / "apps/realms/wrangler.jsonc").read_text()
        workflow = (ROOT / ".github/workflows/deploy-workers.yml").read_text()
        self.assertIn('"L2_CHAIN_ID": "SN_SEPOLIA"', config)
        self.assertIn('"L2_CHAIN_ID": "SN_MAIN"', config)
        self.assertNotIn('--var "L2_CHAIN_ID:', workflow)
        self.assertNotIn('L2_CHAIN_ID: ${{ vars.CLIENT_L2_CHAIN }}', workflow)

if __name__ == "__main__":
    unittest.main()
