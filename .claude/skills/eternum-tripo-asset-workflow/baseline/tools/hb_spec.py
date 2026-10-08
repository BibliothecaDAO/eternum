"""Print one value of a character spec, for the shell tools (numpy and the standard library only).

  python hb_spec.py <char.json> work|helpers|pose_sets|sets|gear
    work       the character's working folder, as an absolute path
    helpers    the helper joints, comma separated
    pose_sets  the troop's own pose sets, comma separated
    sets       rom,general and then the troop's own sets: the sets the pose checks use
    gear       the gear spec, as an absolute path (empty when the spec has none)
<char.json> is absolute or relative to the baseline folder."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p

if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[2] not in ("work", "helpers", "pose_sets", "sets", "gear"): sys.exit(__doc__)
    spec = json.load(open(p(*sys.argv[1].split("/")))); k = sys.argv[2]
    if k in ("work", "gear"): print(p(*spec[k].split("/")) if spec.get(k) else "")
    elif k == "helpers": print(",".join(spec.get("helpers", [])))
    elif k == "pose_sets": print(",".join(spec.get("pose_sets", [])))
    else: print(",".join(["rom", "general"] + list(spec.get("pose_sets", []))))
