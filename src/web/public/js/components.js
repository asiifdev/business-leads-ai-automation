// ═══════════════════════════════════════════════════════════
// UI Components and Utilities
// ═══════════════════════════════════════════════════════════

// ─── Notification System ────────────────────────────────────
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

        if (duration > 0) {
            setTimeout(() => this.remove(id), duration);
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
        this.notifications.forEach((_, id) => this.remove(id));
    }
}

// ─── Modal Manager ──────────────────────────────────────────
class ModalManager {
    constructor() {
        this.activeModal = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.close();
            }
        });

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

// ─── Chart Components ───────────────────────────────────────
class SimpleChart {
    static createBarChart(container, data, options = {}) {
        const {
            title = '',
            valueKey = 'value',
            labelKey = 'label',
            color = '#6366f1'
        } = options;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="chart-placeholder">
                    <div class="chart-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="40" height="40" style="opacity:0.4"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    </div>
                    <div class="chart-text">No data available</div>
                </div>
            `;
            return;
        }

        const maxValue = Math.max(...data.map(item => item[valueKey]));
        
        const chartHTML = `
            ${title ? `<h4 style="margin-bottom:1rem;text-align:center">${title}</h4>` : ''}
            <div class="bar-chart">
                ${data.map(item => {
                    const height = maxValue > 0 ? (item[valueKey] / maxValue) * 100 : 0;
                    return `
                        <div class="bar-item">
                            <div class="bar" style="height:${height}%">
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
                    <div class="chart-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="40" height="40" style="opacity:0.4"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                    </div>
                    <div class="chart-text">No data available</div>
                </div>
            `;
            return;
        }

        const total = data.reduce((sum, item) => sum + item.value, 0);
        const colors = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'];
        
        let currentAngle = 0;
        const segments = data.map((item, index) => {
            const percentage = total > 0 ? (item.value / total) * 100 : 0;
            const angle = total > 0 ? (item.value / total) * 360 : 0;
            const color = colors[index % colors.length];
            
            const segment = { ...item, percentage, angle, startAngle: currentAngle, color };
            currentAngle += angle;
            return segment;
        });

        const gradientStops = segments.map(s =>
            `${s.color} ${s.startAngle}deg ${s.startAngle + s.angle}deg`
        ).join(', ');

        container.innerHTML = `
            ${title ? `<h4 style="margin-bottom:1rem;text-align:center">${title}</h4>` : ''}
            <div class="pie-chart">
                <div class="pie-visual" style="background:conic-gradient(${gradientStops})"></div>
                <div class="pie-legend">
                    ${segments.map(s => `
                        <div class="legend-item">
                            <div class="legend-color" style="background:${s.color}"></div>
                            <div class="legend-label">${s.label}</div>
                            <div class="legend-value">${api.formatNumber(s.value)} (${s.percentage.toFixed(1)}%)</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

// ─── Data Table Component ───────────────────────────────────
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
            campaignId: null,
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
            <div class="table-container">
                ${tableHTML}
            </div>
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
                            <th ${this.options.sortable && col.type !== 'actions' ? `class="sortable" data-column="${col.key}"` : ''}>
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
                                let cellValue = row[col.key];
                                if (col.key && col.key.includes('.')) {
                                    const keys = col.key.split('.');
                                    cellValue = keys.reduce((obj, key) => obj?.[key], row);
                                }
                                return `<td data-label="${col.title}">${this.formatCellValue(cellValue, col, row, startIndex + index)}</td>`;
                            }).join('')}
                        </tr>
                    `).join('') : `
                        <tr>
                            <td colspan="${this.options.columns.length}" class="empty-state">
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
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                        vCard
                    </button>
                </div>
            `;
        }

        if (column.type === 'score') {
            const numericValue = api.parseNumericValue(actualValue);
            if (numericValue === null) {
                return '<span class="score-badge" style="background:var(--bg-elevated);color:var(--text-muted)">No Score</span>';
            }
            const category = api.getScoreCategory(numericValue);
            const color = api.getScoreColor(numericValue);
            return `<span class="score-badge" style="background:${color}20;color:${color}">${numericValue} - ${category}</span>`;
        }

        if (column.type === 'priority') {
            const safeValue = api.safeString(actualValue, 'UNKNOWN');
            const normalizedValue = safeValue.toUpperCase();
            return `<span class="priority-badge priority-${normalizedValue.toLowerCase()}">${normalizedValue}</span>`;
        }

        if (column.type === 'date') {
            return api.formatDateSafe(actualValue);
        }

        if (column.type === 'number') {
            return api.formatNumber(actualValue);
        }

        return api.safeString(actualValue);
    }

    generatePagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.options.pageSize);
        if (totalPages <= 1) return '';

        let html = '<div class="pagination">';
        
        // Previous
        html += `<button data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>Previous</button>`;

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            html += `<button data-page="${i}" class="${i === this.currentPage ? 'active' : ''}">${i}</button>`;
        }

        // Next
        html += `<button data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
        html += '</div>';
        return html;
    }

    attachEventListeners() {
        // Pagination — fixed: use data-page attribute + event delegation
        this.container.querySelectorAll('.pagination button').forEach(button => {
            button.addEventListener('click', () => {
                const page = parseInt(button.dataset.page);
                if (!isNaN(page)) this.goToPage(page);
            });
        });

        // Sort headers
        if (this.options.sortable) {
            this.container.querySelectorAll('th.sortable').forEach(header => {
                header.addEventListener('click', () => {
                    this.sort(header.dataset.column);
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

            if (this.sortColumn.includes('.')) {
                const keys = this.sortColumn.split('.');
                aVal = keys.reduce((obj, key) => obj?.[key], a);
                bVal = keys.reduce((obj, key) => obj?.[key], b);
            }

            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }

            const aStr = String(aVal || '').toLowerCase();
            const bStr = String(bVal || '').toLowerCase();
            return this.sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
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

// ─── Progress Manager ───────────────────────────────────────
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

        const el = document.createElement('div');
        el.className = `progress-message ${type}`;
        el.innerHTML = `
            <span class="timestamp">${timestamp}</span>
            <span class="message">${message}</span>
        `;

        this.messagesContainer.appendChild(el);
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

// ─── Initialize Global Components ───────────────────────────
const notificationManager = new NotificationManager();
const modalManager = new ModalManager();

window.showNotification = (title, message, type = 'info', duration = 5000) => {
    return notificationManager.show(title, message, type, duration);
};

window.showModal = (modalId) => {
    modalManager.open(modalId);
};

window.hideModal = () => {
    modalManager.close();
};

// Export for other scripts
window.NotificationManager = NotificationManager;
window.ModalManager = ModalManager;
window.SimpleChart = SimpleChart;
window.DataTable = DataTable;
window.ProgressManager = ProgressManager;