require('dotenv').config();

class MarketingAI {
    constructor() {
        this.openai = null;
        this.initOpenAI();
        this.industryTemplates = this.loadIndustryTemplates();
        this.indonesianContext = this.loadIndonesianContext();
        this.englishContext = this.loadEnglishContext();
        this.marketData = this.loadRealMarketData();
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
                industry: 'restaurant',
                painPoints: [
                    "Pesanan online hanya 23% dari total revenue (rata-rata industri 45%)",
                    "Kehilangan 67% customer karena tidak ada loyalty program",
                    "Food waste 15-20% karena inventory management manual",
                    "Customer acquisition cost naik 156% di platform delivery",
                    "Margin profit turun 8-12% karena komisi platform tinggi"
                ],
                solutions: [
                    "Sistem POS terintegrasi dengan direct online ordering (bypass komisi 20-30%)",
                    "AI-powered inventory management (reduce waste hingga 40%)",
                    "Customer loyalty program dengan WhatsApp automation",
                    "Social media marketing dengan ROI tracking",
                    "Dynamic pricing system berdasarkan demand patterns"
                ],
                benefits: [
                    "Peningkatan direct online orders 67% dalam 3 bulan",
                    "Profit margin naik 15-25% dengan reduced platform dependency",
                    "Customer retention rate meningkat 89% dengan loyalty program",
                    "Food waste berkurang 35% dengan smart inventory",
                    "Marketing ROI meningkat 234% dengan targeted campaigns"
                ],
                localContext: "Jakarta F&B market $2.8B dengan 78% konsumen order online weekly",
                urgency: "Restaurant dengan digital presence tumbuh 156% faster, 34% yang tidak adapt tutup dalam 2 tahun",
                caseStudy: "Warung Tekko Jakarta: Revenue naik 189% dalam 6 bulan setelah implementasi sistem digital"
            },
            automotive: {
                industry: 'automotive',
                painPoints: [
                    "Manual booking menyebabkan 43% missed opportunities",
                    "Downtime kendaraan 23% karena maintenance tidak terjadwal",
                    "Customer churn rate 56% karena service response lambat",
                    "Fuel cost overrun 18% tanpa route optimization",
                    "Revenue loss $2,300/bulan per vehicle karena inefficiency"
                ],
                solutions: [
                    "Automated booking system dengan real-time availability",
                    "Predictive maintenance dengan IoT sensors",
                    "WhatsApp Business API untuk instant customer support",
                    "AI route optimization untuk fuel efficiency",
                    "Dynamic pricing berdasarkan demand dan competitor analysis"
                ],
                benefits: [
                    "Booking efficiency naik 78% dengan automated system",
                    "Maintenance cost turun 34% dengan predictive scheduling",
                    "Customer satisfaction score naik dari 6.2 ke 8.7/10",
                    "Fuel cost berkurang 22% dengan smart routing",
                    "Revenue per vehicle naik $1,890/bulan average"
                ],
                localContext: "Indonesia automotive rental market $8.5B, tumbuh 23% annually dengan 89% masih manual",
                urgency: "Grab dan Gojek dominasi 67% market share, traditional players harus digitize atau kalah",
                caseStudy: "CV Maju Jaya Surabaya: Fleet utilization naik 145% setelah implementasi digital system"
            },
            retail: {
                industry: 'retail',
                painPoints: [
                    "Offline sales turun 34% sejak 2020, online hanya 12% dari total revenue",
                    "Stockout rate 28% karena inventory management manual",
                    "Customer lifetime value turun 45% tanpa personalization",
                    "Marketing spend waste 67% karena tidak ada targeting",
                    "Kehilangan 89% potential customers yang browse tapi tidak beli"
                ],
                solutions: [
                    "Omnichannel e-commerce dengan inventory sync real-time",
                    "AI-powered personalization engine untuk product recommendations",
                    "Customer data platform dengan behavioral tracking",
                    "Automated email/WhatsApp marketing dengan segmentation",
                    "Social commerce integration (Instagram Shop, TikTok Shop)"
                ],
                benefits: [
                    "Online revenue contribution naik dari 12% ke 67% dalam 8 bulan",
                    "Inventory turnover rate meningkat 156% dengan demand forecasting",
                    "Customer lifetime value naik 234% dengan personalization",
                    "Marketing ROI meningkat 445% dengan targeted campaigns",
                    "Conversion rate naik dari 1.2% ke 4.8% dengan optimization"
                ],
                localContext: "Indonesia retail market $58.3B, e-commerce penetration baru 19.6% vs global 23.4%",
                urgency: "Tokopedia, Shopee dominasi 78% online retail, independent retailers kehilangan 23% market share annually",
                caseStudy: "Toko Elektronik Medan: Revenue naik 267% dalam 1 tahun dengan omnichannel strategy"
            },
            professional: {
                industry: 'professional',
                painPoints: [
                    "Client acquisition 89% dari referral, growth terbatas 12% annually",
                    "Proposal conversion rate hanya 23% karena manual process",
                    "Time spent on admin 45% dari total working hours",
                    "Average project value stagnan karena tidak ada value positioning",
                    "Client churn 34% karena poor follow-up dan communication"
                ],
                solutions: [
                    "Professional website dengan portfolio showcase dan testimonials",
                    "CRM system dengan automated client nurturing",
                    "Online booking system dengan calendar integration",
                    "Proposal automation dengan dynamic pricing",
                    "Content marketing strategy untuk thought leadership"
                ],
                benefits: [
                    "Lead generation naik 289% dengan digital presence",
                    "Proposal win rate meningkat dari 23% ke 67%",
                    "Administrative time berkurang 56% dengan automation",
                    "Average project value naik 134% dengan better positioning",
                    "Client retention rate meningkat ke 89% dengan systematic follow-up"
                ],
                localContext: "Indonesia professional services market $22.1B, hanya 34% yang fully digital",
                urgency: "Freelancer dan agency digital tumbuh 456% post-pandemic, traditional consultants kehilangan clients",
                caseStudy: "Konsultan Hukum Jakarta: Client base naik 345% dalam 10 bulan dengan digital transformation"
            },
            healthcare: {
                industry: 'healthcare',
                painPoints: [
                    "No-show rate 34% karena appointment booking manual",
                    "Patient waiting time rata-rata 67 menit, satisfaction score 5.8/10",
                    "Administrative cost 23% dari total revenue karena paper-based",
                    "Patient follow-up rate hanya 45% karena manual tracking",
                    "Revenue loss $3,400/bulan karena scheduling inefficiency"
                ],
                solutions: [
                    "Online appointment system dengan automated reminders",
                    "Digital patient records dengan cloud backup",
                    "Telemedicine platform untuk consultation dan follow-up",
                    "WhatsApp integration untuk patient communication",
                    "Practice management system dengan billing automation"
                ],
                benefits: [
                    "No-show rate turun ke 12% dengan automated reminders",
                    "Patient satisfaction naik ke 8.9/10 dengan reduced waiting",
                    "Administrative cost berkurang 45% dengan digitalization",
                    "Patient follow-up rate naik ke 89% dengan systematic tracking",
                    "Practice revenue naik 67% dengan better scheduling efficiency"
                ],
                localContext: "Indonesia healthcare market $28.7B, telemedicine adoption naik 400% post-pandemic",
                urgency: "89% pasien expect digital services, practices tanpa digital akan kehilangan 45% patients",
                caseStudy: "Klinik Sehat Bandung: Patient volume naik 178% dengan digital appointment system"
            },
            education: {
                industry: 'education',
                painPoints: [
                    "Student retention rate hanya 67% karena engagement rendah",
                    "Administrative workload 56% dari total staff time",
                    "Course completion rate 34% tanpa proper tracking",
                    "Revenue per student stagnan karena tidak ada upselling system",
                    "Competition dengan online platforms menyebabkan 23% student loss"
                ],
                solutions: [
                    "Learning Management System dengan gamification",
                    "Student portal dengan progress tracking dan certificates",
                    "Automated administrative workflows",
                    "Hybrid learning platform dengan live dan recorded sessions",
                    "Parent communication system dengan progress reports"
                ],
                benefits: [
                    "Student retention naik ke 89% dengan engaging digital experience",
                    "Administrative efficiency meningkat 67% dengan automation",
                    "Course completion rate naik ke 78% dengan proper tracking",
                    "Revenue per student naik 145% dengan upselling opportunities",
                    "Competitive advantage dengan modern learning experience"
                ],
                localContext: "Indonesia EdTech market $12.4B, online learning penetration 78% post-pandemic",
                urgency: "Gen Z students expect digital-first education, traditional institutions kehilangan 34% enrollment",
                caseStudy: "Bimbel Sukses Jakarta: Student enrollment naik 234% dengan hybrid learning platform"
            },
            realestate: {
                industry: 'realestate',
                painPoints: [
                    "Lead conversion rate hanya 8% karena poor follow-up system",
                    "Property viewing no-show rate 45% tanpa proper scheduling",
                    "Sales cycle rata-rata 8.5 bulan, terlalu lama vs competitor 5.2 bulan",
                    "Marketing spend 67% tidak terukur ROI-nya",
                    "Client database tidak terorganisir, kehilangan 56% repeat business"
                ],
                solutions: [
                    "Property CRM dengan lead scoring dan automated nurturing",
                    "Virtual tour technology dengan 360° property showcase",
                    "WhatsApp Business integration untuk instant client communication",
                    "Market analysis dashboard dengan pricing recommendations",
                    "Social media advertising dengan retargeting campaigns"
                ],
                benefits: [
                    "Lead conversion rate naik ke 34% dengan systematic follow-up",
                    "Property viewing show-up rate naik ke 89% dengan better scheduling",
                    "Sales cycle berkurang ke 5.8 bulan dengan streamlined process",
                    "Marketing ROI meningkat 267% dengan targeted campaigns",
                    "Repeat business naik 178% dengan organized client database"
                ],
                localContext: "Indonesia property market $420B, PropTech adoption baru 34% vs global 67%",
                urgency: "99.co, Rumah123 dominasi 78% online property search, independent agents kehilangan visibility",
                caseStudy: "Property Agent Surabaya: Sales volume naik 289% dalam 1 tahun dengan digital tools"
            }
        };
    }

    loadRealMarketData() {
        return {
            indonesia: {
                digitalAdoption: "88% of Indonesians use smartphones, 77% shop online",
                ecommerceGrowth: "35% YoY growth, reaching $55B in 2024",
                paymentMethods: "GoPay (45%), OVO (32%), Dana (28%), QRIS adoption 89%",
                socialMedia: "Instagram 89M users, WhatsApp Business 50M+ SMEs",
                marketSize: {
                    restaurant: "$18.2B F&B market, 12% annual growth",
                    automotive: "$52.8B transportation, ride-sharing $8.5B",
                    retail: "$58.3B retail market, omnichannel adoption 67%",
                    healthcare: "$28.7B healthcare, telemedicine growth 400%",
                    education: "$12.4B EdTech, online learning penetration 78%",
                    realestate: "$420B property market, PropTech adoption 34%",
                    professional: "$22.1B professional services, digitalization 45%"
                },
                trends: {
                    current: "AI adoption 156%, sustainability focus 89%, local brand preference 72%",
                    emerging: "Voice commerce, social commerce, hyper-personalization",
                    challenges: "Digital literacy gaps, infrastructure variations, regulatory compliance"
                }
            },
            global: {
                digitalTransformation: "70% of companies accelerated digital initiatives post-2020",
                aiAdoption: "35% of businesses use AI for customer engagement",
                mobileCommerce: "Mobile accounts for 54% of all e-commerce traffic",
                customerExpectations: "73% expect personalized experiences, 67% want instant responses",
                marketTrends: {
                    restaurant: "$4.2T global food service, 8.7% digital ordering growth",
                    automotive: "$2.9T automotive market, 23% EV adoption rate",
                    retail: "$26.7T global retail, 19.6% e-commerce penetration",
                    healthcare: "$8.3T healthcare market, 38% digital health adoption",
                    education: "$6.2T education market, 15.3% EdTech penetration",
                    realestate: "$3.7T real estate, 12% PropTech adoption",
                    professional: "$1.8T professional services, 42% automation rate"
                }
            }
        };
    }

    loadEnglishContext() {
        return {
            businessCulture: {
                relationship: "Professional relationships built on trust and reliability",
                communication: "Direct, clear, and results-oriented communication preferred",
                decision: "Data-driven decision making with ROI focus",
                trust: "Credibility established through proven results and testimonials",
                social: "LinkedIn recommendations and case studies drive credibility"
            },
            marketTrends: {
                digital: "Mobile-first approach with 54% of traffic from mobile devices",
                ecommerce: "19.6% of retail sales happen online, growing 14.3% annually",
                social: "LinkedIn for B2B, Instagram for B2C, WhatsApp for customer service",
                payment: "Credit cards, digital wallets, and BNPL solutions dominate",
                delivery: "Same-day delivery expected, sustainability increasingly important"
            },
            challenges: {
                competition: "Intense global competition requiring differentiation",
                technology: "Rapid tech evolution demands continuous adaptation",
                regulation: "GDPR, data privacy, and compliance requirements",
                talent: "Skills gap in digital marketing and technology"
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

    async generateIndustrySpecificContent(lead, industry, yourService, campaignStyle = 'balanced', language = 'indonesian') {
        if (!this.openai) {
            throw new Error('OpenAI not configured');
        }

        const template = this.industryTemplates[industry];
        if (!template) {
            throw new Error(`Industry template not found: ${industry}`);
        }

        const prompt = this.buildIndustryPrompt(lead, template, yourService, campaignStyle, language);
        
        try {
            const completion = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt(industry, campaignStyle, language)
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 3000,
                temperature: 0.6
            });

            return this.parseIndustryResponse(completion.choices[0].message.content);
        } catch (error) {
            console.error('Error generating industry-specific content:', error);
            return null;
        }
    }

    getSystemPrompt(industry, campaignStyle, language = 'indonesian') {
        const styleInstructions = {
            conservative: {
                indonesian: "Sopan, profesional, dan membangun kepercayaan secara bertahap. Fokus pada hubungan jangka panjang.",
                english: "Respectful, professional, and build trust gradually. Focus on long-term relationship building."
            },
            balanced: {
                indonesian: "Pendekatan bisnis standar dengan keseimbangan profesionalisme dan keramahan.",
                english: "Standard business approach with balanced professionalism and approachability."
            },
            aggressive: {
                indonesian: "Langsung, ciptakan urgensi, dan fokus pada tindakan segera. Tekankan keunggulan kompetitif.",
                english: "Direct, create urgency, and focus on immediate action. Emphasize competitive advantages."
            }
        };

        const marketContext = language === 'indonesian' ? this.indonesianContext : this.englishContext;
        const marketData = this.marketData[language === 'indonesian' ? 'indonesia' : 'global'];

        if (language === 'indonesian') {
            return `Anda adalah spesialis marketing B2B Indonesia yang ahli di sektor ${industry}.

KEAHLIAN INDUSTRI: Pemahaman mendalam tentang tantangan bisnis ${industry} di Indonesia
KESADARAN BUDAYA: Gaya komunikasi bisnis Indonesia dan nuansa budaya
PASAR LOKAL: Tren terkini, tantangan, dan peluang di pasar ${industry} Indonesia

GAYA KOMUNIKASI: ${styleInstructions[campaignStyle].indonesian}

DATA PASAR REAL:
- Adopsi Digital: ${marketData.digitalAdoption}
- Pertumbuhan E-commerce: ${marketData.ecommerceGrowth}
- Metode Pembayaran: ${marketData.paymentMethods}
- Media Sosial: ${marketData.socialMedia}
- Ukuran Pasar ${industry}: ${marketData.marketSize[industry]}

PERSYARATAN:
1. Tulis dalam Bahasa Indonesia dengan istilah teknis dalam bahasa Inggris jika diperlukan
2. Gunakan gaya komunikasi bisnis Indonesia (sopan, fokus hubungan)
3. Sertakan pain points industri spesifik dan solusi
4. Referensikan konteks dan tren pasar lokal dengan data real
5. Buat value proposition yang compelling dengan statistik
6. Sertakan social proof dan indikator kredibilitas
7. Gunakan data pasar terkini untuk menciptakan urgensi
8. Fokus pada ROI dan hasil yang terukur

FORMAT OUTPUT:
Generate template EMAIL dan WHATSAPP dengan:
- Subject line yang compelling dengan statistik
- Pain points industri spesifik dengan data
- Solusi yang disesuaikan dengan benefit terukur
- Konteks pasar lokal dengan tren terkini
- Call-to-action yang jelas dan mendesak
- Tone profesional namun approachable
- Social proof dan case study reference`;
        } else {
            return `You are an expert B2B marketing specialist focused on the ${industry} sector.

INDUSTRY EXPERTISE: Deep understanding of ${industry} business challenges globally
CULTURAL AWARENESS: International business communication and cultural nuances
MARKET INTELLIGENCE: Current trends, challenges, and opportunities in global ${industry} market

COMMUNICATION STYLE: ${styleInstructions[campaignStyle].english}

REAL MARKET DATA:
- Digital Transformation: ${marketData.digitalTransformation}
- AI Adoption: ${marketData.aiAdoption}
- Mobile Commerce: ${marketData.mobileCommerce}
- Customer Expectations: ${marketData.customerExpectations}
- ${industry} Market Size: ${marketData.marketTrends[industry]}

REQUIREMENTS:
1. Write in professional English with industry-specific terminology
2. Use international business communication style (direct, results-focused)
3. Include specific industry pain points with supporting data
4. Reference global market context and trends with real statistics
5. Create compelling value propositions with measurable benefits
6. Include social proof and credibility indicators
7. Use current market data to create urgency
8. Focus on ROI and measurable outcomes

OUTPUT FORMAT:
Generate both EMAIL and WHATSAPP templates with:
- Compelling subject lines with statistics
- Industry-specific pain points backed by data
- Tailored solutions with quantified benefits
- Global market context with current trends
- Clear and urgent call-to-action
- Professional and results-oriented tone
- Social proof and case study references`;
        }
    }

    buildIndustryPrompt(lead, template, yourService, campaignStyle, language = 'indonesian') {
        const marketData = this.marketData[language === 'indonesian' ? 'indonesia' : 'global'];
        const context = language === 'indonesian' ? this.indonesianContext : this.englishContext;
        
        if (language === 'indonesian') {
            return `Buat konten marketing yang dipersonalisasi untuk bisnis ${template.localContext} ini:

DETAIL BISNIS:
- Nama: ${lead.name}
- Alamat: ${lead.address}
- Telepon: ${lead.phone}
- Rating: ${lead.rating || 'N/A'}
- Website: ${lead.website || 'Belum ada website'}

LAYANAN ANDA: ${yourService}

KONTEKS INDUSTRI:
Pain Points: ${template.painPoints.join(', ')}
Solusi: ${template.solutions.join(', ')}
Manfaat: ${template.benefits.join(', ')}
Konteks Lokal: ${template.localContext}
Urgensi Pasar: ${template.urgency}

DATA PASAR REAL:
- Ukuran Pasar: ${marketData.marketSize[template.industry] || marketData.marketSize.professional}
- Tren Terkini: ${marketData.trends.current}
- Tantangan: ${marketData.trends.challenges}

BUDAYA BISNIS INDONESIA:
- Komunikasi fokus pada hubungan
- Kepercayaan dan kredibilitas sangat penting
- Social proof berpengaruh signifikan
- WhatsApp adalah komunikasi bisnis utama
- Pemahaman pasar lokal sangat krusial

GAYA KAMPANYE: ${campaignStyle}

Harap generate:
1. TEMPLATE EMAIL dengan subject line yang compelling dan statistik
2. TEMPLATE WHATSAPP untuk follow-up yang casual

Buat spesifik untuk bisnis mereka, sertakan konteks Indonesia dengan data real, dan ciptakan urgensi berdasarkan tren pasar terkini. Gunakan statistik dan data untuk meningkatkan kredibilitas.`;
        } else {
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

REAL MARKET DATA:
- Market Size: ${marketData.marketTrends[template.industry] || marketData.marketTrends.professional}
- Digital Transformation: ${marketData.digitalTransformation}
- Customer Expectations: ${marketData.customerExpectations}

BUSINESS CULTURE:
- Results-oriented communication
- Trust built through proven ROI
- Data-driven decision making
- Professional networking important
- Global market understanding crucial

CAMPAIGN STYLE: ${campaignStyle}

Please generate:
1. EMAIL TEMPLATE with compelling subject line and statistics
2. WHATSAPP TEMPLATE for professional follow-up

Make it specific to their business, include relevant market data, and create urgency based on current trends. Use statistics and data to increase credibility and conversion probability.`;
        }
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

    async generateMultiTouchSequence(lead, industry, yourService, language = 'indonesian') {
        const sequences = {
            email1: await this.generateIndustrySpecificContent(lead, industry, yourService, 'conservative', language),
            email2: await this.generateFollowUpContent(lead, industry, yourService, 'balanced', language),
            email3: await this.generateClosingContent(lead, industry, yourService, 'aggressive', language),
            whatsapp: await this.generateIndustrySpecificContent(lead, industry, yourService, 'balanced', language)
        };

        return sequences;
    }

    async generateFollowUpContent(lead, industry, yourService, style, language = 'indonesian') {
        if (!this.openai) {
            throw new Error('OpenAI not configured');
        }

        const template = this.industryTemplates[industry];
        const marketData = this.marketData[language === 'indonesian' ? 'indonesia' : 'global'];
        
        const prompt = language === 'indonesian' ?
            `Buat email follow-up untuk ${lead.name} di industri ${industry}.
            Ini adalah touch point KEDUA - asumsikan mereka sudah melihat email pertama.
            Fokus pada case studies, social proof, dan manfaat spesifik dengan data.
            Layanan: ${yourService}
            Gaya: ${style}
            Sertakan contoh pasar Indonesia dan success stories dengan statistik real.
            Data pasar: ${marketData.marketSize[industry]}
            Gunakan urgency berdasarkan tren: ${marketData.trends.current}` :
            `Create a follow-up email for ${lead.name} in ${industry} industry.
            This is the SECOND touch point - assume they've seen your first email.
            Focus on case studies, social proof, and specific benefits with data.
            Service: ${yourService}
            Style: ${style}
            Include market examples and success stories with real statistics.
            Market data: ${marketData.marketTrends[industry]}
            Use urgency based on trends: ${marketData.digitalTransformation}`;

        try {
            const completion = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt(industry, style, language) +
                                "\n\nFOCUS: This is a FOLLOW-UP email. Include case studies, testimonials, and specific ROI examples."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 3000,
                temperature: 0.6
            });

            return this.parseIndustryResponse(completion.choices[0].message.content);
        } catch (error) {
            console.error('Error generating follow-up content:', error);
            return null;
        }
    }

    async generateClosingContent(lead, industry, yourService, style, language = 'indonesian') {
        if (!this.openai) {
            throw new Error('OpenAI not configured');
        }

        const template = this.industryTemplates[industry];
        const marketData = this.marketData[language === 'indonesian' ? 'indonesia' : 'global'];
        
        const prompt = language === 'indonesian' ?
            `Buat email closing untuk ${lead.name} di industri ${industry}.
            Ini adalah touch point TERAKHIR - ciptakan urgensi dan langkah selanjutnya yang jelas.
            Sertakan penawaran terbatas waktu, risk reversal, dan CTA yang kuat.
            Layanan: ${yourService}
            Gaya: ${style}
            Buat compelling untuk decision makers bisnis Indonesia dengan data konkret.
            Gunakan statistik: ${marketData.marketSize[industry]}
            Tekankan kerugian jika tidak bertindak sekarang.` :
            `Create a closing email for ${lead.name} in ${industry} industry.
            This is the FINAL touch point - create urgency and clear next steps.
            Include limited-time offers, risk reversal, and strong CTA.
            Service: ${yourService}
            Style: ${style}
            Make it compelling for business decision makers with concrete data.
            Use statistics: ${marketData.marketTrends[industry]}
            Emphasize the cost of inaction.`;

        try {
            const completion = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt(industry, style, language) +
                                "\n\nFOCUS: This is a CLOSING email. Create maximum urgency, include guarantees, and make the next step crystal clear."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 3000,
                temperature: 0.6
            });

            return this.parseIndustryResponse(completion.choices[0].message.content);
        } catch (error) {
            console.error('Error generating closing content:', error);
            return null;
        }
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

    getMarketSize(industry, language = 'indonesian') {
        const marketData = {
            indonesian: {
                restaurant: "$18.2B industri F&B Indonesia dengan pertumbuhan 12% annually",
                automotive: "$52.8B sektor transportasi, ride-sharing $8.5B",
                retail: "$58.3B pasar retail, e-commerce penetrasi 19.6%",
                professional: "$22.1B layanan profesional, digitalisasi 45%",
                healthcare: "$28.7B pasar healthcare, telemedicine tumbuh 400%",
                education: "$12.4B EdTech, penetrasi online learning 78%",
                realestate: "$420B pasar properti, PropTech adoption 34%"
            },
            english: {
                restaurant: "$4.2T global food service market, 8.7% digital ordering growth",
                automotive: "$2.9T automotive market, 23% EV adoption rate",
                retail: "$26.7T global retail, 19.6% e-commerce penetration",
                professional: "$1.8T professional services, 42% automation rate",
                healthcare: "$8.3T healthcare market, 38% digital health adoption",
                education: "$6.2T education market, 15.3% EdTech penetration",
                realestate: "$3.7T real estate market, 12% PropTech adoption"
            }
        };

        const langData = marketData[language] || marketData.indonesian;
        return langData[industry] || (language === 'indonesian' ?
            "Peluang pasar Indonesia yang berkembang" :
            "Growing market opportunity");
    }

    // New method to get available languages
    getAvailableLanguages() {
        return [
            { code: 'indonesian', name: 'Bahasa Indonesia', flag: '🇮🇩' },
            { code: 'english', name: 'English', flag: '🇺🇸' }
        ];
    }

    // New method to get campaign styles with descriptions
    getCampaignStyles(language = 'indonesian') {
        if (language === 'indonesian') {
            return [
                {
                    code: 'conservative',
                    name: 'Konservatif',
                    description: 'Sopan, profesional, membangun kepercayaan bertahap'
                },
                {
                    code: 'balanced',
                    name: 'Seimbang',
                    description: 'Pendekatan standar dengan keseimbangan profesional dan ramah'
                },
                {
                    code: 'aggressive',
                    name: 'Agresif',
                    description: 'Langsung, menciptakan urgensi, fokus tindakan segera'
                }
            ];
        } else {
            return [
                {
                    code: 'conservative',
                    name: 'Conservative',
                    description: 'Respectful, professional, gradual trust building'
                },
                {
                    code: 'balanced',
                    name: 'Balanced',
                    description: 'Standard business approach with professional friendliness'
                },
                {
                    code: 'aggressive',
                    name: 'Aggressive',
                    description: 'Direct, urgent, immediate action focused'
                }
            ];
        }
    }

    // Enhanced method to get industry list with descriptions
    getAvailableIndustries(language = 'indonesian') {
        const industries = Object.keys(this.industryTemplates);
        
        const descriptions = {
            indonesian: {
                restaurant: 'Restoran & F&B',
                automotive: 'Otomotif & Transportasi',
                retail: 'Retail & E-commerce',
                professional: 'Jasa Profesional',
                healthcare: 'Kesehatan & Klinik',
                education: 'Pendidikan & Kursus',
                realestate: 'Properti & Real Estate'
            },
            english: {
                restaurant: 'Restaurant & F&B',
                automotive: 'Automotive & Transportation',
                retail: 'Retail & E-commerce',
                professional: 'Professional Services',
                healthcare: 'Healthcare & Clinics',
                education: 'Education & Training',
                realestate: 'Real Estate & Property'
            }
        };

        const langDesc = descriptions[language] || descriptions.indonesian;
        
        return industries.map(industry => ({
            code: industry,
            name: langDesc[industry] || industry,
            marketSize: this.getMarketSize(industry, language)
        }));
    }

    // Method to validate and enhance lead data
    validateAndEnhanceLead(lead) {
        const enhanced = {
            name: lead.name || 'Business Owner',
            address: lead.address || 'Indonesia',
            phone: lead.phone || 'N/A',
            rating: lead.rating || 'N/A',
            website: lead.website || null,
            // Add enhancement based on available data
            businessSize: this.estimateBusinessSize(lead),
            digitalMaturity: this.assessDigitalMaturity(lead),
            urgencyScore: this.calculateUrgencyScore(lead)
        };

        return enhanced;
    }

    estimateBusinessSize(lead) {
        // Simple heuristic based on available data
        if (lead.website && lead.rating > 4.0) return 'medium-large';
        if (lead.website || lead.rating > 3.5) return 'small-medium';
        return 'small';
    }

    assessDigitalMaturity(lead) {
        let score = 0;
        if (lead.website) score += 3;
        if (lead.rating && lead.rating > 4.0) score += 2; // Good online presence
        if (lead.phone && lead.phone.includes('WhatsApp')) score += 1;
        
        if (score >= 4) return 'high';
        if (score >= 2) return 'medium';
        return 'low';
    }

    calculateUrgencyScore(lead) {
        let urgency = 5; // Base urgency
        
        // Increase urgency for businesses that need digital transformation
        if (!lead.website) urgency += 3;
        if (lead.rating && lead.rating < 3.5) urgency += 2;
        
        return Math.min(urgency, 10); // Cap at 10
    }
}

module.exports = MarketingAI;