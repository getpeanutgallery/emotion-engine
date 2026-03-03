/**
 * @fileoverview API Manager Singleton
 * Handles all API communication with the backend
 * @author OpenTruth Team
 * @version 0.2.0
 */

/**
 * @typedef {Object} Persona
 * @property {string} id - Unique persona identifier
 * @property {string} name - Display name
 * @property {string} description - Brief description
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {string} sessionId - Unique session ID
 * @property {number} duration - Video duration in seconds
 * @property {Array} chunks - Chunk analysis results
 * @property {Object} frictionIndex - Calculated friction scores
 * @property {Array} recommendations - Actionable recommendations
 */

export class APIManager {
    static #instance = null;

    constructor() {
        if (APIManager.#instance) {
            return APIManager.#instance;
        }

        /** @type {string} */
        this.baseUrl = '/api/v1';

        /** @type {boolean} */
        this.mockMode = false;

        APIManager.#instance = this;
        console.log('🔌 API Manager initialized');
    }

    /**
     * Check API health
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        if (this.mockMode) {
            return { status: 'mock', message: 'Running in mock mode' };
        }

        const response = await fetch(`${this.baseUrl}/health`);
        if (!response.ok) throw new Error('Health check failed');
        return response.json();
    }

    /**
     * Get available personas
     * @returns {Promise<Persona[]>}
     */
    async getPersonas() {
        if (this.mockMode) {
            return [
                { id: 'impatient-teenager', name: 'Impatient Teenager', description: 'Gen Z, 16-19, scrolls instantly if bored' }
            ];
        }

        const response = await fetch(`${this.baseUrl}/personas`);
        if (!response.ok) throw new Error('Failed to fetch personas');
        return response.json();
    }

    /**
     * Start video analysis
     * @param {File} videoFile - Video file to analyze
     * @param {string} personaId - Selected persona ID
     * @returns {Promise<{sessionId: string}>}
     */
    async startAnalysis(videoFile, personaId) {
        if (this.mockMode) {
            console.log('🎬 Mock analysis started for', videoFile.name, personaId);
            return { sessionId: 'mock-' + Date.now() };
        }

        const formData = new FormData();
        formData.append('video', videoFile);
        formData.append('persona', personaId);

        const response = await fetch(`${this.baseUrl}/process`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Analysis failed');
        return response.json();
    }

    /**
     * Get analysis status
     * @param {string} sessionId - Session ID
     * @returns {Promise<{status: string, progress: number, message: string}>}
     */
    async getStatus(sessionId) {
        if (this.mockMode) {
            return { status: 'processing', progress: 50, message: 'Mock processing...' };
        }

        const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`);
        if (!response.ok) throw new Error('Status check failed');
        return response.json();
    }

    /**
     * Get analysis results
     * @param {string} sessionId - Session ID
     * @returns {Promise<AnalysisResult>}
     */
    async getResults(sessionId) {
        if (this.mockMode) {
            return this.#getMockResults();
        }

        const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/results`);
        if (!response.ok) throw new Error('Results fetch failed');
        return response.json();
    }

    /**
     * Enable mock mode for local testing
     * @param {boolean} enabled
     */
    setMockMode(enabled) {
        this.mockMode = enabled;
        console.log('🔧 Mock mode:', enabled ? 'ON' : 'OFF');
    }

    /**
     * Get mock results for testing
     * @returns {Promise<AnalysisResult>}
     * @private
     */
    async #getMockResults() {
        // Mock data for development
        return {
            sessionId: 'mock-123',
            duration: 30,
            chunks: [
                { timestamp: 0, patience: 3, boredom: 8, excitement: 2, scroll_risk: 'high' },
                { timestamp: 8, patience: 4, boredom: 7, excitement: 3, scroll_risk: 'medium' },
                { timestamp: 16, patience: 5, boredom: 6, excitement: 4, scroll_risk: 'medium' },
                { timestamp: 24, patience: 6, boredom: 5, excitement: 5, scroll_risk: 'low' }
            ],
            frictionIndex: {
                overall: 7.2,
                patience: 4.5,
                boredom: 6.5,
                excitement: 3.5
            },
            recommendations: [
                'Hook viewers in first 3 seconds',
                'Reduce visual clutter in opening scene',
                'Increase pacing to maintain engagement'
            ]
        };
    }
}
