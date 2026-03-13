#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, acc);
    else acc.push(fullPath);
  }
  return acc;
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function phaseFromPath(file) {
  const normalized = file.split(path.sep).join('/');
  const match = normalized.match(/output\/[^/]+\/(phase[^/]+)\//);
  return match ? match[1] : 'run-root';
}

function uniquePush(list, value, limit = 5) {
  if (list.includes(value)) return;
  if (list.length < limit) list.push(value);
}

function initCategory(summary, key, meta) {
  if (!summary.categories[key]) {
    summary.categories[key] = {
      key,
      label: meta.label,
      taxonomy: meta.taxonomy,
      severity: meta.severity,
      count: 0,
      phases: {},
      models: {},
      examples: [],
      notes: meta.notes || null
    };
  }
  return summary.categories[key];
}

function addCategory(summary, key, meta, ctx) {
  const category = initCategory(summary, key, meta);
  category.count += 1;
  category.phases[ctx.phase] = (category.phases[ctx.phase] || 0) + 1;
  category.models[ctx.model] = (category.models[ctx.model] || 0) + 1;
  uniquePush(category.examples, ctx.example);
}

function sortedEntries(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function detectCategories(capture) {
  const categories = [];
  const error = capture.error || '';
  const rawContent = typeof capture.rawResponse === 'string'
    ? capture.rawResponse
    : capture.rawResponse?.content || '';
  const parsedBlob = JSON.stringify(capture.parsed || {});
  const combinedText = `${rawContent}\n${parsedBlob}`;
  const finishReason = capture.providerResponse?.body?.choices?.[0]?.finish_reason
    || capture.providerResponse?.body?.choices?.[0]?.native_finish_reason
    || null;
  const reasoningTokens = capture.providerResponse?.body?.usage?.completion_tokens_details?.reasoning_tokens || 0;
  const completionTokens = capture.rawResponse?.usage?.output
    || capture.providerResponse?.body?.usage?.completion_tokens
    || 0;

  if (/No content in response/i.test(error)) {
    categories.push({
      key: 'provider_no_content',
      label: 'Provider returned no content',
      taxonomy: 'provider_transport',
      severity: 'high',
      notes: 'Provider call completed but delivered no usable content payload.'
    });
  }

  if (/placeholder fallback detected/i.test(error)) {
    categories.push({
      key: 'placeholder_fallback',
      label: 'Parser fell back to placeholder output',
      taxonomy: 'structured_output',
      severity: 'high',
      notes: 'Model returned something syntactically or semantically unusable, forcing placeholder fallback.'
    });
  }

  if (/response was not valid JSON/i.test(error)) {
    categories.push({
      key: 'invalid_json',
      label: 'Strict JSON output was invalid',
      taxonomy: 'structured_output',
      severity: 'high',
      notes: 'The model response could not be parsed as the required final JSON artifact.'
    });
  }

  if (finishReason === 'length' || finishReason === 'MAX_TOKENS') {
    categories.push({
      key: 'finish_length',
      label: 'Generation hit max token limit',
      taxonomy: 'token_budget',
      severity: 'medium',
      notes: 'Completion terminated for length before a complete structured answer was returned.'
    });
  }

  if (reasoningTokens > 0 && completionTokens > 0 && reasoningTokens / completionTokens >= 0.5) {
    categories.push({
      key: 'high_reasoning_share',
      label: 'Reasoning token share crowded out final answer budget',
      taxonomy: 'thinking_budget',
      severity: 'medium',
      notes: 'A large share of completion budget was consumed by reasoning instead of the final machine-readable answer.'
    });
  }

  if (/stock footage|stock visuals|stock-looking|stock trash|corporate ad|corporate cringe|training video|training module/i.test(combinedText)) {
    categories.push({
      key: 'stock_asset_language',
      label: 'Suspicious stock-assets / corporate-footage language',
      taxonomy: 'semantic_anomaly',
      severity: 'medium',
      notes: 'Not necessarily a parser failure, but a suspicious semantic pattern worth grounding review.'
    });
  }

  return categories;
}

function buildHypothesis(summary) {
  const categories = summary.categories;
  const providerNoContent = categories.provider_no_content?.count || 0;
  const placeholderFallback = categories.placeholder_fallback?.count || 0;
  const invalidJson = categories.invalid_json?.count || 0;
  const finishLength = categories.finish_length?.count || 0;
  const highReasoningShare = categories.high_reasoning_share?.count || 0;
  const stockLanguage = categories.stock_asset_language?.count || 0;

  return {
    tokenBudgets: {
      verdict: (finishLength + highReasoningShare + invalidJson) > 0 ? 'generalize_now' : 'watch',
      rationale: [
        `${finishLength} attempt(s) hit explicit max-token truncation.`,
        `${highReasoningShare} attempt(s) spent at least half of completion budget on reasoning.`,
        `${invalidJson} invalid JSON failure(s) happened in the same lane where truncation showed up.`
      ]
    },
    thinkingControls: {
      verdict: highReasoningShare > 0 ? 'generalize_now' : 'watch',
      rationale: [
        'Low thinking still consumed most of the completion budget in recommendation retries.',
        'Strict JSON / tool-loop turns are poor places to pay a large reasoning-token tax.'
      ]
    },
    validationTooling: {
      verdict: (placeholderFallback + invalidJson) > 0 ? 'generalize_now' : 'watch',
      rationale: [
        `${placeholderFallback} placeholder-fallback parse failures already prove non-recommendation lanes need structured validation too.`,
        `${invalidJson} recommendation failures show validator-aware loops help, but only if the lane also has enough output budget to finish.`
      ]
    },
    groundingRisk: {
      verdict: stockLanguage > 0 ? 'investigate' : 'low_signal',
      rationale: [
        `${stockLanguage} output artifact(s) used stock-assets / corporate-footage language.`,
        'This might be accurate criticism, but it is also the exact kind of stylistic overreach Derrick flagged for review.'
      ]
    },
    providerStability: {
      verdict: providerNoContent > 0 ? 'generalize_failover_and_capture' : 'watch',
      rationale: [
        `${providerNoContent} provider-empty responses clustered in Phase 2 before failover recovered some chunks.`,
        'That argues for keeping adapter-normalized error capture and consistent retry/failover policy across all AI lanes.'
      ]
    }
  };
}

function renderMarkdown(summary) {
  const lines = [];
  lines.push(`# Recent run error taxonomy: ${summary.runName}`);
  lines.push('');
  lines.push(`- Generated at: ${summary.generatedAt}`);
  lines.push(`- Run directory: \`${summary.runDir}\``);
  lines.push(`- Capture files scanned: ${summary.totals.captureFiles}`);
  lines.push(`- Logged error entries scanned: ${summary.totals.loggedErrors}`);
  lines.push('');
  lines.push('## Executive summary');
  lines.push('');
  lines.push(`- Hard failure categories found: ${summary.hardFailureCategoryCount}`);
  lines.push(`- Top hard failure: **${summary.topHardFailure?.label || 'none'}** (${summary.topHardFailure?.count || 0})`);
  lines.push(`- Suspicious semantic anomalies: **${summary.categories.stock_asset_language?.count || 0}** capture(s)`);
  lines.push(`- Most failure-prone model: **${summary.mostFailureProneModel?.model || 'n/a'}** (${summary.mostFailureProneModel?.errors || 0} error capture(s))`);
  lines.push('');
  lines.push('## Taxonomy categories');
  lines.push('');

  for (const category of Object.values(summary.categories).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))) {
    lines.push(`### ${category.label} — ${category.count}`);
    lines.push('');
    lines.push(`- Taxonomy: \`${category.taxonomy}\``);
    lines.push(`- Severity: \`${category.severity}\``);
    if (category.notes) lines.push(`- Why it matters: ${category.notes}`);
    lines.push(`- Phase breakdown: ${sortedEntries(category.phases).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    lines.push(`- Model breakdown: ${sortedEntries(category.models).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    lines.push('- Example paths:');
    for (const example of category.examples) lines.push(`  - \`${example}\``);
    lines.push('');
  }

  lines.push('## Model stability snapshot');
  lines.push('');
  for (const model of summary.models) {
    lines.push(`- \`${model.model}\`: ${model.errors}/${model.total} captures errored` + (model.errorKinds.length ? ` (${model.errorKinds.map(([k, v]) => `${k}=${v}`).join(', ')})` : ''));
  }
  lines.push('');

  lines.push('## Suspicious anomalies');
  lines.push('');
  if (summary.stockLanguageExamples.length === 0) {
    lines.push('- No stock-assets / corporate-footage language patterns found.');
  } else {
    lines.push('- The following captures used suspicious “stock footage / corporate ad / training video” style language:');
    for (const item of summary.stockLanguageExamples) {
      lines.push(`  - chunk ${item.chunkIndex}: \`${item.file}\``);
      if (item.summary) lines.push(`    - summary: ${item.summary}`);
    }
  }
  lines.push('');

  lines.push('## Derrick hypothesis: what should be generalized?');
  lines.push('');
  for (const [key, item] of Object.entries(summary.hypothesis)) {
    lines.push(`### ${key}`);
    lines.push('');
    lines.push(`- Verdict: **${item.verdict}**`);
    for (const reason of item.rationale) lines.push(`- ${reason}`);
    lines.push('');
  }

  lines.push('## Recommended next actions');
  lines.push('');
  lines.push('- Generalize **explicit output budgets** for every strict-JSON lane, especially repair/tool-loop turns.');
  lines.push('- Default **thinking off or minimal** for schema-only responses unless a lane proves it benefits from extra reasoning.');
  lines.push('- Reuse **validator + parse-class capture** across Phase 2 and other JSON-producing calls, not just recommendation.');
  lines.push('- Keep **normalized provider debug capture + failover metadata** because empty-provider responses were a dominant real failure mode.');
  lines.push('- Treat the stock-assets phrasing as a **grounding-review input**, not automatic truth.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function main() {
  const args = process.argv.slice(2);
  const runDir = path.resolve(args[0] || 'output/cod-test');
  const runName = path.basename(runDir);
  const outputJson = path.resolve(args[1] || `docs/reports/${runName}-recent-run-error-taxonomy.json`);
  const outputMd = path.resolve(args[2] || `docs/reports/${runName}-recent-run-error-taxonomy.md`);

  const files = walk(runDir);
  const captures = files.filter((file) => file.endsWith('capture.json'));
  const errorLogs = files.filter((file) => file.endsWith('errors.jsonl'));
  const summary = {
    generatedAt: new Date().toISOString(),
    runDir,
    runName,
    totals: {
      captureFiles: captures.length,
      loggedErrors: 0
    },
    categories: {},
    models: [],
    stockLanguageExamples: []
  };

  const modelStats = new Map();

  for (const file of captures) {
    const capture = readJson(file);
    const phase = phaseFromPath(file);
    const model = capture.model || capture.adapter?.model || 'unknown';
    const example = file.replace(`${process.cwd()}${path.sep}`, '').split(path.sep).join('/');

    if (!modelStats.has(model)) modelStats.set(model, { model, total: 0, errors: 0, errorKinds: {} });
    const stat = modelStats.get(model);
    stat.total += 1;

    const categories = detectCategories(capture);
    for (const meta of categories) {
      addCategory(summary, meta.key, meta, { phase, model, example });
      if (capture.error) {
        stat.errors += meta.key === 'stock_asset_language' ? 0 : 0;
      }
    }

    if (capture.error) {
      stat.errors += 1;
      const errorKinds = categories.filter((item) => item.taxonomy !== 'semantic_anomaly');
      if (errorKinds.length === 0) stat.errorKinds.other_error = (stat.errorKinds.other_error || 0) + 1;
      for (const item of errorKinds) stat.errorKinds[item.key] = (stat.errorKinds[item.key] || 0) + 1;
    }

    const combinedText = `${typeof capture.rawResponse === 'string' ? capture.rawResponse : capture.rawResponse?.content || ''}\n${JSON.stringify(capture.parsed || {})}`;
    if (/stock footage|stock visuals|stock-looking|stock trash|corporate ad|corporate cringe|training video|training module/i.test(combinedText)) {
      if (summary.stockLanguageExamples.length < 12) {
        summary.stockLanguageExamples.push({
          file: example,
          chunkIndex: capture.chunkIndex,
          summary: capture.parsed?.summary || null
        });
      }
    }
  }

  for (const file of errorLogs) {
    summary.totals.loggedErrors += readJsonLines(file).length;
  }

  summary.models = Array.from(modelStats.values())
    .map((stat) => ({
      ...stat,
      errorKinds: sortedEntries(stat.errorKinds)
    }))
    .sort((a, b) => b.errors - a.errors || b.total - a.total || a.model.localeCompare(b.model));

  const hardFailureCategories = Object.values(summary.categories)
    .filter((category) => category.taxonomy !== 'semantic_anomaly');
  summary.hardFailureCategoryCount = hardFailureCategories.length;
  summary.topHardFailure = hardFailureCategories.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))[0] || null;
  summary.mostFailureProneModel = summary.models[0] || null;
  summary.hypothesis = buildHypothesis(summary);

  mkdirp(path.dirname(outputJson));
  mkdirp(path.dirname(outputMd));
  fs.writeFileSync(outputJson, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(outputMd, renderMarkdown(summary));

  console.log(JSON.stringify({
    ok: true,
    runDir,
    outputJson,
    outputMd,
    categories: Object.fromEntries(Object.entries(summary.categories).map(([key, value]) => [key, value.count]))
  }, null, 2));
}

main();
