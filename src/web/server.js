const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import existing components
const BusinessScraper = require('../scraper');
const MarketingAutomation = require('../marketing');
const MarketingAI = require('../marketingAI');
const LeadIntelligence = require('../leadIntelligence');
const CampaignBuilder = require('../campaign');

const app = express();
const PORT = process.env.WEB_PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Store for active campaigns and SSE connections
const activeCampaigns = new Map();
const sseConnections = new Set();

// Utility function to load user preferences
function loadUserPreferences() {
    try {
        if (fs.existsSync('user-preferences.json')) {
            return JSON.parse(fs.readFileSync('user-preferences.json', 'utf8'));
        }
    } catch (error) {
        console.log('Could not load user preferences:', error.message);
    }
    return null;
}

// Utility function to get campaign data from output directory
function getCampaignData() {
    const outputDir = path.join(__dirname, '../../output');
    if (!fs.existsSync(outputDir)) {
        return [];
    }

    const campaigns = [];
    const campaignDirs = fs.readdirSync(outputDir).filter(dir => 
        fs.statSync(path.join(outputDir, dir)).isDirectory() && dir.startsWith('campaign_')
    );

    for (const dir of campaignDirs) {
        const campaignPath = path.join(outputDir, dir);
        const infoPath = path.join(campaignPath, 'campaign_info.json');
        
        if (fs.existsSync(infoPath)) {
            try {
                const campaignInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                campaignInfo.id = dir;
                campaignInfo.path = campaignPath;
                campaigns.push(campaignInfo);
            } catch (error) {
                console.log(`Error reading campaign info for ${dir}:`, error.message);
            }
        }
    }

    // Sort by execution date (newest first)
    campaigns.sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt));
    return campaigns;
}

// Utility function to get leads data from a campaign
function getLeadsData(campaignId) {
    const campaignPath = path.join(__dirname, '../../output', campaignId);
    const leadsPath = path.join(campaignPath, 'leads_with_intelligence.json');
    
    if (fs.existsSync(leadsPath)) {
        try {
            return JSON.parse(fs.readFileSync(leadsPath, 'utf8'));
        } catch (error) {
            console.log(`Error reading leads data for ${campaignId}:`, error.message);
        }
    }
    return [];
}

// SSE endpoint for real-time updates
app.get('/api/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    // Add connection to active connections
    sseConnections.add(res);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to real-time updates' })}\n\n`);

    // Handle client disconnect
    req.on('close', () => {
        sseConnections.delete(res);
    });
});

// Function to broadcast SSE message to all connected clients
function broadcastSSE(data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    sseConnections.forEach(res => {
        try {
            res.write(message);
        } catch (error) {
            sseConnections.delete(res);
        }
    });
}

// API Routes

// Dashboard overview
app.get('/api/dashboard', (req, res) => {
    try {
        const campaigns = getCampaignData();
        const userPrefs = loadUserPreferences();
        
        // Calculate overview statistics
        const totalCampaigns = campaigns.length;
        const totalLeads = campaigns.reduce((sum, campaign) => 
            sum + (campaign.results?.totalLeads || 0), 0);
        const totalPriorityLeads = campaigns.reduce((sum, campaign) => 
            sum + (campaign.results?.priorityLeads || 0), 0);
        const averageScore = campaigns.length > 0 ? 
            Math.round(campaigns.reduce((sum, campaign) => 
                sum + (campaign.results?.averageScore || 0), 0) / campaigns.length) : 0;

        // Recent activity (last 5 campaigns)
        const recentActivity = campaigns.slice(0, 5).map(campaign => ({
            id: campaign.id,
            name: campaign.name,
            type: campaign.type,
            industry: campaign.industry,
            executedAt: campaign.executedAt,
            totalLeads: campaign.results?.totalLeads || 0,
            priorityLeads: campaign.results?.priorityLeads || 0
        }));

        res.json({
            overview: {
                totalCampaigns,
                totalLeads,
                totalPriorityLeads,
                averageScore,
                primaryIndustry: userPrefs?.industry || 'professional'
            },
            recentActivity,
            userPreferences: userPrefs
        });
    } catch (error) {
        console.error('Error getting dashboard data:', error);
        res.status(500).json({ error: 'Failed to load dashboard data' });
    }
});

// Get all campaigns
app.get('/api/campaigns', (req, res) => {
    try {
        const campaigns = getCampaignData();
        res.json(campaigns);
    } catch (error) {
        console.error('Error getting campaigns:', error);
        res.status(500).json({ error: 'Failed to load campaigns' });
    }
});

// Get specific campaign details
app.get('/api/campaigns/:id', (req, res) => {
    try {
        const campaigns = getCampaignData();
        const campaign = campaigns.find(c => c.id === req.params.id);
        
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // Get leads data for this campaign
        const leads = getLeadsData(req.params.id);
        campaign.leads = leads;

        res.json(campaign);
    } catch (error) {
        console.error('Error getting campaign details:', error);
        res.status(500).json({ error: 'Failed to load campaign details' });
    }
});

// Get leads for a specific campaign
app.get('/api/campaigns/:id/leads', (req, res) => {
    try {
        const leads = getLeadsData(req.params.id);
        const { page = 1, limit = 20, priority, minScore } = req.query;
        
        let filteredLeads = leads;
        
        // Apply filters
        if (priority) {
            filteredLeads = filteredLeads.filter(lead => 
                lead.intelligence?.priority === priority.toUpperCase()
            );
        }
        
        if (minScore) {
            filteredLeads = filteredLeads.filter(lead => 
                (lead.intelligence?.score || 0) >= parseInt(minScore)
            );
        }

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

        res.json({
            leads: paginatedLeads,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: filteredLeads.length,
                totalPages: Math.ceil(filteredLeads.length / limit)
            }
        });
    } catch (error) {
        console.error('Error getting leads:', error);
        res.status(500).json({ error: 'Failed to load leads' });
    }
});

// Analytics endpoint
app.get('/api/analytics', (req, res) => {
    try {
        const campaigns = getCampaignData();
        
        // Industry distribution
        const industryStats = {};
        campaigns.forEach(campaign => {
            const industry = campaign.industry || 'unknown';
            if (!industryStats[industry]) {
                industryStats[industry] = { campaigns: 0, totalLeads: 0, avgScore: 0 };
            }
            industryStats[industry].campaigns++;
            industryStats[industry].totalLeads += campaign.results?.totalLeads || 0;
            industryStats[industry].avgScore += campaign.results?.averageScore || 0;
        });

        // Calculate averages
        Object.keys(industryStats).forEach(industry => {
            industryStats[industry].avgScore = Math.round(
                industryStats[industry].avgScore / industryStats[industry].campaigns
            );
        });

        // Lead quality distribution
        const qualityDistribution = { HIGH: 0, MEDIUM: 0, LOW: 0 };
        campaigns.forEach(campaign => {
            const leads = getLeadsData(campaign.id);
            leads.forEach(lead => {
                const priority = lead.intelligence?.priority || 'LOW';
                qualityDistribution[priority]++;
            });
        });

        // Campaign performance over time (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentCampaigns = campaigns.filter(campaign => 
            new Date(campaign.executedAt) >= thirtyDaysAgo
        );

        res.json({
            industryStats,
            qualityDistribution,
            campaignTrends: {
                totalCampaigns: campaigns.length,
                recentCampaigns: recentCampaigns.length,
                totalLeads: campaigns.reduce((sum, c) => sum + (c.results?.totalLeads || 0), 0),
                avgQualityScore: campaigns.length > 0 ? 
                    Math.round(campaigns.reduce((sum, c) => sum + (c.results?.averageScore || 0), 0) / campaigns.length) : 0
            }
        });
    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({ error: 'Failed to load analytics' });
    }
});

// vCard generation utility function
function generateVCard(lead) {
    const name = lead.name || 'Unknown Business';
    const phone = lead.phone || '';
    const address = lead.address || '';
    const website = lead.website || '';
    const rating = lead.rating || '';
    
    // Clean phone number for vCard format
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    
    const vcard = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${name}`,
        `ORG:${name}`,
        cleanPhone ? `TEL:${cleanPhone}` : '',
        address ? `ADR:;;${address};;;;` : '',
        website ? `URL:${website}` : '',
        rating ? `NOTE:Google Rating: ${rating} stars` : '',
        lead.intelligence ? `NOTE:Lead Score: ${lead.intelligence.score}/100 - Priority: ${lead.intelligence.priority}` : '',
        'END:VCARD'
    ].filter(line => line !== '').join('\r\n');
    
    return vcard;
}

// Export single lead as vCard
app.get('/api/leads/:campaignId/:leadIndex/vcard', (req, res) => {
    try {
        const { campaignId, leadIndex } = req.params;
        const leads = getLeadsData(campaignId);
        const lead = leads[parseInt(leadIndex)];
        
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        
        const vcard = generateVCard(lead);
        const filename = `${(lead.name || 'contact').replace(/[^a-zA-Z0-9]/g, '_')}.vcf`;
        
        res.setHeader('Content-Type', 'text/vcard');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(vcard);
        
    } catch (error) {
        console.error('Error generating vCard:', error);
        res.status(500).json({ error: 'Failed to generate vCard' });
    }
});

// Export all leads from campaign as vCard bundle
app.get('/api/campaigns/:id/export/vcard', (req, res) => {
    try {
        const leads = getLeadsData(req.params.id);
        const campaigns = getCampaignData();
        const campaign = campaigns.find(c => c.id === req.params.id);
        
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        // Generate combined vCard file
        const vcards = leads.map(lead => generateVCard(lead)).join('\r\n\r\n');
        const filename = `${campaign.name.replace(/[^a-zA-Z0-9]/g, '_')}_contacts.vcf`;
        
        res.setHeader('Content-Type', 'text/vcard');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(vcards);
        
    } catch (error) {
        console.error('Error generating vCard bundle:', error);
        res.status(500).json({ error: 'Failed to generate vCard bundle' });
    }
});

// Create new campaign endpoint
app.post('/api/campaigns', async (req, res) => {
    try {
        const { name, industry, location, searchQuery, maxResults, yourService, contentStyle, language } = req.body;
        
        // Validate required fields
        if (!name || !industry || !location || !searchQuery || !yourService) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const campaignId = `campaign_${name.replace(/\s+/g, '_')}_${Date.now()}`;
        
        // Store campaign in active campaigns
        activeCampaigns.set(campaignId, {
            id: campaignId,
            name,
            industry,
            location,
            searchQuery,
            maxResults: parseInt(maxResults) || 20,
            yourService,
            contentStyle: contentStyle || 'balanced',
            language: language || 'indonesian',
            status: 'starting',
            progress: 0,
            startedAt: new Date().toISOString()
        });

        // Broadcast campaign start
        broadcastSSE({
            type: 'campaign_started',
            campaignId,
            message: `Campaign "${name}" started`
        });

        // Start campaign execution in background
        executeCampaignAsync(campaignId);

        res.json({ 
            success: true, 
            campaignId,
            message: 'Campaign started successfully'
        });

    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

// Get active campaign status
app.get('/api/campaigns/:id/status', (req, res) => {
    const campaign = activeCampaigns.get(req.params.id);
    if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(campaign);
});

// Async campaign execution function
async function executeCampaignAsync(campaignId) {
    const campaign = activeCampaigns.get(campaignId);
    if (!campaign) return;

    try {
        const scraper = new BusinessScraper();
        const marketingAI = new MarketingAI();
        const intelligence = new LeadIntelligence();

        // Update progress: Starting
        campaign.status = 'scraping';
        campaign.progress = 10;
        broadcastSSE({
            type: 'campaign_progress',
            campaignId,
            progress: 10,
            message: 'Starting lead discovery...'
        });

        // Phase 1: Lead Discovery
        const rawLeads = await scraper.scrapeGoogleMaps(campaign.searchQuery, campaign.maxResults);
        
        campaign.progress = 40;
        broadcastSSE({
            type: 'campaign_progress',
            campaignId,
            progress: 40,
            message: `Found ${rawLeads.length} raw leads`
        });

        // Phase 2: Lead Intelligence
        campaign.status = 'analyzing';
        const scoredLeads = await intelligence.scoreLeads(rawLeads, campaign.industry);
        
        campaign.progress = 70;
        broadcastSSE({
            type: 'campaign_progress',
            campaignId,
            progress: 70,
            message: 'Analyzing lead intelligence...'
        });

        // Phase 3: Content Generation (for high-priority leads only)
        campaign.status = 'generating';
        const highPriorityLeads = scoredLeads.filter(lead => lead.intelligence.priority === 'HIGH');
        
        for (let i = 0; i < Math.min(highPriorityLeads.length, 5); i++) {
            try {
                const content = await marketingAI.generateIndustrySpecificContent(
                    highPriorityLeads[i],
                    campaign.industry,
                    campaign.yourService,
                    campaign.contentStyle,
                    campaign.language
                );
                
                // Store the generated content in the lead
                if (content) {
                    highPriorityLeads[i].intelligence.marketingContent = content;
                }
            } catch (error) {
                console.log(`Failed to generate content for lead ${i + 1}:`, error.message);
            }
        }

        campaign.progress = 90;
        broadcastSSE({
            type: 'campaign_progress',
            campaignId,
            progress: 90,
            message: 'Generating marketing content...'
        });

        // Phase 4: Save Results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputDir = path.join(__dirname, '../../output', campaignId);
        const rootOutputDir = path.join(__dirname, '../../output');
        
        if (!fs.existsSync(rootOutputDir)) {
            fs.mkdirSync(rootOutputDir);
        }
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save campaign results
        const campaignInfo = {
            ...campaign,
            executedAt: new Date().toISOString(),
            results: {
                totalLeads: scoredLeads.length,
                highQualityLeads: scoredLeads.filter(lead => lead.intelligence.score >= 65).length,
                priorityLeads: scoredLeads.filter(lead => lead.intelligence.priority === 'HIGH').length,
                averageScore: Math.round(scoredLeads.reduce((sum, lead) => sum + lead.intelligence.score, 0) / scoredLeads.length),
                contentGenerated: Math.min(highPriorityLeads.length, 5),
                enhancedAI: true
            },
            outputPath: outputDir
        };

        fs.writeFileSync(`${outputDir}/campaign_info.json`, JSON.stringify(campaignInfo, null, 2));
        fs.writeFileSync(`${outputDir}/leads_with_intelligence.json`, JSON.stringify(scoredLeads, null, 2));

        // Complete campaign
        campaign.status = 'completed';
        campaign.progress = 100;
        campaign.completedAt = new Date().toISOString();
        campaign.results = campaignInfo.results;

        broadcastSSE({
            type: 'campaign_completed',
            campaignId,
            progress: 100,
            message: `Campaign completed! Generated ${scoredLeads.length} leads`,
            results: campaignInfo.results
        });

        // Clean up
        await scraper.close();
        
        // Remove from active campaigns after 5 minutes
        setTimeout(() => {
            activeCampaigns.delete(campaignId);
        }, 5 * 60 * 1000);

    } catch (error) {
        console.error(`Campaign ${campaignId} failed:`, error);
        
        campaign.status = 'failed';
        campaign.error = error.message;
        
        broadcastSSE({
            type: 'campaign_failed',
            campaignId,
            message: `Campaign failed: ${error.message}`
        });
    }
}

// Serve main dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Business Leads AI Web Dashboard running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔌 API: http://localhost:${PORT}/api`);
});

module.exports = app;