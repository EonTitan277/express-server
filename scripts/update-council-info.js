require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

/**
 * Updates council information in main-rules.html
 * Replaces text content of elements with classes 'pn' and 'ppn'
 * with values from COUNCIL_NAME and COUNCIL_PHONE environment variables
 */
async function updateCouncilInfo() {
    const htmlFilePath = path.join(__dirname, '..', 'public', 'pages', 'main', 'main-rules.html');
    
    try {
        // Check if environment variables are set
        const councilName = process.env.COUNCIL_NAME;
        const councilPhone = process.env.COUNCIL_PHONE;
        
        if (!councilName || !councilPhone) {
            console.error('Missing required environment variables: COUNCIL_NAME and/or COUNCIL_PHONE');
            process.exit(1);
        }
        
        // Read the HTML file
        const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
        
        // Load HTML into cheerio for manipulation
        const $ = cheerio.load(htmlContent);
        
        // Update all elements with class 'pn' (council name)
        $('.pn').text(councilName);
        
        // Update all elements with class 'ppn' (council phone)
        $('.ppn').text(councilPhone);
        
        // Serialize the modified DOM back to HTML string
        const modifiedHtml = $.html();
        
        // Write the modified HTML back to the file
        fs.writeFileSync(htmlFilePath, modifiedHtml, 'utf8');
        
        console.log(`✓ Successfully updated council information in main-rules.html`);
        console.log(`  Council Name: ${councilName}`);
        console.log(`  Council Phone: ${councilPhone}`);
        
        return true;
    } catch (error) {
        console.error('Error updating council information:', error.message);
        process.exit(1);
    }
}

// Export the function for use in server.js
module.exports = { updateCouncilInfo };

// Allow running this script directly
if (require.main === module) {
    updateCouncilInfo();
}