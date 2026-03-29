/**
 * displayNames.js
 *
 * Converts raw classUri / label values from the DeepPhe SQLite database
 * into human-readable display names for UI surfaces (facet rows, chips,
 * summary sentences).
 *
 * Usage:
 *   import { toDisplayName } from './displayNames.js';
 *   toDisplayName('AxillaryLymphNode')                    // → "Axillary Lymph Node"
 *   toDisplayName('HER2_sl_NeuNegative')                  // → "HER2/Neu Negative"
 *   toDisplayName('StageIIA')                             // → "Stage IIA"
 *   toDisplayName('N1aStageFinding')                      // → "N1a"
 *   toDisplayName('n_2_dot_30O_qt_clockPosition')         // → "2:30 o'clock"
 *   toDisplayName('EstrogenReceptorPositive')             // → "ER+"
 *   toDisplayName('F', 'gender')                          // → "Female"
 *   toDisplayName('B', 'cancer')                          // → "Breast"
 *
 * The optional second argument (source/attribute_name) enables context-
 * sensitive mappings for short codes like "F", "M", "B", "O".
 */

// ──────────────────────────────────────────────────────────────────────
// 1. EXPLICIT OVERRIDES — highest priority, exact match
//    Add entries here for values where algorithmic transforms fail.
// ──────────────────────────────────────────────────────────────────────

const EXPLICIT = {
  // --- Demographics ---
  'F':       { gender: 'Female' },
  'M':       { gender: 'Male', cancer: 'Melanoma' },
  'U':       { gender: 'Unknown' },
  'B':       { cancer: 'Breast' },
  'O':       { cancer: 'Ovarian Cancer' },

  // --- Receptor shorthand (clinician-standard) ---
  'EstrogenReceptorPositive':      'ER+',
  'EstrogenReceptorNegative':      'ER−',
  'EstrogenReceptorStatus':        'ER Status',
  'ProgesteroneReceptorPositive':  'PR+',
  'ProgesteroneReceptorNegative':  'PR−',
  'ProgesteroneReceptorStatus':    'PR Status',
  'HER2_sl_NeuPositive':           'HER2+',
  'HER2_sl_NeuNegative':           'HER2−',
  'HER2_sl_NeuStatus':             'HER2 Status',
  'HER2_sl_NeuPositiveByFISH':     'HER2+ (FISH)',
  'HER2_sl_NeuNegativeByFISH':     'HER2− (FISH)',
  'ERBB2Overexpression':           'HER2/ERBB2 Overexpression',
  'HER2_sl_NeuExpressionByImmunohistochemistry1_add_': 'HER2 IHC 1+',
  'HER2_sl_NeuExpressionByImmunohistochemistry2_add_': 'HER2 IHC 2+',
  'BreastCancerType1SusceptibilityProtein': 'BRCA1',
  'BreastCancerType2SusceptibilityProtein': 'BRCA2',
  'MicrosatelliteStable':          'MSS (Microsatellite Stable)',

  // --- Behavior ---
  'Metastatic_sl_Recurrent':       'Metastatic/Recurrent',
  'Non_Malignant':                 'Non-Malignant',
  'InSitu':                        'In Situ',
  'DistantlyMetastatic':           'Distantly Metastatic',
  'LocallyMetastatic':             'Locally Metastatic',

  // --- Grade ---
  'WellDifferentiated':            'Well Differentiated',
  'ModeratelyDifferentiated':      'Moderately Differentiated',
  'PoorlyDifferentiated':          'Poorly Differentiated',
  'Undifferentiated':              'Undifferentiated',
  'HighGrade':                     'High Grade',
  'IntermediateGrade':             'Intermediate Grade',
  'LowGrade':                      'Low Grade',
  'GleasonPattern3':               'Gleason Pattern 3',
  'Grade2_sl_3':                   'Grade 2/3',

  // --- Special stage values ---
  'AdvancedStage':                 'Advanced Stage',
  'TisStageFinding':               'Tis',
  'TaStageFinding':                'Ta',
  'NXStageFinding':                'NX',
  'MXStageFinding':                'MX',
  'StageIs':                       'Stage Is',

  // --- Laterality ---
  'Bilateral':                     'Bilateral',
  'Left':                          'Left',
  'Right':                         'Right',
};


// ──────────────────────────────────────────────────────────────────────
// 2. URI ENCODING MAP — decode DeepPhe's character substitutions
// ──────────────────────────────────────────────────────────────────────

const URI_DECODE = [
  // Order matters: longer tokens first to avoid partial matches
  ['_dot_',  '.'],
  ['_cma_',  ', '],
  ['_lpn_',  ' ('],
  ['_rpn_',  ')'],
  ['_add_',  '+'],
  ['_sub_',  '-'],
  ['_sl_',   '/'],
  ['_qt_',   "'"],
];


// ──────────────────────────────────────────────────────────────────────
// 3. PATTERN HANDLERS — regex-based transforms for systematic patterns
// ──────────────────────────────────────────────────────────────────────

/**
 * Clock position: n_2O_qt_clockPosition → "2 o'clock"
 *                 n_2_dot_30O_qt_clockPosition → "2:30 o'clock"
 */
function tryClockface(uri) {
  // With half-hour: n_2_dot_30O_qt_clockPosition
  let m = uri.match(/^n_(\d+)_dot_(\d+)O_qt_clockPosition$/);
  if (m) return `${m[1]}:${m[2]} o'clock`;

  // Whole hour: n_2O_qt_clockPosition
  m = uri.match(/^n_(\d+)O_qt_clockPosition$/);
  if (m) return `${m[1]} o'clock`;

  return null;
}

/**
 * Overall stage: StageIV → "Stage IV", StageIIA1 → "Stage IIA1"
 */
function tryOverallStage(uri) {
  const m = uri.match(/^Stage([0IV]+[A-D]?\d{0,2})$/i);
  if (m) return `Stage ${m[1]}`;
  return null;
}

/**
 * TNM stage findings:
 *   T1cStageFinding  → "T1c"
 *   PT1aStageFinding  → "pT1a"
 *   PN2bStageFinding  → "pN2b"
 *   N0_lpn_i_add__rpn_StageFinding → "N0(i+)"
 *   CM0_lpn_i_add__rpn_StageFinding → "cM0(i+)"
 *   N0_lpn_i_sub__rpn_StageFinding → "N0(i-)"
 */
function tryTNMStage(uri) {
  // Encoded parenthetical: N0_lpn_i_add__rpn_StageFinding → N0(i+)
  let m = uri.match(/^(C?[PpCc]?)([TNM]\w*)_lpn_(.+?)_rpn_StageFinding$/);
  if (m) {
    let prefix = m[1].toLowerCase();
    let stage = m[2];
    let paren = m[3]
      .replace(/_add_/g, '+')
      .replace(/_sub_/g, '−');
    return `${prefix}${stage}(${paren})`;
  }

  // Simple: PT1aStageFinding, T2StageFinding, N1miStageFinding
  m = uri.match(/^(P?)([TNM])(\w*)StageFinding$/);
  if (m) {
    let prefix = m[1] ? 'p' : '';
    return `${prefix}${m[2]}${m[3]}`;
  }

  // Prefixed: CM0...
  m = uri.match(/^(C)([M])(\w*)StageFinding$/);
  if (m) {
    return `c${m[2]}${m[3]}`;
  }

  return null;
}

/**
 * Grade numeric: Grade1 → "Grade 1", Grade3a → "Grade 3a", GradeX → "Grade X"
 */
function tryGrade(uri) {
  const m = uri.match(/^Grade(\w+)$/);
  if (m) return `Grade ${m[1]}`;
  return null;
}


// ──────────────────────────────────────────────────────────────────────
// 4. CAMELCASE SPLITTER — the general-purpose fallback
// ──────────────────────────────────────────────────────────────────────

/**
 * Split CamelCase into words with proper handling of:
 *   - Acronyms: "ABVDRegimen" → "ABVD Regimen"
 *   - Numbers:  "Grade3a" → "Grade 3a" (handled above, but also here)
 *   - Mixed:    "InvasiveBreastCarcinomaOfNoSpecialType" →
 *               "Invasive Breast Carcinoma Of No Special Type"
 */
function splitCamelCase(str) {
  return str
    // Insert space before uppercase letter preceded by lowercase
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Insert space before uppercase letter followed by lowercase, when preceded by uppercase
    // e.g. "ABVDRegimen" → "ABVD Regimen"
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    // Insert space between letter and digit
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    // Insert space between digit and uppercase letter
    .replace(/(\d)([A-Z])/g, '$1 $2');
}


// ──────────────────────────────────────────────────────────────────────
// 5. MAIN ENTRY POINT
// ──────────────────────────────────────────────────────────────────────

/**
 * Convert a raw classUri or label to a human-readable display name.
 *
 * @param {string} raw       - The classUri or label value
 * @param {string} [source]  - Optional context: attribute_name, dpheGroup,
 *                              or omop source ('gender', 'cancer', etc.)
 * @returns {string}         - Human-readable display name
 */
export function toDisplayName(raw, source) {
  if (raw == null || raw === '') return '';

  const trimmed = raw.trim();

  // --- Check explicit overrides first ---
  const explicit = EXPLICIT[trimmed];
  if (explicit) {
    if (typeof explicit === 'string') return explicit;
    // Context-sensitive: { gender: 'Female', cancer: 'Melanoma' }
    if (source && explicit[source]) return explicit[source];
    // If no source match, return first value as fallback
    const fallback = Object.values(explicit)[0];
    if (fallback) return fallback;
  }

  // --- Clockface ---
  const clock = tryClockface(trimmed);
  if (clock) return clock;

  // --- Overall stage (Stage + roman numerals) ---
  const stage = tryOverallStage(trimmed);
  if (stage) return stage;

  // --- TNM stage findings ---
  const tnm = tryTNMStage(trimmed);
  if (tnm) return tnm;

  // --- Grade numeric ---
  if (/^Grade\w+$/.test(trimmed) && source && source.startsWith('Grade')) {
    const grade = tryGrade(trimmed);
    if (grade) return grade;
  }

  // --- Decode URI encoding ---
  let decoded = trimmed;
  for (const [token, replacement] of URI_DECODE) {
    // Use split/join for global replacement (no regex escaping needed)
    decoded = decoded.split(token).join(replacement);
  }

  // --- Clean up leading 'n_' prefix (used in clockface, shouldn't reach here) ---
  if (decoded.startsWith('n_')) {
    decoded = decoded.slice(2);
  }

  // --- Replace remaining underscores with hyphens ---
  // After URI decoding, any leftover underscores are word joiners
  // e.g. Intra_Abdominal → Intra-Abdominal
  decoded = decoded.replace(/_/g, '-');

  // --- Split CamelCase ---
  decoded = splitCamelCase(decoded);

  // --- Clean up artifacts ---
  decoded = decoded
    .replace(/\s+/g, ' ')         // collapse multiple spaces
    .replace(/\(\s+/g, '(')       // no space after open paren
    .replace(/\s+\)/g, ')')       // no space before close paren
    .replace(/\s*\+\s*$/g, '+')   // trailing plus (e.g. IHC 2+)
    .trim();

  return decoded;
}


// ──────────────────────────────────────────────────────────────────────
// 6. BATCH HELPERS — for building lookup tables at init time
// ──────────────────────────────────────────────────────────────────────

/**
 * Build a Map of raw → displayName for an array of attribute rows.
 * Each row should have { attribute_name, classUri }.
 */
export function buildAttributeDisplayMap(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.attribute_name}::${row.classUri}`;
    if (!map.has(key)) {
      map.set(key, {
        attribute_name: row.attribute_name,
        classUri: row.classUri,
        displayName: toDisplayName(row.classUri, row.attribute_name),
      });
    }
  }
  return map;
}

/**
 * Build a Map of raw → displayName for OMOP demographic values.
 * Each row should have { source, label }.
 */
export function buildOmopDisplayMap(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.source}::${row.label}`;
    if (!map.has(key)) {
      map.set(key, {
        source: row.source,
        label: row.label,
        displayName: toDisplayName(row.label, row.source),
      });
    }
  }
  return map;
}


// ──────────────────────────────────────────────────────────────────────
// 7. SUMMARY SENTENCE BUILDER
//    Generates "122 female patients with Stage I breast cancer and
//    axillary lymph node involvement" from active filter state.
// ──────────────────────────────────────────────────────────────────────

/**
 * Generate a natural-language summary of active filters.
 *
 * @param {number} count - Number of patients in cohort
 * @param {Object} filters - Active filters keyed by facet name, e.g.:
 *   {
 *     gender: ['F'],
 *     cancer: ['B'],
 *     'Stage': ['StageI'],
 *     'Lymph Involvement': ['AxillaryLymphNode'],
 *   }
 * @returns {string}
 */
export function buildSummary(count, filters) {
  const parts = [];

  // Gender → adjective form
  const genders = filters.gender || filters.Gender || [];
  const genderStr = genders.length === 1
    ? { F: 'female', M: 'male' }[genders[0]] || ''
    : '';

  // Start: "122 female patients"
  parts.push(`${count.toLocaleString()} ${genderStr} patient${count !== 1 ? 's' : ''}`.replace(/\s+/g, ' '));

  const withParts = [];

  // Cancer type
  const cancers = filters.cancer || filters.Cancer || [];
  if (cancers.length) {
    withParts.push(cancers.map(c => toDisplayName(c, 'cancer').toLowerCase()).join(', '));
  }

  // Stage
  const stages = filters.Stage || filters.stage || [];
  if (stages.length) {
    withParts.push(stages.map(s => toDisplayName(s, 'Stage')).join(', '));
  }

  // All other attribute filters
  const skipKeys = new Set(['gender', 'Gender', 'cancer', 'Cancer', 'Stage', 'stage', 'age_at_dx']);
  for (const [facet, values] of Object.entries(filters)) {
    if (skipKeys.has(facet)) continue;
    if (!values || values.length === 0) continue;
    const names = values.map(v => toDisplayName(v, facet).toLowerCase());
    withParts.push(names.join(', '));
  }

  if (withParts.length > 0) {
    const last = withParts.pop();
    const joined = withParts.length
      ? withParts.join(', ') + ', and ' + last
      : last;
    parts.push('with ' + joined);
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
