'use strict';

const OBVIOUS_NON_ENGLISH_SCRIPT_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Armenian}\p{Script=Georgian}\p{Script=Ethiopic}\p{Script=Myanmar}\p{Script=Khmer}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Lao}\p{Script=Greek}]/u;

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildEnglishOnlyOutputRuleBlock() {
  return [
    '**ENGLISH-ONLY OUTPUT RULE**',
    '- Think in English.',
    '- Write every model-authored output field in English only.',
    '- Keep summaries, reasoning, notes, labels, findings, suggestions, and any other explanatory text in English only.',
    '- If the source media contains non-English spoken words, lyrics, or on-screen text, preserve those only when the schema requires a literal quote/transcription/extracted source string.',
    '- Any surrounding explanation, summary, reasoning, translation, label, or note must still be in English.',
    '- Do not switch languages, mix languages, or translate the final artifact into another language.',
    '- If you are unsure, default to English for all non-literal text.'
  ].join('\n');
}

function hasObviousNonEnglishText(value) {
  const normalized = compactString(value);
  if (!normalized) return false;
  return OBVIOUS_NON_ENGLISH_SCRIPT_RE.test(normalized.normalize('NFKC'));
}

function pushEnglishOnlyError(errors, path, label, value) {
  if (!Array.isArray(errors)) return;
  if (!hasObviousNonEnglishText(value)) return;
  errors.push({
    path,
    code: 'english_only_required',
    message: `${label} must be written in English only unless this field is reserved for literal source-authentic quoted or transcribed content.`
  });
}

module.exports = {
  buildEnglishOnlyOutputRuleBlock,
  hasObviousNonEnglishText,
  pushEnglishOnlyError
};
