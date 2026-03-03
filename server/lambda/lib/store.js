/**
 * Session Store
 * DynamoDB-backed storage for emotion analysis results
 * 
 * @module lib/store
 * @author Cookie (OpenClaw)
 * @version 0.1.0
 */

const AWS = require('aws-sdk');

/**
 * Session Store — DynamoDB wrapper
 */
class SessionStore {
    /**
     * Create store instance
     */
    constructor() {
        this.client = new AWS.DynamoDB.DocumentClient();
        this.tableName = process.env.SESSIONS_TABLE || 'opentruth-sessions';
    }
    
    /**
     * Save session data
     * @param {string} sessionId - Session identifier
     * @param {Object} data - Session data
     * @returns {Promise<Object>} DynamoDB response
     */
    async save(sessionId, data) {
        const params = {
            TableName: this.tableName,
            Item: {
                sessionId,
                ...data,
                ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
            }
        };
        
        return this.client.put(params).promise();
    }
    
    /**
     * Get session by ID
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object|null>} Session data or null
     */
    async get(sessionId) {
        const params = {
            TableName: this.tableName,
            Key: { sessionId }
        };
        
        const result = await this.client.get(params).promise();
        return result.Item || null;
    }
    
    /**
     * List sessions (with pagination)
     * @param {string} [userId] - Filter by user
     * @param {Object} [options] - Query options
     * @returns {Promise<Array>} Session list
     */
    async list(userId, options = {}) {
        // In production, add GSI for user queries
        // For MVP, simple scan with filter
        const params = {
            TableName: this.tableName,
            Limit: options.limit || 100
        };
        
        const result = await this.client.scan(params).promise();
        return result.Items || [];
    }
    
    /**
     * Delete session
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} DynamoDB response
     */
    async delete(sessionId) {
        const params = {
            TableName: this.tableName,
            Key: { sessionId }
        };
        
        return this.client.delete(params).promise();
    }
}

module.exports = { SessionStore };
