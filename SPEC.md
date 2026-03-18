# content-policy -- Specification

## 1. Overview

`content-policy` is a declarative business-rule content policy engine for LLM output and input. It loads policy definitions from YAML or JSON files, evaluates text against a catalog of typed rules, and returns a structured result containing every violation found, the text locations where violations occurred, the overall compliance status, and optionally a transformed version of the text with violations automatically remediated (redacted, replaced, or augmented with required content). It provides both a TypeScript/JavaScript API for programmatic use and a CLI for terminal and shell-script use.

The gap this package fills is specific and well-defined. Existing guardrails packages in the AI/LLM ecosystem focus on safety: toxicity detection, prompt injection prevention, PII redaction, and harmful content filtering. These are necessary but insufficient for production AI deployments. Every organization that deploys an LLM-powered product has business content policies that go beyond safety -- rules that govern what the AI should and should not say in the context of the business:

- **Brand protection**: "Never mention competitor names (Google, Microsoft, Meta) in product recommendations."
- **Legal compliance**: "Always include a medical disclaimer when discussing health topics."
- **Regulatory**: "Never provide specific financial advice or stock recommendations."
- **Customer routing**: "Always refer users to support@company.com for billing questions."
- **Sales process**: "Never discuss pricing before the user is authenticated."
- **Localization**: "Output must be in the same language as the user's input."
- **Confidentiality**: "Never reveal internal codenames or unreleased product names."
- **Quality**: "Always include a source citation when making factual claims."

No package in the npm ecosystem provides a standalone, declarative engine for defining and enforcing these business content policies. The closest tools are:

1. **NVIDIA NeMo Guardrails**: A Python framework for adding safety and topical rails to LLM applications. It is framework-heavy (requires its own conversation flow definition language, Colang), Python-only, and focused on conversational rails rather than declarative content policies. It cannot be dropped into a Node.js application as a content filter.

2. **Guardrails AI**: A Python library for validating LLM output structure (JSON schemas, type checking). It validates output _format_, not _content_. It does not enforce business rules like "never mention competitor X" or "always include a disclaimer when topic Y is detected."

3. **LLM Guard**: A Python library focused on safety scanning (toxicity, PII, prompt injection). It does not support custom business rules defined in configuration files.

4. **Open Policy Agent (OPA) / Cedar (AWS)**: Declarative policy languages for authorization decisions ("can user X access resource Y?"). They operate on structured access control data, not natural language content. Adapting OPA to evaluate "does this text mention a competitor?" requires writing custom Rego functions that replicate what `content-policy` provides natively.

None of these tools provide a JavaScript-native, zero-dependency, declarative policy engine where a product manager or compliance officer can write a YAML file defining business content rules and a developer can enforce those rules on LLM output with a single function call.

Within this monorepo, `content-policy` operates at the output layer -- after the LLM generates a response. It complements other packages in the safety and moderation pipeline: `jailbreak-heuristic` classifies user input for jailbreak attempts (pre-flight input guard); `llm-sanitize` cleans and normalizes LLM input/output (PII removal, token stripping); `token-fence` wraps prompt sections with boundary markers to prevent cross-section injection; `llm-audit-log` records all LLM interactions for compliance audit. `content-policy` provides the business-rule content filter that ensures LLM output conforms to organizational policies before it reaches the end user. It can also check input before it is sent to the LLM (pre-flight), preventing the user from submitting content that would require the LLM to violate policies.

The design philosophy is declarative rules over imperative code. Policies are defined in YAML or JSON configuration files, not in application code. This separation means that compliance officers, brand managers, and legal teams can author and review policies without modifying source code. Developers load the policy file and call the enforcer -- the business logic lives in the configuration, not in the application.

---

## 2. Goals and Non-Goals

### Goals

- Provide a `loadPolicy(source)` function that parses a policy definition from a YAML string, JSON string, file path, or JavaScript object and returns a validated `Policy` object.
- Provide a `createEnforcer(policy, options?)` factory that returns a `PolicyEnforcer` instance preconfigured with a policy and enforcement options, reusable across multiple checks.
- Provide `enforcer.check(text, context?)` that evaluates text against all applicable rules and returns a `PolicyResult` containing pass/fail status, all violations, detected topics, and a compliance score.
- Provide `enforcer.enforce(text, context?)` that evaluates text, applies automatic remediation (redactions, replacements, disclaimer insertions) for rules that support it, and returns an `EnforcedOutput` containing the modified text and the list of violations that were remediated and those that remain.
- Support both input checking (pre-flight: before sending to the LLM) and output checking (post-flight: before returning to the user), with rules configurable for which direction they apply.
- Define a comprehensive catalog of rule types: `deny-keyword`, `deny-regex`, `require-keyword`, `require-disclaimer`, `deny-topic`, `replace`, `redact`, `language-match`, `length-limit`, and `custom`.
- Support conditional rules that activate only when specific topics are detected in the text (e.g., "require medical disclaimer only when medical topics are discussed").
- Support topic detection via keyword-based heuristics with built-in topic dictionaries for common domains (medical, financial, legal, political, religious) and user-defined custom topics.
- Support three enforcement modes: `audit` (log violations, return text unchanged), `enforce` (block or modify text), and `report` (return detailed violation report alongside unmodified text).
- Support three severity levels per rule: `error` (blocks output in enforce mode), `warning` (logged but does not block), `info` (informational, for audit trail).
- Provide a CLI (`content-policy`) that validates policy files, checks text against a policy, and reports violations with deterministic exit codes.
- Maintain zero runtime dependencies. All text matching, topic detection, and policy evaluation use built-in JavaScript/Node.js capabilities.
- Target Node.js 18 and above.

### Non-Goals

- **Not a safety or toxicity detector.** This package does not detect hate speech, profanity, sexually explicit content, violence, or other safety violations. Safety detection requires ML models or curated toxicity lexicons that are outside the scope of a declarative business-rule engine. For safety filtering, use dedicated tools (Azure Content Safety, Perspective API, LLM Guard) or combine with `llm-sanitize` from this monorepo.
- **Not a jailbreak detector.** This package does not detect prompt injection or jailbreak attempts in user input. For jailbreak detection, use `jailbreak-heuristic` from this monorepo. `content-policy` operates on content (what is said), not intent (whether the user is trying to manipulate the LLM).
- **Not a PII detector or redactor.** This package can redact specific patterns (competitor names, internal codenames) defined in policy rules, but it does not detect or redact personally identifiable information (emails, phone numbers, addresses, SSNs) unless explicitly configured with regex patterns for those. For PII handling, use `llm-sanitize`.
- **Not a factual accuracy checker.** This package verifies that content conforms to declared business rules. It does not verify whether factual claims are true. For output quality evaluation, use `output-grade` from this monorepo.
- **Not an NLP or ML system.** Topic detection uses keyword-based heuristics, not natural language understanding, entity recognition, or sentiment analysis. The tradeoff is explicit: keyword-based topic detection is fast, deterministic, and requires no models, but it will miss topics discussed with unfamiliar vocabulary or oblique references.
- **Not a real-time policy update system.** Policies are loaded from files or objects at initialization time. Changes to the policy file require reloading the policy. The package does not watch files, poll for updates, or subscribe to policy change events.
- **Not an authorization engine.** This package evaluates text content against content rules. It does not make authorization decisions (can user X perform action Y?). For authorization, use OPA, Cedar, or a dedicated authorization library.

---

## 3. Target Users and Use Cases

### Product Managers Defining AI Behavior

Product managers who define what the AI product should and should not say. They write policy files in YAML that specify brand guidelines, competitive positioning rules, and content standards. They do not write code -- they author configuration that developers enforce. The YAML policy file is their interface.

### Legal and Compliance Teams

Legal teams that require LLM outputs to include disclaimers, avoid making guarantees, refrain from providing regulated advice (medical, financial, legal), and comply with industry regulations (HIPAA, FINRA, GDPR). They define compliance rules as policy entries that the development team enforces programmatically. The structured violation reports provide audit evidence.

### Brand Managers

Teams responsible for brand consistency across AI-powered touchpoints. Policies enforce that the AI never mentions competitors by name, always uses approved product names, follows brand voice guidelines, and routes users to the correct channels for specific topics.

### Enterprise AI Platform Teams

Teams building shared AI platforms used by multiple internal products. A central policy file enforces organization-wide rules across all products: data classification handling, approved external references, required attribution, and prohibited topics. Each product can layer additional policies on top of the organization baseline.

### AI Application Developers

Developers building chat applications, AI assistants, or API endpoints that need content policy enforcement as part of their request processing pipeline. The typical integration is: receive user input, optionally check input against policy, send to LLM, check LLM output against policy, return the compliant response or block. `content-policy` provides the check/enforce step with a single function call.

### Customer Support AI Operators

Teams deploying AI-powered customer support that must follow strict routing rules ("direct billing questions to billing@company.com"), avoid making promises ("we guarantee" or "we will refund"), and include standard disclaimers in responses about product warranties or service levels.

---

## 4. Core Concepts

### Policy

A policy is the top-level container for a set of content rules. It is defined in a YAML or JSON file and loaded into memory as a `Policy` object. A policy has metadata (name, version, description), a default enforcement mode, an optional list of topic definitions, and an array of rules. A single application may load multiple policies and evaluate text against all of them, but each policy is self-contained.

### Rule

A rule is a single content constraint within a policy. Each rule has a unique ID, a type (which determines how it evaluates text), a severity level, an optional condition (when the rule applies), a description (for human-readable violation messages), and type-specific parameters (keywords, patterns, replacement text, disclaimer text, etc.). Rules are the atomic units of policy enforcement. A policy with 20 rules evaluates all 20 rules against every text input and collects all violations.

### Rule Type

A rule type defines the evaluation logic for a class of rules. `content-policy` provides ten built-in rule types: `deny-keyword`, `deny-regex`, `require-keyword`, `require-disclaimer`, `deny-topic`, `replace`, `redact`, `language-match`, `length-limit`, and `custom`. Each rule type has its own parameters, matching algorithm, and remediation behavior. Rule types are fixed -- users cannot define new rule types, but the `custom` type allows arbitrary validation logic via a user-provided function.

### Violation

A violation is a single instance of a rule being broken. When text fails a rule check, the result includes a `Violation` object with the rule ID, severity, a human-readable message, the matched text (if applicable), the location in the text where the violation occurred, and an optional suggestion for how to fix it. A single text input may produce zero, one, or many violations across multiple rules.

### Topic

A topic is a named category of content detected via keyword-based heuristics. Topics are used as conditions for conditional rules: "require a medical disclaimer only when medical topics are detected." A topic is defined by a name, a set of trigger keywords, and an optional confidence threshold (minimum number of keyword matches to consider the topic detected). `content-policy` provides built-in topic dictionaries for five common domains (medical, financial, legal, political, religious) and supports user-defined custom topics.

### Enforcement Mode

An enforcement mode determines what happens when violations are found:

- **`audit`**: Log violations but return the text unchanged. The `PolicyResult` contains violations, but the text is not modified or blocked. Use this mode for rollout, testing, and monitoring before enabling enforcement.
- **`enforce`**: Block or modify the text. For rules that support remediation (`replace`, `redact`, `require-disclaimer`), the text is automatically modified to comply. For rules that do not support remediation (`deny-keyword`, `deny-regex`, `deny-topic`), the enforcer throws a `PolicyViolationError` or returns a result with `pass: false`, depending on configuration. Use this mode in production to actively prevent policy violations.
- **`report`**: Return a detailed violation report alongside the unmodified text. Similar to `audit`, but optimized for generating compliance reports rather than inline filtering. Use this mode for batch analysis and compliance auditing.

The enforcement mode can be set globally on the enforcer or per-rule. Per-rule enforcement modes override the global mode.

### Severity

Severity levels categorize how serious a violation is:

- **`error`**: A critical policy violation. In `enforce` mode, `error`-severity violations block output (if the rule does not support remediation) or must be remediated (if the rule supports it). Errors cause `PolicyResult.pass` to be `false`.
- **`warning`**: A significant policy violation that should be addressed but does not block output. Warnings are included in the violation report. They do not cause `PolicyResult.pass` to be `false` by default (configurable via `failOnWarnings` option).
- **`info`**: An informational finding. Included in the violation report for awareness and audit trail. Never blocks output. Never causes `pass` to be `false`.

### Direction

Rules can be configured to apply to input, output, or both:

- **`output`** (default): The rule applies when checking LLM output (post-flight).
- **`input`**: The rule applies when checking user input (pre-flight).
- **`both`**: The rule applies in both directions.

This distinction allows policies to have rules like "deny competitor names in output" (don't let the AI mention competitors) alongside "deny offensive language in input" (don't let users submit offensive content to the AI).

---

## 5. Policy File Format

### Overview

Policies are defined in YAML or JSON. YAML is the recommended format for human authoring due to its readability. JSON is supported for programmatic generation and interoperability. Both formats map to the same internal `Policy` structure.

### Complete Policy File Structure

```yaml
# policy.yaml -- Example content policy definition

# ── Metadata ─────────────────────────────────────────────────
name: "acme-corp-content-policy"
version: "1.2.0"
description: "Content policy for ACME Corp customer-facing AI assistant"

# ── Global Settings ──────────────────────────────────────────
enforcement: "enforce"           # Default enforcement mode: audit | enforce | report
failOnWarnings: false            # Whether warnings cause pass: false (default: false)

# ── Custom Topic Definitions ─────────────────────────────────
topics:
  medical:
    keywords:
      - "health"
      - "doctor"
      - "symptom"
      - "diagnosis"
      - "treatment"
      - "medicine"
      - "medication"
      - "prescription"
      - "surgery"
      - "hospital"
      - "patient"
      - "disease"
      - "illness"
      - "therapy"
      - "clinical"
    threshold: 2                 # Minimum keyword matches to detect topic

  billing:
    keywords:
      - "invoice"
      - "payment"
      - "charge"
      - "refund"
      - "subscription"
      - "pricing"
      - "billing"
      - "cost"
      - "fee"
      - "plan"
    threshold: 1

# ── Rules ─────────────────────────────────────────────────────
rules:
  - id: "no-competitor-names"
    type: "deny-keyword"
    description: "Never mention competitor names in responses"
    severity: "error"
    direction: "output"
    keywords:
      - "Google"
      - "Microsoft"
      - "Meta"
      - "Amazon"
      - "Apple"
    caseSensitive: false
    message: "Response mentions a competitor name: {{matched}}"

  - id: "medical-disclaimer"
    type: "require-disclaimer"
    description: "Include medical disclaimer when discussing health topics"
    severity: "error"
    direction: "output"
    condition:
      topic: "medical"
    disclaimer: "This information is for educational purposes only and is not a substitute for professional medical advice. Please consult a qualified healthcare provider."
    position: "end"
    message: "Response discusses medical topics without the required disclaimer"

  - id: "no-financial-advice"
    type: "deny-regex"
    description: "Never provide specific financial advice"
    severity: "error"
    direction: "output"
    pattern: "\\b(you should (buy|sell|invest in)|I recommend (buying|selling|investing))\\b"
    flags: "i"
    message: "Response contains specific financial advice: {{matched}}"

  - id: "support-email-routing"
    type: "require-keyword"
    description: "Include support email when discussing billing"
    severity: "warning"
    direction: "output"
    condition:
      topic: "billing"
    keywords:
      - "support@acme.com"
    message: "Response discusses billing without directing the user to support@acme.com"

  - id: "redact-competitors"
    type: "redact"
    description: "Replace competitor names with [COMPETITOR]"
    severity: "warning"
    direction: "output"
    patterns:
      - "Google"
      - "Microsoft"
      - "Meta"
    replacement: "[COMPETITOR]"
    caseSensitive: false

  - id: "no-pricing-unauthenticated"
    type: "deny-regex"
    description: "Never discuss pricing details"
    severity: "error"
    direction: "output"
    pattern: "\\$\\d+|\\d+\\.\\d{2}\\s*(per|/)(month|year|user|seat)"
    flags: "i"
    message: "Response contains pricing information: {{matched}}"

  - id: "response-length"
    type: "length-limit"
    description: "Responses must not exceed 2000 characters"
    severity: "warning"
    direction: "output"
    maxLength: 2000
    message: "Response exceeds the maximum length of 2000 characters (actual: {{actual}})"
```

### Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier for the policy. Used in violation reports and logs. |
| `version` | string | No | Semantic version of the policy. For tracking policy changes over time. |
| `description` | string | No | Human-readable description of the policy's purpose. |

### Global Settings

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `enforcement` | string | No | `"enforce"` | Default enforcement mode: `"audit"`, `"enforce"`, or `"report"`. |
| `failOnWarnings` | boolean | No | `false` | Whether `warning`-severity violations cause `PolicyResult.pass` to be `false`. |

### Topic Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `keywords` | string[] | Yes | List of keywords that trigger topic detection. Case-insensitive matching. |
| `threshold` | number | No (default: 1) | Minimum number of keyword matches required to consider the topic detected. |

### Rule Definition (Common Fields)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for this rule within the policy. |
| `type` | string | Yes | Rule type. One of the built-in types or `"custom"`. |
| `description` | string | No | Human-readable description of the rule's purpose. |
| `severity` | string | No (default: `"error"`) | Severity level: `"error"`, `"warning"`, or `"info"`. |
| `direction` | string | No (default: `"output"`) | When the rule applies: `"input"`, `"output"`, or `"both"`. |
| `enforcement` | string | No | Per-rule enforcement mode override. Overrides the global mode. |
| `condition` | object | No | Condition that must be met for the rule to activate. |
| `message` | string | No | Custom violation message template. Supports `{{matched}}`, `{{actual}}`, `{{expected}}` placeholders. |
| `enabled` | boolean | No (default: `true`) | Whether this rule is active. Set to `false` to disable without removing. |

### Condition Object

| Field | Type | Description |
|-------|------|-------------|
| `topic` | string | Rule activates only when this topic is detected in the text. |
| `keywords` | string[] | Rule activates only when at least one of these keywords is present in the text. |
| `minLength` | number | Rule activates only when the text is at least this many characters. |
| `direction` | string | Rule activates only in this direction (`"input"` or `"output"`). Overrides the rule's `direction` field for condition checking. |

---

## 6. Rule Types

### 6.1 `deny-keyword`

**Purpose**: Text must NOT contain any of the specified keywords or phrases. This is the most common rule type -- it blocks specific words, phrases, competitor names, internal codenames, prohibited terms, or any other content that should never appear.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `keywords` | string[] | Yes | -- | List of keywords or phrases to deny. |
| `caseSensitive` | boolean | No | `false` | Whether matching is case-sensitive. |
| `wholeWord` | boolean | No | `true` | Whether to match whole words only. When `true`, "Meta" does not match "metadata". |

**Evaluation algorithm**:

1. For each keyword in the `keywords` list:
   a. If `wholeWord` is `true`, construct a regex with word boundaries: `/\b{keyword}\b/` (with `i` flag if `caseSensitive` is `false`).
   b. If `wholeWord` is `false`, use simple string inclusion: `text.includes(keyword)` (or case-insensitive equivalent).
2. If any keyword matches, produce a violation with the matched keyword and its location in the text.
3. Multiple matches produce multiple violations (one per match location).

**Remediation**: None. `deny-keyword` rules identify violations but do not modify text. Use `redact` or `replace` rules for automatic remediation of denied keywords.

**YAML example**:

```yaml
- id: "no-competitor-names"
  type: "deny-keyword"
  severity: "error"
  keywords:
    - "Google"
    - "Microsoft"
    - "Meta"
    - "Amazon Web Services"
  caseSensitive: false
  wholeWord: true
  message: "Response mentions a competitor: {{matched}}"
```

---

### 6.2 `deny-regex`

**Purpose**: Text must NOT match the specified regular expression pattern. More flexible than `deny-keyword` -- use this for patterns like email addresses, phone numbers, pricing formats, URL patterns, specific sentence structures, or any content that can be described by a regex.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `pattern` | string | Yes | -- | Regular expression pattern as a string. |
| `flags` | string | No | `""` | Regex flags (e.g., `"i"` for case-insensitive, `"g"` for global, `"m"` for multiline). |

**Evaluation algorithm**:

1. Compile the pattern and flags into a `RegExp` object. If the pattern is invalid, produce a configuration error (not a violation).
2. Execute the regex against the text.
3. For each match, produce a violation with the matched text and its location.
4. If the `g` (global) flag is set, find all matches. Otherwise, find only the first match.

**Remediation**: None.

**YAML example**:

```yaml
- id: "no-stock-recommendations"
  type: "deny-regex"
  severity: "error"
  pattern: "\\b(buy|sell|hold)\\s+(shares?|stock)\\s+(of|in)\\s+\\w+"
  flags: "i"
  message: "Response contains a stock recommendation: {{matched}}"
```

---

### 6.3 `require-keyword`

**Purpose**: Text MUST contain at least one of the specified keywords or phrases when the rule's condition is met. Use this for required content: support email addresses, product names, standard phrases, attribution text, or any content that must be present in certain contexts.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `keywords` | string[] | Yes | -- | List of keywords or phrases. At least one must be present. |
| `caseSensitive` | boolean | No | `false` | Whether matching is case-sensitive. |
| `requireAll` | boolean | No | `false` | If `true`, ALL keywords must be present. If `false`, at least one. |

**Evaluation algorithm**:

1. If the rule has a condition, evaluate the condition first. If the condition is not met, skip the rule (no violation).
2. For each keyword, check if the text contains it (using case-sensitive or case-insensitive matching).
3. If `requireAll` is `false`: produce a violation if NONE of the keywords are found.
4. If `requireAll` is `true`: produce a violation for each keyword that is NOT found.

**Remediation**: None. The enforcer cannot automatically insert required content because it does not know where to place it or how to phrase it in context. The `require-disclaimer` rule type handles the specific case of appending/prepending disclaimer text.

**YAML example**:

```yaml
- id: "billing-support-email"
  type: "require-keyword"
  severity: "warning"
  condition:
    topic: "billing"
  keywords:
    - "support@acme.com"
    - "billing@acme.com"
  message: "Response discusses billing without providing a support contact"
```

---

### 6.4 `require-disclaimer`

**Purpose**: Text MUST include the specified disclaimer text when the rule's condition is met. Unlike `require-keyword`, this rule type supports automatic remediation: if the disclaimer is missing, the enforcer can insert it at a specified position (beginning or end of the text).

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `disclaimer` | string | Yes | -- | The exact disclaimer text that must be present. |
| `position` | string | No | `"end"` | Where to insert the disclaimer if missing: `"start"` or `"end"`. |
| `fuzzyMatch` | boolean | No | `false` | If `true`, check if the text contains the disclaimer approximately (normalized whitespace, case-insensitive). If `false`, require exact match. |
| `separator` | string | No | `"\n\n"` | Separator between the original text and the inserted disclaimer. |

**Evaluation algorithm**:

1. If the rule has a condition, evaluate the condition first. If the condition is not met, skip the rule.
2. If `fuzzyMatch` is `false`: check if the text contains the exact disclaimer string.
3. If `fuzzyMatch` is `true`: normalize both the text and the disclaimer (collapse whitespace, lowercase), then check for inclusion.
4. If the disclaimer is not found, produce a violation.

**Remediation**: In `enforce` mode, append or prepend the disclaimer text to the output, separated by the configured separator.

**YAML example**:

```yaml
- id: "medical-disclaimer"
  type: "require-disclaimer"
  severity: "error"
  condition:
    topic: "medical"
  disclaimer: "Disclaimer: This information is for educational purposes only and is not a substitute for professional medical advice."
  position: "end"
  fuzzyMatch: true
  message: "Response discusses medical topics without the required disclaimer"
```

---

### 6.5 `deny-topic`

**Purpose**: Text must NOT discuss the specified topic. The topic is detected via the topic detection system (keyword-based heuristics). Use this to prevent the AI from discussing subjects that are outside its domain, prohibited by policy, or inappropriate for the context.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topic` | string | Yes | -- | The topic name to deny. Must match a built-in or custom-defined topic. |
| `threshold` | number | No | Inherited from topic definition | Override the topic detection threshold for this rule. |

**Evaluation algorithm**:

1. Run topic detection on the text for the specified topic.
2. If the topic is detected (keyword matches meet the threshold), produce a violation listing the trigger keywords found.
3. The violation message includes which keywords triggered the topic detection.

**Remediation**: None. Topic-level denial cannot be automatically remediated because it would require rewriting the substantive content of the text.

**YAML example**:

```yaml
- id: "no-political-discussion"
  type: "deny-topic"
  severity: "error"
  topic: "political"
  threshold: 3
  message: "Response discusses political topics, which is outside the assistant's domain"
```

---

### 6.6 `replace`

**Purpose**: Automatically replace matched content with specified alternative text. Unlike `redact` (which masks content), `replace` substitutes meaningful alternatives. Use this for brand-approved synonyms, standardized terminology, or content normalization.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `patterns` | object[] | Yes | -- | Array of `{ match, replacement }` pairs. `match` is a string or regex pattern. `replacement` is the substitute text. |
| `caseSensitive` | boolean | No | `false` | Whether matching is case-sensitive. |
| `wholeWord` | boolean | No | `true` | Whether to match whole words only. |

**Evaluation algorithm**:

1. For each `{ match, replacement }` pair in the `patterns` array:
   a. Find all occurrences of `match` in the text (respecting `caseSensitive` and `wholeWord`).
   b. For each occurrence, record a violation noting the original text and the replacement.
2. Violations from `replace` rules are always flagged even in `audit` mode, but text is only modified in `enforce` mode.

**Remediation**: In `enforce` mode, replace all matched occurrences with their corresponding replacement text.

**YAML example**:

```yaml
- id: "standardize-product-names"
  type: "replace"
  severity: "info"
  patterns:
    - match: "ACME Widget"
      replacement: "ACME Widget Pro"
    - match: "our product"
      replacement: "ACME Widget Pro"
  caseSensitive: false
  message: "Non-standard product name replaced: {{matched}} -> {{replacement}}"
```

---

### 6.7 `redact`

**Purpose**: Remove or mask matched content. The matched text is replaced with a placeholder (e.g., `[REDACTED]`, `[COMPETITOR]`, `***`). Use this for removing competitor names, internal codenames, unreleased product names, or any content that should be hidden rather than replaced with meaningful alternatives.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `patterns` | string[] | Yes | -- | List of strings or regex patterns to match. |
| `replacement` | string | No | `"[REDACTED]"` | The placeholder text to substitute for matched content. |
| `caseSensitive` | boolean | No | `false` | Whether matching is case-sensitive. |
| `wholeWord` | boolean | No | `true` | Whether to match whole words only. |
| `useRegex` | boolean | No | `false` | Whether to interpret patterns as regular expressions. |

**Evaluation algorithm**:

1. For each pattern in the `patterns` array:
   a. Find all occurrences in the text.
   b. For each occurrence, record a violation noting the original text and the redaction placeholder.
2. In `enforce` mode, replace all occurrences with the `replacement` placeholder.

**Remediation**: In `enforce` mode, replace matched text with the `replacement` placeholder.

**YAML example**:

```yaml
- id: "redact-internal-codenames"
  type: "redact"
  severity: "warning"
  patterns:
    - "Project Phoenix"
    - "Project Titan"
    - "Project Nebula"
  replacement: "[INTERNAL]"
  caseSensitive: false
  message: "Internal codename redacted: {{matched}}"
```

---

### 6.8 `language-match`

**Purpose**: The output language must match the input language. This rule requires both the input text and the output text to be provided. It detects the primary language of each text and produces a violation if they differ. Use this for applications that must respond in the user's language.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `allowedLanguages` | string[] | No | -- | If specified, restrict output to only these languages (ISO 639-1 codes). If not specified, the output must match the input language. |

**Evaluation algorithm**:

1. Detect the primary language of the input text using character-set analysis and keyword heuristics.
2. Detect the primary language of the output text using the same method.
3. If `allowedLanguages` is specified: produce a violation if the output language is not in the allowed list.
4. If `allowedLanguages` is not specified: produce a violation if the output language does not match the input language.

**Language detection method**: Lightweight heuristic based on Unicode script detection (Latin, Cyrillic, CJK, Arabic, Devanagari, etc.) combined with common-word frequency analysis for languages that share the Latin script (English, Spanish, French, German, Portuguese, Italian). This is not a full NLP language detector -- it provides a best-effort classification suitable for detecting obvious language mismatches. The detection supports the following languages with reasonable accuracy: English, Spanish, French, German, Portuguese, Italian, Russian, Chinese (Simplified/Traditional), Japanese, Korean, Arabic, Hindi.

**Remediation**: None. Language mismatch requires regeneration of the response, which is outside the scope of content policy enforcement.

**YAML example**:

```yaml
- id: "match-input-language"
  type: "language-match"
  severity: "error"
  direction: "output"
  message: "Response language ({{actual}}) does not match input language ({{expected}})"
```

---

### 6.9 `length-limit`

**Purpose**: Text must not exceed a specified length. Use this to enforce response length limits, prevent overly verbose outputs, or comply with downstream system constraints (e.g., SMS character limits, chat widget display limits).

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `maxLength` | number | No | -- | Maximum number of characters. |
| `minLength` | number | No | -- | Minimum number of characters. |
| `maxWords` | number | No | -- | Maximum number of words. |
| `minWords` | number | No | -- | Minimum number of words. |

At least one of these parameters must be specified.

**Evaluation algorithm**:

1. Count characters and/or words in the text (words are separated by whitespace).
2. If any limit is exceeded, produce a violation including the actual count and the limit.

**Remediation**: None. Truncating text arbitrarily would produce incoherent output. Length violations require regeneration with different LLM parameters.

**YAML example**:

```yaml
- id: "max-response-length"
  type: "length-limit"
  severity: "warning"
  direction: "output"
  maxLength: 2000
  maxWords: 350
  message: "Response exceeds length limit ({{actual}} characters, max {{expected}})"
```

---

### 6.10 `custom`

**Purpose**: A user-provided validation function for rules that cannot be expressed with the built-in types. The function receives the text and context and returns an array of violations. Use this as an escape hatch for complex business logic that requires programmatic evaluation.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `validate` | function | Yes | A function `(text: string, context: RuleContext) => Violation[]`. Returns an empty array if the text passes. |

**Note**: Custom rules cannot be defined in YAML/JSON policy files because they require a JavaScript function. They are registered via the programmatic API when creating the enforcer.

**API example**:

```typescript
import { createEnforcer, loadPolicy } from 'content-policy';

const policy = loadPolicy('./policy.yaml');

const enforcer = createEnforcer(policy, {
  customRules: [
    {
      id: 'no-all-caps-sentences',
      type: 'custom',
      severity: 'warning',
      description: 'Sentences must not be entirely uppercase',
      validate: (text) => {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        return sentences
          .filter(s => s.trim() === s.trim().toUpperCase() && s.trim().length > 10)
          .map(s => ({
            matched: s.trim(),
            message: `Sentence is entirely uppercase: "${s.trim().slice(0, 50)}..."`,
          }));
      },
    },
  ],
});
```

---

### Rule Type Summary

| Rule Type | Text Must... | Supports Remediation | Supports Condition |
|-----------|-------------|---------------------|-------------------|
| `deny-keyword` | NOT contain keywords | No | Yes |
| `deny-regex` | NOT match regex | No | Yes |
| `require-keyword` | Contain keywords | No | Yes |
| `require-disclaimer` | Contain disclaimer text | Yes (insert) | Yes |
| `deny-topic` | NOT discuss topic | No | No (topic IS the condition) |
| `replace` | -- (transforms matches) | Yes (replace) | Yes |
| `redact` | -- (masks matches) | Yes (redact) | Yes |
| `language-match` | Match input language | No | No |
| `length-limit` | Respect length bounds | No | Yes |
| `custom` | Pass custom function | Depends on implementation | Yes |

---

## 7. Topic Detection

### Overview

Topic detection identifies the subject matter of a text based on keyword frequency. It is used to activate conditional rules: rules that only apply when a specific topic is detected. For example, a medical disclaimer rule should only fire when the text discusses medical topics. Topic detection is not semantic understanding -- it counts keyword occurrences and compares against a threshold. This is fast, deterministic, and sufficient for the use cases `content-policy` targets.

### Detection Algorithm

1. Normalize the text: lowercase, collapse whitespace.
2. For each defined topic (built-in and custom):
   a. Count how many of the topic's keywords appear in the normalized text. Each keyword is matched with word boundaries to avoid partial matches ("the" matching "therapy").
   b. If the count meets or exceeds the topic's threshold, the topic is considered detected.
3. Return the set of detected topics with their keyword match counts and confidence (match count / total keywords in the topic dictionary).

### Built-in Topic Dictionaries

`content-policy` ships with five built-in topic dictionaries. These can be used directly in policy rules without defining them in the policy file. Users can override built-in topics by defining a topic with the same name in their policy file.

#### `medical`

Keywords: "health", "medical", "doctor", "physician", "symptom", "diagnosis", "treatment", "medicine", "medication", "prescription", "surgery", "hospital", "patient", "disease", "illness", "therapy", "clinical", "nurse", "pharmacy", "vaccine", "dosage", "side effect", "condition", "chronic", "acute"

Default threshold: 2

#### `financial`

Keywords: "invest", "stock", "bond", "portfolio", "dividend", "market", "trading", "fund", "retirement", "401k", "IRA", "interest rate", "mortgage", "loan", "credit", "debt", "savings", "financial advisor", "tax", "capital gains", "securities", "asset", "liability", "equity", "cryptocurrency"

Default threshold: 2

#### `legal`

Keywords: "legal", "attorney", "lawyer", "court", "lawsuit", "litigation", "contract", "liability", "negligence", "statute", "regulation", "compliance", "jurisdiction", "defendant", "plaintiff", "verdict", "settlement", "damages", "arbitration", "mediation", "tort", "deposition", "subpoena"

Default threshold: 2

#### `political`

Keywords: "election", "democrat", "republican", "congress", "senate", "president", "legislation", "policy", "liberal", "conservative", "campaign", "ballot", "vote", "party", "government", "administration", "bipartisan", "caucus", "amendment", "constitution", "lobby", "referendum"

Default threshold: 3

#### `religious`

Keywords: "religion", "church", "mosque", "temple", "prayer", "worship", "faith", "god", "spiritual", "bible", "quran", "torah", "christian", "muslim", "jewish", "hindu", "buddhist", "salvation", "sermon", "scripture", "denomination", "clergy", "baptism"

Default threshold: 3

### Custom Topic Definitions

Users define custom topics in the `topics` section of their policy file:

```yaml
topics:
  pricing:
    keywords:
      - "price"
      - "cost"
      - "subscription"
      - "plan"
      - "tier"
      - "enterprise"
      - "discount"
      - "free trial"
    threshold: 2

  internal-operations:
    keywords:
      - "roadmap"
      - "sprint"
      - "backlog"
      - "deployment"
      - "staging"
      - "production"
      - "incident"
      - "postmortem"
    threshold: 2
```

### Topic Detection in Policy Results

Every `PolicyResult` includes a `topicsDetected` field listing which topics were detected, their keyword match counts, and their confidence scores. This is always populated regardless of whether any rules use topic conditions, providing useful diagnostic information about the content being evaluated.

---

## 8. Policy Evaluation Pipeline

### Step-by-Step Evaluation

When `enforcer.check(text, context?)` or `enforcer.enforce(text, context?)` is called, the following pipeline executes:

**Step 1: Validate inputs.** Verify the text is a non-null string. If the text is empty, return early with `pass: true`, zero violations, and no topics detected. Verify the context object (if provided) has the expected shape.

**Step 2: Determine direction.** Based on whether the caller is checking input or output (indicated via the `context` parameter or the method name), filter the rule set to only rules whose `direction` matches the current direction.

**Step 3: Detect topics.** Run topic detection on the text against all defined topics (built-in and custom). Store the detected topics set for use in condition evaluation.

**Step 4: Evaluate each applicable rule.** For each rule in the filtered set:
   a. If the rule has a `condition`, evaluate the condition against the text and detected topics. If the condition is not met, skip the rule.
   b. If the rule is not enabled (`enabled: false`), skip it.
   c. Execute the rule's type-specific evaluation logic against the text.
   d. Collect any violations produced.

**Step 5: Determine compliance.** Compute `pass`:
   - `pass = true` if no `error`-severity violations exist.
   - If `failOnWarnings` is `true`, `pass = false` if any `warning`-severity violations exist.
   - `info`-severity violations never affect `pass`.

**Step 6: Compute compliance score.** The score is a 0-1 value representing the degree of compliance:
   - 1.0: No violations of any severity.
   - 0.0: Multiple error-severity violations.
   - Formula: `score = 1.0 - (errorWeight * errorCount + warningWeight * warningCount + infoWeight * infoCount) / totalRuleCount`, clamped to [0, 1]. Error weight: 1.0. Warning weight: 0.3. Info weight: 0.05.

**Step 7: Apply enforcement.** Based on the enforcement mode:
   - `audit`: Return the result with all violations. Do not modify the text.
   - `report`: Same as `audit`.
   - `enforce`: For rules that support remediation (`replace`, `redact`, `require-disclaimer`), apply the remediations to the text. For `error`-severity violations from rules that do NOT support remediation, either throw a `PolicyViolationError` (default) or return `pass: false` with the unmodified text (configurable via `throwOnViolation` option).

**Step 8: Return result.** Return a `PolicyResult` (from `check()`) or `EnforcedOutput` (from `enforce()`) containing the compliance status, violations, topics detected, score, and (for `enforce()`) the modified text.

### Evaluation Order

Rules are evaluated in the order they appear in the policy file. This order matters for two reasons:

1. **Remediation stacking**: In `enforce` mode, text modifications from earlier rules affect the text that later rules evaluate. A `redact` rule that replaces "Google" with "[COMPETITOR]" means a subsequent `deny-keyword` rule for "Google" will not find a match (because the text has already been modified).
2. **Predictability**: Deterministic rule ordering makes policy behavior predictable and debuggable. The policy author controls the order.

---

## 9. API Surface

### Installation

```bash
npm install content-policy
```

### No Runtime Dependencies

`content-policy` has zero runtime dependencies. All text matching, topic detection, YAML parsing, and policy evaluation use built-in JavaScript and Node.js capabilities. YAML parsing uses a minimal inline parser that handles the subset of YAML used in policy files (scalars, sequences, mappings, comments, multi-line strings). Users who need full YAML spec support can parse the YAML externally and pass the resulting object to `loadPolicy()`.

### Main Export: `loadPolicy`

Parses a policy definition from a YAML string, JSON string, file path, or JavaScript object. Returns a validated `Policy` object.

```typescript
import { loadPolicy } from 'content-policy';

// From a file
const policy = loadPolicy('./policies/content-policy.yaml');

// From a YAML string
const policy2 = loadPolicy(`
name: "simple-policy"
rules:
  - id: "no-competitors"
    type: "deny-keyword"
    severity: "error"
    keywords: ["Google", "Microsoft"]
`);

// From a JavaScript object
const policy3 = loadPolicy({
  name: 'inline-policy',
  rules: [
    {
      id: 'no-competitors',
      type: 'deny-keyword',
      severity: 'error',
      keywords: ['Google', 'Microsoft'],
    },
  ],
});
```

**Validation**: `loadPolicy` validates the policy structure and throws a `PolicyValidationError` if the policy is malformed:
- Missing required fields (`name`, `rules`).
- Duplicate rule IDs.
- Unknown rule types.
- Invalid regex patterns in `deny-regex` rules.
- Missing required rule-type parameters (e.g., `deny-keyword` without `keywords`).
- Unknown topics referenced in conditions that are not defined in `topics` and are not built-in.

### Factory: `createEnforcer`

Creates a `PolicyEnforcer` instance preconfigured with a policy and options. Reusable across multiple `check()` and `enforce()` calls.

```typescript
import { loadPolicy, createEnforcer } from 'content-policy';

const policy = loadPolicy('./policies/content-policy.yaml');

const enforcer = createEnforcer(policy, {
  enforcement: 'enforce',       // Override the policy's default enforcement mode
  throwOnViolation: false,      // Return pass: false instead of throwing on unremediable errors
  failOnWarnings: false,        // Whether warnings cause pass: false
  customRules: [],              // Additional rules defined programmatically
  topicOverrides: {},           // Override topic keyword lists or thresholds
});
```

### Checking: `enforcer.check`

Evaluates text against all applicable rules and returns a `PolicyResult`. Does not modify the text. Works in all enforcement modes (the enforcement mode affects only whether `enforce()` modifies text, not `check()`).

```typescript
const result = enforcer.check('Our product is better than Google Cloud.', {
  direction: 'output',
});

console.log(result.pass);           // false
console.log(result.violations);     // [{ ruleId: 'no-competitor-names', severity: 'error', ... }]
console.log(result.topicsDetected); // []
console.log(result.score);          // 0.85
```

### Checking with Input Context: `enforcer.checkOutput`

Convenience method that checks LLM output with optional input context (needed for `language-match` rules).

```typescript
const result = enforcer.checkOutput(llmResponse, {
  input: userMessage,     // Original user input (for language-match rules)
});
```

### Checking Input: `enforcer.checkInput`

Convenience method that checks user input. Only evaluates rules with `direction: "input"` or `direction: "both"`.

```typescript
const result = enforcer.checkInput(userMessage);
```

### Enforcing: `enforcer.enforce`

Evaluates text and applies automatic remediations. Returns an `EnforcedOutput` containing the (possibly modified) text and the list of violations.

```typescript
const output = enforcer.enforce(
  'I recommend checking out Google Cloud for your infrastructure needs.',
  { direction: 'output' },
);

console.log(output.text);
// "I recommend checking out [COMPETITOR] for your infrastructure needs."
// (If a redact rule for competitors is defined)

console.log(output.violations);
// [{ ruleId: 'redact-competitors', severity: 'warning', remediated: true, ... }]

console.log(output.remediations);
// [{ ruleId: 'redact-competitors', original: 'Google Cloud', replacement: '[COMPETITOR]', position: { start: 32, end: 44 } }]
```

### Standalone Functions

For simple use cases that do not require a reusable enforcer:

```typescript
import { checkPolicy, enforcePolicy, loadPolicy } from 'content-policy';

const policy = loadPolicy('./policy.yaml');

// Check
const result = checkPolicy(policy, 'Some text to check');

// Enforce
const output = enforcePolicy(policy, 'Some text to enforce');
```

### Type Definitions

```typescript
// ── Policy Definition ────────────────────────────────────────

/** A loaded and validated policy. */
interface Policy {
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

/** Enforcement mode. */
type EnforcementMode = 'audit' | 'enforce' | 'report';

/** A topic definition. */
interface TopicDefinition {
  /** Topic keywords. */
  keywords: string[];

  /** Minimum keyword matches to detect topic. */
  threshold: number;
}

/** A single policy rule. */
interface Rule {
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

type RuleType =
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

type Severity = 'error' | 'warning' | 'info';

type Direction = 'input' | 'output' | 'both';

interface RuleCondition {
  /** Activate when this topic is detected. */
  topic?: string;

  /** Activate when at least one of these keywords is present. */
  keywords?: string[];

  /** Activate when text is at least this many characters. */
  minLength?: number;
}

// ── Policy Result ────────────────────────────────────────────

/** Result of checking text against a policy. */
interface PolicyResult {
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

/** A single policy violation. */
interface Violation {
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

/** Location of a violation in the text. */
interface ViolationLocation {
  /** Character offset of the start (0-based). */
  start: number;

  /** Character offset of the end (0-based, exclusive). */
  end: number;
}

/** A detected topic. */
interface DetectedTopic {
  /** Topic name. */
  name: string;

  /** Number of keyword matches. */
  matchCount: number;

  /** Confidence score (matchCount / total keywords in topic dictionary). */
  confidence: number;

  /** Which keywords matched. */
  matchedKeywords: string[];
}

// ── Enforced Output ──────────────────────────────────────────

/** Result of enforcing a policy on text. */
interface EnforcedOutput {
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

/** A single remediation applied to the text. */
interface Remediation {
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

// ── Enforcer Configuration ───────────────────────────────────

/** Options for createEnforcer(). */
interface EnforcerOptions {
  /**
   * Override the policy's default enforcement mode.
   */
  enforcement?: EnforcementMode;

  /**
   * Whether to throw PolicyViolationError on unremediable error-severity
   * violations in enforce mode. Default: true.
   */
  throwOnViolation?: boolean;

  /**
   * Whether warnings cause pass: false. Overrides the policy's setting.
   */
  failOnWarnings?: boolean;

  /**
   * Additional rules defined programmatically. Appended to the policy's rules.
   */
  customRules?: CustomRule[];

  /**
   * Override topic definitions (keywords, thresholds).
   */
  topicOverrides?: Record<string, Partial<TopicDefinition>>;

  /**
   * Rule IDs to disable. These rules are skipped during evaluation.
   */
  disabledRules?: string[];
}

/** A custom rule defined programmatically. */
interface CustomRule {
  id: string;
  type: 'custom';
  severity: Severity;
  description?: string;
  direction?: Direction;
  condition?: RuleCondition;
  validate: (text: string, context: CustomRuleContext) => CustomViolation[];
}

interface CustomRuleContext {
  /** The direction being checked. */
  direction: Direction;

  /** Topics detected in the text. */
  topicsDetected: DetectedTopic[];

  /** The original input text (if provided via checkOutput). */
  input?: string;
}

interface CustomViolation {
  message: string;
  matched?: string;
  location?: ViolationLocation;
  suggestion?: string;
}

// ── Enforcer Instance ────────────────────────────────────────

/** A preconfigured policy enforcer. */
interface PolicyEnforcer {
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

interface CheckContext {
  /** The direction being checked. */
  direction?: Direction;
}

interface OutputContext {
  /** The original user input (for language-match rules). */
  input?: string;
}

// ── Errors ───────────────────────────────────────────────────

/**
 * Thrown by loadPolicy() when the policy file is malformed.
 */
declare class PolicyValidationError extends Error {
  /** Validation errors found. */
  errors: string[];
}

/**
 * Thrown by enforce() when throwOnViolation is true and an
 * unremediable error-severity violation is found.
 */
declare class PolicyViolationError extends Error {
  /** The violations that triggered the error. */
  violations: Violation[];
}
```

---

## 10. Configuration

### Default Values

When no options are provided, the following defaults apply:

| Option | Default | Description |
|--------|---------|-------------|
| `enforcement` | From policy file (or `"enforce"`) | Enforcement mode. |
| `throwOnViolation` | `true` | Throw on unremediable error violations in enforce mode. |
| `failOnWarnings` | From policy file (or `false`) | Whether warnings cause `pass: false`. |
| `customRules` | `[]` | No custom rules. |
| `topicOverrides` | `{}` | No topic overrides. |
| `disabledRules` | `[]` | No rules disabled. |

### Rule Defaults

When a rule definition omits optional fields:

| Field | Default |
|-------|---------|
| `severity` | `"error"` |
| `direction` | `"output"` |
| `enabled` | `true` |
| `caseSensitive` | `false` (for rules that support it) |
| `wholeWord` | `true` (for rules that support it) |

### Environment Variables

| Environment Variable | Description |
|---------------------|-------------|
| `CONTENT_POLICY_ENFORCEMENT` | Override enforcement mode: `audit`, `enforce`, `report`. |
| `CONTENT_POLICY_FILE` | Default policy file path (used by CLI when no file argument is provided). |

---

## 11. CLI

### Installation and Invocation

```bash
# Global install
npm install -g content-policy
content-policy check ./policy.yaml "Text to check"

# npx (no install)
echo "Some LLM output to check" | npx content-policy check ./policy.yaml

# Package script
# package.json: { "scripts": { "policy:check": "content-policy check ./policy.yaml" } }
echo "Some output" | npm run policy:check
```

### CLI Binary Name

`content-policy`

### Commands and Flags

```
content-policy <command> [options]

Commands:
  check <policy-file> [text]   Check text against a policy.
  enforce <policy-file> [text] Enforce a policy on text (apply remediations).
  validate <policy-file>       Validate a policy file without checking text.
  topics <policy-file> [text]  Detect topics in text using the policy's topic definitions.

Input (for check/enforce):
  [text]                       Inline text to check.
  --file <path>                Read text from a file.
  (stdin)                      Read from stdin when no text argument or --file.
  --input <text>               Provide user input context (for language-match rules).

Options:
  --enforcement <mode>         Override enforcement mode: audit, enforce, report.
  --direction <dir>            Check direction: input, output, both. Default: output.
  --format <format>            Output format: human, json. Default: human.
  --quiet                      Suppress all output except the exit code.
  --disable-rule <id>          Disable a specific rule (repeatable).

Meta:
  --version                    Print version and exit.
  --help                       Print help and exit.
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Compliant. No error-severity violations found. |
| `1` | Non-compliant. One or more error-severity violations found. |
| `2` | Configuration error. Invalid policy file, missing arguments, or unreadable input. |

### Human-Readable Output Example

```
$ content-policy check ./policy.yaml "Our product is faster than Google Cloud and Microsoft Azure."

  content-policy v0.1.0

  Policy: acme-corp-content-policy v1.2.0
  Mode: enforce
  Direction: output

  ERROR  no-competitor-names    "Google Cloud"        [36-48]
         Response mentions a competitor: Google Cloud

  ERROR  no-competitor-names    "Microsoft Azure"     [53-68]
         Response mentions a competitor: Microsoft Azure

  Topics detected: none

  ─────────────────────────────────────────────────────────
  2 errors, 0 warnings (2 violations, 0 remediated)
  Evaluated 8 rules in 0.4ms
  Result: FAILED
```

### JSON Output Example

```bash
$ content-policy check ./policy.yaml --format json "Our product is better than Google."
```

Outputs the `PolicyResult` as a JSON string to stdout.

### Validate Command Example

```
$ content-policy validate ./policy.yaml

  content-policy v0.1.0

  Policy file: ./policy.yaml
  Policy name: acme-corp-content-policy
  Version: 1.2.0

  Rules: 8
  Topics: 2 custom + 5 built-in
  Validation: PASSED

  Rule summary:
    no-competitor-names        deny-keyword        error
    medical-disclaimer         require-disclaimer   error
    no-financial-advice        deny-regex          error
    support-email-routing      require-keyword     warning
    redact-competitors         redact              warning
    no-pricing-unauthenticated deny-regex          error
    response-length            length-limit        warning
    match-input-language       language-match      error
```

---

## 12. Integration with Monorepo Packages

### With `jailbreak-heuristic`

`jailbreak-heuristic` guards the input; `content-policy` guards the output. Together they form a complete input/output safety pipeline.

```typescript
import { isJailbreak } from 'jailbreak-heuristic';
import { createEnforcer, loadPolicy } from 'content-policy';

const policy = loadPolicy('./policy.yaml');
const enforcer = createEnforcer(policy);

async function handleRequest(userMessage: string): Promise<string> {
  // Input guard: block jailbreak attempts
  if (isJailbreak(userMessage)) {
    throw new Error('Input blocked by safety filter.');
  }

  // Optional: check input against content policy
  const inputCheck = enforcer.checkInput(userMessage);
  if (!inputCheck.pass) {
    throw new Error('Input violates content policy.');
  }

  const llmResponse = await callLLM(userMessage);

  // Output guard: enforce content policy
  const output = enforcer.enforce(llmResponse, { direction: 'output' });
  return output.text;
}
```

### With `llm-sanitize`

`llm-sanitize` handles PII and structural sanitization; `content-policy` handles business rules. They address orthogonal concerns.

```typescript
import { sanitize } from 'llm-sanitize';
import { createEnforcer, loadPolicy } from 'content-policy';

const enforcer = createEnforcer(loadPolicy('./policy.yaml'));

async function processResponse(llmOutput: string): Promise<string> {
  // Step 1: Sanitize (PII removal, token stripping)
  const sanitized = sanitize(llmOutput);

  // Step 2: Enforce business content policy
  const enforced = enforcer.enforce(sanitized, { direction: 'output' });

  return enforced.text;
}
```

### With `llm-audit-log`

Record policy enforcement decisions for compliance audit.

```typescript
import { createEnforcer, loadPolicy } from 'content-policy';
import { createAuditLog } from 'llm-audit-log';

const enforcer = createEnforcer(loadPolicy('./policy.yaml'));
const auditLog = createAuditLog({ storage: { type: 'jsonl', path: './audit.jsonl' } });

async function enforcedResponse(userId: string, llmOutput: string): Promise<string> {
  const result = enforcer.enforce(llmOutput, { direction: 'output' });

  await auditLog.record({
    actor: `user:${userId}`,
    model: 'content-policy',
    provider: 'custom',
    input: llmOutput,
    output: {
      pass: result.pass,
      score: result.score,
      violationCount: result.violations.length,
      remediationCount: result.remediations.length,
      topicsDetected: result.topicsDetected.map(t => t.name),
    },
    tokens: { input: 0, output: 0, total: 0 },
    latencyMs: result.durationMs,
    cost: null,
    metadata: {
      policyName: enforcer.policy.name,
      policyVersion: enforcer.policy.version,
      violations: result.violations.map(v => ({
        ruleId: v.ruleId,
        severity: v.severity,
        remediated: v.remediated,
      })),
    },
  });

  return result.text;
}
```

### With `prompt-lint`

`prompt-lint` validates the quality of the prompt itself; `content-policy` validates the content of LLM output. They operate at different stages: `prompt-lint` at authoring time (CI/CD), `content-policy` at runtime (request processing).

```typescript
// In CI: lint the system prompt for quality
import { lint } from 'prompt-lint';
const report = lint({ source: { file: './system-prompt.md' }, preset: 'recommended' });
if (!report.passed) process.exit(1);

// At runtime: enforce content policy on LLM output
import { createEnforcer, loadPolicy } from 'content-policy';
const enforcer = createEnforcer(loadPolicy('./policy.yaml'));
const result = enforcer.enforce(llmOutput, { direction: 'output' });
```

### As Express/Fastify Middleware

`content-policy` can be used as middleware in an HTTP server to enforce content policies on all LLM responses.

```typescript
import { createEnforcer, loadPolicy } from 'content-policy';
import { Request, Response, NextFunction } from 'express';

const enforcer = createEnforcer(loadPolicy('./policy.yaml'), {
  throwOnViolation: false,
});

function contentPolicyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = (body: any) => {
    if (body?.response && typeof body.response === 'string') {
      const result = enforcer.enforce(body.response, { direction: 'output' });
      body.response = result.text;

      if (!result.pass) {
        return originalJson({
          error: 'Response blocked by content policy',
          violations: result.violations.map(v => ({
            rule: v.ruleId,
            message: v.message,
          })),
        });
      }
    }
    return originalJson(body);
  };

  next();
}

app.use('/api/chat', contentPolicyMiddleware);
```

---

## 13. Testing Strategy

### Unit Tests

Unit tests verify each component in isolation.

- **Policy loading tests**: Verify that valid YAML, JSON, and JavaScript object policies are parsed correctly. Verify that invalid policies produce `PolicyValidationError` with meaningful error messages. Test edge cases: empty rules array, duplicate rule IDs, invalid regex patterns, unknown rule types, unknown topic references.

- **Rule evaluation tests**: For each rule type, test with at least:
  - A text that passes the rule (no violation).
  - A text that violates the rule (one or more violations with correct ruleId, severity, message, matched text, and location).
  - Edge cases specific to the rule type (e.g., `deny-keyword` with `wholeWord: true` should not match partial words; `require-disclaimer` with `fuzzyMatch: true` should match despite whitespace differences).

- **Topic detection tests**: Verify built-in topics detect correctly with known keyword sets. Verify custom topics. Verify threshold behavior (below threshold = not detected, at threshold = detected). Verify keyword matching uses word boundaries.

- **Condition evaluation tests**: Verify topic-based conditions activate rules only when the topic is detected. Verify keyword-based conditions. Verify minLength conditions.

- **Enforcement tests**: Verify `redact` rules replace text correctly. Verify `replace` rules substitute correctly. Verify `require-disclaimer` inserts disclaimer at the correct position. Verify remediation stacking (multiple remediations applied to the same text). Verify `throwOnViolation` behavior.

- **Scoring tests**: Verify the compliance score formula produces expected values for known violation combinations. Verify clamping to [0, 1]. Verify `failOnWarnings` behavior.

- **Language detection tests**: Verify detection of major languages (English, Spanish, French, German, Chinese, Japanese, Korean, Arabic). Verify `language-match` rule produces violations when languages differ.

### Integration Tests

- **Full pipeline test**: Load a realistic policy, evaluate a realistic LLM output, verify the full `PolicyResult` structure.
- **Enforce round-trip test**: Enforce a policy on text with multiple violations, then re-check the enforced text. Verify that remediated violations no longer appear.
- **Multi-policy test**: Load and evaluate against multiple policies. Verify that violations from all policies are collected.
- **CLI end-to-end test**: Run the CLI binary against test fixtures and verify exit codes, stdout output, and stderr output.

### Performance Tests

- **Evaluation speed**: Evaluate a 10-rule policy against a 4KB text. Target: < 1ms.
- **Large policy**: Evaluate a 100-rule policy against a 4KB text. Target: < 5ms.
- **Large text**: Evaluate a 10-rule policy against a 100KB text. Target: < 10ms.
- **Topic detection**: Detect topics in a 4KB text with 10 topic definitions (100 keywords total). Target: < 1ms.

### Test Framework

Tests use Vitest, matching the project's existing configuration.

---

## 14. Performance

### Sub-1ms Requirement for Typical Use

The core performance target is that evaluation of a typical policy (10-20 rules) against a typical LLM response (1-4KB) completes in under 1 millisecond. This enables `content-policy` to be used inline in request processing pipelines without adding meaningful latency. For context: a typical LLM API call takes 500-3000ms. Adding 0.5ms of policy evaluation is negligible.

### Regex Compilation

All regex patterns (`deny-regex` rules, keyword word-boundary patterns) are compiled once during `loadPolicy()` or `createEnforcer()`. Pattern objects are stored on the rule and reused across evaluation calls. No regex is compiled during `check()` or `enforce()`.

All patterns are designed to avoid catastrophic backtracking (ReDoS):
- User-provided patterns in `deny-regex` rules are executed with a timeout guard. If a pattern takes longer than 10ms to evaluate, it is terminated and a warning is logged.
- Built-in patterns (keyword matching, topic detection) use simple alternation and word boundaries, with no nested quantifiers.

### Topic Detection Optimization

Topic detection keyword matching compiles all keywords for a topic into a single alternation regex (`/\b(keyword1|keyword2|keyword3)\b/gi`) at load time. This matches all keywords in a single pass rather than iterating through each keyword individually. For a topic with 25 keywords against a 4KB text, detection completes in under 0.1ms.

### Memory

Policy enforcement is stateless. The `PolicyEnforcer` instance holds the compiled policy (regex objects, topic dictionaries) but retains no per-call state. Each `check()` or `enforce()` call allocates only the result objects (`PolicyResult`, `Violation` array, `DetectedTopic` array). A typical result is under 2KB.

### Benchmarks

Expected performance on a modern machine (Apple M1 or equivalent x86):

| Scenario | Rules | Text Size | Mean Latency |
|----------|-------|-----------|-------------|
| Simple policy | 5 rules | 1 KB | 0.1ms |
| Typical policy | 15 rules | 2 KB | 0.3ms |
| Large policy | 50 rules | 4 KB | 1.0ms |
| Enterprise policy | 100 rules | 4 KB | 2.5ms |
| Large text | 15 rules | 100 KB | 5.0ms |

---

## 15. Dependencies

### Runtime Dependencies

None. `content-policy` has zero runtime dependencies. All functionality is implemented using built-in JavaScript and Node.js capabilities:

| Capability | Implementation |
|-----------|---------------|
| Pattern matching | Built-in `RegExp`. |
| String analysis | Built-in `String.prototype` methods. |
| YAML parsing | Minimal inline parser for policy-subset YAML (scalars, sequences, mappings, multi-line strings, comments). |
| JSON parsing | Built-in `JSON.parse()`. |
| File reading | `node:fs.readFileSync()`. |
| CLI argument parsing | `node:util.parseArgs()` (Node.js 18+). |
| Timing | `performance.now()` from built-in `perf_hooks`. |

The zero-dependency constraint exists for the same reasons as other packages in this monorepo:
1. **Security**: Content policy enforcement operates in a security-sensitive position. Zero dependencies means zero supply chain risk.
2. **Size**: The package should be small (~25KB minified).
3. **Compatibility**: Works in any JavaScript environment supporting ES2022 (Node.js 18+, modern browsers, edge runtimes).

### Dev Dependencies

| Dependency | Purpose |
|-----------|---------|
| `typescript` | TypeScript compiler. |
| `vitest` | Test runner. |
| `eslint` | Linter. |

---

## 16. File Structure

```
content-policy/
├── package.json
├── tsconfig.json
├── SPEC.md                        # This file
├── README.md
├── src/
│   ├── index.ts                   # Public API: loadPolicy, createEnforcer, checkPolicy, enforcePolicy
│   ├── types.ts                   # All TypeScript type definitions
│   ├── policy/
│   │   ├── load.ts                # loadPolicy(): parse YAML/JSON/object, validate, return Policy
│   │   ├── validate.ts            # Policy validation: schema checking, duplicate detection, regex validation
│   │   └── yaml-parser.ts         # Minimal YAML parser for policy files
│   ├── enforcer/
│   │   ├── index.ts               # createEnforcer() factory, PolicyEnforcer class
│   │   ├── evaluate.ts            # Core evaluation pipeline: topic detection, rule evaluation, scoring
│   │   ├── remediate.ts           # Remediation engine: apply replace, redact, disclaimer insertions
│   │   └── condition.ts           # Condition evaluation: topic conditions, keyword conditions
│   ├── rules/
│   │   ├── index.ts               # Rule type registry
│   │   ├── deny-keyword.ts        # deny-keyword rule evaluator
│   │   ├── deny-regex.ts          # deny-regex rule evaluator
│   │   ├── require-keyword.ts     # require-keyword rule evaluator
│   │   ├── require-disclaimer.ts  # require-disclaimer rule evaluator
│   │   ├── deny-topic.ts          # deny-topic rule evaluator
│   │   ├── replace.ts             # replace rule evaluator
│   │   ├── redact.ts              # redact rule evaluator
│   │   ├── language-match.ts      # language-match rule evaluator
│   │   ├── length-limit.ts        # length-limit rule evaluator
│   │   └── custom.ts              # custom rule evaluator (delegates to user function)
│   ├── topics/
│   │   ├── index.ts               # Topic detection engine
│   │   ├── detect.ts              # Keyword-based topic detection algorithm
│   │   └── built-in.ts            # Built-in topic dictionaries (medical, financial, legal, political, religious)
│   ├── language/
│   │   └── detect.ts              # Lightweight language detection (script analysis + common-word heuristics)
│   ├── cli.ts                     # CLI entry point: argument parsing, command dispatch, output formatting
│   └── errors.ts                  # PolicyValidationError, PolicyViolationError
├── src/__tests__/
│   ├── load-policy.test.ts        # Policy loading and validation tests
│   ├── enforcer.test.ts           # Enforcer creation and configuration tests
│   ├── evaluate.test.ts           # Full evaluation pipeline tests
│   ├── remediate.test.ts          # Remediation engine tests
│   ├── rules/
│   │   ├── deny-keyword.test.ts
│   │   ├── deny-regex.test.ts
│   │   ├── require-keyword.test.ts
│   │   ├── require-disclaimer.test.ts
│   │   ├── deny-topic.test.ts
│   │   ├── replace.test.ts
│   │   ├── redact.test.ts
│   │   ├── language-match.test.ts
│   │   ├── length-limit.test.ts
│   │   └── custom.test.ts
│   ├── topics/
│   │   ├── detect.test.ts
│   │   └── built-in.test.ts
│   ├── language/
│   │   └── detect.test.ts
│   ├── cli.test.ts                # CLI end-to-end tests
│   ├── integration.test.ts        # Full pipeline integration tests
│   ├── performance.test.ts        # Performance benchmark tests
│   └── fixtures/
│       ├── policies/
│       │   ├── valid-policy.yaml
│       │   ├── invalid-policy.yaml
│       │   ├── brand-protection.yaml
│       │   ├── healthcare-compliance.yaml
│       │   └── financial-services.yaml
│       └── texts/
│           ├── compliant-output.txt
│           ├── non-compliant-output.txt
│           └── medical-discussion.txt
└── dist/                           # Compiled output (gitignored)
```

---

## 17. Implementation Roadmap

### Phase 1: Core Engine (v0.1.0)

Implement the policy loading, core rule types, and evaluation pipeline.

**Deliverables:**
- TypeScript type definitions (`types.ts`).
- Policy loader with YAML and JSON support, validation (`policy/load.ts`, `policy/validate.ts`, `policy/yaml-parser.ts`).
- Rule evaluators for the four most common types: `deny-keyword`, `deny-regex`, `require-keyword`, `require-disclaimer` (`rules/`).
- Topic detection with built-in dictionaries (`topics/`).
- Core evaluation pipeline: condition checking, rule evaluation, scoring (`enforcer/evaluate.ts`, `enforcer/condition.ts`).
- `PolicyEnforcer` class with `check()` method (`enforcer/index.ts`).
- Public API: `loadPolicy()`, `createEnforcer()`, `checkPolicy()` (`index.ts`).
- Unit tests for all implemented components.

### Phase 2: Enforcement and Extended Rules (v0.2.0)

Add enforcement (remediation), remaining rule types, and the CLI.

**Deliverables:**
- Remediation engine for `redact`, `replace`, `require-disclaimer` (`enforcer/remediate.ts`).
- `enforce()` method on `PolicyEnforcer`.
- Remaining rule types: `deny-topic`, `replace`, `redact`, `language-match`, `length-limit`, `custom`.
- Language detection (`language/detect.ts`).
- CLI with `check`, `enforce`, `validate`, and `topics` commands (`cli.ts`).
- Integration tests and CLI end-to-end tests.

### Phase 3: Polish and Performance (v0.3.0)

Optimize performance, add advanced features, and prepare for production use.

**Deliverables:**
- Regex timeout guards for user-provided patterns.
- Performance benchmarks and optimization.
- `checkOutput()` and `checkInput()` convenience methods.
- Environment variable configuration.
- `enforcePolicy()` standalone function.
- Error classes (`PolicyValidationError`, `PolicyViolationError`).
- Comprehensive edge case testing.
- README with usage examples, rule catalog, and policy authoring guide.

---

## 18. Example Use Cases

### 18.1 Brand Protection Policy

A consumer-facing AI assistant that must never mention competitors and must always use official product names.

```yaml
name: "brand-protection"
version: "1.0.0"
description: "Protect ACME brand in AI assistant responses"
enforcement: "enforce"

rules:
  - id: "no-competitor-mention"
    type: "deny-keyword"
    severity: "error"
    keywords:
      - "Google"
      - "Microsoft"
      - "Amazon"
      - "Meta"
      - "Apple"
      - "Salesforce"
    caseSensitive: false
    wholeWord: true
    message: "Response mentions competitor: {{matched}}"

  - id: "redact-competitor-names"
    type: "redact"
    severity: "warning"
    patterns:
      - "Google Cloud"
      - "Azure"
      - "AWS"
      - "Meta AI"
    replacement: "[alternative provider]"

  - id: "use-official-product-name"
    type: "replace"
    severity: "info"
    patterns:
      - match: "our app"
        replacement: "ACME Assistant"
      - match: "the product"
        replacement: "ACME Assistant"
      - match: "this tool"
        replacement: "ACME Assistant"
```

### 18.2 Healthcare Compliance Policy

An AI health information assistant that must include disclaimers and avoid providing diagnoses.

```yaml
name: "healthcare-compliance"
version: "2.1.0"
description: "Healthcare content compliance for AI health assistant"
enforcement: "enforce"

topics:
  symptoms:
    keywords: ["pain", "ache", "fever", "nausea", "fatigue", "dizziness", "rash", "swelling", "cough", "headache"]
    threshold: 2
  medications:
    keywords: ["medication", "drug", "dosage", "prescription", "pill", "tablet", "side effect", "interaction"]
    threshold: 1

rules:
  - id: "medical-disclaimer"
    type: "require-disclaimer"
    severity: "error"
    condition:
      topic: "medical"
    disclaimer: "Important: This information is for educational purposes only and should not be considered medical advice. Always consult with a qualified healthcare professional for personal medical decisions."
    position: "end"
    fuzzyMatch: true

  - id: "no-diagnosis"
    type: "deny-regex"
    severity: "error"
    pattern: "\\b(you (have|likely have|probably have|might have|could have)\\s+[A-Z][a-z]+|diagnosis\\s*:\\s*\\w+|I diagnose)"
    flags: "i"
    message: "Response appears to provide a diagnosis: {{matched}}"

  - id: "no-dosage-advice"
    type: "deny-regex"
    severity: "error"
    condition:
      topic: "medications"
    pattern: "\\b(take|recommend)\\s+\\d+\\s*(mg|ml|tablets?|pills?|capsules?)\\b"
    flags: "i"
    message: "Response provides specific dosage advice: {{matched}}"

  - id: "symptoms-disclaimer"
    type: "require-disclaimer"
    severity: "warning"
    condition:
      topic: "symptoms"
    disclaimer: "If you are experiencing these symptoms, please contact your healthcare provider."
    position: "end"
    fuzzyMatch: true
```

### 18.3 Financial Services Policy

An AI assistant for a financial services company that must avoid investment advice and comply with regulatory requirements.

```yaml
name: "financial-compliance"
version: "1.5.0"
description: "Financial content compliance for client-facing AI"
enforcement: "enforce"

rules:
  - id: "no-investment-advice"
    type: "deny-regex"
    severity: "error"
    pattern: "\\b(you should (buy|sell|invest|hold)|I recommend (buying|selling|investing|holding)|guaranteed return|risk-free investment)\\b"
    flags: "i"
    message: "Response contains investment advice: {{matched}}"

  - id: "financial-disclaimer"
    type: "require-disclaimer"
    severity: "error"
    condition:
      topic: "financial"
    disclaimer: "This information is for informational purposes only and does not constitute financial advice. Past performance is not indicative of future results. Consult a licensed financial advisor before making investment decisions."
    position: "end"
    fuzzyMatch: true

  - id: "no-specific-returns"
    type: "deny-regex"
    severity: "error"
    pattern: "\\b(return of|returns of|yield of|earning)\\s+\\d+(\\.\\d+)?\\s*%"
    flags: "i"
    message: "Response cites specific return percentages: {{matched}}"

  - id: "no-competitor-funds"
    type: "deny-keyword"
    severity: "warning"
    keywords:
      - "Vanguard"
      - "Fidelity"
      - "Schwab"
      - "BlackRock"
    message: "Response mentions a competitor fund manager: {{matched}}"
```

### 18.4 Customer Support Routing Policy

A customer support AI that must route specific topics to appropriate channels and never make unauthorized promises.

```yaml
name: "support-routing"
version: "1.0.0"
description: "Customer support content policy with routing rules"
enforcement: "enforce"

topics:
  billing:
    keywords: ["bill", "invoice", "charge", "refund", "payment", "subscription", "pricing", "upgrade", "downgrade", "cancel"]
    threshold: 1
  technical:
    keywords: ["error", "bug", "crash", "not working", "broken", "issue", "problem", "fix"]
    threshold: 2

rules:
  - id: "billing-routing"
    type: "require-keyword"
    severity: "warning"
    condition:
      topic: "billing"
    keywords:
      - "billing@acme.com"
      - "1-800-ACME-HELP"
    message: "Response about billing should direct user to billing@acme.com or 1-800-ACME-HELP"

  - id: "technical-routing"
    type: "require-keyword"
    severity: "warning"
    condition:
      topic: "technical"
    keywords:
      - "support.acme.com/tickets"
    message: "Response about technical issues should direct user to support.acme.com/tickets"

  - id: "no-unauthorized-promises"
    type: "deny-regex"
    severity: "error"
    pattern: "\\b(we (will|guarantee|promise)|I can (guarantee|ensure|promise)|100% (guaranteed|certain))\\b"
    flags: "i"
    message: "Response makes an unauthorized promise or guarantee: {{matched}}"

  - id: "no-refund-commitments"
    type: "deny-regex"
    severity: "error"
    pattern: "\\b(you will (receive|get) a (full )?refund|refund (has been|is being) processed|we('ll| will) refund)\\b"
    flags: "i"
    message: "Response makes an unauthorized refund commitment: {{matched}}"

  - id: "response-length"
    type: "length-limit"
    severity: "warning"
    maxLength: 1500
    message: "Support response is too long ({{actual}} chars, max 1500)"
```

### 18.5 Enterprise Content Governance

An organization-wide base policy that all AI products must enforce.

```yaml
name: "enterprise-base-policy"
version: "3.0.0"
description: "Organization-wide content governance for all AI products"
enforcement: "enforce"
failOnWarnings: false

topics:
  internal-operations:
    keywords: ["roadmap", "sprint", "OKR", "quarterly review", "headcount", "reorg", "layoff", "acquisition", "merger"]
    threshold: 1

rules:
  - id: "no-internal-codenames"
    type: "redact"
    severity: "error"
    patterns:
      - "Project Phoenix"
      - "Project Titan"
      - "Project Nebula"
      - "Project Atlas"
    replacement: "[INTERNAL PROJECT]"

  - id: "no-internal-operations"
    type: "deny-topic"
    severity: "error"
    topic: "internal-operations"
    message: "Response discusses internal company operations"

  - id: "no-employee-names"
    type: "deny-regex"
    severity: "error"
    pattern: "\\b(CEO|CTO|CFO|VP)\\s+[A-Z][a-z]+\\s+[A-Z][a-z]+"
    message: "Response mentions an executive by name: {{matched}}"

  - id: "source-citation"
    type: "require-keyword"
    severity: "info"
    condition:
      minLength: 500
    keywords:
      - "Source:"
      - "Reference:"
      - "According to"
      - "Based on"
    message: "Long response lacks source citations"

  - id: "no-unreleased-features"
    type: "deny-keyword"
    severity: "error"
    keywords:
      - "upcoming feature"
      - "coming soon"
      - "next release"
      - "planned feature"
      - "on our roadmap"
    message: "Response mentions unreleased features: {{matched}}"
```
