import * as fs from 'fs';
import { Policy, Rule, RuleType, Severity, Direction, EnforcementMode, TopicDefinition, RuleCondition } from './types';
import { PolicyValidationError } from './errors';
import { parseYaml } from './yaml-parser';
import { BUILTIN_TOPICS } from './topics';

const VALID_RULE_TYPES: RuleType[] = [
  'deny-keyword', 'deny-regex', 'require-keyword', 'require-disclaimer',
  'deny-topic', 'replace', 'redact', 'language-match', 'length-limit', 'custom',
];
const VALID_SEVERITIES: Severity[] = ['error', 'warning', 'info'];
const VALID_DIRECTIONS: Direction[] = ['input', 'output', 'both'];
const VALID_ENFORCEMENT_MODES: EnforcementMode[] = ['audit', 'enforce', 'report'];

/**
 * Load a policy from a YAML string, JSON string, file path, or JavaScript object.
 */
export function loadPolicy(source: string | Record<string, unknown>): Policy {
  let raw: unknown;

  if (typeof source === 'object' && source !== null) {
    raw = source;
  } else if (typeof source === 'string') {
    raw = parseSource(source);
  } else {
    throw new PolicyValidationError(['Invalid policy source: expected string or object']);
  }

  return validateAndBuildPolicy(raw);
}

function parseSource(source: string): unknown {
  const trimmed = source.trim();

  // Check if it's a file path
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.includes('\n')) {
    // Could be a file path
    try {
      if (fs.existsSync(trimmed)) {
        const content = fs.readFileSync(trimmed, 'utf-8');
        return parseSource(content);
      }
    } catch {
      // Not a file, continue to parse as string
    }
  }

  // Try JSON first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Not JSON, try YAML
    }
  }

  // Parse as YAML
  return parseYaml(trimmed);
}

function validateAndBuildPolicy(raw: unknown): Policy {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new PolicyValidationError(['Policy must be an object']);
  }

  const obj = raw as Record<string, unknown>;

  // Validate required fields
  if (!obj.name || typeof obj.name !== 'string') {
    errors.push('Missing required field: "name" (must be a string)');
  }

  if (!obj.rules) {
    errors.push('Missing required field: "rules" (must be an array)');
  } else if (!Array.isArray(obj.rules)) {
    errors.push('"rules" must be an array');
  }

  // Validate enforcement mode
  let enforcement: EnforcementMode = 'enforce';
  if (obj.enforcement !== undefined) {
    if (!VALID_ENFORCEMENT_MODES.includes(obj.enforcement as EnforcementMode)) {
      errors.push(`Invalid enforcement mode: "${obj.enforcement}". Must be one of: ${VALID_ENFORCEMENT_MODES.join(', ')}`);
    } else {
      enforcement = obj.enforcement as EnforcementMode;
    }
  }

  // Validate failOnWarnings
  let failOnWarnings = false;
  if (obj.failOnWarnings !== undefined) {
    if (typeof obj.failOnWarnings !== 'boolean') {
      errors.push('"failOnWarnings" must be a boolean');
    } else {
      failOnWarnings = obj.failOnWarnings;
    }
  }

  // Parse custom topics (merge with built-in)
  const topics: Record<string, TopicDefinition> = { ...BUILTIN_TOPICS };
  if (obj.topics !== undefined) {
    if (typeof obj.topics !== 'object' || obj.topics === null || Array.isArray(obj.topics)) {
      errors.push('"topics" must be an object');
    } else {
      const rawTopics = obj.topics as Record<string, unknown>;
      for (const [name, topicDef] of Object.entries(rawTopics)) {
        const validatedTopic = validateTopicDefinition(name, topicDef, errors);
        if (validatedTopic) {
          topics[name] = validatedTopic;
        }
      }
    }
  }

  // Parse rules
  const rules: Rule[] = [];
  const ruleIds = new Set<string>();

  if (Array.isArray(obj.rules)) {
    for (let i = 0; i < obj.rules.length; i++) {
      const ruleResult = validateRule(obj.rules[i], i, ruleIds, topics, errors);
      if (ruleResult) {
        rules.push(ruleResult);
        ruleIds.add(ruleResult.id);
      }
    }
  }

  if (errors.length > 0) {
    throw new PolicyValidationError(errors);
  }

  return {
    name: obj.name as string,
    version: typeof obj.version === 'string' ? obj.version : undefined,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    enforcement,
    failOnWarnings,
    topics,
    rules,
  };
}

function validateTopicDefinition(
  name: string,
  raw: unknown,
  errors: string[],
): TopicDefinition | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    errors.push(`Topic "${name}" must be an object`);
    return null;
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.keywords) || obj.keywords.length === 0) {
    errors.push(`Topic "${name}" must have a non-empty "keywords" array`);
    return null;
  }

  const keywords = obj.keywords.map((k: unknown) => String(k));
  const threshold = typeof obj.threshold === 'number' ? obj.threshold : 1;

  return { keywords, threshold };
}

function validateRule(
  raw: unknown,
  index: number,
  existingIds: Set<string>,
  topics: Record<string, TopicDefinition>,
  errors: string[],
): Rule | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    errors.push(`Rule at index ${index} must be an object`);
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // Validate id
  if (!obj.id || typeof obj.id !== 'string') {
    errors.push(`Rule at index ${index}: missing required field "id"`);
    return null;
  }

  if (existingIds.has(obj.id)) {
    errors.push(`Duplicate rule ID: "${obj.id}"`);
    return null;
  }

  const ruleId = obj.id;

  // Validate type
  if (!obj.type || typeof obj.type !== 'string') {
    errors.push(`Rule "${ruleId}": missing required field "type"`);
    return null;
  }

  if (!VALID_RULE_TYPES.includes(obj.type as RuleType)) {
    errors.push(`Rule "${ruleId}": unknown rule type "${obj.type}". Must be one of: ${VALID_RULE_TYPES.join(', ')}`);
    return null;
  }

  const type = obj.type as RuleType;

  // Validate severity
  let severity: Severity = 'error';
  if (obj.severity !== undefined) {
    if (!VALID_SEVERITIES.includes(obj.severity as Severity)) {
      errors.push(`Rule "${ruleId}": invalid severity "${obj.severity}"`);
    } else {
      severity = obj.severity as Severity;
    }
  }

  // Validate direction
  let direction: Direction = 'output';
  if (obj.direction !== undefined) {
    if (!VALID_DIRECTIONS.includes(obj.direction as Direction)) {
      errors.push(`Rule "${ruleId}": invalid direction "${obj.direction}"`);
    } else {
      direction = obj.direction as Direction;
    }
  }

  // Validate per-rule enforcement
  let enforcement: EnforcementMode | undefined;
  if (obj.enforcement !== undefined) {
    if (!VALID_ENFORCEMENT_MODES.includes(obj.enforcement as EnforcementMode)) {
      errors.push(`Rule "${ruleId}": invalid enforcement mode "${obj.enforcement}"`);
    } else {
      enforcement = obj.enforcement as EnforcementMode;
    }
  }

  // Validate condition
  let condition: RuleCondition | undefined;
  if (obj.condition !== undefined) {
    if (typeof obj.condition !== 'object' || obj.condition === null) {
      errors.push(`Rule "${ruleId}": "condition" must be an object`);
    } else {
      const condObj = obj.condition as Record<string, unknown>;
      condition = {};
      if (condObj.topic !== undefined) {
        if (typeof condObj.topic !== 'string') {
          errors.push(`Rule "${ruleId}": condition "topic" must be a string`);
        } else {
          if (!topics[condObj.topic]) {
            errors.push(`Rule "${ruleId}": condition references unknown topic "${condObj.topic}"`);
          }
          condition.topic = condObj.topic;
        }
      }
      if (condObj.keywords !== undefined) {
        if (!Array.isArray(condObj.keywords)) {
          errors.push(`Rule "${ruleId}": condition "keywords" must be an array`);
        } else {
          condition.keywords = condObj.keywords.map((k: unknown) => String(k));
        }
      }
      if (condObj.minLength !== undefined) {
        if (typeof condObj.minLength !== 'number') {
          errors.push(`Rule "${ruleId}": condition "minLength" must be a number`);
        } else {
          condition.minLength = condObj.minLength;
        }
      }
    }
  }

  // Validate enabled
  const enabled = obj.enabled !== false;

  // Validate type-specific params
  const params: Record<string, unknown> = {};

  validateRuleTypeParams(ruleId, type, obj, params, errors);

  return {
    id: ruleId,
    type,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    severity,
    direction,
    enforcement,
    condition,
    message: typeof obj.message === 'string' ? obj.message : undefined,
    enabled,
    params,
  };
}

function validateRuleTypeParams(
  ruleId: string,
  type: RuleType,
  obj: Record<string, unknown>,
  params: Record<string, unknown>,
  errors: string[],
): void {
  switch (type) {
    case 'deny-keyword': {
      if (!Array.isArray(obj.keywords) || obj.keywords.length === 0) {
        errors.push(`Rule "${ruleId}" (deny-keyword): missing required "keywords" array`);
      } else {
        params.keywords = obj.keywords.map((k: unknown) => String(k));
      }
      params.caseSensitive = obj.caseSensitive === true;
      params.wholeWord = obj.wholeWord !== false; // default true
      break;
    }

    case 'deny-regex': {
      if (!obj.pattern || typeof obj.pattern !== 'string') {
        errors.push(`Rule "${ruleId}" (deny-regex): missing required "pattern" string`);
      } else {
        params.pattern = obj.pattern;
        // Validate regex
        try {
          new RegExp(obj.pattern, typeof obj.flags === 'string' ? obj.flags : '');
        } catch (e) {
          errors.push(`Rule "${ruleId}" (deny-regex): invalid regex pattern: ${(e as Error).message}`);
        }
      }
      params.flags = typeof obj.flags === 'string' ? obj.flags : '';
      break;
    }

    case 'require-keyword': {
      if (!Array.isArray(obj.keywords) || obj.keywords.length === 0) {
        errors.push(`Rule "${ruleId}" (require-keyword): missing required "keywords" array`);
      } else {
        params.keywords = obj.keywords.map((k: unknown) => String(k));
      }
      params.caseSensitive = obj.caseSensitive === true;
      params.requireAll = obj.requireAll === true;
      break;
    }

    case 'require-disclaimer': {
      if (!obj.disclaimer || typeof obj.disclaimer !== 'string') {
        errors.push(`Rule "${ruleId}" (require-disclaimer): missing required "disclaimer" string`);
      } else {
        params.disclaimer = obj.disclaimer;
      }
      params.position = obj.position === 'start' ? 'start' : 'end';
      params.fuzzyMatch = obj.fuzzyMatch === true;
      params.separator = typeof obj.separator === 'string' ? obj.separator : '\n\n';
      break;
    }

    case 'deny-topic': {
      if (!obj.topic || typeof obj.topic !== 'string') {
        errors.push(`Rule "${ruleId}" (deny-topic): missing required "topic" string`);
      } else {
        params.topic = obj.topic;
      }
      if (obj.threshold !== undefined) {
        params.threshold = typeof obj.threshold === 'number' ? obj.threshold : undefined;
      }
      break;
    }

    case 'replace': {
      if (!Array.isArray(obj.patterns) || obj.patterns.length === 0) {
        errors.push(`Rule "${ruleId}" (replace): missing required "patterns" array`);
      } else {
        params.patterns = obj.patterns.map((p: unknown) => {
          if (typeof p === 'object' && p !== null) {
            const po = p as Record<string, unknown>;
            return {
              match: String(po.match || ''),
              replacement: String(po.replacement || ''),
            };
          }
          return { match: String(p), replacement: '' };
        });
      }
      params.caseSensitive = obj.caseSensitive === true;
      params.wholeWord = obj.wholeWord !== false;
      break;
    }

    case 'redact': {
      if (!Array.isArray(obj.patterns) || obj.patterns.length === 0) {
        errors.push(`Rule "${ruleId}" (redact): missing required "patterns" array`);
      } else {
        params.patterns = obj.patterns.map((p: unknown) => String(p));
      }
      params.replacement = typeof obj.replacement === 'string' ? obj.replacement : '[REDACTED]';
      params.caseSensitive = obj.caseSensitive === true;
      params.wholeWord = obj.wholeWord !== false;
      params.useRegex = obj.useRegex === true;
      break;
    }

    case 'language-match': {
      if (obj.allowedLanguages !== undefined) {
        if (!Array.isArray(obj.allowedLanguages)) {
          errors.push(`Rule "${ruleId}" (language-match): "allowedLanguages" must be an array`);
        } else {
          params.allowedLanguages = obj.allowedLanguages.map((l: unknown) => String(l));
        }
      }
      break;
    }

    case 'length-limit': {
      let hasLimit = false;
      if (obj.maxLength !== undefined) {
        if (typeof obj.maxLength !== 'number') {
          errors.push(`Rule "${ruleId}" (length-limit): "maxLength" must be a number`);
        } else {
          params.maxLength = obj.maxLength;
          hasLimit = true;
        }
      }
      if (obj.minLength !== undefined) {
        if (typeof obj.minLength !== 'number') {
          errors.push(`Rule "${ruleId}" (length-limit): "minLength" must be a number`);
        } else {
          params.minLength = obj.minLength;
          hasLimit = true;
        }
      }
      if (obj.maxWords !== undefined) {
        if (typeof obj.maxWords !== 'number') {
          errors.push(`Rule "${ruleId}" (length-limit): "maxWords" must be a number`);
        } else {
          params.maxWords = obj.maxWords;
          hasLimit = true;
        }
      }
      if (obj.minWords !== undefined) {
        if (typeof obj.minWords !== 'number') {
          errors.push(`Rule "${ruleId}" (length-limit): "minWords" must be a number`);
        } else {
          params.minWords = obj.minWords;
          hasLimit = true;
        }
      }
      if (!hasLimit) {
        errors.push(`Rule "${ruleId}" (length-limit): at least one of maxLength, minLength, maxWords, minWords must be specified`);
      }
      break;
    }

    case 'custom': {
      // Custom rules are defined programmatically, not in YAML
      // The validate function will be provided via customRules in EnforcerOptions
      if (typeof obj.validate === 'function') {
        params.validate = obj.validate;
      }
      break;
    }
  }
}
