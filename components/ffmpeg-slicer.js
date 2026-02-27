/**
 * FFmpeg Slicer Component
 * Extracts frames from video using ffmpeg.wasm (every 2 seconds)
 * 
 * @module components/ffmpeg-slicer
 * @author Cookie (OpenClaw)
 * @version 0.1.0
 */

/**
 * FFmpegSlicer — Client-side video frame extraction
 * Uses Web Workers to avoid blocking the main thread
 * 
 * @extends HTMLElement
 */
class FFmpegSlicer extends HTMLElement {
    /** @type {WeakMap} Private state storage */
    #state = new WeakMap();
    
    /**
     * Creates an instance of FFmpegSlicer
     */
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        /** @type {Object} Component state */
        this.state = {
            isProcessing: false,
            progress: 0,
            frames: [],
            metadata: null,
            frameInterval: 2, // seconds
            worker: null
        };
        
        this.#state.set(this, this.state);
    }
    
    /**
     * @returns {string[]} Observed attributes
     * @static
     */
    static get observedAttributes() {
        return ['interval'];
    }
    
    /**
     * Lifecycle: Element connected to DOM
     * @returns {void}
     */
    connectedCallback() {
        this.render();
        this.initWorker();
    }
    
    /**
     * Lifecycle: Element disconnected from DOM
     * @returns {void}
     */
    disconnectedCallback() {
        this.terminateWorker();
    }
    
    /**
     * Lifecycle: Attribute changed
     * @param {string} name - Attribute name
     * @param {string} oldValue - Previous value
     * @param {string} newValue - New value
     * @returns {void}
     */
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'interval' && newValue) {
            this.state.frameInterval = parseInt(newValue, 10) || 2;
        }
    }
    
    /**
     * Initialize Web Worker for FFmpeg processing
     * @returns {void}
     * @private
     */
    initWorker() {
        // Inline worker to avoid external file dependency
        const workerCode = `
            let ffmpeg = null;
            let FFmpegModule = null;
            
            self.onmessage = async function(e) {
                const { type, file, interval } = e.data;
                
                if (type === 'INIT') {
                    try {
                        // Load ffmpeg.wasm from CDN with core files
                        importScripts('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');
                        importScripts('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js');
                        
                        FFmpegModule = self.FFmpeg;
                        const { FFmpeg } = FFmpegModule;
                        ffmpeg = new FFmpeg();
                        
                        ffmpeg.on('log', ({ message }) => {
                            self.postMessage({ type: 'LOG', message });
                        });
                        
                        ffmpeg.on('progress', ({ progress, time }) => {
                            self.postMessage({ type: 'PROGRESS', progress: progress || 0, time });
                        });
                        
                        await ffmpeg.load({
                            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js'
                        });
                        
                        self.postMessage({ type: 'READY' });
                    } catch (err) {
                        self.postMessage({ type: 'ERROR', error: 'FFmpeg init failed: ' + err.message });
                    }
                }
                
                if (type === 'EXTRACT') {
                    try {
                        if (!ffmpeg) {
                            throw new Error('FFmpeg not initialized');
                        }
                        
                        // Write video file to virtual FS
                        await ffmpeg.writeFile('input.mp4', new Uint8Array(file));
                        
                        // Get video info first
                        let duration = 0;
                        try {
                            await ffmpeg.exec(['-i', 'input.mp4']);
                        } catch (e) {
                            // FFmpeg returns error code even on success for -i
                            // Extract duration from stderr if possible
                        }
                        
                        // Extract frames every N seconds using fps filter
                        // fps=1/2 means 1 frame every 2 seconds
                        const fpsValue = 1 / interval;
                        
                        self.postMessage({ type: 'LOG', message: 'Extracting frames every ' + interval + 's...' });
                        
                        await ffmpeg.exec([
                            '-i', 'input.mp4',
                            '-vf', 'fps=' + fpsValue + ',scale=480:-1',
                            '-q:v', '5',
                            '-f', 'image2pipe',
                            '-vcodec', 'mjpeg',
                            'frames.mjpeg'
                        ]);
                        
                        // Alternative: extract to files then read
                        await ffmpeg.exec([
                            '-i', 'input.mp4',
                            '-vf', 'fps=' + fpsValue + ',scale=480:-1',
                            '-q:v', '5',
                            'frame_%04d.jpg'
                        ]);
                        
                        // Read extracted frames
                        const frames = [];
                        let frameIndex = 1;
                        
                        while (true) {
                            const fileName = 'frame_' + String(frameIndex).padStart(4, '0') + '.jpg';
                            try {
                                const data = await ffmpeg.readFile(fileName);
                                const base64 = arrayBufferToBase64(data);
                                
                                frames.push({
                                    index: frameIndex - 1,
                                    timestamp: (frameIndex - 1) * interval * 1000,
                                    base64: base64,
                                    type: 'image/jpeg'
                                });
                                
                                // Cleanup file
                                try {
                                    await ffmpeg.deleteFile(fileName);
                                } catch (e) {}
                                
                                frameIndex++;
                            } catch (e) {
                                // No more frames
                                break;
                            }
                        }
                        
                        // Cleanup input file
                        try {
                            await ffmpeg.deleteFile('input.mp4');
                        } catch (e) {}
                        
                        // Calculate duration
                        duration = frames.length * interval;
                        
                        const metadata = {
                            frameCount: frames.length,
                            duration: duration,
                            interval: interval,
                            averageFrameSize: frames.reduce((sum, f) => sum + (f.base64.length * 0.75), 0) / frames.length
                        };
                        
                        self.postMessage({
                            type: 'COMPLETE',
                            frames: frames,
                            metadata: metadata
                        });
                        
                    } catch (error) {
                        self.postMessage({
                            type: 'ERROR',
                            error: error.message || 'Unknown error during extraction'
                        });
                    }
                }
            };
            
            function arrayBufferToBase64(buffer) {
                const bytes = new Uint8Array(buffer);
                let binary = '';
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                return btoa(binary);
            }
        `;
        
        // Create worker from blob
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.state.worker = new Worker(URL.createObjectURL(blob));
        
        // Bind worker message handler
        this.state.worker.onmessage = this.handleWorkerMessage.bind(this);
        
        // Initialize FFmpeg in worker
        this.state.worker.postMessage({ type: 'INIT' });
    }
    
    /**
     * Terminate Web Worker
     * @returns {void}
     * @private
     */
    terminateWorker() {
        if (this.state.worker) {
            this.state.worker.terminate();
            this.state.worker = null;
        }
    }
    
    /**
     * Handle messages from Web Worker
     * @param {MessageEvent} e - Worker message
     * @returns {void}
     * @private
     */
    handleWorkerMessage(e) {
        const { type, progress, frames, metadata, error, message } = e.data;
        
        switch (type) {
            case 'READY':
                console.log('FFmpeg.wasm ready in worker');
                break;
                
            case 'LOG':
                // Debug logging (can be disabled in production)
                // console.log('FFmpeg:', message);
                break;
                
            case 'PROGRESS':
                this.state.progress = Math.round(progress * 100);
                this.updateProgress();
                break;
                
            case 'COMPLETE':
                this.state.isProcessing = false;
                this.state.frames = frames;
                this.state.metadata = metadata;
                this.state.progress = 100;
                this.updateProgress();
                this.emitFramesExtracted();
                break;
                
            case 'ERROR':
                this.state.isProcessing = false;
                this.showError(error);
                break;
        }
    }
    
    /**
     * Start video processing
     * @param {Object} video - Video object {file, url}
     * @returns {Promise<void>}
     * @public
     */
    async process(video) {
        if (this.state.isProcessing) {
            console.warn('Slicer already processing');
            return;
        }
        
        // Check for YouTube URL
        if (video.url && this.isYouTubeUrl(video.url)) {
            this.showYouTubeInstructions(video.url);
            return;
        }
        
        this.state.isProcessing = true;
        this.state.progress = 0;
        this.state.frames = [];
        this.updateProgress();
        
        try {
            let fileData = null;
            
            if (video.file) {
                // Local file
                fileData = await video.file.arrayBuffer();
                this.state.videoInfo = {
                    name: video.file.name,
                    size: video.file.size
                };
            } else if (video.url) {
                // Direct URL (non-YouTube) - fetch via proxy
                try {
                    const response = await fetch('/api/proxy?url=' + encodeURIComponent(video.url));
                    if (!response.ok) throw new Error('Proxy fetch failed');
                    fileData = await response.arrayBuffer();
                } catch (e) {
                    this.showError('Cannot fetch URL directly. Please download the video file and upload it instead.');
                    this.state.isProcessing = false;
                    return;
                }
            }
            
            if (!fileData) {
                this.showError('No video data available');
                this.state.isProcessing = false;
                return;
            }
            
            // Check file size (100MB limit for browser memory)
            if (fileData.byteLength > 100 * 1024 * 1024) {
                this.showError('Video too large (>100MB). Please use a shorter clip or lower resolution.');
                this.state.isProcessing = false;
                return;
            }
            
            // Send to worker with transferable array buffer
            this.state.worker.postMessage({
                type: 'EXTRACT',
                file: fileData,
                interval: this.state.frameInterval
            }, [fileData]);
            
        } catch (error) {
            this.showError('Failed to load video: ' + error.message);
            this.state.isProcessing = false;
        }
    }
    
    /**
     * Check if URL is YouTube
     * @param {string} url - URL to check
     * @returns {boolean} Is YouTube URL
     * @private
     */
    isYouTubeUrl(url) {
        return url.includes('youtube.com') || url.includes('youtu.be');
    }
    
    /**
     * Show YouTube download instructions
     * @param {string} url - YouTube URL
     * @returns {void}
     * @private
     */
    showYouTubeInstructions(url) {
        const instructionsEl = this.shadowRoot.querySelector('.youtube-instructions');
        if (instructionsEl) {
            instructionsEl.classList.remove('hidden');
            instructionsEl.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 0.5rem; padding: 1rem; margin-top: 1rem;">
                    <div style="font-weight: 600; color: #ef4444; margin-bottom: 0.5rem;">⚠️ YouTube URLs Require Local Download</div>
                    <p style="font-size: 0.875rem; color: #94a3b8; margin-bottom: 0.75rem;">
                        Browsers cannot download YouTube videos directly due to CORS restrictions. 
                        Please download this video locally and upload the file:
                    </p>
                    <code style="display: block; background: #0a0a0f; padding: 0.75rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.8rem; color: #64748b; word-break: break-all; margin-bottom: 0.75rem;">
                        # Using yt-dlp (recommended)<br>
                        yt-dlp -f "bv*[height<=720]+ba/b[height<=720]" "${url}" -o "cod_trailer.mp4"
                    </code>
                    <p style="font-size: 0.75rem; color: #64748b;">
                        Then drag the downloaded file into the upload area above.
                    </p>
                </div>
            `;
        }
        
        // Emit event so app-shell can show in uploader too
        this.dispatchEvent(new CustomEvent('youtube-url-detected', {
            detail: { url },
            bubbles: true,
            composed: true
        }));
    }
    
    /**
     * Emit frames-extracted event
     * @returns {void}
     * @private
     */
    emitFramesExtracted() {
        this.dispatchEvent(new CustomEvent('frames-extracted', {
            detail: {
                frames: this.state.frames,
                metadata: this.state.metadata
            },
            bubbles: true,
            composed: true
        }));
    }
    
    /**
     * Update progress display
     * @returns {void}
     * @private
     */
    updateProgress() {
        const progressBar = this.shadowRoot.querySelector('.progress-bar-fill');
        const progressText = this.shadowRoot.querySelector('.progress-text');
        
        if (progressBar) {
            progressBar.style.width = `${this.state.progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(this.state.progress)}%`;
        }
        
        // Update frame count
        const frameCount = this.shadowRoot.querySelector('.frame-count');
        if (frameCount) {
            if (this.state.frames.length > 0) {
                frameCount.textContent = `Extracted ${this.state.frames.length} frames`;
            } else if (this.state.isProcessing) {
                frameCount.textContent = 'Processing...';
            } else {
                frameCount.textContent = 'Waiting for video';
            }
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message
     * @returns {void}
     * @private
     */
    showError(message) {
        const errorEl = this.shadowRoot.querySelector('.error-message');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
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
                }
                
                :host {
                    display: block;
                }
                
                :host(.hidden) {
                    display: none !important;
                }
                
                .slicer-card {
                    background: var(--color-surface, #12121a);
                    border: 1px solid var(--color-border, #2a2a3a);
                    border-radius: var(--radius-lg, 0.75rem);
                    padding: var(--space-6, 1.5rem);
                }
                
                .slicer-title {
                    font-size: var(--font-size-lg, 1.125rem);
                    font-weight: var(--font-weight-semibold, 600);
                    margin-bottom: var(--space-4, 1rem);
                    color: var(--color-text-primary, #f8fafc);
                    display: flex;
                    align-items: center;
                    gap: var(--space-3, 0.75rem);
                }
                
                .slicer-icon {
                    font-size: 1.25rem;
                }
                
                .progress-container {
                    margin-bottom: var(--space-4, 1rem);
                }
                
                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: var(--space-2, 0.5rem);
                }
                
                .progress-label {
                    font-size: var(--font-size-sm, 0.875rem);
                    color: var(--color-text-secondary, #94a3b8);
                }
                
                .progress-text {
                    font-size: var(--font-size-sm, 0.875rem);
                    color: var(--color-accent-primary, #6366f1);
                    font-weight: var(--font-weight-medium, 500);
                }
                
                .progress-bar {
                    width: 100%;
                    height: 6px;
                    background: var(--color-surface-elevated, #1a1a24);
                    border-radius: var(--radius-full, 9999px);
                    overflow: hidden;
                }
                
                .progress-bar-fill {
                    height: 100%;
                    background: linear-gradient(90deg, var(--color-accent-primary, #6366f1), var(--color-accent-secondary, #8b5cf6));
                    border-radius: var(--radius-full, 9999px);
                    transition: width 0.3s ease;
                    width: 0%;
                }
                
                .slicer-details {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: var(--space-4, 1rem);
                    margin-top: var(--space-4, 1rem);
                }
                
                .detail-item {
                    background: var(--color-surface-elevated, #1a1a24);
                    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
                    border-radius: var(--radius-md, 0.5rem);
                    border: 1px solid var(--color-border, #2a2a3a);
                }
                
                .detail-label {
                    font-size: var(--font-size-xs, 0.75rem);
                    color: var(--color-text-muted, #64748b);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: var(--space-1, 0.25rem);
                }
                
                .detail-value {
                    font-size: var(--font-size-lg, 1.125rem);
                    font-weight: var(--font-weight-semibold, 600);
                    color: var(--color-text-primary, #f8fafc);
                }
                
                .error-message {
                    margin-top: var(--space-4, 1rem);
                    padding: var(--space-3, 0.75rem);
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: var(--radius-md, 0.5rem);
                    color: var(--color-accent-danger, #ef4444);
                    font-size: var(--font-size-sm, 0.875rem);
                }
                
                .hidden { display: none !important; }
            </style>
            
            <div class="slicer-card">
                <h3 class="slicer-title">
                    <span class="slicer-icon">⚡</span>
                    Extracting Frames
                </h3>
                
                <div class="progress-container">
                    <div class="progress-header">
                        <span class="progress-label">Processing video...</span>
                        <span class="progress-text">0%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-bar-fill"></div>
                    </div>
                </div>
                
                <div class="slicer-details">
                    <div class="detail-item">
                        <div class="detail-label">Interval</div>
                        <div class="detail-value">${this.state.frameInterval}s</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Status</div>
                        <div class="detail-value frame-count">Processing...</div>
                    </div>
                </div>
                
                <div class="youtube-instructions hidden"></div>
                <div class="error-message hidden"></div>
            </div>
        `;
    }
}

// Register custom element
customElements.define('ffmpeg-slicer', FFmpegSlicer);
