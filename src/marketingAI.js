require('dotenv').config();
const https = require('https');
const { getClient, getModel } = require('./openaiClient');
const { getBusinessInfoForPrompt, getProfile } = require('./businessProfile');

// --- Web Research (Tavily API) ---
// Set TAVILY_API_KEY in .env to enable real-time industry research before content generation.
// Falls back gracefully (no research context) if key is missing.
async function fetchTavilySearch(query) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return null;

    return new Promise((resolve) => {
        const body = JSON.stringify({
            api_key: apiKey,
            query,
            search_depth: 'basic',
            max_results: 5,
            include_answer: true
        });

        const req = https.request({
            hostname: 'api.tavily.com',
            path: '/search',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const answer = json.answer || '';
                    const snippets = (json.results || []).slice(0, 3).map(r => `- ${r.title}: ${r.content?.substring(0, 200)}`).join('\n');
                    resolve([answer, snippets].filter(Boolean).join('\n'));
                } catch (_) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(8000, () => { req.destroy(); resolve(null); });
        req.write(body);
        req.end();
    });
}

async function researchIndustryContext(lead) {
    const industryHint = lead.category || lead.industry || '';
    const location = (lead.address || '').split(',').pop()?.trim() || '';
    const query = `${industryHint ? industryHint + ' industry' : lead.name + ' business'} trends challenges opportunities ${location} 2024 2025`.trim();

    const result = await fetchTavilySearch(query);
    if (!result) return '';
    return `\n\nREAL-TIME INDUSTRY CONTEXT (from web research):\n${result}`;
}

class MarketingAI {
    constructor() {
        this.openai = getClient();
    }

    // Main entry point: fully AI-driven, no hardcoded industry data.
    // AI analyzes the lead itself and generates personalized outreach for 5 platforms.
    // If TAVILY_API_KEY is set, fetches real-time industry context first.
    async generateContent(lead, userService, options = {}) {
        if (!this.openai) throw new Error('OpenAI not configured');

        const profile = getProfile();
        const language = options.language || profile?.preferences?.language || 'indonesian';
        const style = options.style || profile?.preferences?.campaignStyle || 'balanced';
        const biz = getBusinessInfoForPrompt();

        // Optionally enrich with real-time web research context
        const researchContext = options.skipResearch ? '' : await researchIndustryContext(lead);

        const messages = [
            { role: 'system', content: this._systemPrompt(language, style, biz) },
            { role: 'user', content: this._userPrompt(lead, userService || biz.description, language, researchContext) }
        ];

        try {
            const completion = await this.openai.chat.completions.create({
                model: getModel(),
                messages,
                response_format: { type: 'json_object' },
                max_tokens: 4000,
                temperature: 0.7
            });
            return JSON.parse(completion.choices[0].message.content);
        } catch (err) {
            // Fallback for models that don't support json_object response format
            if (err.message && err.message.includes('response_format')) {
                const fallback = await this.openai.chat.completions.create({
                    model: getModel(),
                    messages,
                    max_tokens: 4000,
                    temperature: 0.7
                });
                return this._parseTextResponse(fallback.choices[0].message.content);
            }
            throw err;
        }
    }

    _systemPrompt(language, style, biz) {
        const STYLE = {
            conservative: {
                indonesian: 'Sopan dan membangun kepercayaan secara bertahap, fokus hubungan jangka panjang',
                english: 'Respectful and trust-building, long-term relationship focused'
            },
            aggressive: {
                indonesian: 'Langsung, ciptakan urgensi, fokus pada aksi segera',
                english: 'Direct, create urgency, focus on immediate action'
            },
            balanced: {
                indonesian: 'Profesional namun approachable, langsung ke value tanpa terlalu hard-sell',
                english: 'Professional yet approachable, direct about value without being pushy'
            }
        };
        const styleGuide = (STYLE[style] || STYLE.balanced)[language === 'indonesian' ? 'indonesian' : 'english'];

        if (language === 'indonesian') {
            return `Kamu adalah spesialis marketing B2B Indonesia yang sangat berpengalaman.

BISNIS YANG KAMU WAKILI:
- Nama: ${biz.name || 'Tidak diset'}
- Layanan/Produk: ${biz.description || userService}
- Telepon: ${biz.phone || '-'}
- Email: ${biz.email || '-'}
- Website: ${biz.website || '-'}
${biz.valuePropositions?.length ? `- Keunggulan: ${biz.valuePropositions.join(', ')}` : ''}

GAYA KOMUNIKASI: ${styleGuide}

TUGAS:
Dari data bisnis target yang diberikan, analisis secara mendalam:
1. Identifikasi jenis industri mereka
2. Tentukan pain points spesifik mereka (berdasarkan konteks: lokasi, rating, punya/tidak punya website, dll)
3. Buat 5 template outreach yang SANGAT personal — terasa dibuat khusus untuk bisnis ini

ATURAN PENTING:
- Gunakan nama bisnis target secara spesifik di setiap template
- Jangan tulis template generik yang bisa berlaku untuk siapa saja
- Manfaatkan detail spesifik: rating mereka, lokasi, apakah punya website atau tidak
- Jika tidak punya website — jadikan itu pain point dan peluang
- Jika rating tinggi — akui itu dan jadikan opening yang relevan

OUTPUT HARUS BERUPA JSON VALID dengan struktur ini:
{
  "industry": "nama industri yang teridentifikasi",
  "painPoints": ["pain point 1 spesifik", "pain point 2 spesifik"],
  "email": {
    "subject": "subject line yang compelling",
    "body": "isi email lengkap"
  },
  "whatsapp": "pesan WhatsApp (max 250 kata, casual tapi profesional)",
  "linkedin": {
    "connectionNote": "pesan connection request (max 300 karakter)",
    "followUpInMail": "follow-up InMail setelah terkoneksi"
  },
  "instagram": "pesan DM Instagram (max 120 kata, casual dan relatable)",
  "coldCall": {
    "opening": "skrip 30 detik pertama",
    "valueProp": "value proposition utama",
    "objectionHandling": {"keberatan umum": "respons yang tepat"},
    "closing": "skrip penutupan dan next step"
  }
}`;
        }

        return `You are a highly experienced B2B marketing specialist.

YOUR BUSINESS:
- Name: ${biz.name || 'Not set'}
- Service/Product: ${biz.description || ''}
- Phone: ${biz.phone || '-'}
- Email: ${biz.email || '-'}
- Website: ${biz.website || '-'}
${biz.valuePropositions?.length ? `- Key advantages: ${biz.valuePropositions.join(', ')}` : ''}

COMMUNICATION STYLE: ${styleGuide}

TASK:
From the provided target business data, deeply analyze:
1. Identify their industry
2. Determine their specific pain points (based on context: location, rating, has/no website, etc.)
3. Create 5 outreach templates that feel GENUINELY personal — like they were made only for this business

IMPORTANT RULES:
- Use the target business name specifically in every template
- No generic templates that could apply to anyone
- Leverage specific details: their rating, location, whether they have a website
- No website = make that the pain point and the opportunity
- High rating = acknowledge it and make it a relevant conversation opener

OUTPUT MUST BE VALID JSON with this structure:
{
  "industry": "identified industry name",
  "painPoints": ["specific pain point 1", "specific pain point 2"],
  "email": {
    "subject": "compelling subject line",
    "body": "full email body"
  },
  "whatsapp": "WhatsApp message (max 250 words, casual but professional)",
  "linkedin": {
    "connectionNote": "connection request message (max 300 chars)",
    "followUpInMail": "follow-up InMail after connecting"
  },
  "instagram": "Instagram DM (max 120 words, casual and relatable)",
  "coldCall": {
    "opening": "first 30-second script",
    "valueProp": "core value proposition",
    "objectionHandling": {"common objection": "appropriate response"},
    "closing": "closing script and next steps"
  }
}`;
    }

    _userPrompt(lead, userService, language, researchContext = '') {
        const websiteStatus = (lead.hasWebsite || lead.website)
            ? (language === 'indonesian' ? `Punya website: ${lead.website}` : `Has website: ${lead.website}`)
            : (language === 'indonesian' ? 'TIDAK punya website (peluang besar!)' : 'NO website (big opportunity!)');

        if (language === 'indonesian') {
            return `Buat outreach untuk bisnis berikut:

Nama Bisnis: ${lead.name}
Alamat: ${lead.address || 'Tidak tersedia'}
Nomor Telepon: ${lead.phone || 'Tidak tersedia'}
Rating Google: ${lead.rating || 'Belum ada rating'}
${websiteStatus}

LAYANAN YANG DITAWARKAN: ${userService}${researchContext}

Analisis bisnis ini, identifikasi industri dan tantangan unik mereka, lalu buat 5 template outreach yang sangat personal dan relevan untuk ${lead.name}.`;
        }

        return `Create outreach for this business:

Business Name: ${lead.name}
Address: ${lead.address || 'Not available'}
Phone: ${lead.phone || 'Not available'}
Google Rating: ${lead.rating || 'No rating yet'}
${websiteStatus}

SERVICE BEING OFFERED: ${userService}${researchContext}

Analyze this business, identify their industry and unique challenges, then create 5 highly personal and relevant outreach templates specifically for ${lead.name}.`;
    }

    // Fallback parser for models that return plain text instead of JSON
    _parseTextResponse(text) {
        const result = {
            industry: '',
            painPoints: [],
            email: { subject: '', body: '' },
            whatsapp: '',
            linkedin: { connectionNote: '', followUpInMail: '' },
            instagram: '',
            coldCall: { opening: '', valueProp: '', objectionHandling: {}, closing: '' }
        };

        try {
            // Try to extract JSON block from text
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) return { ...result, ...JSON.parse(jsonMatch[0]) };
        } catch (_) {}

        // Last resort: put everything in email body
        result.email.body = text;
        return result;
    }

    // Backward-compatible wrapper — server.js and campaign.js call this
    async generateIndustrySpecificContent(lead, industry, yourService, campaignStyle, language) {
        return this.generateContent(lead, yourService, { style: campaignStyle, language });
    }

    // Legacy multi-touch — kept for CLI compatibility
    async generateMultiTouchSequence(lead, industry, yourService, language) {
        const content = await this.generateContent(lead, yourService, { language });
        return {
            email1: content,
            email2: content,
            whatsapp: content
        };
    }
}

module.exports = MarketingAI;
