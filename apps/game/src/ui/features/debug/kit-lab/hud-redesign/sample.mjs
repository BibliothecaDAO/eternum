export function readVisibleUnits() {
  const stage = document.querySelector(".hud-scene");
  if (!stage) return [];
  return [...stage.querySelectorAll("[data-group]")]
    .map((group) => ({
      group: group.dataset.group,
      elements: [
        ...(group.matches("[data-notice]") ? [group] : []),
        ...group.querySelectorAll("[data-notice], [role=radio]"),
      ]
        .filter((element) => {
          const r = element.getBoundingClientRect();
          if (!r.width || !r.height || getComputedStyle(element).visibility === "hidden") return false;
          let left = Math.max(0, r.left),
            top = Math.max(0, r.top),
            right = Math.min(innerWidth, r.right),
            bottom = Math.min(innerHeight, r.bottom);
          for (let p = element.parentElement; p && p !== stage; p = p.parentElement) {
            if (/auto|scroll|hidden/.test(getComputedStyle(p).overflow)) {
              const clip = p.getBoundingClientRect();
              left = Math.max(left, clip.left);
              right = Math.min(right, clip.right);
              top = Math.max(top, clip.top);
              bottom = Math.min(bottom, clip.bottom);
            }
          }
          return right - left > 3 && bottom - top > 12;
        })
        .map((element) => {
          if (element instanceof HTMLInputElement) return element.value || element.getAttribute("aria-label");
          if (element instanceof HTMLSelectElement)
            return `${element.getAttribute("aria-label")}: ${element.selectedOptions[0].text}`;
          let text = element.innerText;
          element.querySelectorAll("select").forEach((select) => {
            text = text.replace(select.innerText, select.selectedOptions[0].text);
          });
          return text.replace(/\n+/g, " · ").trim() || element.getAttribute("aria-label");
        }),
    }))
    .filter((group) => group.elements.length);
}
