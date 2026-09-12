# Economy design experiment

This is a standard-library Python model for reviewing the first-playable economy, not the future application's engine or a selected app stack.

From the repository root:

```sh
python3 -m unittest discover -s tools/economy -p 'test_*.py' -v
python3 tools/economy/simulate.py --output docs/economy-results.json
python3 tools/economy/report.py --input docs/economy-results.json --output docs/economy-report.md
```

The report renderer expects at least twelve sessions. `simulate.py --sessions N` can produce other lengths for independent inspection. Use `--config path/to/variant.json` to explore a copy of the baseline. The baseline is the accepted provisional configuration; sensitivity variants are experiments, not newly accepted rules.

The four policies are documented in the generated report. They only spend guaranteed starter copies and levels, bank all Forge rolls, and hold core placement fixed while searching gameplay placements. This avoids inventing unresolved type-draw rules and makes the numeric comparison reproducible, but cannot establish a global best strategy or validate engagement.

Changing `baseline.json` requires rerunning both generation commands. `economy-results.json` contains each session's income, spending, pre-management layout, end-of-management levels, reward counts, residual global progress, and queued charge. A 10^12 cumulative-nous guard stops runaway sensitivity runs; it is not a game limit.
