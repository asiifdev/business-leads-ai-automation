/**
 * Unit Tests for Business Leads AI Automation
 * 
 * Run with: npm test
 * 
 * Tests cover:
 * - OpenAI Client configuration
 * - FileUtils utilities
 * - LeadIntelligence scoring
 * - Scraper data processing
 * - CLI argument parsing
 * - Marketing template personalization
 * - MarketingAI content generation
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// ─── Test Runner (supports async tests) ─────────────────────
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];
const testQueue = [];

function describe(suiteName, fn) {
    testQueue.push({ type: 'suite', name: suiteName, fn });
}

function it(testName, fn) {
    testQueue.push({ type: 'test', name: testName, fn });
}

async function runTests() {
    console.log('\n🧪 Business Leads AI Automation - Unit Tests\n');

    for (const item of testQueue) {
        if (item.type === 'suite') {
            console.log(`\n${'═'.repeat(60)}`);
            console.log(`📦 ${item.name}`);
            console.log(`${'─'.repeat(60)}`);
            item.fn();
        } else if (item.type === 'test') {
            totalTests++;
            try {
                const result = item.fn();
                if (result && typeof result.then === 'function') {
                    await result;
                }
                passedTests++;
                console.log(`  ✅ ${item.name}`);
            } catch (error) {
                failedTests++;
                failures.push({ test: item.name, error: error.message });
                console.log(`  ❌ ${item.name}`);
                console.log(`     → ${error.message}`);
            }
        }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('📊 Test Results');
    console.log(`${'─'.repeat(60)}`);
    console.log(`  Total:  ${totalTests}`);
    console.log(`  Passed: ${passedTests} ✅`);
    console.log(`  Failed: ${failedTests} ❌`);
    console.log(`${'═'.repeat(60)}`);
    
    if (failures.length > 0) {
        console.log('\n❌ Failed Tests:');
        failures.forEach(f => {
            console.log(`  • ${f.test}: ${f.error}`);
        });
    }
    
    console.log('');
    process.exit(failedTests > 0 ? 1 : 0);
}

// ─── Test Suites ────────────────────────────────────────────

describe('OpenAI Client Module', () => {
    const { getClient, getModel, isConfigured, resetClient, DEFAULT_MODEL } = require('./src/openaiClient');

    it('should export all required functions', () => {
        assert.strictEqual(typeof getClient, 'function');
        assert.strictEqual(typeof getModel, 'function');
        assert.strictEqual(typeof isConfigured, 'function');
        assert.strictEqual(typeof resetClient, 'function');
    });

    it('should have correct DEFAULT_MODEL', () => {
        assert.strictEqual(DEFAULT_MODEL, 'gpt-4o-mini');
    });

    it('should return model from env or default', () => {
        const originalModel = process.env.OPENAI_MODEL;
        
        process.env.OPENAI_MODEL = 'gpt-4o';
        assert.strictEqual(getModel(), 'gpt-4o');
        
        delete process.env.OPENAI_MODEL;
        assert.strictEqual(getModel(), 'gpt-4o-mini');
        
        if (originalModel) process.env.OPENAI_MODEL = originalModel;
        else delete process.env.OPENAI_MODEL;
    });

    it('should report configured status based on OPENAI_API_KEY', () => {
        const originalKey = process.env.OPENAI_API_KEY;
        
        process.env.OPENAI_API_KEY = 'test-key-12345';
        assert.strictEqual(isConfigured(), true);
        
        delete process.env.OPENAI_API_KEY;
        assert.strictEqual(isConfigured(), false);
        
        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
        else delete process.env.OPENAI_API_KEY;
    });

    it('should reset client instance', () => {
        resetClient();
        const client = getClient();
        // Client may be null if no valid key — that's expected
    });
});

describe('Business Profile Module', () => {
    const {
        load, getProfile, getDefaults, save, validate,
        isConfigured, resetCache, getBusinessInfoForPrompt, PROFILE_FILE
    } = require('./src/businessProfile');
    const testProfilePath = path.join(__dirname, 'test_output', 'test-business-profile.json');

    it('should export all required functions', () => {
        assert.strictEqual(typeof load, 'function');
        assert.strictEqual(typeof getProfile, 'function');
        assert.strictEqual(typeof getDefaults, 'function');
        assert.strictEqual(typeof save, 'function');
        assert.strictEqual(typeof validate, 'function');
        assert.strictEqual(typeof isConfigured, 'function');
        assert.strictEqual(typeof resetCache, 'function');
        assert.strictEqual(typeof getBusinessInfoForPrompt, 'function');
    });

    it('should return valid default profile', () => {
        const defaults = getDefaults();
        assert.ok(defaults.business);
        assert.ok(defaults.owner);
        assert.ok(defaults.preferences);
        assert.strictEqual(defaults.business.name, '');
        assert.strictEqual(defaults.preferences.language, 'indonesian');
        assert.strictEqual(defaults.preferences.campaignStyle, 'balanced');
        assert.ok(Array.isArray(defaults.business.valuePropositions));
        assert.ok(Array.isArray(defaults.business.targetIndustries));
    });

    it('should validate profile and return warnings for empty fields', () => {
        const emptyProfile = getDefaults();
        const warnings = validate(emptyProfile);
        assert.ok(warnings.length > 0, 'Should have warnings for empty profile');
        assert.ok(warnings.some(w => w.includes('Business name')));
    });

    it('should validate profile with no warnings for complete data', () => {
        const profile = getDefaults();
        profile.business.name = 'Test Business';
        profile.business.type = 'technology';
        profile.business.description = 'Test products';
        profile.owner.name = 'John Doe';
        profile.business.phone = '+628123456';
        const warnings = validate(profile);
        assert.strictEqual(warnings.length, 0, `Expected 0 warnings, got: ${warnings.join(', ')}`);
    });

    it('should load profile and merge with defaults', () => {
        resetCache();
        const profile = load();
        assert.ok(profile);
        assert.ok(profile.business);
        assert.ok(profile.owner);
        assert.ok(profile.preferences);
    });

    it('should return cached profile on subsequent calls', () => {
        resetCache();
        const p1 = getProfile();
        const p2 = getProfile();
        assert.strictEqual(p1, p2, 'Should return same cached object');
    });

    it('should provide business info for prompt', () => {
        resetCache();
        const info = getBusinessInfoForPrompt();
        assert.ok(typeof info.name === 'string');
        assert.ok(typeof info.language === 'string');
        assert.ok(typeof info.campaignStyle === 'string');
        assert.ok(Array.isArray(info.valuePropositions));
        assert.ok(Array.isArray(info.targetIndustries));
    });

    it('should fallback to env vars for empty profile fields', () => {
        resetCache();
        const origName = process.env.BUSINESS_NAME;
        process.env.BUSINESS_NAME = 'EnvBizName';
        
        const profile = load();
        // If no business-profile.json or name is empty, should use env
        if (!profile.business.name || profile.business.name === 'EnvBizName') {
            assert.strictEqual(profile.business.name, 'EnvBizName');
        }
        
        if (origName) process.env.BUSINESS_NAME = origName;
        else delete process.env.BUSINESS_NAME;
        resetCache();
    });
});

describe('FileUtils', () => {
    const FileUtils = require('./src/fileUtils');
    const testOutputDir = path.join(__dirname, 'test_output');

    function cleanup() {
        if (fs.existsSync(testOutputDir)) {
            fs.rmSync(testOutputDir, { recursive: true });
        }
    }

    it('should format Indonesian phone numbers (0xx → 62xx)', () => {
        assert.strictEqual(FileUtils.formatPhoneNumber('081234567890'), '6281234567890');
    });

    it('should keep numbers already starting with 62', () => {
        assert.strictEqual(FileUtils.formatPhoneNumber('6281234567890'), '6281234567890');
    });

    it('should return null for invalid phone numbers', () => {
        assert.strictEqual(FileUtils.formatPhoneNumber(null), null);
        assert.strictEqual(FileUtils.formatPhoneNumber(''), null);
        assert.strictEqual(FileUtils.formatPhoneNumber('1234'), null);
    });

    it('should load leads from JSON file', () => {
        const testFile = path.join(testOutputDir, 'test_leads.json');
        if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir, { recursive: true });
        
        const testData = [
            { name: 'Business A', phone: '081234567890' },
            { name: 'Business B', phone: '081234567891' }
        ];
        fs.writeFileSync(testFile, JSON.stringify(testData));
        
        const loaded = FileUtils.loadLeads(testFile);
        assert.strictEqual(loaded.length, 2);
        assert.strictEqual(loaded[0].name, 'Business A');
        
        cleanup();
    });

    it('should return empty array for non-existent file', () => {
        const loaded = FileUtils.loadLeads('/nonexistent/file.json');
        assert.deepStrictEqual(loaded, []);
    });
});

describe('FileUtils.saveLeads', () => {
    const FileUtils = require('./src/fileUtils');
    const testOutputDir = path.join(__dirname, 'test_output');

    function cleanup() {
        if (fs.existsSync(testOutputDir)) {
            fs.rmSync(testOutputDir, { recursive: true });
        }
    }

    it('should save leads as JSON', async () => {
        cleanup();
        if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir, { recursive: true });
        const testFile = path.join(testOutputDir, 'save_leads.json');
        const data = [{ name: 'Test', address: 'Jl. Test', phone: '08123' }];
        
        await FileUtils.saveLeads(data, testFile);
        
        assert.ok(fs.existsSync(testFile));
        const saved = JSON.parse(fs.readFileSync(testFile, 'utf8'));
        assert.strictEqual(saved.length, 1);
        assert.strictEqual(saved[0].name, 'Test');
        cleanup();
    });

    it('should save leads as CSV', async () => {
        cleanup();
        if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir, { recursive: true });
        const testFile = path.join(testOutputDir, 'leads.csv');
        const data = [
            { name: 'Test Biz', address: 'Jakarta', phone: '08123', rating: '4.5', intelligence: { score: 85, priority: 'HIGH', category: 'A+' } }
        ];
        
        await FileUtils.saveLeads(data, testFile);
        
        assert.ok(fs.existsSync(testFile));
        const content = fs.readFileSync(testFile, 'utf8');
        assert.ok(content.includes('Test Biz'));
        assert.ok(content.includes('Jakarta'));
        assert.ok(content.includes('85'));
        assert.ok(content.includes('HIGH'));
        cleanup();
    });

    it('should create directories recursively', async () => {
        cleanup();
        const testFile = path.join(testOutputDir, 'nested', 'deep', 'leads.json');
        const data = [{ name: 'Nested' }];
        
        await FileUtils.saveLeads(data, testFile);
        
        assert.ok(fs.existsSync(testFile));
        cleanup();
    });
});

describe('LeadIntelligence', () => {
    const LeadIntelligence = require('./src/leadIntelligence');
    const intelligence = new LeadIntelligence();

    it('should instantiate without errors', () => {
        assert.ok(intelligence);
        assert.ok(intelligence.industryScores);
        assert.ok(intelligence.locationScores);
    });

    it('should score data completeness correctly', () => {
        const completeLead = { name: 'Test', address: 'Jakarta', phone: '08123', website: 'test.com', rating: '4.5' };
        const incompleteLead = { name: 'Test' };
        
        const completeScore = intelligence.scoreDataCompleteness(completeLead);
        const incompleteScore = intelligence.scoreDataCompleteness(incompleteLead);
        
        assert.ok(completeScore > incompleteScore, `Complete (${completeScore}) should be > Incomplete (${incompleteScore})`);
        assert.ok(completeScore >= 70, `Complete lead score (${completeScore}) should be >= 70`);
    });

    it('should categorize scores correctly', () => {
        assert.strictEqual(intelligence.categorizeScore(90), 'A+ (Excellent)');
        assert.strictEqual(intelligence.categorizeScore(80), 'A (High Quality)');
        assert.strictEqual(intelligence.categorizeScore(70), 'B (Good)');
        assert.strictEqual(intelligence.categorizeScore(60), 'C (Average)');
        assert.strictEqual(intelligence.categorizeScore(40), 'D (Low Priority)');
    });

    it('should get correct priority levels', () => {
        assert.strictEqual(intelligence.getPriority(90), 'HIGH');
        assert.strictEqual(intelligence.getPriority(70), 'MEDIUM');
        assert.strictEqual(intelligence.getPriority(50), 'LOW');
    });

    it('should score location for known cities', () => {
        const jakartaLead = { address: 'Jl. Sudirman, Jakarta' };
        const unknownLead = { address: 'Desa Terpencil' };
        
        const jakartaScore = intelligence.scoreLocation(jakartaLead);
        const unknownScore = intelligence.scoreLocation(unknownLead);
        
        assert.ok(jakartaScore > unknownScore, `Jakarta (${jakartaScore}) should score higher than unknown (${unknownScore})`);
    });

    it('should score industry potential', () => {
        const retailScore = intelligence.scoreIndustryPotential('retail');
        const unknownScore = intelligence.scoreIndustryPotential('unknown_industry');
        
        assert.ok(retailScore > 0);
        assert.strictEqual(unknownScore, 70);
    });

    it('should score leads and return sorted results', async () => {
        const leads = [
            { name: 'Low Quality', address: 'Unknown', phone: '' },
            { name: 'High Quality Cafe', address: 'Jl. Sudirman, Jakarta', phone: '081234567890', rating: '4.8', website: 'cafe.com' }
        ];
        
        const scored = await intelligence.scoreLeads(leads, 'restaurant');
        
        assert.strictEqual(scored.length, 2);
        assert.ok(scored[0].intelligence.score >= scored[1].intelligence.score, 'Results should be sorted by score descending');
        assert.ok(scored[0].intelligence.category);
        assert.ok(scored[0].intelligence.recommendation);
        assert.ok(scored[0].intelligence.priority);
    });

    it('should filter leads by score', async () => {
        const leads = [
            { name: 'A', address: 'Jakarta', phone: '081234567890', rating: '4.8', website: 'a.com' },
            { name: 'B', address: 'Unknown' }
        ];
        
        const scored = await intelligence.scoreLeads(leads, 'professional');
        const filtered = intelligence.filterLeadsByScore(scored, 60);
        
        assert.ok(filtered.length <= scored.length);
        filtered.forEach(lead => {
            assert.ok(lead.intelligence.score >= 60);
        });
    });
});

describe('BusinessScraper', () => {
    const BusinessScraper = require('./src/scraper');
    
    it('should instantiate without errors', () => {
        const scraper = new BusinessScraper();
        assert.ok(scraper);
        assert.deepStrictEqual(scraper.results, []);
    });

    it('should clean phone numbers correctly', () => {
        const scraper = new BusinessScraper();
        
        const cleaned = scraper.cleanPhoneNumber('+62 812 3456 7890');
        assert.strictEqual(cleaned, '081234567890');
        
        const cleaned2 = scraper.cleanPhoneNumber('(021) 555-1234');
        assert.ok(!cleaned2.includes('('));
        assert.ok(!cleaned2.includes('-'));
    });

    it('should validate emails', () => {
        const scraper = new BusinessScraper();
        
        assert.strictEqual(scraper.validateEmail('test@example.com'), true);
        assert.strictEqual(scraper.validateEmail('invalid-email'), false);
        assert.strictEqual(scraper.validateEmail(''), false);
        assert.strictEqual(scraper.validateEmail('user@domain.co.id'), true);
    });

    it('should return empty array for findEmails (stub)', async () => {
        const scraper = new BusinessScraper();
        const emails = await scraper.findEmails('Test', 'Jakarta');
        assert.deepStrictEqual(emails, []);
    });

    it('should process and deduplicate results', async () => {
        const scraper = new BusinessScraper();
        scraper.results = [
            { name: 'Business A', address: 'Jakarta', phone: '081234567890' },
            { name: 'Business A', address: 'Jakarta', phone: '081234567890' },
            { name: 'Business B', address: 'Bandung', phone: '081234567891' }
        ];
        
        const processed = await scraper.processResults();
        assert.strictEqual(processed.length, 2, 'Should deduplicate');
        assert.ok(processed[0].id);
        assert.ok(processed[0].scrapedAt);
    });
});

describe('CLI Argument Parser', () => {
    const { parseArguments } = require('./src/cli');

    it('should have default values', () => {
        const originalArgv = process.argv;
        process.argv = ['node', 'index.js'];
        
        const options = parseArguments();
        // Default query is now dynamic from business profile (empty string if no profile)
        assert.strictEqual(typeof options.query, 'string');
        assert.strictEqual(options.maxResults, 20);
        assert.strictEqual(options.generateMarketing, false);
        assert.ok(options.language, 'Should have a language option');
        
        process.argv = originalArgv;
    });

    it('should parse query argument', () => {
        const originalArgv = process.argv;
        process.argv = ['node', 'index.js', '-q', 'Restaurant Jakarta'];
        
        const options = parseArguments();
        assert.strictEqual(options.query, 'Restaurant Jakarta');
        
        process.argv = originalArgv;
    });

    it('should parse length with max cap of 100', () => {
        const originalArgv = process.argv;
        process.argv = ['node', 'index.js', '-l', '200'];
        
        const options = parseArguments();
        assert.strictEqual(options.maxResults, 100);
        
        process.argv = originalArgv;
    });

    it('should enable marketing flag', () => {
        const originalArgv = process.argv;
        process.argv = ['node', 'index.js', '-m', 'Test marketing content'];
        
        const options = parseArguments();
        assert.strictEqual(options.generateMarketing, true);
        assert.strictEqual(options.marketingContent, 'Test marketing content');
        
        process.argv = originalArgv;
    });
});

describe('Marketing Template Personalization', () => {
    const MarketingAutomation = require('./src/marketing');

    it('should personalize templates with lead data', () => {
        const marketing = new MarketingAutomation();
        
        const baseTemplate = {
            subject: 'Solusi untuk [BUSINESS_NAME]',
            email: 'Halo [BUSINESS_NAME], kami melihat bisnis Anda di [ADDRESS]. Hubungi kami di [PHONE].',
            whatsapp: 'Hi [BUSINESS_NAME]! Bisnis di [ADDRESS]. Call [PHONE]!'
        };
        
        const lead = {
            name: 'Warung Makan Sederhana',
            address: 'Jl. Sudirman No.1, Jakarta',
            phone: '081234567890'
        };
        
        const result = marketing.personalizeTemplate(baseTemplate, lead);
        
        assert.ok(result.subject.includes('Warung Makan Sederhana'));
        assert.ok(!result.subject.includes('[BUSINESS_NAME]'));
        assert.ok(result.email.includes('Jl. Sudirman No.1, Jakarta'));
        assert.ok(!result.email.includes('[ADDRESS]'));
        assert.ok(result.whatsapp.includes('081234567890'));
    });

    it('should handle missing lead data gracefully', () => {
        const marketing = new MarketingAutomation();
        
        const baseTemplate = {
            subject: 'Hi [BUSINESS_NAME]',
            email: '[BUSINESS_NAME] at [ADDRESS] - [PHONE]',
            whatsapp: '[BUSINESS_NAME]'
        };
        
        const lead = { name: 'Test Biz' };
        
        const result = marketing.personalizeTemplate(baseTemplate, lead);
        
        assert.ok(result.subject.includes('Test Biz'));
        assert.ok(!result.email.includes('[BUSINESS_NAME]'));
        assert.ok(!result.email.includes('[ADDRESS]'));
    });

    it('should parse marketing response format', () => {
        const marketing = new MarketingAutomation();
        
        const mockResponse = [
            'SUBJECT: Test Subject Line',
            'EMAIL:',
            'This is the email body content.',
            'It spans multiple lines.',
            'WHATSAPP:',
            'This is WhatsApp content with emojis'
        ].join('\n');
        
        const parsed = marketing.parseMarketingResponse(mockResponse);
        
        assert.strictEqual(parsed.subject, 'Test Subject Line');
        assert.ok(parsed.email.includes('email body content'));
        assert.ok(parsed.whatsapp.includes('WhatsApp content'));
    });
});

describe('MarketingAI', () => {
    const MarketingAI = require('./src/marketingAI');

    it('should instantiate without errors', () => {
        const ai = new MarketingAI();
        assert.ok(ai);
        assert.ok(ai.industryTemplates);
        assert.ok(ai.indonesianContext);
        assert.ok(ai.englishContext);
        assert.ok(ai.marketData);
    });

    it('should have templates for all industries', () => {
        const ai = new MarketingAI();
        const expectedIndustries = ['restaurant', 'automotive', 'retail', 'professional', 'healthcare', 'education', 'realestate'];
        
        expectedIndustries.forEach(industry => {
            assert.ok(ai.industryTemplates[industry], `Missing template for: ${industry}`);
            assert.ok(ai.industryTemplates[industry].painPoints.length > 0);
            assert.ok(ai.industryTemplates[industry].solutions.length > 0);
            assert.ok(ai.industryTemplates[industry].benefits.length > 0);
        });
    });

    it('should return industry insights', () => {
        const ai = new MarketingAI();
        
        const insights = ai.getIndustryInsights('restaurant');
        assert.ok(insights);
        assert.ok(insights.painPoints);
        assert.ok(insights.solutions);
        assert.ok(insights.localContext);
        
        const nullInsights = ai.getIndustryInsights('nonexistent');
        assert.strictEqual(nullInsights, null);
    });

    it('should return available languages', () => {
        const ai = new MarketingAI();
        const languages = ai.getAvailableLanguages();
        
        assert.ok(languages.length >= 2);
        assert.ok(languages.find(l => l.code === 'indonesian'));
        assert.ok(languages.find(l => l.code === 'english'));
    });

    it('should return campaign styles for both languages', () => {
        const ai = new MarketingAI();
        
        const idStyles = ai.getCampaignStyles('indonesian');
        const enStyles = ai.getCampaignStyles('english');
        
        assert.strictEqual(idStyles.length, 3);
        assert.strictEqual(enStyles.length, 3);
        assert.ok(idStyles.find(s => s.code === 'conservative'));
        assert.ok(idStyles.find(s => s.code === 'balanced'));
        assert.ok(idStyles.find(s => s.code === 'aggressive'));
    });

    it('should return available industries for both languages', () => {
        const ai = new MarketingAI();
        
        const idIndustries = ai.getAvailableIndustries('indonesian');
        const enIndustries = ai.getAvailableIndustries('english');
        
        assert.ok(idIndustries.length >= 7);
        assert.ok(enIndustries.length >= 7);
        assert.ok(idIndustries[0].code);
        assert.ok(idIndustries[0].name);
        assert.ok(idIndustries[0].marketSize);
    });

    it('should validate and enhance lead data', () => {
        const ai = new MarketingAI();
        
        const lead = { name: 'Test Cafe', website: 'test.com', rating: 4.5 };
        const enhanced = ai.validateAndEnhanceLead(lead);
        
        assert.strictEqual(enhanced.name, 'Test Cafe');
        assert.ok(enhanced.businessSize);
        assert.ok(enhanced.digitalMaturity);
        assert.ok(typeof enhanced.urgencyScore === 'number');
    });

    it('should estimate business size', () => {
        const ai = new MarketingAI();
        
        assert.strictEqual(ai.estimateBusinessSize({ website: 'test.com', rating: 4.5 }), 'medium-large');
        assert.strictEqual(ai.estimateBusinessSize({ website: 'test.com' }), 'small-medium');
        assert.strictEqual(ai.estimateBusinessSize({}), 'small');
    });

    it('should get market size for industries in both languages', () => {
        const ai = new MarketingAI();
        
        const idMarket = ai.getMarketSize('restaurant', 'indonesian');
        const enMarket = ai.getMarketSize('restaurant', 'english');
        
        assert.ok(idMarket.includes('F&B'));
        assert.ok(enMarket.includes('food service'));
    });
});

// ─── Run Tests ──────────────────────────────────────────────
runTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
