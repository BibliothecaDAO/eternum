/**
 * The coin that flies and fountains for LORDS: a bright gold disc with a darker rim and a highlight, so the payoff
 * glitters on the dark map. The near-black token art stays on labels; in flight it read as specks.
 */
const COIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<defs>
<radialGradient id="face" cx="38%" cy="32%" r="70%">
<stop offset="0" stop-color="#fff6c8"/><stop offset="0.45" stop-color="#f7cf4f"/><stop offset="1" stop-color="#b8801a"/>
</radialGradient>
</defs>
<circle cx="16" cy="16" r="15" fill="#8a5a0e"/>
<circle cx="16" cy="16" r="13" fill="url(#face)"/>
<circle cx="16" cy="16" r="9.5" fill="none" stroke="#b8801a" stroke-width="1.4" opacity="0.7"/>
<ellipse cx="11.5" cy="10" rx="4" ry="2.2" fill="#fffbe6" opacity="0.8" transform="rotate(-30 11.5 10)"/>
</svg>`;

export const GOLD_COIN_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(COIN_SVG)}`;
