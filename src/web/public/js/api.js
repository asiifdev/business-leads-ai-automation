// API Communication Layer
class API {
    constructor() {
        this.baseURL = '';
        this.eventSource = null;
    }

    // Generic API request method
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
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // GET request
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    // POST request
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT request
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // Dashboard API methods
    async getDashboard() {
        return this.get('/dashboard');
    }

    async getCampaigns() {
        return this.get('/campaigns');
    }

    async getCampaign(id) {
        return this.get(`/campaigns/${id}`);
    }

    async getCampaignLeads(id, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = `/campaigns/${id}/leads${queryString ? `?${queryString}` : ''}`;
        return this.get(endpoint);
    }

    async getCampaignStatus(id) {
        return this.get(`/campaigns/${id}/status`);
    }

    async createCampaign(campaignData) {
        return this.post('/campaigns', campaignData);
    }

    async getAnalytics() {
        return this.get('/analytics');
    }

    // Export single lead as vCard
    async exportLeadVCard(campaignId, leadIndex, leadName) {
        try {
            const response = await fetch(`/api/leads/${campaignId}/${leadIndex}/vcard`);
            if (!response.ok) throw new Error('vCard export failed');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${leadName.replace(/[^a-zA-Z0-9]/g, '_')}.vcf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            return { success: true };
        } catch (error) {
            console.error('vCard export error:', error);
            throw error;
        }
    }

    // Export all leads as vCard bundle
    async exportCampaignVCard(campaignId, campaignName) {
        try {
            const response = await fetch(`/api/campaigns/${campaignId}/export/vcard`);
            if (!response.ok) throw new Error('vCard bundle export failed');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${campaignName.replace(/[^a-zA-Z0-9]/g, '_')}_contacts.vcf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            return { success: true };
        } catch (error) {
            console.error('vCard bundle export error:', error);
            throw error;
        }
    }

    // Server-Sent Events for real-time updates
    connectToEvents(onMessage, onError = null) {
        if (this.eventSource) {
            this.eventSource.close();
        }

        this.eventSource = new EventSource('/api/events');
        
        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch (error) {
                console.error('Error parsing SSE data:', error);
            }
        };

        this.eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            if (onError) {
                onError(error);
            }
        };

        return this.eventSource;
    }

    disconnectFromEvents() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    // Utility methods
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatNumber(number) {
        const numericValue = this.parseNumericValue(number);
        if (numericValue === null) {
            return '-';
        }
        return new Intl.NumberFormat('id-ID').format(numericValue);
    }

    getIndustryIcon(industry) {
        const icons = {
            restaurant: '🍽️',
            automotive: '🚗',
            retail: '🛍️',
            professional: '💼',
            healthcare: '🏥',
            education: '🎓',
            realestate: '🏠'
        };
        return icons[industry] || '🏢';
    }

    getIndustryName(industry) {
        const names = {
            restaurant: 'Restaurant & Food Service',
            automotive: 'Automotive',
            retail: 'Retail & E-commerce',
            professional: 'Professional Services',
            healthcare: 'Healthcare',
            education: 'Education',
            realestate: 'Real Estate'
        };
        return names[industry] || 'Other';
    }

    getPriorityColor(priority) {
        if (!priority || priority === 'undefined' || priority === 'null') {
            return '#6b7280'; // Gray for unknown
        }
        
        const normalizedPriority = String(priority).toUpperCase();
        const colors = {
            HIGH: '#ef4444',
            MEDIUM: '#f59e0b',
            LOW: '#64748b',
            UNKNOWN: '#6b7280'
        };
        return colors[normalizedPriority] || '#6b7280';
    }

    getScoreColor(score) {
        const numericScore = this.parseNumericValue(score);
        if (numericScore === null) return '#6b7280';
        
        if (numericScore >= 85) return '#10b981';
        if (numericScore >= 75) return '#3b82f6';
        if (numericScore >= 65) return '#f59e0b';
        if (numericScore >= 55) return '#f97316';
        return '#ef4444';
    }

    getScoreCategory(score) {
        const numericScore = this.parseNumericValue(score);
        if (numericScore === null) return 'No Score';
        
        if (numericScore >= 85) return 'A+ (Excellent)';
        if (numericScore >= 75) return 'A (High Quality)';
        if (numericScore >= 65) return 'B (Good)';
        if (numericScore >= 55) return 'C (Average)';
        return 'D (Low Priority)';
    }

    // Helper method to safely parse numeric values (supports Indonesian comma format)
    parseNumericValue(value) {
        if (value === null || value === undefined || value === '' || value === 'undefined' || value === 'null') {
            return null;
        }
        
        // Convert Indonesian comma format to standard dot format
        let normalizedValue = String(value).replace(',', '.');
        
        const parsed = parseFloat(normalizedValue);
        if (isNaN(parsed)) {
            return null;
        }
        
        return parsed;
    }

    // Safe string formatting
    safeString(value, defaultValue = '-') {
        if (value === null || value === undefined || value === 'undefined' || value === 'null' || value === '') {
            return defaultValue;
        }
        return String(value);
    }

    // Safe date formatting
    formatDateSafe(dateString) {
        if (!dateString || dateString === 'undefined' || dateString === 'null') {
            return '-';
        }
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return 'Invalid Date';
            }
            
            return date.toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Invalid Date';
        }
    }

    // Export functionality
    exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            throw new Error('No data to export');
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header];
                    // Escape commas and quotes in CSV
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');

        this.downloadFile(csvContent, filename, 'text/csv');
    }

    exportToJSON(data, filename) {
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, filename, 'application/json');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Error handling
    handleError(error, context = '') {
        console.error(`Error in ${context}:`, error);
        
        let message = 'An unexpected error occurred';
        if (error.message) {
            message = error.message;
        }

        // Show user-friendly error notification
        if (window.showNotification) {
            window.showNotification('Error', message, 'error');
        } else {
            alert(`Error: ${message}`);
        }
    }

    // Loading states
    showLoading(element, message = 'Loading...') {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        
        if (element) {
            element.innerHTML = `
                <div class="loading">
                    <span class="spinner"></span>
                    ${message}
                </div>
            `;
        }
    }

    hideLoading(element) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        
        if (element) {
            const loading = element.querySelector('.loading');
            if (loading) {
                loading.remove();
            }
        }
    }

    // Debounce utility for search inputs
    debounce(func, wait) {
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

    // Local storage helpers
    saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }
    }

    loadFromStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
            return defaultValue;
        }
    }

    removeFromStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn('Failed to remove from localStorage:', error);
        }
    }
}

// Create global API instance
window.api = new API();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}