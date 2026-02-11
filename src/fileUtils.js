const fs = require("fs");

class FileUtils {
  static async saveToFile(data, filename = "business_leads") {
    const timestamp = new Date().toISOString().split("T")[0];
    const csvFilename = `output/${filename}_${timestamp}.csv`;
    const jsonFilename = `output/${filename}_${timestamp}.json`;

    // Create output directory if it doesn't exist
    if (!fs.existsSync('output')) {
      fs.mkdirSync('output');
    }

    // Save as CSV
    const csvHeader =
      "ID,Name,Address,Phone,Website,Reference Link,Possible Emails,Rating,Source,Scraped At\n";
    const csvRows = data
      .map(
        (business) =>
          `${business.id},"${business.name}","${business.address}","${
            business.phone
          }","${business.website}","${business.referenceLink}","${business.possibleEmails.join("; ")}","${business.rating}","${
            business.source
          }","${business.scrapedAt}"`
      )
      .join("\n");

    fs.writeFileSync(csvFilename, csvHeader + csvRows);

    // Save as JSON
    fs.writeFileSync(jsonFilename, JSON.stringify(data, null, 2));

    console.log(`Results saved to ${csvFilename} and ${jsonFilename}`);
    return { csvFile: csvFilename, jsonFile: jsonFilename };
  }

  static loadLeads(jsonFile) {
    try {
      const data = fs.readFileSync(jsonFile, 'utf8');
      const leads = JSON.parse(data);
      console.log(`Loaded ${leads.length} leads from ${jsonFile}`);
      return leads;
    } catch (error) {
      console.error('Error loading leads:', error);
      return [];
    }
  }

  static async saveLeads(data, filename) {
    // Ensure parent directory exists
    const dir = require('path').dirname(filename);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (filename.endsWith('.json')) {
      fs.writeFileSync(filename, JSON.stringify(data, null, 2));
      console.log(`Leads saved to ${filename}`);
    } else if (filename.endsWith('.csv')) {
      const headers = ['ID', 'Name', 'Address', 'Phone', 'Website', 'Rating', 'Source', 'Score', 'Priority', 'Category'];
      const csvHeader = headers.join(',') + '\n';
      const csvRows = data
        .map((lead, index) =>
          `${index + 1},"${(lead.name || '').replace(/"/g, '""')}","${(lead.address || '').replace(/"/g, '""')}","${lead.phone || ''}","${lead.website || ''}","${lead.rating || 'N/A'}","${lead.source || 'Google Maps'}","${lead.intelligence?.score || 'N/A'}","${lead.intelligence?.priority || 'N/A'}","${lead.intelligence?.category || 'N/A'}"`
        )
        .join('\n');
      fs.writeFileSync(filename, csvHeader + csvRows);
      console.log(`Leads saved to ${filename}`);
    } else {
      // Default to JSON
      fs.writeFileSync(filename + '.json', JSON.stringify(data, null, 2));
      console.log(`Leads saved to ${filename}.json`);
    }
  }

  static logActivity(activity, logFile = 'marketing_log.json') {
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

  static formatPhoneNumber(phone) {
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
}

module.exports = FileUtils; 