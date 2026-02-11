// ═══════════════════════════════════════════════════════════
// API Communication Layer
// ═══════════════════════════════════════════════════════════

class API {
    constructor() {
        this.baseURL = '';
        this.eventSource = null;
    }

    // Generic request
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}/api${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error — server may be offline');
            }
            throw error;
        }
    }

    // ─── API Endpoints ──────────────────────────────────────
    async getDashboard() { return this.request('/dashboard'); }
    async getCampaigns() { return this.request('/campaigns'); }
    async getCampaignDetail(id) { return this.request(`/campaigns/${id}`); }
    async getLeads(campaignId, page = 1, limit = 100) {
        return this.request(`/campaigns/${campaignId}/leads?page=${page}&limit=${limit}`);
    }
    async getAnalytics() { return this.request('/analytics'); }
    async getHealth() { return this.request('/health'); }

    async createCampaign(data) {
        return this.request('/campaigns', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // ─── Utility Functions ──────────────────────────────────
    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        const n = Number(num);
        if (isNaN(n)) return '0';
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toLocaleString();
    }

    formatDateSafe(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '-';
            return date.toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return '-';
        }
    }

    safeString(value, fallback = '-') {
        if (value === null || value === undefined || value === '') return fallback;
        return String(value);
    }

    parseNumericValue(value) {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') return value;
        const parsed = parseFloat(String(value));
        return isNaN(parsed) ? null : parsed;
    }

    getScoreCategory(score) {
        if (score >= 85) return 'A+';
        if (score >= 75) return 'A';
        if (score >= 65) return 'B';
        if (score >= 50) return 'C';
        return 'D';
    }

    getScoreColor(score) {
        if (score >= 85) return '#10b981';
        if (score >= 75) return '#22d3ee';
        if (score >= 65) return '#6366f1';
        if (score >= 50) return '#f59e0b';
        return '#ef4444';
    }

    getPriorityColor(priority) {
        const colors = {
            'HIGH': '#10b981',
            'MEDIUM': '#f59e0b',
            'LOW': '#ef4444'
        };
        return colors[priority] || '#64748b';
    }

    handleError(error, context = '') {
        const message = error.message || 'An unexpected error occurred';
        console.error(`Error ${context}:`, error);
        
        if (typeof showNotification === 'function') {
            showNotification('Error', `${context ? context + ': ' : ''}${message}`, 'error');
        }
    }
}

// ─── Initialize ─────────────────────────────────────────────
const api = new API();