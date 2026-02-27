/**
 * AWS Lambda Handler — Emotion Engine
 * Processes video frames through LLM vision models
 * 
 * @module lambda/index
 * @author Cookie (OpenClaw)
 * @version 0.1.0
 */

const { OpenRouterClient } = require('./lib/openrouter');
const { SessionStore } = require('./lib/store');

/**
 * Main Lambda handler
 * @param {Object} event - API Gateway event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} API Gateway response
 */
exports.handler = async (event, context) => {
    // Enable reusable DB connections
    context.callbackWaitsForEmptyEventLoop = false;
    
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
        
        if (path.startsWith('/v1/sessions/') && method === 'GET') {
            const sessionId = path.split('/').pop();
            return await getSession(sessionId);
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
 * Process video frames
 * @param {Object} event - API Gateway event
 * @returns {Promise<Object>} Response
 */
async function processVideo(event) {
    const body = JSON.parse(event.body);
    const { sessionId, personaId, frames, config } = body;
    
    // Validate required fields
    if (!sessionId || !personaId || !frames || !Array.isArray(frames)) {
        return errorResponse('Missing required fields: sessionId, personaId, frames', 400);
    }
    
    // Load persona definition
    const persona = await loadPersona(personaId);
    if (!persona) {
        return errorResponse(`Unknown persona: ${personaId}`, 404);
    }
    
    // Initialize OpenRouter client
    const llm = new OpenRouterClient({
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultModel: config?.model || 'kimi-2.5-vision'
    });
    
    // Process each frame
    const emissions = [];
    const startTime = Date.now();
    
    for (const frame of frames) {
        const evaluation = await evaluateFrame(llm, frame, persona, config?.lenses);
        emissions.push(evaluation);
    }
    
    // Calculate aggregate metrics
    const frictionIndex = calculateFrictionIndex(emissions);
    
    // Store results
    const store = new SessionStore();
    await store.save(sessionId, {
        sessionId,
        personaId,
        emissions,
        frictionIndex,
        processedAt: new Date().toISOString(),
        duration: Date.now() - startTime
    });
    
    return successResponse({
        sessionId,
        personaId,
        emissions,
        frictionIndex,
        radarData: buildRadarData(emissions),
        timeline: buildTimeline(emissions)
    });
}

/**
 * Evaluate single frame through LLM
 * @param {OpenRouterClient} llm - LLM client
 * @param {Object} frame - Frame data {base64, timestamp}
 * @param {Object} persona - Persona definition
 * @param {string[]} lenses - Active emotion lenses
 * @returns {Promise<Object>} Frame evaluation
 */
async function evaluateFrame(llm, frame, persona, lenses = ['patience', 'boredom', 'excitement']) {
    // Build prompt
    const prompt = buildEvaluationPrompt(persona, lenses, frame.timestamp);
    
    // Call LLM with vision
    const response = await llm.complete({
        model: 'kimi-2.5-vision',
        messages: [
            {
                role: 'system',
                content: persona.systemPrompt
            },
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${frame.base64}`,
                            detail: 'high'
                        }
                    }
                ]
            }
        ],
        response_format: {
            type: 'json_object'
        }
    });
    
    const scores = JSON.parse(response.choices[0].message.content);
    
    return {
        frameIndex: frame.index || 0,
        timestamp: frame.timestamp,
        scores: scores,
        cost: response.usage?.total_tokens || 0
    };
}

/**
 * Build evaluation prompt
 * @param {Object} persona - Persona definition
 * @param {string[]} lenses - Active lenses
 * @param {number} timestamp - Frame timestamp
 * @returns {string} Prompt text
 */
function buildEvaluationPrompt(persona, lenses, timestamp) {
    const lensDescriptions = {
        patience: 'How patient is the viewer at this moment? (1-10, 10 = very patient)',
        boredom: 'How bored is the viewer? (1-10, 10 = extremely bored)',
        excitement: 'How excited/engaged is the viewer? (1-10, 10 = extremely excited)',
        frustration: 'How frustrated is the viewer? (1-10, 10 = extremely frustrated)',
        clarity: 'How clear/understandable is the content? (1-10, 10 = very clear)',
        trust: 'How much trust does the viewer feel? (1-10, 10 = complete trust)',
        skepticism: 'How skeptical/doubtful is the viewer? (1-10, 10 = extremely skeptical)',
        anxiety: 'How anxious/worried is the viewer? (1-10, 10 = extreme anxiety)',
        empowerment: 'How empowered/in-control does the viewer feel? (1-10, 10 = fully empowered)',
        confidence: 'How confident is the viewer in what they are seeing? (1-10, 10 = very confident)'
    };
    
    const activeLenses = lenses.map(l => `- ${l}: ${lensDescriptions[l] || l}`).join('\n');
    
    return `You are evaluating this video frame from the perspective of: ${persona.name}

Persona Description:
${persona.description}

Core Conflict: ${persona.conflict}

Rate the following emotional dimensions on a scale of 1-10 (where 1 = minimum, 5 = neutral, 10 = maximum):
${activeLenses}

Current timestamp: ${timestamp}ms

Respond with a JSON object containing only the scores. Example:
{
  "patience": 3,
  "boredom": 8,
  "excitement": 4
}

Be honest and critical. This persona is adversarial and will not be easily satisfied.`;
}

/**
 * Calculate friction index from emissions
 * @param {Array} emissions - Frame evaluations
 * @returns {number} Friction index (0-100)
 */
function calculateFrictionIndex(emissions) {
    // Weight negative emotions higher
    let totalFriction = 0;
    
    for (const emission of emissions) {
        const scores = emission.scores;
        
        // Negative indicators (higher = more friction)
        const negative = (
            (scores.boredom || 0) +
            (scores.frustration || 0) +
            (scores.anxiety || 0) +
            (10 - (scores.patience || 5)) +
            (10 - (scores.clarity || 5))
        ) / 5;
        
        // Positive indicators (lower = more friction)
        const positive = (
            (10 - (scores.excitement || 5)) +
            (10 - (scores.empowerment || 5)) +
            (10 - (scores.confidence || 5))
        ) / 3;
        
        totalFriction += (negative + positive) / 2;
    }
    
    // Average and scale to 0-100
    return Math.round((totalFriction / emissions.length) * 10);
}

/**
 * Build radar chart data
 * @param {Array} emissions - Frame evaluations
 * @returns {Array} Radar data points
 */
function buildRadarData(emissions) {
    // Average all emotions across frames
    const sums = {};
    const counts = {};
    
    for (const emission of emissions) {
        for (const [emotion, score] of Object.entries(emission.scores)) {
            sums[emotion] = (sums[emotion] || 0) + score;
            counts[emotion] = (counts[emotion] || 0) + 1;
        }
    }
    
    return Object.entries(sums).map(([emotion, sum]) => ({
        axis: emotion.charAt(0).toUpperCase() + emotion.slice(1),
        value: parseFloat((sum / counts[emotion]).toFixed(1))
    }));
}

/**
 * Build timeline data
 * @param {Array} emissions - Frame evaluations
 * @returns {Array} Timeline points
 */
function buildTimeline(emissions) {
    return emissions.map(e => ({
        timestamp: e.timestamp,
        ...e.scores
    }));
}

/**
 * Load persona definition
 * @param {string} personaId - Persona identifier
 * @returns {Promise<Object|null>} Persona or null
 */
async function loadPersona(personaId) {
    // In production, load from DynamoDB or S3
    // For MVP, inline the impatient-teenager
    const personas = {
        'impatient-teenager': {
            id: 'impatient-teenager',
            name: 'The Impatient Teenager',
            description: 'A 16-19 year old who consumes TikTok, YouTube Shorts, and Instagram Reels constantly. They have been conditioned by algorithmic feeds to expect instant gratification.',
            conflict: 'Abandons content if the hook takes longer than 3 seconds to appear. Extremely low tolerance for slow pacing, long intros, or excessive branding.',
            systemPrompt: `You are a 17-year-old Gen Z viewer. You watch 200+ short-form videos per day. Your attention span has been shaped by TikTok's algorithm.

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
- Patience 3- = You're already annoyed`
        }
    };
    
    return personas[personaId] || null;
}

/**
 * Get persona by ID
 * @param {string} personaId - Persona identifier
 * @returns {Promise<Object>} Response
 */
async function getPersona(personaId) {
    const persona = await loadPersona(personaId);
    
    if (!persona) {
        return errorResponse('Persona not found', 404);
    }
    
    // Don't expose full system prompt
    return successResponse({
        id: persona.id,
        name: persona.name,
        description: persona.description,
        conflict: persona.conflict,
        lenses: ['patience', 'boredom', 'excitement']
    });
}

/**
 * Get session results
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Response
 */
async function getSession(sessionId) {
    const store = new SessionStore();
    const session = await store.get(sessionId);
    
    if (!session) {
        return errorResponse('Session not found', 404);
    }
    
    return successResponse(session);
}

/**
 * Health check endpoint
 * @returns {Object} Response
 */
function healthCheck() {
    return successResponse({
        status: 'ok',
        version: '0.1.0',
        timestamp: new Date().toISOString()
    });
}

/**
 * 404 response
 * @returns {Object} Response
 */
function notFound() {
    return errorResponse('Not found', 404);
}

/**
 * Success response helper
 * @param {Object} data - Response data
 * @param {number} statusCode - HTTP status
 * @returns {Object} API Gateway response
 */
function successResponse(data, statusCode = 200) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(data)
    };
}

/**
 * Error response helper
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status
 * @returns {Object} API Gateway response
 */
function errorResponse(message, statusCode = 400) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            error: true,
            message
        })
    };
}
