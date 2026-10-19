# Fonts

`plus-jakarta-sans-latin.woff2` is a subset of [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans) 2.071 by Tokotype, licensed under the SIL Open Font License 1.1 ([OFL.txt](OFL.txt)). The font has no Reserved Font Name, so the subset keeps its name.

`app.css` loads it with `@font-face`, and the build inlines it into `index.html` as a `data:` URI, which the CSP allows with `font-src data:`. Nothing is loaded from Google Fonts or any other server.

The subset keeps:

- the weight axis from 400 to 800 (the weights the app uses), as a variable font
- Google Fonts' "latin" range: Basic Latin, Latin-1 (German, French and Italian letters, « »), general punctuation (– “ ” …), € and ™
- the default OpenType features plus `tnum` (tabular figures in tables and the calendar), and the copyright and license entries

Other characters, e.g. in poll titles, fall back to the system font.

## Rebuilding it

The source is `PlusJakartaSans[wght].ttf` from [google/fonts](https://github.com/google/fonts/tree/main/ofl/plusjakartasans) (SHA-256 `89b3fb38aa0d275d7a731d0d817a4f1622b316b4d7fbdedcf02ee9099ff68bc8`). With [fonttools](https://github.com/fonttools/fonttools) 4.60 and brotli (`pip install fonttools brotli`):

```bash
fonttools varLib.instancer 'PlusJakartaSans[wght].ttf' wght=400:800 -o limited.ttf
pyftsubset limited.ttf --flavor=woff2 --output-file=plus-jakarta-sans-latin.woff2 \
  --unicodes='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD' \
  --layout-features+=tnum --name-IDs=0,1,2,3,4,5,6,13,14
```

The result is about 19 KiB, or about 26 KiB as a `data:` URI. Keep it under 40 KiB.
