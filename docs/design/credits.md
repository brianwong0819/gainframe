# Design credits

Sources of UI patterns, components or effects we adapted. Required for anything derived from someone else's code (see "Learning from great UI" in `docs/design-system.md`).

| What we built | Source (URL) | Licence | Notes |
|---|---|---|---|
| Number font (self-hosted latin subset, `apps/web/src/styles/fonts/`) | Martian Mono, https://github.com/evilmartians/mono | SIL OFL 1.1 (`OFL.txt` alongside) | woff2 from Google Fonts |
| Settings gear icon (`apps/web/src/features/settings/settings-link.tsx`) | Feather "settings", https://github.com/feathericons/feather | MIT | Path copied; stroke width matches the tab icons |
| Google mark on the sign-in button (`apps/web/public/brand/google-g.svg`) | Google Sign-In branding guidelines, https://developers.google.com/identity/branding-guidelines | Google brand terms (used as the guidelines require: unaltered colours, on white) | Standard four-colour "G" |

## Data sources

The bundled food table (`packages/shared/src/food-table`). Each entry keeps its source; the app names the sources in Settings.

| Source | Used for | Terms | Notes |
|---|---|---|---|
| Malaysian Food Composition Database (MyFCD), Ministry of Health Malaysia, https://myfcd.moh.gov.my/ | Malaysian foods, dishes and kuih (`sources/myfcd.json`) | No licence stated; used by bw's decision (2026-11-23) | Read on 2026-11-23 from Internet Archive copies of the food pages, because the live site refused connections. Each row keeps the original page URL. |
| USDA FoodData Central, SR Legacy (April 2018), https://fdc.nal.usda.gov/ | Cooked meats, dairy and gym staples (`sources/usda.json`) | US public domain (CC0 1.0) | The citation USDA asks for is in the app's data sources line. |
