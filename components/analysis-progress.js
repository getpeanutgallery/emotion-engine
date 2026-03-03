/**
 * @fileoverview Analysis Progress Web Component
 * Displays real-time analysis progress
 * @author OpenTruth Team
 * @version 0.2.0
 */

import { StateManager } from '../managers/state-manager.js';

export class AnalysisProgressComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.state = new StateManager();
    }

    connectedCallback() {
        this.render();
        this.state.subscribe(() => this.update());
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; padding: 2rem; text-align: center; }
                progress {
                    width: 100%;
                    height: 2rem;
                    border-radius: 4px;
                }
                #message { margin-top: 1rem; color: #666; }
            </style>
            <progress id="progress" max="100" value="0"></progress>
            <p id="message">Initializing...</p>
        `;
    }

    update() {
        const { progress, analysisStatus } = this.state.getState();
        const progressEl = this.shadowRoot.getElementById('progress');
        const messageEl = this.shadowRoot.getElementById('message');
        
        if (progressEl) progressEl.value = progress;
        if (messageEl) messageEl.textContent = analysisStatus;
    }
}

customElements.define('analysis-progress', AnalysisProgressComponent);
