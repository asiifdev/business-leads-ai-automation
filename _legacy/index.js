// Redirect to new CLI structure
const { main } = require('./src/cli');

if (require.main === module) {
  main().catch(console.error);
}

module.exports = require('./src/scraper'); 