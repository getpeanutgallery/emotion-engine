const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const xiaomi = require('../../server/providers/xiaomi.cjs');

test('buildRequest normalizes staged video URLs into Xiaomi video_url parts', async () => {
  const request = await xiaomi._private.buildRequest({
    prompt: 'Analyze this full video.',
    model: 'mimo-v2-omni',
    apiKey: 'xiaomi-secret',
    attachments: [
      {
        type: 'video',
        url: 'https://example.test/video.mp4',
        mimeType: 'video/mp4'
      }
    ],
    options: {
      temperature: 0.2,
      maxTokens: 2048
    }
  });

  assert.equal(request.url, 'https://api.xiaomimimo.com/v1/chat/completions');
  assert.equal(request.headers.Authorization, 'Bearer xiaomi-secret');
  assert.equal(request.body.max_completion_tokens, 2048);
  assert.equal(request.body.messages[0].content[0].type, 'text');
  assert.deepEqual(request.body.messages[0].content[1], {
    type: 'video_url',
    video_url: { url: 'https://example.test/video.mp4' },
    fps: 2,
    media_resolution: 'default'
  });
});

test('buildRequest appends attachments onto existing user messages and supports Xiaomi api-key auth mode', async () => {
  const request = await xiaomi._private.buildRequest({
    prompt: [
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: [{ type: 'text', text: 'Describe the inputs.' }] }
    ],
    model: 'mimo-v2-omni',
    apiKey: 'xiaomi-secret',
    baseUrl: 'https://api.example.test/v1/',
    attachments: [
      {
        type: 'audio',
        url: 'https://example.test/audio.wav',
        mimeType: 'audio/wav'
      }
    ],
    options: {
      authMode: 'api-key'
    }
  });

  assert.equal(request.url, 'https://api.example.test/v1/chat/completions');
  assert.equal(request.headers['api-key'], 'xiaomi-secret');
  assert.equal(request.headers.Authorization, undefined);
  assert.deepEqual(request.body.messages[1].content[1], {
    type: 'input_audio',
    input_audio: { data: 'https://example.test/audio.wav' }
  });
});

test('buildRequest converts inline audio files to Xiaomi data URLs', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaomi-provider-'));
  const audioPath = path.join(tempDir, 'sample.wav');
  fs.writeFileSync(audioPath, 'small-audio-payload');

  try {
    const request = await xiaomi._private.buildRequest({
      prompt: 'Transcribe this clip.',
      model: 'mimo-v2-omni',
      apiKey: 'xiaomi-secret',
      attachments: [
        {
          type: 'audio',
          path: audioPath,
          mimeType: 'audio/wav'
        }
      ]
    });

    const audioPart = request.body.messages[0].content[1];
    assert.equal(audioPart.type, 'input_audio');
    assert.match(audioPart.input_audio.data, /^data:audio\/wav;base64,/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('buildRequest rejects unsupported file attachments as capability mismatches', async () => {
  await assert.rejects(() => xiaomi._private.buildRequest({
    prompt: 'Analyze this file.',
    model: 'mimo-v2-omni',
    apiKey: 'xiaomi-secret',
    attachments: [
      {
        type: 'file',
        url: 'https://example.test/doc.pdf',
        mimeType: 'application/pdf'
      }
    ]
  }), (error) => {
    assert.equal(error.code, 'CAPABILITY_MISMATCH');
    assert.equal(error.aiTargets.classification, 'capability');
    assert.match(error.message, /file attachments are not supported/);
    return true;
  });
});

test('getTransportTimeoutMs prefers explicit option over environment fallback', () => {
  const original = process.env.XIAOMI_TIMEOUT_MS;
  process.env.XIAOMI_TIMEOUT_MS = '45000';

  try {
    assert.equal(xiaomi._private.getTransportTimeoutMs({ options: { timeoutMs: 12000 } }), 12000);
    assert.equal(xiaomi._private.getTransportTimeoutMs({ options: {} }), 45000);
  } finally {
    if (original === undefined) {
      delete process.env.XIAOMI_TIMEOUT_MS;
    } else {
      process.env.XIAOMI_TIMEOUT_MS = original;
    }
  }
});

test('transformResponse preserves provider exchange metadata', () => {
  const request = {
    method: 'POST',
    url: 'https://api.xiaomimimo.com/v1/chat/completions',
    headers: {
      Authorization: 'Bearer secret',
      'Content-Type': 'application/json'
    },
    body: {
      model: 'mimo-v2-omni',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'hello' }]
        }
      ]
    }
  };
  const axiosResponse = {
    status: 200,
    headers: { 'x-request-id': 'req_xiaomi_123' },
    data: {
      choices: [{ message: { content: 'hello back' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    }
  };

  const response = xiaomi._private.transformResponse(axiosResponse, request);
  assert.equal(response.content, 'hello back');
  assert.equal(response.providerRequest.body.model, 'mimo-v2-omni');
  assert.equal(response.providerResponse.body.usage.total_tokens, 30);
});
