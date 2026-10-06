# Feat row review evidence

Source: PR #285, UI commit `8183ea53b4c18be95457eda957fcb87a8ca5aaa4`.
Launched this checkout with `npm run dev` at `http://localhost:5175/?dev`.
The provenance endpoint matched this worktree and commit before capture;
the responses and interaction results are recorded in [checks.json](checks.json).

The T3 preview disconnected during resize. These captures use local headless
Chromium as the fallback, with desktop 1280×900 and phone 390×844 viewports.
Both contexts emulate reduced motion; the phone context supports touch.
The development app fixture marks First light acquired, leaving other rows
uncrossed, so both states appear together.

- [Desktop](desktop.png) and [phone](phone.png): open rows with hairline
  separators match the pinned prototype's internal divisions; no repeated
  rounded cards remain. Names, effects and progress fit without row overflow.
- [Desktop grayscale](desktop-grayscale-reduced.png) and
  [phone grayscale](phone-grayscale-reduced.png): the acquired check and
  uncrossed progress figures distinguish state without hue or animation.
- [All 23 glyphs at 14px and 22px](glyphs-14-22-grayscale.png): inspected in
  grayscale; silhouettes remain distinct and readable at both sizes.
- Milestone disclosure opens on keyboard focus and closes with Escape at
  both widths. Phone touch opens the gate tooltip; tapping a row dismisses it.
  Desktop click opening and dismissal also pass. The JSON records these checks.

Compared with the pinned `eb232c4` prototype's rule-separated catalog rows.
The changed rows preserve the existing icons, progress bars and effects.
The mechanical design detector reported existing warnings elsewhere in the
stylesheet; none concern the changed feat row rules.

Validation: `npm run check` passed; the achievement, icon and UI regression
suites passed (296 tests). The full suite on the fixed checkout passed all
965 tests across 45 files.
