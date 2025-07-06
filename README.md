# 🚀 Business Leads AI Automation

**Open-source lead generation tool with AI-powered content creation**

Generate business leads from Google Maps and create personalized marketing content using OpenAI.

[![GitHub stars](https://img.shields.io/github/stars/asiifdev/business-leads-ai-automation?style=social)](https://github.com/asiifdev/business-leads-ai-automation/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/asiifdev/business-leads-ai-automation?style=social)](https://github.com/asiifdev/business-leads-ai-automation/fork)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 What it does

This tool helps you:
- **Scrape business information** from Google Maps (name, address, phone, rating)
- **Generate AI marketing content** personalized for each business
- **Export results** in CSV and JSON formats
- **Create email and WhatsApp templates** automatically

**Perfect for:** Digital agencies, freelance marketers, SME consultants, and business developers looking for an affordable lead generation solution.

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
# Copy environment template
cp .env.example .env

# Add your OpenAI API key to .env
OPENAI_API_KEY=your-openai-key-here
```

### Usage

```bash
# Basic usage
node index.js -q "Restaurant Jakarta" -l 20 -m "Increase your restaurant sales with digital marketing"

# Results will be saved in the output/ folder
```

---

## 📊 Example Output

### Input:
```bash
node index.js -q "Coffee Shop Jakarta" -l 5 -m "Boost your coffee shop with online ordering system"
```

### Generated Files:

**📄 leads_[timestamp].csv**
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

### ✅ Working Features
- **Google Maps scraping** with auto-scroll
- **Basic business data extraction** (name, address, phone, rating, website)
- **AI content generation** using OpenAI GPT
- **Dual template creation** (email + WhatsApp)
- **CSV and JSON export**
- **Indonesian market optimization**
- **Rate limiting** to avoid blocking

### 🚧 Known Limitations
- **Email finding** returns empty array (work in progress)
- **Phone number validation** could be improved
- **Error handling** needs enhancement for edge cases
- **No web interface** (CLI only for now)

### 🎯 Planned Features
- [ ] Fix email discovery functionality
- [ ] Better phone number validation for Indonesian numbers
- [ ] Web dashboard interface
- [ ] Multiple search engine support
- [ ] Advanced AI prompt customization
- [ ] Batch processing for multiple queries

---

## 📖 Command Line Options

```bash
node index.js [options]

Required:
  -q, --query <query>     Google Maps search query
  -l, --limit <number>    Number of results to scrape
  -m, --message <text>    Your marketing message for AI templates

Optional:
  -o, --output <format>   Output format: csv or json (default: csv)
  -h, --help             Show help information

Examples:
  node index.js -q "Restaurant Bandung" -l 50 -m "Digital marketing for restaurants"
  node index.js -q "Salon Jakarta" -l 30 -m "Online booking system" -o json
```

---

## 🔧 Configuration

Edit `.env` file for customization:

```env
# Required
OPENAI_API_KEY=your-openai-key-here

# Optional
DELAY_BETWEEN_SCRAPES=2000    # Milliseconds between requests
MAX_RETRIES=3                 # Retry failed requests
OUTPUT_FORMAT=csv             # Default output format
```

---

## 🌟 Why Use This Tool?

### 💰 Cost Effective
- **Free to use** vs $99-299/month for SaaS alternatives
- **Open source** - modify as needed
- **No monthly subscriptions**

### 🎯 Indonesian Market Focus
- **Local business understanding** in AI prompts
- **WhatsApp marketing** integration (popular in Indonesia)
- **Indonesian language** optimization

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

## 📞 Support

- **GitHub Issues**: For bug reports and feature requests
- **Discussions**: For questions and community chat
- **Email**: [your-email] for urgent matters

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

Made with ❤️ for Indonesian businesses
