import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
function parseArguments() {
    const args = process.argv.slice(2);
    const brackets = [];
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--brackets' && args[i + 1]) {
            const bracketString = args[i + 1];
            const bracketParts = bracketString.split(',');
            
            for (const part of bracketParts) {
                const [min, max, chests] = part.split(':').map(Number);
                if (!isNaN(min) && !isNaN(max) && !isNaN(chests)) {
                    brackets.push({ min, max, chests });
                } else {
                    throw new Error(`Invalid bracket format: ${part}. Expected format: min:max:chests`);
                }
            }
            break;
        }
    }
    
    if (brackets.length === 0) {
        throw new Error('No brackets provided. Use --brackets "min1:max1:chests1,min2:max2:chests2,..."');
    }
    
    // Sort brackets by min value descending for easier processing
    brackets.sort((a, b) => b.min - a.min);
    
    return brackets;
}

// Find which bracket a player's points fall into
function getChestCount(points, brackets) {
    for (const bracket of brackets) {
        if (points >= bracket.min && points <= bracket.max) {
            return bracket.chests;
        }
    }
    return 0; // Default if no bracket matches
}

// Main function
async function generateChestRewards() {
    try {
        // Parse brackets from command line
        const brackets = parseArguments();
        console.log('📊 Using brackets:', brackets);
        
        // Read the cartridge points data
        const dataPath = path.join(__dirname, '..', 'public', 'data', 'cartridge-points.json');
        const jsonData = fs.readFileSync(dataPath, { encoding: 'utf8' });
        const players = JSON.parse(jsonData);
        
        console.log(`\n📥 Loaded ${players.length} players from cartridge-points.json`);
        
        // Generate chest rewards
        const chestRewards = [];
        const bracketStats = new Map();
        
        // Initialize bracket stats
        for (const bracket of brackets) {
            bracketStats.set(`${bracket.min}-${bracket.max}`, { 
                range: `${bracket.min}-${bracket.max}`,
                chests: bracket.chests,
                playerCount: 0 
            });
        }
        
        // Process each player
        for (const player of players) {
            const chestCount = getChestCount(player.total_points, brackets);
            
            if (chestCount > 0) {
                chestRewards.push({
                    traits: "Epoch:Season 1,Type:Eternum Rewards Chest",
                    toAddress: player.player_id,
                    count: chestCount
                });
            }
            
            // Update statistics
            for (const bracket of brackets) {
                if (player.total_points >= bracket.min && player.total_points <= bracket.max) {
                    const key = `${bracket.min}-${bracket.max}`;
                    const stats = bracketStats.get(key);
                    stats.playerCount++;
                    break;
                }
            }
        }
        
        // Sort rewards by chest count descending, then by address
        chestRewards.sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.toAddress.localeCompare(b.toAddress);
        });
        
        // Write the output file
        const outputPath = path.join(__dirname, '..', 'public', 'data', 'chest-rewards.json');
        fs.writeFileSync(outputPath, JSON.stringify(chestRewards, null, 2));
        
        // Calculate players per chest count
        const playersPerChestCount = new Map();
        for (const reward of chestRewards) {
            const count = playersPerChestCount.get(reward.count) || 0;
            playersPerChestCount.set(reward.count, count + 1);
        }
        
        // Include players with 0 chests
        const playersWithZeroChests = players.length - chestRewards.length;
        if (playersWithZeroChests > 0) {
            playersPerChestCount.set(0, playersWithZeroChests);
        }
        
        // Print summary
        console.log('\n🎁 CHEST DISTRIBUTION SUMMARY');
        console.log('================================');
        console.log(`Total players: ${players.length}`);
        console.log(`Players receiving chests: ${chestRewards.length}`);
        console.log(`Total chests distributed: ${chestRewards.reduce((sum, r) => sum + r.count, 0)}`);
        
        console.log('\n📊 BRACKET BREAKDOWN');
        console.log('================================');
        
        // Sort bracket stats by range for display
        const sortedStats = Array.from(bracketStats.values()).sort((a, b) => {
            const aMin = parseInt(a.range.split('-')[0]);
            const bMin = parseInt(b.range.split('-')[0]);
            return bMin - aMin;
        });
        
        for (const stats of sortedStats) {
            const totalChestsInBracket = stats.playerCount * stats.chests;
            console.log(`Points ${stats.range}: ${stats.playerCount} players × ${stats.chests} chests = ${totalChestsInBracket} total chests`);
        }
        
        console.log('\n🎯 PLAYERS PER CHEST COUNT');
        console.log('================================');
        
        // Sort by chest count descending
        const sortedChestCounts = Array.from(playersPerChestCount.entries()).sort((a, b) => b[0] - a[0]);
        
        for (const [chestCount, playerCount] of sortedChestCounts) {
            const percentage = ((playerCount / players.length) * 100).toFixed(2);
            console.log(`${chestCount} ${chestCount === 1 ? 'chest' : 'chests'}: ${playerCount} players (${percentage}%)`);
        }
        
        console.log(`\n✅ Successfully generated ${outputPath}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n📖 Usage: node generate-chest-rewards.js --brackets "min1:max1:chests1,min2:max2:chests2,..."');
        console.log('Example: node generate-chest-rewards.js --brackets "950:1000:7,800:949:5,600:799:3,400:599:2,200:399:1,0:199:0"');
        process.exit(1);
    }
}

// Run the script
generateChestRewards();