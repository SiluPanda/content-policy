// content-policy - Declarative business-rule content policy engine for LLMs

// Types
export type {
  Policy,
  Rule,
  RuleType,
  Severity,
  Direction,
  EnforcementMode,
  TopicDefinition,
  RuleCondition,
  Violation,
  ViolationLocation,
  DetectedTopic,
  PolicyResult,
  Remediation,
  EnforcedOutput,
  CustomRule,
  CustomRuleContext,
  CustomViolation,
  EnforcerOptions,
  CheckContext,
  OutputContext,
  PolicyEnforcer,
} from './types';

// Policy loading
export { loadPolicy } from './loader';

// Enforcer
export { createEnforcer, checkPolicy, enforcePolicy } from './enforcer';

// Errors
export { PolicyValidationError, PolicyViolationError } from './errors';

// Topic detection (for advanced use)
export { detectTopics, BUILTIN_TOPICS } from './topics';
