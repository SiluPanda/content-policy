import {
  Policy, Rule, EnforcerOptions, PolicyEnforcer, PolicyResult, EnforcedOutput,
  Violation, Remediation, DetectedTopic, Direction, CheckContext, OutputContext,
  CustomRule, EnforcementMode,
} from './types';
import { PolicyViolationError } from './errors';
import { detectTopics } from './topics';
import { evaluateRule } from './engine';

/** Rules that support automatic remediation. */
const REMEDIABLE_TYPES = new Set(['replace', 'redact', 'require-disclaimer']);

/**
 * Create a PolicyEnforcer instance preconfigured with a policy and options.
 */
export function createEnforcer(policy: Policy, options?: EnforcerOptions): PolicyEnforcer {
  const enforcementMode: EnforcementMode = options?.enforcement ?? policy.enforcement;
  const throwOnViolation = options?.throwOnViolation !== false; // default true
  const failOnWarnings = options?.failOnWarnings ?? policy.failOnWarnings;
  const disabledRules = new Set(options?.disabledRules ?? []);

  // Merge topics with overrides
  const topics = { ...policy.topics };
  if (options?.topicOverrides) {
    for (const [name, overrides] of Object.entries(options.topicOverrides)) {
      if (topics[name]) {
        topics[name] = {
          ...topics[name],
          ...overrides,
          keywords: overrides.keywords ?? topics[name].keywords,
          threshold: overrides.threshold ?? topics[name].threshold,
        };
      } else {
        topics[name] = {
          keywords: overrides.keywords ?? [],
          threshold: overrides.threshold ?? 1,
        };
      }
    }
  }

  // Merge rules with custom rules
  const allRules: Rule[] = [...policy.rules];
  if (options?.customRules) {
    for (const customRule of options.customRules) {
      allRules.push(customRuleToRule(customRule));
    }
  }

  const enforcer: PolicyEnforcer = {
    policy,

    check(text: string, context?: CheckContext): PolicyResult {
      return runCheck(text, context?.direction ?? 'output', undefined);
    },

    checkOutput(output: string, context?: OutputContext): PolicyResult {
      return runCheck(output, 'output', context?.input);
    },

    checkInput(input: string): PolicyResult {
      return runCheck(input, 'input', undefined);
    },

    enforce(text: string, context?: CheckContext): EnforcedOutput {
      return runEnforce(text, context?.direction ?? 'output', undefined);
    },
  };

  function runCheck(
    text: string,
    direction: Direction,
    input: string | undefined,
  ): PolicyResult {
    const startTime = performance.now();

    // Step 1: Validate inputs
    if (text === '') {
      return {
        pass: true,
        score: 1.0,
        violations: [],
        topicsDetected: [],
        rulesEvaluated: 0,
        durationMs: performance.now() - startTime,
      };
    }

    // Step 2: Filter rules by direction
    const applicableRules = allRules.filter(rule => {
      if (!rule.enabled) return false;
      if (disabledRules.has(rule.id)) return false;
      return matchesDirection(rule.direction, direction);
    });

    // Step 3: Detect topics
    const detectedTopics = detectTopics(text, topics);

    // Step 4: Evaluate each applicable rule
    const allViolations: Violation[] = [];
    let rulesEvaluated = 0;

    for (const rule of applicableRules) {
      // Check condition
      if (!evaluateCondition(rule, text, detectedTopics)) continue;

      rulesEvaluated++;
      const violations = evaluateRule(rule, text, detectedTopics, { direction, input });
      allViolations.push(...violations);
    }

    // Step 5: Determine compliance
    const pass = computePass(allViolations, failOnWarnings);

    // Step 6: Compute compliance score
    const score = computeScore(allViolations, rulesEvaluated);

    return {
      pass,
      score,
      violations: allViolations,
      topicsDetected: detectedTopics,
      rulesEvaluated,
      durationMs: performance.now() - startTime,
    };
  }

  function runEnforce(
    text: string,
    direction: Direction,
    input: string | undefined,
  ): EnforcedOutput {
    const startTime = performance.now();

    if (text === '') {
      return {
        text: '',
        pass: true,
        score: 1.0,
        violations: [],
        remediations: [],
        topicsDetected: [],
        durationMs: performance.now() - startTime,
      };
    }

    // Filter rules by direction
    const applicableRules = allRules.filter(rule => {
      if (!rule.enabled) return false;
      if (disabledRules.has(rule.id)) return false;
      return matchesDirection(rule.direction, direction);
    });

    // Detect topics
    const detectedTopics = detectTopics(text, topics);

    // Evaluate and remediate in order
    let currentText = text;
    const allViolations: Violation[] = [];
    const allRemediations: Remediation[] = [];
    let rulesEvaluated = 0;

    for (const rule of applicableRules) {
      if (!evaluateCondition(rule, currentText, detectedTopics)) continue;

      rulesEvaluated++;
      const violations = evaluateRule(rule, currentText, detectedTopics, { direction, input });

      const ruleEnforcementMode = rule.enforcement ?? enforcementMode;
      const isEnforceMode = ruleEnforcementMode === 'enforce';

      if (isEnforceMode && REMEDIABLE_TYPES.has(rule.type) && violations.length > 0) {
        // Apply remediation
        const { text: remediatedText, remediations } = applyRemediation(rule, currentText, violations);
        currentText = remediatedText;
        allRemediations.push(...remediations);

        // Mark violations as remediated
        for (const v of violations) {
          v.remediated = true;
        }
      }

      allViolations.push(...violations);
    }

    // Check for unremediable error violations in enforce mode
    const unremediated = allViolations.filter(
      v => v.severity === 'error' && !v.remediated,
    );

    if (enforcementMode === 'enforce' && throwOnViolation && unremediated.length > 0) {
      throw new PolicyViolationError(unremediated);
    }

    const pass = computePass(allViolations.filter(v => !v.remediated), failOnWarnings);
    const score = computeScore(allViolations, rulesEvaluated);

    return {
      text: currentText,
      pass,
      score,
      violations: allViolations,
      remediations: allRemediations,
      topicsDetected: detectedTopics,
      durationMs: performance.now() - startTime,
    };
  }

  return enforcer;
}

// ── Helpers ──────────────────────────────────────────────────

function matchesDirection(ruleDir: Direction, checkDir: Direction): boolean {
  if (ruleDir === 'both') return true;
  if (checkDir === 'both') return true;
  return ruleDir === checkDir;
}

function evaluateCondition(
  rule: Rule,
  text: string,
  detectedTopics: DetectedTopic[],
): boolean {
  if (!rule.condition) return true;

  const { topic, keywords, minLength } = rule.condition;

  if (topic) {
    const found = detectedTopics.find(t => t.name === topic);
    if (!found) return false;
  }

  if (keywords && keywords.length > 0) {
    const lowerText = text.toLowerCase();
    const anyFound = keywords.some(k => lowerText.includes(k.toLowerCase()));
    if (!anyFound) return false;
  }

  if (minLength !== undefined && text.length < minLength) {
    return false;
  }

  return true;
}

function computePass(violations: Violation[], failOnWarnings: boolean): boolean {
  const hasError = violations.some(v => v.severity === 'error' && !v.remediated);
  if (hasError) return false;

  if (failOnWarnings) {
    const hasWarning = violations.some(v => v.severity === 'warning' && !v.remediated);
    if (hasWarning) return false;
  }

  return true;
}

function computeScore(violations: Violation[], totalRules: number): number {
  if (totalRules === 0) return 1.0;

  const errorWeight = 1.0;
  const warningWeight = 0.3;
  const infoWeight = 0.05;

  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const v of violations) {
    if (v.remediated) continue;
    switch (v.severity) {
      case 'error': errorCount++; break;
      case 'warning': warningCount++; break;
      case 'info': infoCount++; break;
    }
  }

  const penalty = (errorWeight * errorCount + warningWeight * warningCount + infoWeight * infoCount) / totalRules;
  return Math.max(0, Math.min(1, 1.0 - penalty));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyRemediation(
  rule: Rule,
  text: string,
  violations: Violation[],
): { text: string; remediations: Remediation[] } {
  const remediations: Remediation[] = [];

  switch (rule.type) {
    case 'redact': {
      const replacement = rule.params.replacement as string;
      // Collect all matches with their locations, sort by position descending
      // to replace from end to start (so positions don't shift)
      const matches = violations
        .filter(v => v.location)
        .sort((a, b) => (b.location!.start - a.location!.start));

      let result = text;
      for (const v of matches) {
        const loc = v.location!;
        remediations.push({
          ruleId: rule.id,
          type: 'redact',
          original: v.matched,
          replacement,
          position: { start: loc.start, end: loc.end },
        });
        result = result.substring(0, loc.start) + replacement + result.substring(loc.end);
      }
      return { text: result, remediations };
    }

    case 'replace': {
      const patterns = rule.params.patterns as Array<{ match: string; replacement: string }>;
      const caseSensitive = rule.params.caseSensitive as boolean;
      const wholeWord = rule.params.wholeWord as boolean;

      let result = text;
      for (const { match: matchStr, replacement: replStr } of patterns) {
        const escaped = escapeRegex(matchStr);
        const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(pattern, flags);

        let m: RegExpExecArray | null;
        const localMatches: Array<{ start: number; end: number; matched: string }> = [];
        while ((m = regex.exec(result)) !== null) {
          localMatches.push({ start: m.index, end: m.index + m[0].length, matched: m[0] });
        }

        // Replace from end to start
        for (let i = localMatches.length - 1; i >= 0; i--) {
          const lm = localMatches[i];
          remediations.push({
            ruleId: rule.id,
            type: 'replace',
            original: lm.matched,
            replacement: replStr,
            position: { start: lm.start, end: lm.end },
          });
          result = result.substring(0, lm.start) + replStr + result.substring(lm.end);
        }
      }
      return { text: result, remediations };
    }

    case 'require-disclaimer': {
      const disclaimer = rule.params.disclaimer as string;
      const position = rule.params.position as 'start' | 'end';
      const separator = rule.params.separator as string;

      let result: string;
      let insertPos: { start: number; end: number };

      if (position === 'start') {
        result = disclaimer + separator + text;
        insertPos = { start: 0, end: 0 };
      } else {
        insertPos = { start: text.length, end: text.length };
        result = text + separator + disclaimer;
      }

      remediations.push({
        ruleId: rule.id,
        type: 'insert-disclaimer',
        replacement: disclaimer,
        position: insertPos,
      });

      return { text: result, remediations };
    }

    default:
      return { text, remediations: [] };
  }
}

function customRuleToRule(customRule: CustomRule): Rule {
  return {
    id: customRule.id,
    type: 'custom',
    description: customRule.description,
    severity: customRule.severity,
    direction: customRule.direction ?? 'output',
    condition: customRule.condition,
    enabled: true,
    params: {
      validate: customRule.validate,
    },
  };
}

// ── Standalone functions ─────────────────────────────────────

/**
 * Check text against a policy (standalone function).
 */
export function checkPolicy(policy: Policy, text: string, context?: CheckContext): PolicyResult {
  const enforcer = createEnforcer(policy);
  return enforcer.check(text, context);
}

/**
 * Enforce a policy on text (standalone function).
 */
export function enforcePolicy(policy: Policy, text: string, context?: CheckContext): EnforcedOutput {
  const enforcer = createEnforcer(policy, { throwOnViolation: false });
  return enforcer.enforce(text, context);
}
