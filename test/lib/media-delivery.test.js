const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  validateMediaDeliveryConfig,
  resolveMediaAttachmentsForTarget,
  resolveVideoContextForTarget
} = require('../../server/lib/media-delivery.cjs');
const { validateConfig } = require('../../server/lib/config-loader.cjs');

function makeTargets(adapterName = 'openrouter') {
  const target = (model) => ({ adapter: { name: adapterName, model } });
  return {
    dialogue: { targets: [target('dialogue-model')] },
    music: { targets: [target('music-model')] },
    video: { targets: [target('video-model')] }
  };
}

function mergeInto(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      mergeInto(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function makeConfig(tempDir, overrides = {}) {
  const base = {
    asset: {
      inputPath: 'examples/videos/emotion-tests/cod.mp4',
      outputDir: 'output/test-media-delivery',
      media: {
        refs: {
          source_video: {
            kind: 'video',
            role: 'primary',
            source: {
              path: 'fixtures/source-video.mp4'
            },
            staged: {
              url: 'https://example.com/cod.mp4',
              urlType: 'public'
            },
            delivery: {
              preferredMode: 'url',
              allowedModes: ['url', 'inline'],
              allowFallback: true
            },
            metadata: {
              mimeType: 'video/mp4'
            }
          }
        }
      }
    },
    ai: {
      ...makeTargets(),
      video: {
        inputRefs: ['source_video'],
        targets: [{ adapter: { name: 'openrouter', model: 'video-model' } }]
      }
    },
    settings: {
      ffmpeg: {
        audio: {
          loglevel: 'error',
          codec: 'pcm_s16le',
          sample_rate_hz: 16000,
          channels: 1,
          container: 'wav'
        },
        video: {
          compress: {
            vcodec: 'libx264',
            preset: 'fast',
            max_width: 1280,
            fps: 24,
            audio_codec: 'aac',
            audio_bitrate: '128k',
            size_headroom_ratio: 0.9
          },
          compress_aggressive: {
            vcodec: 'libx264',
            preset: 'slow',
            fps: 24,
            audio_codec: 'aac',
            audio_bitrate: '96k',
            vf: "scale='min(1280,iw)':-1:force_original_aspect_ratio=decrease",
            maxrate_multiplier: 1.2,
            bufsize_multiplier: 2,
            size_headroom_ratio: 0.95
          }
        }
      }
    },
    process: ['script1.cjs']
  };

  const config = structuredClone(base);
  if (tempDir) {
    config.asset.media.refs.source_video.source.path = path.relative(tempDir, path.join(tempDir, 'fixtures', 'source-video.mp4'));
  }

  if (overrides && typeof overrides === 'object') {
    mergeInto(config, overrides);
  }

  return config;
}

function makeTempFixture(t, { sizeBytes = 10 } = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emotion-engine-media-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const fixtureDir = path.join(tempDir, 'fixtures');
  fs.mkdirSync(fixtureDir, { recursive: true });
  const filePath = path.join(fixtureDir, 'source-video.mp4');
  fs.writeFileSync(filePath, Buffer.alloc(sizeBytes, 7));

  return { tempDir, filePath };
}

function makeCapabilities({ inlineSupported = true, inlineMaxBytes = 1024, urlSupported = true, urlMaxBytes = 1024, urlTypes = ['public'] } = {}) {
  return {
    provider: 'test-provider',
    media: {
      image: {
        inline: { supported: true, maxBytes: inlineMaxBytes },
        url: { supported: urlSupported, maxBytes: urlMaxBytes, urlTypes }
      },
      audio: {
        inline: { supported: inlineSupported, maxBytes: inlineMaxBytes },
        url: { supported: false, urlTypes: [] }
      },
      video: {
        inline: { supported: inlineSupported, maxBytes: inlineMaxBytes },
        url: { supported: urlSupported, maxBytes: urlMaxBytes, urlTypes }
      }
    }
  };
}

test('validateMediaDeliveryConfig accepts a valid shared media catalog and validateConfig stays green', () => {
  const errors = validateMediaDeliveryConfig(makeConfig());
  assert.deepEqual(errors, []);

  const result = validateConfig(makeConfig());
  assert.equal(result.valid, true);
});

test('validateMediaDeliveryConfig rejects unknown refs and invalid staged URL policy', () => {
  const config = makeConfig(null, {
    asset: {
      media: {
        refs: {
          source_video: {
            staged: {
              urlType: 'signedish',
              url: 'ftp://example.com/cod.mp4'
            },
            delivery: {
              preferredMode: 'wire',
              allowedModes: ['wire']
            }
          }
        }
      }
    },
    ai: {
      video: {
        inputRefs: ['missing_ref']
      }
    }
  });

  const errors = validateMediaDeliveryConfig(config);
  assert(errors.some((entry) => entry.includes('asset.media.refs.source_video.staged.urlType')));
  assert(errors.some((entry) => entry.includes('asset.media.refs.source_video.staged.url')));
  assert(errors.some((entry) => entry.includes('asset.media.refs.source_video.delivery.preferredMode')));
  assert(errors.some((entry) => entry.includes('asset.media.refs.source_video.delivery.allowedModes')));
  assert(errors.some((entry) => entry.includes('ai.video.inputRefs[0]')));

  const result = validateConfig(config);
  assert.equal(result.valid, false);
  assert(result.errors.some((entry) => entry.includes('unknown media ref')));
});

test('resolveMediaAttachmentsForTarget prefers staged URL delivery when the provider supports it', (t) => {
  const { tempDir } = makeTempFixture(t, { sizeBytes: 10 });
  const config = makeConfig(tempDir);

  const attachments = resolveMediaAttachmentsForTarget({
    config,
    domain: 'video',
    target: config.ai.video.targets[0],
    baseDir: tempDir
  });

  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].ref, 'source_video');
  assert.equal(attachments[0].deliveryMode, 'url');
  assert.equal(attachments[0].url, 'https://example.com/cod.mp4');
  assert.equal(attachments[0].type, 'video');
});

test('resolveMediaAttachmentsForTarget falls back to inline when URL delivery is unsupported but allowed', (t) => {
  const { tempDir } = makeTempFixture(t, { sizeBytes: 10 });
  const config = makeConfig(tempDir);

  const attachments = resolveMediaAttachmentsForTarget({
    config,
    domain: 'video',
    target: config.ai.video.targets[0],
    baseDir: tempDir,
    capabilities: makeCapabilities({ inlineSupported: true, inlineMaxBytes: 1024, urlSupported: false })
  });

  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].deliveryMode, 'inline');
  assert.equal(typeof attachments[0].data, 'string');
  assert.equal(Buffer.from(attachments[0].data, 'base64').byteLength, 10);
});

test('resolveMediaAttachmentsForTarget honors per-target media overrides', (t) => {
  const { tempDir } = makeTempFixture(t, { sizeBytes: 10 });
  const config = makeConfig(tempDir, {
    ai: {
      video: {
        targets: [
          {
            adapter: {
              name: 'openrouter',
              model: 'video-model',
              media: {
                source_video: {
                  preferredMode: 'inline',
                  allowedModes: ['inline'],
                  allowFallback: false
                }
              }
            }
          }
        ]
      }
    }
  });

  const attachments = resolveMediaAttachmentsForTarget({
    config,
    domain: 'video',
    target: config.ai.video.targets[0],
    baseDir: tempDir
  });

  assert.equal(attachments[0].deliveryMode, 'inline');
  assert.equal(typeof attachments[0].data, 'string');
});

test('resolveMediaAttachmentsForTarget raises a capability mismatch when inline Base64 exceeds the provider budget', (t) => {
  const { tempDir } = makeTempFixture(t, { sizeBytes: 10 });
  const config = makeConfig(tempDir, {
    asset: {
      media: {
        refs: {
          source_video: {
            delivery: {
              preferredMode: 'inline',
              allowedModes: ['inline'],
              allowFallback: false
            }
          }
        }
      }
    }
  });

  assert.throws(() => resolveMediaAttachmentsForTarget({
    config,
    domain: 'video',
    target: config.ai.video.targets[0],
    baseDir: tempDir,
    capabilities: makeCapabilities({ inlineSupported: true, inlineMaxBytes: 12, urlSupported: false })
  }), (error) => {
    assert.equal(error.code, 'CAPABILITY_MISMATCH');
    assert.equal(error.aiTargets.classification, 'capability');
    assert.equal(error.mediaDelivery.ref, 'source_video');
    return true;
  });
});


test('resolveVideoContextForTarget keeps chunk-local video assets inline instead of reusing the staged full-source URL', (t) => {
  const { tempDir } = makeTempFixture(t, { sizeBytes: 10 });
  const chunkDir = path.join(tempDir, 'chunks');
  fs.mkdirSync(chunkDir, { recursive: true });
  const chunkPath = path.join(chunkDir, 'chunk-0.mp4');
  fs.writeFileSync(chunkPath, Buffer.alloc(5, 3));

  const config = makeConfig(tempDir, {
    asset: {
      media: {
        refs: {
          source_video: {
            delivery: {
              preferredMode: 'url',
              allowedModes: ['url', 'inline'],
              allowFallback: false
            }
          }
        }
      }
    }
  });

  const resolved = resolveVideoContextForTarget({
    config,
    target: config.ai.video.targets[0],
    videoContext: {
      chunkPath,
      transferStrategy: 'base64',
      mimeType: 'video/mp4',
      duration: 5,
      startTime: 0,
      endTime: 5
    }
  });

  assert.equal(resolved.deliveryMode, 'inline');
  assert.equal(resolved.transferStrategy, 'base64');
  assert.equal(resolved.chunkPath, chunkPath);
  assert.equal('url' in resolved, false);
  assert.equal(resolved.resolvedAttachment?.path, chunkPath);
  assert.equal(resolved.resolvedAttachment?.url, null);
});

test('resolveVideoContextForTarget still uses the staged URL when the active asset is the configured full-source video', (t) => {
  const { tempDir, filePath } = makeTempFixture(t, { sizeBytes: 10 });
  const config = makeConfig(tempDir, {
    asset: {
      inputPath: filePath,
      media: {
        refs: {
          source_video: {
            source: {
              path: filePath
            }
          }
        }
      }
    }
  });

  const resolved = resolveVideoContextForTarget({
    config,
    target: config.ai.video.targets[0],
    videoContext: {
      chunkPath: filePath,
      transferStrategy: 'base64',
      mimeType: 'video/mp4',
      duration: 16,
      startTime: 0,
      endTime: 16
    }
  });

  assert.equal(resolved.deliveryMode, 'url');
  assert.equal(resolved.transferStrategy, 'url');
  assert.equal(resolved.url, 'https://example.com/cod.mp4');
  assert.equal('chunkPath' in resolved, false);
  assert.equal(resolved.resolvedAttachment?.url, 'https://example.com/cod.mp4');
});
