/**
 * DEVELOPMENT NOTES
 * OpenTruth Emotion Engine — Prototype
 * 
 * This file contains development notes, known issues, and next steps.
 * Remove before production.
 */

// ============================================================================
// WEEK 1 DELIVERABLE: Frame Extraction
// ============================================================================

/**
 * Status: SCAFFOLDED (Ready for Testing)
 * 
 * The ffmpeg-slicer component uses a Web Worker to avoid blocking the main thread.
 * The worker is created from an inline blob to avoid external file dependencies.
 * 
 * KNOWN ISSUES:
 * - Web Worker blob creation may fail in some browsers
 * - YouTube URL fetching will hit CORS (needs server-side proxy)
 * - Large videos (>100MB) may crash the browser tab
 * 
 * TESTING CHECKLIST:
 * [ ] Drag-drop MP4 file works
 * [ ] Frame extraction completes without blocking UI
 * [ ] Progress bar updates correctly
 * [ ] Base64 frames are valid images
 * [ ] Event 'frames-extracted' fires with correct payload
 */

// ============================================================================
// WEEK 3-4: Lambda Integration
// ============================================================================

/**
 * TODO: AWS Setup
 * 
 * Required Environment Variables:
 * - OPENROUTER_API_KEY (from OpenRouter dashboard)
 * - SESSIONS_TABLE (DynamoDB table name)
 * 
 * Required IAM Permissions:
 * - dynamodb:GetItem, dynamodb:PutItem, dynamodb:DeleteItem
 * - s3:PutObject (for report artifacts)
 * 
 * API Gateway Configuration:
 * - HTTP API (not REST API — cheaper, faster)
 * - CORS enabled for localhost:8080 (dev)
 * - Throttling: 1000 req/min (adjust based on budget)
 */

// ============================================================================
// PERSONA PROMPT ENGINEERING
// ============================================================================

/**
 * The impatient-teenager prompt is intentionally aggressive.
 * 
 * CALIBRATION NOTES:
 * - If evaluations are too harsh (everything scores 1-3), dial back the "brutal honesty"
 * - If evaluations are too generous (everything scores 7-10), emphasize "zero patience"
 * - JSON format instructions must be explicit or LLM will output prose
 * 
 * TOKEN COST ESTIMATE:
 * - System prompt: ~500 tokens
 * - Per-frame with image: ~1000-1500 tokens
 * - Response: ~100 tokens
 * - Total per frame: ~2000 tokens
 * - Cost per frame (Kimi-2.5): ~$0.002-0.004
 * - 30-frame video: ~$0.06-0.12
 */

// ============================================================================
// TESTING STRATEGY
// ============================================================================

/**
 * HUMAN BASELINE ESTABLISHMENT:
 * 
 * 1. Derrick watches 10 sample videos
 * 2. For each video, rate: Patience, Boredom, Excitement (1-10)
 * 3. Note timestamp of "would scroll away" moment
 * 4. Compare against OpenTruth emissions
 * 5. Calculate correlation coefficient
 * 
 * TARGET: ±15% variance or r > 0.8 correlation
 * 
 * SAMPLE VIDEOS TO SOURCE:
 * - 3 viral TikToks (high engagement)
 * - 3 slow corporate ads (low engagement)
 * - 2 movie trailers (mixed pacing)
 * - 2 gameplay highlights (variable intensity)
 */

// ============================================================================
// STRIPE INTEGRATION (WEEK 7-8)
// ============================================================================

/**
 * Pre-paid Wallet Model:
 * 
 * User Flow:
 * 1. User loads wallet via Stripe Checkout ($20 minimum)
 * 2. Each analysis deducts: tokens + $0.05 orchestration fee
 * 3. Balance displayed in real-time
 * 4. Auto-reload option when balance < $5
 * 
 * Cost Breakdown (per 30-frame analysis):
 * - Tokens: ~$0.08 (at Kimi-2.5 rates)
 * - Orchestration: $0.05
 * - Total: ~$0.13 per run
 * 
 * FREEMIUM:
 * - 5 free runs per IP address
 * - Rate limited to 1 run per hour
 */

// ============================================================================
// FUTURE ENHANCEMENTS (Post-MVP)
// ============================================================================

/**
 * Phase 2 Ideas:
 * - Multi-persona comparison (3 side-by-side radar charts)
 * - Export reports as PDF
 * - A/B testing interface (upload 2 videos, compare)
 * - Integration with YouTube Analytics
 * - Custom persona builder (UI for creating new personas)
 * 
 * Phase 3 (CI/CD):
 * - Firecracker microVMs for compiled software
 * - Native hooks for Godot/Unity
 * - Video ledger capture
 * - GitHub Action
 */

// ============================================================================
// DEBUGGING TIPS
// ============================================================================

/**
 * Browser DevTools:
 * - Network tab: Monitor frame payload sizes (should be <500KB per frame)
 * - Performance tab: Check for main thread blocking during slicing
 * - Console: Look for ffmpeg.wasm initialization errors
 * 
 * Lambda Logs:
 * - CloudWatch Logs: /aws/lambda/opentruth-process
 * - Enable X-Ray for tracing OpenRouter API calls
 * - Monitor token usage vs cost
 * 
 * Common Issues:
 * - "FFmpeg not loaded": Worker failed to initialize, check CDN URL
 * - "CORS error": YouTube URLs require server-side proxy
 * - "Out of memory": Reduce max file size or implement chunked upload
 */
