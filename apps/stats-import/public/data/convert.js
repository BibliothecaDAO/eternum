import fs from 'fs';

// JSON to CSV Converter Script
async function convertJsonToCsv() {
    try {
        // Read the JSON file
        const jsonData = fs.readFileSync('./public/data/cartridge-points.json', { encoding: 'utf8' });
        
        // Parse the JSON
        const data = JSON.parse(jsonData);
        
        // Create CSV header
        const csvHeaders = 'address,points';
        
        // Convert each record to CSV row
        const csvRows = data.map(record => {
            return `${record.player_id},${record.total_points}`;
        });
        
        // Combine header and rows
        const csvContent = csvHeaders + '\n' + csvRows.join('\n');
        
        return csvContent;
        
    } catch (error) {
        console.error("❌ Error during conversion:", error);
        throw error;
    }
}

// Run the conversion
convertJsonToCsv().then(csvContent => {
    console.log(csvContent);
}).catch(error => {
    console.error("Failed to convert JSON to CSV:", error);
});