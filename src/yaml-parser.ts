/**
 * Minimal YAML parser supporting the subset of YAML used in policy files:
 * - Scalars (strings, numbers, booleans, null)
 * - Sequences (arrays using - notation)
 * - Mappings (key: value)
 * - Comments (# lines)
 * - Quoted strings (single and double)
 * - Flow sequences [a, b, c]
 * - Nested structures via indentation
 *
 * This is NOT a full YAML spec parser. For full YAML support,
 * parse externally and pass the object to loadPolicy().
 */

interface ParseState {
  lines: string[];
  index: number;
}

export function parseYaml(input: string): unknown {
  const lines = input.split('\n');
  const state: ParseState = { lines, index: 0 };
  return parseDocument(state);
}

function parseDocument(state: ParseState): unknown {
  skipBlanksAndComments(state);
  if (state.index >= state.lines.length) {
    return {};
  }
  // Check if document starts with a sequence item at root level
  const firstLine = state.lines[state.index];
  const firstIndent = getIndent(firstLine);
  const trimmed = firstLine.trim();
  if (trimmed.startsWith('- ') || trimmed === '-') {
    return parseSequence(state, firstIndent);
  }
  return parseMapping(state, firstIndent);
}

function skipBlanksAndComments(state: ParseState): void {
  while (state.index < state.lines.length) {
    const trimmed = state.lines[state.index].trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      state.index++;
    } else {
      break;
    }
  }
}

function getIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function parseMapping(state: ParseState, baseIndent: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  while (state.index < state.lines.length) {
    skipBlanksAndComments(state);
    if (state.index >= state.lines.length) break;

    const line = state.lines[state.index];
    const indent = getIndent(line);
    const trimmed = line.trim();

    // Stop if we've dedented past our base
    if (indent < baseIndent) break;
    // Skip if deeper indent (should not happen at mapping level)
    if (indent > baseIndent) break;

    // Parse key: value
    const colonIndex = findUnquotedColon(trimmed);
    if (colonIndex === -1) break;

    const key = trimmed.substring(0, colonIndex).trim();
    const valueStr = trimmed.substring(colonIndex + 1).trim();

    if (valueStr === '' || valueStr.startsWith('#')) {
      // Value is on the next line(s) — could be a mapping, sequence, or multiline scalar
      state.index++;
      skipBlanksAndComments(state);
      if (state.index < state.lines.length) {
        const nextLine = state.lines[state.index];
        const nextIndent = getIndent(nextLine);
        const nextTrimmed = nextLine.trim();
        if (nextIndent > baseIndent) {
          if (nextTrimmed.startsWith('- ') || nextTrimmed === '-') {
            result[key] = parseSequence(state, nextIndent);
          } else {
            result[key] = parseMapping(state, nextIndent);
          }
        } else {
          result[key] = null;
        }
      } else {
        result[key] = null;
      }
    } else {
      result[key] = parseInlineValue(valueStr);
      state.index++;
    }
  }

  return result;
}

function parseSequence(state: ParseState, baseIndent: number): unknown[] {
  const result: unknown[] = [];

  while (state.index < state.lines.length) {
    skipBlanksAndComments(state);
    if (state.index >= state.lines.length) break;

    const line = state.lines[state.index];
    const indent = getIndent(line);
    const trimmed = line.trim();

    if (indent < baseIndent) break;
    if (indent > baseIndent) break;

    if (!trimmed.startsWith('- ') && trimmed !== '-') break;

    // Extract value after "- "
    const itemStr = trimmed === '-' ? '' : trimmed.substring(2).trim();

    if (itemStr === '' || itemStr.startsWith('#')) {
      // Next lines contain the item (mapping or sequence)
      state.index++;
      skipBlanksAndComments(state);
      if (state.index < state.lines.length) {
        const nextLine = state.lines[state.index];
        const nextIndent = getIndent(nextLine);
        const nextTrimmed = nextLine.trim();
        if (nextIndent > baseIndent) {
          if (nextTrimmed.startsWith('- ') || nextTrimmed === '-') {
            result.push(parseSequence(state, nextIndent));
          } else {
            result.push(parseMapping(state, nextIndent));
          }
        } else {
          result.push(null);
        }
      } else {
        result.push(null);
      }
    } else if (findUnquotedColon(itemStr) !== -1) {
      // Inline mapping start: "- key: value"
      // Parse as a mapping with the rest on subsequent lines
      const colonIdx = findUnquotedColon(itemStr);
      const key = itemStr.substring(0, colonIdx).trim();
      const val = itemStr.substring(colonIdx + 1).trim();

      state.index++;
      // Determine the indent of sub-keys (if any)
      skipBlanksAndComments(state);
      const subIndent = baseIndent + 2;

      const mapping: Record<string, unknown> = {};
      mapping[key] = val === '' ? null : parseInlineValue(val);

      // Continue reading mapping keys at sub-indent
      while (state.index < state.lines.length) {
        skipBlanksAndComments(state);
        if (state.index >= state.lines.length) break;

        const subLine = state.lines[state.index];
        const subLineIndent = getIndent(subLine);
        const subTrimmed = subLine.trim();

        if (subLineIndent < subIndent) break;
        if (subLineIndent > subIndent) {
          // Nested value for previous key
          break;
        }
        if (subTrimmed.startsWith('- ')) break;

        const subColonIdx = findUnquotedColon(subTrimmed);
        if (subColonIdx === -1) break;

        const subKey = subTrimmed.substring(0, subColonIdx).trim();
        const subVal = subTrimmed.substring(subColonIdx + 1).trim();

        if (subVal === '' || subVal.startsWith('#')) {
          state.index++;
          skipBlanksAndComments(state);
          if (state.index < state.lines.length) {
            const nextLine = state.lines[state.index];
            const nextIndent = getIndent(nextLine);
            const nextTrimmed = nextLine.trim();
            if (nextIndent > subIndent) {
              if (nextTrimmed.startsWith('- ') || nextTrimmed === '-') {
                mapping[subKey] = parseSequence(state, nextIndent);
              } else {
                mapping[subKey] = parseMapping(state, nextIndent);
              }
            } else {
              mapping[subKey] = null;
            }
          } else {
            mapping[subKey] = null;
          }
        } else {
          mapping[subKey] = parseInlineValue(subVal);
          state.index++;
        }
      }

      result.push(mapping);
    } else {
      result.push(parseInlineValue(itemStr));
      state.index++;
    }
  }

  return result;
}

function findUnquotedColon(str: string): number {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (ch === ':' && !inSingleQuote && !inDoubleQuote) {
      // Colon must be followed by space, end of string, or be the mapping separator
      if (i + 1 >= str.length || str[i + 1] === ' ' || str[i + 1] === '\t') {
        return i;
      }
    }
  }
  return -1;
}

function parseInlineValue(str: string): unknown {
  // Remove inline comments
  const value = stripInlineComment(str).trim();

  if (value === '') return null;

  // Flow sequence: [a, b, c]
  if (value.startsWith('[') && value.endsWith(']')) {
    return parseFlowSequence(value);
  }

  // Flow mapping: {a: b, c: d}
  if (value.startsWith('{') && value.endsWith('}')) {
    return parseFlowMapping(value);
  }

  // Quoted strings
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return unquote(value);
  }

  // Boolean
  if (value === 'true' || value === 'True' || value === 'TRUE') return true;
  if (value === 'false' || value === 'False' || value === 'FALSE') return false;

  // Null
  if (value === 'null' || value === 'Null' || value === 'NULL' || value === '~') return null;

  // Number
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

  // Plain string
  return value;
}

function stripInlineComment(str: string): string {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (ch === '#' && !inSingleQuote && !inDoubleQuote) {
      // Must be preceded by whitespace to be a comment
      if (i > 0 && (str[i - 1] === ' ' || str[i - 1] === '\t')) {
        return str.substring(0, i);
      }
    }
  }
  return str;
}

function parseFlowSequence(str: string): unknown[] {
  // Remove brackets
  const inner = str.substring(1, str.length - 1).trim();
  if (inner === '') return [];

  const items: unknown[] = [];
  let current = '';
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
    } else if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
    } else if (!inSingleQuote && !inDoubleQuote) {
      if (ch === '[' || ch === '{') {
        depth++;
        current += ch;
      } else if (ch === ']' || ch === '}') {
        depth--;
        current += ch;
      } else if (ch === ',' && depth === 0) {
        items.push(parseInlineValue(current.trim()));
        current = '';
      } else {
        current += ch;
      }
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    items.push(parseInlineValue(current.trim()));
  }

  return items;
}

function parseFlowMapping(str: string): Record<string, unknown> {
  const inner = str.substring(1, str.length - 1).trim();
  if (inner === '') return {};

  const result: Record<string, unknown> = {};

  // Split by commas respecting nesting depth and quotes
  const pairs: string[] = [];
  let current = '';
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
    } else if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
    } else if (!inSingleQuote && !inDoubleQuote) {
      if (ch === '[' || ch === '{') {
        depth++;
        current += ch;
      } else if (ch === ']' || ch === '}') {
        depth--;
        current += ch;
      } else if (ch === ',' && depth === 0) {
        pairs.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    pairs.push(current.trim());
  }

  for (const pair of pairs) {
    const colonIdx = findUnquotedColon(pair);
    if (colonIdx === -1) continue;
    const key = pair.substring(0, colonIdx).trim();
    const value = pair.substring(colonIdx + 1).trim();
    result[unquote(key) as string] = parseInlineValue(value);
  }

  return result;
}

function unquote(str: string): string {
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))) {
    const inner = str.substring(1, str.length - 1);
    // Handle basic escape sequences for double-quoted strings
    if (str.startsWith('"')) {
      return inner
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
    return inner;
  }
  return str;
}
