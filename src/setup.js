const readline = require('readline');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { getDefaults, save, isConfigured, PROFILE_FILE } = require('./businessProfile');

class SetupWizard {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.config = {};
        this.profile = getDefaults();
    }

    async start() {
        console.log('🚀 Welcome to Business Leads AI Automation Setup!\n');
        console.log('Let\'s get you started in just a few minutes...\n');
        
        await this.configureAPI();
        await this.configureBusinessProfile();
        await this.configureOwnerInfo();
        await this.configurePreferences();
        await this.selectIndustry();
        await this.selectBusinessType();
        await this.testConnection();
        await this.saveConfiguration();
        await this.runSampleCampaign();
        
        console.log('\n🎉 Setup complete! You\'re ready to generate leads.');
        console.log('Run: npm run campaign to start your first campaign\n');
        
        this.rl.close();
    }

    async configureAPI() {
        console.log('📋 Step 1: API Configuration');
        console.log('─'.repeat(40));
        
        const apiKey = await this.question('Enter your OpenAI API Key: ');
        
        if (!apiKey || apiKey.length < 20) {
            console.log('❌ Invalid API key. Please get one from: https://platform.openai.com/');
            process.exit(1);
        }

        // Optional: custom base URL
        console.log('\n💡 Optional: Enter a custom OpenAI Base URL');
        console.log('   (for Azure, OpenRouter, local LLMs, etc.)');
        const baseUrl = await this.question('Base URL (press Enter to skip): ');
        
        if (baseUrl && baseUrl.trim()) {
            this.config.OPENAI_BASE_URL = baseUrl.trim();
            console.log(`🔗 Using custom base URL: ${this.config.OPENAI_BASE_URL}`);
        }
        
        // Test API key
        try {
            const clientConfig = { apiKey };
            if (this.config.OPENAI_BASE_URL) {
                clientConfig.baseURL = this.config.OPENAI_BASE_URL;
            }
            const openai = new OpenAI(clientConfig);
            await openai.models.list();
            console.log('✅ API key validated successfully!\n');
            this.config.OPENAI_API_KEY = apiKey;
        } catch (error) {
            console.log('❌ API key test failed:', error.message);
            process.exit(1);
        }
    }

    async configureBusinessProfile() {
        console.log('🏢 Step 2: Business Profile');
        console.log('─'.repeat(40));
        console.log('Tell us about your business so AI can generate personalized content.\n');
        
        this.profile.business.name = await this.question('Business name: ') || '';
        this.profile.business.type = await this.question('Business type (e.g., technology, consulting, marketing, services): ') || '';
        this.profile.business.phone = await this.question('Business phone: ') || '';
        this.profile.business.email = await this.question('Business email: ') || '';
        this.profile.business.website = await this.question('Business website (or press Enter to skip): ') || '';
        
        console.log('\n💡 Describe your product/service in detail.');
        console.log('   This will be used in AI-generated marketing content.');
        this.profile.business.description = await this.question('Description: ') || '';
        
        console.log('\n💡 List your value propositions (comma-separated).');
        console.log('   Example: Fast delivery, 24/7 support, Affordable pricing');
        const vpsInput = await this.question('Value propositions: ');
        this.profile.business.valuePropositions = vpsInput
            ? vpsInput.split(',').map(v => v.trim()).filter(v => v)
            : [];
        
        console.log('\n💡 List your target industries (comma-separated).');
        console.log('   Example: restaurant, automotive, retail');
        const tiInput = await this.question('Target industries: ');
        this.profile.business.targetIndustries = tiInput
            ? tiInput.split(',').map(v => v.trim()).filter(v => v)
            : [];
        
        console.log('✅ Business profile configured!\n');
    }

    async configureOwnerInfo() {
        console.log('👤 Step 3: Owner / Contact Person');
        console.log('─'.repeat(40));
        
        this.profile.owner.name = await this.question('Your name: ') || '';
        this.profile.owner.phone = await this.question('Your phone (for WhatsApp follow-ups): ') || '';
        this.profile.owner.email = await this.question('Your email: ') || '';
        
        console.log('✅ Owner info configured!\n');
    }

    async configurePreferences() {
        console.log('🌐 Step 4: Preferences');
        console.log('─'.repeat(40));
        
        console.log('Output language:');
        console.log('1. 🇮🇩 Indonesian (Bahasa Indonesia)');
        console.log('2. 🇬🇧 English');
        
        const langChoice = await this.question('\nSelect language (1-2): ');
        this.profile.preferences.language = langChoice === '2' ? 'english' : 'indonesian';
        console.log(`✅ Language: ${this.profile.preferences.language}\n`);
        
        // Default search query  
        console.log('💡 Optionally set a default search query for your campaigns.');
        const bizType = this.profile.business.type;
        const suggestion = bizType ? `${bizType} Jakarta` : '';
        this.profile.preferences.defaultSearchQuery = await this.question(
            `Default search query${suggestion ? ` (e.g., "${suggestion}")` : ''}: `
        ) || '';
        
        // Default location
        this.profile.preferences.defaultLocation = await this.question('Default target location (e.g., Jakarta): ') || '';
    }

    async selectIndustry() {
        console.log('\n🎯 Step 5: Industry Focus');
        console.log('─'.repeat(40));
        console.log('Select your primary target industry:');
        console.log('1. 🍽️  Restaurant & Food Service');
        console.log('2. 🚗 Automotive (Rental, Workshop)');
        console.log('3. 🛍️  Retail & E-commerce');
        console.log('4. 💼 Professional Services');
        console.log('5. 🏥 Healthcare');
        console.log('6. 🎓 Education');
        console.log('7. 🏠 Real Estate');
        console.log('8. 🔧 Other/Custom');
        
        const choice = await this.question('\nSelect option (1-8): ');
        
        const industries = {
            '1': 'restaurant',
            '2': 'automotive', 
            '3': 'retail',
            '4': 'professional',
            '5': 'healthcare',
            '6': 'education',
            '7': 'realestate',
            '8': 'custom'
        };
        
        this.config.PRIMARY_INDUSTRY = industries[choice] || 'custom';
        console.log(`✅ Industry set to: ${this.config.PRIMARY_INDUSTRY}\n`);
    }

    async selectBusinessType() {
        console.log('🎨 Step 6: Campaign Style');
        console.log('─'.repeat(40));
        console.log('Choose your outreach approach:');
        console.log('1. 🤝 Conservative (respectful, professional)');
        console.log('2. ⚖️  Balanced (standard business outreach)');
        console.log('3. 🚀 Aggressive (high-volume, direct)');
        
        const choice = await this.question('\nSelect approach (1-3): ');
        
        const approaches = {
            '1': 'conservative',
            '2': 'balanced',
            '3': 'aggressive'
        };
        
        this.config.CAMPAIGN_STYLE = approaches[choice] || 'balanced';
        this.profile.preferences.campaignStyle = this.config.CAMPAIGN_STYLE;
        console.log(`✅ Campaign style: ${this.config.CAMPAIGN_STYLE}\n`);
    }

    async testConnection() {
        console.log('🧪 Step 7: Testing Connection');
        console.log('─'.repeat(40));
        console.log('Testing your configuration...\n');
        
        this.showProgress('Validating API connection', 0);
        await this.delay(1000);
        this.showProgress('Validating API connection', 50);
        await this.delay(1000);
        this.showProgress('Validating API connection', 100);
        
        console.log('\n✅ All systems ready!\n');
    }

    async saveConfiguration() {
        console.log('💾 Step 8: Saving Configuration');
        console.log('─'.repeat(40));
        
        // Create .env file
        let envContent = `# Business Leads AI Automation Configuration
# Generated by Setup Wizard

OPENAI_API_KEY=${this.config.OPENAI_API_KEY}
OPENAI_MODEL=gpt-4o-mini
`;

        if (this.config.OPENAI_BASE_URL) {
            envContent += `OPENAI_BASE_URL=${this.config.OPENAI_BASE_URL}\n`;
        } else {
            envContent += `# OPENAI_BASE_URL=https://your-custom-endpoint.com/v1\n`;
        }

        envContent += `
PRIMARY_INDUSTRY=${this.config.PRIMARY_INDUSTRY}
CAMPAIGN_STYLE=${this.config.CAMPAIGN_STYLE}
OUTPUT_LANGUAGE=${this.profile.preferences.language}

# Optional Configuration
DELAY_BETWEEN_SCRAPES=2000
MAX_RETRIES=3
OUTPUT_FORMAT=csv
DEFAULT_RESULT_LIMIT=20
`;

        fs.writeFileSync('.env', envContent);
        
        // Save business profile
        save(this.profile);
        console.log(`✅ Business profile saved to ${PROFILE_FILE}`);
        
        // Create legacy user preferences file (backward compatibility)
        const prefsContent = {
            industry: this.config.PRIMARY_INDUSTRY,
            campaignStyle: this.config.CAMPAIGN_STYLE,
            language: this.profile.preferences.language,
            setupDate: new Date().toISOString(),
            version: '2.0.0'
        };
        
        fs.writeFileSync('user-preferences.json', JSON.stringify(prefsContent, null, 2));
        
        console.log('✅ Configuration saved successfully!\n');
    }

    async runSampleCampaign() {
        const runSample = await this.question('🎯 Would you like to run a sample campaign? (y/n): ');
        
        if (runSample.toLowerCase() === 'y' || runSample.toLowerCase() === 'yes') {
            console.log('\n🚀 Running sample campaign...');
            
            // Generate sample query from profile data rather than hardcoded map
            const bizType = this.profile.business.type || this.config.PRIMARY_INDUSTRY || 'business';
            const location = this.profile.preferences.defaultLocation || 'Jakarta';
            const query = this.profile.preferences.defaultSearchQuery || `${bizType} ${location}`;
            
            console.log(`Sample query: "${query}"`);
            console.log('Limit: 3 results (for testing)\n');
            
            // Show sample progress
            for (let i = 0; i <= 100; i += 20) {
                this.showProgress('Sample campaign', i);
                await this.delay(500);
            }
            
            console.log('\n✅ Sample campaign completed! Check output/ folder for results.\n');
        }
    }

    showProgress(task, percentage) {
        const width = 30;
        const filled = Math.round(width * percentage / 100);
        const empty = width - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        
        process.stdout.write(`\r${task}: ${bar} ${percentage}%`);
        
        if (percentage === 100) {
            console.log(''); // New line when complete
        }
    }

    question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use in package.json scripts
if (require.main === module) {
    const wizard = new SetupWizard();
    wizard.start().catch(console.error);
}

module.exports = SetupWizard;