# App faces

The three faces `src/tokens.ts` names, served from the app so no page asks a font service. All are under the SIL Open
Font License.

- `lexend.woff2`: Lexend, Google Fonts, Latin subset, variable weight 100–900.
- `atkinson-hyperlegible-next.woff2`: Atkinson Hyperlegible Next, Google Fonts, Latin subset, variable weight 200–800.
- `im-fell-english-sc.woff2`: IM Fell English SC from the brand kit (`Fonts/Small Caps - Subtitles`), subset to Latin-1
  and quotes:

```sh
pyftsubset "IM FELL English SC.ttf" --unicodes="U+0000-00FF,U+2013,U+2014,U+2018-201F,U+2026" \
  --layout-features='*' --flavor=woff2 --output-file=im-fell-english-sc.woff2
```
