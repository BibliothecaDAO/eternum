# Where the template comes from

`template.npz` and `template.json` are built from the MakeHuman / MPFB base mesh and its `game_engine` rig and weights.
These are CC0; the two licence files are beside this one in `mpfb/`.

`tools/hb_template_build.py` rebuilds the template from three files in `mpfb/`:

| File                       | Upstream                                   |
| -------------------------- | ------------------------------------------ |
| `base.obj`                 | MakeHuman community `mpfb2`, the base mesh |
| `rig.game_engine.json`     | `mpfb2`, the `game_engine` rig definition  |
| `weights.game_engine.json` | `mpfb2`, the `game_engine` weights         |

Upstream repository: <https://github.com/makehumancommunity/mpfb2>, `master` (the build report in `template.json` names
it as the source). Find the three files in that repository by name; their folders there are not recorded here.

Put the three files in `template/mpfb/` (the folder that holds the licence files), then run `tools/hb_selftest.sh`,
which rebuilds the template and checks it. They are not committed because they are large and the built `template.npz` is
all any tool reads. `tree.json` (the base mesh's vertex-group tree) was kept with them by the author;
`hb_template_build.py` does not read it.
