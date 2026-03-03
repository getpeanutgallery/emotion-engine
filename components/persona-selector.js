/**
 * @fileoverview Persona Selector Web Component
 * Displays available personas and handles selection
 * @author OpenTruth Team
 * @version 0.2.0
 */

import { StateManager } from '../managers/state-manager.js';
import { UIManager } from '../managers/ui-manager.js';

export class PersonaSelectorComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.state = new StateManager();
        this.ui = new UIManager();
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        const personas = this.state.getState().personas;
        
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; padding: 1rem; }
                .persona-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 1rem;
                    margin-top: 1rem;
                }
                .persona-card {
                    border: 2px solid #ddd;
                    border-radius: 8px;
                    padding: 1rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .persona-card:hover {
                    border-color: #667eea;
                    transform: translateY(-2px);
                }
                .persona-card.selected {
                    border-color: #667eea;
                    background: #f0f0ff;
                }
                h4 { margin: 0 0 0.5rem 0; }
                p { margin: 0; color: #666; font-size: 0.875rem; }
                .btn-start {
                    margin-top: 2rem;
                    padding: 1rem 2rem;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 1rem;
                    cursor: pointer;
                }
                .btn-start:disabled { opacity: 0.6; cursor: not-allowed; }
            </style>
            <div class="persona-grid">
                ${personas.map(p => `
                    <div class="persona-card" data-id="${p.id}">
                        <h4>${p.name}</h4>
                        <p>${p.description || ''}</p>
                    </div>
                `).join('')}
            </div>
            <button class="btn-start" id="start-btn" disabled>Start Analysis</button>
        `;
    }

    setupEventListeners() {
        const cards = this.shadowRoot.querySelectorAll('.persona-card');
        const startBtn = this.shadowRoot.getElementById('start-btn');

        cards.forEach(card => {
            card.addEventListener('click', () => {
                cards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.state.selectPersona(card.dataset.id);
                startBtn.disabled = false;
            });
        });

        startBtn.addEventListener('click', () => this.startAnalysis());
    }

    async startAnalysis() {
        const { selectedFile, selectedPersona } = this.state.getState();
        if (!selectedFile || !selectedPersona) return;

        this.ui.showSection('progress-section');
        // TODO: Call API to start analysis
        console.log('Starting analysis:', selectedFile.name, selectedPersona);
    }
}

customElements.define('persona-selector', PersonaSelectorComponent);
