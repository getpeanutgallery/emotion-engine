/**
 * @fileoverview Application Bootstrap
 * Initializes managers and coordinates app startup
 * @author OpenTruth Team
 * @version 0.2.0
 */

import { APIManager } from './managers/api-manager.js';
import { StateManager } from './managers/state-manager.js';
import { UIManager } from './managers/ui-manager.js';

/**
 * Application entry point
 */
async function init() {
    console.log('🎬 OpenTruth Emotion Engine initializing...');

    // Initialize singletons
    const api = new APIManager();
    const state = new StateManager();
    const ui = new UIManager();

    // Check API health
    try {
        const health = await api.healthCheck();
        console.log('✅ API healthy:', health);
        state.setAPIReady(true);
    } catch (err) {
        console.warn('⚠️  API not available (running locally?)');
        state.setAPIMockMode(true);
    }

    // Load available personas
    try {
        const personas = await api.getPersonas();
        state.setPersonas(personas);
        console.log(`✅ Loaded ${personas.length} personas`);
    } catch (err) {
        console.warn('⚠️  Using default persona');
        state.setPersonas([{ id: 'impatient-teenager', name: 'Impatient Teenager' }]);
    }

    // Show upload section
    ui.showSection('upload-section');

    console.log('✅ App initialized');
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
