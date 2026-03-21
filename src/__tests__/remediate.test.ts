import { describe, it, expect } from 'vitest';
import { loadPolicy } from '../loader';
import { createEnforcer } from '../enforcer';
import { PolicyViolationError } from '../errors';

describe('remediation', () => {
  describe('redact', () => {
    it('should redact matching text in enforce mode', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{
          id: 'redact-competitors',
          type: 'redact',
          severity: 'warning',
          patterns: ['Google', 'Microsoft'],
          replacement: '[COMPETITOR]',
          caseSensitive: false,
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.enforce(
        'I recommend Google and Microsoft for cloud services.',
        { direction: 'output' },
      );

      expect(result.text).toBe('I recommend [COMPETITOR] and [COMPETITOR] for cloud services.');
      expect(result.violations).toHaveLength(2);
      expect(result.violations[0].remediated).toBe(true);
      expect(result.violations[1].remediated).toBe(true);
      expect(result.remediations).toHaveLength(2);
    });

    it('should use default [REDACTED] replacement', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{
          id: 'redact-secret',
          type: 'redact',
          severity: 'warning',
          patterns: ['secret-code'],
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.enforce('The secret-code is here.', { direction: 'output' });

      expect(result.text).toBe('The [REDACTED] is here.');
    });

    it('should not modify text in audit mode', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'audit',
        rules: [{
          id: 'redact-competitors',
          type: 'redact',
          severity: 'warning',
          patterns: ['Google'],
          replacement: '[COMPETITOR]',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.enforce('Google is great.', { direction: 'output' });

      expect(result.text).toBe('Google is great.');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].remediated).toBe(false);
    });

    it('should handle multiple occurrences correctly', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{
          id: 'redact',
          type: 'redact',
          severity: 'warning',
          patterns: ['secret'],
          replacement: '[HIDDEN]',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.enforce(
        'The secret is a secret thing.',
        { direction: 'output' },
      );

      expect(result.text).toBe('The [HIDDEN] is a [HIDDEN] thing.');
    });
  });

  describe('replace', () => {
    it('should replace matching text in enforce mode', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{
          id: 'standardize-names',
          type: 'replace',
          severity: 'info',
          patterns: [
            { match: 'our product', replacement: 'ACME Widget Pro' },
          ],
          caseSensitive: false,
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.enforce(
        'Check out our product for great features.',
        { direction: 'output' },
      );

      expect(result.text).toBe('Check out ACME Widget Pro for great features.');
      expect(result.remediations).toHaveLength(1);
      expect(result.remediations[0].type).toBe('replace');
      expect(result.remediations[0].original).toBe('our product');
      expect(result.remediations[0].replacement).toBe('ACME Widget Pro');
    });

    it('should handle multiple replace patterns', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{
          id: 'replace-multi',
          type: 'replace',
          severity: 'info',
          patterns: [
            { match: 'hello', replacement: 'hi' },
            { match: 'world', replacement: 'earth' },
          ],
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.enforce('hello world!', { direction: 'output' });

      expect(result.text).toBe('hi earth!');
    });
  });

  describe('require-disclaimer', () => {
    it('should append disclaimer at end in enforce mode', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        topics: { health: { keywords: ['health', 'doctor'], threshold: 1 } },
        rules: [{
          id: 'medical-disclaimer',
          type: 'require-disclaimer',
          disclaimer: 'Consult your doctor.',
          position: 'end',
          condition: { topic: 'health' },
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.enforce(
        'You should talk to your doctor about health.',
        { direction: 'output' },
      );

      expect(result.text).toBe('You should talk to your doctor about health.\n\nConsult your doctor.');
      expect(result.remediations).toHaveLength(1);
      expect(result.remediations[0].type).toBe('insert-disclaimer');
    });

    it('should prepend disclaimer at start in enforce mode', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{
          id: 'disclaimer',
          type: 'require-disclaimer',
          disclaimer: 'WARNING:',
          position: 'start',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.enforce('Some text.', { direction: 'output' });

      expect(result.text).toBe('WARNING:\n\nSome text.');
    });

    it('should use custom separator', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{
          id: 'disclaimer',
          type: 'require-disclaimer',
          disclaimer: 'Disclaimer text.',
          position: 'end',
          separator: ' --- ',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.enforce('Main text.', { direction: 'output' });

      expect(result.text).toBe('Main text. --- Disclaimer text.');
    });

    it('should not add disclaimer if already present', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{
          id: 'disclaimer',
          type: 'require-disclaimer',
          disclaimer: 'Consult your doctor.',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.enforce(
        'Some text. Consult your doctor.',
        { direction: 'output' },
      );

      expect(result.text).toBe('Some text. Consult your doctor.');
      expect(result.remediations).toHaveLength(0);
    });
  });

  describe('throwOnViolation', () => {
    it('should throw PolicyViolationError on unremediable error violations', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{
          id: 'no-bad',
          type: 'deny-keyword',
          severity: 'error',
          keywords: ['bad'],
        }],
      });
      const enforcer = createEnforcer(policy, { throwOnViolation: true });

      expect(() => enforcer.enforce('This is bad.', { direction: 'output' }))
        .toThrow(PolicyViolationError);
    });

    it('should not throw when throwOnViolation is false', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{
          id: 'no-bad',
          type: 'deny-keyword',
          severity: 'error',
          keywords: ['bad'],
        }],
      });
      const enforcer = createEnforcer(policy, { throwOnViolation: false });

      const result = enforcer.enforce('This is bad.', { direction: 'output' });
      expect(result.pass).toBe(false);
      expect(result.violations).toHaveLength(1);
    });

    it('should not throw for warning violations even with throwOnViolation', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{
          id: 'no-bad',
          type: 'deny-keyword',
          severity: 'warning',
          keywords: ['bad'],
        }],
      });
      const enforcer = createEnforcer(policy, { throwOnViolation: true });

      const result = enforcer.enforce('This is bad.', { direction: 'output' });
      expect(result.violations).toHaveLength(1);
    });

    it('should not throw when violations are remediated', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{
          id: 'redact',
          type: 'redact',
          severity: 'error',
          patterns: ['bad'],
          replacement: '[GOOD]',
        }],
      });
      const enforcer = createEnforcer(policy, { throwOnViolation: true });

      const result = enforcer.enforce('This is bad.', { direction: 'output' });
      expect(result.text).toBe('This is [GOOD].');
      expect(result.violations[0].remediated).toBe(true);
    });

    it('should include violations in thrown error', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{
          id: 'no-bad',
          type: 'deny-keyword',
          severity: 'error',
          keywords: ['bad'],
        }],
      });
      const enforcer = createEnforcer(policy, { throwOnViolation: true });

      try {
        enforcer.enforce('This is bad.', { direction: 'output' });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(PolicyViolationError);
        const err = e as PolicyViolationError;
        expect(err.violations).toHaveLength(1);
        expect(err.violations[0].ruleId).toBe('no-bad');
      }
    });
  });

  describe('remediation stacking', () => {
    it('should apply remediations in order (earlier rules affect later rules)', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [
          {
            id: 'redact-google',
            type: 'redact',
            severity: 'warning',
            patterns: ['Google'],
            replacement: '[COMPETITOR]',
            caseSensitive: false,
          },
          {
            id: 'no-competitors',
            type: 'deny-keyword',
            severity: 'error',
            keywords: ['Google'],
            caseSensitive: false,
          },
        ],
      });
      const enforcer = createEnforcer(policy, { throwOnViolation: false });
      const result = enforcer.enforce(
        'Google has great products.',
        { direction: 'output' },
      );

      // redact rule runs first, replaces "Google" with "[COMPETITOR]"
      // deny-keyword rule runs second, should NOT find "Google" anymore
      expect(result.text).toBe('[COMPETITOR] has great products.');
      expect(result.violations).toHaveLength(1); // only the redact violation
      expect(result.violations[0].ruleId).toBe('redact-google');
    });
  });

  describe('enforce with empty text', () => {
    it('should return empty text and pass for empty input', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'] }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.enforce('', { direction: 'output' });
      expect(result.text).toBe('');
      expect(result.pass).toBe(true);
    });
  });

  describe('per-rule enforcement mode', () => {
    it('should respect per-rule enforcement override', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'audit', // global: audit
        rules: [{
          id: 'redact',
          type: 'redact',
          severity: 'warning',
          enforcement: 'enforce', // rule override: enforce
          patterns: ['secret'],
          replacement: '[HIDDEN]',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.enforce('The secret is here.', { direction: 'output' });

      // Per-rule override should cause remediation even though global is audit
      expect(result.text).toBe('The [HIDDEN] is here.');
    });
  });
});
