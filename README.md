# content-policy

Declarative business-rule content policy engine for LLM input/output.

Load policy definitions from JSON (or simple YAML), evaluate text against typed rules, and get structured results with violations, compliance status, and optional automatic remediation.

## Install

```bash
npm install content-policy
```

## Quick Start

```typescript
import { loadPolicy, createEnforcer } from 'content-policy';

// Define a policy
const policy = loadPolicy({
  name: 'my-policy',
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

// Create an enforcer
const enforcer = createEnforcer(policy);

// Check text (read-only)
const result = enforcer.check('Our product is better than Google.', {
  direction: 'output',
});
console.log(result.pass);        // false
console.log(result.violations);  // [{ ruleId: 'no-competitors', ... }]

// Enforce (apply remediations)
const enforced = enforcer.enforce('Try Google for search.', {
  direction: 'output',
});
console.log(enforced.text); // "Try [COMPETITOR] for search."
```

## API

### `loadPolicy(source): Policy`

Load a policy from a JSON string, JavaScript object, or file path.

```typescript
// From object
const policy = loadPolicy({ name: 'p', rules: [...] });

// From JSON string
const policy = loadPolicy('{"name":"p","rules":[...]}');

// From file path
const policy = loadPolicy('./policy.json');
```

Throws `PolicyValidationError` if the policy is malformed.

### `createEnforcer(policy, options?): PolicyEnforcer`

Create a reusable enforcer instance.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enforcement` | `'audit' \| 'enforce' \| 'report'` | From policy | Override enforcement mode |
| `throwOnViolation` | `boolean` | `true` | Throw on unremediable error violations |
| `failOnWarnings` | `boolean` | From policy | Whether warnings cause `pass: false` |
| `customRules` | `CustomRule[]` | `[]` | Additional programmatic rules |
| `disabledRules` | `string[]` | `[]` | Rule IDs to skip |
| `topicOverrides` | `Record<string, Partial<TopicDefinition>>` | `{}` | Override topic definitions |

### `enforcer.check(text, context?): PolicyResult`

Evaluate text against all applicable rules. Does not modify text.

### `enforcer.checkInput(text): PolicyResult`

Evaluate user input (only `direction: 'input'` and `direction: 'both'` rules).

### `enforcer.checkOutput(text, context?): PolicyResult`

Evaluate LLM output with optional input context (for `language-match` rules).

### `enforcer.enforce(text, context?): EnforcedOutput`

Evaluate text and apply automatic remediations (redact, replace, insert disclaimer).

### `checkPolicy(policy, text, context?): PolicyResult`

Standalone check (creates a temporary enforcer).

### `enforcePolicy(policy, text, context?): EnforcedOutput`

Standalone enforce (creates a temporary enforcer with `throwOnViolation: false`).

## Rule Types

| Type | Purpose | Supports Remediation |
|------|---------|---------------------|
| `deny-keyword` | Text must NOT contain keywords | No |
| `deny-regex` | Text must NOT match regex | No |
| `require-keyword` | Text MUST contain keywords | No |
| `require-disclaimer` | Text MUST include disclaimer | Yes (insert) |
| `deny-topic` | Text must NOT discuss topic | No |
| `replace` | Replace matched content | Yes (replace) |
| `redact` | Mask matched content | Yes (redact) |
| `language-match` | Output language must match input | No |
| `length-limit` | Text must respect length bounds | No |
| `custom` | User-provided validation function | Depends |

## Severity Levels

- **`error`**: Blocks output in enforce mode. Causes `pass: false`.
- **`warning`**: Logged but does not block. `pass: false` only if `failOnWarnings: true`.
- **`info`**: Informational. Never blocks.

## Enforcement Modes

- **`audit`**: Log violations, return text unchanged.
- **`enforce`**: Apply remediations; throw or return `pass: false` for unremediable errors.
- **`report`**: Return detailed report with unmodified text.

## Built-in Topics

Five built-in topic dictionaries for conditional rules: `medical`, `financial`, `legal`, `political`, `religious`. Define custom topics in your policy:

```typescript
const policy = loadPolicy({
  name: 'my-policy',
  topics: {
    billing: {
      keywords: ['invoice', 'payment', 'charge', 'refund'],
      threshold: 1,
    },
  },
  rules: [
    {
      id: 'billing-email',
      type: 'require-keyword',
      keywords: ['support@acme.com'],
      condition: { topic: 'billing' },
    },
  ],
});
```

## Custom Rules

```typescript
const enforcer = createEnforcer(policy, {
  customRules: [
    {
      id: 'no-all-caps',
      type: 'custom',
      severity: 'warning',
      validate: (text) => {
        if (text === text.toUpperCase() && text.length > 10) {
          return [{ message: 'Text is all uppercase' }];
        }
        return [];
      },
    },
  ],
});
```

## Error Classes

- `PolicyValidationError` -- thrown by `loadPolicy()` when the policy is invalid. Has an `errors: string[]` property.
- `PolicyViolationError` -- thrown by `enforce()` when `throwOnViolation: true` and unremediable error violations exist. Has a `violations: Violation[]` property.

## Zero Dependencies

This package has zero runtime dependencies. All text matching, topic detection, and policy evaluation use built-in JavaScript/Node.js capabilities.

## License

MIT
