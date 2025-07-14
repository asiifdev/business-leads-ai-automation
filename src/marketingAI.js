require('dotenv').config();

class MarketingAI {
    constructor() {
        this.openai = null;
        this.initOpenAI();
        this.industryTemplates = this.loadIndustryTemplates();
        this.indonesianContext = this.loadIndonesianContext();
    }

    initOpenAI() {
        try {
            const OpenAI = require('openai');
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
            console.log('✅ Enhanced Marketing AI initialized');
        } catch (error) {
            console.error('❌ Error initializing OpenAI:', error.message);
        }
    }

    loadIndustryTemplates() {
        return {
            restaurant: {
                painPoints: [
                    "Pesanan online yang masih rendah",
                    "Kompetisi ketat dengan platform delivery",
                    "Manajemen inventory yang tidak efisien",
                    "Customer retention yang rendah",
                    "Promosi yang tidak targeted"
                ],
                solutions: [
                    "Sistem POS terintegrasi dengan online ordering",
                    "Digital menu dan QR code ordering",
                    "Customer loyalty program",
                    "Social media marketing automation",
                    "Inventory management system"
                ],
                benefits: [
                    "Peningkatan penjualan online hingga 40%",
                    "Efisiensi operasional restaurant",
                    "Database customer untuk repeat order",
                    "Analisis data penjualan real-time"
                ],
                localContext: "Jakarta food scene yang kompetitif dengan platform seperti GoFood dan GrabFood",
                urgency: "Sektor F&B Indonesia tumbuh 12% per tahun, jangan sampai tertinggal"
            },
            automotive: {
                painPoints: [
                    "Booking manual yang tidak efisien",
                    "Tracking armada yang sulit",
                    "Customer service yang lambat",
                    "Maintenance schedule yang berantakan",
                    "Kompetisi dengan platform ride-sharing"
                ],
                solutions: [
                    "Sistem booking online otomatis",
                    "GPS tracking dan fleet management",
                    "WhatsApp Business API integration",
                    "Maintenance reminder system",
                    "Dynamic pricing system"
                ],
                benefits: [
                    "Efficiency peningkatan 60% dalam booking",
                    "Reduced operational cost hingga 30%",
                    "Better customer satisfaction",
                    "Real-time fleet monitoring"
                ],
                localContext: "Pasar rental mobil Indonesia yang berkembang pesat dengan demand tinggi",
                urgency: "Industri transportasi Indonesia bernilai $50+ miliar, saatnya go digital"
            },
            retail: {
                painPoints: [
                    "Penjualan offline yang menurun",
                    "Tidak ada presence online",
                    "Inventory yang tidak real-time",
                    "Customer data yang tidak terorganisir",
                    "Kompetisi dengan e-commerce besar"
                ],
                solutions: [
                    "E-commerce website dan mobile app",
                    "Omnichannel retail strategy",
                    "Real-time inventory system",
                    "Customer relationship management",
                    "Digital marketing campaign"
                ],
                benefits: [
                    "Ekspansi market reach hingga 300%",
                    "Peningkatan sales conversion",
                    "Better customer insights",
                    "Automated marketing campaigns"
                ],
                localContext: "E-commerce Indonesia tumbuh 35% per tahun, mencapai $55 miliar",
                urgency: "77% konsumen Indonesia belanja online, jangan sampai kehilangan market share"
            },
            professional: {
                painPoints: [
                    "Klien terbatas pada referral",
                    "Tidak ada online presence",
                    "Manual client management",
                    "Sulit showcase portfolio",
                    "Pricing yang tidak kompetitif"
                ],
                solutions: [
                    "Professional website dan portfolio",
                    "Client management system",
                    "Online consultation booking",
                    "Digital marketing strategy",
                    "Automated proposal system"
                ],
                benefits: [
                    "Jangkauan klien yang lebih luas",
                    "Professional brand image",
                    "Streamlined business process",
                    "Higher conversion rate"
                ],
                localContext: "Sektor jasa profesional Indonesia berkembang dengan digitalisasi UMKM",
                urgency: "Government mendorong transformasi digital untuk semua sektor bisnis"
            },
            healthcare: {
                painPoints: [
                    "Appointment booking yang manual",
                    "Antrian pasien yang panjang",
                    "Medical record yang tidak digital",
                    "Communication dengan pasien terbatas",
                    "Administrative work yang berlebihan"
                ],
                solutions: [
                    "Online appointment system",
                    "Digital patient management",
                    "Telemedicine platform",
                    "Automated reminder system",
                    "Electronic medical records"
                ],
                benefits: [
                    "Reduced waiting time hingga 50%",
                    "Better patient satisfaction",
                    "Streamlined operations",
                    "Improved medical service quality"
                ],
                localContext: "Healthcare digital transformation Indonesia didukung program pemerintah",
                urgency: "Post-pandemic, 80% pasien prefer digital health services"
            },
            education: {
                painPoints: [
                    "Sistem pembelajaran yang outdated",
                    "Student engagement yang rendah",
                    "Administrative work yang manual",
                    "Tidak ada online learning option",
                    "Student progress tracking yang sulit"
                ],
                solutions: [
                    "Learning management system",
                    "Online course platform",
                    "Student information system",
                    "Virtual classroom technology",
                    "Progress tracking dashboard"
                ],
                benefits: [
                    "Flexible learning options",
                    "Better student engagement",
                    "Automated administrative tasks",
                    "Comprehensive progress tracking"
                ],
                localContext: "EdTech Indonesia tumbuh 400% selama pandemic, trend akan continue",
                urgency: "Generation Z dan Alpha adalah digital natives, adapt or lose students"
            },
            realestate: {
                painPoints: [
                    "Lead generation yang terbatas",
                    "Property showcase yang tidak menarik",
                    "Client follow-up yang manual",
                    "Market analysis yang sulit",
                    "Competition dengan portal besar"
                ],
                solutions: [
                    "Property management CRM",
                    "Virtual property tours",
                    "Lead nurturing automation",
                    "Market analysis tools",
                    "Targeted digital advertising"
                ],
                benefits: [
                    "Qualified leads increase 200%",
                    "Faster property sales cycle",
                    "Better client relationship",
                    "Data-driven market insights"
                ],
                localContext: "Properti Indonesia nilainya $400+ miliar dengan pertumbuhan steady",
                urgency: "Digital property platforms mendominasi, traditional agents harus adapt"
            }
        };
    }

    loadIndonesianContext() {
        return {
            businessCulture: {
                relationship: "Hubungan personal sangat penting dalam bisnis Indonesia",
                communication: "Komunikasi tidak langsung dan sopan lebih disukai",
                decision: "Keputusan bisnis often melibatkan family atau partner",
                trust: "Trust building adalah kunci sukses berbisnis",
                social: "Social proof dan testimonial sangat berpengaruh"
            },
            marketTrends: {
                digital: "88% populasi Indonesia menggunakan smartphone",
                ecommerce: "E-commerce tumbuh 35% per tahun",
                social: "Instagram dan WhatsApp adalah platform utama",
                payment: "GoPay, OVO, Dana adalah metode pembayaran populer",
                delivery: "Same-day delivery sudah menjadi expectation"
            },
            challenges: {
                infrastructure: "Internet speed varies across regions",
                education: "Digital literacy masih developing",
                regulation: "Government regulations untuk digital business",
                competition: "Foreign dan local companies compete intensely"
            }
        };
    }

    async generateIndustrySpecificContent(lead, industry, yourService, campaignStyle = 'balanced') {
        if (!this.openai) {
            throw new Error('OpenAI not configured');
        }

        const template = this.industryTemplates[industry];
        if (!template) {
            throw new Error(`Industry template not found: ${industry}`);
        }

        const prompt = this.buildIndustryPrompt(lead, template, yourService, campaignStyle);
        
        try {
            const completion = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt(industry, campaignStyle)
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 2000,
                temperature: 0.7
            });

            return this.parseIndustryResponse(completion.choices[0].message.content);
        } catch (error) {
            console.error('Error generating industry-specific content:', error);
            return null;
        }
    }

    getSystemPrompt(industry, campaignStyle) {
        const styleInstructions = {
            conservative: "Be respectful, professional, and build trust slowly. Focus on relationship building.",
            balanced: "Use standard business approach with good balance of professionalism and friendliness.",
            aggressive: "Be direct, create urgency, and focus on immediate action. Highlight competitive advantages."
        };

        return `You are an expert Indonesian B2B marketing specialist focused on ${industry} sector.

INDUSTRY EXPERTISE: Deep understanding of ${industry} business challenges in Indonesia
CULTURAL AWARENESS: Indonesian business communication style and cultural nuances
LOCAL MARKET: Current trends, challenges, and opportunities in Indonesian ${industry} market

COMMUNICATION STYLE: ${styleInstructions[campaignStyle]}

REQUIREMENTS:
1. Write in Bahasa Indonesia with occasional English terms for technical concepts
2. Use Indonesian business communication style (polite, relationship-focused)
3. Include specific industry pain points and solutions
4. Reference local market context and trends
5. Create compelling value propositions
6. Include social proof and credibility indicators

OUTPUT FORMAT:
Generate both EMAIL and WHATSAPP templates with:
- Compelling subject lines
- Industry-specific pain points
- Tailored solutions
- Local market context
- Clear call-to-action
- Professional yet approachable tone`;
    }

    buildIndustryPrompt(lead, template, yourService, campaignStyle) {
        return `Create personalized marketing content for this ${template.localContext} business:

BUSINESS DETAILS:
- Name: ${lead.name}
- Address: ${lead.address}
- Phone: ${lead.phone}
- Rating: ${lead.rating || 'N/A'}
- Website: ${lead.website || 'No website'}

YOUR SERVICE: ${yourService}

INDUSTRY CONTEXT:
Pain Points: ${template.painPoints.join(', ')}
Solutions: ${template.solutions.join(', ')}
Benefits: ${template.benefits.join(', ')}
Local Context: ${template.localContext}
Market Urgency: ${template.urgency}

INDONESIAN BUSINESS CULTURE:
- Relationship-focused communication
- Trust and credibility are essential
- Social proof matters significantly
- WhatsApp is primary business communication
- Local market understanding is crucial

CAMPAIGN STYLE: ${campaignStyle}

Please generate:
1. EMAIL TEMPLATE with compelling subject line
2. WHATSAPP TEMPLATE for casual follow-up

Make it specific to their business, include local Indonesian context, and create urgency based on market trends.`;
    }

    parseIndustryResponse(response) {
        const sections = response.split(/(?:EMAIL TEMPLATE|WHATSAPP TEMPLATE)/i);
        
        let emailContent = '';
        let whatsappContent = '';
        
        if (sections.length >= 2) {
            emailContent = sections[1]?.trim() || '';
            whatsappContent = sections[2]?.trim() || '';
        } else {
            // Fallback if format is different
            const lines = response.split('\n');
            let currentSection = '';
            
            for (const line of lines) {
                if (line.toLowerCase().includes('email')) {
                    currentSection = 'email';
                    continue;
                } else if (line.toLowerCase().includes('whatsapp')) {
                    currentSection = 'whatsapp';
                    continue;
                }
                
                if (currentSection === 'email' && line.trim()) {
                    emailContent += line + '\n';
                } else if (currentSection === 'whatsapp' && line.trim()) {
                    whatsappContent += line + '\n';
                }
            }
        }

        return {
            email: this.cleanTemplate(emailContent),
            whatsapp: this.cleanTemplate(whatsappContent),
            industry: true,
            generated: new Date().toISOString()
        };
    }

    cleanTemplate(content) {
        return content
            .replace(/^[^\w\n]*/, '') // Remove leading non-word characters
            .replace(/EMAIL TEMPLATE:?/gi, '')
            .replace(/WHATSAPP TEMPLATE:?/gi, '')
            .trim();
    }

    async generateMultiTouchSequence(lead, industry, yourService) {
        const sequences = {
            email1: await this.generateIndustrySpecificContent(lead, industry, yourService, 'conservative'),
            email2: await this.generateFollowUpContent(lead, industry, yourService, 'balanced'),
            email3: await this.generateClosingContent(lead, industry, yourService, 'aggressive'),
            whatsapp: await this.generateIndustrySpecificContent(lead, industry, yourService, 'balanced')
        };

        return sequences;
    }

    async generateFollowUpContent(lead, industry, yourService, style) {
        const prompt = `Create a follow-up email for ${lead.name} in ${industry} industry.
        This is the SECOND touch point - assume they've seen your first email.
        Focus on case studies, social proof, and specific benefits.
        Service: ${yourService}
        Style: ${style}
        Include Indonesian market examples and success stories.`;

        // Similar implementation to generateIndustrySpecificContent
        // but with follow-up specific prompting
        return await this.generateIndustrySpecificContent(lead, industry, yourService, style);
    }

    async generateClosingContent(lead, industry, yourService, style) {
        const prompt = `Create a closing email for ${lead.name} in ${industry} industry.
        This is the FINAL touch point - create urgency and clear next steps.
        Include limited-time offers, risk reversal, and strong CTA.
        Service: ${yourService}
        Style: ${style}
        Make it compelling for Indonesian business decision makers.`;

        // Similar implementation with closing-specific prompting
        return await this.generateIndustrySpecificContent(lead, industry, yourService, style);
    }

    getIndustryInsights(industry) {
        const template = this.industryTemplates[industry];
        if (!template) return null;

        return {
            painPoints: template.painPoints,
            solutions: template.solutions,
            benefits: template.benefits,
            localContext: template.localContext,
            urgency: template.urgency,
            marketSize: this.getMarketSize(industry)
        };
    }

    getMarketSize(industry) {
        const marketData = {
            restaurant: "$15+ billion F&B industry in Indonesia",
            automotive: "$50+ billion transportation sector",
            retail: "$55+ billion e-commerce market",
            professional: "$20+ billion professional services",
            healthcare: "$25+ billion healthcare market",
            education: "$10+ billion education technology",
            realestate: "$400+ billion property market"
        };

        return marketData[industry] || "Growing Indonesian market opportunity";
    }
}

module.exports = MarketingAI;