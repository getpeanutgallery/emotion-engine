#!/usr/bin/env node

// Minimal repro: OpenRouter transcription request returning HTTP 404, recorded as a cassette.
//
// Notes:
// - Uses emotion-engine get-dialogue script (real transcription path).
// - Uses DIGITAL_TWIN_* env vars for cassette naming/pack selection.
// - digital-twin-router only records successful requests; axios throws on 404.
//   So we manually record the failed HTTP response into the cassette.

const path = require('path');
const fs = require('fs');

// Load emotion-engine .env without printing secrets
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const { TwinStore, TwinEngine } = require('digital-twin-core');
const getDialogue = require(path.join(process.cwd(), 'server/scripts/get-context/get-dialogue.cjs'));

function resolveStoreDir(twinPackPath) {
  if (!twinPackPath) throw new Error('DIGITAL_TWIN_PACK is required');
  const abs = path.isAbsolute(twinPackPath) ? twinPackPath : path.resolve(process.cwd(), twinPackPath);
  const cassettesDir = path.join(abs, 'cassettes');
  if (fs.existsSync(cassettesDir) && fs.statSync(cassettesDir).isDirectory()) return cassettesDir;
  return abs;
}

function buildOpenRouterRequest({ apiKey, model, prompt, audioBase64, baseUrl = 'https://openrouter.ai/api/v1' }) {
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'input_audio', input_audio: { data: audioBase64, format: 'wav' } }
      ]
    }
  ];

  return {
    method: 'POST',
    url: `${baseUrl}/chat/completions`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: { model, messages }
  };
}

(async () => {
  const twinPack = process.env.DIGITAL_TWIN_PACK;
  const cassetteId = process.env.DIGITAL_TWIN_CASSETTE;
  const mode = process.env.DIGITAL_TWIN_MODE;

  if (mode !== 'record') throw new Error(`Expected DIGITAL_TWIN_MODE=record, got: ${mode}`);
  if (!twinPack) throw new Error('DIGITAL_TWIN_PACK must be set');
  if (!cassetteId) throw new Error('DIGITAL_TWIN_CASSETTE must be set');

  // Prefer OPENROUTER_API_KEY, but get-dialogue requires AI_API_KEY
  const apiKey = process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Missing AI_API_KEY/OPENROUTER_API_KEY (loaded from .env)');
  process.env.AI_API_KEY = apiKey;

  // Inputs
  const assetPath = process.env.ASSET_PATH || '/tmp/openrouter-transcription-404.wav';
  const outputDir = process.env.OUTPUT_DIR || `/tmp/openrouter-transcription-404-output/${cassetteId}`;
  const model = process.env.DIALOGUE_MODEL || 'openai/whisper-large';

  const prompt = 'Transcribe the audio in this file. Respond ONLY with JSON.';
  const audioBase64 = fs.readFileSync(assetPath).toString('base64');

  // Build request for manual cassette record (normalizer will strip Authorization)
  const request = buildOpenRouterRequest({ apiKey, model, prompt, audioBase64 });

  let errorStatus = null;
  let errorDataSnippet = null;

  try {
    await getDialogue.run({
      assetPath,
      outputDir,
      config: {
        ai: { provider: 'openrouter', dialogue: { model } },
        debug: { keepTempFiles: false }
      }
    });

    console.error('UNEXPECTED: get-dialogue completed successfully (no 404).');
    process.exitCode = 2;
    return;
  } catch (err) {
    // Axios-style error from provider
    const status = err?.response?.status;
    const data = err?.response?.data;

    errorStatus = status || null;

    const dataStr = data
      ? (typeof data === 'string' ? data : JSON.stringify(data))
      : (err?.message || String(err));

    errorDataSnippet = dataStr.slice(0, 500);

    console.log('--- OpenRouter transcription failure (expected) ---');
    console.log(`HTTP status: ${errorStatus || '(unknown)'}`);
    console.log(`Error snippet: ${errorDataSnippet}`);
  }

  // Record cassette (even though request failed)
  const storeDir = resolveStoreDir(twinPack);
  const store = new TwinStore({ storeDir, createIfMissing: true });
  const engine = new TwinEngine({ store, normalizerOptions: { ignoreQuery: true } });

  const exists = await store.exists(cassetteId);
  if (exists) await engine.load(cassetteId);
  else engine.create(cassetteId, { description: 'Repro: OpenRouter transcription HTTP 404', createdBy: 'repro-openrouter-transcription-404' });

  const response = { ok: false, status: errorStatus, errorSnippet: errorDataSnippet };

  await engine.record(request, response);

  const cassettePath = path.join(storeDir, `${cassetteId}.json`);
  console.log('--- Cassette recorded ---');
  console.log(`Cassette: ${cassetteId}`);
  console.log(`Path: ${cassettePath}`);
  console.log(`Interactions: ${engine.getInteractionCount()}`);
})();
