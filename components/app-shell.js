/**
 * App Shell Component
 * Top-level orchestrator for the OpenTruth Emotion Engine
 * 
 * @module components/app-shell
 * @author Cookie (OpenClaw)
 * @version 0.1.0
 */

/**
 * AppShell — Root application container
 * Manages global state, coordinates child components via Custom Events
 * 
 * @extends HTMLElement
 */
class AppShell extends HTMLElement {
    /** @type {WeakMap} Private state storage */
    #state = new WeakMap();
    
    /**
     * Creates an instance of AppShell
     */
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        /** @type {Object} Application state */
        this.state = {
            session: null,
            video: null,
            frames: [],
            persona: 'impatient-teenager',
            status: 'idle', // idle, slicing, processing, complete, error
            progress: 0,
            results: null
        };
        
        this.#state.set(this, this.state);
    }
    
    /**
     * Lifecycle: Element connected to DOM
     * @returns {void}
     */
    connectedCallback() {
        this.render();
        this.bindEvents();
    }
    
    /**
     * Lifecycle: Element disconnected from DOM
     * @returns {void}
     */
    disconnectedCallback() {
        this.unbindEvents();
    }
    
    /**
     * Bind global event listeners
     * @returns {void}
     * @private
     */
    bindEvents() {
        // Listen for component events
        this.addEventListener('video-selected', this.handleVideoSelected.bind(this));
        this.addEventListener('frames-extracted', this.handleFramesExtracted.bind(this));
        this.addEventListener('process-start', this.handleProcessStart.bind(this));
        this.addEventListener('process-complete', this.handleProcessComplete.bind(this));
        this.addEventListener('process-error', this.handleProcessError.bind(this));
        this.addEventListener('reset-app', this.handleReset.bind(this));
    }
    
    /**
     * Unbind global event listeners
     * @returns {void}
     * @private
     */
    unbindEvents() {
        this.removeEventListener('video-selected', this.handleVideoSelected);
        this.removeEventListener('frames-extracted', this.handleFramesExtracted);
        this.removeEventListener('process-start', this.handleProcessStart);
        this.removeEventListener('process-complete', this.handleProcessComplete);
        this.removeEventListener('process-error', this.handleProcessError);
        this.removeEventListener('reset-app', this.handleReset);
    }
    
    /**
     * Handle video selection from uploader
     * @param {CustomEvent} e - Event with {file, url} details
     * @returns {void}
     * @private
     */
    handleVideoSelected(e) {
        const { file, url } = e.detail;
        
        this.state.video = file || { url };
        this.state.session = this.generateSessionId();
        this.state.status = 'slicing';
        this.state.progress = 0;
        
        this.updateUI();
        
        // Trigger ffmpeg slicer
        const slicer = this.shadowRoot.querySelector('ffmpeg-slicer');
        if (slicer) {
            slicer.process(this.state.video);
        }
    }
    
    /**
     * Handle frame extraction completion
     * @param {CustomEvent} e - Event with {frames, metadata} details
     * @returns {void}
     * @private
     */
    handleFramesExtracted(e) {
        const { frames, metadata } = e.detail;
        
        this.state.frames = frames;
        this.state.video.duration = metadata.duration;
        this.state.video.frameCount = frames.length;
        this.state.status = 'ready';
        this.state.progress = 100;
        
        this.updateUI();
    }
    
    /**
     * Handle process start
     * @param {CustomEvent} e - Event with {personaId} details
     * @returns {void}
     * @private
     */
    handleProcessStart(e) {
        const { personaId } = e.detail;
        
        this.state.persona = personaId;
        this.state.status = 'processing';
        this.state.progress = 0;
        
        this.updateUI();
        this.runAnalysis();
    }
    
    /**
     * Handle process completion
     * @param {CustomEvent} e - Event with {results} details
     * @returns {void}
     * @private
     */
    handleProcessComplete(e) {
        const { results } = e.detail;
        
        this.state.results = results;
        this.state.status = 'complete';
        this.state.progress = 100;
        
        this.updateUI();
    }
    
    /**
     * Handle process error
     * @param {CustomEvent} e - Event with {error} details
     * @returns {void}
     * @private
     */
    handleProcessError(e) {
        const { error } = e.detail;
        
        this.state.status = 'error';
        this.state.error = error.message;
        
        this.updateUI();
        console.error('OpenTruth Error:', error);
    }
    
    /**
     * Reset application state
     * @returns {void}
     * @private
     */
    handleReset() {
        this.state = {
            session: null,
            video: null,
            frames: [],
            persona: 'impatient-teenager',
            status: 'idle',
            progress: 0,
            results: null
        };
        
        this.#state.set(this, this.state);
        this.updateUI();
    }
    
    /**
     * Run frame analysis against persona
     * @returns {Promise<void>}
     * @private
     */
    async runAnalysis() {
        try {
            // TODO: Implement API call to Lambda
            // For now, simulate with timeout
            await this.simulateAnalysis();
            
            // Emit completion
            this.dispatchEvent(new CustomEvent('process-complete', {
                detail: { results: this.generateMockResults() },
                bubbles: true
            }));
        } catch (error) {
            this.dispatchEvent(new CustomEvent('process-error', {
                detail: { error },
                bubbles: true
            }));
        }
    }
    
    /**
     * Simulate analysis (remove once API is ready)
     * @returns {Promise<void>}
     * @private
     */
    async simulateAnalysis() {
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            await new Promise(resolve => setTimeout(resolve, 300));
            this.state.progress = (i / steps) * 100;
            this.updateUI();
        }
    }
    
    /**
     * Generate mock results (remove once API is ready)
     * @returns {Object} Mock analysis results
     * @private
     */
    generateMockResults() {
        return {
            personaId: this.state.persona,
            frictionIndex: 42,
            radarData: [
                { axis: 'Patience', value: 3.2 },
                { axis: 'Boredom', value: 7.8 },
                { axis: 'Excitement', value: 4.5 },
                { axis: 'Frustration', value: 2.1 },
                { axis: 'Clarity', value: 6.5 }
            ],
            timeline: this.state.frames.map((frame, i) => ({
                timestamp: frame.timestamp,
                boredom: 5 + Math.random() * 5,
                excitement: 5 + Math.random() * 5
            })),
            recommendations: [
                'The hook takes too long — consider cutting the first 3 seconds',
                'Visual pacing is too slow for this demographic'
            ]
        };
    }
    
    /**
     * Generate unique session ID
     * @returns {string} UUID-like session identifier
     * @private
     */
    generateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Update UI based on current state
     * @returns {void}
     * @private
     */
    updateUI() {
        // Re-render sections that need updating
        const statusEl = this.shadowRoot.querySelector('.app-status');
        const progressEl = this.shadowRoot.querySelector('.app-progress');
        const resultsEl = this.shadowRoot.querySelector('.app-results');
        
        if (statusEl) {
            statusEl.textContent = this.getStatusText();
            statusEl.className = `app-status status-${this.state.status}`;
        }
        
        if (progressEl) {
            progressEl.style.width = `${this.state.progress}%`;
        }
        
        if (resultsEl && this.state.status === 'complete') {
            resultsEl.classList.remove('hidden');
        }
    }
    
    /**
     * Get human-readable status text
     * @returns {string} Status description
     * @private
     */
    getStatusText() {
        const statusMap = {
            idle: 'Ready to analyze',
            slicing: 'Extracting video frames...',
            ready: 'Ready to process',
            processing: 'Analyzing with persona...',
            complete: 'Analysis complete',
            error: 'Error occurred'
        };
        return statusMap[this.state.status] || 'Unknown';
    }
    
    /**
     * Render component HTML
     * @returns {void}
     * @private
     */
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    min-height: 100vh;
                }
                
                .app-container {
                    max-width: var(--max-width, 1200px);
                    margin: 0 auto;
                    padding: var(--space-6, 1.5rem);
                }
                
                .app-header {
                    text-align: center;
                    margin-bottom: var(--space-10, 2.5rem);
                }
                
                .app-title {
                    font-size: var(--font-size-3xl, 1.875rem);
                    font-weight: var(--font-weight-bold, 700);
                    background: linear-gradient(135deg, var(--color-accent-primary, #6366f1), var(--color-accent-secondary, #8b5cf6));
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    margin-bottom: var(--space-2, 0.5rem);
                }
                
                .app-subtitle {
                    color: var(--color-text-secondary, #94a3b8);
                    font-size: var(--font-size-lg, 1.125rem);
                }
                
                .app-status-bar {
                    display: flex;
                    align-items: center;
                    gap: var(--space-4, 1rem);
                    padding: var(--space-4, 1rem);
                    background: var(--color-surface, #12121a);
                    border: 1px solid var(--color-border, #2a2a3a);
                    border-radius: var(--radius-lg, 0.75rem);
                    margin-bottom: var(--space-6, 1.5rem);
                }
                
                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--color-text-muted, #64748b);
                }
                
                .status-idle .status-dot { background: var(--color-text-muted, #64748b); }
                .status-slicing .status-dot { background: var(--color-accent-warning, #f59e0b); animation: pulse 1.5s infinite; }
                .status-ready .status-dot { background: var(--color-accent-success, #22c55e); }
                .status-processing .status-dot { background: var(--color-accent-primary, #6366f1); animation: pulse 1.5s infinite; }
                .status-complete .status-dot { background: var(--color-accent-success, #22c55e); }
                .status-error .status-dot { background: var(--color-accent-danger, #ef4444); }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                .app-status {
                    flex: 1;
                    font-size: var(--font-size-sm, 0.875rem);
                    color: var(--color-text-secondary, #94a3b8);
                }
                
                .app-progress-container {
                    width: 200px;
                }
                
                .app-progress {
                    height: 4px;
                    background: linear-gradient(90deg, var(--color-accent-primary, #6366f1), var(--color-accent-secondary, #8b5cf6));
                    border-radius: 2px;
                    transition: width 0.3s ease;
                    width: 0%;
                }
                
                .app-layout {
                    display: grid;
                    grid-template-columns: 1fr 300px;
                    gap: var(--space-6, 1.5rem);
                }
                
                @media (max-width: 900px) {
                    .app-layout {
                        grid-template-columns: 1fr;
                    }
                }
                
                .app-main {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-6, 1.5rem);
                }
                
                .app-sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-6, 1.5rem);
                }
                
                .hidden { display: none !important; }
            </style>
            
            <div class="app-container">
                <header class="app-header">
                    <h1 class="app-title">OpenTruth Emotion Engine</h1>
                    <p class="app-subtitle">Validate video impact with synthetic personas</p>
                </header>
                
                <div class="app-status-bar status-${this.state.status}">
                    <span class="status-dot"></span>
                    <span class="app-status">${this.getStatusText()}</span>
                    <div class="app-progress-container">
                        <div class="app-progress" style="width: ${this.state.progress}%"></div>
                    </div>
                </div>
                
                <div class="app-layout">
                    <main class="app-main">
                        <video-uploader></video-uploader>
                        <ffmpeg-slicer class="${this.state.status === 'slicing' ? '' : 'hidden'}"></ffmpeg-slicer>
                        <emotion-config class="${this.state.status === 'ready' || this.state.status === 'processing' ? '' : 'hidden'}"></emotion-config>
                        
                        <div class="app-results ${this.state.status === 'complete' ? '' : 'hidden'}">
                            <radar-chart></radar-chart>
                            <friction-timeline></friction-timeline>
                            <council-report></council-report>
                        </div>
                    </main>
                    
                    <aside class="app-sidebar">
                        <wallet-manager></wallet-manager>
                    </aside>
                </div>
            </div>
        `;
    }
}

// Register custom element
customElements.define('app-shell', AppShell);
