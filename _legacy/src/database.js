const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'leads.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

class Database {
    constructor() {
        this.db = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) return reject(err);
                this.db.run('PRAGMA journal_mode = WAL');
                this.db.run('PRAGMA foreign_keys = ON');
                resolve();
            });
        });
    }

    async initialize() {
        if (!this.db) await this.connect();
        await this.runSchema();
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) return reject(err);
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve();
            this.db.close((err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    async runSchema() {
        await this.run(`
            CREATE TABLE IF NOT EXISTS campaigns (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                industry TEXT,
                location TEXT,
                search_query TEXT,
                max_results INTEGER DEFAULT 20,
                your_service TEXT,
                content_style TEXT DEFAULT 'balanced',
                language TEXT DEFAULT 'indonesian',
                status TEXT DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                started_at TEXT,
                completed_at TEXT,
                error TEXT,
                total_leads INTEGER DEFAULT 0,
                priority_leads INTEGER DEFAULT 0,
                high_quality_leads INTEGER DEFAULT 0,
                average_score INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            )
        `);

        await this.run(`
            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id TEXT NOT NULL,
                name TEXT NOT NULL,
                address TEXT,
                phone TEXT,
                website TEXT,
                reference_link TEXT,
                rating TEXT,
                source TEXT DEFAULT 'Google Maps',
                has_website INTEGER DEFAULT 0,
                score INTEGER DEFAULT 0,
                priority TEXT DEFAULT 'LOW',
                category TEXT,
                recommendation TEXT,
                marketing_content TEXT,
                crm_status TEXT DEFAULT 'new',
                crm_notes TEXT,
                follow_up_date TEXT,
                contacted_at TEXT,
                replied_at TEXT,
                closed_at TEXT,
                close_result TEXT,
                scraped_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
            )
        `);

        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id)
        `);

        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_leads_crm_status ON leads(crm_status)
        `);

        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority)
        `);

        await this.run(`
            CREATE TABLE IF NOT EXISTS lead_activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lead_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                note TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
            )
        `);

        await this.run(`
            CREATE TABLE IF NOT EXISTS templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lead_id INTEGER NOT NULL,
                platform TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
            )
        `);

        await this.run(`
            CREATE TABLE IF NOT EXISTS follow_ups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lead_id INTEGER NOT NULL,
                campaign_id TEXT NOT NULL,
                scheduled_at TEXT NOT NULL,
                note TEXT,
                done INTEGER DEFAULT 0,
                done_at TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
            )
        `);
    }

    // --- Campaign methods ---

    async saveCampaign(campaignData) {
        const {
            id, name, industry, location, searchQuery, maxResults,
            yourService, contentStyle, language, status, progress,
            startedAt, completedAt, error, totalLeads, priorityLeads,
            highQualityLeads, averageScore
        } = campaignData;

        await this.run(`
            INSERT OR REPLACE INTO campaigns
            (id, name, industry, location, search_query, max_results, your_service,
             content_style, language, status, progress, started_at, completed_at,
             error, total_leads, priority_leads, high_quality_leads, average_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, name, industry, location, searchQuery, maxResults || 20,
            yourService, contentStyle || 'balanced', language || 'indonesian',
            status || 'pending', progress || 0, startedAt, completedAt,
            error, totalLeads || 0, priorityLeads || 0, highQualityLeads || 0, averageScore || 0
        ]);
    }

    async updateCampaignStatus(id, updates) {
        const fields = [];
        const values = [];

        const mapping = {
            status: 'status',
            progress: 'progress',
            completedAt: 'completed_at',
            error: 'error',
            totalLeads: 'total_leads',
            priorityLeads: 'priority_leads',
            highQualityLeads: 'high_quality_leads',
            averageScore: 'average_score'
        };

        for (const [key, col] of Object.entries(mapping)) {
            if (updates[key] !== undefined) {
                fields.push(`${col} = ?`);
                values.push(updates[key]);
            }
        }

        if (fields.length === 0) return;
        values.push(id);

        await this.run(
            `UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
    }

    async getCampaigns(limit = 50) {
        return this.all(
            `SELECT * FROM campaigns ORDER BY created_at DESC LIMIT ?`,
            [limit]
        );
    }

    async getCampaign(id) {
        return this.get(`SELECT * FROM campaigns WHERE id = ?`, [id]);
    }

    async deleteCampaign(id) {
        await this.run(`DELETE FROM campaigns WHERE id = ?`, [id]);
    }

    // --- Lead methods ---

    async saveLeads(campaignId, leads) {
        for (const lead of leads) {
            await this.saveLead(campaignId, lead);
        }
    }

    async saveLead(campaignId, lead) {
        const intel = lead.intelligence || {};
        const result = await this.run(`
            INSERT INTO leads
            (campaign_id, name, address, phone, website, reference_link, rating,
             source, has_website, score, priority, category, recommendation, marketing_content, scraped_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            campaignId,
            lead.name || '',
            lead.address || '',
            lead.phone || '',
            lead.website || '',
            lead.referenceLink || '',
            lead.rating || '',
            lead.source || 'Google Maps',
            lead.hasWebsite ? 1 : 0,
            intel.score || 0,
            intel.priority || 'LOW',
            intel.category || '',
            intel.recommendation || '',
            intel.marketingContent ? JSON.stringify(intel.marketingContent) : null,
            lead.scrapedAt || new Date().toISOString()
        ]);

        const leadId = result.lastID;

        // Save templates if any
        if (intel.marketingContent) {
            const content = intel.marketingContent;
            const platforms = ['email', 'whatsapp', 'linkedin', 'instagram', 'coldcall'];
            for (const platform of platforms) {
                const key = `${platform}Template` in content ? `${platform}Template` : platform;
                if (content[key]) {
                    await this.run(
                        `INSERT INTO templates (lead_id, platform, content) VALUES (?, ?, ?)`,
                        [leadId, platform, typeof content[key] === 'string' ? content[key] : JSON.stringify(content[key])]
                    );
                }
            }
        }

        return leadId;
    }

    async getLeads(campaignId, { page = 1, limit = 20, priority, minScore, crmStatus, search } = {}) {
        let where = ['campaign_id = ?'];
        let params = [campaignId];

        if (priority) {
            where.push('priority = ?');
            params.push(priority.toUpperCase());
        }
        if (minScore !== undefined) {
            where.push('score >= ?');
            params.push(parseInt(minScore));
        }
        if (crmStatus) {
            where.push('crm_status = ?');
            params.push(crmStatus);
        }
        if (search) {
            where.push('(name LIKE ? OR address LIKE ? OR phone LIKE ?)');
            const term = `%${search}%`;
            params.push(term, term, term);
        }

        const whereClause = where.join(' AND ');
        const total = await this.get(
            `SELECT COUNT(*) as count FROM leads WHERE ${whereClause}`,
            params
        );

        const offset = (page - 1) * limit;
        const leads = await this.all(
            `SELECT * FROM leads WHERE ${whereClause} ORDER BY score DESC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        // Parse marketing_content JSON
        const parsedLeads = leads.map(lead => {
            if (lead.marketing_content) {
                try { lead.marketing_content = JSON.parse(lead.marketing_content); } catch (_) {}
            }
            return lead;
        });

        return {
            leads: parsedLeads,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                totalPages: Math.ceil(total.count / limit)
            }
        };
    }

    async getLead(leadId) {
        const lead = await this.get(`SELECT * FROM leads WHERE id = ?`, [leadId]);
        if (!lead) return null;
        if (lead.marketing_content) {
            try { lead.marketing_content = JSON.parse(lead.marketing_content); } catch (_) {}
        }
        lead.templates = await this.all(
            `SELECT * FROM templates WHERE lead_id = ? ORDER BY platform`,
            [leadId]
        );
        lead.activities = await this.all(
            `SELECT * FROM lead_activities WHERE lead_id = ? ORDER BY created_at DESC`,
            [leadId]
        );
        lead.follow_ups = await this.all(
            `SELECT * FROM follow_ups WHERE lead_id = ? ORDER BY scheduled_at`,
            [leadId]
        );
        return lead;
    }

    async updateLeadCRM(leadId, updates) {
        const fields = [];
        const values = [];

        const mapping = {
            crm_status: 'crm_status',
            crm_notes: 'crm_notes',
            follow_up_date: 'follow_up_date',
            contacted_at: 'contacted_at',
            replied_at: 'replied_at',
            closed_at: 'closed_at',
            close_result: 'close_result'
        };

        for (const [key, col] of Object.entries(mapping)) {
            if (updates[key] !== undefined) {
                fields.push(`${col} = ?`);
                values.push(updates[key]);
            }
        }

        if (fields.length === 0) return;
        values.push(leadId);

        await this.run(
            `UPDATE leads SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        // Log activity
        if (updates.crm_status) {
            await this.run(
                `INSERT INTO lead_activities (lead_id, type, note) VALUES (?, ?, ?)`,
                [leadId, 'status_change', `Status changed to: ${updates.crm_status}${updates.crm_notes ? ' — ' + updates.crm_notes : ''}`]
            );
        }
    }

    async addLeadActivity(leadId, type, note) {
        return this.run(
            `INSERT INTO lead_activities (lead_id, type, note) VALUES (?, ?, ?)`,
            [leadId, type, note]
        );
    }

    async scheduleFollowUp(leadId, campaignId, scheduledAt, note) {
        return this.run(
            `INSERT INTO follow_ups (lead_id, campaign_id, scheduled_at, note) VALUES (?, ?, ?, ?)`,
            [leadId, campaignId, scheduledAt, note]
        );
    }

    async getPendingFollowUps() {
        return this.all(`
            SELECT f.*, l.name as lead_name, l.phone as lead_phone,
                   l.crm_status, c.name as campaign_name
            FROM follow_ups f
            JOIN leads l ON f.lead_id = l.id
            JOIN campaigns c ON f.campaign_id = c.id
            WHERE f.done = 0 AND f.scheduled_at <= datetime('now', '+1 day')
            ORDER BY f.scheduled_at ASC
        `);
    }

    async markFollowUpDone(followUpId) {
        return this.run(
            `UPDATE follow_ups SET done = 1, done_at = datetime('now') WHERE id = ?`,
            [followUpId]
        );
    }

    // --- Analytics ---

    async getAnalytics() {
        const [overview, byIndustry, byPriority, byCrmStatus, trendData] = await Promise.all([
            this.get(`
                SELECT
                    COUNT(DISTINCT c.id) as total_campaigns,
                    COUNT(l.id) as total_leads,
                    SUM(CASE WHEN l.priority = 'HIGH' THEN 1 ELSE 0 END) as high_priority_leads,
                    ROUND(AVG(l.score), 1) as avg_score,
                    SUM(CASE WHEN l.crm_status = 'won' THEN 1 ELSE 0 END) as won_leads,
                    SUM(CASE WHEN l.crm_status = 'contacted' THEN 1 ELSE 0 END) as contacted_leads
                FROM campaigns c
                LEFT JOIN leads l ON c.id = l.campaign_id
            `),
            this.all(`
                SELECT c.industry, COUNT(l.id) as total_leads,
                       ROUND(AVG(l.score), 1) as avg_score,
                       SUM(CASE WHEN l.priority = 'HIGH' THEN 1 ELSE 0 END) as high_priority
                FROM campaigns c
                LEFT JOIN leads l ON c.id = l.campaign_id
                WHERE c.industry IS NOT NULL
                GROUP BY c.industry
                ORDER BY total_leads DESC
            `),
            this.all(`
                SELECT priority, COUNT(*) as count
                FROM leads
                GROUP BY priority
            `),
            this.all(`
                SELECT crm_status, COUNT(*) as count
                FROM leads
                GROUP BY crm_status
            `),
            this.all(`
                SELECT DATE(created_at) as date,
                       COUNT(DISTINCT campaign_id) as campaigns,
                       COUNT(*) as leads
                FROM leads
                WHERE created_at >= datetime('now', '-30 days')
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `)
        ]);

        return { overview, byIndustry, byPriority, byCrmStatus, trendData };
    }

    // --- Deduplication ---

    async findDuplicateLeads(phone, name) {
        const phoneClean = phone ? phone.replace(/\D/g, '') : '';
        if (phoneClean.length > 6) {
            const byPhone = await this.get(
                `SELECT id, campaign_id, name FROM leads WHERE replace(replace(replace(phone, ' ', ''), '-', ''), '+', '') LIKE ?`,
                [`%${phoneClean.slice(-8)}%`]
            );
            if (byPhone) return byPhone;
        }

        if (name) {
            const nameLower = name.toLowerCase().trim();
            const byName = await this.get(
                `SELECT id, campaign_id, name FROM leads WHERE lower(trim(name)) = ?`,
                [nameLower]
            );
            if (byName) return byName;
        }

        return null;
    }
}

// Singleton instance
const db = new Database();

module.exports = db;
