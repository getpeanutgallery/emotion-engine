/**
 * Utility Functions
 * OpenTruth Emotion Engine — Prototype
 * 
 * @module js/utils
 * @author Cookie (OpenClaw)
 * @version 0.1.0
 */

/**
 * Generate a UUID-like session identifier
 * @returns {string} Unique session ID
 */
export function generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Byte count
 * @returns {string} Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format milliseconds to MM:SS
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time
 */
export function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Milliseconds between calls
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Convert File to Base64
 * @param {File} file - File object
 * @returns {Promise<string>} Base64 string
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Convert Blob to Base64
 * @param {Blob} blob - Blob object
 * @returns {Promise<string>} Base64 string
 */
export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Safe JSON parse with fallback
 * @param {string} str - JSON string
 * @param {*} fallback - Fallback value if parse fails
 * @returns {*} Parsed value or fallback
 */
export function safeJsonParse(str, fallback = null) {
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}

/**
 * Create a CustomEvent with detail
 * @param {string} name - Event name
 * @param {Object} detail - Event detail
 * @param {boolean} [bubbles=true] - Bubble up DOM
 * @param {boolean} [composed=true] - Cross shadow boundary
 * @returns {CustomEvent} Custom event
 */
export function createEvent(name, detail, bubbles = true, composed = true) {
    return new CustomEvent(name, {
        detail,
        bubbles,
        composed
    });
}

/**
 * Dispatch event on element
 * @param {HTMLElement} element - Target element
 * @param {string} name - Event name
 * @param {Object} detail - Event detail
 * @returns {boolean} Event dispatch result
 */
export function dispatch(element, name, detail) {
    return element.dispatchEvent(createEvent(name, detail));
}

/**
 * Wait for element to appear in DOM
 * @param {string} selector - CSS selector
 * @param {HTMLElement} [parent=document] - Parent element
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<HTMLElement>} Found element
 */
export function waitForElement(selector, parent = document, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const element = parent.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }
        
        const observer = new MutationObserver(() => {
            const element = parent.querySelector(selector);
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });
        
        observer.observe(parent, { childList: true, subtree: true });
        
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        }, timeout);
    });
}

/**
 * Simple event emitter pattern
 * @returns {Object} Event emitter instance
 */
export function createEmitter() {
    const events = {};
    
    return {
        on(event, callback) {
            if (!events[event]) events[event] = [];
            events[event].push(callback);
            return () => this.off(event, callback);
        },
        off(event, callback) {
            if (!events[event]) return;
            events[event] = events[event].filter(cb => cb !== callback);
        },
        emit(event, data) {
            if (!events[event]) return;
            events[event].forEach(callback => callback(data));
        }
    };
}

/**
 * Simple state store
 * @param {Object} initialState - Initial state
 * @returns {Object} Store instance
 */
export function createStore(initialState = {}) {
    let state = { ...initialState };
    const emitter = createEmitter();
    
    return {
        get(key) {
            return key ? state[key] : { ...state };
        },
        set(key, value) {
            const prevState = { ...state };
            if (typeof key === 'object') {
                state = { ...state, ...key };
            } else {
                state[key] = value;
            }
            emitter.emit('change', { state, prevState });
        },
        subscribe(callback) {
            return emitter.on('change', callback);
        }
    };
}

/**
 * Calculate average of array
 * @param {number[]} arr - Number array
 * @returns {number} Average
 */
export function average(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Clamp value between min and max
 * @param {number} val - Value to clamp
 * @param {number} min - Minimum
 * @param {number} max - Maximum
 * @returns {number} Clamped value
 */
export function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

/**
 * Linear interpolation
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} t - Progress (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(start, end, t) {
    return start + (end - start) * t;
}
