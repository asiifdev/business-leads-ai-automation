// UI Components and Utilities

// Notification System
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notifications');
        this.notifications = new Map();
        this.nextId = 1;
    }

    show(title, message, type = 'info', duration = 5000) {
        const id = this.nextId++;
        const notification = this.createNotification(id, title, message, type);
        
        this.container.appendChild(notification);
        this.notifications.set(id, notification);

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                this.remove(id);
            }, duration);
        }

        return id;
    }

    createNotification(id, title, message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-header">
                <h4 class="notification-title">${title}</h4>
                <button class="notification-close" onclick="notificationManager.remove(${id})">&times;</button>
            </div>
            <p class="notification-message">${message}</p>
        `;
        return notification;
    }

    remove(id) {
        const notification = this.notifications.get(id);
        if (notification) {
            notification.style.animation = 'notificationSlideOut 0.3s ease forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                this.notifications.delete(id);
            }, 300);
        }
    }

    clear() {
        this.notifications.forEach((notification, id) => {
            this.remove(id);
        });
    }
}

// Modal Manager
class ModalManager {
    constructor() {
        this.activeModal = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.close();
            }
        });

        // Close modal on backdrop click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') && this.activeModal) {
                this.close();
            }
        });
    }

    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            this.activeModal = modal;
            document.body.style.overflow = 'hidden';
        }
    }

    close() {
        if (this.activeModal) {
            this.activeModal.classList.remove('active');
            this.activeModal = null;
            document.body.style.overflow = '';
        }
    }
}

// Chart Components
class SimpleChart {
    static createBarChart(container, data, options = {}) {
        const {
            title = '',
            valueKey = 'value',
            labelKey = 'label',
            color = '#2563eb'
        } = options;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="chart-placeholder">
                    <div class="chart-icon">📊</div>
                    <div class="chart-text">No data available</div>
                </div>
            `;
            return;
        }

        const maxValue = Math.max(...data.map(item => item[valueKey]));
        
        const chartHTML = `
            ${title ? `<h4 style="margin-bottom: 1rem; text-align: center;">${title}</h4>` : ''}
            <div class="bar-chart">
                ${data.map(item => {
                    const height = (item[valueKey] / maxValue) * 100;
                    return `
                        <div class="bar-item">
                            <div class="bar" style="height: ${height}%; background: ${color};">
                                <div class="bar-value">${api.formatNumber(item[valueKey])}</div>
                            </div>
                            <div class="bar-label">${item[labelKey]}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.innerHTML = chartHTML;
    }

    static createPieChart(container, data, options = {}) {
        const { title = '' } = options;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="chart-placeholder">
                    <div class="chart-icon">🥧</div>
                    <div class="chart-text">No data available</div>
                </div>
            `;
            return;
        }

        const total = data.reduce((sum, item) => sum + item.value, 0);
        const colors = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];
        
        let currentAngle = 0;
        const segments = data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const angle = (item.value / total) * 360;
            const color = colors[index % colors.length];
            
            const segment = {
                ...item,
                percentage,
                angle,
                startAngle: currentAngle,
                color
            };
            
            currentAngle += angle;
            return segment;
        });

        const gradientStops = segments.map(segment => 
            `${segment.color} ${segment.startAngle}deg ${segment.startAngle + segment.angle}deg`
        ).join(', ');

        const chartHTML = `
            ${title ? `<h4 style="margin-bottom: 1rem; text-align: center;">${title}</h4>` : ''}
            <div class="pie-chart">
                <div class="pie-visual" style="background: conic-gradient(${gradientStops});"></div>
                <div class="pie-legend">
                    ${segments.map(segment => `
                        <div class="legend-item">
                            <div class="legend-color" style="background: ${segment.color};"></div>
                            <div class="legend-label">${segment.label}</div>
                            <div class="legend-value">${api.formatNumber(segment.value)} (${segment.percentage.toFixed(1)}%)</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        container.innerHTML = chartHTML;
    }
}

// Table Component
class DataTable {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.options = {
            columns: [],
            data: [],
            pagination: true,
            pageSize: 10,
            sortable: true,
            filterable: false,
            ...options
        };
        this.currentPage = 1;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.filteredData = [];
    }

    render() {
        this.filteredData = [...this.options.data];
        this.applySort();
        
        const tableHTML = this.generateTable();
        const paginationHTML = this.options.pagination ? this.generatePagination() : '';
        
        this.container.innerHTML = `
            ${tableHTML}
            ${paginationHTML}
        `;

        this.attachEventListeners();
    }

    generateTable() {
        const startIndex = (this.currentPage - 1) * this.options.pageSize;
        const endIndex = startIndex + this.options.pageSize;
        const pageData = this.filteredData.slice(startIndex, endIndex);

        return `
            <table class="leads-table">
                <thead>
                    <tr>
                        ${this.options.columns.map(col => `
                            <th ${this.options.sortable ? `class="sortable" data-column="${col.key}"` : ''}>
                                ${col.title}
                                ${this.sortColumn === col.key ? (this.sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${pageData.length > 0 ? pageData.map((row, index) => `
                        <tr>
                            ${this.options.columns.map(col => {
                                // Get the actual value from nested properties if needed
                                let cellValue = row[col.key];
                                if (col.key && col.key.includes('.')) {
                                    const keys = col.key.split('.');
                                    cellValue = keys.reduce((obj, key) => obj?.[key], row);
                                }
                                return `<td>${this.formatCellValue(cellValue, col, row, index)}</td>`;
                            }).join('')}
                        </tr>
                    `).join('') : `
                        <tr>
                            <td colspan="${this.options.columns.length}" class="empty-state">
                                <div class="empty-icon">📭</div>
                                <div class="empty-title">No data available</div>
                                <div class="empty-message">There are no items to display</div>
                            </td>
                        </tr>
                    `}
                </tbody>
            </table>
        `;
    }

    formatCellValue(value, column, rowData, rowIndex) {
        if (column.formatter) {
            return column.formatter(value, rowData, rowIndex);
        }

        // Get the actual value from nested properties if needed
        let actualValue = value;
        if (column.key && column.key.includes('.')) {
            const keys = column.key.split('.');
            actualValue = keys.reduce((obj, key) => obj?.[key], rowData);
        }

        if (column.type === 'actions') {
            const safeName = (rowData.name || 'Unknown').replace(/'/g, "\\'");
            return `
                <div class="action-buttons">
                    <button class="btn-vcard" onclick="exportLeadVCard('${this.options.campaignId}', ${rowIndex}, '${safeName}')" title="Export to Phone Contacts">
                        📱 vCard
                    </button>
                </div>
            `;
        }

        if (column.type === 'score') {
            const numericValue = api.parseNumericValue(actualValue);
            if (numericValue === null) {
                return '<span class="score-badge score-unknown" style="background: #f3f4f6; color: #6b7280;">No Score</span>';
            }
            const category = api.getScoreCategory(numericValue);
            const color = api.getScoreColor(numericValue);
            return `<span class="score-badge" style="background: ${color}20; color: ${color};">${numericValue} - ${category}</span>`;
        }

        if (column.type === 'priority') {
            const safeValue = api.safeString(actualValue, 'UNKNOWN');
            const normalizedValue = safeValue.toUpperCase();
            const color = api.getPriorityColor(normalizedValue);
            const displayValue = normalizedValue === 'UNKNOWN' ? 'Unknown' : normalizedValue;
            return `<span class="priority-badge priority-${normalizedValue.toLowerCase()}" style="background: ${color};">${displayValue}</span>`;
        }

        if (column.type === 'date') {
            return api.formatDateSafe(actualValue);
        }

        if (column.type === 'number') {
            return api.formatNumber(actualValue);
        }

        // Handle general value formatting
        return api.safeString(actualValue);
    }

    generatePagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.options.pageSize);
        
        if (totalPages <= 1) return '';

        let paginationHTML = '<div class="pagination">';
        
        // Previous button
        paginationHTML += `
            <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="this.table.goToPage(${this.currentPage - 1})">
                Previous
            </button>
        `;

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="${i === this.currentPage ? 'active' : ''}" onclick="this.table.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        // Next button
        paginationHTML += `
            <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="this.table.goToPage(${this.currentPage + 1})">
                Next
            </button>
        `;

        paginationHTML += '</div>';
        return paginationHTML;
    }

    attachEventListeners() {
        // Attach table reference to pagination buttons
        const paginationButtons = this.container.querySelectorAll('.pagination button');
        paginationButtons.forEach(button => {
            button.table = this;
        });

        // Sort functionality
        if (this.options.sortable) {
            const sortableHeaders = this.container.querySelectorAll('th.sortable');
            sortableHeaders.forEach(header => {
                header.addEventListener('click', () => {
                    const column = header.dataset.column;
                    this.sort(column);
                });
            });
        }
    }

    sort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        this.applySort();
        this.render();
    }

    applySort() {
        if (!this.sortColumn) return;

        this.filteredData.sort((a, b) => {
            let aVal = a[this.sortColumn];
            let bVal = b[this.sortColumn];

            // Handle nested properties (e.g., 'intelligence.score')
            if (this.sortColumn.includes('.')) {
                const keys = this.sortColumn.split('.');
                aVal = keys.reduce((obj, key) => obj?.[key], a);
                bVal = keys.reduce((obj, key) => obj?.[key], b);
            }

            // Handle different data types
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }

            // String comparison
            const aStr = String(aVal || '').toLowerCase();
            const bStr = String(bVal || '').toLowerCase();
            
            if (this.sortDirection === 'asc') {
                return aStr.localeCompare(bStr);
            } else {
                return bStr.localeCompare(aStr);
            }
        });
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredData.length / this.options.pageSize);
        this.currentPage = Math.max(1, Math.min(page, totalPages));
        this.render();
    }

    updateData(newData) {
        this.options.data = newData;
        this.currentPage = 1;
        this.render();
    }

    filter(filterFn) {
        this.filteredData = this.options.data.filter(filterFn);
        this.currentPage = 1;
        this.render();
    }
}

// Progress Manager for campaign tracking
class ProgressManager {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        this.nameElement = document.getElementById('progressCampaignName');
        this.statusElement = document.getElementById('progressStatus');
        this.progressBar = document.getElementById('progressBar');
        this.progressPercent = document.getElementById('progressPercent');
        this.messagesContainer = document.getElementById('progressMessages');
        this.closeButton = document.getElementById('progressCloseBtn');
        this.messages = [];
    }

    show(campaignName) {
        this.nameElement.textContent = campaignName;
        this.statusElement.textContent = 'Starting campaign...';
        this.updateProgress(0);
        this.messages = [];
        this.messagesContainer.innerHTML = '';
        this.closeButton.disabled = true;
        modalManager.open(this.modal.id);
    }

    updateProgress(percentage, status = null) {
        this.progressBar.style.width = `${percentage}%`;
        this.progressPercent.textContent = `${Math.round(percentage)}%`;
        
        if (status) {
            this.statusElement.textContent = status;
            this.addMessage(status, 'info');
        }

        if (percentage >= 100) {
            this.closeButton.disabled = false;
        }
    }

    addMessage(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });

        const messageElement = document.createElement('div');
        messageElement.className = `progress-message ${type}`;
        messageElement.innerHTML = `
            <span class="timestamp">${timestamp}</span>
            <span class="message">${message}</span>
        `;

        this.messagesContainer.appendChild(messageElement);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        
        this.messages.push({ timestamp, message, type });
    }

    complete(results) {
        this.updateProgress(100, 'Campaign completed successfully!');
        this.addMessage(`Generated ${results.totalLeads} leads with ${results.priorityLeads} priority prospects`, 'success');
        this.closeButton.disabled = false;
    }

    error(errorMessage) {
        this.addMessage(`Error: ${errorMessage}`, 'error');
        this.statusElement.textContent = 'Campaign failed';
        this.closeButton.disabled = false;
    }

    hide() {
        modalManager.close();
    }
}

// Initialize global components
const notificationManager = new NotificationManager();
const modalManager = new ModalManager();

// Global utility functions
window.showNotification = (title, message, type = 'info', duration = 5000) => {
    return notificationManager.show(title, message, type, duration);
};

window.showModal = (modalId) => {
    modalManager.open(modalId);
};

window.hideModal = () => {
    modalManager.close();
};

// Export components for use in other scripts
window.NotificationManager = NotificationManager;
window.ModalManager = ModalManager;
window.SimpleChart = SimpleChart;
window.DataTable = DataTable;
window.ProgressManager = ProgressManager;