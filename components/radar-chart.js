/**
 * Radar Chart Web Component
 * OpenTruth Emotion Engine — 5-Axis Emotional Visualization
 * 
 * @module components/radar-chart
 * @author Cookie (OpenClaw)
 * @version 0.2.0
 */

class RadarChart extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.data = null;
        this.canvas = null;
        this.ctx = null;
    }
    
    static get observedAttributes() {
        return ['data'];
    }
    
    connectedCallback() {
        this.render();
        this.canvas = this.shadowRoot.querySelector('canvas');
        this.ctx = this.canvas?.getContext('2d');
        
        // Parse initial data if provided
        if (this.hasAttribute('data')) {
            this.updateData(this.getAttribute('data'));
        }
        
        // Listen for data updates
        this.addEventListener('radar-update', (e) => {
            this.data = e.detail;
            this.draw();
        });
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'data' && newValue) {
            this.updateData(newValue);
        }
    }
    
    updateData(dataString) {
        try {
            this.data = typeof dataString === 'string' ? JSON.parse(dataString) : dataString;
            this.draw();
        } catch (e) {
            console.error('RadarChart: Invalid data', e);
        }
    }
    
    /**
     * Set data programmatically
     * @param {Array} data - Array of {axis, value} objects
     */
    setData(data) {
        this.data = data;
        this.draw();
    }
    
    draw() {
        if (!this.ctx || !this.canvas || !this.data) return;
        
        const canvas = this.canvas;
        const ctx = this.ctx;
        const dpr = window.devicePixelRatio || 1;
        
        // Set canvas size with DPR for crisp rendering
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        const width = rect.width;
        const height = rect.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 60;
        
        // Clear
        ctx.clearRect(0, 0, width, height);
        
        // Draw background grid
        this.drawGrid(ctx, centerX, centerY, radius);
        
        // Draw data
        this.drawData(ctx, centerX, centerY, radius);
        
        // Draw labels
        this.drawLabels(ctx, centerX, centerY, radius);
    }
    
    drawGrid(ctx, cx, cy, radius) {
        const levels = 5;
        const axes = this.data.length;
        
        // Draw concentric pentagons
        ctx.strokeStyle = 'rgba(100, 102, 241, 0.2)';
        ctx.lineWidth = 1;
        
        for (let level = 1; level <= levels; level++) {
            const r = (radius / levels) * level;
            ctx.beginPath();
            
            for (let i = 0; i < axes; i++) {
                const angle = (Math.PI * 2 / axes) * i - Math.PI / 2;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            
            ctx.closePath();
            ctx.stroke();
            
            // Add level labels
            if (level === levels) {
                ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
                ctx.font = '10px Inter, system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('10', cx, cy - r - 5);
            }
        }
        
        // Draw axis lines
        ctx.strokeStyle = 'rgba(100, 102, 241, 0.3)';
        for (let i = 0; i < axes; i++) {
            const angle = (Math.PI * 2 / axes) * i - Math.PI / 2;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    }
    
    drawData(ctx, cx, cy, radius) {
        if (!this.data || this.data.length === 0) return;
        
        const axes = this.data.length;
        
        // Create gradient
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.1)');
        gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.5)');
        
        // Draw filled area
        ctx.beginPath();
        this.data.forEach((point, i) => {
            const angle = (Math.PI * 2 / axes) * i - Math.PI / 2;
            const value = Math.min(Math.max(point.value, 0), 10) / 10;
            const r = radius * value;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Draw outline
        ctx.beginPath();
        this.data.forEach((point, i) => {
            const angle = (Math.PI * 2 / axes) * i - Math.PI / 2;
            const value = Math.min(Math.max(point.value, 0), 10) / 10;
            const r = radius * value;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw points
        this.data.forEach((point, i) => {
            const angle = (Math.PI * 2 / axes) * i - Math.PI / 2;
            const value = Math.min(Math.max(point.value, 0), 10) / 10;
            const r = radius * value;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            
            // Outer glow
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
            ctx.fill();
            
            // Inner point
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#6366f1';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }
    
    drawLabels(ctx, cx, cy, radius) {
        if (!this.data) return;
        
        const axes = this.data.length;
        const labelRadius = radius + 30;
        
        ctx.font = 'bold 12px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#f8fafc';
        
        this.data.forEach((point, i) => {
            const angle = (Math.PI * 2 / axes) * i - Math.PI / 2;
            const x = cx + Math.cos(angle) * labelRadius;
            const y = cy + Math.sin(angle) * labelRadius;
            
            // Adjust text alignment based on position
            if (Math.abs(x - cx) < 10) {
                ctx.textAlign = 'center';
            } else if (x > cx) {
                ctx.textAlign = 'left';
            } else {
                ctx.textAlign = 'right';
            }
            
            ctx.textBaseline = 'middle';
            ctx.fillText(point.axis, x, y);
            
            // Draw value below label
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
            ctx.fillText(point.value.toFixed(1), x, y + 14);
            ctx.font = 'bold 12px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#f8fafc';
        });
    }
    
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                
                .radar-container {
                    background: var(--color-surface, #12121a);
                    border: 1px solid var(--color-border, #2a2a3a);
                    border-radius: var(--radius-lg, 0.75rem);
                    padding: var(--space-6, 1.5rem);
                }
                
                .radar-title {
                    font-size: var(--font-size-lg, 1.125rem);
                    font-weight: var(--font-weight-semibold, 600);
                    margin-bottom: var(--space-4, 1rem);
                    color: var(--color-text-primary, #f8fafc);
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 0.5rem);
                }
                
                .radar-title-icon {
                    font-size: 1.25rem;
                }
                
                .chart-wrapper {
                    position: relative;
                    width: 100%;
                    max-width: 500px;
                    margin: 0 auto;
                }
                
                canvas {
                    width: 100%;
                    height: auto;
                    display: block;
                }
                
                .chart-legend {
                    display: flex;
                    justify-content: center;
                    gap: var(--space-6, 1.5rem);
                    margin-top: var(--space-4, 1rem);
                    flex-wrap: wrap;
                }
                
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2, 0.5rem);
                    font-size: var(--font-size-sm, 0.875rem);
                    color: var(--color-text-secondary, #94a3b8);
                }
                
                .legend-color {
                    width: 12px;
                    height: 12px;
                    border-radius: 2px;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                }
                
                .legend-text {
                    white-space: nowrap;
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
            
            <div class="radar-container">
                <h3 class="radar-title">
                    <span class="radar-title-icon">🎯</span>
                    Emotional Radar
                </h3>
                <div class="chart-wrapper">
                    <canvas width="500" height="400"></canvas>
                </div>
                <div class="chart-legend">
                    <div class="legend-item">
                        <div class="legend-color"></div>
                        <span class="legend-text">Average Emotion Scores (1-10)</span>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('radar-chart', RadarChart);
