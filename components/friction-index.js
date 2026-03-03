/**
 * @fileoverview Friction Index Web Component
 * Displays overall friction score
 * @author OpenTruth Team
 * @version 0.2.0
 */

export class FrictionIndexComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; padding: 1rem; text-align: center; }
                .score {
                    font-size: 3rem;
                    font-weight: bold;
                    color: #667eea;
                }
                .label { color: #666; }
            </style>
            <div class="score">--</div>
            <div class="label">Friction Index</div>
        `;
        // TODO: Display friction index from results
    }
}

customElements.define('friction-index', FrictionIndexComponent);
