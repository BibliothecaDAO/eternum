# App faces

The faces `src/tokens.ts` names (`FONTS`, one role each as the Realms Brand Deck v3 sets them), served from the app so
no page asks a font service. Each is under the SIL Open Font License 1.1; its licence text is the `.OFL.txt` file beside
it, and the Credits and licences page lists them.

- `realms-titling-bold.woff2`: Realms Titling Bold, a game's title at 32 px and above. The brand kit's file
  (`Realms-Brand-Kit-v3/02-Fonts/Realms-Titling/RealmsTitling-Bold.woff2`), unmodified. Its licence is
  `realms-titling-bold.OFL.txt`; its upstream notices are `realms-titling-bold.NOTICES.txt` and the licences they name,
  `realms-titling-bold.cinzel-decorative.OFL.txt` and `im-fell-english-sc-regular.OFL.txt`.
- `im-fell-english-sc-regular.ttf`: IM FELL English SC (Igino Marini), headings. The brand kit's TTF
  (`02-Fonts/IM-Fell-English-SC/IMFellEnglishSC-Regular.ttf`), unmodified: "IM FELL English SC" is a Reserved Font Name,
  and the OFL treats a converted or subset file as a Modified Version that may not carry it, so the app serves the TTF
  rather than a converted web file. Its licence is `im-fell-english-sc-regular.OFL.txt`.
- `exo-2.woff2`: Exo 2 (Natanael Gama, The Exo 2 Project Authors), everything read, the HUD included, as Google Fonts
  serves it (Latin, variable weight 100–900): the kit's Regular and SemiBold are two of its weights, and the HUD reads
  its 500 and 700 too. Its licence is `exo-2.OFL.txt`.
- `cinzel-regular.woff2`, `cinzel-semibold.woff2`: Cinzel (The Cinzel Project Authors), buttons, tabs and the bar's
  places. The brand kit's files (`02-Fonts/Cinzel`), unmodified. Its licence is `cinzel.OFL.txt`.

To replace a file, copy the new release unmodified and update its licence file from the release's OFL.txt.
