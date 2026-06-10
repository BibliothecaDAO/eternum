import { AnimationClip } from "three";

function isWordChar(char: string): boolean {
  return /[a-z0-9]/.test(char);
}

function hasTokenBoundaryMatch(name: string, pattern: string): boolean {
  let index = name.indexOf(pattern);

  while (index !== -1) {
    const beforeIndex = index - 1;
    const afterIndex = index + pattern.length;
    const beforeBoundary = beforeIndex < 0 || !isWordChar(name[beforeIndex]);
    const afterBoundary = afterIndex >= name.length || !isWordChar(name[afterIndex]);

    // Allow prefix/suffix matches at token boundaries while rejecting pure in-word matches.
    if (beforeBoundary || afterBoundary) {
      return true;
    }

    index = name.indexOf(pattern, index + 1);
  }

  return false;
}

export function findAnimationByName(animations: AnimationClip[], patterns: string[]): AnimationClip | undefined {
  const lowerPatterns = patterns.map((pattern) => pattern.toLowerCase());

  return animations.find((clip) => {
    const lowerName = clip.name.toLowerCase();
    return lowerPatterns.some((pattern) => hasTokenBoundaryMatch(lowerName, pattern));
  });
}
