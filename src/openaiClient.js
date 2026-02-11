/**
 * Centralized OpenAI Client Configuration
 * 
 * All modules should import from here instead of creating their own instances.
 * Supports OPENAI_BASE_URL for custom/proxy endpoints (e.g., Azure, local LLMs).
 */
require('dotenv').config();

const DEFAULT_MODEL = 'gpt-4o-mini';

let openaiInstance = null;
let initError = null;

function createClient() {
    if (openaiInstance) return openaiInstance;

    try {
        const OpenAI = require('openai');

        const config = {
            apiKey: process.env.OPENAI_API_KEY,
        };

        // Support custom base URL (e.g., Azure OpenAI, local LLM proxies, OpenRouter, etc.)
        if (process.env.OPENAI_BASE_URL) {
            config.baseURL = process.env.OPENAI_BASE_URL;
            console.log(`🔗 OpenAI base URL: ${process.env.OPENAI_BASE_URL}`);
        }

        openaiInstance = new OpenAI(config);
        console.log('✅ OpenAI client initialized successfully');
        return openaiInstance;
    } catch (error) {
        initError = error;
        console.error('❌ Error initializing OpenAI client:', error.message);
        console.log('💡 Make sure to install: npm install openai');
        console.log('💡 Set OPENAI_API_KEY in your .env file');
        return null;
    }
}

function getClient() {
    if (!openaiInstance && !initError) {
        return createClient();
    }
    return openaiInstance;
}

function getModel() {
    return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

function isConfigured() {
    return !!process.env.OPENAI_API_KEY;
}

/**
 * Reset the client instance (useful for testing or re-configuration)
 */
function resetClient() {
    openaiInstance = null;
    initError = null;
}

module.exports = {
    getClient,
    getModel,
    isConfigured,
    resetClient,
    DEFAULT_MODEL,
};
