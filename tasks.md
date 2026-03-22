# content-policy — Task Breakdown

This file breaks down all work required to implement `content-policy` per SPEC.md into granular, actionable tasks grouped by phase.

---

## Phase 1: Project Setup and Scaffolding

- [x] **Install dev dependencies** — Add `typescript`, `vitest`, and `eslint` as devDependencies in `package.json`. Ensure `vitest` config works with the existing `tsconfig.json` settings (ES2022, commonjs, strict). | Status: done
- [ ] **Add CLI bin entry to package.json** — Add `"bin": { "content-policy": "dist/cli.js" }` to `package.json` so the CLI binary is registered on install. | Status: not_done
- [ ] **Create source directory structure** — Create all directories specified in the file structure: `src/policy/`, `src/enforcer/`, `src/rules/`, `src/topics/`, `src/language/`, `src/__tests__/`, `src/__tests__/rules/`, `src/__tests__/topics/`, `src/__tests__/language/`, `src/__tests__/fixtures/policies/`, `src/__tests__/fixtures/texts/`. | Status: not_done
- [ ] **Create .gitignore** — Add `node_modules/`, `dist/`, and `coverage/` to `.gitignore` if not already present. | Status: not_done
- [x] **Configure ESLint** — Set up ESLint for TypeScript with reasonable defaults matching the monorepo style. | Status: done

---

## Phase 2: Type Definitions

- [x] **Define EnforcementMode type** — Create `src/types.ts` with `type EnforcementMode = 'audit' | 'enforce' | 'report'`. | Status: done
- [x] **Define Severity type** — Add `type Severity = 'error' | 'warning' | 'info'` to `src/types.ts`. | Status: done
- [x] **Define Direction type** — Add `type Direction = 'input' | 'output' | 'both'` to `src/types.ts`. | Status: done
- [x] **Define RuleType type** — Add `type RuleType = 'deny-keyword' | 'deny-regex' | 'require-keyword' | 'require-disclaimer' | 'deny-topic' | 'replace' | 'redact' | 'language-match' | 'length-limit' | 'custom'` to `src/types.ts`. | Status: done
- [x] **Define RuleCondition interface** — Add `RuleCondition` interface with optional fields: `topic?: string`, `keywords?: string[]`, `minLength?: number`. | Status: done
- [x] **Define TopicDefinition interface** — Add `TopicDefinition` interface with `keywords: string[]` and `threshold: number`. | Status: done
- [x] **Define Rule interface** — Add `Rule` interface with all common fields: `id`, `type`, `description?`, `severity`, `direction`, `enforcement?`, `condition?`, `message?`, `enabled`, `params: Record<string, unknown>`. | Status: done
- [x] **Define Policy interface** — Add `Policy` interface with `name`, `version?`, `description?`, `enforcement`, `failOnWarnings`, `topics`, `rules`. | Status: done
- [x] **Define ViolationLocation interface** — Add `ViolationLocation` interface with `start: number` and `end: number`. | Status: done
- [x] **Define Violation interface** — Add `Violation` interface with `ruleId`, `severity`, `message`, `matched?`, `location?`, `suggestion?`, `remediated: boolean`. | Status: done
- [x] **Define DetectedTopic interface** — Add `DetectedTopic` interface with `name`, `matchCount`, `confidence`, `matchedKeywords`. | Status: done
- [x] **Define PolicyResult interface** — Add `PolicyResult` interface with `pass`, `score`, `violations`, `topicsDetected`, `rulesEvaluated`, `durationMs`. | Status: done
- [x] **Define Remediation interface** — Add `Remediation` interface with `ruleId`, `type`, `original?`, `replacement`, `position`. | Status: done
- [x] **Define EnforcedOutput interface** — Add `EnforcedOutput` interface with `text`, `pass`, `score`, `violations`, `remediations`, `topicsDetected`, `durationMs`. | Status: done
- [x] **Define EnforcerOptions interface** — Add `EnforcerOptions` interface with `enforcement?`, `throwOnViolation?`, `failOnWarnings?`, `customRules?`, `topicOverrides?`, `disabledRules?`. | Status: done
- [x] **Define CustomRule interface** — Add `CustomRule` interface with `id`, `type: 'custom'`, `severity`, `description?`, `direction?`, `condition?`, `validate` function. | Status: done
- [x] **Define CustomRuleContext interface** — Add `CustomRuleContext` interface with `direction`, `topicsDetected`, `input?`. | Status: done
- [x] **Define CustomViolation interface** — Add `CustomViolation` interface with `message`, `matched?`, `location?`, `suggestion?`. | Status: done
- [x] **Define PolicyEnforcer interface** — Add `PolicyEnforcer` interface with `check()`, `checkOutput()`, `checkInput()`, `enforce()`, and readonly `policy`. | Status: done
- [x] **Define CheckContext interface** — Add `CheckContext` interface with `direction?: Direction`. | Status: done
- [x] **Define OutputContext interface** — Add `OutputContext` interface with `input?: string`. | Status: done

---

## Phase 3: Error Classes

- [x] **Implement PolicyValidationError** — Create `src/errors.ts` with `PolicyValidationError` class extending `Error`. Include an `errors: string[]` field listing all validation failures. | Status: done
- [x] **Implement PolicyViolationError** — Add `PolicyViolationError` class extending `Error` to `src/errors.ts`. Include a `violations: Violation[]` field containing the violations that triggered the error. | Status: done

---

## Phase 4: YAML Parser

- [x] **Implement minimal YAML parser** — Create `src/policy/yaml-parser.ts` with a minimal inline YAML parser that handles the subset of YAML used in policy files: scalars (strings, numbers, booleans), sequences (arrays using `- ` syntax), mappings (key-value pairs), comments (lines starting with `#`), and multi-line strings. Zero external dependencies. | Status: done
- [x] **Handle YAML quoted strings** — Ensure the parser correctly handles single-quoted and double-quoted strings, including strings with special characters and escape sequences. | Status: done
- [x] **Handle YAML inline sequences** — Support inline array syntax like `["Google", "Microsoft"]` in YAML values. | Status: done
- [x] **Handle YAML nested mappings** — Support nested object structures (e.g., `condition:` containing `topic:`, `keywords:`, `minLength:`). | Status: done
- [ ] **Write YAML parser tests** — Test parsing of valid policy YAML with all field types, edge cases (empty values, special characters, deeply nested structures), and error cases (malformed YAML). | Status: not_done

---

## Phase 5: Policy Loading and Validation

- [x] **Implement loadPolicy from file path** — Create `src/policy/load.ts` with `loadPolicy()` function. When given a file path (string ending in `.yaml`, `.yml`, or `.json`), read the file with `fs.readFileSync()` and parse it. | Status: done
- [x] **Implement loadPolicy from YAML string** — Detect YAML string input (non-file-path string) and parse with the inline YAML parser. | Status: done
- [x] **Implement loadPolicy from JSON string** — Detect JSON string input (starts with `{`) and parse with `JSON.parse()`. | Status: done
- [x] **Implement loadPolicy from JavaScript object** — When given a plain object, use it directly as the policy definition. | Status: done
- [x] **Apply default values during loading** — Set defaults for omitted fields: `enforcement` defaults to `"enforce"`, `failOnWarnings` to `false`, rule `severity` to `"error"`, rule `direction` to `"output"`, rule `enabled` to `true`, `caseSensitive` to `false`, `wholeWord` to `true`. | Status: done
- [x] **Merge built-in topics with custom topics** — During loading, merge the five built-in topic dictionaries (medical, financial, legal, political, religious) with any user-defined custom topics. User-defined topics with the same name as built-in topics override the built-in definitions. | Status: done
- [x] **Implement policy validation** — Create `src/policy/validate.ts`. Validate: required `name` field exists, `rules` array exists and is non-empty, each rule has a unique `id`, each rule has a valid `type`, unknown rule types are rejected, each rule has the required parameters for its type, regex patterns in `deny-regex` rules are valid (compilable), topic references in conditions match defined or built-in topics. | Status: done
- [x] **Validate deny-keyword rule parameters** — Ensure `keywords` is a non-empty array of strings. | Status: done
- [x] **Validate deny-regex rule parameters** — Ensure `pattern` is a non-empty string and compiles as a valid RegExp. Ensure `flags` (if provided) are valid regex flags. | Status: done
- [x] **Validate require-keyword rule parameters** — Ensure `keywords` is a non-empty array of strings. | Status: done
- [x] **Validate require-disclaimer rule parameters** — Ensure `disclaimer` is a non-empty string. Ensure `position` (if provided) is `"start"` or `"end"`. | Status: done
- [x] **Validate deny-topic rule parameters** — Ensure `topic` is a non-empty string that matches a defined or built-in topic name. | Status: done
- [x] **Validate replace rule parameters** — Ensure `patterns` is a non-empty array of `{ match, replacement }` objects. | Status: done
- [x] **Validate redact rule parameters** — Ensure `patterns` is a non-empty array of strings. | Status: done
- [x] **Validate language-match rule parameters** — Ensure `allowedLanguages` (if provided) is an array of strings. | Status: done
- [x] **Validate length-limit rule parameters** — Ensure at least one of `maxLength`, `minLength`, `maxWords`, `minWords` is specified and is a positive number. | Status: done
- [ ] **Compile regex patterns at load time** — Pre-compile all regex patterns (from `deny-regex` rules, keyword word-boundary patterns for `deny-keyword`/`require-keyword`, topic detection patterns) during `loadPolicy()` and store compiled `RegExp` objects on the rule. No regex compilation during `check()`/`enforce()`. | Status: not_done
- [ ] **Compile topic detection regexes at load time** — Compile all keywords for each topic into a single alternation regex (`/\b(keyword1|keyword2|...)\b/gi`) at load time for efficient single-pass matching. | Status: not_done
- [x] **Throw PolicyValidationError on invalid policy** — When validation fails, throw `PolicyValidationError` with all validation errors collected in the `errors` array. | Status: done
- [x] **Write loadPolicy tests** — Test loading from YAML string, JSON string, file path, and JS object. Test that valid policies load successfully. Test that invalid policies throw `PolicyValidationError` with correct error messages for each validation case (missing name, duplicate IDs, invalid regex, unknown rule type, unknown topic reference, missing required params). | Status: done

---

## Phase 6: Topic Detection

- [x] **Define built-in topic dictionaries** — Create `src/topics/built-in.ts` with the five built-in topic dictionaries: `medical` (25 keywords, threshold 2), `financial` (25 keywords, threshold 2), `legal` (23 keywords, threshold 2), `political` (22 keywords, threshold 3), `religious` (23 keywords, threshold 3). Use the exact keyword lists from the spec. | Status: done
- [x] **Implement topic detection algorithm** — Create `src/topics/detect.ts`. Normalize text (lowercase, collapse whitespace). For each topic, match keywords using the pre-compiled alternation regex. Count unique keyword matches. Compare against threshold. Return `DetectedTopic[]` with name, matchCount, confidence (matchCount / total keywords), and matchedKeywords. | Status: done
- [x] **Implement topic detection index** — Create `src/topics/index.ts` that exports the topic detection engine (combining built-in and custom topics). | Status: done
- [x] **Write topic detection tests** — Test built-in topic detection for all five topics with known text samples. Verify threshold behavior (below threshold = not detected, at threshold = detected, above threshold = detected). Verify word boundary matching (partial words do not match). Verify custom topic definitions. Verify custom topics override built-in topics with the same name. | Status: done
- [ ] **Write built-in topic dictionary tests** — Verify that each built-in topic dictionary has the correct keywords and default thresholds as specified. | Status: not_done

---

## Phase 7: Condition Evaluation

- [x] **Implement condition evaluator** — Create `src/enforcer/condition.ts`. Evaluate `RuleCondition` against text and detected topics. Support: `topic` condition (check if topic is in detected topics set), `keywords` condition (check if any keyword is present in text), `minLength` condition (check if text length >= minLength). All conditions must be met for the rule to activate (AND logic). | Status: done
- [x] **Handle topic-based conditions** — When a condition specifies `topic`, check the detected topics set. If the topic is not detected, the condition is not met and the rule is skipped. | Status: done
- [x] **Handle keyword-based conditions** — When a condition specifies `keywords`, check if at least one keyword is present in the text (case-insensitive). | Status: done
- [x] **Handle minLength conditions** — When a condition specifies `minLength`, check if text character count >= minLength. | Status: done
- [x] **Write condition evaluation tests** — Test topic conditions (with detected/not-detected topics), keyword conditions (present/absent), minLength conditions, and combined conditions. Verify that rules with unmet conditions are skipped. | Status: done

---

## Phase 8: Rule Evaluators

### 8.1 deny-keyword

- [x] **Implement deny-keyword evaluator** — Create `src/rules/deny-keyword.ts`. For each keyword, construct a regex with word boundaries if `wholeWord: true` (`/\b{keyword}\b/`), else use string inclusion. Apply `caseSensitive` flag. Find all matches and produce a `Violation` for each with `ruleId`, `severity`, `message` (with `{{matched}}` placeholder replaced), `matched` text, `location` (start/end offsets). | Status: done
- [x] **Handle wholeWord matching** — When `wholeWord: true`, "Meta" must not match "metadata". When `wholeWord: false`, "Meta" matches "metadata". | Status: done
- [x] **Handle caseSensitive matching** — When `caseSensitive: false`, "google" matches "Google". When `caseSensitive: true`, "google" does not match "Google". | Status: done
- [x] **Produce multiple violations for multiple matches** — If the text contains "Google" twice, produce two separate violations with correct locations. | Status: done
- [x] **Write deny-keyword tests** — Test: text that passes (no keywords found), text with one keyword match, text with multiple keyword matches, wholeWord true/false, caseSensitive true/false, multi-word keyword phrases, message template placeholder replacement. | Status: done

### 8.2 deny-regex

- [x] **Implement deny-regex evaluator** — Create `src/rules/deny-regex.ts`. Compile the pattern and flags into a `RegExp`. Execute against text. If `g` flag set, find all matches; otherwise, find first match only. Produce a `Violation` for each match with matched text and location. | Status: done
- [x] **Handle invalid regex gracefully** — If the regex pattern is invalid (should be caught at validation time), produce a configuration error, not a violation. | Status: done
- [x] **Handle global flag for multiple matches** — When `flags` includes `g`, find all matches in the text. Without `g`, find only the first. | Status: done
- [x] **Write deny-regex tests** — Test: text that passes, text with one match, text with multiple matches (with `g` flag), case-insensitive flag, multiline flag, complex patterns (email patterns, pricing patterns, sentence structure patterns). | Status: done

### 8.3 require-keyword

- [x] **Implement require-keyword evaluator** — Create `src/rules/require-keyword.ts`. Check if text contains any/all of the specified keywords (respecting `caseSensitive`). If `requireAll: false` (default), produce a violation if NONE of the keywords are found. If `requireAll: true`, produce a violation for each keyword NOT found. | Status: done
- [x] **Handle requireAll mode** — When `requireAll: true`, each missing keyword generates a separate violation. When `requireAll: false`, a single violation is generated only if none are present. | Status: done
- [x] **Write require-keyword tests** — Test: text containing at least one keyword (pass), text missing all keywords (fail), requireAll true with some missing, requireAll true with all present, caseSensitive behavior. | Status: done

### 8.4 require-disclaimer

- [x] **Implement require-disclaimer evaluator** — Create `src/rules/require-disclaimer.ts`. Check if text contains the disclaimer string. If `fuzzyMatch: false`, use exact string inclusion. If `fuzzyMatch: true`, normalize both text and disclaimer (collapse whitespace, lowercase) before checking. Produce a violation if disclaimer is not found. | Status: done
- [x] **Handle fuzzyMatch normalization** — Collapse all whitespace runs to single spaces and lowercase both strings before comparison. | Status: done
- [x] **Write require-disclaimer tests** — Test: text containing exact disclaimer (pass), text missing disclaimer (fail), fuzzyMatch true with whitespace variations, fuzzyMatch true with case variations, fuzzyMatch false requiring exact match. | Status: done

### 8.5 deny-topic

- [x] **Implement deny-topic evaluator** — Create `src/rules/deny-topic.ts`. Run topic detection for the specified topic on the text. If the topic is detected (keyword matches meet threshold), produce a violation listing the trigger keywords found. Support optional `threshold` override. | Status: done
- [x] **Handle threshold override** — If the rule specifies a `threshold`, use it instead of the topic definition's default threshold. | Status: done
- [x] **Write deny-topic tests** — Test: text not discussing topic (pass), text discussing topic above threshold (fail), text at threshold boundary, threshold override behavior, violation message includes trigger keywords. | Status: done

### 8.6 replace

- [x] **Implement replace evaluator** — Create `src/rules/replace.ts`. For each `{ match, replacement }` pair, find all occurrences in the text (respecting `caseSensitive` and `wholeWord`). Record a violation for each occurrence noting original and replacement text. | Status: done
- [x] **Write replace tests** — Test: text with no matches (pass), text with single match, text with multiple matches across different patterns, caseSensitive and wholeWord options. | Status: done

### 8.7 redact

- [x] **Implement redact evaluator** — Create `src/rules/redact.ts`. For each pattern, find all occurrences (respecting `caseSensitive`, `wholeWord`, `useRegex`). Record a violation for each noting original text and the redaction placeholder. Default replacement is `"[REDACTED]"`. | Status: done
- [x] **Handle useRegex option** — When `useRegex: true`, interpret patterns as regular expressions. When `false`, treat as literal strings. | Status: done
- [x] **Write redact tests** — Test: text with no patterns found (pass), text with pattern matches, custom replacement placeholder, useRegex true with regex patterns, caseSensitive and wholeWord options, default `[REDACTED]` replacement. | Status: done

### 8.8 language-match

- [x] **Implement language detection** — Create `src/language/detect.ts`. Implement lightweight language detection based on Unicode script detection (Latin, Cyrillic, CJK, Arabic, Devanagari) and common-word frequency analysis for Latin-script languages (English, Spanish, French, German, Portuguese, Italian). Return detected language as ISO 639-1 code. | Status: done
- [x] **Support detection for specified languages** — Support detecting: English, Spanish, French, German, Portuguese, Italian, Russian, Chinese (Simplified/Traditional), Japanese, Korean, Arabic, Hindi with reasonable accuracy. | Status: done
- [x] **Implement language-match evaluator** — Create `src/rules/language-match.ts`. Detect language of input text and output text. If `allowedLanguages` is specified, check output language against the list. If not specified, compare output language against input language. Produce a violation on mismatch with `{{actual}}` and `{{expected}}` placeholders. | Status: done
- [ ] **Write language detection tests** — Test detection of each supported language with representative text samples. Verify correct ISO 639-1 codes returned. | Status: not_done
- [x] **Write language-match rule tests** — Test: matching languages (pass), mismatched languages (fail), allowedLanguages whitelist, message template with `{{actual}}`/`{{expected}}` placeholders. | Status: done

### 8.9 length-limit

- [x] **Implement length-limit evaluator** — Create `src/rules/length-limit.ts`. Count characters and/or words (split by whitespace). Check against `maxLength`, `minLength`, `maxWords`, `minWords`. Produce a violation for each exceeded limit with `{{actual}}` and `{{expected}}` placeholders in the message. | Status: done
- [x] **Handle multiple limit parameters** — A single rule can specify any combination of `maxLength`, `minLength`, `maxWords`, `minWords`. Each violated limit produces a violation. | Status: done
- [x] **Write length-limit tests** — Test: text within limits (pass), text exceeding maxLength, text below minLength, text exceeding maxWords, text below minWords, combined limits. | Status: done

### 8.10 custom

- [x] **Implement custom rule evaluator** — Create `src/rules/custom.ts`. Delegate to the user-provided `validate` function, passing the text and a `CustomRuleContext`. Map returned `CustomViolation[]` to full `Violation[]` with ruleId, severity, and remediated flag. | Status: done
- [x] **Write custom rule tests** — Test: custom function returning no violations (pass), custom function returning violations, custom function receiving correct context (direction, topicsDetected, input). | Status: done

### 8.11 Rule Registry

- [x] **Implement rule type registry** — Create `src/rules/index.ts`. Export a registry mapping rule type strings to their evaluator functions. Provide a `evaluateRule(rule, text, context)` function that dispatches to the correct evaluator based on `rule.type`. | Status: done

---

## Phase 9: Core Evaluation Pipeline

- [x] **Implement evaluation pipeline** — Create `src/enforcer/evaluate.ts`. Implement the step-by-step evaluation described in the spec: validate inputs, determine direction, detect topics, evaluate each applicable rule (respecting enabled flag, direction filter, condition evaluation), collect violations, determine compliance (pass/fail), compute score, return `PolicyResult`. | Status: done
- [x] **Handle empty text input** — When text is empty, return early with `pass: true`, zero violations, no topics detected. | Status: done
- [ ] **Handle null/undefined text input** — When text is null or undefined, throw a clear error or return a meaningful result. | Status: not_done
- [x] **Filter rules by direction** — Only evaluate rules whose `direction` matches the current check direction. Rules with `direction: "both"` always apply. | Status: done
- [x] **Skip disabled rules** — Rules with `enabled: false` are skipped during evaluation. | Status: done
- [x] **Evaluate rules in policy-file order** — Rules are evaluated in the order they appear in the policy's `rules` array for predictable, deterministic behavior. | Status: done
- [x] **Implement compliance score calculation** — Formula: `score = 1.0 - (errorWeight * errorCount + warningWeight * warningCount + infoWeight * infoCount) / totalRuleCount`, clamped to [0, 1]. Error weight: 1.0, warning weight: 0.3, info weight: 0.05. | Status: done
- [x] **Implement pass/fail determination** — `pass = true` if no error-severity violations. If `failOnWarnings` is true, `pass = false` if any warning-severity violations exist. Info-severity violations never affect pass. | Status: done
- [x] **Measure evaluation duration** — Use `performance.now()` to measure evaluation duration in milliseconds. Include in `PolicyResult.durationMs`. | Status: done
- [x] **Replace message template placeholders** — Replace `{{matched}}`, `{{actual}}`, `{{expected}}`, `{{replacement}}` in violation messages with actual values. | Status: done
- [x] **Write evaluation pipeline tests** — Test full pipeline with a multi-rule policy: verify correct violations, pass/fail, score, topics detected, rules evaluated count, duration. Test direction filtering, disabled rules, condition skipping. | Status: done

---

## Phase 10: Remediation Engine

- [x] **Implement remediation engine** — Create `src/enforcer/remediate.ts`. For rules that support remediation (`replace`, `redact`, `require-disclaimer`), apply text modifications in rule order. Track each remediation in a `Remediation[]` array. | Status: done
- [x] **Implement redact remediation** — Replace matched text with the redaction placeholder (default `[REDACTED]`). Record the original text, replacement, and position. | Status: done
- [x] **Implement replace remediation** — Substitute matched text with the specified replacement. Record original, replacement, and position. | Status: done
- [x] **Implement disclaimer insertion remediation** — If the disclaimer is missing, append (position: `"end"`) or prepend (position: `"start"`) the disclaimer text, separated by the configured separator (default `"\n\n"`). | Status: done
- [x] **Handle remediation stacking** — Apply remediations in rule order so that earlier rules' text modifications affect what later rules evaluate. Adjust character offsets as text changes. | Status: done
- [x] **Mark remediated violations** — Set `remediated: true` on violations that were automatically fixed. | Status: done
- [x] **Write remediation tests** — Test: redact removes matched text, replace substitutes text, disclaimer is appended/prepended, multiple remediations stack correctly, position tracking after offset changes, remediated flag is set. | Status: done

---

## Phase 11: PolicyEnforcer Class

- [x] **Implement createEnforcer factory** — Create `src/enforcer/index.ts` with `createEnforcer(policy, options?)` factory. Return a `PolicyEnforcer` instance. Apply option defaults: `throwOnViolation: true`, `failOnWarnings` from policy or false, empty `customRules`, empty `topicOverrides`, empty `disabledRules`. | Status: done
- [x] **Implement enforcer.check()** — Evaluate text against all applicable rules. Return `PolicyResult`. Does not modify text regardless of enforcement mode. Accept optional `CheckContext` with direction. | Status: done
- [x] **Implement enforcer.checkOutput()** — Convenience method that calls `check()` with `direction: 'output'`. Accept optional `OutputContext` with `input` for language-match rules. | Status: done
- [x] **Implement enforcer.checkInput()** — Convenience method that calls `check()` with `direction: 'input'`. Only evaluates rules with `direction: "input"` or `direction: "both"`. | Status: done
- [x] **Implement enforcer.enforce()** — Evaluate text and apply remediations. In `enforce` mode: apply remediations for rules that support it. For unremediable error-severity violations: if `throwOnViolation` is true, throw `PolicyViolationError`; if false, return `pass: false` with unmodified text. In `audit`/`report` mode, return text unchanged. Return `EnforcedOutput`. | Status: done
- [x] **Handle enforcement mode override** — Support per-enforcer enforcement mode override via `options.enforcement`, and per-rule enforcement mode override via `rule.enforcement`. Per-rule overrides take precedence over enforcer-level, which takes precedence over policy-level. | Status: done
- [x] **Handle disabledRules option** — Skip rules whose IDs are in the `disabledRules` array during evaluation. | Status: done
- [x] **Handle topicOverrides option** — Merge `topicOverrides` into the policy's topic definitions, allowing runtime keyword/threshold changes. | Status: done
- [x] **Handle customRules option** — Append `customRules` to the policy's rules array for evaluation. | Status: done
- [x] **Expose readonly policy property** — The `PolicyEnforcer` instance exposes the loaded `Policy` object as a readonly property. | Status: done
- [x] **Implement throwOnViolation behavior** — When `enforce()` is called in enforce mode and an unremediable error-severity violation is found: if `throwOnViolation` is true, throw `PolicyViolationError` with the violations. If false, return the result with `pass: false`. | Status: done
- [x] **Write enforcer creation tests** — Test factory with various option combinations. Verify defaults. Verify option overrides. | Status: done
- [x] **Write enforcer.check() tests** — Test check with direction, condition-based rules, various rule types. Verify PolicyResult structure. | Status: done
- [x] **Write enforcer.enforce() tests** — Test enforce with remediable rules, unremediable rules, throwOnViolation true/false, audit/report modes. Verify EnforcedOutput structure. | Status: done

---

## Phase 12: Standalone Functions

- [x] **Implement checkPolicy standalone function** — Export a `checkPolicy(policy, text, context?)` function that creates a temporary enforcer and calls `check()`. For simple one-off usage. | Status: done
- [x] **Implement enforcePolicy standalone function** — Export an `enforcePolicy(policy, text, context?)` function that creates a temporary enforcer and calls `enforce()`. | Status: done
- [x] **Write standalone function tests** — Test `checkPolicy` and `enforcePolicy` produce correct results without creating an explicit enforcer. | Status: done

---

## Phase 13: Public API (index.ts)

- [x] **Wire up public exports in index.ts** — Update `src/index.ts` to export: `loadPolicy`, `createEnforcer`, `checkPolicy`, `enforcePolicy`, all type interfaces/types from `types.ts`, error classes (`PolicyValidationError`, `PolicyViolationError`). | Status: done
- [x] **Verify named exports match spec** — Ensure the exported API surface matches the spec exactly: `loadPolicy`, `createEnforcer`, `checkPolicy`, `enforcePolicy`, plus all types. | Status: done

---

## Phase 14: Environment Variable Support

- [ ] **Implement CONTENT_POLICY_ENFORCEMENT env var** — Check `process.env.CONTENT_POLICY_ENFORCEMENT` to override enforcement mode at runtime. Apply as the lowest-priority override (policy file > enforcer option > env var). | Status: not_done
- [ ] **Implement CONTENT_POLICY_FILE env var** — Check `process.env.CONTENT_POLICY_FILE` as default policy file path when CLI is invoked without a file argument. | Status: not_done
- [ ] **Write environment variable tests** — Test that env vars are read and applied correctly. Test precedence ordering. | Status: not_done

---

## Phase 15: CLI Implementation

- [ ] **Implement CLI entry point** — Create `src/cli.ts` with a hashbang (`#!/usr/bin/env node`). Use `node:util.parseArgs()` for argument parsing (Node.js 18+). Parse commands: `check`, `enforce`, `validate`, `topics`. | Status: not_done
- [ ] **Implement CLI check command** — `content-policy check <policy-file> [text]`. Load policy, read text from inline argument, `--file`, or stdin. Check text against policy. Output results in human-readable or JSON format. Exit with code 0 (compliant), 1 (non-compliant), or 2 (config error). | Status: not_done
- [ ] **Implement CLI enforce command** — `content-policy enforce <policy-file> [text]`. Load policy, read text, enforce policy, output remediated text and violation report. | Status: not_done
- [ ] **Implement CLI validate command** — `content-policy validate <policy-file>`. Load and validate policy file. Output policy summary (name, version, rule count, topic count, rule list). Exit 0 on valid, 2 on invalid. | Status: not_done
- [ ] **Implement CLI topics command** — `content-policy topics <policy-file> [text]`. Detect topics in text using policy's topic definitions. Output detected topics with match counts and confidence. | Status: not_done
- [ ] **Implement stdin text input** — When no inline text or `--file` is provided, read text from stdin for `check` and `enforce` commands. | Status: not_done
- [ ] **Implement --file flag** — Read text from a file path specified via `--file`. | Status: not_done
- [ ] **Implement --input flag** — Provide user input context for language-match rules via `--input <text>`. | Status: not_done
- [ ] **Implement --enforcement flag** — Override enforcement mode via CLI flag. | Status: not_done
- [ ] **Implement --direction flag** — Set check direction via CLI flag. Default: `output`. | Status: not_done
- [ ] **Implement --format flag** — Support `human` (default) and `json` output formats. | Status: not_done
- [ ] **Implement --quiet flag** — Suppress all output except exit code. | Status: not_done
- [ ] **Implement --disable-rule flag** — Disable specific rules by ID. Repeatable for multiple rules. | Status: not_done
- [ ] **Implement --version flag** — Print package version from `package.json` and exit. | Status: not_done
- [ ] **Implement --help flag** — Print usage help text and exit. | Status: not_done
- [ ] **Implement human-readable output format** — Format output matching the spec example: header with policy info, violations listed with severity/rule/matched/location, topics detected, summary line with counts, result PASSED/FAILED. | Status: not_done
- [ ] **Implement JSON output format** — Serialize `PolicyResult` or `EnforcedOutput` as JSON to stdout. | Status: not_done
- [ ] **Implement deterministic exit codes** — Exit 0 for compliant, 1 for non-compliant (error-severity violations), 2 for configuration errors (invalid policy, missing args, unreadable input). | Status: not_done
- [ ] **Handle CLI errors gracefully** — Catch errors, print human-readable error messages to stderr, exit with code 2 for config errors. | Status: not_done

---

## Phase 16: Performance Optimization

- [ ] **Implement regex timeout guard** — For user-provided patterns in `deny-regex` rules, implement a timeout guard. If a pattern takes longer than 10ms to evaluate, terminate and log a warning. Protect against ReDoS (catastrophic backtracking). | Status: not_done
- [ ] **Verify no regex compilation at evaluation time** — Audit the code to ensure all regex patterns are compiled at load/create time, never during `check()` or `enforce()`. | Status: not_done
- [x] **Verify stateless evaluation** — Confirm the enforcer retains no per-call state. Each `check()`/`enforce()` call allocates only result objects. | Status: done
- [ ] **Write performance benchmark tests** — Create `src/__tests__/performance.test.ts`. Benchmark: 5-rule policy against 1KB text (target: <0.1ms), 15-rule policy against 2KB text (target: <0.3ms), 50-rule policy against 4KB text (target: <1.0ms), 100-rule policy against 4KB text (target: <2.5ms), 15-rule policy against 100KB text (target: <5.0ms), topic detection with 10 topics against 4KB text (target: <1ms). | Status: not_done

---

## Phase 17: Test Fixtures

- [ ] **Create valid-policy.yaml fixture** — Create `src/__tests__/fixtures/policies/valid-policy.yaml` with a comprehensive policy covering multiple rule types, topics, and conditions. | Status: not_done
- [ ] **Create invalid-policy.yaml fixture** — Create `src/__tests__/fixtures/policies/invalid-policy.yaml` with known validation errors (missing name, duplicate rule IDs, invalid regex, unknown rule type). | Status: not_done
- [ ] **Create brand-protection.yaml fixture** — Create the brand protection policy from spec section 18.1 as a test fixture. | Status: not_done
- [ ] **Create healthcare-compliance.yaml fixture** — Create the healthcare compliance policy from spec section 18.2 as a test fixture. | Status: not_done
- [ ] **Create financial-services.yaml fixture** — Create the financial services policy from spec section 18.3 as a test fixture. | Status: not_done
- [ ] **Create compliant-output.txt fixture** — Create a sample LLM output text that passes all rules in the valid policy. | Status: not_done
- [ ] **Create non-compliant-output.txt fixture** — Create a sample LLM output text that triggers multiple violations across different rule types. | Status: not_done
- [ ] **Create medical-discussion.txt fixture** — Create a sample text that discusses medical topics to trigger topic detection and medical disclaimer rules. | Status: not_done

---

## Phase 18: Integration Tests

- [x] **Write full pipeline integration test** — Load a realistic policy, evaluate realistic LLM output, verify complete `PolicyResult` structure including pass/fail, score, violations with correct ruleIds/severities/messages/locations, topics detected. | Status: done
- [x] **Write enforce round-trip test** — Enforce a policy on text with multiple violations, then re-check the enforced text. Verify remediated violations no longer appear. Verify remaining unremediable violations still appear. | Status: done
- [ ] **Write multi-policy evaluation test** — Load multiple policies and evaluate text against all of them. Verify violations from all policies are collected. | Status: not_done
- [x] **Write direction filtering integration test** — Verify that input-direction rules only fire during input checks and output-direction rules only fire during output checks. | Status: done
- [x] **Write conditional rules integration test** — Verify that topic-conditioned rules only fire when the topic is detected, and keyword/minLength conditions work correctly in a full pipeline. | Status: done
- [x] **Write enforcement mode integration test** — Test audit mode (violations logged, text unchanged), enforce mode (remediations applied, throwOnViolation), and report mode (violations reported, text unchanged). | Status: done

---

## Phase 19: CLI End-to-End Tests

- [ ] **Write CLI check command E2E test** — Run the CLI binary with `check` against test fixtures. Verify correct stdout output and exit codes (0 for compliant, 1 for non-compliant). | Status: not_done
- [ ] **Write CLI enforce command E2E test** — Run the CLI binary with `enforce`. Verify remediated text output and exit code. | Status: not_done
- [ ] **Write CLI validate command E2E test** — Run the CLI binary with `validate` against valid and invalid policy files. Verify output and exit codes (0 for valid, 2 for invalid). | Status: not_done
- [ ] **Write CLI topics command E2E test** — Run the CLI binary with `topics` and sample text. Verify topic detection output. | Status: not_done
- [ ] **Write CLI stdin input E2E test** — Pipe text via stdin to the CLI and verify it processes correctly. | Status: not_done
- [ ] **Write CLI --format json E2E test** — Verify JSON output format produces parseable JSON matching the PolicyResult/EnforcedOutput structure. | Status: not_done
- [ ] **Write CLI --quiet E2E test** — Verify quiet mode suppresses all output, only exit code matters. | Status: not_done
- [ ] **Write CLI --disable-rule E2E test** — Verify that disabled rules are skipped in CLI output. | Status: not_done
- [ ] **Write CLI error handling E2E test** — Verify exit code 2 for missing policy file, invalid policy, missing text input, unreadable file. | Status: not_done
- [ ] **Write CLI --version E2E test** — Verify version flag prints the package version. | Status: not_done
- [ ] **Write CLI --help E2E test** — Verify help flag prints usage information. | Status: not_done

---

## Phase 20: Edge Cases and Error Handling

- [x] **Handle text with special regex characters** — Ensure keywords containing regex-special characters (e.g., `$`, `.`, `(`, `)`) are properly escaped when used in word-boundary regex patterns. | Status: done
- [ ] **Handle empty rules array** — If a policy has an empty rules array (after validation allows it or all rules are disabled), return `pass: true` with zero violations. | Status: not_done
- [ ] **Handle very large text input** — Ensure evaluation completes within performance targets for 100KB+ text. No memory issues. | Status: not_done
- [ ] **Handle very large policy** — Ensure 100+ rule policies evaluate correctly and within performance targets. | Status: not_done
- [ ] **Handle unicode text** — Ensure keyword matching, word boundaries, topic detection, and language detection work correctly with Unicode characters (CJK, Arabic, Cyrillic, emoji, combining characters). | Status: not_done
- [x] **Handle overlapping remediations** — When multiple redact/replace rules match overlapping text regions, handle gracefully (apply in order, later rules operate on already-modified text). | Status: done
- [ ] **Handle regex with catastrophic backtracking potential** — Verify the 10ms timeout guard catches and terminates problematic user-provided regex patterns without crashing. | Status: not_done
- [x] **Handle missing input context for language-match** — When a `language-match` rule is evaluated but no input text is provided, produce a clear warning or skip the rule rather than crashing. | Status: done
- [ ] **Handle concurrent enforcer usage** — Verify the enforcer is stateless and safe for concurrent use (multiple `check()`/`enforce()` calls from different async contexts). | Status: not_done

---

## Phase 21: Documentation

- [ ] **Create README.md** — Write a comprehensive README with: package description, installation instructions, quick start example, API reference (`loadPolicy`, `createEnforcer`, `checkPolicy`, `enforcePolicy`), rule type catalog with examples for each of the 10 rule types, topic detection explanation, CLI usage guide with all commands/flags/exit codes, policy file authoring guide, example policies for common use cases (brand protection, healthcare, financial), integration examples with monorepo packages. | Status: not_done
- [x] **Add JSDoc comments to all public exports** — Add JSDoc documentation to `loadPolicy`, `createEnforcer`, `checkPolicy`, `enforcePolicy`, all type interfaces, and error classes. | Status: done
- [x] **Add inline code comments for complex logic** — Document the evaluation pipeline steps, scoring formula, remediation stacking logic, and language detection heuristics with inline comments. | Status: done

---

## Phase 22: Build and Publish Preparation

- [ ] **Verify TypeScript compilation** — Run `npm run build` (`tsc`) and ensure clean compilation with no errors. Verify `dist/` output contains `.js`, `.d.ts`, and `.js.map` files for all source modules. | Status: not_done
- [ ] **Verify all tests pass** — Run `npm run test` (`vitest run`) and ensure all unit, integration, CLI, and performance tests pass. | Status: not_done
- [ ] **Verify lint passes** — Run `npm run lint` and ensure no lint errors. | Status: not_done
- [ ] **Bump version in package.json** — Bump version per semver (patch/minor/major depending on the change). | Status: not_done
- [ ] **Verify package.json fields** — Ensure `main`, `types`, `bin`, `files`, `engines`, `license`, `description`, `keywords` are all correct. Add relevant keywords (`content-policy`, `llm`, `guardrails`, `policy-engine`, `content-filter`). | Status: not_done
- [x] **Verify zero runtime dependencies** — Confirm `package.json` has no `dependencies` field (only `devDependencies`). Verify no `require()` or `import` statements reference external packages at runtime. | Status: done
- [ ] **Test npm pack** — Run `npm pack` and inspect the tarball to verify only `dist/` files are included (per `"files": ["dist"]` in package.json). No source files, test files, or fixtures should be in the published package. | Status: not_done
