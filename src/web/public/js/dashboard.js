// Main Dashboard Application
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
        this.setupEventListeners();
        this.setupRealTimeUpdates();
        this.progressManager = new ProgressManager('campaignProgressModal');
        
        // Load initial data
        await this.loadDashboardData();
        await this.loadCampaigns();
        
        // Show dashboard section by default
        this.showSection('dashboard');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                this.showSection(section);
            });
        });

        // New campaign button
        document.getElementById('newCampaignBtn').addEventListener('click', () => {
            this.openNewCampaignModal();
        });

        // Campaign form submission
        document.getElementById('newCampaignForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createCampaign();
        });

        // Campaign search and filters
        document.getElementById('campaignSearch')?.addEventListener('input', 
            api.debounce(() => this.filterCampaigns(), 300)
        );
        
        document.getElementById('industryFilter')?.addEventListener('change', () => {
            this.filterCampaigns();
        });

        // Leads filters
        document.getElementById('campaignSelect')?.addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadCampaignLeads(e.target.value);
            }
        });

        document.getElementById('priorityFilter')?.addEventListener('change', () => {
            this.filterLeads();
        });

        document.getElementById('minScoreFilter')?.addEventListener('input', 
            api.debounce(() => this.filterLeads(), 500)
        );

        // Industry selection auto-fill in campaign form
        document.getElementById('campaignIndustry')?.addEventListener('change', (e) => {
            this.updateCampaignFormDefaults(e.target.value);
        });
    }

    setupRealTimeUpdates() {
        this.eventSource = api.connectToEvents(
            (data) => this.handleRealTimeUpdate(data),
            (error) => console.error('Real-time connection error:', error)
        );
    }

    handleRealTimeUpdate(data) {
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
                if (this.progressManager) {
                    this.progressManager.complete(data.results);
                }
                showNotification('Campaign Complete', data.message, 'success');
                // Refresh data
                setTimeout(() => {
                    this.loadDashboardData();
                    this.loadCampaigns();
                }, 2000);
                break;
                
            case 'campaign_failed':
                if (this.progressManager) {
                    this.progressManager.error(data.message);
                }
                showNotification('Campaign Failed', data.message, 'error');
                break;
        }
    }

    showSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Update content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}-section`).classList.add('active');

        this.currentSection = sectionName;

        // Load section-specific data
        switch (sectionName) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'campaigns':
                this.renderCampaigns();
                break;
            case 'leads':
                this.renderLeads();
                break;
            case 'analytics':
                this.renderAnalytics();
                break;
        }
    }

    async loadDashboardData() {
        try {
            this.dashboardData = await api.getDashboard();
            this.updateUserInfo();
        } catch (error) {
            api.handleError(error, 'loading dashboard data');
        }
    }

    async loadCampaigns() {
        try {
            this.campaigns = await api.getCampaigns();
            this.populateCampaignSelect();
        } catch (error) {
            api.handleError(error, 'loading campaigns');
        }
    }

    updateUserInfo() {
        if (this.dashboardData?.userPreferences) {
            const industryElement = document.getElementById('userIndustry');
            if (industryElement) {
                const industry = this.dashboardData.userPreferences.industry;
                industryElement.textContent = api.getIndustryName(industry);
            }
        }
    }

    populateCampaignSelect() {
        const select = document.getElementById('campaignSelect');
        if (select && this.campaigns) {
            select.innerHTML = '<option value="">Select Campaign</option>';
            this.campaigns.forEach(campaign => {
                const option = document.createElement('option');
                option.value = campaign.id;
                option.textContent = `${campaign.name} (${campaign.results?.totalLeads || 0} leads)`;
                select.appendChild(option);
            });
        }
    }

    renderDashboard() {
        if (!this.dashboardData) return;

        const { overview, recentActivity } = this.dashboardData;

        // Update overview cards with safe formatting
        document.getElementById('totalCampaigns').textContent = api.formatNumber(overview.totalCampaigns || 0);
        document.getElementById('totalLeads').textContent = api.formatNumber(overview.totalLeads || 0);
        document.getElementById('priorityLeads').textContent = api.formatNumber(overview.totalPriorityLeads || 0);
        document.getElementById('averageScore').textContent = api.parseNumericValue(overview.averageScore) || '0';

        // Render recent activity
        this.renderRecentActivity(recentActivity);
    }

    renderRecentActivity(activities) {
        const container = document.getElementById('recentActivity');
        
        if (!activities || activities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <div class="empty-title">No recent activity</div>
                    <div class="empty-message">Create your first campaign to get started</div>
                </div>
            `;
            return;
        }

        container.innerHTML = activities.map(activity => `
            <div class="activity-item" onclick="dashboard.viewCampaign('${activity.id || ''}')">
                <div class="activity-info">
                    <h4>${api.getIndustryIcon(activity.industry)} ${api.safeString(activity.name, 'Unnamed Campaign')}</h4>
                    <p>${api.formatDateSafe(activity.executedAt)} • ${api.getIndustryName(activity.industry)}</p>
                </div>
                <div class="activity-stats">
                    <div class="leads-count">${api.formatNumber(activity.totalLeads || 0)} leads</div>
                    <div class="priority-count">${api.formatNumber(activity.priorityLeads || 0)} priority</div>
                </div>
            </div>
        `).join('');
    }

    renderCampaigns() {
        const container = document.getElementById('campaignsList');
        
        if (!this.campaigns || this.campaigns.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎯</div>
                    <div class="empty-title">No campaigns yet</div>
                    <div class="empty-message">Create your first campaign to start generating leads</div>
                    <button class="btn btn-primary" onclick="dashboard.openNewCampaignModal()">Create Campaign</button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.campaigns.map(campaign => `
            <div class="campaign-card" onclick="dashboard.viewCampaign('${campaign.id || ''}')">
                <div class="campaign-header">
                    <div>
                        <div class="campaign-title">
                            ${api.getIndustryIcon(campaign.industry)} ${api.safeString(campaign.name, 'Unnamed Campaign')}
                        </div>
                        <div class="campaign-meta">
                            ${api.formatDateSafe(campaign.executedAt)} • ${api.getIndustryName(campaign.industry)}
                        </div>
                    </div>
                    <div class="campaign-status status-completed">Completed</div>
                </div>
                <div class="campaign-stats">
                    <div class="stat-item">
                        <div class="stat-value">${api.formatNumber(campaign.results?.totalLeads || 0)}</div>
                        <div class="stat-label">Total Leads</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${api.formatNumber(campaign.results?.priorityLeads || 0)}</div>
                        <div class="stat-label">Priority</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${api.parseNumericValue(campaign.results?.averageScore) || '0'}</div>
                        <div class="stat-label">Avg Score</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    filterCampaigns() {
        const searchTerm = document.getElementById('campaignSearch')?.value.toLowerCase() || '';
        const industryFilter = document.getElementById('industryFilter')?.value || '';

        let filteredCampaigns = this.campaigns;

        if (searchTerm) {
            filteredCampaigns = filteredCampaigns.filter(campaign =>
                campaign.name.toLowerCase().includes(searchTerm) ||
                campaign.industry.toLowerCase().includes(searchTerm)
            );
        }

        if (industryFilter) {
            filteredCampaigns = filteredCampaigns.filter(campaign =>
                campaign.industry === industryFilter
            );
        }

        // Re-render with filtered data
        const container = document.getElementById('campaignsList');
        if (filteredCampaigns.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <div class="empty-title">No campaigns found</div>
                    <div class="empty-message">Try adjusting your search or filter criteria</div>
                </div>
            `;
        } else {
            // Use the same rendering logic but with filtered data
            const originalCampaigns = this.campaigns;
            this.campaigns = filteredCampaigns;
            this.renderCampaigns();
            this.campaigns = originalCampaigns;
        }
    }

    renderLeads() {
        const container = document.getElementById('leadsTable');
        
        if (!this.currentCampaign) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <div class="empty-title">Select a campaign</div>
                    <div class="empty-message">Choose a campaign from the dropdown to view its leads</div>
                </div>
            `;
            return;
        }

        // Initialize leads table
        this.leadsTable = new DataTable(container, {
            columns: [
                { key: 'name', title: 'Business Name', sortable: true },
                { key: 'address', title: 'Address', sortable: true },
                { key: 'phone', title: 'Phone', sortable: false },
                { key: 'intelligence.score', title: 'Score', type: 'score', sortable: true },
                { key: 'intelligence.priority', title: 'Priority', type: 'priority', sortable: true },
                { key: 'rating', title: 'Rating', type: 'number', sortable: true },
                { key: 'actions', title: 'Actions', type: 'actions', sortable: false }
            ],
            data: this.currentCampaign.leads || [],
            campaignId: this.currentCampaign.id,
            pageSize: 20,
            pagination: true,
            sortable: true
        });

        this.leadsTable.render();
    }

    async loadCampaignLeads(campaignId) {
        try {
            api.showLoading('leadsTable', 'Loading campaign leads...');
            this.currentCampaign = await api.getCampaign(campaignId);
            this.renderLeads();
        } catch (error) {
            api.handleError(error, 'loading campaign leads');
        }
    }

    filterLeads() {
        if (!this.leadsTable || !this.currentCampaign) return;

        const priority = document.getElementById('priorityFilter')?.value;
        const minScore = parseInt(document.getElementById('minScoreFilter')?.value) || 0;

        this.leadsTable.filter(lead => {
            let matches = true;

            if (priority && lead.intelligence?.priority !== priority) {
                matches = false;
            }

            if (minScore > 0 && (lead.intelligence?.score || 0) < minScore) {
                matches = false;
            }

            return matches;
        });
    }

    async renderAnalytics() {
        try {
            api.showLoading('industryChart', 'Loading analytics...');
            api.showLoading('qualityChart', 'Loading analytics...');
            api.showLoading('trendsChart', 'Loading analytics...');

            const analytics = await api.getAnalytics();

            // Industry performance chart
            const industryData = Object.entries(analytics.industryStats).map(([industry, stats]) => ({
                label: api.getIndustryName(industry),
                value: stats.totalLeads
            }));

            SimpleChart.createBarChart(
                document.getElementById('industryChart'),
                industryData,
                { title: 'Leads by Industry' }
            );

            // Lead quality distribution
            const qualityData = Object.entries(analytics.qualityDistribution).map(([priority, count]) => ({
                label: `${priority} Priority`,
                value: count
            }));

            SimpleChart.createPieChart(
                document.getElementById('qualityChart'),
                qualityData,
                { title: 'Lead Quality Distribution' }
            );

            // Campaign trends
            const trendsContainer = document.getElementById('trendsChart');
            trendsContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; padding: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold; color: var(--primary-color);">
                            ${api.formatNumber(analytics.campaignTrends.totalCampaigns)}
                        </div>
                        <div style="color: var(--text-secondary);">Total Campaigns</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold; color: var(--success-color);">
                            ${api.formatNumber(analytics.campaignTrends.totalLeads)}
                        </div>
                        <div style="color: var(--text-secondary);">Total Leads</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold; color: var(--warning-color);">
                            ${analytics.campaignTrends.avgQualityScore}
                        </div>
                        <div style="color: var(--text-secondary);">Avg Quality Score</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold; color: var(--primary-color);">
                            ${api.formatNumber(analytics.campaignTrends.recentCampaigns)}
                        </div>
                        <div style="color: var(--text-secondary);">Recent (30 days)</div>
                    </div>
                </div>
            `;

        } catch (error) {
            api.handleError(error, 'loading analytics');
        }
    }

    openNewCampaignModal() {
        // Pre-fill with user preferences
        if (this.dashboardData?.userPreferences) {
            const industry = this.dashboardData.userPreferences.industry;
            const industrySelect = document.getElementById('campaignIndustry');
            if (industrySelect && industry) {
                industrySelect.value = industry;
                this.updateCampaignFormDefaults(industry);
            }
        }

        showModal('newCampaignModal');
    }

    closeNewCampaignModal() {
        hideModal();
        document.getElementById('newCampaignForm').reset();
    }

    updateCampaignFormDefaults(industry) {
        const locationInput = document.getElementById('campaignLocation');
        const queryInput = document.getElementById('searchQuery');

        if (locationInput && !locationInput.value) {
            locationInput.value = 'Jakarta';
        }

        if (queryInput && industry) {
            const queries = {
                restaurant: 'Restaurant Jakarta',
                automotive: 'Rental mobil Jakarta',
                retail: 'Toko Jakarta',
                professional: 'Konsultan Jakarta',
                healthcare: 'Klinik Jakarta',
                education: 'Kursus Jakarta',
                realestate: 'Property Jakarta'
            };
            
            if (!queryInput.value) {
                queryInput.value = queries[industry] || 'Bisnis Jakarta';
            }
        }
    }

    async createCampaign() {
        const form = document.getElementById('newCampaignForm');
        const formData = new FormData(form);
        
        const campaignData = {
            name: formData.get('name'),
            industry: formData.get('industry'),
            location: formData.get('location'),
            searchQuery: formData.get('searchQuery'),
            maxResults: parseInt(formData.get('maxResults')) || 20,
            contentStyle: formData.get('contentStyle'),
            language: formData.get('language') || 'indonesian',
            yourService: formData.get('yourService')
        };

        try {
            // Close the modal and show progress
            this.closeNewCampaignModal();
            this.progressManager.show(campaignData.name);

            // Create the campaign
            const result = await api.createCampaign(campaignData);
            
            if (result.success) {
                showNotification('Campaign Started', 'Your campaign is now running in the background', 'success');
            }

        } catch (error) {
            this.progressManager.error(error.message);
            api.handleError(error, 'creating campaign');
        }
    }

    async viewCampaign(campaignId) {
        try {
            // Load campaign details
            const campaign = await api.getCampaign(campaignId);
            this.currentCampaign = campaign;
            
            // Show campaign detail view
            this.showCampaignDetail(campaign);
        } catch (error) {
            api.handleError(error, 'loading campaign details');
        }
    }

    showCampaignDetail(campaign) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show campaign detail section
        const detailSection = document.getElementById('campaign-detail');
        if (detailSection) {
            detailSection.classList.add('active');
            this.renderCampaignDetail(campaign);
        }
    }

    renderCampaignDetail(campaign) {
        // Update campaign detail header
        document.getElementById('campaignDetailName').textContent = campaign.name || 'Unnamed Campaign';
        document.getElementById('campaignDetailIndustry').textContent = api.getIndustryName(campaign.industry);
        document.getElementById('campaignDetailLocation').textContent = campaign.location || 'Unknown Location';
        document.getElementById('campaignDetailDate').textContent = api.formatDateSafe(campaign.executedAt);
        
        // Render campaign stats
        this.renderCampaignStats(campaign);
        
        // Render leads table in detail view
        this.renderCampaignLeadsDetail(campaign);
        
        // Render campaign insights
        this.renderCampaignInsights(campaign);
        
        // Render marketing content
        this.renderMarketingContent(campaign);
    }

    renderCampaignStats(campaign) {
        const results = campaign.results || {};
        const leads = campaign.leads || [];
        
        // Calculate additional stats
        const totalLeads = results.totalLeads || leads.length || 0;
        const priorityLeads = results.priorityLeads || leads.filter(lead =>
            lead.intelligence?.priority === 'high' || lead.intelligence?.priority === 'medium'
        ).length || 0;
        const averageScore = results.averageScore || this.calculateAverageScore(leads);
        const averageRating = this.calculateAverageRating(leads);
        
        // Update stat cards
        document.getElementById('detailTotalLeads').textContent = api.formatNumber(totalLeads);
        document.getElementById('detailPriorityLeads').textContent = api.formatNumber(priorityLeads);
        document.getElementById('detailAverageScore').textContent = api.parseNumericValue(averageScore) || '0';
        document.getElementById('detailAverageRating').textContent = api.parseNumericValue(averageRating) || '0';
    }

    calculateAverageScore(leads) {
        if (!leads || leads.length === 0) return 0;
        
        const validScores = leads
            .map(lead => api.parseNumericValue(lead.intelligence?.score))
            .filter(score => score !== null && !isNaN(score));
            
        if (validScores.length === 0) return 0;
        
        const sum = validScores.reduce((acc, score) => acc + score, 0);
        return (sum / validScores.length).toFixed(1);
    }

    calculateAverageRating(leads) {
        if (!leads || leads.length === 0) return 0;
        
        const validRatings = leads
            .map(lead => api.parseNumericValue(lead.rating))
            .filter(rating => rating !== null && !isNaN(rating));
            
        if (validRatings.length === 0) return 0;
        
        const sum = validRatings.reduce((acc, rating) => acc + rating, 0);
        return (sum / validRatings.length).toFixed(1);
    }

    renderCampaignLeadsDetail(campaign) {
        const container = document.getElementById('campaignLeadsTable');
        
        if (!campaign.leads || campaign.leads.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <div class="empty-title">No leads found</div>
                    <div class="empty-message">This campaign didn't generate any leads</div>
                </div>
            `;
            return;
        }

        // Initialize leads table for detail view
        const detailTable = new DataTable(container, {
            columns: [
                { key: 'name', title: 'Business Name', sortable: true },
                { key: 'address', title: 'Address', sortable: true },
                { key: 'phone', title: 'Phone', sortable: false },
                { key: 'intelligence.score', title: 'Score', type: 'score', sortable: true },
                { key: 'intelligence.priority', title: 'Priority', type: 'priority', sortable: true },
                { key: 'rating', title: 'Rating', type: 'number', sortable: true },
                { key: 'actions', title: 'Actions', type: 'actions', sortable: false }
            ],
            data: campaign.leads,
            campaignId: campaign.id,
            pageSize: 10,
            pagination: true,
            sortable: true
        });

        detailTable.render();
    }

    renderCampaignInsights(campaign) {
        const leads = campaign.leads || [];
        
        // Calculate priority distribution
        const priorityStats = {
            high: leads.filter(lead => lead.intelligence?.priority === 'high').length,
            medium: leads.filter(lead => lead.intelligence?.priority === 'medium').length,
            low: leads.filter(lead => lead.intelligence?.priority === 'low').length
        };
        
        // Calculate score distribution
        const scoreRanges = {
            high: leads.filter(lead => (lead.intelligence?.score || 0) >= 80).length,
            medium: leads.filter(lead => {
                const score = lead.intelligence?.score || 0;
                return score >= 60 && score < 80;
            }).length,
            low: leads.filter(lead => (lead.intelligence?.score || 0) < 60).length
        };
        
        // Update insights
        const totalLeads = leads.length;
        const conversionRate = totalLeads > 0 ? ((priorityStats.high + priorityStats.medium) / totalLeads * 100).toFixed(1) : 0;
        const qualityScore = totalLeads > 0 ? ((scoreRanges.high * 3 + scoreRanges.medium * 2 + scoreRanges.low * 1) / (totalLeads * 3) * 100).toFixed(1) : 0;
        
        // Update insight values
        document.getElementById('insightConversionRate').textContent = `${conversionRate}%`;
        document.getElementById('insightQualityScore').textContent = `${qualityScore}%`;
        document.getElementById('insightHighPriority').textContent = api.formatNumber(priorityStats.high);
        
        // Update priority distribution
        document.getElementById('priorityHigh').textContent = api.formatNumber(priorityStats.high);
        document.getElementById('priorityMedium').textContent = api.formatNumber(priorityStats.medium);
        document.getElementById('priorityLow').textContent = api.formatNumber(priorityStats.low);
        
        // Update progress bars
        const highPercentage = totalLeads > 0 ? (priorityStats.high / totalLeads * 100) : 0;
        const mediumPercentage = totalLeads > 0 ? (priorityStats.medium / totalLeads * 100) : 0;
        const lowPercentage = totalLeads > 0 ? (priorityStats.low / totalLeads * 100) : 0;
        
        const conversionBar = document.getElementById('conversionRateBar');
        const qualityBar = document.getElementById('qualityScoreBar');
        
        if (conversionBar) {
            conversionBar.style.width = `${conversionRate}%`;
        }
        
        if (qualityBar) {
            qualityBar.style.width = `${qualityScore}%`;
        }
    }

    renderMarketingContent(campaign) {
        const leads = campaign.leads || [];
        
        if (leads.length === 0) {
            document.getElementById('whatsappContent').textContent = 'No leads available for marketing content generation.';
            document.getElementById('emailContent').textContent = 'No leads available for marketing content generation.';
            return;
        }
        
        // Get sample lead for marketing content
        const sampleLead = leads.find(lead => lead.intelligence?.priority === 'high') || leads[0];
        
        if (sampleLead && sampleLead.intelligence?.marketingContent) {
            const content = sampleLead.intelligence.marketingContent;
            
            // Display WhatsApp content
            const whatsappContent = content.whatsapp || 'WhatsApp content not available';
            document.getElementById('whatsappContent').textContent = whatsappContent;
            
            // Display Email content
            const emailContent = content.email || 'Email content not available';
            document.getElementById('emailContent').textContent = emailContent;
        } else {
            // Generate personalized marketing content based on campaign data
            const businessName = sampleLead?.name || 'Business Partner';
            const industry = api.getIndustryName(campaign.industry);
            const serviceName = "Asiifdev";
            const location = campaign.location || "Jakarta";
            
            // Enhanced WhatsApp message with service-specific content
            const whatsappMessage = `🎉 Halo! Saya dari ${serviceName} - solusi manajemen inventori untuk bisnis rental peralatan event.

Saya melihat ${businessName} bergerak di bidang ${industry.toLowerCase()} di ${location}. Apakah Anda sering mengalami:
❌ Barang hilang saat event
❌ Kesulitan tracking ribuan item
❌ Laporan keuangan manual yang ribet

${serviceName} membantu event organizer seperti Anda:
✅ Tracking real-time dengan QR code
✅ Sistem POS rental yang cepat
✅ Laporan otomatis & backup Google Sheets
✅ Tingkatkan produktivitas hingga 70%

Mau demo gratis khusus untuk ${businessName}? Chat saya sekarang! 📱`;

            // Enhanced Email message with professional format
            const emailMessage = `Subject: Solusi Manajemen Inventori untuk ${businessName}

Halo Tim ${businessName},

Saya dari ${serviceName}, sistem manajemen inventori khusus untuk bisnis rental peralatan event di ${location}.

Kami memahami tantangan yang dihadapi ${industry.toLowerCase()} seperti ${businessName}:
- Kesulitan melacak ribuan item peralatan
- Kerugian dari barang hilang/rusak
- Proses manual yang memakan waktu

${serviceName} menawarkan solusi all-in-one:
• Tracking real-time semua peralatan dengan QR code
• Sistem POS untuk rental in/out yang efisien
• Manajemen customer dan history lengkap
• Laporan keuangan otomatis
• Multi-branch management

Hasil yang telah dicapai klien kami di ${location}:
- Produktivitas meningkat 70%
- Kerugian barang berkurang 85%
- Waktu operasional lebih efisien

Tertarik untuk demo gratis khusus ${businessName}? Mari diskusikan bagaimana ${serviceName} dapat membantu bisnis Anda berkembang.

Best regards,
Tim ${serviceName}
📧 info@asiifdev.com
📱 WhatsApp: +62-xxx-xxxx-xxxx`;
            
            document.getElementById('whatsappContent').textContent = whatsappMessage;
            document.getElementById('emailContent').textContent = emailMessage;
        }
    }

    // Back to campaigns from detail view
    backToCampaigns() {
        this.showSection('campaigns');
    }

    // Send WhatsApp message
    sendWhatsApp(content) {
        try {
            // Format content for WhatsApp
            const message = encodeURIComponent(content);
            const whatsappUrl = `https://wa.me/?text=${message}`;
            
            // Open WhatsApp in new tab
            window.open(whatsappUrl, '_blank');
            
            showNotification('WhatsApp', 'WhatsApp opened with your message', 'success');
        } catch (error) {
            api.handleError(error, 'opening WhatsApp');
        }
    }

    // Send Email
    sendEmail(content) {
        try {
            // Extract subject and body from content
            const lines = content.split('\n');
            const subjectLine = lines.find(line => line.startsWith('Subject:'));
            const subject = subjectLine ? encodeURIComponent(subjectLine.replace('Subject:', '').trim()) : encodeURIComponent('Business Partnership Opportunity');
            
            // Get body content (everything after subject line)
            const subjectIndex = lines.findIndex(line => line.startsWith('Subject:'));
            const bodyLines = subjectIndex >= 0 ? lines.slice(subjectIndex + 1) : lines;
            const body = encodeURIComponent(bodyLines.join('\n').trim());
            
            // Create mailto URL
            const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
            
            // Open email client
            window.location.href = mailtoUrl;
            
            showNotification('Email', 'Email client opened with your message', 'success');
        } catch (error) {
            api.handleError(error, 'opening email client');
        }
    }

    closeCampaignProgressModal() {
        this.progressManager.hide();
    }

    async exportData() {
        try {
            if (this.currentSection === 'leads' && this.currentCampaign) {
                // Export current campaign leads
                const leads = this.currentCampaign.leads || [];
                const exportData = leads.map(lead => ({
                    name: lead.name,
                    address: lead.address,
                    phone: lead.phone,
                    email: lead.email || '',
                    website: lead.website || '',
                    rating: lead.rating || '',
                    score: lead.intelligence?.score || 0,
                    category: lead.intelligence?.category || '',
                    priority: lead.intelligence?.priority || '',
                    recommendation: lead.intelligence?.recommendation || ''
                }));

                const filename = `${this.currentCampaign.name}_leads_${new Date().toISOString().split('T')[0]}.csv`;
                api.exportToCSV(exportData, filename);
                showNotification('Export Complete', `Exported ${exportData.length} leads to ${filename}`, 'success');

            } else if (this.currentSection === 'campaigns') {
                // Export campaigns summary
                const exportData = this.campaigns.map(campaign => ({
                    name: campaign.name,
                    industry: campaign.industry,
                    location: campaign.location,
                    executedAt: campaign.executedAt,
                    totalLeads: campaign.results?.totalLeads || 0,
                    priorityLeads: campaign.results?.priorityLeads || 0,
                    averageScore: campaign.results?.averageScore || 0
                }));

                const filename = `campaigns_summary_${new Date().toISOString().split('T')[0]}.csv`;
                api.exportToCSV(exportData, filename);
                showNotification('Export Complete', `Exported ${exportData.length} campaigns to ${filename}`, 'success');

            } else {
                showNotification('Export Info', 'Navigate to Campaigns or Leads section to export data', 'info');
            }

        } catch (error) {
            api.handleError(error, 'exporting data');
        }
    }

    // Export single lead as vCard
    async exportLeadVCard(campaignId, leadIndex, leadName) {
        try {
            await api.exportLeadVCard(campaignId, leadIndex, leadName);
            showNotification('vCard Export', `Contact "${leadName}" exported successfully! Check your downloads.`, 'success');
        } catch (error) {
            api.handleError(error, 'exporting vCard');
        }
    }

    // Export all campaign leads as vCard bundle
    async exportCampaignVCard(campaignId, campaignName) {
        try {
            await api.exportCampaignVCard(campaignId, campaignName);
            showNotification('vCard Export', `All contacts from "${campaignName}" exported successfully!`, 'success');
        } catch (error) {
            api.handleError(error, 'exporting vCard bundle');
        }
    }
}

// Global functions for HTML onclick handlers
window.openNewCampaignModal = () => dashboard.openNewCampaignModal();
window.closeNewCampaignModal = () => dashboard.closeNewCampaignModal();
window.closeCampaignProgressModal = () => dashboard.closeCampaignProgressModal();
window.showSection = (section) => dashboard.showSection(section);
window.exportData = () => dashboard.exportData();

// Global vCard export functions
window.exportLeadVCard = (campaignId, leadIndex, leadName) => dashboard.exportLeadVCard(campaignId, leadIndex, leadName);
window.exportCampaignVCard = (campaignId, campaignName) => dashboard.exportCampaignVCard(campaignId, campaignName);

// Global campaign detail functions
window.backToCampaigns = () => dashboard.backToCampaigns();
window.sendWhatsApp = (content) => dashboard.sendWhatsApp(content);
window.sendEmail = (content) => dashboard.sendEmail(content);

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (dashboard.eventSource) {
        api.disconnectFromEvents();
    }
});