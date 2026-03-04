# AI Provider Utilities

Utility functions for handling file attachments across all AI providers.

## File Utilities (`file-utils.cjs`)

Provides utilities for handling the three attachment patterns:
- **Pattern 1**: URL (publicly accessible)
- **Pattern 2**: Local path (auto-convert to base64)
- **Pattern 3**: Direct base64 data (already converted)

### Functions

#### `fileToBase64(filePath)`

Convert a local file to base64 string.

```javascript
const { fileToBase64 } = require('./utils/file-utils.cjs');

const base64 = await fileToBase64('/path/to/video.mp4');
```

#### `detectMimeType(filePath, defaultType)`

Auto-detect MIME type from file extension.

```javascript
const { detectMimeType } = require('./utils/file-utils.cjs');

const mimeType = detectMimeType('/path/to/video.mp4');
// Returns: 'video/mp4'

const mimeType = detectMimeType('/path/to/image.jpg');
// Returns: 'image/jpeg'
```

#### `validateAttachment(attachment)`

Validate attachment object structure.

```javascript
const { validateAttachment } = require('./utils/file-utils.cjs');

const result = validateAttachment({
  type: 'video',
  path: '/path/to/video.mp4'
});

if (!result.isValid) {
  throw new Error(result.error);
}
```

#### `processAttachment(attachment)`

Process attachment and return formatted data for provider. Handles all three patterns.

```javascript
const { processAttachment } = require('./utils/file-utils.cjs');

const processed = await processAttachment({
  type: 'video',
  path: '/path/to/video.mp4'
});

// Returns:
// {
//   type: 'video',
//   mimeType: 'video/mp4',
//   isUrl: false,
//   base64Data: 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28y...',
//   url: null
// }
```

### Supported MIME Types

The utility auto-detects MIME types for:

**Images:**
- JPEG, PNG, GIF, WebP, BMP, SVG, ICO

**Video:**
- MP4, WebM, MOV, AVI, MKV, FLV

**Audio:**
- MP3, WAV, OGG, M4A, AAC, FLAC, Opus

**Files:**
- PDF, TXT, JSON, XML, CSV, HTML, JS, CSS, ZIP, DOC, DOCX, XLS, XLSX

## Usage in Providers

All provider implementations use these utilities:

```javascript
const { processAttachment } = require('../utils/file-utils.cjs');

async function complete(options) {
  // ... validation ...
  
  for (const attachment of attachments) {
    const processed = await processAttachment(attachment);
    const { type, mimeType, isUrl, base64Data, url } = processed;
    
    // Use processed data based on provider's API format
  }
}
```

## Error Handling

All functions throw descriptive errors:

```javascript
try {
  const processed = await processAttachment({
    type: 'video',
    path: '/nonexistent/file.mp4'
  });
} catch (error) {
  console.error(error.message);
  // "Attachment path does not exist: /nonexistent/file.mp4"
}
```
