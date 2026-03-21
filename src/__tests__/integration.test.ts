import { describe, it, expect } from 'vitest';
import { loadPolicy, createEnforcer, checkPolicy, enforcePolicy } from '../index';
import { PolicyViolationError, PolicyValidationError } from '../errors';

describe('integration tests', () => {
  const fullPolicyDef = {
    name: 'acme-corp-policy',
    version: '1.0.0',
    description: 'ACME Corp content policy',
    enforcement: 'enforce' as const,
    failOnWarnings: false,
    topics: {
      billing: {
        keywords: ['invoice', 'payment', 'charge', 'refund', 'billing', 'cost'],
        threshold: 1,
      },
    },
    rules: [
      {
        id: 'no-competitor-names',
        type: 'deny-keyword' as const,
        severity: 'error' as const,
        direction: 'output' as const,
        keywords: ['Google', 'Microsoft', 'Meta', 'Amazon'],
        caseSensitive: false,
        message: 'Response mentions a competitor: {{matched}}',
      },
      {
        id: 'medical-disclaimer',
        type: 'require-disclaimer' as const,
        severity: 'error' as const,
        direction: 'output' as const,
        condition: { topic: 'medical' },
        disclaimer: 'This is not medical advice. Consult a healthcare professional.',
        position: 'end' as const,
        fuzzyMatch: true,
      },
      {
        id: 'billing-email',
        type: 'require-keyword' as const,
        severity: 'warning' as const,
        direction: 'output' as const,
        condition: { topic: 'billing' },
        keywords: ['support@acme.com'],
      },
      {
        id: 'redact-competitors',
        type: 'redact' as const,
        severity: 'warning' as const,
        direction: 'output' as const,
        patterns: ['Google', 'Microsoft', 'Meta'],
        replacement: '[COMPETITOR]',
        caseSensitive: false,
      },
      {
        id: 'max-length',
        type: 'length-limit' as const,
        severity: 'warning' as const,
        maxLength: 2000,
      },
      {
        id: 'no-pricing',
        type: 'deny-regex' as const,
        severity: 'error' as const,
        direction: 'output' as const,
        pattern: '\\$\\d+',
        message: 'Response contains pricing: {{matched}}',
      },
      {
        id: 'standardize-name',
        type: 'replace' as const,
        severity: 'info' as const,
        patterns: [{ match: 'our product', replacement: 'ACME Widget Pro' }],
        caseSensitive: false,
      },
    ],
  };

  describe('full pipeline check', () => {
    it('should evaluate a clean text and return pass: true', () => {
      const policy = loadPolicy(fullPolicyDef);
      const enforcer = createEnforcer(policy);

      const result = enforcer.check(
        'ACME Widget Pro is the best solution for your needs. Visit acme.com for more info.',
        { direction: 'output' },
      );

      expect(result.pass).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.violations).toHaveLength(0);
      expect(result.rulesEvaluated).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should detect multiple violations across rules', () => {
      const policy = loadPolicy(fullPolicyDef);
      const enforcer = createEnforcer(policy);

      const result = enforcer.check(
        'Google has better products than us. Our product costs $99.',
        { direction: 'output' },
      );

      expect(result.pass).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(2);

      const competitorViolation = result.violations.find(v => v.ruleId === 'no-competitor-names');
      expect(competitorViolation).toBeDefined();
      expect(competitorViolation!.matched).toBe('Google');

      const pricingViolation = result.violations.find(v => v.ruleId === 'no-pricing');
      expect(pricingViolation).toBeDefined();
      expect(pricingViolation!.matched).toBe('$99');
    });
  });

  describe('full pipeline enforce', () => {
    it('should apply remediations and return modified text', () => {
      const policy = loadPolicy(fullPolicyDef);
      const enforcer = createEnforcer(policy, { throwOnViolation: false });

      const result = enforcer.enforce(
        'Check out Google for cloud, and try our product.',
        { direction: 'output' },
      );

      // "Google" redacted, "our product" replaced
      expect(result.text).toContain('[COMPETITOR]');
      expect(result.text).toContain('ACME Widget Pro');
      expect(result.text).not.toContain('Google');
      expect(result.remediations.length).toBeGreaterThan(0);
    });
  });

  describe('enforce round-trip', () => {
    it('should pass re-check after enforcement of remediable violations', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [
          {
            id: 'redact',
            type: 'redact',
            severity: 'error',
            patterns: ['secret'],
            replacement: '[HIDDEN]',
          },
          {
            id: 'disclaimer',
            type: 'require-disclaimer',
            severity: 'error',
            disclaimer: 'Disclaimer: for informational purposes only.',
          },
        ],
      });
      const enforcer = createEnforcer(policy);

      // First enforce
      const enforced = enforcer.enforce(
        'The secret ingredient is love.',
        { direction: 'output' },
      );

      expect(enforced.text).toContain('[HIDDEN]');
      expect(enforced.text).toContain('Disclaimer: for informational purposes only.');

      // Re-check the enforced text
      const recheck = enforcer.check(enforced.text, { direction: 'output' });
      expect(recheck.pass).toBe(true);
      expect(recheck.violations).toHaveLength(0);
    });
  });

  describe('standalone functions', () => {
    it('checkPolicy should work as standalone function', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'] }],
      });
      const result = checkPolicy(policy, 'This is bad.');
      expect(result.pass).toBe(false);
      expect(result.violations).toHaveLength(1);
    });

    it('enforcePolicy should work as standalone function', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{
          id: 'r1',
          type: 'redact',
          severity: 'warning',
          patterns: ['secret'],
          replacement: '[HIDDEN]',
        }],
      });
      const result = enforcePolicy(policy, 'The secret is here.');
      expect(result.text).toBe('The [HIDDEN] is here.');
    });
  });

  describe('JSON policy string', () => {
    it('should load a policy from a JSON string and evaluate', () => {
      const jsonStr = JSON.stringify({
        name: 'json-policy',
        rules: [
          { id: 'r1', type: 'deny-keyword', keywords: ['test'], severity: 'error' },
        ],
      });

      const policy = loadPolicy(jsonStr);
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('This is a test.', { direction: 'output' });

      expect(result.pass).toBe(false);
      expect(result.violations[0].ruleId).toBe('r1');
    });
  });

  describe('complex conditional policies', () => {
    it('should only trigger conditional rules when conditions are met', () => {
      const policy = loadPolicy({
        name: 'conditional-test',
        topics: {
          health: {
            keywords: ['health', 'doctor', 'medicine', 'treatment'],
            threshold: 2,
          },
        },
        rules: [
          {
            id: 'always-active',
            type: 'deny-keyword',
            severity: 'error',
            keywords: ['forbidden'],
          },
          {
            id: 'health-only',
            type: 'deny-keyword',
            severity: 'warning',
            keywords: ['risky'],
            condition: { topic: 'health' },
          },
        ],
      });
      const enforcer = createEnforcer(policy);

      // Text without health topic - only "always-active" should fire
      const result1 = enforcer.check('This is risky and forbidden.', { direction: 'output' });
      expect(result1.violations).toHaveLength(1);
      expect(result1.violations[0].ruleId).toBe('always-active');

      // Text with health topic - both should fire
      const result2 = enforcer.check(
        'The doctor said this treatment is risky and forbidden.',
        { direction: 'output' },
      );
      expect(result2.violations).toHaveLength(2);
    });
  });

  describe('bidirectional rules', () => {
    it('should check input and output separately', () => {
      const policy = loadPolicy({
        name: 'bidirectional',
        rules: [
          {
            id: 'input-profanity',
            type: 'deny-keyword',
            severity: 'error',
            direction: 'input',
            keywords: ['spam'],
          },
          {
            id: 'output-competitor',
            type: 'deny-keyword',
            severity: 'error',
            direction: 'output',
            keywords: ['Google'],
          },
          {
            id: 'both-secret',
            type: 'deny-keyword',
            severity: 'error',
            direction: 'both',
            keywords: ['classified'],
          },
        ],
      });
      const enforcer = createEnforcer(policy);

      // Check input
      const inputResult = enforcer.checkInput('spam classified message');
      expect(inputResult.violations).toHaveLength(2);
      expect(inputResult.violations.map(v => v.ruleId).sort()).toEqual(['both-secret', 'input-profanity']);

      // Check output
      const outputResult = enforcer.check('Google is classified info', { direction: 'output' });
      expect(outputResult.violations).toHaveLength(2);
      expect(outputResult.violations.map(v => v.ruleId).sort()).toEqual(['both-secret', 'output-competitor']);
    });
  });

  describe('error classes', () => {
    it('PolicyValidationError should have errors array', () => {
      try {
        loadPolicy({ name: 'test' } as Record<string, unknown>);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(PolicyValidationError);
        expect((e as PolicyValidationError).errors).toBeDefined();
        expect((e as PolicyValidationError).errors.length).toBeGreaterThan(0);
      }
    });

    it('PolicyViolationError should have violations array', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'enforce',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'], severity: 'error' }],
      });
      const enforcer = createEnforcer(policy, { throwOnViolation: true });

      try {
        enforcer.enforce('bad', { direction: 'output' });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(PolicyViolationError);
        expect((e as PolicyViolationError).violations).toHaveLength(1);
      }
    });
  });

  describe('result metadata', () => {
    it('should include durationMs in results', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'] }],
      });
      const enforcer = createEnforcer(policy);

      const checkResult = enforcer.check('test', { direction: 'output' });
      expect(typeof checkResult.durationMs).toBe('number');
      expect(checkResult.durationMs).toBeGreaterThanOrEqual(0);

      const enforceResult = enforcer.enforce('test', { direction: 'output' });
      expect(typeof enforceResult.durationMs).toBe('number');
    });

    it('should include rulesEvaluated count', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [
          { id: 'r1', type: 'deny-keyword', keywords: ['x'] },
          { id: 'r2', type: 'deny-keyword', keywords: ['y'] },
          { id: 'r3', type: 'deny-keyword', keywords: ['z'], enabled: false },
        ],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('test', { direction: 'output' });
      expect(result.rulesEvaluated).toBe(2); // r3 is disabled
    });
  });

  describe('message templates', () => {
    it('should format {{matched}} in violation messages', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'deny-keyword',
          keywords: ['Google'],
          message: 'Found competitor: {{matched}}',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('Google is here.', { direction: 'output' });
      expect(result.violations[0].message).toBe('Found competitor: Google');
    });

    it('should format {{actual}} and {{expected}} in length-limit messages', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'length-limit',
          maxLength: 5,
          message: 'Too long: {{actual}} chars (max {{expected}})',
        }],
      });
      const enforcer = createEnforcer(policy);
      const result = enforcer.check('This is too long.', { direction: 'output' });
      expect(result.violations[0].message).toBe('Too long: 17 chars (max 5)');
    });
  });

  describe('exports', () => {
    it('should export all expected functions', () => {
      expect(typeof loadPolicy).toBe('function');
      expect(typeof createEnforcer).toBe('function');
      expect(typeof checkPolicy).toBe('function');
      expect(typeof enforcePolicy).toBe('function');
    });

    it('should export error classes', () => {
      expect(PolicyValidationError).toBeDefined();
      expect(PolicyViolationError).toBeDefined();
    });
  });
});
