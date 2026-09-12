"""Accounting and design invariants, not app acceptance tests."""
import json
import unittest

from simulate import (CONFIG_PATH, ENTER, TIME, Module, Meter, State, adjacent,
                      best_layout, charged_factor, integrate, investment,
                      level_cost, rates, simulate, slots_for)


class EconomyTests(unittest.TestCase):
    def setUp(self):
        self.c = json.loads(CONFIG_PATH.read_text())
        self.core = [(Module("enter"), ENTER), (Module("time"), TIME)]

    def test_single_shared_rate_and_fractional_accumulation(self):
        placed = self.core + [(Module("additive"), (0, 0))]
        self.assertAlmostEqual(rates(placed, True, False, self.c)[0], .18)
        self.assertAlmostEqual(rates(placed, True, True, self.c)[0], .27)
        self.assertAlmostEqual(integrate(placed, True, 60, 600, self.c)[0], 113.4)

    def test_inactive_time_has_no_effect_or_generation(self):
        self.assertEqual(rates(self.core, False, True, self.c), (.1, 0., 0.))

    def test_generator_does_not_charge_itself(self):
        # Enter gets +50%; Time's ×1.2 stays unchanged.
        self.assertAlmostEqual(rates(self.core, True, True, self.c)[0], .18)

    def test_same_multiplier_type_adds_bonuses(self):
        placed = self.core + [(Module("conditional"), (0, 0)), (Module("conditional"), (2, -1))]
        self.assertAlmostEqual(rates(placed, True, False, self.c)[0], .1 * 1.2 * 1.4)

    def test_infusors_add_and_only_empower_multiplier_bonus(self):
        placed = self.core + [(Module("infusor"), (0, 0)), (Module("infusor"), (2, -1))]
        self.assertAlmostEqual(rates(placed, True, False, self.c)[0], .1 * 1.4 * (1 + .2 * 1.4))
        self.assertAlmostEqual(rates(placed, True, True, self.c)[0], .1 * 1.6 * 1.5 * (1 + .2 * 1.6))

    def test_full_charge_to_both_receivers_without_infusor_amplification(self):
        placed = self.core + [(Module("forge"), (0, 0)), (Module("expander"), (2, 0)),
                              (Module("infusor"), (2, -1))]
        _, forge, expansion = integrate(placed, True, 60, 600, self.c)
        self.assertEqual((forge, expansion), (60, 60))

    def test_global_meter_batching_and_carry(self):
        one, chunks = Meter(60, 1.5), Meter(60, 1.5)
        one.add(300)
        for _ in range(300):
            chunks.add(1)
        self.assertEqual(one.earned, 3)
        self.assertAlmostEqual(one.progress, 15)
        self.assertEqual(one.earned, chunks.earned)
        self.assertAlmostEqual(one.progress, chunks.progress)

    def test_duplicate_forges_share_threshold_not_reward_count(self):
        placed = self.core + [(Module("forge"), (0, 0)), (Module("forge"), (2, 0))]
        progress = integrate(placed, True, 60, 600, self.c)[1]
        meter = Meter(60, 1.5)
        meter.add(progress)
        self.assertEqual(meter.earned, 1)
        self.assertEqual(meter.progress, 60)
        self.assertEqual(meter.threshold, 90)

    def test_global_progress_survives_layout_and_module_changes(self):
        state = State(self.c)
        state.forge.add(42)
        state.modules["forge"] = Module("forge", 4)
        best_layout(state, "forge_first")
        del state.modules["forge"]
        self.assertEqual(state.forge.progress, 42)
        self.assertEqual(state.forge.earned, 0)

    def test_open_ended_segment_only_uses_existing_charge(self):
        placed = self.core + [(Module("forge"), (0, 0))]
        self.assertEqual(integrate(placed, True, 0, 3600, self.c)[1], 0)
        self.assertEqual(integrate(placed, True, 60, 3600, self.c)[1], 60)

    def test_zero_elapsed_time_produces_nothing(self):
        self.assertEqual(integrate(self.core, True, 60, 0, self.c), (0, 0, 0))

    def test_splitting_integration_preserves_income(self):
        full = integrate(self.core, True, 60, 600, self.c)[0]
        split = integrate(self.core, True, 60, 20, self.c)[0] + integrate(self.core, True, 40, 580, self.c)[0]
        self.assertAlmostEqual(full, split)

    def test_intro_numbers_and_no_retroactive_completion_burst(self):
        rows = simulate(self.c, "baseline", 3)
        self.assertEqual([r["income"] for r in rows[:2]], [60, 72])
        self.assertEqual(rows[1]["balance_after_management"], 12)
        self.assertAlmostEqual(rows[2]["income"], 113.4)
        self.assertEqual(rows[2]["rolls_banked"], 1)

    def test_expansion_shape_connected_and_core_cells_reserved(self):
        for count in range(10):
            slots = slots_for(count)
            board = set(slots) | {(1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1)}
            self.assertEqual(len(board), 8 + count)
            reached = {next(iter(board))}
            while True:
                updated = reached | {p for p in board if any(adjacent(p, q) for q in reached)}
                if updated == reached:
                    break
                reached = updated
            self.assertEqual(board, reached)

    def test_costs_rarity_and_diminishing_returns(self):
        self.assertEqual([level_cost(i, self.c) for i in range(5)], [10, 16, 26, 41, 66])
        self.assertEqual(investment(4, self.c), 93)
        self.assertEqual(Module("forge", 0, "rare").power(self.c), 1)
        bonuses = [charged_factor(i) for i in range(4)]
        self.assertGreater(bonuses[1] - bonuses[0], bonuses[2] - bonuses[1])
        self.assertGreater(bonuses[2] - bonuses[1], bonuses[3] - bonuses[2])

    def test_routes_conserve_income_and_never_overspend(self):
        for strategy in ("baseline", "production_first", "forge_first", "expansion_first"):
            rows = simulate(self.c, strategy, 12)
            final = rows[-1]
            starters = sum(self.c["starter_prices"].get(kind, 0) for kind in final["owned_levels"])
            levels = sum(investment(level, self.c) for level in final["owned_levels"].values())
            self.assertAlmostEqual(final["total_income"], final["balance_after_management"] + starters + levels, places=5)
            self.assertTrue(all(row["balance_after_management"] >= -1e-6 for row in rows))

    def test_layout_snapshot_precedes_management_upgrades(self):
        rows = simulate(self.c, "forge_first", 3)
        row = rows[-1]
        during = next(m["level"] for m in row["deployed"] if m["type"] == "forge")
        self.assertEqual(during, 1)
        self.assertEqual(row["owned_levels"]["forge"], 2)

    def test_fixed_timeline_is_reproducible(self):
        self.assertEqual(simulate(self.c, "production_first", 4), simulate(self.c, "production_first", 4))


if __name__ == "__main__":
    unittest.main()
