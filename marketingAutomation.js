const fs = require('fs');
const BusinessScraper = require('./index');

class MarketingAutomation {
    constructor() {
        this.leads = [];
        this.messagesSent = 0;
        this.responses = 0;
    }

    async loadLeads(jsonFile) {
        try {
            const data = fs.readFileSync(jsonFile, 'utf8');
            this.leads = JSON.parse(data);
            console.log(`Loaded ${this.leads.length} leads from ${jsonFile}`);
            return this.leads;
        } catch (error) {
            console.error('Error loading leads:', error);
            return [];
        }
    }

    // Template pesan yang dipersonalisasi
    generateEmailTemplate(lead) {
        const templates = [
            {
                subject: `Solusi Sistem Rental Mobil untuk ${lead.name}`,
                body: `Halo ${lead.name},

Saya lihat bisnis rental mobil Anda di ${lead.address} berkembang pesat. 

Sebagai pemilik bisnis rental, pasti Anda sering menghadapi tantangan:
- Pencatatan manual yang ribet
- Susah track mobil yang available
- Kesulitan manage booking customer
- Laporan keuangan yang tidak real-time

Kami punya solusi sistem rental mobil yang sudah membantu 200+ bisnis rental di Indonesia meningkatkan omzet hingga 40%.

Sistem kami include:
✅ Booking online & WhatsApp
✅ Manajemen armada real-time  
✅ Laporan otomatis
✅ Integrasi pembayaran
✅ Mobile app untuk driver

Mau saya tunjukkan demo gratis 15 menit? Bisa via video call atau langsung ke lokasi.

Best regards,
[Your Name]
[Your Company]
[Your Phone]`
            },
            {
                subject: `Tingkatkan Omzet Rental Mobil ${lead.name} dengan Sistem Digital`,
                body: `Pak/Bu ${lead.name},

Bisnis rental mobil di ${lead.address} pasti butuh sistem yang lebih efisien kan?

Bayangkan jika:
- Customer bisa booking langsung via WhatsApp
- Semua armada ter-track real-time
- Laporan profit/loss otomatis
- Tidak ada lagi double booking

Sistem kami sudah terbukti:
- Meningkatkan booking 60%
- Mengurangi admin cost 50%
- Laporan real-time daily

Gratis konsultasi & demo. Kapan bisa?

Salam,
[Your Name]
[Your Phone]`
            }
        ];

        return templates[Math.floor(Math.random() * templates.length)];
    }

    generateWhatsAppTemplate(lead) {
        const templates = [
            `Halo ${lead.name}! 👋

Saya lihat bisnis rental mobil Anda di ${lead.address}. 

Mau tanya, untuk manage booking & armada masih manual ya? 

Kami punya sistem yang bisa:
- Booking via WA otomatis
- Track semua mobil real-time
- Laporan harian otomatis

Sudah 200+ rental pakai sistem kami. Omzet naik rata-rata 40%.

Mau demo gratis 15 menit? 😊`,

            `Selamat pagi ${lead.name}! 

Bisnis rental mobil di ${lead.address} pasti butuh sistem yang lebih modern kan?

Sistem kami help:
✅ Booking online & WA
✅ Management armada  
✅ Laporan otomatis
✅ Payment gateway

ROI biasanya balik dalam 2-3 bulan.

Free demo? Kapan available? 🚗`
        ];

        return templates[Math.floor(Math.random() * templates.length)];
    }

    // Simulate email sending (replace with actual email API)
    async sendEmail(lead, template) {
        try {
            // Placeholder untuk email API (SendGrid/Mailgun/etc)
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
            
            this.logActivity(emailLog);
            this.messagesSent++;
            
            return { success: true, message: 'Email sent successfully' };
        } catch (error) {
            console.error(`Error sending email to ${lead.name}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Simulate WhatsApp sending (replace with actual WhatsApp API)
    async sendWhatsApp(lead, message) {
        try {
            const phone = this.formatPhoneNumber(lead.phone);
            if (!phone) {
                console.log(`❌ Invalid phone number for ${lead.name}`);
                return { success: false, error: 'Invalid phone number' };
            }

            console.log(`📱 Sending WhatsApp to ${lead.name} (${phone})`);
            console.log(`Message: ${message.substring(0, 100)}...`);
            
            // Placeholder untuk WhatsApp API
            // const response = await whatsappAPI.sendMessage(phone, message);
            
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
            
            this.logActivity(waLog);
            this.messagesSent++;
            
            return { success: true, message: 'WhatsApp sent successfully' };
        } catch (error) {
            console.error(`Error sending WhatsApp to ${lead.name}:`, error);
            return { success: false, error: error.message };
        }
    }

    formatPhoneNumber(phone) {
        if (!phone) return null;
        
        // Clean dan format nomor Indonesia
        let cleaned = phone.replace(/\D/g, '');
        
        if (cleaned.startsWith('62')) {
            return cleaned;
        } else if (cleaned.startsWith('0')) {
            return '62' + cleaned.substring(1);
        }
        
        return null;
    }

    logActivity(activity) {
        const logFile = 'marketing_log.json';
        let logs = [];
        
        try {
            if (fs.existsSync(logFile)) {
                logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
            }
        } catch (error) {
            console.log('Creating new log file');
        }
        
        logs.push(activity);
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
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
                if (emailFirst && lead.possibleEmails.length > 0) {
                    const template = this.generateEmailTemplate(lead);
                    
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
                    const waMessage = this.generateWhatsAppTemplate(lead);
                    
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

// Usage Example
async function runMarketingCampaign() {
    const scraper = new BusinessScraper();
    const marketing = new MarketingAutomation();
    
    try {
        console.log('🎯 Starting complete lead generation & outreach campaign...');
        
        // Step 1: Scrape fresh leads
        console.log('\n1️⃣ Scraping fresh leads...');
        await scraper.scrapeGoogleMaps('rental mobil', 'Jakarta', 20);
        await scraper.scrapeGoogleMaps('sewa mobil', 'Bandung', 15);
        
        const processedLeads = await scraper.processResults();
        const savedFiles = await scraper.saveToFile(processedLeads, 'fresh_leads');
        
        // Step 2: Load leads untuk marketing
        console.log('\n2️⃣ Loading leads for marketing...');
        const leads = await marketing.loadLeads(savedFiles.jsonFile);
        
        // Filter leads yang punya nomor telepon
        const validLeads = leads.filter(lead => lead.phone && lead.phone.length > 8);
        console.log(`Valid leads with phone: ${validLeads.length}`);
        
        // Step 3: Run bulk outreach
        console.log('\n3️⃣ Running bulk outreach...');
        const results = await marketing.bulkOutreach(validLeads, {
            emailFirst: true,
            maxPerDay: 10, // Start small
            testMode: true // Set false untuk actual sending
        });
        
        // Step 4: Generate report
        console.log('\n4️⃣ Generating report...');
        const report = marketing.generateDailyReport();
        
        console.log('\n🎉 Campaign completed successfully!');
        
    } catch (error) {
        console.error('Campaign error:', error);
    } finally {
        await scraper.close();
    }
}

// Export untuk digunakan di file lain
module.exports = MarketingAutomation;

// Jalankan jika file ini dijalankan langsung
if (require.main === module) {
    runMarketingCampaign().catch(console.error);
}