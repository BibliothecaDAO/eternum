/** The "+10 XP" float's mark: a small bright star, readable on the map at 22 px. */
const STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
<path d="M12 2.5l2.7 6.1 6.6.6-5 4.4 1.5 6.5L12 16.7 6.2 20.1l1.5-6.5-5-4.4 6.6-.6z" fill="#ffe08a" stroke="#b8801a" stroke-width="1.2" stroke-linejoin="round"/>
</svg>`;

export const XP_STAR_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(STAR_SVG)}`;
