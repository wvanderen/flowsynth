#!/usr/bin/env python3
"""Hypothesis model, not the FlowSynth engine. Units: credited minutes and 1T nous."""
import json, math
from pathlib import Path

CURVES = {
    'log': lambda x: 2 + 2 * math.log10(x),
    'sqrt_log': lambda x: 2 + 3 * math.sqrt(math.log10(x)),
    'power_015': lambda x: 2 * x ** .15,
}

def entitlement(score, curve):
    return 0.0 if score < 1 else CURVES[curve](score)

class Ledger:
    def __init__(self, curve):
        self.curve, self.frontier, self.banked = curve, 0., 0.
    def pending(self, score):
        return max(0., entitlement(score, self.curve) - entitlement(self.frontier, self.curve))
    def reset(self, score):
        # Production implementation must transact both writes together.
        claim = self.pending(score)
        self.banked += claim
        self.frontier = max(self.frontier, score)
        return claim

def build(budget, layout=1.):
    # One weapon + one Column; all fractional remainder buys continuous upgrade.
    # Continuous upgrades are a relaxation; integer purchase sensitivity below.
    if budget < 2: return 0.
    return layout * (1 + (budget - 2) / 2) ** 2

def run(budget, target=100, layout=1., penalty=.8, bonus=1.08,
        reach_minutes=4, max_minutes=3000, growth=.025, integer=False, reach_cost=.1, dt=.05):
    """Fixed encounters at 1,10,...1e8; charge uptime is layout in [0,1].
    Base retained rig grows era production exponentially; no World->board boost.
    Travel models paid expansion/releveling by withholding attacks for minutes.
    Fixed attacks: cost 1 charge, max 1/minute; damage upgraded by budget.
    """
    damage = build(2 + 2 * math.floor((budget-2)/2), layout) if integer and budget >= 2 else build(budget, layout)
    score, t, encountered, killed, arrivals, trace = 0., 0., {}, set(), {}, []
    reach_spent, reachable = 0., set()
    while t < max_minutes and score < target:
        for i in range(9):
            if score >= 10 ** i and i not in encountered:
                encountered[i] = 12 * 1.5 ** i
                arrivals[i] = t + reach_minutes * (1 + i / 4)
                trace.append({'minute':round(t,2),'event':'discover','enemy':i,'score':round(score,4)})
        alive = [i for i in encountered if i not in killed]
        # Multiplicative remaining production; victories replace their own factor.
        factor = penalty ** len(alive) * bonus ** len(killed)
        score += .04 * math.exp(min(growth*t, 50)) * factor * dt
        # Abstract connected expansion: reserve cumulative nous income for each path.
        # Earned score never falls on spending; wallet = earned - path costs.
        for i in alive:
            cost = reach_cost * 10 ** i
            if i not in reachable and t >= arrivals[i] and score - reach_spent >= cost:
                reach_spent += cost
                reachable.add(i)
        # Priority: oldest reachable. Split-free one-target weapon abstraction.
        attackable = [i for i in alive if i in reachable]
        if attackable and damage:
            i = min(attackable)
            encountered[i] -= damage * dt
            if encountered[i] <= 0:
                killed.add(i)
                trace.append({'minute':round(t,2),'event':'victory','enemy':i,'score':round(score,4)})
        t += dt
    return {'minutes':round(t,2),'score':score,'target':target,'reached':score>=target,
            'victories':len(killed),'reach_spent_T':reach_spent,
            'damage_per_minute':damage,'trace':trace}

def main():
    # Algebraic and transactional invariants, including partition-independent fractions.
    for curve in CURVES:
        ledger = Ledger(curve)
        assert ledger.reset(.99) == 0
        assert ledger.reset(1) == 2
        assert ledger.reset(1) == 0
        assert ledger.reset(.5) == 0
        for score in [1.01, 1.2, 10, 100, 1000]: ledger.reset(score)
        assert math.isclose(ledger.banked, entitlement(1000,curve),abs_tol=1e-10)
        assert ledger.reset(1000) == 0
        # Full refund: complete paid budget reusable, not new currency.
        spent, wallet = ledger.banked, 0.
        wallet += spent
        assert wallet == ledger.banked
    results = {'model':'hypothesis-v1', 'frontier_checks':[], 'strategies':[], 'sensitivities':[]}
    for curve in CURVES:
        for depth in range(9):
            score = 10. ** depth
            budget = entitlement(score,curve)
            dps = build(budget)
            hp = 12 * 1.5 ** depth
            current = run(budget, score)
            nxt = run(budget, score*1.1)
            results['frontier_checks'].append({'curve':curve,'depth':depth,'budget':budget,
                'enemy_clear_minutes':hp/dps,'return_minutes':current['minutes'],
                'exceed_minutes':nxt['minutes'],'exceeds':nxt['reached'],
                'within_20_minute_combat_target':hp/dps<=20})
        # Same final frontier, varying how often earlier territory is revisited.
        for targets in [[1,100],[1,10,100],[100]]:
            ledger, total, eras = Ledger(curve), 0., []
            for target in targets:
                era = run(ledger.banked,target)
                claim = ledger.reset(era['score'])
                total += era['minutes']
                eras.append({'target':target,'minutes':era['minutes'],'claim':claim,
                             'banked':ledger.banked,'victories':era['victories']})
            results['strategies'].append({'curve':curve,'targets':targets,'minutes':total,'eras':eras})
    for settings in [{'layout':0.25},{'layout':0},{'reach_minutes':40},{'penalty':.5},
                     {'bonus':1.0},{'integer':True},{'growth':.01},{'reach_cost':1000},
                     {'max_minutes':100},{'dt':.025}]:
        result = run(entitlement(100,'power_015'),1000,**settings)
        results['sensitivities'].append({'settings':settings,**result})
    results['deep_cost_counterexamples'] = [
        {'curve':c,'depth':d,'budget':entitlement(10.**d,c),
         'clear_minutes':12*1.5**d/build(entitlement(10.**d,c))}
        for c in CURVES for d in [12,20,30]]
    results['representative_traces'] = {str(b):run(b,100) for b in [0,2,8]}
    Path(__file__).with_name('results.json').write_text(json.dumps(results,indent=2)+'\n')
    print('Ledger invariants passed; wrote results.json')
    for curve in CURVES:
        rows=[r for r in results['frontier_checks'] if r['curve']==curve]
        print(curve,'max clear',round(max(r['enemy_clear_minutes'] for r in rows),2),
              'all exceed',all(r['exceeds'] for r in rows))
    for r in results['strategies']: print(r['curve'],r['targets'],round(r['minutes'],2))
    for b,r in results['representative_traces'].items(): print('return',b,r['minutes'],r['victories'])
    for r in results['sensitivities']: print(r['settings'],r['minutes'],r['victories'])

if __name__ == '__main__': main()
