import { Violation } from './types';

/**
 * Thrown by loadPolicy() when the policy file is malformed.
 */
export class PolicyValidationError extends Error {
  /** Validation errors found. */
  errors: string[];

  constructor(errors: string[]) {
    super(`Policy validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
    this.name = 'PolicyValidationError';
    this.errors = errors;
  }
}

/**
 * Thrown by enforce() when throwOnViolation is true and an
 * unremediable error-severity violation is found.
 */
export class PolicyViolationError extends Error {
  /** The violations that triggered the error. */
  violations: Violation[];

  constructor(violations: Violation[]) {
    const summary = violations
      .map(v => `  - [${v.ruleId}] ${v.message}`)
      .join('\n');
    super(`Policy enforcement failed with ${violations.length} unremediable violation(s):\n${summary}`);
    this.name = 'PolicyViolationError';
    this.violations = violations;
  }
}
