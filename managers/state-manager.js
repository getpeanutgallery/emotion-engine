/**
 * @fileoverview State Manager Singleton
 * Manages global application state
 * @author OpenTruth Team
 * @version 0.2.0
 */

/**
 * @typedef {Object} AppState
 * @property {boolean} apiReady - API connection status
 * @property {boolean} mockMode - Using mock data
 * @property {Array} personas - Available personas
 * @property {string|null} selectedPersona - Currently selected persona ID
 * @property {string|null} currentSession - Current analysis session ID
 * @property {string} analysisStatus - Current analysis status
 * @property {number} progress - Analysis progress (0-100)
 * @property {Object|null} results - Analysis results
 */

export class StateManager {
    static #instance = null;

    constructor() {
        if (StateManager.#instance) {
            return StateManager.#instance;
        }

        /** @type {AppState} */
        this.state = {
            apiReady: false,
            mockMode: false,
            personas: [],
            selectedPersona: null,
            currentSession: null,
            analysisStatus: 'idle',
            progress: 0,
            results: null
        };

        /** @type {Set<Function>} */
        this.listeners = new Set();

        StateManager.#instance = this;
        console.log('📦 State Manager initialized');
    }

    /**
     * Subscribe to state changes
     * @param {Function} listener - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Update state and notify listeners
     * @param {Partial<AppState>} updates - State updates
     */
    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.listeners.forEach(listener => listener(this.state));
        console.log('📝 State updated:', updates);
    }

    /**
     * Get current state
     * @returns {AppState}
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Set API ready status
     * @param {boolean} ready
     */
    setAPIReady(ready) {
        this.setState({ apiReady: ready });
    }

    /**
     * Set mock mode
     * @param {boolean} enabled
     */
    setMockMode(enabled) {
        this.setState({ mockMode: enabled });
    }

    /**
     * Set available personas
     * @param {Array} personas
     */
    setPersonas(personas) {
        this.setState({ personas });
    }

    /**
     * Select a persona
     * @param {string} personaId
     */
    selectPersona(personaId) {
        this.setState({ selectedPersona: personaId });
    }

    /**
     * Set current session
     * @param {string} sessionId
     */
    setSession(sessionId) {
        this.setState({ currentSession: sessionId, analysisStatus: 'processing', progress: 0 });
    }

    /**
     * Update analysis progress
     * @param {number} progress - 0-100
     * @param {string} status - Status message
     */
    updateProgress(progress, status = 'processing') {
        this.setState({ progress, analysisStatus: status });
    }

    /**
     * Set analysis results
     * @param {Object} results
     */
    setResults(results) {
        this.setState({ results, analysisStatus: 'complete', progress: 100 });
    }

    /**
     * Reset state to initial
     */
    reset() {
        this.setState({
            currentSession: null,
            analysisStatus: 'idle',
            progress: 0,
            results: null
        });
    }
}
