# Business Scraping Tools

A powerful Node.js tool for scraping business leads from Google Maps with AI-powered marketing automation capabilities. Generate personalized marketing templates efficiently with just one AI call per campaign.

## 🚀 Features

- **Google Maps Scraping**: Extract business information (name, address, phone, website, rating)
- **Smart Scrolling**: Automatically scroll to load more results based on target count
- **AI-Powered Marketing**: Generate personalized email and WhatsApp templates using OpenAI
- **Efficient Token Usage**: Generate base template once, then personalize for each lead
- **Custom Marketing Content**: Define your own marketing message and call-to-action
- **Bulk Outreach**: Automated lead nurturing with customizable templates
- **Multiple Output Formats**: CSV and JSON export
- **Command Line Interface**: Easy-to-use CLI with flexible parameters

## 📋 Requirements

- Node.js >= 20.0.0
- npm or yarn
- OpenAI API key (for AI template generation)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd business-scrap-tools
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Copy environment template**
   ```bash
   cp env.example .env
   ```

4. **Configure your environment variables**
   ```bash
   # Edit .env file with your details
   nano .env
   ```

## ⚙️ Configuration

### Environment Variables (.env)

Create a `.env` file in the root directory with the following variables:

```env
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4.1-nano

# Business Information
BUSINESS_NAME=Your Business Name
BUSINESS_PHONE=+6281234567890
BUSINESS_EMAIL=your@business.com

# Owner Information
OWNER_NAME=Your Name
OWNER_PHONE=+6281234567890
OWNER_EMAIL=your@email.com

# Business Type for AI Context
BUSINESS_TYPE=rental_mobil
```

### OpenAI API Setup

1. **Get OpenAI API Key**
   - Sign up at [OpenAI](https://platform.openai.com/)
   - Create an API key in your dashboard
   - Add your key to the `.env` file

2. **Choose Model** (optional)
   - Default: `gpt-4.1-nano` (cost-effective)
   - Alternative: `gpt-4` (more powerful, higher cost)

## 📖 Usage

### Basic Scraping

```bash
# Scrape rental mobil businesses (default: 20 results)
node index.js

# Scrape with custom query and length
node index.js -q "Rental Mobil Jakarta" -l 50

# Scrape catering businesses
node index.js --query "Catering Jakarta" --length 30
```

### Scraping with AI Marketing

```bash
# Scrape + Generate marketing templates with custom content
node index.js -q "Rental Mobil Jakarta" -l 10 \
  -m "Penawaran Sistem Rental Mobil Include Landing Page dengan Harga Promo untuk pendaftar pertama 2.000.000/Tahun sudah termasuk server dan custom domain. fitur2 utema ada Manajemen Garasi, Manajemen Mobil, Manajemen Driver, Manajemen Booking, Report Lengkap, dan masih banyak lagi" \
  -c "Jadwalkan Demo Gratis Sekarang"

# Scrape + Generate marketing templates with auto CTA
node index.js -q "Catering Jakarta" -l 15 \
  -m "Sistem manajemen catering terintegrasi dengan fitur order management, inventory tracking, dan delivery management"
```

### Command Line Options

| Option | Description | Default | Required |
|--------|-------------|---------|----------|
| `-q, --query <string>` | Search query | "rental mobil" | No |
| `-l, --length <number>` | Number of results to scrape | 20 | No |
| `-m, --marketing <text>` | Marketing content + Generate AI templates | - | Yes (if using marketing) |
| `-c, --cta <text>` | Call to action | Auto-generated | No |
| `-h, --help` | Show help message | - | No |

**Note**: 
- `-m` is required when using marketing feature
- `-c` is optional; if not provided, AI will generate appropriate call-to-action
- Maximum results: 100 per query

### Examples

#### Basic Scraping
```bash
# Scrape 50 rental car businesses in Jakarta
node index.js -q "Rental Mobil Jakarta" -l 50

# Scrape 30 catering businesses
node index.js --query "Catering Bandung" --length 30

# Scrape 10 hotel businesses
node index.js -q "Hotel Jakarta" -l 10
```

#### Marketing Campaigns
```bash
# Rental car system promotion
node index.js -q "Rental Mobil Jakarta" -l 20 \
  -m "Sistem rental mobil terintegrasi dengan harga promo 2.000.000/tahun. Fitur: manajemen armada, booking online, laporan real-time, payment gateway" \
  -c "Demo gratis 15 menit"

# Catering management system
node index.js -q "Catering Jakarta" -l 15 \
  -m "Sistem manajemen catering dengan order management, inventory tracking, delivery management, dan sales reporting" \
  -c "Konsultasi gratis"

# Auto-generated CTA
node index.js -q "Hotel Jakarta" -l 10 \
  -m "Sistem manajemen hotel dengan booking engine, room management, dan guest services"
```

## 🤖 AI Marketing Features

### How It Works

1. **Single AI Call**: Generate base marketing template once using your content
2. **Template Personalization**: Apply the base template to each lead with personal details
3. **Token Efficiency**: Save costs by not calling AI for each individual lead

### Marketing Content Structure

The AI generates three types of content for each lead:

1. **Email Subject Line**: Professional, attention-grabbing subject
2. **Email Content**: Formal business email with your marketing message
3. **WhatsApp Content**: Casual, friendly message with emojis

### Personalization Variables

The system automatically replaces these placeholders in templates:
- `[BUSINESS_NAME]` → Target business name
- `[ADDRESS]` → Target business address  
- `[PHONE]` → Target business phone number

### Output Format

Marketing templates are saved in `output/marketing-template/` with columns:
- **Nama Bisnis**: Target business name
- **Nomor HP**: Target business phone
- **Subyek**: Email subject line
- **Tipe Bisnis**: Your business type
- **Konten Email**: Complete email content
- **Konten Whatsapp**: Complete WhatsApp message

## 📁 Project Structure

```
business-scrap-tools/
├── output/
│   ├── leads/                    # Scraped business data
│   │   ├── rental_mobil_jakarta_leads_2025-07-05.csv
│   │   └── rental_mobil_jakarta_leads_2025-07-05.json
│   └── marketing-template/       # AI-generated marketing content
│       ├── rental_mobil_jakarta_marketing_2025-07-05.csv
│       └── rental_mobil_jakarta_marketing_2025-07-05.json
├── src/
│   ├── scraper.js               # Google Maps scraping logic
│   ├── cli.js                   # Command line interface
│   ├── fileUtils.js             # File handling utilities
│   └── marketing.js             # AI marketing automation
├── .env                         # Environment variables
├── env.example                  # Environment template
├── package.json
└── README.md
```

## 📊 Output Formats

### Business Leads (CSV)
```csv
ID,Name,Address,Phone,Website,Reference Link,Possible Emails,Rating,Source,Scraped At
1,"Rental Mobil Jakarta","Jl. Example No.123","08123456789","https://example.com","https://maps.google.com/...","","4.5","Google Maps","2025-07-05T10:00:00.000Z"
```

### Business Leads (JSON)
```json
{
  "id": 1,
  "name": "Rental Mobil Jakarta",
  "address": "Jl. Example No.123",
  "phone": "08123456789",
  "website": "https://example.com",
  "referenceLink": "https://maps.google.com/...",
  "possibleEmails": [],
  "rating": "4.5",
  "source": "Google Maps",
  "scrapedAt": "2025-07-05T10:00:00.000Z"
}
```

### Marketing Templates (CSV)
```csv
Nama Bisnis,Nomor HP,Subyek,Tipe Bisnis,Konten Email,Konten Whatsapp
"Rental Mobil Jakarta","08123456789","Solusi Digital untuk Rental Mobil Jakarta","rental_mobil","Halo Rental Mobil Jakarta,...","Halo Rental Mobil Jakarta! 👋..."
```

## 🔧 Advanced Usage

### Custom Scraping Scripts

```javascript
const BusinessScraper = require('./src/scraper');

const scraper = new BusinessScraper();

// Scrape multiple queries
await scraper.scrapeGoogleMaps('rental mobil', 30);
await scraper.scrapeGoogleMaps('catering', 20);

// Process and save results
const processedData = await scraper.processResults();
await scraper.saveToFile(processedData, 'combined_leads');
```

### Custom Marketing Automation

```javascript
const MarketingAutomation = require('./src/marketing');

const marketing = new MarketingAutomation();

// Load leads and generate marketing templates
const leads = marketing.loadLeads('output/leads.json');
const marketingData = await marketing.generateMarketingTemplatesWithContent(
  leads,
  "Your marketing message here",
  "Your call to action here"
);
```

## ⚠️ Important Notes

### Rate Limiting & Ethics
- Google Maps may rate limit excessive requests
- Use reasonable delays between scraping sessions
- Respect robots.txt and terms of service
- This tool is for educational and legitimate business purposes
- Ensure compliance with local laws and Google's terms of service

### AI Usage & Costs
- OpenAI API usage incurs costs based on token usage
- Monitor your API usage in OpenAI dashboard
- Base template generation uses ~500-1000 tokens
- Personalization is free (no additional API calls)
- Test with small datasets first

### Performance Tips
- Start with small `-l` values (5-10) for testing
- Use `gpt-4.1-nano` for cost efficiency
- Monitor API usage in OpenAI dashboard
- Keep marketing content concise for better results

## 🐛 Troubleshooting

### Common Issues

#### 1. "Browser not found"
```bash
# Install Chromium dependencies (Ubuntu/Debian)
sudo apt-get install chromium-browser

# Or use headless mode (already enabled by default)
```

#### 2. "OpenAI not configured"
```bash
# Check your .env file
cat .env

# Ensure OPENAI_API_KEY is set
export OPENAI_API_KEY="your-key-here"
```

#### 3. "No results found"
- Check your internet connection
- Try different search queries
- Google Maps structure may have changed
- Increase timeout in `src/scraper.js`

#### 4. "Marketing content required"
```bash
# Always provide marketing content with -m
node index.js -q "query" -l 10 -m "Your marketing message here"
```

#### 5. "Timeout error"
- Increase timeout in `src/scraper.js` line 32
- Check internet connection
- Try again later (Google Maps may be slow)

### Debug Mode

Enable detailed logging:
```bash
DEBUG=* node index.js -q "test query" -l 5
```

### Check Logs

Marketing logs are saved to `marketing_log.json`:
```bash
cat marketing_log.json
```

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

## 📞 Support

For issues and questions:

- **GitHub Issues**: Create an issue on GitHub
- **Documentation**: Check this README and code comments
- **Troubleshooting**: See the troubleshooting section above
- **Feature Requests**: Open a GitHub issue with detailed description

### Getting Help

1. Check the troubleshooting section
2. Review the code comments for implementation details
3. Check your `.env` configuration
4. Test with small datasets first
5. Monitor OpenAI API usage

---

## 🎯 Quick Start Guide

1. **Setup Environment**
   ```bash
   npm install
   cp env.example .env
   # Edit .env with your OpenAI API key and business info
   ```

2. **Test Basic Scraping**
   ```bash
   node index.js -q "Rental Mobil Jakarta" -l 5
   ```

3. **Test Marketing Generation**
   ```bash
   node index.js -q "Rental Mobil Jakarta" -l 3 \
     -m "Sistem rental mobil terintegrasi dengan harga promo" \
     -c "Demo gratis sekarang"
   ```

4. **Check Results**
   ```bash
   ls output/
   ls output/marketing-template/
   ```

---

**Happy Scraping & Marketing! 🚀**
