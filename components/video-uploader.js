/**
 * Video Uploader Component
 * Handles drag-drop file input and YouTube URL capture
 * 
 * @module components/video-uploader
 * @author Cookie (OpenClaw)
 * @version 0.1.0
 */

/**
 * VideoUploader — File drop zone and URL input
 * 
 * @extends HTMLElement
 */
class VideoUploader extends HTMLElement {
    /** @type {WeakMap} Private state storage */
    #state = new WeakMap();
    
    /**
     * Creates an instance of VideoUploader
     */
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        /** @type {Object} Component state */
        this.state = {
            isDragging: false,
            file: null,
            url: '',
            maxFileSize: 500 * 1024 * 1024 // 500MB
        };
        
        this.#state.set(this, this.state);
    }
    
    /**
     * @returns {string[]} Observed attributes
     * @static
     */
    static get observedAttributes() {
        return ['disabled'];
    }
    
    /**
     * Lifecycle: Element connected to DOM
     * @returns {void}
     */
    connectedCallback() {
        this.render();
        this.bindEvents();
        this.tryLoadTestVideo();
    }
    
    /**
     * Lifecycle: Element disconnected from DOM
     * @returns {void}
     */
    disconnectedCallback() {
        this.unbindEvents();
    }
    
    /**
     * Lifecycle: Attribute changed
     * @param {string} name - Attribute name
     * @param {string} oldValue - Previous value
     * @param {string} newValue - New value
     * @returns {void}
     */
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'disabled' && this.shadowRoot) {
            const dropZone = this.shadowRoot.querySelector('.drop-zone');
            const urlInput = this.shadowRoot.querySelector('.url-input');
            
            if (dropZone) dropZone.disabled = newValue !== null;
            if (urlInput) urlInput.disabled = newValue !== null;
        }
    }
    
    /**
     * Bind DOM event listeners
     * @returns {void}
     * @private
     */
    bindEvents() {
        const dropZone = this.shadowRoot.querySelector('.drop-zone');
        const urlInput = this.shadowRoot.querySelector('.url-input');
        const urlSubmit = this.shadowRoot.querySelector('.url-submit');
        const fileInput = this.shadowRoot.querySelector('.file-input');
        
        if (dropZone) {
            dropZone.addEventListener('dragenter', this.handleDragEnter.bind(this));
            dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
            dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
            dropZone.addEventListener('drop', this.handleDrop.bind(this));
            dropZone.addEventListener('click', () => fileInput?.click());
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }
        
        if (urlSubmit) {
            urlSubmit.addEventListener('click', this.handleUrlSubmit.bind(this));
        }
        
        if (urlInput) {
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleUrlSubmit();
            });
        }
        
        // YouTube help modal
        const youtubeHelp = this.shadowRoot.querySelector('.youtube-help');
        if (youtubeHelp) {
            youtubeHelp.addEventListener('click', (e) => {
                e.preventDefault();
                this.showYouTubeModal();
            });
        }
    }
    
    /**
     * Show YouTube help modal
     * @returns {void}
     * @private
     */
    showYouTubeModal() {
        const modal = document.createElement('div');
        modal.className = 'youtube-modal';
        modal.innerHTML = `
            <div class="youtube-modal-content">
                <button class="youtube-modal-close">&times;</button>
                <h3 class="youtube-modal-title">Testing with YouTube Videos</h3>
                <p style="color: var(--color-text-secondary, #94a3b8); margin-bottom: 1rem; font-size: 0.875rem;">
                    Browsers block direct YouTube downloads due to CORS. Here are two ways to test:
                </p>
                
                <div style="background: var(--color-surface-elevated, #1a1a24); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                    <div style="font-weight: 600; color: var(--color-accent-primary, #6366f1); margin-bottom: 0.5rem;">Option 1: Dev Proxy (Recommended)</div>
                    <p style="font-size: 0.8rem; color: var(--color-text-secondary, #94a3b8); margin-bottom: 0.5rem;">
                        Use the included dev proxy to download and serve locally:
                    </p>
                    <code style="display: block; background: #0a0a0f; padding: 0.75rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.75rem; color: #64748b; word-break: break-all;">
                        cd /home/derrick/Documents/GitHub/OpenTruth/emotion-engine<br>
                        node dev-proxy.js "https://youtu.be/9txkGBj_trg"
                    </code>
                </div>
                
                <div style="background: var(--color-surface-elevated, #1a1a24); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                    <div style="font-weight: 600; color: var(--color-accent-success, #22c55e); margin-bottom: 0.5rem;">Option 2: Manual Download</div>
                    <p style="font-size: 0.8rem; color: var(--color-text-secondary, #94a3b8); margin-bottom: 0.5rem;">
                        Download with yt-dlp, then drag the file here:
                    </p>
                    <code style="display: block; background: #0a0a0f; padding: 0.75rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.75rem; color: #64748b; word-break: break-all;">
                        yt-dlp -f "bv*[height<=720]+ba/b[height<=720]" "URL" -o "video.mp4"
                    </code>
                </div>
                
                <button class="btn btn-primary" style="width: 100%;" onclick="this.closest('.youtube-modal').remove()">Got it</button>
            </div>
        `;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        modal.querySelector('.youtube-modal-close').addEventListener('click', () => {
            modal.remove();
        });
        
        document.body.appendChild(modal);
    }
    
    /**
     * Unbind DOM event listeners
     * @returns {void}
     * @private
     */
    unbindEvents() {
        const dropZone = this.shadowRoot.querySelector('.drop-zone');
        const fileInput = this.shadowRoot.querySelector('.file-input');
        
        if (dropZone) {
            dropZone.removeEventListener('dragenter', this.handleDragEnter);
            dropZone.removeEventListener('dragover', this.handleDragOver);
            dropZone.removeEventListener('dragleave', this.handleDragLeave);
            dropZone.removeEventListener('drop', this.handleDrop);
        }
        
        if (fileInput) {
            fileInput.removeEventListener('change', this.handleFileSelect);
        }
    }
    
    /**
     * Handle drag enter
     * @param {DragEvent} e - Drag event
     * @returns {void}
     * @private
     */
    handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        this.state.isDragging = true;
        this.updateDropZone();
    }
    
    /**
     * Handle drag over
     * @param {DragEvent} e - Drag event
     * @returns {void}
     * @private
     */
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    /**
     * Handle drag leave
     * @param {DragEvent} e - Drag event
     * @returns {void}
     * @private
     */
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        this.state.isDragging = false;
        this.updateDropZone();
    }
    
    /**
     * Handle file drop
     * @param {DragEvent} e - Drop event
     * @returns {void}
     * @private
     */
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.state.isDragging = false;
        this.updateDropZone();
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.validateAndSetFile(files[0]);
        }
    }
    
    /**
     * Handle file selection via input
     * @param {Event} e - Change event
     * @returns {void}
     * @private
     */
    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.validateAndSetFile(files[0]);
        }
    }
    
    /**
     * Handle YouTube URL submission
     * @returns {void}
     * @private
     */
    handleUrlSubmit() {
        const urlInput = this.shadowRoot.querySelector('.url-input');
        const url = urlInput?.value.trim();
        
        if (!url) return;
        
        if (!this.isValidUrl(url)) {
            this.showError('Please enter a valid URL');
            return;
        }
        
        this.state.url = url;
        this.emitVideoSelected(null, url);
    }
    
    /**
     * Validate and set selected file
     * @param {File} file - Selected file
     * @returns {void}
     * @private
     */
    validateAndSetFile(file) {
        // Check file type
        const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const validExtensions = ['mp4', 'webm', 'ogg', 'mov', 'mkv'];
        
        if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
            this.showError('Please select a valid video file (MP4, WebM, OGG, MOV)');
            return;
        }
        
        // Check file size
        if (file.size > this.state.maxFileSize) {
            this.showError(`File too large. Maximum size is ${this.formatBytes(this.state.maxFileSize)}`);
            return;
        }
        
        this.state.file = file;
        this.emitVideoSelected(file, null);
    }
    
    /**
     * Emit video-selected event
     * @param {File|null} file - Selected file
     * @param {string|null} url - URL string
     * @returns {void}
     * @private
     */
    emitVideoSelected(file, url) {
        this.dispatchEvent(new CustomEvent('video-selected', {
            detail: { file, url },
            bubbles: true,
            composed: true
        }));
    }
    
    /**
     * Validate URL format
     * @param {string} url - URL to validate
     * @returns {boolean} Whether URL is valid
     * @private
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Format bytes to human readable
     * @param {number} bytes - Byte count
     * @returns {string} Formatted string
     * @private
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
            setTimeout(() => errorEl.classList.add('hidden'), 5000);
        }
    }
    
    /**
     * Update drop zone visual state
     * @returns {void}
     * @private
     */
    updateDropZone() {
        const dropZone = this.shadowRoot.querySelector('.drop-zone');
        if (dropZone) {
            dropZone.classList.toggle('is-dragging', this.state.isDragging);
        }
    }
    
    /**
     * Render component HTML
     * @returns {void}
     * @private
     */
    /**
     * Try to load test video from dev proxy
     * @returns {void}
     * @private
     */
    async tryLoadTestVideo() {
        try {
            const response = await fetch('/api/video-info', { method: 'HEAD' });
            if (response.ok) {
                // Dev proxy is running, show quick load button
                const testBtn = this.shadowRoot.querySelector('.test-video-btn');
                if (testBtn) {
                    testBtn.classList.remove('hidden');
                    testBtn.addEventListener('click', () => {
                        this.state.url = '/test-video';
                        this.emitVideoSelected(null, '/test-video');
                    });
                }
            }
        } catch (e) {
            // Dev proxy not running, ignore
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
                
                .uploader-card {
                    background: var(--color-surface, #12121a);
                    border: 1px solid var(--color-border, #2a2a3a);
                    border-radius: var(--radius-lg, 0.75rem);
                    padding: var(--space-6, 1.5rem);
                }
                
                .uploader-title {
                    font-size: var(--font-size-lg, 1.125rem);
                    font-weight: var(--font-weight-semibold, 600);
                    margin-bottom: var(--space-4, 1rem);
                    color: var(--color-text-primary, #f8fafc);
                }
                
                .drop-zone {
                    border: 2px dashed var(--color-border, #2a2a3a);
                    border-radius: var(--radius-lg, 0.75rem);
                    padding: var(--space-8, 2rem);
                    text-align: center;
                    cursor: pointer;
                    transition: all var(--transition-fast, 150ms ease);
                    background: var(--color-surface-elevated, #1a1a24);
                }
                
                .drop-zone:hover {
                    border-color: var(--color-accent-primary, #6366f1);
                    background: rgba(99, 102, 241, 0.05);
                }
                
                .drop-zone.is-dragging {
                    border-color: var(--color-accent-primary, #6366f1);
                    background: rgba(99, 102, 241, 0.1);
                }
                
                .drop-zone-icon {
                    font-size: 2rem;
                    margin-bottom: var(--space-3, 0.75rem);
                    opacity: 0.7;
                }
                
                .drop-zone-text {
                    font-size: var(--font-size-base, 1rem);
                    color: var(--color-text-primary, #f8fafc);
                    margin-bottom: var(--space-2, 0.5rem);
                }
                
                .drop-zone-hint {
                    font-size: var(--font-size-sm, 0.875rem);
                    color: var(--color-text-muted, #64748b);
                }
                
                .file-input {
                    display: none;
                }
                
                .url-section {
                    margin-top: var(--space-6, 1.5rem);
                    padding-top: var(--space-6, 1.5rem);
                    border-top: 1px solid var(--color-border, #2a2a3a);
                }
                
                .url-label {
                    font-size: var(--font-size-sm, 0.875rem);
                    color: var(--color-text-secondary, #94a3b8);
                    margin-bottom: var(--space-3, 0.75rem);
                    display: block;
                }
                
                .url-input-group {
                    display: flex;
                    gap: var(--space-2, 0.5rem);
                }
                
                .url-input {
                    flex: 1;
                    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
                    background: var(--color-surface-elevated, #1a1a24);
                    border: 1px solid var(--color-border, #2a2a3a);
                    border-radius: var(--radius-md, 0.5rem);
                    color: var(--color-text-primary, #f8fafc);
                    font-size: var(--font-size-base, 1rem);
                }
                
                .url-input:focus {
                    outline: none;
                    border-color: var(--color-accent-primary, #6366f1);
                }
                
                .url-input::placeholder {
                    color: var(--color-text-muted, #64748b);
                }
                
                .url-submit {
                    padding: var(--space-3, 0.75rem) var(--space-5, 1.25rem);
                    background: var(--color-accent-primary, #6366f1);
                    border: none;
                    border-radius: var(--radius-md, 0.5rem);
                    color: white;
                    font-weight: var(--font-weight-medium, 500);
                    cursor: pointer;
                    transition: background var(--transition-fast, 150ms ease);
                }
                
                .url-submit:hover {
                    background: var(--color-accent-secondary, #8b5cf6);
                }
                
                .url-hint {
                    margin-top: var(--space-2, 0.5rem);
                    font-size: var(--font-size-xs, 0.75rem);
                    color: var(--color-text-muted, #64748b);
                }
                
                .url-hint a {
                    color: var(--color-accent-primary, #6366f1);
                    text-decoration: underline;
                    cursor: pointer;
                }
                
                .youtube-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: var(--space-4, 1rem);
                }
                
                .youtube-modal-content {
                    background: var(--color-surface, #12121a);
                    border: 1px solid var(--color-border, #2a2a3a);
                    border-radius: var(--radius-lg, 0.75rem);
                    padding: var(--space-6, 1.5rem);
                    max-width: 600px;
                    width: 100%;
                }
                
                .youtube-modal-title {
                    font-size: var(--font-size-lg, 1.125rem);
                    font-weight: var(--font-weight-semibold, 600);
                    margin-bottom: var(--space-4, 1rem);
                    color: var(--color-text-primary, #f8fafc);
                }
                
                .youtube-modal-close {
                    float: right;
                    background: none;
                    border: none;
                    color: var(--color-text-muted, #64748b);
                    font-size: 1.5rem;
                    cursor: pointer;
                }
                
                .youtube-modal-close:hover {
                    color: var(--color-text-primary, #f8fafc);
                }
                
                .error-message {
                    margin-top: var(--space-3, 0.75rem);
                    padding: var(--space-3, 0.75rem);
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: var(--radius-md, 0.5rem);
                    color: var(--color-accent-danger, #ef4444);
                    font-size: var(--font-size-sm, 0.875rem);
                }
                
                .hidden { display: none !important; }
            </style>
            
            <div class="uploader-card">
                <h3 class="uploader-title">Upload Video</h3>
                
                <div class="drop-zone" role="button" tabindex="0">
                    <div class="drop-zone-icon">📹</div>
                    <div class="drop-zone-text">Drop video here or click to browse</div>
                    <div class="drop-zone-hint">Supports MP4, WebM, MOV (max 500MB)</div>
                </div>
                
                <input type="file" class="file-input" accept="video/*" />
                
                <div class="url-section">
                    <label class="url-label">Or paste a direct video URL (MP4/WebM)</label>
                    <div class="url-input-group">
                        <input 
                            type="url" 
                            class="url-input" 
                            placeholder="https://example.com/video.mp4"
                        />
                        <button class="url-submit">Load</button>
                    </div>
                    <p class="url-hint">
                        ⚠️ YouTube URLs blocked by CORS. 
                        <a href="#" class="youtube-help">How to test with YouTube</a>
                    </p>
                </div>
                
                <button class="test-video-btn hidden" style="width: 100%; margin-top: 1rem; padding: 0.75rem; background: linear-gradient(135deg, var(--color-accent-primary, #6366f1), var(--color-accent-secondary, #8b5cf6)); border: none; border-radius: var(--radius-md, 0.5rem); color: white; font-weight: var(--font-weight-medium, 500); cursor: pointer;">
                    🎬 Load Test Video (CoD Trailer)
                </button>
                
                <div class="error-message hidden"></div>
            </div>
        `;
    }
}

// Register custom element
customElements.define('video-uploader', VideoUploader);
