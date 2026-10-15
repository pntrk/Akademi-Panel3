# Implementation Plan - Black & White Optical Form Detection Optimization

## Proposed Changes

### OMR Engine (`/src/lib/omrEngine.ts`)

#### 1. Mandatory Core Fill & Center Darkness Validation
- Enforce strict bubble core darkness (`coreNet >= 8.0` or center density) and minimum fill ratio (`fillRatio >= 0.20`) before marking any bubble as filled in `evaluateQuestionAnswerOptikAI`.
- Eliminate false positives where ambient dark pixels on option margins trigger a high score without actual pencil/pen markings in the bubble center.

#### 2. Dynamic Printed Glyph & Column Line Filter
- Integrate dynamic glyph and border line filtering for black-and-white scans.
- Filter out printed option letters (e.g. "D", "E") and vertical table column borders so line contrast does not get evaluated as graphite density.

#### 3. Search Window & Boundary Constraints for Option D
- Constrain right-edge search radius (`searchLimitX`) for option D bubbles to prevent the search window from drifting onto adjacent question block dividers or table margins.

---

## Verification Plan

### Automated Verification
- Run `npm run lint` and `compile_applet` to verify that all TypeScript types, OMR calculation algorithms, and imports build without error.

### Manual Verification
- Test scanning black-and-white optical forms with empty D bubbles to confirm they are registered as empty/unanswered instead of marked D.
- Test filled bubbles (A, B, C, D, E) to verify accurate reading across all options.
