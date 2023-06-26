#!/bin/bash

url="http://127.0.0.1:5050/"

# Set the number of hours
read -p "Enter the number of hours to advance the time: " hours
if [ -z "$hours" ]; then
  echo "No input received. Exiting."
  exit 1
fi

# Calculate the timestamp in milliseconds
timestamp=$((hours * 3600))

# Set the time
json_body='{
    "jsonrpc": "2.0",
    "method": "katana_increaseNextBlockTimestamp",
    "params": {"timestamp": '$timestamp'},
    "id": 1
}'

response=$(curl -s -X POST -H "Content-Type: application/json" -d "$json_body" "$url")

# Generate empty block
json_body='{
    "jsonrpc": "2.0",
    "method": "katana_generateBlock",
    "params": {},
    "id": 1
}'

response=$(curl -s -X POST -H "Content-Type: application/json" -d "$json_body" "$url")

json_body='{
  "jsonrpc": "2.0",
  "method": "katana_nextBlockTimestamp",
  "params": {},
  "id": 1
}'

# Send POST request using curl
response=$(curl -s -X POST -H "Content-Type: application/json" -d "$json_body" "$url")
next_block_timestamp=$(echo "$response" | awk -F'"result":' '{print $2}' | awk -F',' '{print $1}' | tr -d ' ')

# Print the response
echo "Next block timestamp:"
echo "$next_block_timestamp"
