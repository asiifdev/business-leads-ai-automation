/**
 * Centralized Business Profile Configuration
 * 
 * Loads business profile from business-profile.json and provides
 * a single source of truth for all business data across the system.
 * 
 * Usage:
 *   const { getProfile, load, save } = require('./businessProfile');
 *   const profile = getProfile();
 *   console.log(profile.business.name);
 */

const fs = require('fs');
const path = require('path');

const PROFILE_FILE = path.join(process.cwd(), 'business-profile.json');

let cachedProfile = null;

/**
 * Returns the default empty profile structure.
 * Used as fallback when no config file exists.
 */
function getDefaults() {
    return {
        business: {
            name: '',
            type: '',
            phone: '',
            email: '',
            website: '',
            description: '',
            valuePropositions: [],
            targetIndustries: []
        },
        owner: {
            name: '',
            phone: '',
            email: ''
        },
        preferences: {
            language: 'indonesian',
            campaignStyle: 'balanced',
            defaultSearchQuery: '',
            defaultLocation: '',
            outputFormat: 'csv'
        }
    };
}

/**
 * Deep merges source into target, filling in any missing keys with defaults.
 */
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else if (result[key] === undefined || result[key] === null) {
            result[key] = source[key];
        }
    }
    return result;
}

/**
 * Validates the profile object. Returns an array of warning messages.
 * Does not throw — missing fields are acceptable but warned about.
 */
function validate(profile) {
    const warnings = [];

    if (!profile.business?.name) {
        warnings.push('Business name is not set. Run: npm run setup');
    }
    if (!profile.business?.type) {
        warnings.push('Business type is not set.');
    }
    if (!profile.business?.description) {
        warnings.push('Business description is not set. Marketing content may be generic.');
    }
    if (!profile.owner?.name) {
        warnings.push('Owner name is not set.');
    }
    if (!profile.business?.phone && !profile.owner?.phone) {
        warnings.push('No contact phone number is set.');
    }

    return warnings;
}

/**
 * Loads the business profile from disk.
 * Merges with defaults so all keys are always present.
 * Also picks up legacy env vars (BUSINESS_NAME, etc.) as fallback.
 */
function load() {
    const defaults = getDefaults();

    let fileProfile = {};
    try {
        if (fs.existsSync(PROFILE_FILE)) {
            const raw = fs.readFileSync(PROFILE_FILE, 'utf8');
            fileProfile = JSON.parse(raw);
        }
    } catch (error) {
        console.warn('⚠️  Could not read business-profile.json:', error.message);
    }

    // Merge file data over defaults
    let profile = deepMerge(fileProfile, defaults);

    // Fallback: pick up legacy env vars if file values are empty
    if (!profile.business.name && process.env.BUSINESS_NAME) {
        profile.business.name = process.env.BUSINESS_NAME;
    }
    if (!profile.business.phone && process.env.BUSINESS_PHONE) {
        profile.business.phone = process.env.BUSINESS_PHONE;
    }
    if (!profile.business.email && process.env.BUSINESS_EMAIL) {
        profile.business.email = process.env.BUSINESS_EMAIL;
    }
    if (!profile.business.type && process.env.BUSINESS_TYPE) {
        profile.business.type = process.env.BUSINESS_TYPE;
    }
    if (!profile.owner.name && process.env.OWNER_NAME) {
        profile.owner.name = process.env.OWNER_NAME;
    }
    if (!profile.owner.phone && process.env.OWNER_PHONE) {
        profile.owner.phone = process.env.OWNER_PHONE;
    }
    if (!profile.owner.email && process.env.OWNER_EMAIL) {
        profile.owner.email = process.env.OWNER_EMAIL;
    }
    if (process.env.OUTPUT_LANGUAGE) {
        profile.preferences.language = process.env.OUTPUT_LANGUAGE;
    }
    if (process.env.CAMPAIGN_STYLE) {
        profile.preferences.campaignStyle = process.env.CAMPAIGN_STYLE;
    }

    cachedProfile = profile;
    return profile;
}

/**
 * Returns the cached profile, loading it if necessary.
 */
function getProfile() {
    if (!cachedProfile) {
        load();
    }
    return cachedProfile;
}

/**
 * Saves the profile object to disk.
 */
function save(profile) {
    try {
        fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
        cachedProfile = profile;
        return true;
    } catch (error) {
        console.error('❌ Error saving business-profile.json:', error.message);
        return false;
    }
}

/**
 * Checks if a business profile file exists.
 */
function isConfigured() {
    return fs.existsSync(PROFILE_FILE);
}

/**
 * Resets the cached profile (useful for testing).
 */
function resetCache() {
    cachedProfile = null;
}

/**
 * Helper: get business info object for prompt building.
 * Returns a flat object compatible with existing prompt templates.
 */
function getBusinessInfoForPrompt() {
    const p = getProfile();
    return {
        name: p.business.name || 'Your Business',
        phone: p.business.phone || p.owner.phone || '',
        email: p.business.email || p.owner.email || '',
        website: p.business.website || '',
        ownerName: p.owner.name || '',
        ownerPhone: p.owner.phone || '',
        ownerEmail: p.owner.email || '',
        type: p.business.type || '',
        description: p.business.description || '',
        valuePropositions: p.business.valuePropositions || [],
        targetIndustries: p.business.targetIndustries || [],
        language: p.preferences.language || 'indonesian',
        campaignStyle: p.preferences.campaignStyle || 'balanced'
    };
}

module.exports = {
    load,
    getProfile,
    getDefaults,
    save,
    validate,
    isConfigured,
    resetCache,
    getBusinessInfoForPrompt,
    PROFILE_FILE
};
