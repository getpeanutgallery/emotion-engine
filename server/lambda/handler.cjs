/**
 * AWS Lambda Handler — Emotion Engine API
 * OpenTruth Frame Evaluation Service
 * 
 * @module lambda/handler
 * @author Cookie (OpenClaw)
 * @version 0.2.0
 */

const { OpenRouterClient } = require('./lib/openrouter-enhanced.cjs');

// CORS headers for all responses
const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    
    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }
    
    const path = event.path;
    const method = event.httpMethod;
    
    try {
        // Route requests
        if (path === '/v1/process' && method === 'POST') {
            return await processVideo(event);
        }
        
        if (path.startsWith('/v1/personas/') && method === 'GET') {
            const personaId = path.split('/').pop();
            return await getPersona(personaId);
        }
        
        if (path.startsWith '/v1/sessions/') && method === 'GET') {
            const sessionId = path.split('/').pop();
            return await getSession(sessionId);
        }
        
        if (path === '/v1/models' && method === 'GET') {
            return await listModels();
        }
        
        if (path === '/v1/health' && method === 'GET') {
            return healthCheck();
        }
        
        return notFound();
        
    } catch (error) {
        console.error('Lambda Error:', error);
        return errorResponse(error.message, 500);
    }
};

/**
 * Process video frames through Emotion Engine
 */
async function processVideo(event) {
    const body = JSON.parse(event.body);
    const { sessionId, personaId, frames, config = {} } = body;
    
    // Validation
    if (!sessionId || !personaId || !frames || !Array.isArray(frames)) {
        return errorResponse('Missing required fields: sessionId, personaId, frames', 400);
    }
    
    if (frames.length === 0) {
        return errorResponse('No frames provided', 400);
    }
    
    if (frames.length > 100) {
        return errorResponse('Too many frames (max 100)', 400);
    }
    
    // Load persona
    const persona = await loadPersona(personaId);
    if (!persona) {
        return errorResponse(`Unknown persona: ${personaId}`, 404);
    }
    
    // Initialize OpenRouter client
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return errorResponse('API not configured', 500);
    }
    
    const client = new OpenRouterClient({
        apiKey,
        defaultModel: config.model || 'kimi-2.5-vision',
        maxRetries: 2,
        timeout: 60000
    });
    
    // Process frames
    const startTime = Date.now();
    const emissions = [];
    let totalCost = 0;
    let totalTokens = 0;
    
    console.log(`Processing ${frames.length} frames for session ${sessionId}`);
    
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        
        try {
            const evaluation = await client.evaluateFrame({
                model: config.model,
                base64Image: frame.base64,
                timestamp: frame.timestamp,
                persona,
                lenses: config.lenses || ['patience', 'boredom', 'excitement']
            });
            
            emissions.push({
                frameIndex: frame.index || i,
                timestamp: frame.timestamp,
                scores: evaluation.scores,
                cost: evaluation.cost,
                tokens: evaluation.usage?.total_tokens
            });
            
            totalCost += evaluation.cost;
            totalTokens += evaluation.usage?.total_tokens || 0;
            
        } catch (e) {
            console.error(`Frame ${i} failed:`, e.message);
            emissions.push({
                frameIndex: frame.index || i,
                timestamp: frame.timestamp,
                error: e.message
            });
        }
        
        // Small delay between frames to avoid rate limits
        if (i < frames.length - 1) {
            await sleep(200);
        }
    }
    
    const duration = Date.now() - startTime;
    
    // Calculate aggregates
    const validEmissions = emissions.filter(e => !e.error);
    const frictionIndex = calculateFrictionIndex(validEmissions);
    const radarData = buildRadarData(validEmissions);
    const timeline = buildTimeline(validEmissions);
    
    // Generate recommendations
    const recommendations = generateRecommendations(validEmissions, persona);
    
    const result = {
        sessionId,
        personaId,
        model: config.model || 'kimi-2.5-vision',
        metrics: {
            frictionIndex,
            frameCount: frames.length,
            processedCount: validEmissions.length,
            failedCount: frames.length - validEmissions.length,
            totalCost: Math.round(totalCost * 10000) / 10000,
            totalTokens,
            duration
        },
        emissions,
        radarData,
        timeline,
        recommendations
    };
    
    // TODO: Store in DynamoDB
    // await storeSession(result);
    
    console.log(`Session ${sessionId} complete: ${validEmissions.length}/${frames.length} frames, $${result.metrics.totalCost}`);
    
    return successResponse(result);
}

/**
 * Calculate friction index from emissions
 */
function calculateFrictionIndex(emissions) {
    if (emissions.length === 0) return 0;
    
    let totalFriction = 0;
    
    for (const e of emissions) {
        const scores = e.scores;
        
        // Negative indicators
        const negative = (
            (scores.boredom || 0) +
            (scores.frustration || 0) +
            (scores.anxiety || 0) +
            (10 - (scores.patience || 5)) +
            (10 - (scores.clarity || 5))
        ) / 5;
        
        // Positive indicators inverted
        const positive = (
            (10 - (scores.excitement || 5)) +
            (10 - (scores.empowerment || 5)) +
            (10 - (scores.confidence || 5))
        ) / 3;
        
        totalFriction += (negative + positive) / 2;
    }
    
    return Math.round((totalFriction / emissions.length) * 10);
}

/**
 * Build radar chart data
 */
function buildRadarData(emissions) {
    if (emissions.length === 0) return [];
    
    const sums = {};
    const counts = {};
    
    for (const e of emissions) {
        for (const [emotion, score] of Object.entries(e.scores)) {
            if (typeof score === 'number') {
                sums[emotion] = (sums[emotion] || 0) + score;
                counts[emotion] = (counts[emotion] || 0) + 1;
            }
        }
    }
    
    return Object.entries(sums).map(([emotion, sum]) => ({
        axis: emotion.charAt(0).toUpperCase() + emotion.slice(1),
        value: Math.round((sum / counts[emotion]) * 10) / 10
    }));
}

/**
 * Build timeline data
 */
function buildTimeline(emissions) {
    return emissions.map(e => ({
        timestamp: e.timestamp,
        ...e.scores
    }));
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(emissions, persona) {
    const recommendations = [];
    
    if (emissions.length === 0) return recommendations;
    
    // Find abandonment point
    const abandonment = emissions.find(e => e.scores.boredom >= 8);
    if (abandonment && abandonment.timestamp < 10000) {
        recommendations.push({
            severity: 'high',
            issue: 'Early Abandonment Risk',
            time: abandonment.timestamp,
            description: `${persona.name} would scroll away at ${(abandonment.timestamp / 1000).toFixed(1)}s due to high boredom`,
            action: 'Cut the opening sequence. Jump directly to engaging content within 3 seconds.'
        });
    }
    
    // Find peak excitement
    const peakExcitement = emissions.reduce((max, e) => 
        e.scores.excitement > max.scores.excitement ? e : max
    );
    
    if (peakExcitement.scores.excitement < 6) {
        recommendations.push({
            severity: 'medium',
            issue: 'Low Peak Engagement',
            time: peakExcitement.timestamp,
            description: `Maximum excitement only reached ${peakExcitement.scores.excitement}/10`,
            action: 'Add more dynamic visuals or pattern interrupts to increase engagement.'
        });
    }
    
    // Check patience throughout
    const lowPatience = emissions.filter(e => e.scores.patience <= 3);
    if (lowPatience.length > emissions.length / 2) {
        recommendations.push({
            severity: 'medium',
            issue: 'Persistent Patience Issues',
            description: `${lowPatience.length}/${emissions.length} moments show low patience`,
            action: 'Pacing is too slow for this demographic. Consider faster cuts or removing filler content.'
        });
    }
    
    return recommendations;
}

/**
 * Load persona definition
 */
async function loadPersona(personaId) {
    const personas = {
        'impatient-teenager': {
            id: 'impatient-teenager',
            name: 'The Impatient Teenager',
            description: 'A 16-19 year old heavy TikTok/YouTube Shorts consumer with zero tolerance for slow content.',
            conflict: 'Abandons if hook takes >3 seconds',
            systemPrompt: `You are a 17-year-old Gen Z viewer. You watch 200+ short-form videos per day.

You have ZERO patience for:
- Logo animations or intro sequences
- Slow buildup to the main content
- Corporate speak or buzzwords
- Poor video quality or boring visuals
- Videos that don't get to the point immediately

You will happily scroll away if bored. Be brutally honest about when you'd skip this video.

Rate emotions on 1-10 scale where:
- Boredom 8+ = You'd scroll away NOW
- Excitement 7+ = You'd watch to the end
- Patience 3- = You're already annoyed

Respond with ONLY a JSON object containing scores and a brief rationale.`
        }
    };
    
    return personas[personaId] || null;
}

/**
 * Get persona details
 */
async function getPersona(personaId) {
    const persona = await loadPersona(personaId);
    if (!persona) {
        return errorResponse('Persona not found', 404);
    }
    
    return successResponse({
        id: persona.id,
        name: persona.name,
        description: persona.description,
        conflict: persona.conflict,
        lenses: ['patience', 'boredom', 'excitement', 'frustration', 'clarity', 'trust']
    });
}

/**
 * Get session results (placeholder - needs DynamoDB)
 */
async function getSession(sessionId) {
    // TODO: Implement DynamoDB retrieval
    return errorResponse('Session storage not yet implemented', 501);
}

/**
 * List available models
 */
async function listModels() {
    const { MODELS } = require('./lib/openrouter-enhanced.cjs');
    
    const modelList = Object.entries(MODELS).map(([key, model]) => ({
        id: key,
        name: model.name,
        vision: model.vision,
        pricing: model.pricing,
        bestFor: model.bestFor
    }));
    
    return successResponse({ models: modelList });
}

/**
 * Health check
 */
function healthCheck() {
    return successResponse({
        status: 'ok',
        version: '0.2.0',
        timestamp: new Date().toISOString(),
        openrouter: process.env.OPENROUTER_API_KEY ? 'configured' : 'not configured'
    });
}

/**
 * 404 response
 */
function notFound() {
    return errorResponse('Not found', 404);
}

/**
 * Success response helper
 */
function successResponse(data, statusCode = 200) {
    return {
        statusCode,
        headers: CORS_HEADERS,
        body: JSON.stringify(data)
    };
}

/**
 * Error response helper
 */
function errorResponse(message, statusCode = 400) {
    return {
        statusCode,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: true, message })
    };
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
