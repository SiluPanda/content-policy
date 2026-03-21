import {
  Rule, Violation, DetectedTopic, Direction,
  CustomRuleContext, CustomViolation,
} from './types';

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format a violation message template with matched text and other values.
 */
function formatMessage(
  template: string | undefined,
  defaults: string,
  vars: Record<string, string>,
): string {
  if (!template) return defaults;
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Evaluate a single rule against text and return violations.
 */
export function evaluateRule(
  rule: Rule,
  text: string,
  detectedTopics: DetectedTopic[],
  context: {
    direction: Direction;
    input?: string;
  },
): Violation[] {
  switch (rule.type) {
    case 'deny-keyword':
      return evaluateDenyKeyword(rule, text);
    case 'deny-regex':
      return evaluateDenyRegex(rule, text);
    case 'require-keyword':
      return evaluateRequireKeyword(rule, text);
    case 'require-disclaimer':
      return evaluateRequireDisclaimer(rule, text);
    case 'deny-topic':
      return evaluateDenyTopic(rule, text, detectedTopics);
    case 'replace':
      return evaluateReplace(rule, text);
    case 'redact':
      return evaluateRedact(rule, text);
    case 'language-match':
      return evaluateLanguageMatch(rule, text, context.input);
    case 'length-limit':
      return evaluateLengthLimit(rule, text);
    case 'custom':
      return evaluateCustom(rule, text, detectedTopics, context);
    default:
      return [];
  }
}

// ── deny-keyword ─────────────────────────────────────────────

function evaluateDenyKeyword(rule: Rule, text: string): Violation[] {
  const violations: Violation[] = [];
  const keywords = rule.params.keywords as string[];
  const caseSensitive = rule.params.caseSensitive as boolean;
  const wholeWord = rule.params.wholeWord as boolean;

  for (const keyword of keywords) {
    const escaped = escapeRegex(keyword);
    const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const matched = match[0];
      violations.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: formatMessage(rule.message, `Text contains denied keyword: "${matched}"`, {
          matched,
        }),
        matched,
        location: { start: match.index, end: match.index + matched.length },
        remediated: false,
      });
    }
  }

  return violations;
}

// ── deny-regex ───────────────────────────────────────────────

function evaluateDenyRegex(rule: Rule, text: string): Violation[] {
  const violations: Violation[] = [];
  const pattern = rule.params.pattern as string;
  let flags = rule.params.flags as string;

  // Ensure global flag is present for finding all matches
  if (!flags.includes('g')) {
    // Only find first match if no global flag
    const regex = new RegExp(pattern, flags);
    const match = regex.exec(text);
    if (match) {
      const matched = match[0];
      violations.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: formatMessage(rule.message, `Text matches denied pattern: "${matched}"`, {
          matched,
        }),
        matched,
        location: { start: match.index, end: match.index + matched.length },
        remediated: false,
      });
    }
    return violations;
  }

  const regex = new RegExp(pattern, flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const matched = match[0];
    violations.push({
      ruleId: rule.id,
      severity: rule.severity,
      message: formatMessage(rule.message, `Text matches denied pattern: "${matched}"`, {
        matched,
      }),
      matched,
      location: { start: match.index, end: match.index + matched.length },
      remediated: false,
    });
    // Prevent infinite loop on zero-length matches
    if (match[0].length === 0) regex.lastIndex++;
  }

  return violations;
}

// ── require-keyword ──────────────────────────────────────────

function evaluateRequireKeyword(rule: Rule, text: string): Violation[] {
  const violations: Violation[] = [];
  const keywords = rule.params.keywords as string[];
  const caseSensitive = rule.params.caseSensitive as boolean;
  const requireAll = rule.params.requireAll as boolean;

  const checkText = caseSensitive ? text : text.toLowerCase();

  if (requireAll) {
    for (const keyword of keywords) {
      const checkKeyword = caseSensitive ? keyword : keyword.toLowerCase();
      if (!checkText.includes(checkKeyword)) {
        violations.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: formatMessage(
            rule.message,
            `Text is missing required keyword: "${keyword}"`,
            { matched: keyword, expected: keyword },
          ),
          remediated: false,
        });
      }
    }
  } else {
    const found = keywords.some(keyword => {
      const checkKeyword = caseSensitive ? keyword : keyword.toLowerCase();
      return checkText.includes(checkKeyword);
    });

    if (!found) {
      violations.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: formatMessage(
          rule.message,
          `Text is missing at least one of the required keywords: ${keywords.join(', ')}`,
          { expected: keywords.join(', ') },
        ),
        remediated: false,
      });
    }
  }

  return violations;
}

// ── require-disclaimer ───────────────────────────────────────

function evaluateRequireDisclaimer(rule: Rule, text: string): Violation[] {
  const disclaimer = rule.params.disclaimer as string;
  const fuzzyMatch = rule.params.fuzzyMatch as boolean;

  let found: boolean;
  if (fuzzyMatch) {
    const normalizedText = normalizeWhitespace(text.toLowerCase());
    const normalizedDisclaimer = normalizeWhitespace(disclaimer.toLowerCase());
    found = normalizedText.includes(normalizedDisclaimer);
  } else {
    found = text.includes(disclaimer);
  }

  if (found) return [];

  return [{
    ruleId: rule.id,
    severity: rule.severity,
    message: formatMessage(
      rule.message,
      `Text is missing required disclaimer`,
      { expected: disclaimer },
    ),
    suggestion: `Add disclaimer: "${disclaimer}"`,
    remediated: false,
  }];
}

function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

// ── deny-topic ───────────────────────────────────────────────

function evaluateDenyTopic(
  rule: Rule,
  _text: string,
  detectedTopics: DetectedTopic[],
): Violation[] {
  const topicName = rule.params.topic as string;
  const threshold = rule.params.threshold as number | undefined;

  const found = detectedTopics.find(t => t.name === topicName);
  if (!found) return [];

  // If a threshold override is specified on the rule, check against it
  if (threshold !== undefined && found.matchCount < threshold) {
    return [];
  }

  return [{
    ruleId: rule.id,
    severity: rule.severity,
    message: formatMessage(
      rule.message,
      `Text discusses denied topic: "${topicName}" (matched keywords: ${found.matchedKeywords.join(', ')})`,
      { matched: topicName },
    ),
    matched: found.matchedKeywords.join(', '),
    remediated: false,
  }];
}

// ── replace ──────────────────────────────────────────────────

function evaluateReplace(rule: Rule, text: string): Violation[] {
  const violations: Violation[] = [];
  const patterns = rule.params.patterns as Array<{ match: string; replacement: string }>;
  const caseSensitive = rule.params.caseSensitive as boolean;
  const wholeWord = rule.params.wholeWord as boolean;

  for (const { match: matchStr, replacement } of patterns) {
    const escaped = escapeRegex(matchStr);
    const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);

    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      violations.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: formatMessage(
          rule.message,
          `Text contains content to replace: "${m[0]}" -> "${replacement}"`,
          { matched: m[0], replacement },
        ),
        matched: m[0],
        location: { start: m.index, end: m.index + m[0].length },
        suggestion: `Replace with: "${replacement}"`,
        remediated: false,
      });
    }
  }

  return violations;
}

// ── redact ───────────────────────────────────────────────────

function evaluateRedact(rule: Rule, text: string): Violation[] {
  const violations: Violation[] = [];
  const patterns = rule.params.patterns as string[];
  const replacement = rule.params.replacement as string;
  const caseSensitive = rule.params.caseSensitive as boolean;
  const wholeWord = rule.params.wholeWord as boolean;
  const useRegex = rule.params.useRegex as boolean;

  for (const pattern of patterns) {
    const escaped = useRegex ? pattern : escapeRegex(pattern);
    const regexPattern = wholeWord && !useRegex ? `\\b${escaped}\\b` : escaped;
    const flags = caseSensitive ? 'g' : 'gi';

    let regex: RegExp;
    try {
      regex = new RegExp(regexPattern, flags);
    } catch {
      continue;
    }

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      violations.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: formatMessage(
          rule.message,
          `Text contains content to redact: "${match[0]}" -> "${replacement}"`,
          { matched: match[0] },
        ),
        matched: match[0],
        location: { start: match.index, end: match.index + match[0].length },
        remediated: false,
      });
      if (match[0].length === 0) regex.lastIndex++;
    }
  }

  return violations;
}

// ── language-match ───────────────────────────────────────────

/**
 * Basic language detection using Unicode scripts and common word heuristics.
 */
function detectLanguage(text: string): string {
  const normalized = text.trim();
  if (!normalized) return 'en';

  // Check for CJK characters
  const cjkChars = normalized.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  if (cjkChars && cjkChars.length > normalized.length * 0.1) return 'zh';

  // Check for Japanese (Hiragana/Katakana)
  const jpChars = normalized.match(/[\u3040-\u309f\u30a0-\u30ff]/g);
  if (jpChars && jpChars.length > normalized.length * 0.05) return 'ja';

  // Check for Korean (Hangul)
  const koChars = normalized.match(/[\uac00-\ud7af\u1100-\u11ff]/g);
  if (koChars && koChars.length > normalized.length * 0.1) return 'ko';

  // Check for Arabic
  const arChars = normalized.match(/[\u0600-\u06ff\u0750-\u077f]/g);
  if (arChars && arChars.length > normalized.length * 0.1) return 'ar';

  // Check for Cyrillic (Russian)
  const cyChars = normalized.match(/[\u0400-\u04ff]/g);
  if (cyChars && cyChars.length > normalized.length * 0.1) return 'ru';

  // Check for Devanagari (Hindi)
  const devaChars = normalized.match(/[\u0900-\u097f]/g);
  if (devaChars && devaChars.length > normalized.length * 0.1) return 'hi';

  // Latin-script language detection via common words
  const lowerText = normalized.toLowerCase();
  const words = lowerText.split(/\s+/);

  const langScores: Record<string, number> = {
    en: 0, es: 0, fr: 0, de: 0, pt: 0, it: 0,
  };

  const langWords: Record<string, string[]> = {
    en: ['the', 'is', 'are', 'was', 'were', 'have', 'has', 'been', 'will', 'would', 'could', 'should', 'this', 'that', 'with', 'from', 'they', 'their', 'which', 'about'],
    es: ['el', 'la', 'los', 'las', 'es', 'son', 'una', 'del', 'que', 'por', 'con', 'para', 'como', 'pero', 'sus', 'este', 'esta', 'estos', 'tiene', 'puede'],
    fr: ['le', 'la', 'les', 'des', 'est', 'sont', 'une', 'que', 'qui', 'dans', 'pour', 'avec', 'sur', 'par', 'pas', 'nous', 'vous', 'leur', 'cette', 'mais'],
    de: ['der', 'die', 'das', 'ist', 'sind', 'ein', 'eine', 'und', 'nicht', 'auf', 'mit', 'dem', 'den', 'sich', 'von', 'auch', 'nach', 'wie', 'noch', 'aber'],
    pt: ['o', 'os', 'as', 'um', 'uma', 'que', 'com', 'para', 'por', 'mais', 'como', 'mas', 'sua', 'seu', 'tem', 'pode', 'isso', 'esta', 'este', 'muito'],
    it: ['il', 'lo', 'la', 'gli', 'le', 'un', 'una', 'che', 'non', 'con', 'per', 'sono', 'del', 'della', 'questo', 'questa', 'anche', 'come', 'suo', 'sua'],
  };

  for (const word of words) {
    for (const [lang, commonWords] of Object.entries(langWords)) {
      if (commonWords.includes(word)) {
        langScores[lang]++;
      }
    }
  }

  let maxLang = 'en';
  let maxScore = 0;
  for (const [lang, score] of Object.entries(langScores)) {
    if (score > maxScore) {
      maxScore = score;
      maxLang = lang;
    }
  }

  return maxLang;
}

function evaluateLanguageMatch(rule: Rule, text: string, input?: string): Violation[] {
  const allowedLanguages = rule.params.allowedLanguages as string[] | undefined;
  const outputLang = detectLanguage(text);

  if (allowedLanguages && allowedLanguages.length > 0) {
    if (!allowedLanguages.includes(outputLang)) {
      return [{
        ruleId: rule.id,
        severity: rule.severity,
        message: formatMessage(
          rule.message,
          `Output language (${outputLang}) is not in allowed languages: ${allowedLanguages.join(', ')}`,
          { actual: outputLang, expected: allowedLanguages.join(', ') },
        ),
        matched: outputLang,
        remediated: false,
      }];
    }
    return [];
  }

  // Must match input language
  if (!input) return [];

  const inputLang = detectLanguage(input);
  if (outputLang !== inputLang) {
    return [{
      ruleId: rule.id,
      severity: rule.severity,
      message: formatMessage(
        rule.message,
        `Output language (${outputLang}) does not match input language (${inputLang})`,
        { actual: outputLang, expected: inputLang },
      ),
      matched: outputLang,
      remediated: false,
    }];
  }

  return [];
}

// ── length-limit ─────────────────────────────────────────────

function evaluateLengthLimit(rule: Rule, text: string): Violation[] {
  const violations: Violation[] = [];

  const maxLength = rule.params.maxLength as number | undefined;
  const minLength = rule.params.minLength as number | undefined;
  const maxWords = rule.params.maxWords as number | undefined;
  const minWords = rule.params.minWords as number | undefined;

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  if (maxLength !== undefined && charCount > maxLength) {
    violations.push({
      ruleId: rule.id,
      severity: rule.severity,
      message: formatMessage(
        rule.message,
        `Text exceeds maximum length of ${maxLength} characters (actual: ${charCount})`,
        { actual: String(charCount), expected: String(maxLength) },
      ),
      remediated: false,
    });
  }

  if (minLength !== undefined && charCount < minLength) {
    violations.push({
      ruleId: rule.id,
      severity: rule.severity,
      message: formatMessage(
        rule.message,
        `Text is below minimum length of ${minLength} characters (actual: ${charCount})`,
        { actual: String(charCount), expected: String(minLength) },
      ),
      remediated: false,
    });
  }

  if (maxWords !== undefined && wordCount > maxWords) {
    violations.push({
      ruleId: rule.id,
      severity: rule.severity,
      message: formatMessage(
        rule.message,
        `Text exceeds maximum word count of ${maxWords} words (actual: ${wordCount})`,
        { actual: String(wordCount), expected: String(maxWords) },
      ),
      remediated: false,
    });
  }

  if (minWords !== undefined && wordCount < minWords) {
    violations.push({
      ruleId: rule.id,
      severity: rule.severity,
      message: formatMessage(
        rule.message,
        `Text is below minimum word count of ${minWords} words (actual: ${wordCount})`,
        { actual: String(wordCount), expected: String(minWords) },
      ),
      remediated: false,
    });
  }

  return violations;
}

// ── custom ───────────────────────────────────────────────────

function evaluateCustom(
  rule: Rule,
  text: string,
  detectedTopics: DetectedTopic[],
  context: { direction: Direction; input?: string },
): Violation[] {
  const validate = rule.params.validate as
    | ((text: string, ctx: CustomRuleContext) => CustomViolation[])
    | undefined;

  if (!validate) return [];

  const ctx: CustomRuleContext = {
    direction: context.direction,
    topicsDetected: detectedTopics,
    input: context.input,
  };

  const customViolations = validate(text, ctx);

  return customViolations.map(cv => ({
    ruleId: rule.id,
    severity: rule.severity,
    message: cv.message,
    matched: cv.matched,
    location: cv.location,
    suggestion: cv.suggestion,
    remediated: false,
  }));
}
