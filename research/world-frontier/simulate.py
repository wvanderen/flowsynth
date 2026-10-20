#!/usr/bin/env python3
"""Hypothesis model v2, not the FlowSynth engine. Units: credited minutes and 1T nous.

Extends hypothesis-v1 (commit 4eaac5f) under the #421 prototype amendments, as
the #424 re-derivation requires: Arete purchases are permanent (no refund path
exists); weapons are never sold — the starter is granted outright at the first
World-eligible claim and further copies arrive on the class-skill roll cadence;
Arete buys persistent type-level power upgrades; Charge Columns remain the only
direct Arete product. Every figure below is a labelled hypothesis, not selected
balance. All modelled time is credited flow."""
import json, math, random
from pathlib import Path

# ---- hypothesis knobs (test values, not adopted tuning) --------------------
CURVES = {
    'log': lambda x: 2 + 2 * math.log10(x),
    'sqrt_log': lambda x: 2 + 3 * math.sqrt(math.log10(x)),
    'power_015': lambda x: 2 * x ** .15,
}
ENTRY = 1.0                 # x = era-earned/1e12 where World opens
COLUMN_PRICE = 1            # base Arete per Charge Column (swept 0.5..4)
COLUMN_LADDER = 'flat'      # 'flat' or 'doubling' (k-th Column costs base*2**(k-1))
POWER_BASE = 2.0            # starter type power
POWER_PRICE = 'flat'        # 'flat' (+1 power per Arete) or 'increasing' (k-th rank costs k)
ROLL_MINUTES = 120.0        # credited Engineer minutes per weapon roll (swept 30..240)
CADENCE = 1.0               # attacks per minute per weapon (v1 cap)
ATTACK_COST = 1.0           # charge per attack
COLUMN_SUPPLY = 1.0         # charge/minute lifted per Column (fuels one attack/min)
def damage_of(power): return power * power / 4.0   # prototype curve, per shot
PENALTY, BONUS = 0.8, 1.08  # v1 debuff/victory factors
RIG_BASE, RIG_GROWTH = 0.04, 0.025  # v1 retained-rig proxy (unfitted)
REACH_MINUTES, REACH_COST = 4, 0.1  # v1 path abstraction
UPTIME = 1.0                # placement quality multiplier (sensitivity 0.25/0)
MAX_MINUTES, DT = 3000.0, 0.05
DEPTH0, DEPTH1 = 0, 8       # sampled frontier depths (v1 continuity)

def entitlement(score, curve):
    return 0.0 if score < ENTRY else CURVES[curve](score)

def column_cost(k):
    """Arete price of the k-th Column (1-indexed), ladder hypothesis."""
    return COLUMN_PRICE * (2 ** (k - 1) if COLUMN_LADDER == 'doubling' else 1)

def power_cost(k):
    """Arete price of the k-th power rank (1-indexed), price hypothesis."""
    return k if POWER_PRICE == 'increasing' else 1

class Ledger:
    """Cumulative frontier claim with whole-Arete banking and fraction carry.
    No refund exists: the wallet only ever grows by claims and shrinks by spends."""
    def __init__(self, curve):
        self.curve, self.frontier = curve, 0.0
        self.wallet, self.carry, self.grants, self.spent = 0, 0.0, 0, 0
    def pending(self, score):
        return max(0.0, entitlement(score, self.curve) - entitlement(self.frontier, self.curve))
    def reset(self, score):
        total = self.pending(score) + self.carry
        banked = math.floor(total)
        self.carry = total - banked
        self.wallet += banked
        self.frontier = max(self.frontier, score)
        granted = False
        if self.grants == 0 and score >= ENTRY:
            self.grants += 1        # starter weapon: exactly once, ever
            granted = True
        return banked, granted
    def spend(self, amount):
        assert 0 <= amount <= self.wallet, 'wallet underflow: no refund exists'
        self.wallet -= amount
        self.spent += amount

class Build:
    """Persistent World purchases. Columns and type power survive prestige."""
    def __init__(self):
        self.columns, self.power_rank, self.weapons = 0, 0, 0
    def power(self):
        return POWER_BASE + self.power_rank
    def dps(self, uptime=UPTIME):
        if self.columns < 1 or self.weapons < 1:
            return 0.0
        shots = min(self.weapons * CADENCE, self.columns * COLUMN_SUPPLY / ATTACK_COST)
        return uptime * shots * damage_of(self.power())
    def afford_columns(self, wallet, want):
        n, spent = 0, 0
        while n < want:
            c = column_cost(n + 1)
            if spent + c > wallet: break
            spent += c; n += 1
        return n, spent

def spend_optimal(ledger, build, want_columns=1):
    """Reference allocation: up to `want_columns` Columns, remainder all-in power."""
    n, spent = build.afford_columns(ledger.wallet, want_columns)
    build.columns += n
    ledger.spend(spent)
    while power_cost(build.power_rank + 1) <= ledger.wallet:
        build.power_rank += 1
        ledger.spend(power_cost(build.power_rank))
    return n

def run_era(build, target, start=0., penalty=PENALTY, bonus=BONUS, uptime=UPTIME,
            reach_minutes=REACH_MINUTES, max_minutes=MAX_MINUTES, growth=RIG_GROWTH,
            reach_cost=REACH_COST, dt=DT, roll_minutes=ROLL_MINUTES, enemies_n=9,
            track=None):
    """One era from score `start`. Rolls bank every `roll_minutes` credited minutes
    (Engineer selected throughout — the single-habit assumption). Purchases are
    fixed at era start; nothing mid-era can be bought (between-sessions only)."""
    score, t = start, 0.0
    encountered, arrivals = {}, {}
    killed = set()
    reach_spent, reachable = 0.0, set()
    first_kill, rolls_banked, trace = None, 0, []
    while t < max_minutes and score < target:
        for i in range(enemies_n):
            if score >= 10.0 ** i and i not in encountered:
                encountered[i] = 12 * 1.5 ** i
                arrivals[i] = t + reach_minutes * (1 + i / 4)
                trace.append({'minute': round(t, 2), 'event': 'discover', 'enemy': i,
                              'score': round(score, 4)})
        new_rolls = int((t + dt) / roll_minutes) - int(t / roll_minutes)
        if new_rolls:
            build.weapons += new_rolls
            rolls_banked += new_rolls
        alive = [i for i in encountered if i not in killed]
        factor = penalty ** len(alive) * bonus ** len(killed)
        score += RIG_BASE * math.exp(min(growth * t, 50)) * factor * dt
        for i in alive:
            cost = reach_cost * 10.0 ** i
            if i not in reachable and t >= arrivals[i] and score - reach_spent >= cost:
                reach_spent += cost
                reachable.add(i)
        attackable = [i for i in alive if i in reachable]
        dps = build.dps(uptime)
        if attackable and dps > 0:
            # Weapons engage distinct targets; supply-capped shots split evenly.
            active = min(build.weapons, len(attackable))
            per_target = dps / active
            for i in attackable[:active]:
                encountered[i] -= per_target * dt
                if encountered[i] <= 0 and i not in killed:
                    killed.add(i)
                    if first_kill is None:
                        first_kill = t
                    trace.append({'minute': round(t, 2), 'event': 'victory', 'enemy': i,
                                  'score': round(score, 4)})
        t += dt
    if track is not None:
        track.append({'era_start': start, 'target': target, 'minutes': round(t, 2),
                      'score': round(score, 4), 'reached': score >= target,
                      'victories': len(killed), 'first_kill_minute': first_kill,
                      'rolls_banked': rolls_banked, 'reach_spent_T': round(reach_spent, 4),
                      'columns': build.columns, 'power_rank': build.power_rank,
                      'weapons': build.weapons, 'trace': trace})
    return score

def entry_minutes(growth=RIG_GROWTH, penalty=PENALTY):
    """Proxy minutes for a fresh rig to earn 1T era-nous (v1 trajectory; the first
    enemy's debuff runs from discovery). Deterministic integration."""
    score, t = 0.0, 0.0
    while score < ENTRY and t < MAX_MINUTES:
        score += RIG_BASE * math.exp(min(growth * t, 50)) * (penalty if t >= 10 else 1.0) * DT
        t += DT
    return t

def main():
    global COLUMN_PRICE, ROLL_MINUTES
    results = {'model': 'hypothesis-v2-norefund', 'entry_minutes_proxy': 0,
               'first_claim': [], 'frontier_checks': [], 'recovery': [],
               'allocations': [], 'strategies': [], 'sensitivities': [],
               'grant_invariants': []}
    results['entry_minutes_proxy'] = round(entry_minutes(), 2)

    # ---- ledger invariants: whole-Arete banking, fraction carry, grant-once --
    for curve in CURVES:
        ledger = Ledger(curve)
        assert ledger.reset(ENTRY - .01) == (0, False)
        assert entitlement(ENTRY, curve) >= COLUMN_PRICE, 'first-claim guarantee by construction'
        banked, granted = ledger.reset(ENTRY)
        assert banked >= COLUMN_PRICE and granted, 'guaranteed starter claim banks >= Column'
        assert ledger.reset(ENTRY) == (0, False), 'no second grant, no repeat depth reward'
        assert ledger.reset(ENTRY * .5) == (0, False)
        # random partition splittings telescope: banked total is the single claim's
        rng = random.Random(20261019)
        for _ in range(20):
            seq, pts = [], ENTRY
            while pts < 1000:
                pts *= rng.uniform(1.0, 3.0)
                seq.append(pts)
            led = Ledger(curve)
            total = sum(led.reset(s)[0] for s in seq)
            single, _b = Ledger(curve), None
            b1, _ = single.reset(pts)
            near_integer = abs(entitlement(pts, curve) - round(entitlement(pts, curve))) < 1e-9
            assert total == b1 or near_integer, 'partition independence with whole-Arete carry'
            assert led.grants == 1, 'starter granted exactly once under arbitrary splittings'
        one = Ledger(curve)
        b, _ = one.reset(1000)
        assert b >= COLUMN_PRICE
        one.spend(min(one.wallet, 3))
        assert one.wallet >= 0 and one.spent <= b, 'wallet conservation, no refund path'
        results['grant_invariants'].append({'curve': curve,
                                            'entry_claim': int(entitlement(ENTRY, curve)),
                                            'single_claim_to_1000': int(b)})

    # ---- Q2: the first-claim guarantee sized against Column price ------------
    for price in [0.5, 1, 2, 4]:
        build = Build(); build.weapons = 1          # granted starter
        bought = min(price, 2.0)                    # the claim banks exactly 2 at entry
        build.columns = 1 if price <= 2 else 0
        leftover = 2 - bought
        while price <= 2 and power_cost(build.power_rank + 1) <= leftover:
            leftover -= power_cost(build.power_rank + 1)
            build.power_rank += 1
        clear1 = 12 / build.dps() if build.dps() > 0 else None
        results['first_claim'].append({
            'column_price': price, 'guarantee_holds': entitlement(ENTRY, 'log') >= price,
            'entry_kit_power': build.power(), 'columns': build.columns,
            'enemy1_clear_minutes': round(clear1, 2) if clear1 else None,
            'enemy2_clear_minutes': round(18 / build.dps(), 2) if build.dps() > 0 else None})

    # ---- Q1a: per-frontier fresh-optimal witnesses (v1 continuity) -----------
    for curve in CURVES:
        for depth in range(DEPTH0, DEPTH1 + 1):
            score = 10.0 ** depth
            ledger = Ledger(curve)
            banked, granted = ledger.reset(score)
            assert granted
            build = Build(); build.weapons = 1
            spend_optimal(ledger, build)
            tr = []
            run_era(build, score * 1.1, track=tr)
            hp = 12 * 1.5 ** depth
            results['frontier_checks'].append({
                'curve': curve, 'depth': depth, 'wallet': banked,
                'columns': build.columns, 'power_rank': build.power_rank,
                'weapons': build.weapons, 'dps': round(build.dps(), 4),
                'enemy_clear_minutes': round(hp / build.dps(), 2) if build.dps() > 0 else None,
                'return_minutes': tr[0]['minutes'], 'reached_110': tr[0]['reached'],
                'victories': tr[0]['victories'], 'first_kill': tr[0]['first_kill_minute'],
                'rolls_banked_in_return': tr[0]['rolls_banked']})

    # ---- Q1b: all-prior-waste recovery (the no-refund break test) ------------
    for curve in CURVES:
        for depth in range(1, DEPTH1 + 1):
            led = Ledger(curve)
            led.reset(10.0 ** (depth - 1))
            if led.wallet:
                led.spend(led.wallet)               # wasted, permanently
            banked, _granted = led.reset(10.0 ** depth)
            build = Build(); build.weapons = 1      # the starter persists the waste
            combat_possible = banked >= column_cost(1)
            row = {'curve': curve, 'depth': depth, 'marginal_claim': banked,
                   'combat_possible': combat_possible}
            if combat_possible:
                spend_optimal(led, build)
                tr = []
                run_era(build, 10.0 ** depth * 1.1, track=tr)
                row.update({'columns': build.columns, 'power_rank': build.power_rank,
                            'dps': round(build.dps(), 4), 'surpass_minutes': tr[0]['minutes'],
                            'victories': tr[0]['victories'], 'surpassed': tr[0]['reached']})
            else:
                # push deeper until one marginal claim funds a Column
                k, b2 = depth, 0
                while k < DEPTH1 + 6:
                    k += 1
                    b2, _ = led.reset(10.0 ** k)
                    if b2 >= column_cost(1):
                        break
                row['recovery_depth'] = k
                row['recovery_claim'] = b2
                tr2 = []                            # combatless rig push to the recovery depth
                run_era(Build(), 10.0 ** k, start=10.0 ** (depth - 1), track=tr2)
                row['recovery_push_minutes'] = tr2[0]['minutes']
            results['recovery'].append(row)

    # ---- Q1c: over-priced Column ladders on the fresh wallet -----------------
    for price in [1, 2, 4]:
        COLUMN_PRICE = price
        first_dead = None
        for curve in CURVES:
            for depth in range(DEPTH0, DEPTH1 + 1):
                if math.floor(entitlement(10.0 ** depth, curve)) < price:
                    first_dead = first_dead or {'curve': curve, 'depth': depth}
        results['sensitivities'].append({'settings': {'column_price': price},
                                         'first_combat_dead_frontier': first_dead})
    COLUMN_PRICE = 1

    # ---- Q4: allocation sweep over the first three encounters ----------------
    for curve in CURVES:
        for depth in [0, 1, 2]:
            score = 10.0 ** depth
            for want_columns in range(1, 5):
                led = Ledger(curve)
                led.reset(score)
                build = Build()
                build.weapons = 1            # the granted starter; further copies roll live
                n, spent = build.afford_columns(led.wallet, want_columns)
                if n < want_columns:
                    continue
                build.columns = n
                led.spend(spent)
                while power_cost(build.power_rank + 1) <= led.wallet:
                    build.power_rank += 1
                    led.spend(power_cost(build.power_rank))
                tr = []
                run_era(build, score * 1.1, track=tr, enemies_n=3)
                results['allocations'].append({
                    'curve': curve, 'depth': depth, 'columns': n,
                    'weapons': build.weapons, 'power_rank': build.power_rank,
                    'dps': round(build.dps(), 4), 'minutes': tr[0]['minutes'],
                    'victories': tr[0]['victories']})

    # ---- Q3: roll cadence against the granted start --------------------------
    for roll_minutes in [30.0, 60.0, 120.0, 240.0]:
        led = Ledger('log')
        build = Build()
        tr = []
        run_era(build, ENTRY, track=tr, roll_minutes=roll_minutes)
        entry = tr[0]
        banked, granted = led.reset(ENTRY)
        if granted:
            build.weapons += 1                      # the starter, at the first claim
        weapons_at_era2_start = build.weapons
        spend_optimal(led, build)
        tr2 = []
        run_era(build, 100.0, track=tr2, enemies_n=3, roll_minutes=roll_minutes)
        results['strategies'].append({'scenario': 'roll_sweep', 'roll_minutes': roll_minutes,
                                      'entry_era': entry, 'era2': tr2[0],
                                      'weapons_at_era2_start': weapons_at_era2_start,
                                      'weapons_after_era2': tr2[0]['weapons']})
    ROLL_MINUTES = 120.0

    # ---- Q3: push-versus-reset under the amended economy ---------------------
    for curve in CURVES:
        for targets in [[100.0], [ENTRY, 100.0], [ENTRY, 10.0, 100.0]]:
            led, total, eras = Ledger(curve), 0.0, []
            build = Build()
            for target in targets:
                tr = []
                run_era(build, target, track=tr)
                era = tr[0]
                banked, granted = led.reset(era['score'])
                if granted:
                    build.weapons += 1
                if led.wallet:
                    spend_optimal(led, build)
                total += era['minutes']
                eras.append({'target': target, 'minutes': era['minutes'], 'claim': banked,
                             'banked': led.wallet, 'victories': era['victories'],
                             'first_kill': era['first_kill_minute'],
                             'build': {'columns': build.columns,
                                       'power_rank': build.power_rank,
                                       'weapons': build.weapons}})
            results['strategies'].append({'scenario': 'push_vs_reset', 'curve': curve,
                                          'targets': targets, 'minutes': round(total, 2),
                                          'eras': eras})

    # ---- sensitivities (v1 style, amended economy) ---------------------------
    for settings in [{'uptime': 0.25}, {'uptime': 0.0}, {'reach_cost': 1.0},
                     {'reach_cost': 10.0}, {'penalty': 0.5}, {'bonus': 1.0},
                     {'growth': 0.01}, {'reach_minutes': 40}, {'dt': 0.025}]:
        build = Build(); build.weapons = 1; build.columns = 1
        spent = 0
        while True:
            c = power_cost(build.power_rank + 1)
            if spent + c > 6:
                break
            spent += c
            build.power_rank += 1
        tr = []
        run_era(build, 1000.0, track=tr, **settings)
        results['sensitivities'].append({'settings': settings, 'minutes': tr[0]['minutes'],
                                         'victories': tr[0]['victories'],
                                         'first_kill': tr[0]['first_kill_minute']})

    Path(__file__).with_name('results-no-refund.json').write_text(
        json.dumps(results, indent=2) + '\n')
    print('Ledger invariants passed; wrote results-no-refund.json')
    print('entry proxy minutes', results['entry_minutes_proxy'])
    for r in results['first_claim']:
        print('claim', r)
    for curve in CURVES:
        rows = [r for r in results['frontier_checks'] if r['curve'] == curve]
        dead = [r['depth'] for r in rows if not r['dps']]
        print(curve, 'max clear', max(r['enemy_clear_minutes'] or 1e9 for r in rows),
              'combat-dead depths', dead,
              'all 110% reached', all(r['reached_110'] for r in rows))
    dead = [r for r in results['recovery'] if not r['combat_possible']]
    print('all-prior-waste combat-impossible:', len(dead), 'of', len(results['recovery']))
    for r in results['recovery']:
        if not r['combat_possible']:
            print('  dead:', r['curve'], 'depth', r['depth'], '-> recovery', r.get('recovery_depth'),
                    'push minutes', r.get('recovery_push_minutes'))
    for r in results['strategies']:
        if r['scenario'] == 'push_vs_reset':
            print(r['curve'], r['targets'], r['minutes'])
    for r in results['strategies']:
        if r['scenario'] == 'roll_sweep':
            print('roll', r['roll_minutes'], 'era2', r['era2']['minutes'],
                  'victories', r['era2']['victories'], 'first_kill', r['era2']['first_kill_minute'],
                  'weapons', r['weapons_at_era2_start'], '->', r['weapons_after_era2'])

if __name__ == '__main__':
    main()
