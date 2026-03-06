# Test Video Assets

## Purpose

This folder contains test video assets used for End-to-End (E2E) testing of the emotion-engine. Videos stored here are used to validate emotion detection, video processing pipelines, and multi-modal analysis features.

## Directory Structure

```
videos/
├── README.md              # This file
└── emotion-tests/         # Test video files for E2E tests
    └── (test videos)
```

## Naming Conventions

When adding new test videos, follow these conventions:

- **Format**: Use `.mp4` or `.webm` for maximum compatibility
- **Naming pattern**: `<emotion>_<scenario>_<duration>.mp4`
  - Examples:
    - `happy_greeting_5s.mp4`
    - `sad_farewell_10s.mp4`
    - `neutral_waiting_3s.mp4`
- **Duration**: Keep test videos short (3-15 seconds) for fast test execution
- **Resolution**: 720p or lower is sufficient for testing

## Current Test Videos

As of 2026-03-06, the `emotion-tests/` directory is newly created. Add test videos as needed for your E2E test scenarios.

## Git Tracking

**Important**: Video files in this directory are committed to the repository.

- ✅ Videos are tracked in Git
- ✅ Keep file sizes reasonable (< 10MB preferred)
- ✅ Use Git LFS for larger video files if needed
- ❌ Do not add temporary or disposable test videos here

To add a new test video:

```bash
git add examples/videos/emotion-tests/<your-video>.mp4
git commit -m "Add test video: <description>"
git push
```

## Usage in Tests

Reference test videos in your E2E tests using relative paths:

```javascript
const testVideoPath = path.join(__dirname, '../videos/emotion-tests/happy_greeting_5s.mp4');
```

## Adding New Test Videos

1. Place your video file in `emotion-tests/`
2. Follow the naming convention above
3. Add and commit to Git
4. Update this README if you add a significant number of videos

For questions or issues, refer to the main [README.md](../../README.md) or open an issue.
