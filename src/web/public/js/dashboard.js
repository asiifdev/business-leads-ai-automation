// ═══════════════════════════════════════════════════════════
// Main Dashboard Application
// ═══════════════════════════════════════════════════════════

class Dashboard {
    constructor() {
        this.currentSection = 'dashboard';
        this.dashboardData = null;
        this.campaigns = [];
        this.currentCampaign = null;
        this.leadsTable = null;
        this.progressManager = null;
        this.eventSource = null;
        
        this.init();
    }

    async init() {
        this.initTheme();
        this.setupEventListeners();
        this.setupMobileNav();
        this.setupRealTimeUpdates();
        this.progressManager = new ProgressManager('campaignProgressModal');
        
        await this.loadDashboard();
        await this.loadCampaigns();
    }

    // ─── Theme Management ───────────────────────────────────
    initTheme() {
        const saved = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (prefersDark ? 'dark' : 'dark'); // default dark
        this.setTheme(theme);

        const toggle = document.getElementById('themeToggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme');
                this.setTheme(current === 'light' ? 'dark' : 'light');
            });
        }
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // Update theme-color meta
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.content = theme === 'dark' ? '#0f1117' : '#f0f2f5';
        }

        // Toggle sun/moon icons
        const moon = document.querySelector('.icon-moon');
        const sun = document.querySelector('.icon-sun');
        if (moon && sun) {
            if (theme === 'light') {
                moon.style.display = 'none';
                sun.style.display = 'block';
            } else {
                moon.style.display = 'block';
                sun.style.display = 'none';
            }
        }
    }

    // ─── Mobile Navigation ──────────────────────────────────
    setupMobileNav() {
        const hamburger = document.getElementById('hamburgerBtn');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        if (hamburger) {
            hamburger.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                overlay.classList.toggle('active');
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            });
        }

        // Bottom nav items
        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                if (section) this.showSection(section);
            });
        });
    }

    closeMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }

    // ─── Event Listeners ────────────────────────────────────
    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.sidebar .nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                if (section) this.showSection(section);
            });
        });
    }

    // ─── Section Navigation ─────────────────────────────────
    showSection(sectionName) {
        this.currentSection = sectionName;

        // Update sidebar active state
        document.querySelectorAll('.sidebar .nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionName);
        });

        // Update bottom nav active state
        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionName);
        });

        // Show/hide sections with animation
        document.querySelectorAll('.section').forEach(section => {
            const isTarget = section.id === `section-${sectionName}`;
            section.classList.toggle('active', isTarget);
            if (isTarget) {
                // Re-trigger animation
                section.style.animation = 'none';
                section.offsetHeight; // force reflow
                section.style.animation = '';
            }
        });

        // Close mobile menu
        this.closeMobileMenu();

        // Load section data
        if (sectionName === 'analytics') this.loadAnalytics();
        if (sectionName === 'leads') this.loadLeadsSection();
        if (sectionName === 'campaigns') this.loadCampaigns();
    }

    // ─── Real-Time Updates (SSE) ────────────────────────────
    setupRealTimeUpdates() {
        try {
            this.eventSource = new EventSource('/api/events');

            this.eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleSSEEvent(data);
                } catch (e) { /* ignore parse errors */ }
            };

            this.eventSource.onerror = () => {
                setTimeout(() => this.setupRealTimeUpdates(), 5000);
            };
        } catch (e) {
            console.log('SSE not available');
        }
    }

    handleSSEEvent(data) {
        switch (data.type) {
            case 'campaign_started':
                showNotification('Campaign Started', data.message, 'info');
                break;
            case 'campaign_progress':
                if (this.progressManager) {
                    this.progressManager.updateProgress(data.progress, data.message);
                }
                break;
            case 'campaign_completed':
                showNotification('Campaign Complete', data.message, 'success');
                if (this.progressManager) {
                    this.progressManager.complete(data.results);
                }
                this.loadDashboard();
                this.loadCampaigns();
                break;
            case 'campaign_failed':
                showNotification('Campaign Failed', data.message, 'error');
                if (this.progressManager) {
                    this.progressManager.error(data.message);
                }
                break;
        }
    }

    // ═══════════════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════════════

    async loadDashboard() {
        try {
            const data = await api.getDashboard();
            this.dashboardData = data;
            this.renderDashboard(data);
        } catch (error) {
            api.handleError(error, 'loading dashboard');
        }
    }

    async loadCampaigns() {
        try {
            const campaigns = await api.getCampaigns();
            this.campaigns = campaigns;
            this.renderCampaigns(campaigns);
            this.updateCampaignSelect(campaigns);
            
            // Update campaign count badge
            const badge = document.getElementById('campaignCount');
            if (badge) badge.textContent = campaigns.length;
        } catch (error) {
            api.handleError(error, 'loading campaigns');
        }
    }

    async loadLeadsSection() {
        // Just make sure the campaign select is populated
        if (this.campaigns.length === 0) {
            await this.loadCampaigns();
        }
    }

    async loadLeadsForCampaign(campaignId) {
        if (!campaignId) return;
        
        const container = document.getElementById('leadsTableContainer');
        container.innerHTML = '<div class="loading">Loading leads...</div>';

        try {
            const data = await api.getLeads(campaignId);
            this.currentCampaign = campaignId;
            this.renderLeadsTable(data.leads || [], campaignId);
            
            // Show export button
            const exportBtn = document.getElementById('exportVCardBtn');
            if (exportBtn) exportBtn.style.display = '';
        } catch (error) {
            api.handleError(error, 'loading leads');
            container.innerHTML = '<div class="card" style="text-align:center;padding:2rem"><p class="empty-title">Failed to load leads</p></div>';
        }
    }

    async loadAnalytics() {
        try {
            const data = await api.getAnalytics();
            this.renderAnalytics(data);
        } catch (error) {
            api.handleError(error, 'loading analytics');
        }
    }

    // ═══════════════════════════════════════════════════════
    // RENDERING
    // ═══════════════════════════════════════════════════════

    renderDashboard(data) {
        const { overview, recentActivity } = data;

        // Stat cards
        const statsGrid = document.getElementById('statsGrid');
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Total Campaigns</span>
                    <div class="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>
                    </div>
                </div>
                <div class="stat-value">${api.formatNumber(overview.totalCampaigns)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Total Leads</span>
                    <div class="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                </div>
                <div class="stat-value">${api.formatNumber(overview.totalLeads)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Priority Leads</span>
                    <div class="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </div>
                </div>
                <div class="stat-value">${api.formatNumber(overview.totalPriorityLeads)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Avg Score</span>
                    <div class="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    </div>
                </div>
                <div class="stat-value">${overview.averageScore}</div>
            </div>
        `;

        // Recent activity
        const activityList = document.getElementById('activityList');
        if (recentActivity && recentActivity.length > 0) {
            activityList.innerHTML = recentActivity.map(activity => `
                <div class="activity-item" onclick="dashboard.showCampaignDetail('${activity.id}')">
                    <div class="activity-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>
                    </div>
                    <div class="activity-info">
                        <div class="activity-name">${api.safeString(activity.name)}</div>
                        <div class="activity-meta">${api.safeString(activity.industry)} · ${api.formatDateSafe(activity.executedAt)}</div>
                    </div>
                    <div class="activity-stats">
                        <span class="activity-stat">${activity.totalLeads} leads</span>
                        <span class="activity-stat highlight">${activity.priorityLeads} priority</span>
                    </div>
                </div>
            `).join('');
        } else {
            activityList.innerHTML = `
                <div class="card" style="text-align:center; padding:2rem">
                    <p class="empty-title">No campaigns yet</p>
                    <p class="empty-message">Create your first campaign to get started</p>
                </div>
            `;
        }
    }

    renderCampaigns(campaigns) {
        const grid = document.getElementById('campaignsGrid');

        if (!campaigns || campaigns.length === 0) {
            grid.innerHTML = `
                <div class="card" style="text-align:center; padding:3rem; grid-column:1/-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="48" height="48" style="opacity:0.3;margin-bottom:1rem"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>
                    <p class="empty-title">No Campaigns</p>
                    <p class="empty-message">Launch your first campaign to start generating leads</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = campaigns.map(campaign => {
            const status = campaign.results ? 'completed' : 'running';
            return `
                <div class="campaign-card" onclick="dashboard.showCampaignDetail('${campaign.id}')">
                    <div class="campaign-card-header">
                        <span class="campaign-card-title">${api.safeString(campaign.name)}</span>
                        <span class="campaign-card-badge ${status}">${status}</span>
                    </div>
                    <div class="campaign-card-meta">
                        <span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            ${api.formatDateSafe(campaign.executedAt)}
                        </span>
                        <span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                            ${api.safeString(campaign.industry)} · ${api.safeString(campaign.location || '')}
                        </span>
                    </div>
                    <div class="campaign-card-stats">
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${api.formatNumber(campaign.results?.totalLeads || 0)}</div>
                            <div class="campaign-stat-label">Leads</div>
                        </div>
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${api.formatNumber(campaign.results?.priorityLeads || 0)}</div>
                            <div class="campaign-stat-label">Priority</div>
                        </div>
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${campaign.results?.averageScore || 0}</div>
                            <div class="campaign-stat-label">Avg Score</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderLeadsTable(leads, campaignId) {
        const container = document.getElementById('leadsTableContainer');

        if (!leads || leads.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align:center; padding:3rem">
                    <p class="empty-title">No leads found</p>
                    <p class="empty-message">This campaign has no leads data</p>
                </div>
            `;
            return;
        }

        this.leadsTable = new DataTable(container, {
            campaignId,
            columns: [
                { key: 'name', title: 'Business Name', type: 'text' },
                { key: 'phone', title: 'Phone', type: 'text' },
                { key: 'address', title: 'Address', type: 'text' },
                { key: 'rating', title: 'Rating', type: 'text' },
                { key: 'intelligence.score', title: 'Score', type: 'score' },
                { key: 'intelligence.priority', title: 'Priority', type: 'priority' },
                { key: 'actions', title: 'Actions', type: 'actions' }
            ],
            data: leads,
            pagination: true,
            pageSize: 10,
            sortable: true
        });

        this.leadsTable.render();
    }

    renderAnalytics(data) {
        const { campaignTrends, industryStats, qualityDistribution } = data;

        // Trend cards
        const trendsContainer = document.getElementById('analyticsTrends');
        trendsContainer.innerHTML = `
            <div class="trend-card">
                <div class="trend-value">${api.formatNumber(campaignTrends.totalCampaigns)}</div>
                <div class="trend-label">Total Campaigns</div>
            </div>
            <div class="trend-card">
                <div class="trend-value">${api.formatNumber(campaignTrends.recentCampaigns)}</div>
                <div class="trend-label">Last 30 Days</div>
            </div>
            <div class="trend-card">
                <div class="trend-value">${api.formatNumber(campaignTrends.totalLeads)}</div>
                <div class="trend-label">All Leads</div>
            </div>
            <div class="trend-card">
                <div class="trend-value">${campaignTrends.avgQualityScore}</div>
                <div class="trend-label">Avg Quality</div>
            </div>
        `;

        // Industry chart
        const industryContent = document.getElementById('industryChartContent');
        const industryData = Object.entries(industryStats).map(([label, stats]) => ({
            label: label.charAt(0).toUpperCase() + label.slice(1),
            value: stats.totalLeads
        }));
        SimpleChart.createBarChart(industryContent, industryData, {
            title: '',
            color: '#6366f1'
        });

        // Quality distribution chart
        const qualityContent = document.getElementById('qualityChartContent');
        const qualityData = Object.entries(qualityDistribution).map(([label, value]) => ({
            label,
            value
        }));
        SimpleChart.createPieChart(qualityContent, qualityData, { title: '' });
    }

    // ═══════════════════════════════════════════════════════
    // CAMPAIGN ACTIONS
    // ═══════════════════════════════════════════════════════

    async createCampaign(event) {
        event.preventDefault();
        
        const form = document.getElementById('newCampaignForm');
        const formData = new FormData(form);
        const campaignData = Object.fromEntries(formData.entries());

        // Validate
        if (!campaignData.name || !campaignData.industry || !campaignData.location || !campaignData.searchQuery || !campaignData.yourService) {
            showNotification('Validation Error', 'Please fill in all required fields', 'warning');
            return;
        }

        try {
            hideModal();
            
            // Show progress modal
            this.progressManager.show(campaignData.name);

            const result = await api.createCampaign(campaignData);
            
            if (result.success) {
                showNotification('Campaign Launched', `Campaign "${campaignData.name}" is running`, 'success');
                form.reset();
            }
        } catch (error) {
            api.handleError(error, 'creating campaign');
            if (this.progressManager) {
                this.progressManager.error(error.message);
            }
        }
    }

    async showCampaignDetail(campaignId) {
        const content = document.getElementById('campaignDetailContent');
        content.innerHTML = '<div class="loading">Loading campaign details...</div>';
        showModal('campaignDetailModal');

        try {
            const campaign = await api.getCampaignDetail(campaignId);
            this.renderCampaignDetail(campaign);
        } catch (error) {
            content.innerHTML = '<p class="empty-title">Failed to load campaign details</p>';
            api.handleError(error, 'loading campaign details');
        }
    }

    renderCampaignDetail(campaign) {
        const content = document.getElementById('campaignDetailContent');
        
        content.innerHTML = `
            <div class="campaign-detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Campaign Name</div>
                    <div class="detail-value">${api.safeString(campaign.name)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Industry</div>
                    <div class="detail-value">${api.safeString(campaign.industry)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Location</div>
                    <div class="detail-value">${api.safeString(campaign.location || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Executed</div>
                    <div class="detail-value">${api.formatDateSafe(campaign.executedAt)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Total Leads</div>
                    <div class="detail-value">${api.formatNumber(campaign.results?.totalLeads || 0)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Priority Leads</div>
                    <div class="detail-value">${api.formatNumber(campaign.results?.priorityLeads || 0)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Avg Score</div>
                    <div class="detail-value">${campaign.results?.averageScore || 0}/100</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Content Generated</div>
                    <div class="detail-value">${campaign.results?.contentGenerated || 0} leads</div>
                </div>
            </div>
            ${campaign.leads && campaign.leads.length > 0 ? `
                <h4 style="margin-bottom:var(--space-md);font-weight:600">Top Leads</h4>
                ${campaign.leads.slice(0, 5).map((lead, index) => this.renderLeadCard(lead, campaign.id, index)).join('')}
            ` : ''}
        `;
    }

    renderLeadCard(lead, campaignId, index) {
        const score = lead.intelligence?.score || 0;
        const priority = lead.intelligence?.priority || 'LOW';
        const hasContent = lead.intelligence?.marketingContent;

        return `
            <div class="card" style="margin-bottom:var(--space-sm);padding:var(--space-md)">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-xs)">
                    <strong style="font-size:0.9rem">${api.safeString(lead.name)}</strong>
                    <span class="priority-badge priority-${priority.toLowerCase()}">${priority}</span>
                </div>
                <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:var(--space-sm)">
                    ${api.safeString(lead.phone || '')} · ${api.safeString(lead.address || '')}
                </div>
                <div style="display:flex;gap:var(--space-xs);flex-wrap:wrap">
                    <button class="btn-vcard" onclick="exportLeadVCard('${campaignId}', ${index}, '${api.safeString(lead.name).replace(/'/g, "\\'")}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                        vCard
                    </button>
                    ${hasContent ? `
                        <button class="btn-vcard" onclick="dashboard.showMarketingContent(${JSON.stringify(lead.intelligence.marketingContent).replace(/"/g, '&quot;')}, '${api.safeString(lead.name).replace(/'/g, "\\'")}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            Content
                        </button>
                    ` : ''}
                    ${lead.phone ? `
                        <button class="btn-vcard" onclick="dashboard.openWhatsApp('${lead.phone}', ${hasContent ? JSON.stringify(lead.intelligence.marketingContent.whatsapp || '').replace(/"/g, '&quot;') : "''"})">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                            WhatsApp
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // ─── Marketing Content ──────────────────────────────────
    showMarketingContent(content, leadName) {
        const container = document.getElementById('marketingContent');
        
        const subject = content.subject || content.email_subject || '';
        const email = content.email || content.email_body || '';
        const whatsapp = content.whatsapp || content.whatsapp_message || '';

        container.innerHTML = `
            <h4 style="margin-bottom:var(--space-md);font-size:0.9rem;font-weight:600">Content for ${api.safeString(leadName)}</h4>
            ${subject ? `
                <div class="marketing-content" style="margin-bottom:var(--space-md)">
                    <div class="marketing-header"><h4>Email Subject</h4></div>
                    <div class="marketing-body"><div class="content-preview">${api.safeString(subject)}</div></div>
                </div>
            ` : ''}
            ${email ? `
                <div class="marketing-content" style="margin-bottom:var(--space-md)">
                    <div class="marketing-header"><h4>Email Body</h4></div>
                    <div class="marketing-body"><div class="content-preview">${api.safeString(email)}</div></div>
                    <div class="marketing-actions">
                        <button class="btn btn-secondary btn-sm" onclick="dashboard.sendEmail('${api.safeString(subject).replace(/'/g, "\\'")}', '${api.safeString(email).replace(/'/g, "\\'")}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                            Open Email
                        </button>
                    </div>
                </div>
            ` : ''}
            ${whatsapp ? `
                <div class="marketing-content" style="margin-bottom:var(--space-md)">
                    <div class="marketing-header"><h4>WhatsApp Message</h4></div>
                    <div class="marketing-body"><div class="content-preview">${api.safeString(whatsapp)}</div></div>
                    <div class="marketing-actions">
                        <button class="btn btn-success btn-sm" onclick="navigator.clipboard.writeText(${JSON.stringify(whatsapp).replace(/"/g, '&quot;')}).then(()=>showNotification('Copied','Message copied to clipboard','success'))">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            Copy
                        </button>
                    </div>
                </div>
            ` : ''}
        `;

        showModal('marketingModal');
    }

    // ─── WhatsApp & Email ───────────────────────────────────
    openWhatsApp(phone, message) {
        try {
            let cleanPhone = phone.replace(/[^0-9+]/g, '');
            if (cleanPhone.startsWith('0')) {
                cleanPhone = '62' + cleanPhone.substring(1);
            }
            const text = encodeURIComponent(message || '');
            const url = `https://wa.me/${cleanPhone}${text ? '?text=' + text : ''}`;
            window.open(url, '_blank');
            showNotification('WhatsApp', 'Opening WhatsApp...', 'success');
        } catch (error) {
            api.handleError(error, 'opening WhatsApp');
        }
    }

    sendEmail(subject, body) {
        try {
            const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.open(mailtoUrl);
            showNotification('Email', 'Opening email client...', 'success');
        } catch (error) {
            api.handleError(error, 'opening email');
        }
    }

    // ─── Export ─────────────────────────────────────────────
    async exportAllVCards() {
        if (!this.currentCampaign) {
            showNotification('Export', 'Please select a campaign first', 'warning');
            return;
        }
        try {
            window.open(`/api/campaigns/${this.currentCampaign}/export/vcard`, '_blank');
            showNotification('Export', 'Downloading vCard bundle...', 'success');
        } catch (error) {
            api.handleError(error, 'exporting vCards');
        }
    }

    // ─── Campaign Select ────────────────────────────────────
    updateCampaignSelect(campaigns) {
        const select = document.getElementById('campaignSelect');
        if (!select) return;

        const current = select.value;
        select.innerHTML = '<option value="">Select Campaign</option>' +
            campaigns.map(c => `<option value="${c.id}">${api.safeString(c.name)}</option>`).join('');
        
        if (current) select.value = current;
    }
}

// ─── Global: Export Lead vCard ──────────────────────────────
function exportLeadVCard(campaignId, leadIndex, leadName) {
    try {
        window.open(`/api/leads/${campaignId}/${leadIndex}/vcard`, '_blank');
        showNotification('vCard', `Downloading contact for ${leadName}`, 'success');
    } catch (error) {
        showNotification('Error', 'Failed to export vCard', 'error');
    }
}

// ─── Initialize ────────────────────────────────────────────
const dashboard = new Dashboard();