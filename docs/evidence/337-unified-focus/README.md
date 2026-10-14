# Unified Focus door

User-directed follow-up: integrate logo, habit, and timer into one native Focus button left of the session controls. One hover boundary, keyboard outline, and selected underline belong to that button; the clock and habit are plain child spans. The sheet is a sibling, and Pause/Resume and Start/Exit remain independent buttons.

Verified the same running checkout and provenance as ../337-session-surface/README.md, with these working changes. The T3 preview viewport resize still timed out, so the attached capture is a measured 390px app container within the wider browser, not mobile device emulation. At 390px the unified button ends at x176, Resume x225, Exit x286, Notes x332, Settings x380. At 320px every control fits through x314. At a measured 1280px container, the unified read area is 315px wide with a 12px internal gap and 16px separation before actions; the timer's former 150px reserve is removed. Phone internal gap is 8px.

Real browser keyboard events verified Escape dismissal and Enter opening after focusing the unified button. Clicking the logo opened Focus; no nested buttons exist. UI tests check logo/habit/timer containment, the single focus stop, sheet outside the button, standing faces, and unchanged running/paused habit selection. Layout detector returned no findings. The approved square-cut controls and quiet panel presentation remain intact; no animation was added.

True desktop/phone viewport capture, pointer-level touch, grayscale capture, and reduced-motion emulation remain unavailable. Container geometry and keyboard results are not claimed as substitutes for those checks.
