# Goals Directory

This directory contains GOAL.md files that define evaluation objectives for the Emotion Engine.

## Structure

Each goal is a single markdown file at the root of this directory:

```
goals/
├── video-ad-evaluation.md
├── audio-evaluation.md
├── image-evaluation.md
└── README.md
```

## Migration Note

**As of 2026-03-06**, the persona system has been flattened:

- **Old path**: `personas/goals/<goal-name>/1.0.0/GOAL.md`
- **New path**: `goals/<goal-name>.md`

Semantic versioning folders have been removed. Simply reference the goal file directly by name.

## Usage

In YAML configs, reference goals like this:

```yaml
tool_variables:
  goalPath: "goals/video-ad-evaluation.md"
```

In code:

```javascript
const goal = fs.readFileSync('goals/video-ad-evaluation.md', 'utf8');
```

## Available Goals

- **video-ad-evaluation.md** - Evaluate video ad retention and engagement
- **audio-evaluation.md** - Evaluate audio content quality and engagement  
- **image-evaluation.md** - Evaluate image content effectiveness
