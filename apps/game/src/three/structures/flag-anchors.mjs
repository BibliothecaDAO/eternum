export const FLAG_ROLES = Object.freeze(["banner", "trim"]);

const isFiniteList = (value, length) =>
  Array.isArray(value) && value.length === length && value.every((entry) => Number.isFinite(entry));

function isFlagAnchor(anchor) {
  return (
    FLAG_ROLES.includes(anchor?.role) &&
    isFiniteList(anchor.position, 3) &&
    isFiniteList(anchor.size, 2) &&
    anchor.size.every((side) => side > 0) &&
    Number.isFinite(anchor.facing)
  );
}

export function requireFlagAnchors(anchors, where) {
  if (!Array.isArray(anchors)) throw new Error(`Flag anchors must be a list in ${where}`);
  for (const anchor of anchors) {
    if (!isFlagAnchor(anchor)) {
      throw new Error(
        `A flag anchor needs role ${FLAG_ROLES.join("|")}, position [x,y,z], size [w,h] and facing in ${where}`,
      );
    }
  }
  return anchors;
}
