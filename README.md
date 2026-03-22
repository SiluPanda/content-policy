# content-policy

Declarative business-rule content policy engine for LLM input and output.

[![npm version](https://img.shields.io/npm/v/content-policy.svg)](https://www.npmjs.com/package/content-policy)
[![license](https://img.shields.io/npm/l/content-policy.svg)](https://github.com/SiluPanda/content-policy/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/content-policy.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

Define content policies as structured rules in JSON or YAML. Evaluate LLM input and output against those rules. Get back structured results with every violation, its location in the text, a compliance score, and optionally a remediated version of the text with violations automatically fixed. Zero runtime dependencies.

## Installation

```bash
npm install content-policy
```

## Quick Start

```typescript
import { loadPolicy, createEnforcer } from 'content-policy';

// 1. Define a policy
const policy = loadPolicy({
  name: 'acme-corp',
  enforcement: 'enforce',
  rules: [
    {
      id: 'no-competitors',
      type: 'deny-keyword',
      severity: 'error',
      keywords: ['Google', 'Microsoft'],
      message: 'Mentions competitor: {{matched}}',
    },
    {
      id: 'redact-competitors',
      type: 'redact',
      severity: 'warning',
      patterns: ['Google', 'Microsoft'],
      replacement: '[COMPETITOR]',
    },
    {
      id: 'max-length',
      type: 'length-limit',
      severity: 'warning',
      maxLength: 2000,
    },
  ],
});

// 2. Create a reusable enforcer
const enforcer = createEnforcer(policy);

// 3. Check text (read-only, no modifications)
const result = enforcer.check('Our product is better than Google.', {
  direction: 'output',
});
console.log(result.pass);       // false
console.log(result.violations); // [{ ruleId: 'no-competitors', matched: 'Google', ... }]
console.log(result.score);      // 0.0 - 1.0 compliance score

// 4. Enforce (check + apply automatic remediations)
const enforced = enforcer.enforce('Try Google for search.', {
  direction: 'output',
});
console.log(enforced.text);          // "Try [COMPETITOR] for search."
console.log(enforced.remediations);  // [{ ruleId: 'redact-competitors', type: 'redact', ... }]
```

## Features

- **10 built-in rule types** covering keyword denial, regex matching, required content, topic gating, text replacement, redaction, language matching, and length limits
- **Automatic remediation** for `redact`, `replace`, and `require-disclaimer` rules in enforce mode
- **Bidirectional checking** with separate input (pre-flight) and output (post-flight) evaluation
- **Topic detection** using keyword-based heuristics with 5 built-in topic dictionaries (medical, financial, legal, political, religious) and support for custom topics
- **Conditional rules** that activate only when specific topics or keywords are detected
- **Three enforcement modes**: `audit` (log only), `enforce` (modify and block), `report` (detailed report, no modification)
- **Three severity levels**: `error` (blocks output), `warning` (logged), `info` (informational)
- **Compliance scoring** from 0.0 to 1.0 with severity-weighted penalty calculation
- **Custom rules** via programmatic validation functions
- **Per-rule enforcement overrides** to mix audit and enforce behavior within a single policy
- **Message templates** with `{{matched}}`, `{{expected}}`, `{{actual}}`, and `{{replacement}}` placeholders
- **Policy loading** from JSON strings, YAML strings, file paths, or JavaScript objects
- **Zero runtime dependencies**

## API Reference

### `loadPolicy(source)`

Load and validate a policy definition. Returns a `Policy` object.

```typescript
function loadPolicy(source: string | Record<string, unknown>): Policy;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | `string \| Record<string, unknown>` | A JSON string, YAML string, file path, or JavaScript object |

**Returns:** `Policy` -- a validated, immutable policy object.

**Throws:** `PolicyValidationError` if the source is malformed or fails validation.

```typescript
// From a JavaScript object
const policy = loadPolicy({
  name: 'my-policy',
  rules: [{ id: 'r1', type: 'deny-keyword', keywords: ['bad'] }],
});

// From a JSON string
const policy = loadPolicy('{"name":"my-policy","rules":[...]}');

// From a YAML string
const policy = loadPolicy(`
name: my-policy
rules:
  - id: r1
    type: deny-keyword
    keywords:
      - bad
`);

// From a file path (JSON or YAML)
const policy = loadPolicy('./policies/production.yaml');
```

#### Policy Definition

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | *required* | Policy name |
| `version` | `string` | `undefined` | Semver version string |
| `description` | `string` | `undefined` | Human-readable description |
| `enforcement` | `'audit' \| 'enforce' \| 'report'` | `'enforce'` | Default enforcement mode |
| `failOnWarnings` | `boolean` | `false` | Whether warning-severity violations cause `pass: false` |
| `topics` | `Record<string, TopicDefinition>` | `{}` | Custom topic definitions (merged with built-in topics) |
| `rules` | `Rule[]` | *required* | Ordered array of rules |

---

### `createEnforcer(policy, options?)`

Create a reusable `PolicyEnforcer` instance preconfigured with a policy and options.

```typescript
function createEnforcer(policy: Policy, options?: EnforcerOptions): PolicyEnforcer;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `policy` | `Policy` | A loaded policy from `loadPolicy()` |
| `options` | `EnforcerOptions` | Optional configuration overrides |

**`EnforcerOptions`:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enforcement` | `'audit' \| 'enforce' \| 'report'` | From policy | Override the policy's default enforcement mode |
| `throwOnViolation` | `boolean` | `true` | Throw `PolicyViolationError` on unremediable error-severity violations in enforce mode |
| `failOnWarnings` | `boolean` | From policy | Whether warnings cause `pass: false` |
| `customRules` | `CustomRule[]` | `[]` | Additional rules defined programmatically (appended to policy rules) |
| `disabledRules` | `string[]` | `[]` | Rule IDs to skip during evaluation |
| `topicOverrides` | `Record<string, Partial<TopicDefinition>>` | `{}` | Override topic keywords or thresholds |

**Returns:** `PolicyEnforcer` with the following methods:

---

### `enforcer.check(text, context?)`

Evaluate text against all applicable rules. Does not modify the text.

```typescript
enforcer.check(text: string, context?: CheckContext): PolicyResult;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | The text to evaluate |
| `context.direction` | `'input' \| 'output' \| 'both'` | Which direction to check (default: `'output'`) |

**Returns:** `PolicyResult`

| Field | Type | Description |
|-------|------|-------------|
| `pass` | `boolean` | `true` if no error-severity violations remain (respects `failOnWarnings`) |
| `score` | `number` | Compliance score from 0.0 (many violations) to 1.0 (fully compliant) |
| `violations` | `Violation[]` | All violations found |
| `topicsDetected` | `DetectedTopic[]` | Topics detected in the text |
| `rulesEvaluated` | `number` | Total number of rules evaluated |
| `durationMs` | `number` | Evaluation duration in milliseconds |

---

### `enforcer.checkInput(input)`

Check user input against input-direction rules only.

```typescript
enforcer.checkInput(input: string): PolicyResult;
```

Equivalent to `enforcer.check(input, { direction: 'input' })`. Only rules with `direction: 'input'` or `direction: 'both'` are evaluated.

---

### `enforcer.checkOutput(output, context?)`

Check LLM output with optional input context for language-match rules.

```typescript
enforcer.checkOutput(output: string, context?: OutputContext): PolicyResult;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `output` | `string` | The LLM output text |
| `context.input` | `string` | Original user input (used by `language-match` rules) |

---

### `enforcer.enforce(text, context?)`

Evaluate text and apply automatic remediations. Rules that support remediation (`redact`, `replace`, `require-disclaimer`) will modify the text in enforce mode. Unremediable violations (e.g., `deny-keyword`) are reported but not fixed.

```typescript
enforcer.enforce(text: string, context?: CheckContext): EnforcedOutput;
```

**Returns:** `EnforcedOutput`

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | The (possibly modified) text |
| `pass` | `boolean` | Whether the enforced text passes the policy |
| `score` | `number` | Compliance score after enforcement |
| `violations` | `Violation[]` | All violations found (including remediated ones, marked with `remediated: true`) |
| `remediations` | `Remediation[]` | Details of all remediations applied |
| `topicsDetected` | `DetectedTopic[]` | Topics detected in the original text |
| `durationMs` | `number` | Evaluation duration in milliseconds |

**Throws:** `PolicyViolationError` when `throwOnViolation` is `true` (the default) and unremediable error-severity violations are found in enforce mode.

---

### `checkPolicy(policy, text, context?)`

Standalone function that creates a temporary enforcer and checks text against a policy in a single call.

```typescript
function checkPolicy(policy: Policy, text: string, context?: CheckContext): PolicyResult;
```

```typescript
const policy = loadPolicy({ name: 'p', rules: [...] });
const result = checkPolicy(policy, 'Some text to check.');
```

---

### `enforcePolicy(policy, text, context?)`

Standalone function that creates a temporary enforcer (with `throwOnViolation: false`) and enforces a policy in a single call.

```typescript
function enforcePolicy(policy: Policy, text: string, context?: CheckContext): EnforcedOutput;
```

```typescript
const policy = loadPolicy({ name: 'p', enforcement: 'enforce', rules: [...] });
const result = enforcePolicy(policy, 'Text with secret info.');
console.log(result.text); // Modified text with remediations applied
```

---

### `detectTopics(text, topics)`

Detect topics in text using keyword-based heuristics. Exported for advanced use cases where you need topic detection independent of policy evaluation.

```typescript
function detectTopics(
  text: string,
  topics: Record<string, TopicDefinition>,
): DetectedTopic[];
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Text to analyze |
| `topics` | `Record<string, TopicDefinition>` | Topic definitions mapping names to keyword lists and thresholds |

**Returns:** `DetectedTopic[]` -- each entry contains `name`, `matchCount`, `confidence` (0.0-1.0), and `matchedKeywords`.

```typescript
import { detectTopics, BUILTIN_TOPICS } from 'content-policy';

const detected = detectTopics(
  'The doctor said the treatment is needed for the patient.',
  BUILTIN_TOPICS,
);
// [{ name: 'medical', matchCount: 3, confidence: 0.12, matchedKeywords: ['doctor', 'treatment', 'patient'] }]
```

---

### `BUILTIN_TOPICS`

A `Record<string, TopicDefinition>` containing five built-in topic dictionaries. Automatically included in every loaded policy.

| Topic | Threshold | Example Keywords |
|-------|-----------|-----------------|
| `medical` | 2 | health, doctor, treatment, medication, surgery, patient |
| `financial` | 2 | invest, stock, portfolio, mortgage, credit, tax |
| `legal` | 2 | attorney, lawsuit, contract, liability, statute |
| `political` | 3 | election, democrat, republican, congress, legislation |
| `religious` | 3 | religion, church, mosque, prayer, faith, scripture |

---

### Error Classes

#### `PolicyValidationError`

Thrown by `loadPolicy()` when the policy definition is malformed.

```typescript
class PolicyValidationError extends Error {
  errors: string[];  // All validation errors found
}
```

```typescript
try {
  loadPolicy({ name: 'test' }); // missing required 'rules' field
} catch (e) {
  if (e instanceof PolicyValidationError) {
    console.log(e.errors); // ['Missing required field: "rules" (must be an array)']
  }
}
```

#### `PolicyViolationError`

Thrown by `enforcer.enforce()` when `throwOnViolation` is `true` and unremediable error-severity violations are found.

```typescript
class PolicyViolationError extends Error {
  violations: Violation[];  // The violations that triggered the error
}
```

```typescript
try {
  enforcer.enforce('Text containing bad keyword.', { direction: 'output' });
} catch (e) {
  if (e instanceof PolicyViolationError) {
    console.log(e.violations); // [{ ruleId: 'no-bad', severity: 'error', ... }]
  }
}
```

## Rule Types

### `deny-keyword`

Text must NOT contain any of the specified keywords.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `keywords` | `string[]` | *required* | Keywords to deny |
| `caseSensitive` | `boolean` | `false` | Whether matching is case-sensitive |
| `wholeWord` | `boolean` | `true` | Whether to match whole words only (word boundary matching) |

```typescript
{
  id: 'no-competitors',
  type: 'deny-keyword',
  severity: 'error',
  keywords: ['Google', 'Microsoft', 'Meta'],
  caseSensitive: false,
  wholeWord: true,
  message: 'Mentions competitor: {{matched}}',
}
```

### `deny-regex`

Text must NOT match the specified regular expression.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pattern` | `string` | *required* | Regular expression pattern |
| `flags` | `string` | `''` | Regex flags (e.g., `'gi'`). Without `'g'`, only the first match is reported. |

```typescript
{
  id: 'no-pricing',
  type: 'deny-regex',
  severity: 'error',
  pattern: '\\$\\d+',
  flags: 'g',
  message: 'Contains pricing: {{matched}}',
}
```

### `require-keyword`

Text MUST contain one or all of the specified keywords.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `keywords` | `string[]` | *required* | Keywords to require |
| `caseSensitive` | `boolean` | `false` | Whether matching is case-sensitive |
| `requireAll` | `boolean` | `false` | When `true`, all keywords must be present. When `false`, at least one must be present. |

```typescript
{
  id: 'billing-email',
  type: 'require-keyword',
  severity: 'warning',
  keywords: ['support@acme.com'],
  condition: { topic: 'billing' },
}
```

### `require-disclaimer`

Text MUST include the specified disclaimer. Supports automatic remediation (inserts the disclaimer in enforce mode).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `disclaimer` | `string` | *required* | The disclaimer text |
| `position` | `'start' \| 'end'` | `'end'` | Where to insert the disclaimer during remediation |
| `fuzzyMatch` | `boolean` | `false` | Ignore whitespace differences and case when checking for the disclaimer |
| `separator` | `string` | `'\n\n'` | Text inserted between the disclaimer and the original text |

```typescript
{
  id: 'medical-disclaimer',
  type: 'require-disclaimer',
  severity: 'error',
  disclaimer: 'This is not medical advice. Consult a healthcare professional.',
  position: 'end',
  fuzzyMatch: true,
  condition: { topic: 'medical' },
}
```

### `deny-topic`

Text must NOT discuss the specified topic (detected via keyword heuristics).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `topic` | `string` | *required* | Topic name (must exist in built-in or custom topics) |
| `threshold` | `number` | From topic definition | Override the minimum keyword match count to trigger denial |

```typescript
{
  id: 'no-politics',
  type: 'deny-topic',
  severity: 'error',
  topic: 'political',
}
```

### `replace`

Replace matched content with specified text. Supports automatic remediation.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `patterns` | `Array<{ match: string; replacement: string }>` | *required* | Match/replacement pairs |
| `caseSensitive` | `boolean` | `false` | Whether matching is case-sensitive |
| `wholeWord` | `boolean` | `true` | Whether to match whole words only |

```typescript
{
  id: 'standardize-name',
  type: 'replace',
  severity: 'info',
  patterns: [
    { match: 'our product', replacement: 'ACME Widget Pro' },
    { match: 'the app', replacement: 'ACME Widget Pro' },
  ],
}
```

### `redact`

Mask matched content with a replacement string. Supports automatic remediation.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `patterns` | `string[]` | *required* | Patterns to redact |
| `replacement` | `string` | `'[REDACTED]'` | Replacement text |
| `caseSensitive` | `boolean` | `false` | Whether matching is case-sensitive |
| `wholeWord` | `boolean` | `true` | Whether to match whole words only |
| `useRegex` | `boolean` | `false` | Whether patterns are regular expressions |

```typescript
{
  id: 'redact-internals',
  type: 'redact',
  severity: 'warning',
  patterns: ['Project Phoenix', 'Project Atlas'],
  replacement: '[INTERNAL]',
}
```

### `language-match`

Output language must match the input language or be in an allowed language list. Uses Unicode script detection and common-word heuristics. Supported languages: English, Spanish, French, German, Portuguese, Italian, Chinese, Japanese, Korean, Arabic, Russian, Hindi.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `allowedLanguages` | `string[]` | `undefined` | If set, output must be in one of these languages. If not set, output must match the input language. |

```typescript
{
  id: 'language-check',
  type: 'language-match',
  severity: 'error',
  allowedLanguages: ['en', 'es'],
}
```

### `length-limit`

Text must respect character and/or word count boundaries. At least one limit must be specified.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `maxLength` | `number` | `undefined` | Maximum character count |
| `minLength` | `number` | `undefined` | Minimum character count |
| `maxWords` | `number` | `undefined` | Maximum word count |
| `minWords` | `number` | `undefined` | Minimum word count |

```typescript
{
  id: 'response-length',
  type: 'length-limit',
  severity: 'warning',
  maxLength: 2000,
  minWords: 10,
}
```

### `custom`

User-provided validation function. Defined programmatically via the `customRules` option on `createEnforcer()`.

```typescript
const enforcer = createEnforcer(policy, {
  customRules: [
    {
      id: 'no-all-caps',
      type: 'custom',
      severity: 'warning',
      direction: 'output',
      validate: (text: string, context: CustomRuleContext): CustomViolation[] => {
        if (text === text.toUpperCase() && text.length > 10) {
          return [{ message: 'Text is all uppercase' }];
        }
        return [];
      },
    },
  ],
});
```

**`CustomRuleContext`:**

| Field | Type | Description |
|-------|------|-------------|
| `direction` | `'input' \| 'output' \| 'both'` | The direction being checked |
| `topicsDetected` | `DetectedTopic[]` | Topics detected in the text |
| `input` | `string \| undefined` | The original user input (when using `checkOutput`) |

**`CustomViolation`:**

| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | Violation message |
| `matched` | `string \| undefined` | The text that triggered the violation |
| `location` | `ViolationLocation \| undefined` | Character offset of the violation |
| `suggestion` | `string \| undefined` | Suggested fix |

## Configuration

### Rule Common Fields

Every rule accepts the following fields regardless of type:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | *required* | Unique rule identifier |
| `type` | `RuleType` | *required* | One of the 10 rule types |
| `severity` | `'error' \| 'warning' \| 'info'` | `'error'` | Violation severity |
| `direction` | `'input' \| 'output' \| 'both'` | `'output'` | When the rule applies |
| `enforcement` | `'audit' \| 'enforce' \| 'report'` | From policy | Per-rule enforcement mode override |
| `description` | `string` | `undefined` | Human-readable description |
| `message` | `string` | Auto-generated | Custom violation message template |
| `enabled` | `boolean` | `true` | Whether the rule is active |
| `condition` | `RuleCondition` | `undefined` | Activation condition |

### Conditions

Rules can be conditionally activated using the `condition` field:

```typescript
condition: {
  topic?: string;      // Activate only when this topic is detected
  keywords?: string[]; // Activate only when at least one keyword is present
  minLength?: number;  // Activate only when text is at least this many characters
}
```

All specified conditions must be met for the rule to activate (AND logic).

### Custom Topics

Define custom topic dictionaries alongside the built-in ones:

```typescript
const policy = loadPolicy({
  name: 'my-policy',
  topics: {
    billing: {
      keywords: ['invoice', 'payment', 'charge', 'refund'],
      threshold: 1, // minimum keyword matches to detect the topic
    },
  },
  rules: [
    {
      id: 'billing-email',
      type: 'require-keyword',
      severity: 'warning',
      keywords: ['support@acme.com'],
      condition: { topic: 'billing' },
    },
  ],
});
```

Custom topics with the same name as built-in topics override the built-in definition.

### Message Templates

Custom violation messages support template variables:

| Variable | Available In | Description |
|----------|-------------|-------------|
| `{{matched}}` | `deny-keyword`, `deny-regex`, `deny-topic`, `replace`, `redact`, `language-match` | The matched text |
| `{{expected}}` | `require-keyword`, `require-disclaimer`, `length-limit`, `language-match` | The expected value |
| `{{actual}}` | `length-limit`, `language-match` | The actual value |
| `{{replacement}}` | `replace` | The replacement text |

```typescript
{
  id: 'max-len',
  type: 'length-limit',
  maxLength: 100,
  message: 'Response too long: {{actual}} chars (max {{expected}})',
}
```

## Error Handling

The library uses two error classes for structured error reporting.

**`PolicyValidationError`** is thrown during policy loading when the definition is invalid. It collects all validation errors before throwing, so you get every problem at once rather than one at a time:

```typescript
import { loadPolicy, PolicyValidationError } from 'content-policy';

try {
  loadPolicy({
    name: 'test',
    rules: [
      { id: 'r1', type: 'deny-keyword' },     // missing keywords
      { id: 'r2', type: 'deny-regex' },        // missing pattern
    ],
  });
} catch (e) {
  if (e instanceof PolicyValidationError) {
    // e.errors contains all validation problems
    for (const err of e.errors) {
      console.error(err);
    }
  }
}
```

**`PolicyViolationError`** is thrown during enforcement when `throwOnViolation` is `true` (the default) and there are unremediable error-severity violations. This provides a fail-fast mechanism for production pipelines:

```typescript
import { loadPolicy, createEnforcer, PolicyViolationError } from 'content-policy';

const policy = loadPolicy({ name: 'p', rules: [
  { id: 'r1', type: 'deny-keyword', keywords: ['forbidden'], severity: 'error' },
]});
const enforcer = createEnforcer(policy, { throwOnViolation: true });

try {
  const result = enforcer.enforce('This contains a forbidden word.');
} catch (e) {
  if (e instanceof PolicyViolationError) {
    console.error(`${e.violations.length} unremediable violation(s)`);
    // Handle: return error to caller, substitute fallback response, etc.
  }
}
```

To disable throwing and always receive a result object, set `throwOnViolation: false`:

```typescript
const enforcer = createEnforcer(policy, { throwOnViolation: false });
const result = enforcer.enforce('This contains a forbidden word.');
// result.pass === false, result.violations has the violations
```

## Advanced Usage

### Remediation Pipeline

When `enforce()` is called in `enforce` mode, remediable rules (`redact`, `replace`, `require-disclaimer`) automatically transform the text. Rules are applied in order, so earlier remediations affect the text that later rules evaluate. This allows stacking a redact rule before a deny-keyword rule -- the redaction removes the keyword before the denial check runs:

```typescript
const policy = loadPolicy({
  name: 'stacked',
  enforcement: 'enforce',
  rules: [
    {
      id: 'redact-google',
      type: 'redact',
      severity: 'warning',
      patterns: ['Google'],
      replacement: '[COMPETITOR]',
    },
    {
      id: 'no-competitors',
      type: 'deny-keyword',
      severity: 'error',
      keywords: ['Google'],
    },
  ],
});

const enforcer = createEnforcer(policy, { throwOnViolation: false });
const result = enforcer.enforce('Google has great products.');
// result.text === '[COMPETITOR] has great products.'
// Only 1 violation (redact), the deny-keyword rule finds no match
```

### Per-Rule Enforcement Overrides

Mix audit and enforce behavior within a single policy by setting `enforcement` on individual rules:

```typescript
const policy = loadPolicy({
  name: 'mixed',
  enforcement: 'audit', // global: just log
  rules: [
    {
      id: 'always-redact',
      type: 'redact',
      severity: 'warning',
      enforcement: 'enforce', // this rule overrides: actually redact
      patterns: ['secret-codename'],
      replacement: '[REDACTED]',
    },
    {
      id: 'log-competitors',
      type: 'deny-keyword',
      severity: 'warning',
      // inherits global 'audit' -- just logs, does not block
      keywords: ['Google'],
    },
  ],
});
```

### Bidirectional Checking

Evaluate input and output independently with direction-specific rules:

```typescript
const policy = loadPolicy({
  name: 'bidirectional',
  rules: [
    { id: 'input-filter', type: 'deny-keyword', keywords: ['spam'], direction: 'input' },
    { id: 'output-filter', type: 'deny-keyword', keywords: ['Google'], direction: 'output' },
    { id: 'always-filter', type: 'deny-keyword', keywords: ['classified'], direction: 'both' },
  ],
});

const enforcer = createEnforcer(policy);

// Only evaluates 'input' and 'both' rules
const inputResult = enforcer.checkInput('spam classified message');

// Only evaluates 'output' and 'both' rules
const outputResult = enforcer.checkOutput('Google is classified info', {
  input: 'Tell me about search engines',
});
```

### Topic Override at Runtime

Adjust topic detection sensitivity without modifying the policy:

```typescript
const enforcer = createEnforcer(policy, {
  topicOverrides: {
    medical: { threshold: 5 },  // require 5 keyword matches instead of default 2
    internal: {                  // add a new topic at runtime
      keywords: ['roadmap', 'sprint', 'backlog'],
      threshold: 2,
    },
  },
});
```

### Enforce-Then-Recheck Pattern

Apply enforcement, then recheck the result to confirm compliance:

```typescript
const enforced = enforcer.enforce(llmOutput, { direction: 'output' });
const recheck = enforcer.check(enforced.text, { direction: 'output' });

if (!recheck.pass) {
  // Enforcement was not sufficient -- fall back to a safe default response
  return FALLBACK_RESPONSE;
}
return enforced.text;
```

## TypeScript

The package ships with full type declarations. All types are exported from the main entry point:

```typescript
import type {
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
} from 'content-policy';
```

## License

MIT
