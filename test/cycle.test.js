import assert from 'assert';
import { transform, filterRules, applyRules } from '../cycle.js';

suite('cycle', () => {
  suite('filterRules', () => {
    test('returns all rules when no when', () => {
      const rules = [{ type: 'boolean' }, { type: 'nary', options: { base: 10 } }];
      assert.strictEqual(filterRules(rules, { languageId: 'js', visualOnly: false }).length, 2);
    });
    test('filters by languageId', () => {
      const rules = [{ type: 'boolean' }, { type: 'nary', when: { languageId: ['js'] } }];
      assert.strictEqual(filterRules(rules, { languageId: 'js', visualOnly: false }).length, 2);
      assert.strictEqual(filterRules(rules, { languageId: 'py', visualOnly: false }).length, 1);
    });
    test('filters by visualOnly', () => {
      const rules = [{ type: 'boolean', when: { visualOnly: true } }];
      assert.strictEqual(filterRules(rules, { languageId: 'js', visualOnly: true }).length, 1);
      assert.strictEqual(filterRules(rules, { languageId: 'js', visualOnly: false }).length, 0);
    });
    test('returns empty for null/undefined rules', () => {
      assert.deepStrictEqual(filterRules(null, {}), []);
      assert.deepStrictEqual(filterRules(undefined, {}), []);
    });
  });

  suite('applyRules', () => {
    test('matches boolean', () => {
      const rules = [{ type: 'boolean' }];
      assert.strictEqual(applyRules('false', rules)?.type, 'boolean');
      assert.strictEqual(applyRules('true', rules)?.type, 'boolean');
      assert.strictEqual(applyRules('x', rules), null);
    });
    test('matches first rule in order', () => {
      const rules = [{ type: 'nary', options: { base: 10 } }, { type: 'boolean' }];
      assert.strictEqual(applyRules('42', rules)?.type, 'nary');
      assert.strictEqual(applyRules('true', rules)?.type, 'boolean');
    });
    test('returns null when no match', () => {
      assert.strictEqual(applyRules('', []), null);
      assert.strictEqual(applyRules('xyz', [{ type: 'boolean' }]), null);
    });
  });

  suite('transform', () => {
    test('boolean toggles', () => {
      const match = { rule: {}, type: 'boolean' };
      assert.strictEqual(transform(match, 'false', 'increment', 1), 'true');
      assert.strictEqual(transform(match, 'true', 'increment', 1), 'false');
      assert.strictEqual(transform(match, 'true', 'decrement', 1), 'false');
    });
    test('nary increments/decrements', () => {
      const match = { rule: { type: 'nary', options: { base: 10 } }, type: 'nary' };
      assert.strictEqual(transform(match, '42', 'increment', 1), '43');
      assert.strictEqual(transform(match, '42', 'decrement', 1), '41');
      assert.strictEqual(transform(match, '42', 'increment', 5), '47');
    });
    test('fraction inferred step by decimal places', () => {
      const match = { rule: {}, type: 'fraction' };
      assert.strictEqual(transform(match, '2.3', 'increment', 1), '2.4');
      assert.strictEqual(transform(match, '2.35', 'increment', 1), '2.36');
      assert.strictEqual(transform(match, '2.355', 'increment', 1), '2.356');
      assert.strictEqual(transform(match, '42', 'increment', 1), '43');
    });
    test('quote toggles', () => {
      const match = { rule: {}, type: 'quote' };
      assert.strictEqual(transform(match, '"a"', 'increment', 1), "'a'");
      assert.strictEqual(transform(match, "'a'", 'increment', 1), '"a"');
    });
    test('returns text when no handler', () => {
      assert.strictEqual(transform({ rule: {}, type: 'unknown' }, 'x', 'increment', 1), 'x');
    });
  });
});
