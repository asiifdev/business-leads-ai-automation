# 🚀 Business Leads AI Automation v2.0

**Open-source lead generation tool with AI-powered content creation and web dashboard**

Generate business leads from Google Maps, create personalized marketing content using OpenAI, and manage everything through a modern web interface.

[![GitHub stars](https://img.shields.io/github/stars/asiifdev/business-leads-ai-automation?style=social)](https://github.com/asiifdev/business-leads-ai-automation/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/asiifdev/business-leads-ai-automation?style=social)](https://github.com/asiifdev/business-leads-ai-automation/fork)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 What it does

This tool helps you:

- **Scrape business information** from Google Maps (name, address, phone, rating)
- **Generate AI marketing content** personalized for each business
- **Manage campaigns** through a modern web dashboard
- **Track lead quality** with AI-powered scoring
- **Export results** in CSV and JSON formats
- **Create email and WhatsApp templates** automatically
- **Monitor performance** with real-time analytics

**Perfect for:** Digital agencies, freelance marketers, SME consultants, and business developers looking for an affordable lead generation solution with professional management tools.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- OpenAI API key ([get one here](https://platform.openai.com/))

### Installation

```bash
git clone https://github.com/asiifdev/business-leads-ai-automation.git
cd business-leads-ai-automation
npm install
```

### Setup

```bash
# Run the interactive setup wizard (recommended)
npm run setup

# The wizard will guide you through:
# 1. OpenAI API key configuration
# 2. Business profile (name, phone, email, services, value propositions)
# 3. Owner/contact person info
# 4. Language & preferences (Indonesian/English)
# 5. Industry focus & campaign style
#
# All settings are saved to .env and business-profile.json
```

**Or manually:**

```bash
cp .env.example .env
# Edit .env with your API key
# Edit business-profile.json with your business data
```

### Usage Options

#### 🌐 Web Dashboard (Recommended)

```bash
# Start the web dashboard
npm run web

# Open your browser to http://localhost:3000
# Create campaigns, manage leads, and view analytics through the web interface
```

#### 💻 Command Line Interface

```bash
# Basic CLI usage
node index.js -q "Restaurant Jakarta" -l 20

# With marketing content generation
node index.js -q "Restaurant Jakarta" -l 20 -m "Increase your restaurant sales with digital marketing"

# With language override
node index.js -q "Coffee Shop Sydney" -l 10 -L english

# Results will be saved in the output/ folder
```

---

## 📊 Example Output

### Input:

```bash
node index.js -q "Coffee Shop Jakarta" -l 5 -m "Boost your coffee shop with online ordering system"
```

### Generated Files:

**📄 leads\_[timestamp].csv**

```csv
ID,Name,Address,Phone,Website,Rating
1,"Kopi Tuku","Jl. Kemang Raya No.1","+6281234567890","kopituku.com","4.5"
2,"Filosofi Kopi","Jl. Senopati No.5","+6281234567891","filosofikopi.com","4.3"
```

**📧 email_template.txt**

```
Subject: Tingkatkan Penjualan Coffee Shop dengan Sistem Online

Halo Tim Kopi Tuku,

Saya melihat coffee shop Anda di Kemang dengan rating 4.5 stars - impressive!

Apakah Anda tertarik meningkatkan penjualan dengan sistem online ordering yang terbukti efektif untuk coffee shop?

[Your personalized message continues...]
```

**📱 whatsapp_template.txt**

```
Halo Kopi Tuku! ☕

Lihat coffee shop Anda di Kemang rating 4.5⭐ - keren!

Mau boost penjualan pakai sistem online ordering? 📱

[Continues with personalized content...]
```

---

## ⚙️ Current Features

### ✅ Core Features

- **Google Maps scraping** with auto-scroll
- **Business data extraction** (name, address, phone, rating, website)
- **AI content generation** using OpenAI GPT
- **Lead quality scoring** with AI intelligence
- **Dual template creation** (email + WhatsApp)
- **CSV and JSON export**
- **Bilingual support** (Indonesian & English)
- **Configurable business profile** — no hardcoded business data
- **Rate limiting** to avoid blocking

### 🌐 Web Dashboard Features

- **Modern web interface** for non-technical users
- **Campaign management** with real-time progress tracking
- **Lead management** with filtering and sorting
- **Analytics dashboard** with performance insights
- **Responsive design** for mobile and desktop
- **Real-time notifications** via Server-Sent Events
- **Data export** functionality (CSV/JSON)
- **Campaign templates** for different industries

### 🚧 Known Limitations

- **Email finding** returns empty array (work in progress)
- **Phone number validation** could be improved
- **Error handling** needs enhancement for edge cases

### 🎯 Planned Features

- [ ] Fix email discovery functionality
- [ ] Better phone number validation for international numbers
- [ ] Multiple search engine support
- [x] ~~Advanced AI prompt customization~~ ✅ (via business profile)
- [ ] Batch processing for multiple queries
- [ ] API integrations (CRM, email marketing)

---

## 📖 Usage Guide

### 🌐 Web Dashboard

For the best experience, use the web dashboard:

```bash
npm run web
```

Then open http://localhost:3000 in your browser. The web interface provides:

- **Campaign Creation**: Easy form-based campaign setup
- **Real-time Monitoring**: Live progress tracking
- **Lead Management**: Filter, sort, and export leads
- **Analytics**: Performance insights and reporting

📚 **Full Web Dashboard Guide**: [docs/WEB_DASHBOARD_GUIDE.md](docs/WEB_DASHBOARD_GUIDE.md)

### 💻 Command Line Options

```bash
node index.js [options]

Options:
  -q, --query <query>       Google Maps search query
  -l, --length <number>     Number of results to scrape (max: 100)
  -m, --marketing <text>    Your marketing message for AI templates
  -c, --cta <text>          Call to action text
  -L, --language <lang>     Output language: indonesian / english
  -h, --help                Show help information

Examples:
  node index.js -q "Restaurant Bandung" -l 50 -m "Digital marketing for restaurants"
  node index.js -q "Salon Jakarta" -l 30 -m "Online booking system"
  node index.js -q "Coffee Shop Sydney" -l 10 -L english
```

### 🚀 Available Scripts

```bash
npm run setup        # Interactive setup wizard (first-time configuration)
npm run web          # Start web dashboard (recommended)
npm run web:dev      # Start web dashboard in development mode
npm run campaign     # Run interactive campaign builder
npm run cli          # Run CLI version
npm test             # Run tests (50 tests)
```

---

## 🔧 Configuration

Configuration is split into two files:

### `business-profile.json` — Business Data (created by `npm run setup`)

This file is the **single source of truth** for all your business information:

```json
{
  "business": {
    "name": "Your Business Name",
    "type": "technology",
    "phone": "+628xxx",
    "email": "contact@yourbiz.com",
    "website": "https://yourbiz.com",
    "description": "Your service/product description",
    "valuePropositions": ["Fast delivery", "24/7 support"],
    "targetIndustries": ["restaurant", "retail"]
  },
  "owner": {
    "name": "Your Name",
    "phone": "+628xxx",
    "email": "you@email.com"
  },
  "preferences": {
    "language": "indonesian",
    "campaignStyle": "balanced",
    "defaultSearchQuery": "",
    "defaultLocation": "Jakarta",
    "outputFormat": "csv"
  }
}
```

### `.env` — API Keys & System Settings

```env
# Required
OPENAI_API_KEY=your-openai-key-here

# Optional: Custom OpenAI endpoint (Azure, OpenRouter, local LLMs, etc.)
OPENAI_BASE_URL=https://your-custom-endpoint.com/v1
OPENAI_MODEL=gpt-4o-mini

# Output language (indonesian / english)
OUTPUT_LANGUAGE=indonesian

# Scraping Configuration
DELAY_BETWEEN_SCRAPES=2000
MAX_RETRIES=3
OUTPUT_FORMAT=csv
```

---

## 🌟 Why Use This Tool?

### 💰 Cost Effective

- **Free to use** vs $99-299/month for SaaS alternatives
- **Open source** - modify as needed
- **No monthly subscriptions**

### 🎯 Multi-Market Focus

- **Bilingual AI prompts** — Indonesian & English
- **WhatsApp marketing** integration
- **Configurable for any market** — set your business profile once
- **Language-aware content** — all outputs match your chosen language

### 🛠️ Developer Friendly

- **Full source code access**
- **Easy to customize and extend**
- **Well-documented codebase**
- **Active community support**

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Report bugs** via GitHub Issues
2. **Suggest features** you'd like to see
3. **Submit pull requests** for improvements
4. **Share your use cases** and success stories

### Development Setup

```bash
# Fork the repo, then clone your fork
git clone https://github.com/YOUR_USERNAME/business-leads-ai-automation.git
cd business-leads-ai-automation
npm install

# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes and test
npm test

# Submit a pull request
```

---

## ⚖️ Legal & Ethics

- **Public data only** - scrapes publicly available information
- **Respectful scraping** - includes rate limiting
- **No spam** - use for legitimate business outreach only
- **MIT License** - free for commercial use

Please read our [DISCLAIMER.md](DISCLAIMER.md) for full legal information.

---

## 📞 Support & Documentation

### 📚 Documentation

- **[Web Dashboard Guide](docs/WEB_DASHBOARD_GUIDE.md)**: Complete user guide for the web interface
- **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)**: Production deployment instructions
- **[API Documentation](docs/API.md)**: REST API reference (coming soon)

### 🆘 Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **Discussions**: For questions and community chat
- **Email**: [your-email] for urgent matters

### 🚀 Deployment

Ready for production? Check our comprehensive deployment guide:

- VPS/Server deployment
- Docker containerization
- Cloud platform deployment (Heroku, AWS, etc.)
- SSL/HTTPS setup
- Monitoring and maintenance

📚 **Full Deployment Guide**: [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)

---

## 🙏 Acknowledgments

- Built with [Puppeteer](https://pptr.dev/) for web scraping
- Powered by [OpenAI](https://openai.com/) for AI content generation
- Inspired by the need for affordable lead generation tools in Indonesia

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**⭐ Star this repo if you find it useful!**

Made with ❤️ for businesses worldwide
