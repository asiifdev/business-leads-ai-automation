# Contributing to Business Scraping Tools

Thank you for your interest in contributing to this project! We welcome contributions from the community while maintaining high standards for legal and ethical compliance.

## 🤝 How to Contribute

### Before Contributing

1. **Read the Legal Disclaimer**: Review `DISCLAIMER.md` thoroughly
2. **Understand the Purpose**: This tool is for legitimate business use only
3. **Check Existing Issues**: Look for existing issues or discussions
4. **Follow Guidelines**: Ensure your contribution aligns with our ethical standards

## 📋 Contribution Guidelines

### ✅ What We Welcome

- **Bug Fixes**: Fix issues with scraping, AI integration, or CLI
- **Feature Improvements**: Enhance existing functionality
- **Documentation**: Improve README, comments, or guides
- **Performance**: Optimize code efficiency and resource usage
- **Security**: Fix security vulnerabilities
- **Testing**: Add tests or improve test coverage
- **Accessibility**: Improve user experience and accessibility

### ❌ What We Don't Accept

- **Illegal Use Cases**: Features that promote illegal scraping
- **Spam Tools**: Functionality designed for mass spam
- **Privacy Violations**: Features that violate user privacy
- **Terms of Service Violations**: Code that circumvents website protections
- **Harmful Content**: AI prompts that generate harmful content

## 🛠️ Development Setup

### Prerequisites

```bash
# Node.js 20+ required
node --version

# Install dependencies
npm install

# Copy environment template
cp env.example .env
```

### Environment Configuration

Edit `.env` file with your test credentials:

```env
OPENAI_API_KEY=your-test-api-key
BUSINESS_NAME=Test Business
BUSINESS_PHONE=+6281234567890
BUSINESS_EMAIL=test@business.com
OWNER_NAME=Test Owner
OWNER_PHONE=+6281234567890
OWNER_EMAIL=owner@business.com
BUSINESS_TYPE=test_business
```

## 🧪 Testing Your Changes

### Run Basic Tests

```bash
# Test scraping functionality
node index.js -q "Test Query" -l 3

# Test marketing generation
node index.js -q "Test Query" -l 2 \
  -m "Test marketing message" \
  -c "Test call to action"
```

### Test Different Scenarios

```bash
# Test with different business types
node index.js -q "Catering Jakarta" -l 5 \
  -m "Sistem catering terintegrasi" \
  -c "Demo gratis"

# Test with auto-generated CTA
node index.js -q "Hotel Jakarta" -l 3 \
  -m "Sistem manajemen hotel"
```

## 📝 Code Standards

### JavaScript/Node.js

- **ES6+**: Use modern JavaScript features
- **Async/Await**: Prefer async/await over callbacks
- **Error Handling**: Always handle errors gracefully
- **Comments**: Add clear comments for complex logic
- **Naming**: Use descriptive variable and function names

### File Structure

```
src/
├── scraper.js      # Google Maps scraping logic
├── cli.js          # Command line interface
├── fileUtils.js    # File handling utilities
└── marketing.js    # AI marketing automation
```

### Code Style

```javascript
// ✅ Good: Clear, descriptive, well-commented
async function scrapeBusinessData(query, maxResults) {
  try {
    const results = await performScraping(query, maxResults);
    return processResults(results);
  } catch (error) {
    console.error('Scraping failed:', error.message);
    throw new Error('Failed to scrape business data');
  }
}

// ❌ Bad: Unclear, no error handling
function scrape(q, l) {
  return doStuff(q, l);
}
```

## 🔒 Legal Compliance

### When Contributing Code

1. **Respect Rate Limits**: Don't add aggressive scraping features
2. **Follow Terms of Service**: Respect Google Maps and OpenAI terms
3. **Privacy First**: Don't collect unnecessary personal data
4. **Ethical Use**: Ensure features promote legitimate business use
5. **Documentation**: Add clear warnings for potentially problematic features

### Required Disclaimers

If your contribution involves:
- **New data sources**: Add appropriate terms of service compliance
- **Marketing features**: Include anti-spam law considerations
- **AI integration**: Ensure OpenAI terms compliance
- **Data handling**: Add privacy law considerations

## 🚀 Pull Request Process

### Before Submitting

1. **Test Thoroughly**: Ensure your changes work correctly
2. **Update Documentation**: Update README if needed
3. **Check Legal Impact**: Ensure no legal compliance issues
4. **Add Tests**: Include tests for new functionality
5. **Review Guidelines**: Ensure compliance with ethical standards

### Pull Request Template

```markdown
## Description
Brief description of your changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Security fix

## Testing
- [ ] Tested with small dataset
- [ ] Verified legal compliance
- [ ] Updated documentation
- [ ] No breaking changes

## Legal Considerations
- [ ] Follows terms of service
- [ ] Respects privacy laws
- [ ] No spam/harmful features
- [ ] Ethical use only

## Additional Notes
Any additional context or considerations
```

## 🐛 Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Environment**: Node.js version, OS, dependencies
2. **Steps to Reproduce**: Clear, step-by-step instructions
3. **Expected vs Actual**: What you expected vs what happened
4. **Logs**: Relevant error messages or console output
5. **Legal Context**: Whether the issue affects legal compliance

### Security Issues

For security vulnerabilities:

1. **Private Report**: Don't post publicly
2. **Detailed Description**: Include impact assessment
3. **Proof of Concept**: If possible, include reproduction steps
4. **Timeline**: Expected disclosure timeline

## 📚 Documentation

### Adding Documentation

When adding new features:

1. **Update README**: Add usage examples
2. **Add Comments**: Document complex code
3. **Legal Notes**: Include relevant legal considerations
4. **Examples**: Provide clear usage examples

### Documentation Standards

- **Clear Language**: Use simple, clear language
- **Code Examples**: Include working code examples
- **Legal Warnings**: Add appropriate legal disclaimers
- **Step-by-Step**: Provide clear step-by-step instructions

## 🤝 Community Guidelines

### Be Respectful

- **Constructive Feedback**: Provide helpful, constructive feedback
- **Respect Others**: Be respectful of other contributors
- **Inclusive Language**: Use inclusive, welcoming language
- **Professional Conduct**: Maintain professional behavior

### Communication

- **Clear Communication**: Be clear and concise
- **Ask Questions**: Don't hesitate to ask for clarification
- **Share Knowledge**: Help others learn and grow
- **Stay On Topic**: Keep discussions relevant to the project

## 📞 Getting Help

### Before Asking for Help

1. **Check Documentation**: Read README and existing issues
2. **Search Issues**: Look for similar problems
3. **Test Yourself**: Try to reproduce and debug
4. **Provide Context**: Include relevant details

### How to Ask for Help

```markdown
## Issue Description
Clear description of your problem

## Environment
- Node.js version: X.X.X
- OS: Windows/Mac/Linux
- Dependencies: List relevant packages

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected vs Actual
Expected: What should happen
Actual: What actually happens

## Additional Context
Any other relevant information
```

## 🎯 Code of Conduct

### Our Standards

- **Respectful**: Treat everyone with respect
- **Inclusive**: Welcome diverse perspectives
- **Professional**: Maintain professional conduct
- **Ethical**: Prioritize ethical use of technology

### Enforcement

- **Warnings**: First-time violations get warnings
- **Temporary Bans**: Repeated violations may result in temporary bans
- **Permanent Bans**: Severe violations may result in permanent bans
- **Appeals**: Process for appealing decisions

---

**Thank you for contributing to a more ethical and responsible open source community! 🌟**

Remember: With great power comes great responsibility. Let's build tools that help businesses grow while respecting legal and ethical boundaries. 