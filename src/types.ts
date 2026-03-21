// ── Enforcement & Severity ───────────────────────────────────

/** Enforcement mode determines what happens when violations are found. */
export type EnforcementMode = 'audit' | 'enforce' | 'report';

/** Severity levels categorize how serious a violation is. */
export type Severity = 'error' | 'warning' | 'info';

/** Direction determines when a rule applies. */
export type Direction = 'input' | 'output' | 'both';

/** Built-in rule types. */
export type RuleType =
  | 'deny-keyword'
  | 'deny-regex'
  | 'require-keyword'
  | 'require-disclaimer'
  | 'deny-topic'
  | 'replace'
  | 'redact'
  | 'language-match'
  | 'length-limit'
  | 'custom';

// ── Topic Definition ─────────────────────────────────────────

/** A topic definition for keyword-based topic detection. */
export interface TopicDefinition {
  /** Topic keywords. */
  keywords: string[];
  /** Minimum keyword matches to detect topic. */
  threshold: number;
}

/** A detected topic. */
export interface DetectedTopic {
  /** Topic name. */
  name: string;
  /** Number of keyword matches. */
  matchCount: number;
  /** Confidence score (matchCount / total keywords in topic dictionary). */
  confidence: number;
  /** Which keywords matched. */
  matchedKeywords: string[];
}

// ── Rule Condition ───────────────────────────────────────────

/** Condition that determines when a rule activates. */
export interface RuleCondition {
  /** Activate when this topic is detected. */
  topic?: string;
  /** Activate when at least one of these keywords is present. */
  keywords?: string[];
  /** Activate when text is at least this many characters. */
  minLength?: number;
}

// ── Rule ─────────────────────────────────────────────────────

/** A single policy rule. */
export interface Rule {
  /** Unique rule identifier. */
  id: string;
  /** Rule type. */
  type: RuleType;
  /** Human-readable description. */
  description?: string;
  /** Severity level. */
  severity: Severity;
  /** When this rule applies. */
  direction: Direction;
  /** Per-rule enforcement mode override. */
  enforcement?: EnforcementMode;
  /** Activation condition. */
  condition?: RuleCondition;
  /** Custom violation message template. */
  message?: string;
  /** Whether the rule is active. */
  enabled: boolean;
  /** Rule-type-specific parameters. */
  params: Record<string, unknown>;
}

// ── Policy ───────────────────────────────────────────────────

/** A loaded and validated policy. */
export interface Policy {
  /** Policy name. */
  name: string;
  /** Policy version (semver). */
  version?: string;
  /** Human-readable description. */
  description?: string;
  /** Default enforcement mode. */
  enforcement: EnforcementMode;
  /** Whether warnings cause pass: false. */
  failOnWarnings: boolean;
  /** Topic definitions (built-in + custom). */
  topics: Record<string, TopicDefinition>;
  /** Ordered array of rules. */
  rules: Rule[];
}

// ── Violation ────────────────────────────────────────────────

/** Location of a violation in the text. */
export interface ViolationLocation {
  /** Character offset of the start (0-based). */
  start: number;
  /** Character offset of the end (0-based, exclusive). */
  end: number;
}

/** A single policy violation. */
export interface Violation {
  /** The rule ID that produced this violation. */
  ruleId: string;
  /** Severity of the violated rule. */
  severity: Severity;
  /** Human-readable violation message. */
  message: string;
  /** The text that triggered the violation, if applicable. */
  matched?: string;
  /** Location in the text where the violation occurred. */
  location?: ViolationLocation;
  /** Suggestion for how to fix the violation. */
  suggestion?: string;
  /** Whether this violation was automatically remediated (in enforce mode). */
  remediated: boolean;
}

// ── Policy Result ────────────────────────────────────────────

/** Result of checking text against a policy. */
export interface PolicyResult {
  /** Whether the text passes the policy (no error-severity violations). */
  pass: boolean;
  /** Compliance score (0.0 = many violations, 1.0 = fully compliant). */
  score: number;
  /** All violations found. */
  violations: Violation[];
  /** Topics detected in the text. */
  topicsDetected: DetectedTopic[];
  /** Total number of rules evaluated. */
  rulesEvaluated: number;
  /** Evaluation duration in milliseconds. */
  durationMs: number;
}

// ── Remediation ──────────────────────────────────────────────

/** A single remediation applied to the text. */
export interface Remediation {
  /** The rule ID that triggered this remediation. */
  ruleId: string;
  /** The type of remediation. */
  type: 'replace' | 'redact' | 'insert-disclaimer';
  /** The original text that was replaced/redacted. */
  original?: string;
  /** The replacement text. */
  replacement: string;
  /** Position in the original text. */
  position: ViolationLocation;
}

// ── Enforced Output ──────────────────────────────────────────

/** Result of enforcing a policy on text. */
export interface EnforcedOutput {
  /** The (possibly modified) text. */
  text: string;
  /** Whether the enforced text passes the policy. */
  pass: boolean;
  /** Compliance score after enforcement. */
  score: number;
  /** All violations found (including remediated ones). */
  violations: Violation[];
  /** Details of all remediations applied. */
  remediations: Remediation[];
  /** Topics detected in the original text. */
  topicsDetected: DetectedTopic[];
  /** Evaluation duration in milliseconds. */
  durationMs: number;
}

// ── Custom Rule ──────────────────────────────────────────────

/** Context provided to custom rule validation functions. */
export interface CustomRuleContext {
  /** The direction being checked. */
  direction: Direction;
  /** Topics detected in the text. */
  topicsDetected: DetectedTopic[];
  /** The original input text (if provided via checkOutput). */
  input?: string;
}

/** A violation returned by a custom rule validation function. */
export interface CustomViolation {
  message: string;
  matched?: string;
  location?: ViolationLocation;
  suggestion?: string;
}

/** A custom rule defined programmatically. */
export interface CustomRule {
  id: string;
  type: 'custom';
  severity: Severity;
  description?: string;
  direction?: Direction;
  condition?: RuleCondition;
  validate: (text: string, context: CustomRuleContext) => CustomViolation[];
}

// ── Enforcer Options ─────────────────────────────────────────

/** Options for createEnforcer(). */
export interface EnforcerOptions {
  /** Override the policy's default enforcement mode. */
  enforcement?: EnforcementMode;
  /** Whether to throw PolicyViolationError on unremediable error-severity violations in enforce mode. Default: true. */
  throwOnViolation?: boolean;
  /** Whether warnings cause pass: false. Overrides the policy's setting. */
  failOnWarnings?: boolean;
  /** Additional rules defined programmatically. Appended to the policy's rules. */
  customRules?: CustomRule[];
  /** Override topic definitions (keywords, thresholds). */
  topicOverrides?: Record<string, Partial<TopicDefinition>>;
  /** Rule IDs to disable. These rules are skipped during evaluation. */
  disabledRules?: string[];
}

// ── Check Context ────────────────────────────────────────────

/** Context for check() calls. */
export interface CheckContext {
  /** The direction being checked. */
  direction?: Direction;
}

/** Context for checkOutput() calls. */
export interface OutputContext {
  /** The original user input (for language-match rules). */
  input?: string;
}

// ── Enforcer Interface ───────────────────────────────────────

/** A preconfigured policy enforcer. */
export interface PolicyEnforcer {
  /** Check text against the policy. Does not modify text. */
  check(text: string, context?: CheckContext): PolicyResult;
  /** Check LLM output with optional input context. */
  checkOutput(output: string, context?: OutputContext): PolicyResult;
  /** Check user input (evaluates input-direction rules only). */
  checkInput(input: string): PolicyResult;
  /** Enforce the policy: check and apply remediations. */
  enforce(text: string, context?: CheckContext): EnforcedOutput;
  /** The loaded policy. */
  readonly policy: Policy;
}
