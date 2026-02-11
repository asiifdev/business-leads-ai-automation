require('dotenv').config();
const FileUtils = require('./fileUtils');
const { getClient, getModel } = require('./openaiClient');
const { getBusinessInfoForPrompt, getProfile } = require('./businessProfile');

class MarketingAutomation {
    constructor() {
        this.leads = [];
        this.messagesSent = 0;
        this.responses = 0;
        this.openai = getClient();
    }


    async loadLeads(jsonFile) {
        try {
            const leads = await FileUtils.loadLeads(jsonFile);
            this.leads = leads;
            console.log(`Loaded ${leads.length} leads from ${jsonFile}`);
            return leads;
        } catch (error) {
            console.error('Error loading leads:', error);
            return [];
        }
    }

    // Generate AI-powered marketing content
    async generateAIMarketingContent(lead) {
        if (!this.openai) {
            console.log('⚠️ OpenAI not configured, skipping AI content generation');
            return null;
        }

        try {
            const prompt = this.buildMarketingPrompt(lead);
            const profile = getProfile();
            const language = profile.preferences.language || 'indonesian';
            
            const systemContent = language === 'indonesian'
                ? "Anda adalah ahli pemasaran profesional yang berspesialisasi dalam penawaran bisnis. Buat konten pemasaran yang dipersonalisasi, menarik, dan berfokus pada konversi."
                : "You are a professional marketing expert specializing in business outreach. Create personalized, engaging, and conversion-focused marketing content.";
            
            const completion = await this.openai.chat.completions.create({
                model: getModel(),
                messages: [
                    {
                        role: "system",
                        content: systemContent
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7
            });

            const response = completion.choices[0].message.content;
            return this.parseMarketingResponse(response);

        } catch (error) {
            console.error('Error generating AI marketing content:', error);
            return null;
        }
    }

    buildMarketingPrompt(lead) {
        const biz = getBusinessInfoForPrompt();
        const language = biz.language;

        if (language === 'indonesian') {
            return `
Buat konten pemasaran yang dipersonalisasi untuk lead bisnis ini:

TARGET BISNIS:
- Nama: ${lead.name}
- Alamat: ${lead.address}
- Telepon: ${lead.phone || 'Tidak tersedia'}
- Rating: ${lead.rating || 'Tidak tersedia'}
- Website: ${lead.website ? 'Punya website' : 'Belum punya website'}

INFORMASI BISNIS ANDA:
- Nama Bisnis: ${biz.name}
- Telepon Bisnis: ${biz.phone}
- Email Bisnis: ${biz.email}
- Website: ${biz.website}
- Nama Pemilik: ${biz.ownerName}
- Telepon Pemilik: ${biz.ownerPhone}
- Email Pemilik: ${biz.ownerEmail}
- Tipe Bisnis: ${biz.type}
- Deskripsi: ${biz.description}
${biz.valuePropositions.length > 0 ? `- Value Propositions: ${biz.valuePropositions.join(', ')}` : ''}

PERSYARATAN:
1. Buat SUBJECT EMAIL (maks 60 karakter)
2. Buat KONTEN EMAIL (profesional, personal, sertakan call-to-action)
3. Buat KONTEN WHATSAPP (casual, nada ramah dengan emoji, sertakan call-to-action)
4. Gunakan Bahasa Indonesia
5. Sebutkan nama dan lokasi bisnis mereka
6. Sertakan informasi kontak bisnis Anda
7. Fokus pada value proposition dan manfaat

FORMAT RESPONSE:
SUBJECT: [subject email]
EMAIL: [konten email]
WHATSAPP: [konten whatsapp]

Buat konten pemasaran:`;
        } else {
            return `
Create personalized marketing content for this business lead:

TARGET BUSINESS:
- Name: ${lead.name}
- Address: ${lead.address}
- Phone: ${lead.phone || 'Not available'}
- Rating: ${lead.rating || 'Not available'}
- Website: ${lead.website ? 'Has website' : 'No website'}

YOUR BUSINESS INFO:
- Business Name: ${biz.name}
- Business Phone: ${biz.phone}
- Business Email: ${biz.email}
- Website: ${biz.website}
- Owner Name: ${biz.ownerName}
- Owner Phone: ${biz.ownerPhone}
- Owner Email: ${biz.ownerEmail}
- Business Type: ${biz.type}
- Description: ${biz.description}
${biz.valuePropositions.length > 0 ? `- Value Propositions: ${biz.valuePropositions.join(', ')}` : ''}

REQUIREMENTS:
1. Create an EMAIL SUBJECT LINE (max 60 characters)
2. Create EMAIL CONTENT (professional, personalized, include call-to-action)
3. Create WHATSAPP CONTENT (casual, friendly tone with emojis, include call-to-action)
4. Use English
5. Make it personal by mentioning their business name and location
6. Include your business contact information
7. Focus on value proposition and benefits

FORMAT YOUR RESPONSE AS:
SUBJECT: [email subject line]
EMAIL: [email content]
WHATSAPP: [whatsapp content]

Generate the marketing content:`;
        }
    }

    parseMarketingResponse(response) {
        const lines = response.split('\n');
        let subject = '';
        let email = '';
        let whatsapp = '';
        let currentSection = '';

        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.toLowerCase().startsWith('subject:')) {
                subject = trimmedLine.replace(/^subject:\s*/i, '').trim();
            } else if (trimmedLine.toLowerCase().startsWith('email:')) {
                currentSection = 'email';
            } else if (trimmedLine.toLowerCase().startsWith('whatsapp:')) {
                currentSection = 'whatsapp';
            } else if (trimmedLine && currentSection === 'email') {
                email += (email ? '\n' : '') + trimmedLine;
            } else if (trimmedLine && currentSection === 'whatsapp') {
                whatsapp += (whatsapp ? '\n' : '') + trimmedLine;
            }
        }

        const profile = getProfile();
        const defaultSubject = profile.preferences.language === 'indonesian'
            ? 'Solusi Digital untuk Bisnis Anda'
            : 'Digital Solutions for Your Business';

        return {
            subject: subject || defaultSubject,
            email: email || 'Email content not generated',
            whatsapp: whatsapp || 'WhatsApp content not generated'
        };
    }

    async generateMarketingTemplatesWithContent(leads, marketingContent, callToAction = "") {
        console.log(`🤖 Generating AI marketing templates for ${leads.length} leads...`);
        
        // Generate base template once using AI
        console.log('📝 Generating base marketing template with AI...');
        const baseTemplate = await this.generateBaseMarketingTemplate(marketingContent, callToAction);
        
        if (!baseTemplate) {
            console.log('❌ Failed to generate base template');
            return [];
        }
        
        console.log('✅ Base template generated successfully');
        
        const marketingData = [];
        const biz = getBusinessInfoForPrompt();
        
        // Apply base template to each lead with personalization
        for (let i = 0; i < leads.length; i++) {
            const lead = leads[i];
            console.log(`Processing ${i + 1}/${leads.length}: ${lead.name}`);
            
            try {
                const personalizedContent = this.personalizeTemplate(baseTemplate, lead);
                
                marketingData.push({
                    namaBisnis: lead.name,
                    nomorHP: lead.phone || '',
                    subyek: personalizedContent.subject,
                    tipeBisnis: biz.type || 'general',
                    kontenEmail: personalizedContent.email,
                    kontenWhatsapp: personalizedContent.whatsapp
                });
                
            } catch (error) {
                console.error(`Error personalizing content for ${lead.name}:`, error);
            }
        }
        
        return marketingData;
    }

    async generateBaseMarketingTemplate(marketingContent, callToAction = "") {
        if (!this.openai) {
            console.log('⚠️ OpenAI not configured, cannot generate base template');
            return null;
        }

        try {
            const prompt = this.buildBaseTemplatePrompt(marketingContent, callToAction);
            const profile = getProfile();
            const language = profile.preferences.language || 'indonesian';
            
            const systemContent = language === 'indonesian'
                ? "Anda adalah ahli pemasaran profesional yang berspesialisasi dalam penawaran bisnis. Buat template pemasaran yang menarik dan berfokus pada konversi."
                : "You are a professional marketing expert specializing in business outreach. Create engaging and conversion-focused marketing templates.";

            const completion = await this.openai.chat.completions.create({
                model: getModel(),
                messages: [
                    {
                        role: "system",
                        content: systemContent
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7
            });

            const response = completion.choices[0].message.content;
            return this.parseMarketingResponse(response);

        } catch (error) {
            console.error('Error generating base marketing template:', error);
            return null;
        }
    }

    buildBaseTemplatePrompt(marketingContent, callToAction) {
        const biz = getBusinessInfoForPrompt();
        const language = biz.language;

        if (language === 'indonesian') {
            return `
Buat template pemasaran dasar yang akan dipersonalisasi untuk berbagai bisnis:

KONTEN PEMASARAN:
${marketingContent}

CALL TO ACTION:
${callToAction || "Buat call to action yang sesuai secara otomatis"}

INFORMASI BISNIS ANDA:
- Nama Bisnis: ${biz.name}
- Telepon Bisnis: ${biz.phone}
- Email Bisnis: ${biz.email}
- Website: ${biz.website}
- Nama Pemilik: ${biz.ownerName}
- Telepon Pemilik: ${biz.ownerPhone}
- Email Pemilik: ${biz.ownerEmail}
- Tipe Bisnis: ${biz.type}
- Deskripsi: ${biz.description}
${biz.valuePropositions.length > 0 ? `- Value Propositions: ${biz.valuePropositions.join(', ')}` : ''}

PERSYARATAN:
1. Buat SUBJECT EMAIL template (maks 60 karakter, gunakan placeholder [BUSINESS_NAME])
2. Buat KONTEN EMAIL template (profesional, sertakan placeholder [BUSINESS_NAME], [ADDRESS], [PHONE])
3. Buat KONTEN WHATSAPP template (casual, nada ramah dengan emoji, sertakan placeholder [BUSINESS_NAME], [ADDRESS], [PHONE])
4. Gunakan Bahasa Indonesia
5. Masukkan konten pemasaran dan call to action secara natural
6. Sertakan informasi kontak bisnis Anda
7. Buat personal tapi reusable untuk bisnis berbeda

FORMAT RESPONSE:
SUBJECT: [template subject email]
EMAIL: [template konten email]
WHATSAPP: [template konten whatsapp]

Buat template pemasaran dasar:`;
        } else {
            return `
Create a base marketing template that will be personalized for different businesses:

MARKETING CONTENT:
${marketingContent}

CALL TO ACTION:
${callToAction || "Auto-generate appropriate call to action"}

YOUR BUSINESS INFO:
- Business Name: ${biz.name}
- Business Phone: ${biz.phone}
- Business Email: ${biz.email}
- Website: ${biz.website}
- Owner Name: ${biz.ownerName}
- Owner Phone: ${biz.ownerPhone}
- Owner Email: ${biz.ownerEmail}
- Business Type: ${biz.type}
- Description: ${biz.description}
${biz.valuePropositions.length > 0 ? `- Value Propositions: ${biz.valuePropositions.join(', ')}` : ''}

REQUIREMENTS:
1. Create an EMAIL SUBJECT LINE template (max 60 characters, use [BUSINESS_NAME] placeholder)
2. Create EMAIL CONTENT template (professional, include [BUSINESS_NAME], [ADDRESS], [PHONE] placeholders)
3. Create WHATSAPP CONTENT template (casual, friendly tone with emojis, include [BUSINESS_NAME], [ADDRESS], [PHONE] placeholders)
4. Use English
5. Include the marketing content and call to action naturally
6. Include your business contact information
7. Make it personal but reusable for different businesses

FORMAT YOUR RESPONSE AS:
SUBJECT: [email subject template]
EMAIL: [email content template]
WHATSAPP: [whatsapp content template]

Generate the base marketing template:`;
        }
    }

    personalizeTemplate(baseTemplate, lead) {
        return {
            subject: baseTemplate.subject.replace(/\[BUSINESS_NAME\]/g, lead.name),
            email: baseTemplate.email
                .replace(/\[BUSINESS_NAME\]/g, lead.name)
                .replace(/\[ADDRESS\]/g, lead.address || '')
                .replace(/\[PHONE\]/g, lead.phone || ''),
            whatsapp: baseTemplate.whatsapp
                .replace(/\[BUSINESS_NAME\]/g, lead.name)
                .replace(/\[ADDRESS\]/g, lead.address || '')
                .replace(/\[PHONE\]/g, lead.phone || '')
        };
    }

    // Legacy method for backward compatibility
    async generateMarketingTemplates(leads) {
        console.log(`🤖 Generating AI marketing templates for ${leads.length} leads...`);
        
        const marketingData = [];
        const biz = getBusinessInfoForPrompt();
        
        for (let i = 0; i < leads.length; i++) {
            const lead = leads[i];
            console.log(`Processing ${i + 1}/${leads.length}: ${lead.name}`);
            
            try {
                const content = await this.generateAIMarketingContent(lead);
                
                if (content) {
                    marketingData.push({
                        namaBisnis: lead.name,
                        nomorHP: lead.phone || '',
                        subyek: content.subject,
                        tipeBisnis: biz.type || 'general',
                        kontenEmail: content.email,
                        kontenWhatsapp: content.whatsapp
                    });
                }
                
                // Delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`Error generating content for ${lead.name}:`, error);
            }
        }
        
        return marketingData;
    }

    async saveMarketingTemplates(marketingData, filename = "marketing_templates") {
        const timestamp = new Date().toISOString().split("T")[0];
        const csvFilename = `output/marketing-template/${filename}_${timestamp}.csv`;
        const jsonFilename = `output/marketing-template/${filename}_${timestamp}.json`;

        // Create marketing-template directory if it doesn't exist
        if (!require('fs').existsSync('output/marketing-template')) {
            require('fs').mkdirSync('output/marketing-template', { recursive: true });
        }

        // Save as CSV
        const csvHeader = "Nama Bisnis,Nomor HP,Subyek,Tipe Bisnis,Konten Email,Konten Whatsapp\n";
        const csvRows = marketingData
            .map(item => 
                `"${item.namaBisnis}","${item.nomorHP}","${item.subyek}","${item.tipeBisnis}","${item.kontenEmail.replace(/"/g, '""')}","${item.kontenWhatsapp.replace(/"/g, '""')}"`
            )
            .join("\n");

        require('fs').writeFileSync(csvFilename, csvHeader + csvRows);

        // Save as JSON
        require('fs').writeFileSync(jsonFilename, JSON.stringify(marketingData, null, 2));

        console.log(`Marketing templates saved to ${csvFilename} and ${jsonFilename}`);
        return { csvFile: csvFilename, jsonFile: jsonFilename };
    }

    // Legacy methods for backward compatibility
    async generateAITemplate(lead, templateType = 'email') {
        const content = await this.generateAIMarketingContent(lead);
        if (!content) return null;
        
        if (templateType === 'email') {
            return {
                subject: content.subject,
                body: content.email
            };
        } else {
            return content.whatsapp;
        }
    }

    async sendEmail(lead, template) {
        try {
            console.log(`📧 Sending email to ${lead.name}`);
            console.log(`Subject: ${template.subject}`);
            console.log(`Body preview: ${template.body.substring(0, 100)}...`);
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Log untuk tracking
            const emailLog = {
                leadId: lead.id,
                leadName: lead.name,
                type: 'email',
                template: template.subject,
                sentAt: new Date().toISOString(),
                status: 'sent'
            };
            
            FileUtils.logActivity(emailLog);
            this.messagesSent++;
            
            return { success: true, message: 'Email sent successfully' };
        } catch (error) {
            console.error(`Error sending email to ${lead.name}:`, error);
            return { success: false, error: error.message };
        }
    }

    async sendWhatsApp(lead, message) {
        try {
            const phone = FileUtils.formatPhoneNumber(lead.phone);
            if (!phone) {
                console.log(`❌ Invalid phone number for ${lead.name}`);
                return { success: false, error: 'Invalid phone number' };
            }

            console.log(`📱 Sending WhatsApp to ${lead.name} (${phone})`);
            console.log(`Message: ${message.substring(0, 100)}...`);
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Log untuk tracking
            const waLog = {
                leadId: lead.id,
                leadName: lead.name,
                type: 'whatsapp',
                phone: phone,
                sentAt: new Date().toISOString(),
                status: 'sent'
            };
            
            FileUtils.logActivity(waLog);
            this.messagesSent++;
            
            return { success: true, message: 'WhatsApp sent successfully' };
        } catch (error) {
            console.error(`Error sending WhatsApp to ${lead.name}:`, error);
            return { success: false, error: error.message };
        }
    }

    async bulkOutreach(leads, options = {}) {
        const {
            emailFirst = true,
            whatsappDelay = 24, // hours
            maxPerDay = 50,
            testMode = true
        } = options;

        console.log(`\n🚀 Starting bulk outreach to ${leads.length} leads`);
        console.log(`📧 Email first: ${emailFirst}`);
        console.log(`⏰ WhatsApp delay: ${whatsappDelay} hours`);
        console.log(`📊 Max per day: ${maxPerDay}`);
        console.log(`🧪 Test mode: ${testMode}`);
        
        const results = {
            emailsSent: 0,
            whatsappsSent: 0,
            errors: []
        };

        for (let i = 0; i < Math.min(leads.length, maxPerDay); i++) {
            const lead = leads[i];
            
            try {
                console.log(`\n📋 Processing lead ${i + 1}/${leads.length}: ${lead.name}`);
                
                // Send email first
                if (emailFirst && lead.possibleEmails && lead.possibleEmails.length > 0) {
                    const template = await this.generateAITemplate(lead, 'email');
                    
                    if (testMode) {
                        console.log(`[TEST MODE] Would send email to ${lead.name}`);
                        console.log(`Subject: ${template.subject}`);
                    } else {
                        const emailResult = await this.sendEmail(lead, template);
                        if (emailResult.success) results.emailsSent++;
                    }
                }
                
                // Send WhatsApp
                if (lead.phone) {
                    const waMessage = await this.generateAITemplate(lead, 'whatsapp');
                    
                    if (testMode) {
                        console.log(`[TEST MODE] Would send WhatsApp to ${lead.name}`);
                        console.log(`Phone: ${lead.phone}`);
                        console.log(`Message: ${waMessage.substring(0, 100)}...`);
                    } else {
                        const waResult = await this.sendWhatsApp(lead, waMessage);
                        if (waResult.success) results.whatsappsSent++;
                    }
                }
                
                // Delay between messages (anti-spam)
                await new Promise(resolve => setTimeout(resolve, 3000));
                
            } catch (error) {
                console.error(`Error processing ${lead.name}:`, error);
                results.errors.push({ lead: lead.name, error: error.message });
            }
        }

        console.log('\n✅ Bulk outreach completed!');
        console.log(`📧 Emails sent: ${results.emailsSent}`);
        console.log(`📱 WhatsApps sent: ${results.whatsappsSent}`);
        console.log(`❌ Errors: ${results.errors.length}`);
        
        return results;
    }

    generateDailyReport() {
        const report = {
            date: new Date().toISOString().split('T')[0],
            totalLeads: this.leads.length,
            messagesSent: this.messagesSent,
            responses: this.responses,
            conversionRate: this.responses > 0 ? (this.responses / this.messagesSent * 100).toFixed(2) : 0
        };

        console.log('\n📊 Daily Report:');
        console.log(`Date: ${report.date}`);
        console.log(`Total Leads: ${report.totalLeads}`);
        console.log(`Messages Sent: ${report.messagesSent}`);
        console.log(`Responses: ${report.responses}`);
        console.log(`Conversion Rate: ${report.conversionRate}%`);
        
        return report;
    }
}

module.exports = MarketingAutomation;