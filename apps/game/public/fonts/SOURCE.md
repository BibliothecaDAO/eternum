# App faces

The faces `src/tokens.ts` names, served from the app so no page asks a font service. Each is under the SIL Open Font
License 1.1; its licence text is the `.OFL.txt` file beside it, and the Credits and licences page lists them.

- `bokor-regular.ttf`: Bokor (Danh Hong), titles. The brand kit's file (`Fonts/Social Media Titles/bokor-regular.ttf`),
  unmodified.
- `atkinson-hyperlegible-next.woff2`: Atkinson Hyperlegible Next, everything read (labels, buttons, text, numbers), as
  Google Fonts serves it (Latin, variable weight 200–800).
- `exo-2.woff2`: Exo 2 (Natanael Gama, The Exo 2 Project Authors), everything read in the Blitz and Eternum HUD, as
  Google Fonts serves it (Latin, variable weight 100–900). Its licence is `exo-2.OFL.txt`.
- `cinzel.woff2`: Cinzel (Natanael Gama, The Cinzel Project Authors), the Blitz and Eternum HUD's panel titles, as
  Google Fonts serves it (Latin, variable weight 400–900). Its licence is `cinzel.OFL.txt`.
- `im-fell-english-sc-regular.ttf`: IM FELL English SC (Igino Marini), the letters the lockup
  (`/images/logos/realms-lockup.svg`) draws as outlines (`scripts/build-app-lockup.py`). The brand kit's file
  (`Fonts/Small Caps - Subtitles/im-fell-english-sc-regular.ttf`), unmodified: "IM FELL English SC" is a Reserved Font
  Name, and the OFL treats a converted or subset file as a Modified Version that may not carry it. Its licence is
  `im-fell-english-sc-regular.OFL.txt`.

To replace a file, copy the new release unmodified and update its licence file from the release's OFL.txt.
