# eternum-revenue

dashboard to monitor eternum S1 revenue

## Scripts

### Generate Chest Rewards

The `generate-chest-rewards.js` script creates NFT chest rewards distribution based on achievement points.

#### Usage

```bash
node scripts/generate-chest-rewards.js --brackets "min1:max1:chests1,min2:max2:chests2,..."
```

#### Parameters

- `--brackets`: Define point ranges and corresponding chest counts
  - Format: `"min:max:chests"` separated by commas
  - `min`: Minimum points for this bracket
  - `max`: Maximum points for this bracket  
  - `chests`: Number of chests to award for this bracket

#### Examples

```bash
# Example with 6 brackets
node scripts/generate-chest-rewards.js --brackets "950:1000:7,800:949:5,600:799:3,400:599:2,200:399:1,0:199:0"

# Simple 3-tier system
node scripts/generate-chest-rewards.js --brackets "500:1000:3,100:499:2,5:99:1"

# Example with 7 brackets
node scripts/generate-chest-rewards.js --brackets "750:1000:18,500:749:12,300:499:8,150:299:5,50:149:3,15:49:2,0:14:1"

```



#### Output

The script will:
1. Read player data from `public/data/cartridge-points.json`
2. Generate `public/data/chest-rewards.json` with the format:
   ```json
   [
     {
       "traits": "Epoch:Season 1,Type:Eternum Rewards Chest",
       "toAddress": "0x...",
       "count": 7
     }
   ]
   ```
3. Display detailed statistics:
   - Total players and chest recipients
   - Breakdown by point brackets
   - Distribution by chest count with percentages

#### Viewing Results

After running the script, the Loot Chests tab in the rewards page will display the generated chest distribution.