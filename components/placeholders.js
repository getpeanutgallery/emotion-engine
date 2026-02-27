/**
 * Placeholder Components
 * Stub implementations for remaining Web Components
 * Will be fleshed out in later sprints
 * 
 * @module components/placeholders
 * @author Cookie (OpenClaw)
 * @version 0.1.0
 */

/**
 * EmotionConfig — Persona and lens selection (MVP: hardcoded impatient-teenager)
 * @extends HTMLElement
 */
class EmotionConfig extends HTMLElement {
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
                :host {
                    display: block;
                }
                .card {
                    background: var(--color-surface, #12121a);
                    border: 1px solid var(--color-border, #2a2a3a);
                    border-radius: var(--radius-lg, 0.75rem);
                    padding: var(--space-6, 1.5rem);
                }
                .title {
                    font-size: var(--font-size-lg, 1.125rem);
                    font-weight: var(--font-weight-semibold, 600);
                    margin-bottom: var(--space-4, 1rem);
                    color: var(--color-text-primary, #f8fafc);
                }
                .persona-info {
                    background: var(--color-surface-elevated, #1a1a24);
                    border: 1px solid var(--color-accent-primary, #6366f1);
                    border-radius: var(--radius-md, 0.5rem);
                    padding: var(--space-4, 1rem);
                    margin-bottom: var(--space-4, 1rem);
                }
                .persona-name {
                    font-weight: var(--font-weight-semibold, 600);
                    color: var(--color-accent-primary, #6366f1);
                    margin-bottom: var(--space-2, 0.5rem);
                }
                .persona-desc {
                    font-size: var(--font-size-sm, 0.875rem);
                    color: var(--color-text-secondary, #94a3b8);
                    margin-bottom: var(--space-3, 0.75rem);
                }
                .lens-list {
                    display: flex;
                    gap: var(--space-2, 0.5rem);
                    flex-wrap: wrap;
                }
                .lens-tag {
                    background: rgba(99, 102, 241, 0.1);
                    border: 1px solid rgba(99, 102, 241, 0.3);
                    border-radius: var(--radius-sm, 0.25rem);
                    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
                    font-size: var(--font-size-xs, 0.75rem);
                    color: var(--color-accent-primary, #6366f1);
                }
                .action-btn {
                    width: 100%;
                    padding: var(--space-4, 1rem);
                    background: linear-gradient(135deg, var(--color-accent-primary, #6366f1), var(--color-accent-secondary, #8b5cf6));
                    border: none;
                    border-radius: var(--radius-md, 0.5rem);
                    color: white;
                    font-weight: var(--font-weight-semibold, 600);
                    cursor: pointer;
                    transition: transform var(--transition-fast, 150ms ease), box-shadow var(--transition-fast, 150ms ease);
                }
                .action-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
                }
            </style>
            
            <div class="card">
                <h3 class="title">Configure Test</h3>
                
                <div class="persona-info">
                    <div class="persona-name">🧒 Impatient Teenager</div>
                    <div class="persona-desc">Abandons if hook takes >3 seconds. Tests viral video pacing.</div>
                    <div class="lens-list">
                        <span class="lens-tag">Patience</span>
                        <span class="lens-tag">Boredom</span>
                        <span class="lens-tag">Excitement</span>
                    </div>
                </div>
                
                <button class="action-btn" onclick="this.dispatchEvent(new CustomEvent('process-start', {detail: {personaId: 'impatient-teenager'}, bubbles: true, composed: true}))">
                    Start Analysis
                </button>
            </div>
        `;
    }
}

/**
 * RadarChart — 5-axis emotional visualization
 * @extends HTMLElement
 */
class RadarChart extends HTMLElement {
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
                :host {
                    display: block;
                }
                .card {
                    background: var(--color-surface, #12121a);
                    border: 1px solid var(--color-border, #2a2a3a);
                    border-radius: var(--radius-lg, 0.75rem);
                    padding: var(--space-6, 1.5rem);
                }
                .title {
                    font-size: var(--font-size-lg, 1.125rem);
                    font-weight: var(--font-weight-semibold, 600);
                    margin-bottom: var(--space-4, 1rem);
                    color: var(--color-text-primary, #f8fafc);
                }
                .chart-container {
                    aspect-ratio: 1;
                    max-width: 400px;
                    margin: 0 auto;
                    position: relative;
                }
                canvas {
                    width: 100%;
                    height: 100%;
                }
                .placeholder {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 300px;
                    color: var(--color-text-muted, #64748b);
                    font-size: var(--font-size-sm, 0.875rem);
                }
            </style>
            
            <div class="card">
                <h3 class="title">Emotional Radar</h3>
                <div class="chart-container">
                    <canvas id="radarCanvas"></canvas>
                </div>
            </div>
        `;
    }
}

/**
 * FrictionTimeline — Time-series graph of emotion scores
 * @extends HTMLElement
 */
class FrictionTimeline extends HTMLElement {
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
                :host {
                    display: block;
                }
                .card {
                    background: var(--color-surface, #12121a);
                    border: 1px solid var(--color-border, #2a2a3a);
                    border-radius: var(--radius-lg, 0.75rem);
                    padding: var(--space-6, 1.5rem);
                }
                .title {
                    font-size: var(--font-size-lg, 1.125rem);
                    font-weight: var(--font-weight-semibold, 600);
                    margin-bottom: var(--space-4, 1rem);
                    color: var(--color-text-primary, #f8fafc);
                }
                .timeline-container {
                    height: 200px;
                    position: relative;
                }
                canvas {
                    width: 100%;
                    height: 100%;
                }
            </style>
            
            <div class="card">
                <h3 class="title">Friction Timeline</h3>
                <div class="timeline-container">
                    <canvas id="timelineCanvas"></canvas>
                </div>
            </div>
        `;
    }
}

/**
 * CouncilReport — AI-generated action recommendations
 * @extends HTMLElement
 */
class CouncilReport extends HTMLElement {
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
                :host {
                    display: block;
                }
                .card {
                    background: var(--color-surface, #12121a);
                    border: 1px solid var(--color-border, #2a2a3a);
                    border-radius: var(--radius-lg, 0.75rem);
                    padding: var(--space-6, 1.5rem);
                }
                .title {
                    font-size: var(--font-size-lg, 1.125rem);
                    font-weight: var(--font-weight-semibold, 600);
                    margin-bottom: var(--space-4, 1rem);
                    color: var(--color-text-primary, #f8fafc);
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 0.5rem);
                }
                .recommendation {
                    background: var(--color-surface-elevated, #1a1a24);
                    border-left: 3px solid var(--color-accent-primary, #6366f1);
                    border-radius: 0 var(--radius-md, 0.5rem) var(--radius-md, 0.5rem) 0;
                    padding: var(--space-4, 1rem);
                    margin-bottom: var(--space-3, 0.75rem);
                }
                .recommendation:last-child {
                    margin-bottom: 0;
                }
                .rec-title {
                    font-weight: var(--font-weight-medium, 500);
                    color: var(--color-text-primary, #f8fafc);
                    margin-bottom: var(--space-1, 0.25rem);
                }
                .rec-text {
                    font-size: var(--font-size-sm, 0.875rem);
                    color: var(--color-text-secondary, #94a3b8);
                }
            </style>
            
            <div class="card">
                <h3 class="title">🎯 Council Recommendations</h3>
                <div class="recommendation">
                    <div class="rec-title">Hook Too Slow</div>
                    <div class="rec-text">Consider cutting the first 3 seconds. The impatient demographic abandoned before the core content appeared.</div>
                </div>
                <div class="recommendation">
                    <div class="rec-title">Visual Pacing</div>
                    <div class="rec-text">The video pacing is too slow. Quick cuts every 1-2 seconds perform better for this audience.</div>
                </div>
            </div>
        `;
    }
}

/**
 * WalletManager — Pre-paid credit management (Stripe integration)
 * @extends HTMLElement
 */
class WalletManager extends HTMLElement {
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
                :host {
                    display: block;
                }
                .card {
                    background: var(--color-surface, #12121a);
                    border: 1px solid var(--color-border, #2a2a3a);
                    border-radius: var(--radius-lg, 0.75rem);
                    padding: var(--space-6, 1.5rem);
                }
                .title {
                    font-size: var(--font-size-lg, 1.125rem);
                    font-weight: var(--font-weight-semibold, 600);
                    margin-bottom: var(--space-4, 1rem);
                    color: var(--color-text-primary, #f8fafc);
                }
                .balance {
                    background: var(--color-surface-elevated, #1a1a24);
                    border: 1px solid var(--color-border, #2a2a3a);
                    border-radius: var(--radius-md, 0.5rem);
                    padding: var(--space-4, 1rem);
                    margin-bottom: var(--space-4, 1rem);
                    text-align: center;
                }
                .balance-label {
                    font-size: var(--font-size-xs, 0.75rem);
                    color: var(--color-text-muted, #64748b);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: var(--space-1, 0.25rem);
                }
                .balance-value {
                    font-size: var(--font-size-2xl, 1.5rem);
                    font-weight: var(--font-weight-bold, 700);
                    color: var(--color-accent-success, #22c55e);
                }
                .credit-note {
                    font-size: var(--font-size-xs, 0.75rem);
                    color: var(--color-text-muted, #64748b);
                    text-align: center;
                }
                .action-btn {
                    width: 100%;
                    padding: var(--space-3, 0.75rem);
                    margin-top: var(--space-4, 1rem);
                    background: transparent;
                    border: 1px solid var(--color-border, #2a2a3a);
                    border-radius: var(--radius-md, 0.5rem);
                    color: var(--color-text-secondary, #94a3b8);
                    font-weight: var(--font-weight-medium, 500);
                    cursor: pointer;
                    transition: all var(--transition-fast, 150ms ease);
                }
                .action-btn:hover {
                    border-color: var(--color-accent-primary, #6366f1);
                    color: var(--color-text-primary, #f8fafc);
                }
            </style>
            
            <div class="card">
                <h3 class="title">💳 Wallet</h3>
                <div class="balance">
                    <div class="balance-label">Available Balance</div>
                    <div class="balance-value">$5.00</div>
                </div>
                <p class="credit-note">Free credits for prototype testing</p>
                <button class="action-btn">Add Funds (Stripe)</button>
            </div>
        `;
    }
}

// Register all components
customElements.define('emotion-config', EmotionConfig);
customElements.define('radar-chart', RadarChart);
customElements.define('friction-timeline', FrictionTimeline);
customElements.define('council-report', CouncilReport);
customElements.define('wallet-manager', WalletManager);
