import { describe, it, expect } from 'vitest';
import { loadPolicy } from '../loader';
import { PolicyValidationError } from '../errors';

describe('loadPolicy', () => {
  describe('JSON parsing', () => {
    it('should load a policy from a JSON string', () => {
      const json = JSON.stringify({
        name: 'test-policy',
        rules: [
          { id: 'rule-1', type: 'deny-keyword', keywords: ['bad'] },
        ],
      });
      const policy = loadPolicy(json);
      expect(policy.name).toBe('test-policy');
      expect(policy.rules).toHaveLength(1);
      expect(policy.rules[0].id).toBe('rule-1');
    });

    it('should load a policy from a JavaScript object', () => {
      const policy = loadPolicy({
        name: 'obj-policy',
        rules: [
          { id: 'rule-1', type: 'deny-keyword', keywords: ['test'] },
        ],
      });
      expect(policy.name).toBe('obj-policy');
      expect(policy.rules).toHaveLength(1);
    });
  });

  describe('defaults', () => {
    it('should apply default enforcement mode (enforce)', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }],
      });
      expect(policy.enforcement).toBe('enforce');
    });

    it('should apply default failOnWarnings (false)', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }],
      });
      expect(policy.failOnWarnings).toBe(false);
    });

    it('should apply default severity (error)', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }],
      });
      expect(policy.rules[0].severity).toBe('error');
    });

    it('should apply default direction (output)', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }],
      });
      expect(policy.rules[0].direction).toBe('output');
    });

    it('should apply default enabled (true)', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }],
      });
      expect(policy.rules[0].enabled).toBe(true);
    });

    it('should apply default wholeWord (true) for deny-keyword', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }],
      });
      expect(policy.rules[0].params.wholeWord).toBe(true);
    });

    it('should apply default caseSensitive (false) for deny-keyword', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }],
      });
      expect(policy.rules[0].params.caseSensitive).toBe(false);
    });
  });

  describe('custom values', () => {
    it('should use specified enforcement mode', () => {
      const policy = loadPolicy({
        name: 'test',
        enforcement: 'audit',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }],
      });
      expect(policy.enforcement).toBe('audit');
    });

    it('should use specified failOnWarnings', () => {
      const policy = loadPolicy({
        name: 'test',
        failOnWarnings: true,
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }],
      });
      expect(policy.failOnWarnings).toBe(true);
    });

    it('should parse version and description', () => {
      const policy = loadPolicy({
        name: 'test',
        version: '1.0.0',
        description: 'Test policy',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }],
      });
      expect(policy.version).toBe('1.0.0');
      expect(policy.description).toBe('Test policy');
    });
  });

  describe('topics', () => {
    it('should include built-in topics by default', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }],
      });
      expect(policy.topics.medical).toBeDefined();
      expect(policy.topics.financial).toBeDefined();
      expect(policy.topics.legal).toBeDefined();
      expect(policy.topics.political).toBeDefined();
      expect(policy.topics.religious).toBeDefined();
    });

    it('should merge custom topics with built-in topics', () => {
      const policy = loadPolicy({
        name: 'test',
        topics: {
          billing: {
            keywords: ['invoice', 'payment', 'charge'],
            threshold: 1,
          },
        },
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }],
      });
      expect(policy.topics.billing).toBeDefined();
      expect(policy.topics.billing.keywords).toEqual(['invoice', 'payment', 'charge']);
      expect(policy.topics.medical).toBeDefined(); // built-in still present
    });

    it('should allow overriding built-in topics', () => {
      const policy = loadPolicy({
        name: 'test',
        topics: {
          medical: {
            keywords: ['health', 'doctor'],
            threshold: 1,
          },
        },
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }],
      });
      expect(policy.topics.medical.keywords).toEqual(['health', 'doctor']);
      expect(policy.topics.medical.threshold).toBe(1);
    });
  });

  describe('rule type validation', () => {
    it('should validate deny-regex pattern', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-regex', pattern: '\\btest\\b', flags: 'i' }],
      });
      expect(policy.rules[0].params.pattern).toBe('\\btest\\b');
      expect(policy.rules[0].params.flags).toBe('i');
    });

    it('should validate require-disclaimer rule', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'require-disclaimer',
          disclaimer: 'Test disclaimer',
          position: 'start',
          fuzzyMatch: true,
        }],
      });
      expect(policy.rules[0].params.disclaimer).toBe('Test disclaimer');
      expect(policy.rules[0].params.position).toBe('start');
      expect(policy.rules[0].params.fuzzyMatch).toBe(true);
    });

    it('should validate replace rule', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'replace',
          patterns: [{ match: 'old', replacement: 'new' }],
        }],
      });
      expect(policy.rules[0].params.patterns).toEqual([{ match: 'old', replacement: 'new' }]);
    });

    it('should validate redact rule', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'redact',
          patterns: ['secret'],
          replacement: '[HIDDEN]',
        }],
      });
      expect(policy.rules[0].params.patterns).toEqual(['secret']);
      expect(policy.rules[0].params.replacement).toBe('[HIDDEN]');
    });

    it('should validate length-limit rule', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'length-limit',
          maxLength: 100,
          maxWords: 20,
        }],
      });
      expect(policy.rules[0].params.maxLength).toBe(100);
      expect(policy.rules[0].params.maxWords).toBe(20);
    });

    it('should validate deny-topic rule', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'deny-topic',
          topic: 'medical',
          threshold: 3,
        }],
      });
      expect(policy.rules[0].params.topic).toBe('medical');
      expect(policy.rules[0].params.threshold).toBe(3);
    });
  });

  describe('validation errors', () => {
    it('should throw on missing name', () => {
      expect(() => loadPolicy({ rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }] }))
        .toThrow(PolicyValidationError);
    });

    it('should throw on missing rules', () => {
      expect(() => loadPolicy({ name: 'test' }))
        .toThrow(PolicyValidationError);
    });

    it('should throw on duplicate rule IDs', () => {
      expect(() => loadPolicy({
        name: 'test',
        rules: [
          { id: 'r1', type: 'deny-keyword', keywords: ['x'] },
          { id: 'r1', type: 'deny-keyword', keywords: ['y'] },
        ],
      })).toThrow(PolicyValidationError);
    });

    it('should throw on unknown rule type', () => {
      expect(() => loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'unknown-type' }],
      })).toThrow(PolicyValidationError);
    });

    it('should throw on invalid regex pattern', () => {
      expect(() => loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-regex', pattern: '[invalid' }],
      })).toThrow(PolicyValidationError);
    });

    it('should throw on deny-keyword without keywords', () => {
      expect(() => loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'deny-keyword' }],
      })).toThrow(PolicyValidationError);
    });

    it('should throw on require-disclaimer without disclaimer', () => {
      expect(() => loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'require-disclaimer' }],
      })).toThrow(PolicyValidationError);
    });

    it('should throw on length-limit without any limit', () => {
      expect(() => loadPolicy({
        name: 'test',
        rules: [{ id: 'r1', type: 'length-limit' }],
      })).toThrow(PolicyValidationError);
    });

    it('should throw on condition referencing unknown topic', () => {
      expect(() => loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'deny-keyword',
          keywords: ['x'],
          condition: { topic: 'nonexistent-topic' },
        }],
      })).toThrow(PolicyValidationError);
    });

    it('should throw on invalid enforcement mode', () => {
      expect(() => loadPolicy({
        name: 'test',
        enforcement: 'invalid',
        rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['x'] }],
      })).toThrow(PolicyValidationError);
    });

    it('should include multiple errors in PolicyValidationError', () => {
      try {
        loadPolicy({
          name: 'test',
          rules: [
            { id: 'r1', type: 'deny-keyword' }, // missing keywords
            { id: 'r2', type: 'deny-regex' },    // missing pattern
          ],
        });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(PolicyValidationError);
        expect((e as PolicyValidationError).errors.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('conditions', () => {
    it('should parse topic condition', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'deny-keyword',
          keywords: ['x'],
          condition: { topic: 'medical' },
        }],
      });
      expect(policy.rules[0].condition).toEqual({ topic: 'medical' });
    });

    it('should parse keyword condition', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'deny-keyword',
          keywords: ['x'],
          condition: { keywords: ['trigger'] },
        }],
      });
      expect(policy.rules[0].condition?.keywords).toEqual(['trigger']);
    });

    it('should parse minLength condition', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'deny-keyword',
          keywords: ['x'],
          condition: { minLength: 100 },
        }],
      });
      expect(policy.rules[0].condition?.minLength).toBe(100);
    });
  });

  describe('disabled rules', () => {
    it('should parse enabled: false', () => {
      const policy = loadPolicy({
        name: 'test',
        rules: [{
          id: 'r1',
          type: 'deny-keyword',
          keywords: ['x'],
          enabled: false,
        }],
      });
      expect(policy.rules[0].enabled).toBe(false);
    });
  });
});
