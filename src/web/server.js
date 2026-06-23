const express = require('express');
const helmet = require('helmet');
const Csrf = require('csrf');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
require('dotenv').config();

// CSRF token store — protects state-changing endpoints for browser clients.
// API clients using X-Auth-Token custom header are inherently CSRF-safe since
// browsers cannot send custom headers cross-origin without a CORS preflight.
const csrfTokens = new Csrf();

const BusinessScraper = require('../scraper');
const MarketingAI = require('../marketingAI');
const LeadIntelligence = require('../leadIntelligence');
const db = require('../database');

const app = express();
const PORT = process.env.WEB_PORT || 3000;

// --- Auth middleware ---

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';
const sessions = new Map();

function authMiddleware(req, res, next) {
    if (!DASHBOARD_PASSWORD) return next();

    // Allow health check without auth
    if (req.path === '/api/health') return next();

    // Allow login endpoint
    if (req.path === '/api/auth/login') return next();

    // Only accept token via header — never query param (prevents token leakage in server logs/URLs).
    // SSE clients should request a short-lived ticket via POST /api/auth/sse-ticket first.
    const token = req.headers['x-auth-token'];
    if (token && sessions.has(token)) {
        const session = sessions.get(token);
        if (Date.now() < session.expiresAt) return next();
        sessions.delete(token);
    }

    // For static assets, redirect to login
    if (!req.path.startsWith('/api/')) {
        return res.sendFile(path.join(__dirname, 'public', 'login.html'), (err) => {
            if (err) next();
        });
    }

    res.status(401).json({ error: 'Unauthorized' });
}

// --- Middleware ---
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdn.jsdelivr.net'],
            styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'fonts.gstatic.com'],
            fontSrc: ["'self'", 'fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"]
        }
    },
    // Custom auth header (X-Auth-Token) mitigates CSRF for authenticated endpoints.
    // Browsers cannot send custom headers cross-origin without a preflight, which we reject.
    crossOriginResourcePolicy: { policy: 'same-origin' }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

// --- SSE ---
const sseConnections = new Set();
const activeCampaigns = new Map();

app.get('/api/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
    sseConnections.add(res);
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    req.on('close', () => sseConnections.delete(res));
});

function broadcastSSE(data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    sseConnections.forEach(res => {
        try { res.write(message); } catch (_) { sseConnections.delete(res); }
    });
}

// --- Auth routes ---

app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    if (!DASHBOARD_PASSWORD || password === DASHBOARD_PASSWORD) {
        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(token, { createdAt: Date.now(), expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
        return res.json({ token });
    }
    res.status(401).json({ error: 'Invalid password' });
});

app.post('/api/auth/logout', (req, res) => {
    const token = req.headers['x-auth-token'];
    if (token) sessions.delete(token);
    res.json({ success: true });
});

app.get('/api/auth/status', (req, res) => {
    res.json({ requiresAuth: !!DASHBOARD_PASSWORD });
});

// --- Dashboard ---

app.get('/api/dashboard', async (req, res) => {
    try {
        const [campaigns, analytics] = await Promise.all([
            db.getCampaigns(5),
            db.getAnalytics()
        ]);

        const userPrefs = loadUserPreferences();

        res.json({
            overview: {
                totalCampaigns: analytics.overview?.total_campaigns || 0,
                totalLeads: analytics.overview?.total_leads || 0,
                totalPriorityLeads: analytics.overview?.high_priority_leads || 0,
                averageScore: analytics.overview?.avg_score || 0,
                wonLeads: analytics.overview?.won_leads || 0,
                contactedLeads: analytics.overview?.contacted_leads || 0,
                primaryIndustry: userPrefs?.industry || 'professional'
            },
            recentActivity: campaigns.map(c => ({
                id: c.id,
                name: c.name,
                industry: c.industry,
                status: c.status,
                executedAt: c.created_at,
                totalLeads: c.total_leads,
                priorityLeads: c.priority_leads
            })),
            userPreferences: userPrefs
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
});

// --- Campaigns ---

app.get('/api/campaigns', async (req, res) => {
    try {
        const campaigns = await db.getCampaigns(100);
        res.json(campaigns.map(normalizeCampaign));
    } catch (error) {
        console.error('Error getting campaigns:', error);
        res.status(500).json({ error: 'Failed to load campaigns' });
    }
});

app.get('/api/campaigns/:id', async (req, res) => {
    try {
        const campaign = await db.getCampaign(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        res.json(normalizeCampaign(campaign));
    } catch (error) {
        console.error('Error getting campaign:', error);
        res.status(500).json({ error: 'Failed to load campaign' });
    }
});

app.delete('/api/campaigns/:id', async (req, res) => {
    try {
        await db.deleteCampaign(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
});

app.post('/api/campaigns', async (req, res) => {
    try {
        const { name, industry, location, searchQuery, searchQueries, maxResults, yourService, contentStyle, language } = req.body;

        // Support both single searchQuery and batch searchQueries array
        const queries = Array.isArray(searchQueries) && searchQueries.length > 0
            ? searchQueries.filter(q => q && String(q).trim())
            : (searchQuery ? [String(searchQuery).trim()] : []);

        if (!name || !industry || !location || queries.length === 0 || !yourService) {
            return res.status(400).json({ error: 'Missing required fields: name, industry, location, searchQuery/searchQueries, yourService' });
        }

        const campaignId = `campaign_${name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}_${Date.now()}`;
        const startedAt = new Date().toISOString();

        // Store multiple queries as JSON array, single query as plain string (backwards compat)
        const storedQuery = queries.length === 1 ? queries[0] : JSON.stringify(queries);

        await db.saveCampaign({
            id: campaignId, name, industry, location,
            searchQuery: storedQuery,
            maxResults: parseInt(maxResults) || 20, yourService,
            contentStyle: contentStyle || 'balanced',
            language: language || 'indonesian',
            status: 'starting', progress: 0, startedAt
        });

        activeCampaigns.set(campaignId, { id: campaignId, status: 'starting' });

        broadcastSSE({ type: 'campaign_started', campaignId, message: `Campaign "${name}" started (${queries.length} search${queries.length > 1 ? 'es' : ''})` });
        executeCampaignAsync(campaignId);

        res.json({ success: true, campaignId, batchSize: queries.length, message: 'Campaign started successfully' });
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

app.get('/api/campaigns/:id/status', async (req, res) => {
    const active = activeCampaigns.get(req.params.id);
    if (active) return res.json(active);

    try {
        const campaign = await db.getCampaign(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        res.json(normalizeCampaign(campaign));
    } catch (error) {
        res.status(500).json({ error: 'Failed to get campaign status' });
    }
});

// --- Leads ---

app.get('/api/campaigns/:id/leads', async (req, res) => {
    try {
        const { page, limit, priority, minScore, crmStatus, search } = req.query;
        const result = await db.getLeads(req.params.id, { page, limit, priority, minScore, crmStatus, search });
        res.json(result);
    } catch (error) {
        console.error('Error getting leads:', error);
        res.status(500).json({ error: 'Failed to load leads' });
    }
});

app.get('/api/leads/:id', async (req, res) => {
    try {
        const lead = await db.getLead(parseInt(req.params.id));
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        res.json(lead);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load lead' });
    }
});

// CRM status update
app.patch('/api/leads/:id/crm', async (req, res) => {
    try {
        const leadId = parseInt(req.params.id);
        const { crm_status, crm_notes, follow_up_date } = req.body;

        const updates = {};
        if (crm_status) updates.crm_status = crm_status;
        if (crm_notes !== undefined) updates.crm_notes = crm_notes;
        if (follow_up_date !== undefined) updates.follow_up_date = follow_up_date;

        // Set timestamp based on status
        const now = new Date().toISOString();
        if (crm_status === 'contacted') updates.contacted_at = now;
        if (crm_status === 'replied') updates.replied_at = now;
        if (crm_status === 'won' || crm_status === 'lost') {
            updates.closed_at = now;
            updates.close_result = crm_status;
        }

        await db.updateLeadCRM(leadId, updates);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating lead CRM:', error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

// Add activity note to lead
app.post('/api/leads/:id/activities', async (req, res) => {
    try {
        const { type = 'note', note } = req.body;
        await db.addLeadActivity(parseInt(req.params.id), type, note);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add activity' });
    }
});

// Schedule follow-up
app.post('/api/leads/:id/followups', async (req, res) => {
    try {
        const { campaign_id, scheduled_at, note } = req.body;
        if (!campaign_id || !scheduled_at) {
            return res.status(400).json({ error: 'campaign_id and scheduled_at required' });
        }
        await db.scheduleFollowUp(parseInt(req.params.id), campaign_id, scheduled_at, note);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to schedule follow-up' });
    }
});

// Get pending follow-ups
app.get('/api/followups/pending', async (req, res) => {
    try {
        const followUps = await db.getPendingFollowUps();
        res.json(followUps);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load follow-ups' });
    }
});

app.patch('/api/followups/:id/done', async (req, res) => {
    try {
        await db.markFollowUpDone(parseInt(req.params.id));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark follow-up done' });
    }
});

// --- Analytics ---

app.get('/api/analytics', async (req, res) => {
    try {
        const analytics = await db.getAnalytics();

        // Format for frontend compatibility
        const byPriority = {};
        (analytics.byPriority || []).forEach(r => { byPriority[r.priority] = r.count; });

        const byCrmStatus = {};
        (analytics.byCrmStatus || []).forEach(r => { byCrmStatus[r.crm_status] = r.count; });

        const industryStats = {};
        (analytics.byIndustry || []).forEach(r => {
            industryStats[r.industry] = {
                campaigns: 1,
                totalLeads: r.total_leads,
                avgScore: r.avg_score,
                highPriority: r.high_priority
            };
        });

        res.json({
            overview: analytics.overview,
            industryStats,
            qualityDistribution: byPriority,
            crmFunnel: byCrmStatus,
            trendData: analytics.trendData,
            campaignTrends: {
                totalCampaigns: analytics.overview?.total_campaigns || 0,
                totalLeads: analytics.overview?.total_leads || 0,
                avgQualityScore: analytics.overview?.avg_score || 0
            }
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to load analytics' });
    }
});

// --- Export ---

app.get('/api/campaigns/:id/export/csv', async (req, res) => {
    try {
        const campaign = await db.getCampaign(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const { leads } = await db.getLeads(req.params.id, { limit: 10000 });
        const csv = generateCSV(leads);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(campaign.name)}_leads.csv"`);
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export CSV' });
    }
});

app.get('/api/campaigns/:id/export/json', async (req, res) => {
    try {
        const campaign = await db.getCampaign(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const { leads } = await db.getLeads(req.params.id, { limit: 10000 });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(campaign.name)}_leads.json"`);
        res.json(leads);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export JSON' });
    }
});

app.get('/api/campaigns/:id/export/vcard', async (req, res) => {
    try {
        const campaign = await db.getCampaign(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const { leads } = await db.getLeads(req.params.id, { limit: 10000 });
        const vcards = leads.map(generateVCard).join('\r\n\r\n');

        res.setHeader('Content-Type', 'text/vcard');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(campaign.name)}_contacts.vcf"`);
        res.send(vcards);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export vCard' });
    }
});

app.get('/api/campaigns/:id/export/xlsx', async (req, res) => {
    try {
        const campaign = await db.getCampaign(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const { leads } = await db.getLeads(req.params.id, { limit: 10000 });

        const wb = XLSX.utils.book_new();

        // Sheet 1: Leads
        const leadsData = leads.map((l, i) => ({
            'No': i + 1,
            'Business Name': l.name || '',
            'Address': l.address || '',
            'Phone': l.phone || '',
            'Website': l.website || '',
            'Rating': l.rating || '',
            'Score': l.score || 0,
            'Priority': l.priority || 'LOW',
            'CRM Status': l.crm_status || 'new',
            'Has Website': l.has_website ? 'Yes' : 'No',
            'Source': l.source || 'Google Maps',
            'Notes': l.crm_notes || '',
            'Scraped At': l.scraped_at || ''
        }));
        const ws1 = XLSX.utils.json_to_sheet(leadsData);

        // Column widths
        ws1['!cols'] = [
            { wch: 5 }, { wch: 35 }, { wch: 40 }, { wch: 18 },
            { wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 10 },
            { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 20 }
        ];
        XLSX.utils.book_append_sheet(wb, ws1, 'Leads');

        // Sheet 2: Campaign Summary
        const summaryData = [
            { Field: 'Campaign Name', Value: campaign.name },
            { Field: 'Industry', Value: campaign.industry || '' },
            { Field: 'Location', Value: campaign.location || '' },
            { Field: 'Search Query', Value: campaign.search_query || '' },
            { Field: 'Status', Value: campaign.status },
            { Field: 'Total Leads', Value: campaign.total_leads || 0 },
            { Field: 'Priority Leads', Value: campaign.priority_leads || 0 },
            { Field: 'High Quality Leads', Value: campaign.high_quality_leads || 0 },
            { Field: 'Average Score', Value: campaign.average_score || 0 },
            { Field: 'Started At', Value: campaign.started_at || '' },
            { Field: 'Completed At', Value: campaign.completed_at || '' }
        ];
        const ws2 = XLSX.utils.json_to_sheet(summaryData);
        ws2['!cols'] = [{ wch: 20 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Campaign Summary');

        // Sheet 3: Marketing Content (leads with content only)
        const leadsWithContent = leads.filter(l => l.marketing_content);
        if (leadsWithContent.length > 0) {
            const contentData = leadsWithContent.map(l => {
                const mc = typeof l.marketing_content === 'string'
                    ? JSON.parse(l.marketing_content) : (l.marketing_content || {});
                return {
                    'Business Name': l.name,
                    'Industry': mc.industry || '',
                    'Pain Points': (mc.painPoints || []).join(' | '),
                    'Email Subject': mc.email?.subject || '',
                    'Email Body': mc.email?.body || '',
                    'WhatsApp': mc.whatsapp || '',
                    'LinkedIn Note': mc.linkedin?.connectionNote || '',
                    'Instagram DM': mc.instagram || '',
                    'Cold Call Opening': mc.coldCall?.opening || ''
                };
            });
            const ws3 = XLSX.utils.json_to_sheet(contentData);
            ws3['!cols'] = [
                { wch: 30 }, { wch: 20 }, { wch: 40 }, { wch: 40 },
                { wch: 60 }, { wch: 50 }, { wch: 40 }, { wch: 40 }, { wch: 50 }
            ];
            XLSX.utils.book_append_sheet(wb, ws3, 'Marketing Content');
        }

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(campaign.name)}_leads.xlsx"`);
        res.send(buf);
    } catch (error) {
        console.error('XLSX export error:', error);
        res.status(500).json({ error: 'Failed to export XLSX' });
    }
});

app.get('/api/leads/:campaignId/:leadIndex/vcard', async (req, res) => {
    try {
        const { leads } = await db.getLeads(req.params.campaignId, { limit: 10000 });
        const lead = leads[parseInt(req.params.leadIndex)];
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        const vcard = generateVCard(lead);
        res.setHeader('Content-Type', 'text/vcard');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(lead.name || 'contact')}.vcf"`);
        res.send(vcard);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate vCard' });
    }
});

// --- Health ---

app.get('/api/health', (req, res) => {
    const { isConfigured, getModel } = require('../openaiClient');
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        openai: { configured: isConfigured(), model: getModel() },
        activeCampaigns: activeCampaigns.size,
        sseConnections: sseConnections.size,
        auth: !!DASHBOARD_PASSWORD
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// --- Campaign execution ---

async function executeCampaignAsync(campaignId) {
    let campaign;
    try {
        campaign = await db.getCampaign(campaignId);
        if (!campaign) return;

        const scraper = new BusinessScraper();
        const marketingAI = new MarketingAI();
        const intelligence = new LeadIntelligence();

        const update = async (status, progress, message) => {
            await db.updateCampaignStatus(campaignId, { status, progress });
            activeCampaigns.set(campaignId, { id: campaignId, status, progress });
            broadcastSSE({ type: 'campaign_progress', campaignId, progress, message });
        };

        // Support batch queries: stored as JSON array or plain string
        let queries;
        try { queries = JSON.parse(campaign.search_query); } catch (_) { queries = null; }
        if (!Array.isArray(queries)) queries = [campaign.search_query];

        await update('scraping', 5, `Starting lead discovery (${queries.length} search${queries.length > 1 ? 'es' : ''})...`);

        // Run each query and combine results
        let rawLeads = [];
        const perQueryMax = Math.ceil(campaign.max_results / queries.length);
        for (let qi = 0; qi < queries.length; qi++) {
            const qProgress = 5 + Math.round(((qi + 0.5) / queries.length) * 30);
            await update('scraping', qProgress, `Searching: "${queries[qi]}" (${qi + 1}/${queries.length})...`);
            const batch = await scraper.scrapeGoogleMaps(queries[qi], perQueryMax);
            rawLeads = rawLeads.concat(batch);
            broadcastSSE({ type: 'campaign_progress', campaignId, progress: qProgress, message: `Found ${rawLeads.length} leads so far...` });
        }

        await update('analyzing', 40, `Found ${rawLeads.length} raw leads, analyzing...`);

        const scoredLeads = await intelligence.scoreLeads(rawLeads, campaign.industry);

        await update('generating', 70, 'Generating marketing content...');

        const highPriority = scoredLeads.filter(l => l.intelligence?.priority === 'HIGH');

        for (let i = 0; i < Math.min(highPriority.length, 10); i++) {
            try {
                const content = await marketingAI.generateIndustrySpecificContent(
                    highPriority[i],
                    campaign.industry,
                    campaign.your_service,
                    campaign.content_style,
                    campaign.language
                );
                if (content) highPriority[i].intelligence.marketingContent = content;
            } catch (err) {
                console.log('Content generation failed for lead', i + 1, err.message);
            }
        }

        await update('saving', 90, 'Saving results...');

        // Deduplicate and save leads
        let saved = 0;
        let duplicates = 0;
        for (const lead of scoredLeads) {
            const dup = await db.findDuplicateLeads(lead.phone, lead.name);
            if (dup) {
                duplicates++;
                continue;
            }
            await db.saveLead(campaignId, lead);
            saved++;
        }

        const stats = {
            status: 'completed',
            progress: 100,
            completedAt: new Date().toISOString(),
            totalLeads: saved,
            priorityLeads: scoredLeads.filter(l => l.intelligence?.priority === 'HIGH').length,
            highQualityLeads: scoredLeads.filter(l => (l.intelligence?.score || 0) >= 65).length,
            averageScore: scoredLeads.length > 0
                ? Math.round(scoredLeads.reduce((s, l) => s + (l.intelligence?.score || 0), 0) / scoredLeads.length)
                : 0
        };

        await db.updateCampaignStatus(campaignId, stats);
        activeCampaigns.set(campaignId, { id: campaignId, ...stats });

        broadcastSSE({
            type: 'campaign_completed',
            campaignId,
            progress: 100,
            message: `Campaign completed! ${saved} new leads saved${duplicates > 0 ? `, ${duplicates} duplicates skipped` : ''}`,
            results: stats
        });

        await scraper.close();
        setTimeout(() => activeCampaigns.delete(campaignId), 5 * 60 * 1000);

    } catch (error) {
        console.error('Campaign execution failed:', error);
        await db.updateCampaignStatus(campaignId, { status: 'failed', error: error.message });
        activeCampaigns.set(campaignId, { id: campaignId, status: 'failed', error: error.message });
        broadcastSSE({ type: 'campaign_failed', campaignId, message: `Campaign failed: ${error.message}` });
    }
}

// --- Helpers ---

function loadUserPreferences() {
    try {
        if (fs.existsSync('user-preferences.json')) {
            return JSON.parse(fs.readFileSync('user-preferences.json', 'utf8'));
        }
    } catch (_) {}
    return null;
}

function normalizeCampaign(c) {
    return {
        id: c.id,
        name: c.name,
        type: c.type || 'lead_generation',
        industry: c.industry,
        location: c.location,
        searchQuery: c.search_query,
        yourService: c.your_service,
        contentStyle: c.content_style,
        language: c.language,
        status: c.status,
        progress: c.progress,
        startedAt: c.started_at,
        completedAt: c.completed_at,
        createdAt: c.created_at,
        error: c.error,
        results: {
            totalLeads: c.total_leads || 0,
            priorityLeads: c.priority_leads || 0,
            highQualityLeads: c.high_quality_leads || 0,
            averageScore: c.average_score || 0
        }
    };
}

// Sanitize CSV cell: prefix formula-injection chars (=, +, -, @, tab, CR) with a single quote.
function csvCell(value) {
    const s = String(value ?? '');
    const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    return '"' + safe.replace(/"/g, '""') + '"';
}

function generateCSV(leads) {
    const headers = ['ID', 'Name', 'Address', 'Phone', 'Website', 'Rating', 'Score', 'Priority', 'CRM Status', 'Has Website', 'Source'];
    const rows = leads.map((l, i) => [
        i + 1,
        csvCell(l.name),
        csvCell(l.address),
        csvCell(l.phone),
        csvCell(l.website),
        csvCell(l.rating),
        l.score || 0,
        csvCell(l.priority || 'LOW'),
        csvCell(l.crm_status || 'new'),
        l.has_website ? 'Yes' : 'No',
        csvCell(l.source || 'Google Maps')
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function generateVCard(lead) {
    const cleanPhone = (lead.phone || '').replace(/[^\d+]/g, '');
    return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${lead.name || 'Unknown'}`,
        `ORG:${lead.name || 'Unknown'}`,
        cleanPhone ? `TEL:${cleanPhone}` : '',
        lead.address ? `ADR:;;${lead.address};;;;` : '',
        lead.website ? `URL:${lead.website}` : '',
        lead.rating ? `NOTE:Rating: ${lead.rating} | Score: ${lead.score || 0}/100` : '',
        'END:VCARD'
    ].filter(Boolean).join('\r\n');
}

function sanitizeFilename(name) {
    return (name || 'export').replace(/[^a-zA-Z0-9_\-]/g, '_');
}


// --- Start ---

async function start() {
    await db.initialize();
    console.log('✅ Database initialized');

    const server = app.listen(PORT, () => {
        console.log(`🚀 Business Leads AI Dashboard: http://localhost:${PORT}`);
        console.log(`🔌 API: http://localhost:${PORT}/api`);
        if (DASHBOARD_PASSWORD) {
            console.log('🔒 Auth enabled — set DASHBOARD_PASSWORD in .env to change');
        } else {
            console.log('⚠️  No auth — set DASHBOARD_PASSWORD in .env to secure dashboard');
        }
    });

    function gracefulShutdown(signal) {
        console.log(`\n${signal} received. Shutting down...`);
        sseConnections.forEach(res => { try { res.end(); } catch (_) {} });
        sseConnections.clear();
        server.close(async () => {
            await db.close();
            console.log('✅ Server and database closed');
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10000);
    }

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    return server;
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

module.exports = app;
