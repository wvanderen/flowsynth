"""Deterministic design experiment, not the game runtime. Python standard library only.

Run: python3 tools/economy/simulate.py --output docs/economy-results.json
No random module rewards are spent: policies compare guaranteed starter economies.
The initial core positions are held fixed; gameplay placements are searched exactly
on this board. Free board reshaping is an accepted game rule, not modeled here.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_CEILING
from itertools import permutations
import json
import math
from pathlib import Path


CONFIG_PATH = Path(__file__).with_name("baseline.json")
DIRECTIONS = ((1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1))
TIME = (1, 0)
ENTER = (1, -1)
RING = set(DIRECTIONS)


def adjacent(a, b):
    return (b[0] - a[0], b[1] - a[1]) in DIRECTIONS


def charged_factor(strength):
    # Continuous interpolation through the accepted 1, 2, 3 strength examples.
    # Only strengths 0 and 1 occur in the first-playable routes.
    return 1 + strength / (1 + strength)


@dataclass
class Module:
    kind: str
    level: int = 0
    rarity: str = "common"

    def power(self, config):
        return config["rarity_power"][self.rarity] ** self.level


@dataclass
class Meter:
    initial: float
    growth: float
    progress: float = 0
    earned: int = 0

    @property
    def threshold(self):
        return self.initial * self.growth ** self.earned

    def add(self, progress):
        self.progress += progress
        while self.progress + 1e-9 >= self.threshold:
            self.progress = max(0.0, self.progress - self.threshold)
            self.earned += 1


def level_cost(level, config):
    # Round the unrounded geometric sequence, not the previous rounded price.
    raw = Decimal(str(config["upgrade_first_cost"])) * Decimal(str(config["upgrade_cost_growth"])) ** level
    return int(raw.to_integral_value(rounding=ROUND_CEILING))


def investment(level, config):
    return sum(level_cost(i, config) for i in range(level))


def rates(placed, time_active, charge_active, config):
    """Return shared nous/s and progress/s for each global meter."""
    active = [(m, p) for m, p in placed if m.kind != "time" or time_active]
    strengths = {p: int(charge_active and time_active and adjacent(p, TIME)) for _, p in active}
    infusors = [(p, config["infusor_bonus"] * m.power(config) * charged_factor(strengths[p]))
                for m, p in active if m.kind == "infusor"]
    core_positions = [p for m, p in active if m.kind in ("enter", "time")]
    base, time_bonus, conditional_bonus, forge, expansion = 0., 0., 0., 0., 0.
    for module, position in active:
        strength = strengths[position]
        local_bonus = sum(b for p, b in infusors if adjacent(position, p))
        effect = module.power(config) * (1 + local_bonus) * charged_factor(strength)
        if module.kind == "enter":
            base += config["base_rate"] * effect
        elif module.kind == "additive":
            base += config["additive_rate"] * effect
        elif module.kind == "time":
            time_bonus += config["time_bonus"] * effect
        elif module.kind == "conditional":
            count = sum(adjacent(position, p) for p in core_positions)
            conditional_bonus += config["conditional_bonus_per_active_core"] * count * effect
        elif module.kind == "forge":
            forge += strength * module.power(config)
        elif module.kind == "expander":
            expansion += strength * module.power(config)
    return base * (1 + time_bonus) * (1 + conditional_bonus), forge, expansion


def integrate(placed, time_active, queued_seconds, duration, config):
    # No mid-session purchases. A completion at the exact ending boundary queues
    # charge for the next segment/session; it does not act retroactively.
    on = min(queued_seconds, duration)
    charged = rates(placed, time_active, True, config)
    idle = rates(placed, time_active, False, config)
    return tuple(on * a + (duration - on) * b for a, b in zip(charged, idle))


def slots_for(expansions):
    """Grow a connected board, preferring available cells beside Time and Enter."""
    board = RING | {(0, 0), (2, 0)}
    slots = [(0, 0), (2, 0)]
    for _ in range(expansions):
        frontier = {(q + dq, r + dr) for q, r in board for dq, dr in DIRECTIONS} - board
        cell = min(frontier, key=lambda p: (-int(adjacent(p, TIME)),
                                            -int(adjacent(p, ENTER)), abs(p[0]) + abs(p[1]), p))
        slots.append(cell)
        board.add(cell)
    return slots


@dataclass
class State:
    config: dict
    nous: float = 0
    total_income: float = 0
    charge: float = 0
    time_active: bool = False
    modules: dict = field(default_factory=lambda: {"enter": Module("enter"), "time": Module("time")})
    last_placed: list = field(default_factory=list)
    session: int = 0

    def __post_init__(self):
        c = self.config
        self.forge = Meter(c["forge_initial_threshold"], c["forge_threshold_growth"])
        self.expansion = Meter(c["expansion_initial_threshold"], c["expansion_threshold_growth"])


def objective(output, state, strategy):
    income, forge, expansion = output
    # Policy-specific ranking, not a claim of an optimal economic value function.
    # Rush routes prioritize their named meter, then the other meter, then income.
    if strategy == "forge_first":
        return forge, expansion, income
    if strategy == "expansion_first":
        return expansion, forge, income
    if strategy == "baseline" and state.expansion.earned == 0 and "expander" in state.modules:
        return expansion, forge, income
    return income, forge, expansion


def best_layout(state, strategy):
    core = [(state.modules["enter"], ENTER), (state.modules["time"], TIME)]
    inventory = [m for k, m in state.modules.items() if k not in ("enter", "time")]
    slots = slots_for(state.expansion.earned)
    best, best_score = core, None
    # Effects are nonnegative and there are no upkeep costs, so fill all available
    # slots up to inventory size. This enumerates subsets if inventory exceeds slots.
    count = min(len(slots), len(inventory))
    if len(inventory) <= len(slots):
        arrangements = (list(zip(inventory, ps)) for ps in permutations(slots, count))
    else:
        arrangements = (list(zip(ms, slots)) for ms in permutations(inventory, count))
    for arrangement in arrangements:
        placed = core + arrangement
        result = integrate(placed, state.time_active, state.charge, state.config["session_seconds"], state.config)
        score = objective(result, state, strategy)
        if best_score is None or score > best_score:
            best, best_score = placed, score
    return best


def buy_and_upgrade(state, strategy, upgrade_unlock):
    actions = []
    store_open = state.session >= 2
    levels_open = state.session >= (1 if upgrade_unlock == "after_first" else 2)
    if strategy == "baseline":
        order = ["additive", "forge", "expander", "conditional", "infusor"]
    elif strategy == "forge_first":
        order = ["forge", "additive", "expander", "infusor", "conditional"]
    elif strategy == "expansion_first":
        order = ["expander", "additive", "forge", "infusor", "conditional"]
    else:
        order = []
    if store_open:
        for kind in order:
            if kind in state.modules:
                continue
            cost = state.config["starter_prices"][kind]
            if state.nous + 1e-9 < cost:
                break
            state.nous -= cost
            state.modules[kind] = Module(kind)
            actions.append(f"buy {kind} ({cost})")
    # Baseline intentionally never buys levels. Rush routes buy their named
    # machine's levels from leftovers after the starter priority purchases.
    if levels_open and strategy in ("forge_first", "expansion_first"):
        kind = "forge" if strategy == "forge_first" else "expander"
        module = state.modules.get(kind)
        while module and state.nous + 1e-9 >= level_cost(module.level, state.config):
            cost = level_cost(module.level, state.config)
            state.nous -= cost
            module.level += 1
            actions.append(f"upgrade {kind} L{module.level} ({cost})")
    if levels_open and strategy == "production_first":
        # Greedy next-session nous gain per purchase price, considering every
        # available level and starter copy; consumes all affordable positive gains.
        while True:
            before = integrate(best_layout(state, strategy), state.time_active, state.charge,
                               state.config["session_seconds"], state.config)[0]
            candidates = []
            for kind, module in list(state.modules.items()):
                if kind == "time" and not state.time_active:
                    continue
                cost = level_cost(module.level, state.config)
                if state.nous + 1e-9 < cost:
                    continue
                module.level += 1
                after = integrate(best_layout(state, strategy), state.time_active, state.charge,
                                  state.config["session_seconds"], state.config)[0]
                module.level -= 1
                if after > before + 1e-9:
                    candidates.append(((after - before) / cost, "level", kind, cost))
            if store_open:
                for kind, cost in state.config["starter_prices"].items():
                    if kind in state.modules or state.nous + 1e-9 < cost:
                        continue
                    state.modules[kind] = Module(kind)
                    after = integrate(best_layout(state, strategy), state.time_active, state.charge,
                                      state.config["session_seconds"], state.config)[0]
                    del state.modules[kind]
                    if after > before + 1e-9:
                        candidates.append(((after - before) / cost, "buy", kind, cost))
            if not candidates:
                break
            _, action, kind, cost = max(candidates)
            state.nous -= cost
            if action == "buy":
                state.modules[kind] = Module(kind)
            else:
                state.modules[kind].level += 1
            actions.append(f"{action} {kind} ({cost})")
    return actions


def simulate(config, strategy, sessions=12, upgrade_unlock="store"):
    state, rows = State(config), []
    for number in range(1, sessions + 1):
        placed = best_layout(state, strategy)
        start_rate = rates(placed, state.time_active, state.charge > 0, config)[0]
        income, forge, expansion = integrate(placed, state.time_active, state.charge,
                                            config["session_seconds"], config)
        state.nous += income
        state.total_income += income
        state.forge.add(forge)
        state.expansion.add(expansion)
        state.charge = max(0, state.charge - config["session_seconds"])
        if state.time_active:
            state.charge += config["session_seconds"] * config["charge_seconds_per_practice_second"]
        state.time_active = True
        state.session = number
        earned_balance = state.nous
        deployed_snapshot = [{"type": m.kind, "position": list(p), "level": m.level} for m, p in placed]
        # Guard the exploratory model, not the proposed game's number range.
        # Stop before extreme sensitivity cases exhaust float/Decimal precision.
        outside_range = not math.isfinite(income) or state.total_income > 1e12
        actions = [] if outside_range else buy_and_upgrade(state, strategy, upgrade_unlock)
        rows.append({
            "session": number, "income": round(income, 6), "balance_before_management": round(earned_balance, 6),
            "balance_after_management": round(state.nous, 6), "total_income": round(state.total_income, 6),
            "start_nous_per_second": round(start_rate, 6), "rolls_banked": state.forge.earned,
            "forge_progress": round(state.forge.progress, 6), "forge_next_threshold": round(state.forge.threshold, 6),
            "cells_earned": state.expansion.earned, "expansion_progress": round(state.expansion.progress, 6),
            "expansion_next_threshold": round(state.expansion.threshold, 6),
            "charge_seconds_banked": state.charge, "actions": actions,
            "deployed": deployed_snapshot,
            "owned_levels": {k: m.level for k, m in state.modules.items()}
        })
        if outside_range:
            rows[-1]["stop_reason"] = "Exceeded the exploratory 1e12 cumulative-nous range; not a game cap."
            break
    return rows


def combination_comparison(config):
    rows = []
    for level in (0, 1, 4, 8, 12, 17):
        two = 2 * config["rarity_power"]["common"] ** level
        combined = config["rarity_power"]["uncommon"] ** level
        refund = investment(level, config)
        budget, reinvested = refund, level
        while budget >= level_cost(reinvested, config):
            budget -= level_cost(reinvested, config)
            reinvested += 1
        rows.append({"input_level": level, "two_common_power": two, "one_uncommon_power": combined,
                     "refund": refund, "reinvested_level": reinvested,
                     "reinvested_uncommon_power": config["rarity_power"]["uncommon"] ** reinvested,
                     "refund_left": budget})
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=CONFIG_PATH)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--sessions", type=int, default=12)
    args = parser.parse_args()
    config = json.loads(args.config.read_text())
    strategies = ("baseline", "production_first", "forge_first", "expansion_first")
    result = {
        "config": config,
        "assumptions": [
            "Ten-minute sessions stop at their target; completion charge acts next session.",
            "Fixed initial core positions; exact gameplay placement search on a deterministic connected expansion shape.",
            "Rolls remain banked; no random module rewards or combinations are spent in route trajectories.",
            "Production-first maximizes immediate nous gain/price, not long-term utility; rush routes follow documented priorities.",
            "All purchases are common; expansion cells are placed before the next session, at no nous cost.",
            "Upgrade prices use ceil(first_cost * growth ** current_level), with no recursive rounding.",
            "Continuous empowerment interpolation is 1+s/(1+s); route results only use strengths zero and one.",
            "Levels unlock with the store. Earlier unlocking is retained as a historical sensitivity comparison; level curves remain provisional."
        ],
        "routes": {s: simulate(config, s, args.sessions) for s in strategies},
        "early_upgrade_sensitivity": simulate(config, "production_first", args.sessions, "after_first"),
        "cost_growth_sensitivity": {},
        "paired_power_cost_sensitivity": {},
        "combination": combination_comparison(config),
        "rarity": {"at_least_one_noncommon_per_roll": 1 - config["rarity_probability"]["common"] ** 3,
                   "at_least_one_rare_per_roll": 1 - (1 - config["rarity_probability"]["rare"]) ** 3},
        "upgrade_prices": [level_cost(i, config) for i in range(12)]
    }
    for growth in (1.15, 1.3, 1.6):
        variant = dict(config, upgrade_cost_growth=growth)
        result["cost_growth_sensitivity"][str(growth)] = simulate(variant, "production_first", args.sessions)
    for growth, power in ((1.15, 1.05), (1.3, 1.1)):
        variant = dict(config, upgrade_cost_growth=growth,
                       rarity_power={"common": power, "uncommon": power + .025, "rare": power + .05})
        key = f"cost {growth}, common power {power}"
        result["paired_power_cost_sensitivity"][key] = simulate(variant, "production_first", args.sessions)
    rendered = json.dumps(result, indent=2, allow_nan=False) + "\n"
    if args.output:
        args.output.write_text(rendered)
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
