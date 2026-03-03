#!/usr/bin/env node
/**
 * Structured Logger for Emotion Engine Pipeline
 * 
 * Features:
 * - Log levels: debug, info, warn, error
 * - Structured JSON logging with timestamps
 * - Includes script name, session ID
 * - Configurable via LOG_LEVEL env var (default: info)
 * - Optional file output for debugging
 */

const fs = require('fs');
const path = require('path');

// Configuration
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FILE = process.env.LOG_FILE || null; // Optional: path to log file
const SESSION_ID = process.env.SESSION_ID || `session-${Date.now()}`;

// Log levels with numeric priorities
const LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

// Current log level priority
const currentLevelPriority = LEVELS[LOG_LEVEL] ?? LEVELS.info;

// Get script name from call stack or default
function getScriptName() {
    const stack = new Error().stack;
    if (!stack) return 'unknown';
    
    const match = stack.split('\n')[3]?.match(/\((.+):[0-9]+:[0-9]+\)/);
    if (match && match[1]) {
        return path.basename(match[1]);
    }
    return 'main';
}

// Format timestamp
function formatTimestamp() {
    return new Date().toISOString();
}

// Create log entry
function createLogEntry(level, message, data = {}) {
    return {
        timestamp: formatTimestamp(),
        level: level.toUpperCase(),
        script: getScriptName(),
        sessionId: SESSION_ID,
        message: message,
        ...data
    };
}

// Format for human-readable output
function formatHumanReadable(entry) {
    const time = entry.timestamp.split('T')[1].split('.')[0];
    const script = entry.script.padEnd(25);
    const level = entry.level.padEnd(5);
    const msg = entry.message;
    
    let output = `[${time}] ${script} ${level} ${msg}`;
    
    // Add extra data if present (excluding standard fields)
    const extraData = {};
    for (const [key, value] of Object.entries(entry)) {
        if (!['timestamp', 'level', 'script', 'sessionId', 'message'].includes(key)) {
            extraData[key] = value;
        }
    }
    
    if (Object.keys(extraData).length > 0) {
        output += ' ' + JSON.stringify(extraData);
    }
    
    return output;
}

// Write log entry
function writeLog(entry) {
    // Human-readable to console
    console.log(formatHumanReadable(entry));
    
    // JSON to file if configured
    if (LOG_FILE) {
        try {
            const logDir = path.dirname(LOG_FILE);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            const jsonLine = JSON.stringify(entry) + '\n';
            fs.appendFileSync(LOG_FILE, jsonLine);
        } catch (err) {
            // Silently ignore file write errors
        }
    }
}

// Logger methods
const logger = {
    debug(message, data) {
        if (currentLevelPriority <= LEVELS.debug) {
            writeLog(createLogEntry('debug', message, data));
        }
    },
    
    info(message, data) {
        if (currentLevelPriority <= LEVELS.info) {
            writeLog(createLogEntry('info', message, data));
        }
    },
    
    warn(message, data) {
        if (currentLevelPriority <= LEVELS.warn) {
            writeLog(createLogEntry('warn', message, data));
        }
    },
    
    error(message, data) {
        if (currentLevelPriority <= LEVELS.error) {
            writeLog(createLogEntry('error', message, data));
        }
    }
};

// Export configuration for debugging
logger.config = {
    level: LOG_LEVEL,
    sessionId: SESSION_ID,
    logFile: LOG_FILE
};

module.exports = logger;
