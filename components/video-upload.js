/**
 * @fileoverview Video Upload Web Component
 * Handles video file selection and upload
 * @author OpenTruth Team
 * @version 0.2.0
 */

import { APIManager } from '../managers/api-manager.js';
import { StateManager } from '../managers/state-manager.js';
import { UIManager } from '../managers/ui-manager.js';

/**
 * Video upload component
 */
export class VideoUploadComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.api = new APIManager();
        this.state = new StateManager();
        this.ui = new UIManager();
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    /**
     * Render component HTML
     */
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    padding: 2rem;
                    background: #f5f5f5;
                    border-radius: 8px;
                    text-align: center;
                }

                .upload-area {
                    border: 2px dashed #667eea;
                    border-radius: 8px;
                    padding: 3rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .upload-area:hover {
                    border-color: #764ba2;
                    background: #f0f0ff;
                }

                .upload-area.dragover {
                    border-color: #764ba2;
                    background: #e8e8ff;
                }

                .icon {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                }

                h3 {
                    margin: 0 0 0.5rem 0;
                    color: #333;
                }

                p {
                    color: #666;
                    margin: 0 0 1rem 0;
                }

                input[type="file"] {
                    display: none;
                }

                .btn {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: transform 0.2s ease;
                }

                .btn:hover {
                    transform: translateY(-2px);
                }

                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }

                .file-info {
                    margin-top: 1rem;
                    padding: 1rem;
                    background: white;
                    border-radius: 4px;
                }
            </style>

            <div class="upload-area" id="drop-zone">
                <div class="icon">🎬</div>
                <h3>Upload Video</h3>
                <p>Drag and drop or click to browse</p>
                <p style="font-size: 0.875rem; color: #999;">MP4, MOV, AVI up to 500MB</p>
                <button class="btn" id="upload-btn">Select Video</button>
                <input type="file" id="file-input" accept="video/*">
            </div>

            <div class="file-info" id="file-info" hidden>
                <strong>Selected:</strong> <span id="file-name"></span><br>
                <strong>Size:</strong> <span id="file-size"></span>
            </div>
        `;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const dropZone = this.shadowRoot.getElementById('drop-zone');
        const uploadBtn = this.shadowRoot.getElementById('upload-btn');
        const fileInput = this.shadowRoot.getElementById('file-input');

        // Click to upload
        uploadBtn.addEventListener('click', () => fileInput.click());

        // File selection
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.processFile(files[0]);
            }
        });
    }

    /**
     * Handle file input selection
     * @param {Event} e - Change event
     */
    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    /**
     * Process selected file
     * @param {File} file - Selected video file
     */
    async processFile(file) {
        // Validate file type
        if (!file.type.startsWith('video/')) {
            this.ui.showError('Please select a valid video file');
            return;
        }

        // Validate file size (500MB limit)
        const maxSize = 500 * 1024 * 1024;
        if (file.size > maxSize) {
            this.ui.showError('File size exceeds 500MB limit');
            return;
        }

        // Show file info
        const fileInfo = this.shadowRoot.getElementById('file-info');
        const fileName = this.shadowRoot.getElementById('file-name');
        const fileSize = this.shadowRoot.getElementById('file-size');

        fileInfo.hidden = false;
        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);

        // Store file in state
        this.state.setState({ selectedFile: file });

        // Show persona selection
        this.ui.showSection('persona-section');
    }

    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size
     */
    formatFileSize(bytes) {
        const mb = bytes / (1024 * 1024);
        return mb.toFixed(2) + ' MB';
    }
}

customElements.define('video-upload', VideoUploadComponent);
