import { describe, it, expect } from 'vitest';
import { loadPolicy } from '../loader';
import { createEnforcer } from '../enforcer';

describe('rule evaluation', () => {
  describe('deny-keyword', () => {
    it('should find violations for denied keywords', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'no-competitors',
          type: 'deny-keyword',
          keywords: ['Google', 'Microsoft'],
          caseSensitive: false,
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('Check out Google and Microsoft products.', { direction: 'output' });

      expect(result.pass).toBe(false);
      expect(result.violations).toHaveLength(2);
      expect(result.violations[0].ruleId).toBe('no-competitors');
      expect(result.violations[0].matched).toBe('Google');
      expect(result.violations[1].matched).toBe('Microsoft');
    });

    it('should not find violations when no keywords match', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'no-competitors',
          type: 'deny-keyword',
          keywords: ['Google', 'Microsoft'],
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('Our product is the best.', { direction: 'output' });

      expect(result.pass).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should respect wholeWord: true (default)', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'no-meta',
          type: 'deny-keyword',
          keywords: ['Meta'],
          wholeWord: true,
          caseSensitive: false,
        }],
      });
      const enforcer = createEnforcer(policy);

      // "metadata" should NOT match "Meta" with wholeWord: true
      const result = enforcer.check('Check the metadata for details.', { direction: 'output' });
      expect(result.violations).toHaveLength(0);

      // "Meta" alone should match
      const result2 = enforcer.check('Meta has a new product.', { direction: 'output' });
      expect(result2.violations).toHaveLength(1);
    });

    it('should respect wholeWord: false', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'no-meta',
          type: 'deny-keyword',
          keywords: ['Meta'],
          wholeWord: false,
          caseSensitive: false,
        }],
      });
      const enforcer = createEnforcer(policy);

      const result = enforcer.check('Check the metadata for details.', { direction: 'output' });
      expect(result.violations).toHaveLength(1);
    });

    it('should respect caseSensitive: true', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'case-test',
          type: 'deny-keyword',
          keywords: ['Google'],
          caseSensitive: true,
        }],
      });
      const enforcer = createEnforcer(policy);

      const result = enforcer.check('I use google daily.', { direction: 'output' });
      expect(result.violations).toHaveLength(0);

      const result2 = enforcer.check('I use Google daily.', { direction: 'output' });
      expect(result2.violations).toHaveLength(1);
    });

    it('should include correct location information', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'loc-test',
          type: 'deny-keyword',
          keywords: ['bad'],
          caseSensitive: false,
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('This is bad stuff.', { direction: 'output' });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].location).toEqual({ start: 8, end: 11 });
    });

    it('should find multiple occurrences of the same keyword', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'multi',
          type: 'deny-keyword',
          keywords: ['bad'],
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('bad thing, another bad thing.', { direction: 'output' });
      expect(result.violations).toHaveLength(2);
    });
  });

  describe('deny-regex', () => {
    it('should find violations for regex matches', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'no-prices',
          type: 'deny-regex',
          pattern: '\\$\\d+',
          message: 'Contains price: {{matched}}',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('The price is $99.', { direction: 'output' });

      expect(result.pass).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].matched).toBe('$99');
      expect(result.violations[0].message).toBe('Contains price: $99');
    });

    it('should find all matches with global flag', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'no-prices',
          type: 'deny-regex',
          pattern: '\\$\\d+',
          flags: 'g',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('Prices: $10 and $20.', { direction: 'output' });

      expect(result.violations).toHaveLength(2);
    });

    it('should find only first match without global flag', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'no-prices',
          type: 'deny-regex',
          pattern: '\\$\\d+',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('Prices: $10 and $20.', { direction: 'output' });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].matched).toBe('$10');
    });

    it('should not find violations when no match', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'no-prices',
          type: 'deny-regex',
          pattern: '\\$\\d+',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('No prices here.', { direction: 'output' });
      expect(result.violations).toHaveLength(0);
    });

    it('should support case-insensitive flag', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'no-advice',
          type: 'deny-regex',
          pattern: 'you should (buy|sell)',
          flags: 'i',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('YOU SHOULD BUY stocks.', { direction: 'output' });
      expect(result.violations).toHaveLength(1);
    });
  });

  describe('require-keyword', () => {
    it('should produce violation when required keyword is missing', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'need-email',
          type: 'require-keyword',
          keywords: ['support@test.com'],
          severity: 'warning',
          condition: { keywords: ['billing'] },
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('Please contact us about billing.', { direction: 'output' });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('need-email');
    });

    it('should not produce violation when keyword is present', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'need-email',
          type: 'require-keyword',
          keywords: ['support@test.com'],
          condition: { keywords: ['billing'] },
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('For billing, contact support@test.com.', { direction: 'output' });

      expect(result.violations).toHaveLength(0);
    });

    it('should skip when condition is not met', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'need-email',
          type: 'require-keyword',
          keywords: ['support@test.com'],
          condition: { keywords: ['billing'] },
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('This is about weather.', { direction: 'output' });

      expect(result.violations).toHaveLength(0);
    });

    it('should require ALL keywords when requireAll: true', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'require-both',
          type: 'require-keyword',
          keywords: ['hello', 'world'],
          requireAll: true,
        }],
      });
      const enforcer = createEnforcer(policy);

      const result = enforcer.check('hello there!', { direction: 'output' });
      expect(result.violations).toHaveLength(1); // missing "world"

      const result2 = enforcer.check('hello world!', { direction: 'output' });
      expect(result2.violations).toHaveLength(0);
    });

    it('should require at least one keyword when requireAll: false', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'require-one',
          type: 'require-keyword',
          keywords: ['hello', 'hi'],
          requireAll: false,
        }],
      });
      const enforcer = createEnforcer(policy);

      const result = enforcer.check('hello there!', { direction: 'output' });
      expect(result.violations).toHaveLength(0);

      const result2 = enforcer.check('goodbye!', { direction: 'output' });
      expect(result2.violations).toHaveLength(1);
    });
  });

  describe('require-disclaimer', () => {
    it('should produce violation when disclaimer is missing', () => {
      const policy = loadPolicy({
        name: 'test',
        topics: { health: { keywords: ['health', 'doctor'], threshold: 1 } },
        rules: [{
          id: 'medical-disclaimer',
          type: 'require-disclaimer',
          disclaimer: 'Consult your doctor.',
          condition: { topic: 'health' },
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('You should talk to a doctor about your health.', { direction: 'output' });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('medical-disclaimer');
    });

    it('should not produce violation when disclaimer is present', () => {
      const policy = loadPolicy({
        name: 'test',
        topics: { health: { keywords: ['health', 'doctor'], threshold: 1 } },
        rules: [{
          id: 'medical-disclaimer',
          type: 'require-disclaimer',
          disclaimer: 'Consult your doctor.',
          condition: { topic: 'health' },
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check(
        'You should talk about health. Consult your doctor.',
        { direction: 'output' },
      );

      expect(result.violations).toHaveLength(0);
    });

    it('should support fuzzyMatch', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'disclaimer',
          type: 'require-disclaimer',
          disclaimer: 'Consult your doctor.',
          fuzzyMatch: true,
        }],
      });
      const enforcer = createEnforcer(policy);

      // Should match despite extra whitespace and case difference
      const result = enforcer.check(
        'Some text. consult   your   doctor.',
        { direction: 'output' },
      );
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('deny-topic', () => {
    it('should produce violation when denied topic is detected', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'no-politics',
          type: 'deny-topic',
          topic: 'political',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check(
        'The election results show the democrat candidate won the vote in congress.',
        { direction: 'output' },
      );

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('no-politics');
    });

    it('should not produce violation when topic is not detected (below threshold)', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'no-politics',
          type: 'deny-topic',
          topic: 'political',
        }],
      });
      const enforcer = createEnforcer(policy);
      // political threshold is 3, only 1 keyword here
      const result = enforcer.check('The government is working.', { direction: 'output' });

      expect(result.violations).toHaveLength(0);
    });

    it('should support rule-level threshold override', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'no-politics',
          type: 'deny-topic',
          topic: 'political',
          threshold: 5, // higher than default 3
        }],
      });
      const enforcer = createEnforcer(policy);
      // 3 keywords match (meets built-in threshold 3) but rule requires 5
      const result = enforcer.check(
        'The election results show the democrat won the vote.',
        { direction: 'output' },
      );
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('replace', () => {
    it('should find violations for replaceable content', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'product-name',
          type: 'replace',
          severity: 'info',
          patterns: [{ match: 'our product', replacement: 'ACME Widget' }],
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('Check out our product today.', { direction: 'output' });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].matched).toBe('our product');
    });
  });

  describe('redact', () => {
    it('should find violations for redactable content', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'redact-secret',
          type: 'redact',
          patterns: ['Project Phoenix'],
          replacement: '[INTERNAL]',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('We are working on Project Phoenix.', { direction: 'output' });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].matched).toBe('Project Phoenix');
    });

    it('should find multiple occurrences', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'redact-names',
          type: 'redact',
          patterns: ['Google', 'Microsoft'],
          caseSensitive: false,
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('Google and Microsoft are competitors.', { direction: 'output' });
      expect(result.violations).toHaveLength(2);
    });
  });

  describe('length-limit', () => {
    it('should produce violation when text exceeds maxLength', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'max-len',
          type: 'length-limit',
          maxLength: 10,
          severity: 'warning',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('This text is definitely too long.', { direction: 'output' });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('max-len');
    });

    it('should not produce violation when text is within maxLength', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'max-len',
          type: 'length-limit',
          maxLength: 100,
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('Short text.', { direction: 'output' });
      expect(result.violations).toHaveLength(0);
    });

    it('should produce violation when text is below minLength', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'min-len',
          type: 'length-limit',
          minLength: 50,
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('Short.', { direction: 'output' });
      expect(result.violations).toHaveLength(1);
    });

    it('should check word count limits', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'word-limit',
          type: 'length-limit',
          maxWords: 3,
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('One two three four five.', { direction: 'output' });
      expect(result.violations).toHaveLength(1);
    });

    it('should check minWords', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'min-words',
          type: 'length-limit',
          minWords: 5,
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('Just two words.', { direction: 'output' });
      expect(result.violations).toHaveLength(1);
    });
  });

  describe('language-match', () => {
    it('should produce violation when output language differs from input', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'lang-match',
          type: 'language-match',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.checkOutput(
        'Dies ist ein deutscher Text mit dem und der Worten.',
        { input: 'This is an English text with the words from here.' },
      );

      expect(result.violations).toHaveLength(1);
    });

    it('should not produce violation when languages match', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'lang-match',
          type: 'language-match',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.checkOutput(
        'This is the answer to your question.',
        { input: 'What is the answer?' },
      );

      expect(result.violations).toHaveLength(0);
    });

    it('should detect CJK languages', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'lang-match',
          type: 'language-match',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.checkOutput(
        '这是一个中文回答。',
        { input: 'This is an English question.' },
      );

      expect(result.violations).toHaveLength(1);
    });
  });

  describe('custom rules', () => {
    it('should evaluate custom validation function', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [],
      });
      const enforcer = createEnforcer(policy, {
        customRules: [{
          id: 'no-uppercase',
          type: 'custom',
          severity: 'warning',
          validate: (text) => {
            if (text === text.toUpperCase() && text.length > 5) {
              return [{ message: 'Text is all uppercase', matched: text }];
            }
            return [];
          },
        }],
      });

      const result = enforcer.check('THIS IS ALL CAPS', { direction: 'output' });
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('no-uppercase');

      const result2 = enforcer.check('This is normal text.', { direction: 'output' });
      expect(result2.violations).toHaveLength(0);
    });
  });

  describe('direction filtering', () => {
    it('should only evaluate output rules when direction is output', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [
          { id: 'input-rule', type: 'deny-keyword', keywords: ['bad'], direction: 'input' },
          { id: 'output-rule', type: 'deny-keyword', keywords: ['bad'], direction: 'output' },
        ],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('This is bad.', { direction: 'output' });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('output-rule');
    });

    it('should only evaluate input rules when direction is input', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [
          { id: 'input-rule', type: 'deny-keyword', keywords: ['bad'], direction: 'input' },
          { id: 'output-rule', type: 'deny-keyword', keywords: ['bad'], direction: 'output' },
        ],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.checkInput('This is bad.');

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('input-rule');
    });

    it('should evaluate "both" direction rules in any direction', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [
          { id: 'both-rule', type: 'deny-keyword', keywords: ['bad'], direction: 'both' },
        ],
      });
      const enforcer = createEnforcer(policy);

      const outputResult = enforcer.check('This is bad.', { direction: 'output' });
      expect(outputResult.violations).toHaveLength(1);

      const inputResult = enforcer.checkInput('This is bad.');
      expect(inputResult.violations).toHaveLength(1);
    });
  });

  describe('conditions', () => {
    it('should skip rule when topic condition is not met', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'medical-only',
          type: 'deny-keyword',
          keywords: ['bad'],
          condition: { topic: 'medical' },
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('This is bad.', { direction: 'output' });
      expect(result.violations).toHaveLength(0);
    });

    it('should evaluate rule when topic condition is met', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'medical-only',
          type: 'deny-keyword',
          keywords: ['bad'],
          condition: { topic: 'medical' },
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check(
        'The doctor said the treatment is bad for the patient.',
        { direction: 'output' },
      );
      expect(result.violations).toHaveLength(1);
    });

    it('should skip rule when keyword condition is not met', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'conditional',
          type: 'deny-keyword',
          keywords: ['bad'],
          condition: { keywords: ['trigger'] },
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('This is bad.', { direction: 'output' });
      expect(result.violations).toHaveLength(0);
    });

    it('should evaluate rule when keyword condition is met', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'conditional',
          type: 'deny-keyword',
          keywords: ['bad'],
          condition: { keywords: ['trigger'] },
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('This trigger is bad.', { direction: 'output' });
      expect(result.violations).toHaveLength(1);
    });

    it('should skip rule when minLength condition is not met', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'long-only',
          type: 'deny-keyword',
          keywords: ['bad'],
          condition: { minLength: 100 },
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('This is bad.', { direction: 'output' });
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('compliance scoring', () => {
    it('should return 1.0 for no violations', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'deny-keyword',
          keywords: ['bad'],
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('All good.', { direction: 'output' });
      expect(result.score).toBe(1.0);
    });

    it('should return score < 1.0 for violations', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [
          { id: 'r1', type: 'deny-keyword', keywords: ['bad'] },
          { id: 'r2', type: 'deny-keyword', keywords: ['good'] },
        ],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('This is bad.', { direction: 'output' });
      expect(result.score).toBeLessThan(1.0);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should clamp score to [0, 1]', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [
          { id: 'r1', type: 'deny-keyword', keywords: ['a'] },
        ],
      });
      const enforcer = createEnforcer(policy);
      // Many matches of 'a' on one rule
      const result = enforcer.check('a a a a a a a a a a', { direction: 'output' });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should weigh warnings less than errors', () => {
      const policyError = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'], severity: 'error' }],
      });
      const policyWarning = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'], severity: 'warning' }],
      });
      const enforcerE = createEnforcer(policyError);
      const enforcerW = createEnforcer(policyWarning);
      const resultE = enforcerE.check('bad', { direction: 'output' });
      const resultW = enforcerW.check('bad', { direction: 'output' });

      expect(resultW.score).toBeGreaterThan(resultE.score);
    });
  });

  describe('pass determination', () => {
    it('should fail on error-severity violations', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'], severity: 'error' }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('bad', { direction: 'output' });
      expect(result.pass).toBe(false);
    });

    it('should pass with only warning-severity violations (failOnWarnings: false)', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'], severity: 'warning' }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('bad', { direction: 'output' });
      expect(result.pass).toBe(true);
    });

    it('should fail with warning violations when failOnWarnings: true', () => {
      const policy = loadPolicy({
        name: 'test',
        failOnWarnings: true,
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'], severity: 'warning' }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('bad', { direction: 'output' });
      expect(result.pass).toBe(false);
    });

    it('should pass with only info-severity violations', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'], severity: 'info' }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('bad', { direction: 'output' });
      expect(result.pass).toBe(true);
    });
  });

  describe('topic detection in results', () => {
    it('should include detected topics in result', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'] }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check(
        'The doctor said the treatment is needed for the patient.',
        { direction: 'output' },
      );
      expect(result.topicsDetected.length).toBeGreaterThan(0);
      const medical = result.topicsDetected.find(t => t.name === 'medical');
      expect(medical).toBeDefined();
      expect(medical!.matchedKeywords.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('empty text', () => {
    it('should return pass: true for empty text', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'] }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('', { direction: 'output' });
      expect(result.pass).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.rulesEvaluated).toBe(0);
    });
  });

  describe('disabled rules', () => {
    it('should skip disabled rules via enabled: false', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'deny-keyword',
          keywords: ['bad'],
          enabled: false,
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('This is bad.', { direction: 'output' });
      expect(result.violations).toHaveLength(0);
    });

    it('should skip disabled rules via disabledRules option', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'deny-keyword',
          keywords: ['bad'],
        }],
      });
      const enforcer = createEnforcer(policy, { disabledRules: ['r1'] });
      const result = enforcer.check('This is bad.', { direction: 'output' });
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('enforcer options', () => {
    it('should override enforcement mode', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'] }],
      });
      // Should not throw in audit mode
      const enforcer = createEnforcer(policy, { enforcement: 'audit' });
      const result = enforcer.enforce('This is bad.', { direction: 'output' });
      expect(result.violations).toHaveLength(1);
    });

    it('should override failOnWarnings', () => {
      const policy = loadPolicy({
        name: 'test',
        failOnWarnings: false,
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'], severity: 'warning' }],
      });
      const enforcer = createEnforcer(policy, { failOnWarnings: true });
      const result = enforcer.check('This is bad.', { direction: 'output' });
      expect(result.pass).toBe(false);
    });

    it('should support topic overrides', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'no-med',
          type: 'deny-topic',
          topic: 'medical',
        }],
      });
      // Override medical threshold to require 10 matches (effectively disable)
      const enforcer = createEnforcer(policy, {
        topicOverrides: { medical: { threshold: 10 } },
      });
      const result = enforcer.check(
        'The doctor said the treatment is fine for the patient.',
        { direction: 'output' },
      );
      expect(result.violations).toHaveLength(0);
    });
  });
});
