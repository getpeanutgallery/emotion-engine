/**
 * @fileoverview UI Manager Singleton
 * Coordinates UI updates and section visibility
 * @author OpenTruth Team
 * @version 0.2.0
 */

export class UIManager {
    static #instance = null;

    constructor() {
        if (UIManager.#instance) {
            return UIManager.#instance;
        }

        /** @type {string|null} */
        this.currentSection = null;

        UIManager.#instance = this;
        console.log('🎨 UI Manager initialized');
    }

    /**
     * Show a specific section, hide others
     * @param {string} sectionId - ID of section to show
     */
    showSection(sectionId) {
        const sections = ['upload-section', 'persona-section', 'progress-section', 'results-section'];
        
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.hidden = id !== sectionId;
            }
        });

        this.currentSection = sectionId;
        console.log('👁️  Section shown:', sectionId);
    }

    /**
     * Update progress bar
     * @param {number} percent - 0-100
     * @param {string} message - Status message
     */
    updateProgress(percent, message = '') {
        const progressEl = document.querySelector('#progress-section progress');
        const messageEl = document.getElementById('progress-message');

        if (progressEl) {
            progressEl.value = percent;
        }

        if (messageEl) {
            messageEl.textContent = message;
        }
    }

    /**
     * Display error message
     * @param {string} message - Error message
     */
    showError(message) {
        console.error('❌', message);
        // Could show toast/notification here
        alert(`Error: ${message}`);
    }

    /**
     * Display success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        console.log('✅', message);
        // Could show toast/notification here
    }

    /**
     * Scroll to element
     * @param {string} selector - CSS selector
     */
    scrollTo(selector) {
        const el = document.querySelector(selector);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * Enable/disable loading state
     * @param {HTMLElement} button - Button element
     * @param {boolean} loading - Loading state
     */
    setLoading(button, loading) {
        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.textContent = 'Loading...';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || 'Submit';
        }
    }
}
