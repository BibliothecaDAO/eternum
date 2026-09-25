# Frontier site glyphs

The SVGs are the editable source and runtime output: hand-authored paths on a 24-unit grid for 20 px HUD use and larger
research nodes. No font, external image, raster master, filter or build step is required.

- `shrine.svg`: a gold pediment and bright central offering, parchment columns and a blessing cross.
- `well.svg`: a gold winch frame, suspended bucket and parchment water opening above a stone basin.
- `fallen-realm.svg`: a broken parchment keep with a dark breach, beneath a gold beast banner. The beast head uses a
  forked ear silhouette; it is a site identifier, independent of the encounter's Troll, Wyvern or Hydra presentation.

Direction: Frontier design section 3.12 and mockups 3 and 8. Palette: `#dfaa54` gold, `#eadfc8` parchment, `#1b1207`
ink. Outlines are 1.5 units, equivalent to 1.25 px at 20 px. All canvases are transparent.

Runtime paths: `/images/frontier/sites/{shrine,well,fallen-realm}.svg`. Supply accessible names in the consuming UI. Use
existing 3D models for world sites; these glyphs are for HUD and research. Review captures remain outside the repo.
