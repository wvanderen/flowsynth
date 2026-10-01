# Musical harmony scoring: evidence and decision options

Research for [Musical harmony evidence: scoring deliberate arrangements without banning dissonance](https://github.com/wvanderen/flowsynth/issues/216), under [Habit specialization and musical modules: next iteration decision map](https://github.com/wvanderen/flowsynth/issues/212). Investigated 2026-10-01. This records evidence and candidate experiments, not a gameplay decision.

## Finding

A defensible pitch-only game rule can reward intentional pitch organization, but cannot honestly claim to measure universal pleasantness. Keep musical complexity, tension, and production value distinct when comparing candidates. A complex sonority can contain seconds or tritones without being a mistake; the game's decision is how much that tension costs versus its other rewards.

## Primary evidence

Harrison and Pearce's review and computational evaluation supports a multicomponent account: interference, periodicity/harmonicity, and learned cultural familiarity jointly predict simultaneous consonance in Western listeners. No one component is an adequate universal ranking. Their results concern simultaneous sonorities; they do not establish game rewards or the value of a chord in a progression. [Paper, DOI 10.1037/rev0000169](https://doi.org/10.1037/rev0000169), [author manuscript](https://qmro.qmul.ac.uk/xmlui/bitstream/handle/123456789/59662/Harrison%20Simultaneous%20consonance%20in%202019%20Accepted.pdf?sequence=2).

Sethares demonstrates that interference depends on the frequencies and amplitudes of a sound's partials. Harmonic timbres yield familiar consonance minima; altered spectra can move them. Pure sine tones do not exhibit the familiar special minima at the fifth and octave. Register and spectral content therefore matter to acoustic roughness. His discussion also explicitly distinguishes tonal consonance from musical interest: tension and release can make dissonance useful. [Author's explanation and calculations](https://sethares.engr.wisc.edu/consemi.html).

McDermott and colleagues found that Tsimané participants with limited Western music exposure lacked the Western preference for consonant over dissonant combinations, despite other auditory preferences. This is evidence against describing Western chord preference as an innate universal quality. It does not imply that every sonority is perceptually interchangeable. [Original study](https://www.nature.com/articles/nature18635).

An interval-class vector counts unordered pairs at each octave-folded interval class 1 through 6. It describes pitch content, rather than assigning pleasantness. [University music-theory textbook](https://musictheory.pugetsound.edu/mt21c/IntervalVector.html).

The researchers' `incon` package supplies independently named interference, harmonicity, cultural, numerosity, and composite models. Its examples accept MIDI pitches; spectrum-based interference requires frequencies and amplitudes. This offers reference implementations for later comparisons, rather than a reason to copy one model's output into the economy. [Authors' source and usage](https://github.com/pmcharrison/incon), [analysis scripts](https://github.com/pmcharrison/inconPaper).

## Current FlowSynth contracts

`CONTEXT.md` defines Pitch as absolute positional note and Chord as a register-free recognized pitch set. `src/engine/constants.ts` currently recognizes Octave, Fifth, Flat seventh, Minor triad, and Major triad. `src/engine/chords.ts` finds them in connected synthesizer/spacer clusters and handles voice multiplicity. ADR-0036 gives each instance a multiplier on participating synthesizers, with repeated/overlapping instances stacking locally. A board-wide harmony multiplier would reopen that contract; this iteration has permission to investigate it but research does not supersede the ADR.

`src/ui/signals.ts` uses just-intonation interval ratios for chord signals. A scoring model must specify whether it describes a register-free symbolic board, the actual audible cue, or a hypothetical simultaneous performance: these are different inputs. Do not assume the cue's tuning is a complete board acoustic rendering.

## Model comparison

| Candidate | Required input | Useful property | Important failure mode |
| --- | --- | --- | --- |
| Weighted interval-class vector | Distinct pitch classes, six explicit weights | Cheap, transposition invariant, explainable tension breakdown | Erases voicing and doubling; different sonorities can have identical vectors; weights are a design choice |
| Pitch-class harmonicity/template fit | Pitch classes and chosen harmonic template | Tests organization around a shared harmonic reference | Assumes template and spectrum; strong simple dyads may beat richer chords without a separate complexity reward |
| Absolute-pitch roughness | Frequencies, partials, amplitudes, tuning | Responds to spacing, register, and timbre | Misleading without fixed sound assumptions; low roughness alone does not mean musical quality |
| Composite perceptual predictor | Several model features, calibrated population/data | Separates multiple explanatory factors | Western calibration is not universal; opaque explanation and implementation cost |
| Named-chord value plus bounded tension term | Recognized vocabulary plus collective pitch content | Direct control over rewarding interesting extensions | Explicit game abstraction requiring tuning; recognition completeness can bias results |

The last row is a game-design inference, not a validated perceptual model. Research suggests comparing it with a simple pitch-class model before paying for an acoustic implementation.

## Representative calculations

Executed with Python 3 `itertools.combinations`. For each distinct pitch-class pair `(a,b)`, count `min((b-a)%12, (a-b)%12)` in bins 1..6. The final column is merely `(IC1+IC2)/number_of_pairs`; it is **not a proposed dissonance formula**.

| Pitch-class set (C=0) | Interval vector | Pair count | Seconds fraction |
| --- | --- | ---: | ---: |
| Major, 0 4 7 | 0 0 1 1 1 0 | 3 | 0.000 |
| Minor, 0 3 7 | 0 0 1 1 1 0 | 3 | 0.000 |
| Major seventh, 0 4 7 11 | 1 0 1 2 2 0 | 6 | 0.167 |
| Dominant seventh, 0 4 7 10 | 0 1 2 1 1 1 | 6 | 0.167 |
| Minor ninth, 0 2 3 7 10 | 1 2 2 2 3 0 | 10 | 0.300 |
| Chromatic cluster, 0 1 2 3 | 3 2 1 0 0 0 | 6 | 0.833 |
| Whole-tone set, 0 2 4 6 8 10 | 0 6 0 6 0 3 | 15 | 0.400 |
| All twelve classes | 12 12 12 12 12 6 | 66 | 0.364 |
| Set A, 0 1 4 6 | 1 1 1 1 1 1 | 6 | 0.333 |
| Set B, 0 1 3 7 | 1 1 1 1 1 1 | 6 | 0.333 |

These calculations expose limits rather than validating rankings. Major and minor coincide. Sets A/B coincide despite different pitch organization. A normalized seconds term can make all twelve classes appear less tense than the small cluster: normalization prevents pair-count explosion but can dilute a problematic interval. Raw pair sums instead grow quadratically with distinct pitch count. Neither automatically solves the density incentive.

C3/E3/G3 and C3/G3/E4 have identical pitch-class vectors. C3/E3/G3/C4 also has the same vector after deduplication. If doubling is retained as a multiset, it changes pair counts and can dilute average tension through unisons. Therefore deduplicate for a symbolic pitch-content term unless doubling intentionally changes it; preserve voice multiplicity separately for production and named chord instances. This is an option to decide, not a new rule.

Reproduction:

```python
from itertools import combinations

def vector(notes):
    bins = [0] * 6
    for a, b in combinations(sorted(set(n % 12 for n in notes)), 2):
        d = (b - a) % 12
        bins[min(d, 12-d)-1] += 1
    return bins
```

## Spatial scope is a game decision

| Scope | What it measures | Consequence to test |
| --- | --- | --- |
| Individual recognized chord | Each vocabulary instance in isolation | Explains each chord easily, but ignores interactions between overlapping chords; does not satisfy a collective-arrangement goal alone |
| Connected formation | Union of sounding voices connected through the existing chord graph | Preserves local accountability; adding one voice changes all members; spacer bridges become strategically significant |
| Whole board | Every sounding voice regardless of connection | Makes tuning globally consequential; isolated modules can alter everyone; requires reopening ADR-0036 and explaining remote rate changes |

Physics does not establish that hex adjacency separates sounds. If the board sounds simultaneously, whole-board interaction is the acoustic analogy; if it plays formations independently, formation scoring has a closer analogy. The game can choose either abstract scope without making a perceptual claim.

Test two disconnected major triads a semitone apart (C major and D-flat major). Individual chord scores see two familiar triads; collective scoring sees the union `0,1,4,5,7,8`, including cross-triad seconds. Then bridge them with a Spacer: formation scoring should change exactly when the connection changes, while whole-board scoring should stay invariant. Also test adding a zero-nous Harmonizer: its sounded pitch should be considered if the model measures harmony, even though its base production is zero. Decide eligibility alongside the module roster.

## Next human decision and experiments

Compare two symbolic options: named-chord/complexity rewards plus a bounded collective tension adjustment, versus shared-reference harmonicity plus a separate complexity reward. Retain an acoustic option only if actual simultaneous board sound, waveform spectra, tuning, and amplitude are specified. These are recommended comparisons, not selected formulas.

For the prototype, expose the component values independently. Compare fifth, major/minor triads, seventh/ninth chords, diminished/augmented sonorities, clusters, chromatic aggregates, register changes, doubled roots, disconnected conflicting formations, and spacer bridges. Inspect marginal production of adding/removing a voice, not only a score ranking. Confirm that an intentionally tense complex chord can outproduce a simple consonant one, and that mass overlap is not always the dominant strategy. No perceptual paper establishes the right multiplier size; that remains gameplay tuning and human evaluation.

Limitations: this research performed symbolic vector calculations only, not listening tests or a validated roughness/harmonicity model run. It does not choose a reference temperament, a universal consonance order, scoring scope, numerical penalty, or release boundary.
