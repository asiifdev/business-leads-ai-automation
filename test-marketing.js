const MarketingAutomation = require('./src/marketing');
const FileUtils = require('./src/fileUtils');

async function testMarketingAutomation() {
    console.log('🤖 Testing AI Marketing Automation...\n');

    // Initialize marketing with OpenAI (optional)
    const openaiKey = process.env.OPENAI_API_KEY;
    const marketing = new MarketingAutomation(openaiKey);

    // Load sample leads (use the latest scraped data)
    const latestFile = 'output/rental_mobil_jakarta_leads_2025-07-05.json';
    const leads = marketing.loadLeads(latestFile);

    if (leads.length === 0) {
        console.log('❌ No leads found. Please run scraping first:');
        console.log('   node index.js -q "Rental Mobil Jakarta" -l 10');
        return;
    }

    console.log(`📊 Loaded ${leads.length} leads for testing`);

    // Test AI template generation
    console.log('\n🧪 Testing AI Template Generation...');
    
    const sampleLead = leads[0];
    console.log(`Sample lead: ${sampleLead.name} - ${sampleLead.address}`);

    // Test email template
    console.log('\n📧 Testing Email Template:');
    const emailTemplate = await marketing.generateAITemplate(sampleLead, 'email', 'rental_mobil');
    console.log(`Subject: ${emailTemplate.subject}`);
    console.log(`Body preview: ${emailTemplate.body.substring(0, 150)}...`);

    // Test WhatsApp template
    console.log('\n📱 Testing WhatsApp Template:');
    const waTemplate = await marketing.generateAITemplate(sampleLead, 'whatsapp', 'rental_mobil');
    console.log(`Message preview: ${waTemplate.substring(0, 150)}...`);

    // Test bulk outreach (test mode)
    console.log('\n🚀 Testing Bulk Outreach (Test Mode)...');
    const results = await marketing.bulkOutreach(leads.slice(0, 3), {
        emailFirst: true,
        maxPerDay: 3,
        testMode: true,
        businessType: 'rental_mobil',
        useAI: !!openaiKey // Use AI if API key is available
    });

    console.log('\n✅ Test Results:');
    console.log(`📧 Emails would be sent: ${results.emailsSent}`);
    console.log(`📱 WhatsApps would be sent: ${results.whatsappsSent}`);
    console.log(`❌ Errors: ${results.errors.length}`);

    // Generate report
    console.log('\n📊 Marketing Report:');
    const report = marketing.generateDailyReport();
}

// Run test if this file is executed directly
if (require.main === module) {
    testMarketingAutomation().catch(console.error);
}

module.exports = { testMarketingAutomation }; 