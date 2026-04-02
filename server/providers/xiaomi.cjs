#!/usr/bin/env node

const axios = require('axios');
const { processAttachment } = require('ai-providers/utils/file-utils.cjs');
const {
  DEFAULT_DEBUG_BODY_MAX_CHARS,
  redactString,
  safeJsonSnippet,
  sanitizeRequestMeta,
  buildDebugPayload,
  attachDebug,
  buildProviderExchange,
  createNoContentError,
  wrapTransportError: wrapTransportErrorShared,
} = require('ai-providers/utils/provider-debug.cjs');

const name = 'xiaomi';
const DEFAULT_BASE_URL = 'https://api.xiaomimimo.com/v1';
const DEFAULT_TRANSPORT_TIMEOUT_MS = 120000;
const DEFAULT_VIDEO_FPS = 2;
const DEFAULT_VIDEO_MEDIA_RESOLUTION = 'default';
const VALID_AUTH_MODES = new Set(['bearer', 'api-key']);
const VALID_VIDEO_MEDIA_RESOLUTIONS = new Set(['default', 'max']);
const DEBUG_BODY_MAX_CHARS = DEFAULT_DEBUG_BODY_MAX_CHARS;

const MAX_INLINE_BYTES = Object.freeze({
  image: 10 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
  video: 10 * 1024 * 1024
});

const capabilities = Object.freeze({
  media: {
    image: {
      inline: { supported: true, maxBytes: 10 * 1024 * 1024 },
      url: { supported: true, maxBytes: 10 * 1024 * 1024, urlTypes: ['public', 'presigned'] }
    },
    audio: {
      inline: { supported: true, maxBytes: 10 * 1024 * 1024 },
      url: { supported: true, maxBytes: 100 * 1024 * 1024, urlTypes: ['public', 'presigned'] }
    },
    video: {
      inline: { supported: true, maxBytes: 10 * 1024 * 1024 },
      url: { supported: true, maxBytes: 300 * 1024 * 1024, urlTypes: ['public', 'presigned'] }
    },
    file: {
      inline: { supported: false, maxBytes: 0 },
      url: { supported: false, maxBytes: 0, urlTypes: [] }
    }
  }
});

function compactString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function createCapabilityError(message, extra = {}) {
  const error = new Error(`Xiaomi: ${message}`);
  error.code = 'CAPABILITY_MISMATCH';
  error.aiTargets = {
    classification: 'capability',
    ...((extra && typeof extra === 'object' && extra.aiTargets) || {})
  };
  if (extra && typeof extra === 'object') {
    error.details = extra.details || null;
  }
  return error;
}

function normalizeAttachmentInput(attachment = {}) {
  if (!attachment || typeof attachment !== 'object') {
    return attachment;
  }

  if (attachment.data === undefined && typeof attachment.base64 === 'string') {
    return {
      ...attachment,
      data: attachment.base64
    };
  }

  return attachment;
}

function normalizeAuthMode(options = {}) {
  const explicit = compactString(options?.options?.authMode).toLowerCase();
  if (VALID_AUTH_MODES.has(explicit)) {
    return explicit;
  }

  const envMode = compactString(process.env.XIAOMI_AUTH_MODE).toLowerCase();
  if (VALID_AUTH_MODES.has(envMode)) {
    return envMode;
  }

  return 'bearer';
}

function buildHeaders({ apiKey, authMode }) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (authMode === 'api-key') {
    headers['api-key'] = apiKey;
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

function parseTimeout(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : undefined;
}

function getTransportTimeoutMs(options = {}) {
  return parseTimeout(options?.options?.timeoutMs)
    ?? parseTimeout(process.env.XIAOMI_TIMEOUT_MS)
    ?? DEFAULT_TRANSPORT_TIMEOUT_MS;
}

function shouldUseTwinTransport() {
  return process.env.NODE_ENV === 'test' || !!process.env.DIGITAL_TWIN_MODE;
}

function ensureInlineBudget({ type, processedAttachment }) {
  if (processedAttachment?.isUrl) {
    return;
  }

  const maxBytes = MAX_INLINE_BYTES[type];
  if (!maxBytes) return;

  const base64Data = compactString(processedAttachment?.base64Data);
  const estimatedBytes = Buffer.byteLength(base64Data, 'utf8');
  if (estimatedBytes > maxBytes) {
    throw createCapabilityError(`${type} inline payload exceeds Xiaomi base64 budget (${estimatedBytes} > ${maxBytes} bytes).`, {
      details: { type, estimatedBytes, maxBytes }
    });
  }
}

function toDataUrl(mimeType, base64Data) {
  return `data:${mimeType};base64,${base64Data}`;
}

function resolveVideoOption(name, attachment, providerOptions, fallback) {
  const attachmentValue = attachment?.metadata?.[name] ?? attachment?.[name];
  if (attachmentValue !== undefined && attachmentValue !== null && attachmentValue !== '') {
    return attachmentValue;
  }
  if (providerOptions?.[name] !== undefined && providerOptions?.[name] !== null && providerOptions?.[name] !== '') {
    return providerOptions[name];
  }
  return fallback;
}

async function buildAttachmentPart(attachment, providerOptions = {}) {
  const normalizedAttachment = normalizeAttachmentInput(attachment);
  const processedAttachment = await processAttachment(normalizedAttachment);
  const mimeType = compactString(processedAttachment?.mimeType) || normalizedAttachment?.mimeType;

  if (normalizedAttachment?.type === 'file') {
    throw createCapabilityError('file attachments are not supported by the Xiaomi OpenAI-compatible multimodal lane.');
  }

  if (!mimeType) {
    throw createCapabilityError(`attachment type "${normalizedAttachment?.type || 'unknown'}" is missing mimeType information.`);
  }

  if (normalizedAttachment?.type === 'image') {
    ensureInlineBudget({ type: 'image', processedAttachment });
    return {
      type: 'image_url',
      image_url: {
        url: processedAttachment.isUrl ? processedAttachment.url : toDataUrl(mimeType, processedAttachment.base64Data)
      }
    };
  }

  if (normalizedAttachment?.type === 'audio') {
    ensureInlineBudget({ type: 'audio', processedAttachment });
    return {
      type: 'input_audio',
      input_audio: {
        data: processedAttachment.isUrl ? processedAttachment.url : toDataUrl(mimeType, processedAttachment.base64Data)
      }
    };
  }

  if (normalizedAttachment?.type === 'video') {
    ensureInlineBudget({ type: 'video', processedAttachment });

    const fps = Number(resolveVideoOption('fps', normalizedAttachment, providerOptions, DEFAULT_VIDEO_FPS));
    if (!Number.isFinite(fps) || fps <= 0) {
      throw createCapabilityError(`invalid fps value "${resolveVideoOption('fps', normalizedAttachment, providerOptions, DEFAULT_VIDEO_FPS)}".`);
    }

    const mediaResolution = compactString(resolveVideoOption('media_resolution', normalizedAttachment, providerOptions, DEFAULT_VIDEO_MEDIA_RESOLUTION)).toLowerCase();
    if (!VALID_VIDEO_MEDIA_RESOLUTIONS.has(mediaResolution)) {
      throw createCapabilityError(`invalid media_resolution value "${mediaResolution}".`);
    }

    return {
      type: 'video_url',
      video_url: {
        url: processedAttachment.isUrl ? processedAttachment.url : toDataUrl(mimeType, processedAttachment.base64Data)
      },
      fps,
      media_resolution: mediaResolution
    };
  }

  throw createCapabilityError(`unsupported attachment type "${normalizedAttachment?.type || 'unknown'}".`);
}

function normalizeContentPart(part) {
  if (typeof part === 'string') {
    return { type: 'text', text: part };
  }

  if (!part || typeof part !== 'object') {
    return part;
  }

  if (typeof part.type === 'string') {
    return part;
  }

  if (typeof part.text === 'string') {
    return { type: 'text', text: part.text };
  }

  return part;
}

function normalizeMessages(prompt) {
  return prompt.map((message) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      return { role: 'user', content: [{ type: 'text', text: String(message || '') }] };
    }

    let content = message.content;
    if (typeof content === 'string') {
      content = [{ type: 'text', text: content }];
    } else if (Array.isArray(content)) {
      content = content.map(normalizeContentPart);
    } else if (content && typeof content === 'object') {
      content = [normalizeContentPart(content)];
    } else {
      content = [];
    }

    return {
      ...message,
      role: compactString(message.role) || 'user',
      content
    };
  });
}

async function buildMessages({ prompt, attachments = [], options = {} }) {
  const attachmentParts = [];
  for (const attachment of attachments || []) {
    attachmentParts.push(await buildAttachmentPart(attachment, options));
  }

  if (Array.isArray(prompt)) {
    const messages = normalizeMessages(prompt);

    if (attachmentParts.length > 0) {
      let targetMessage = null;
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index]?.role === 'user') {
          targetMessage = messages[index];
          break;
        }
      }

      if (!targetMessage) {
        messages.push({ role: 'user', content: [] });
        targetMessage = messages[messages.length - 1];
      }

      targetMessage.content = Array.isArray(targetMessage.content) ? targetMessage.content : [];
      targetMessage.content.push(...attachmentParts);
    }

    return messages;
  }

  const content = [];
  if (prompt !== undefined && prompt !== null && String(prompt).length > 0) {
    content.push({ type: 'text', text: String(prompt) });
  }
  content.push(...attachmentParts);

  return [{ role: 'user', content }];
}

function resolveMaxCompletionTokens(providerOptions = {}) {
  if (providerOptions.max_completion_tokens !== undefined) {
    return providerOptions.max_completion_tokens;
  }
  if (providerOptions.maxTokens !== undefined) {
    return providerOptions.maxTokens;
  }
  if (providerOptions.max_tokens !== undefined) {
    return providerOptions.max_tokens;
  }
  return undefined;
}

async function buildRequest(options) {
  const {
    prompt,
    model,
    apiKey,
    baseUrl = DEFAULT_BASE_URL,
    attachments = [],
    options: providerOptions = {},
  } = options;

  const messages = await buildMessages({ prompt, attachments, options: providerOptions });
  const requestBody = {
    model,
    messages,
  };

  if (providerOptions.temperature !== undefined) {
    requestBody.temperature = providerOptions.temperature;
  }

  const maxCompletionTokens = resolveMaxCompletionTokens(providerOptions);
  if (maxCompletionTokens !== undefined) {
    requestBody.max_completion_tokens = maxCompletionTokens;
  }

  const authMode = normalizeAuthMode(options);
  const normalizedBaseUrl = compactString(baseUrl).replace(/\/$/, '') || DEFAULT_BASE_URL;

  return {
    method: 'POST',
    url: `${normalizedBaseUrl}/chat/completions`,
    headers: buildHeaders({ apiKey, authMode }),
    body: requestBody,
  };
}

function extractTextFromContent(content) {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (!part || typeof part !== 'object') return '';
        if (part.type === 'text' || part.type === 'output_text' || part.type === 'input_text') {
          return typeof part.text === 'string' ? part.text : '';
        }
        if (part.type === 'refusal') {
          return typeof part.refusal === 'string' ? part.refusal : '';
        }
        return '';
      })
      .filter(Boolean);

    return parts.join('');
  }

  if (content && typeof content === 'object') {
    if (content.type === 'text' || content.type === 'output_text' || content.type === 'input_text') {
      return typeof content.text === 'string' ? content.text : '';
    }
    if (content.type === 'refusal') {
      return typeof content.refusal === 'string' ? content.refusal : '';
    }
  }

  return '';
}

function transformResponse(axiosResponse, request) {
  const data = axiosResponse.data;
  const choice = data?.choices?.[0] || {};
  const message = choice.message || {};
  const content = extractTextFromContent(message.content);
  const usage = data?.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const exchange = buildProviderExchange(request, axiosResponse);

  if (!content) {
    const err = createNoContentError({
      provider: name,
      request,
      axiosResponse,
      message: 'Xiaomi: No content in response',
    });
    attachDebug(err, buildDebugPayload({ provider: name, request, axiosResponse, maxBodyChars: DEBUG_BODY_MAX_CHARS }));
    throw err;
  }

  return {
    content,
    usage: {
      input: usage.prompt_tokens || 0,
      output: usage.completion_tokens || 0,
      total: usage.total_tokens || 0,
    },
    ...exchange,
  };
}

function wrapTransportError(err, request) {
  return wrapTransportErrorShared(err, { provider: name, request });
}

async function runRequest(request, transportOptions = {}) {
  try {
    const response = await axios({
      method: request.method,
      url: request.url,
      headers: request.headers,
      data: request.body,
      timeout: getTransportTimeoutMs(transportOptions),
    });

    return transformResponse(response, request);
  } catch (err) {
    throw wrapTransportError(err, request);
  }
}

function makeRealTransport(options) {
  return async (request) => runRequest(request, options);
}

async function complete(options) {
  if (!options?.prompt) {
    throw new Error('Xiaomi: prompt is required');
  }
  if (!options?.model) {
    throw new Error('Xiaomi: model is required');
  }
  if (!options?.apiKey) {
    throw new Error('Xiaomi: apiKey is required');
  }

  const request = await buildRequest(options);

  if (shouldUseTwinTransport()) {
    const { createTwinTransport } = require('digital-twin-router');
    if (!process.env.DIGITAL_TWIN_PACK) {
      throw new Error('DIGITAL_TWIN_PACK environment variable must be set when using digital twin transport');
    }

    const transport = createTwinTransport({
      mode: process.env.DIGITAL_TWIN_MODE,
      twinPack: process.env.DIGITAL_TWIN_PACK,
      realTransport: makeRealTransport(options),
      engineOptions: { normalizerOptions: { ignoreQuery: true } },
    });

    try {
      return await transport.complete(request);
    } catch (err) {
      throw wrapTransportError(err, request);
    }
  }

  return runRequest(request, options);
}

function validate(config) {
  if (!config) {
    throw new Error('Xiaomi: Configuration object is required');
  }
  if (!config.apiKey) {
    throw new Error('Xiaomi: API key is required. Set XIAOMI_API_KEY or AI_API_KEY.');
  }
  if (typeof config.apiKey !== 'string' || config.apiKey.trim().length < 8) {
    throw new Error('Xiaomi: Invalid API key format');
  }
  if (config.baseUrl !== undefined && typeof config.baseUrl !== 'string') {
    throw new Error('Xiaomi: baseUrl must be a string');
  }
  const authMode = config.authMode !== undefined ? normalizeAuthMode({ options: { authMode: config.authMode } }) : null;
  if (config.authMode !== undefined && authMode !== config.authMode) {
    throw new Error('Xiaomi: authMode must be "bearer" or "api-key"');
  }
  return true;
}

module.exports = {
  name,
  capabilities,
  complete,
  validate,
  _private: {
    buildRequest,
    buildMessages,
    buildAttachmentPart,
    transformResponse,
    extractTextFromContent,
    redactString,
    safeJsonSnippet,
    buildDebugPayload,
    sanitizeRequestMeta,
    wrapTransportError,
    getTransportTimeoutMs,
    normalizeAuthMode,
    runRequest,
  },
};
