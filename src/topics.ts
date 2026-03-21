import { TopicDefinition, DetectedTopic } from './types';

/** Built-in topic dictionaries. */
export const BUILTIN_TOPICS: Record<string, TopicDefinition> = {
  medical: {
    keywords: [
      'health', 'medical', 'doctor', 'physician', 'symptom', 'diagnosis',
      'treatment', 'medicine', 'medication', 'prescription', 'surgery',
      'hospital', 'patient', 'disease', 'illness', 'therapy', 'clinical',
      'nurse', 'pharmacy', 'vaccine', 'dosage', 'side effect', 'condition',
      'chronic', 'acute',
    ],
    threshold: 2,
  },
  financial: {
    keywords: [
      'invest', 'stock', 'bond', 'portfolio', 'dividend', 'market',
      'trading', 'fund', 'retirement', '401k', 'IRA', 'interest rate',
      'mortgage', 'loan', 'credit', 'debt', 'savings', 'financial advisor',
      'tax', 'capital gains', 'securities', 'asset', 'liability', 'equity',
      'cryptocurrency',
    ],
    threshold: 2,
  },
  legal: {
    keywords: [
      'legal', 'attorney', 'lawyer', 'court', 'lawsuit', 'litigation',
      'contract', 'liability', 'negligence', 'statute', 'regulation',
      'compliance', 'jurisdiction', 'defendant', 'plaintiff', 'verdict',
      'settlement', 'damages', 'arbitration', 'mediation', 'tort',
      'deposition', 'subpoena',
    ],
    threshold: 2,
  },
  political: {
    keywords: [
      'election', 'democrat', 'republican', 'congress', 'senate',
      'president', 'legislation', 'policy', 'liberal', 'conservative',
      'campaign', 'ballot', 'vote', 'party', 'government', 'administration',
      'bipartisan', 'caucus', 'amendment', 'constitution', 'lobby',
      'referendum',
    ],
    threshold: 3,
  },
  religious: {
    keywords: [
      'religion', 'church', 'mosque', 'temple', 'prayer', 'worship',
      'faith', 'god', 'spiritual', 'bible', 'quran', 'torah', 'christian',
      'muslim', 'jewish', 'hindu', 'buddhist', 'salvation', 'sermon',
      'scripture', 'denomination', 'clergy', 'baptism',
    ],
    threshold: 3,
  },
};

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect topics in text using keyword-based heuristics.
 * Compiles all keywords for a topic into a single alternation regex for performance.
 */
export function detectTopics(
  text: string,
  topics: Record<string, TopicDefinition>,
): DetectedTopic[] {
  const normalizedText = text.toLowerCase();
  const detected: DetectedTopic[] = [];

  for (const [name, definition] of Object.entries(topics)) {
    const matchedKeywords: string[] = [];

    for (const keyword of definition.keywords) {
      const escapedKeyword = escapeRegex(keyword.toLowerCase());
      // Use word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
      if (regex.test(normalizedText)) {
        matchedKeywords.push(keyword);
      }
    }

    if (matchedKeywords.length >= definition.threshold) {
      detected.push({
        name,
        matchCount: matchedKeywords.length,
        confidence: matchedKeywords.length / definition.keywords.length,
        matchedKeywords,
      });
    }
  }

  return detected;
}
