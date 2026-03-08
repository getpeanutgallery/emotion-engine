#!/usr/bin/env node

// Minimal reproduction: OpenRouter returns HTTP 404 for the OpenAI-style transcription endpoint.
// Records the 404 into a digital-twin cassette (record mode).

const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const axios = require('axios');
const { createTwinTransport } = require('digital-twin-router');

(async () => {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY/AI_API_KEY');

  if (process.env.DIGITAL_TWIN_MODE !== 'record') {
    throw new Error('Set DIGITAL_TWIN_MODE=record');
  }
  if (!process.env.DIGITAL_TWIN_PACK) {
    throw new Error('Set DIGITAL_TWIN_PACK');
  }

  const request = {
    method: 'POST',
    url: 'https://openrouter.ai/api/v1/audio/transcriptions',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    // body shape loosely matches OpenAI transcription payload; endpoint 404s regardless.
    body: {
      model: 'whisper-1',
      // placeholder; real OpenAI expects multipart with file
      input: 'test'
    }
  };

  const realTransport = async (req) => {
    const res = await axios({
      method: req.method,
      url: req.url,
      headers: req.headers,
      data: req.body,
      // IMPORTANT: allow non-2xx through so twin transport can record 404.
      validateStatus: () => true
    });

    return {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      data: res.data
    };
  };

  const transport = createTwinTransport({
    mode: 'record',
    twinPack: process.env.DIGITAL_TWIN_PACK,
    realTransport,
    engineOptions: { normalizerOptions: { ignoreQuery: true } }
  });

  const response = await transport.complete(request);

  // Derive where the cassette was written
  const storePath = transport.getStorePath();
  const cassetteId = transport.getCassetteName();
  const storeDir = transport.getStore().storeDir;
  const cassettePath = path.join(storeDir, `${cassetteId}.json`);
  const interactionCount = transport.getEngine().getInteractionCount();

  console.log('--- OpenRouter /audio/transcriptions result ---');
  console.log(`HTTP status: ${response.status}`);
  console.log(`Response snippet: ${String(typeof response.data === 'string' ? response.data : JSON.stringify(response.data)).slice(0, 300)}`);
  console.log('--- Cassette ---');
  console.log(`Pack: ${storePath}`);
  console.log(`Cassette: ${cassetteId}`);
  console.log(`Path: ${cassettePath}`);
  console.log(`Interactions: ${interactionCount}`);
})();
