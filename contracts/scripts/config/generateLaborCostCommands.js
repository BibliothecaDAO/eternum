const { packResources, unpackResources } = require("../pack_resources.js");

// Replace with your CSV string
let csvData = `
,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,254,255
254,2.0585,1.6177,1.5733,,,,,,,,,,,,,,,,,,,,,
255,,,,3.4770,2.9152,2.2903,,,,,,,,,,,,,,,,,,
1,,39.2921,38.2154,,,,,,,,,,,,,,,,,,,,132,66
2,50.0000,,38.2154,,,,,,,,,,,,,,,,,,,,132,66
3,,39.2921,,26.3509,,,,,,,,,,,,,,,,,,,132,66
4,50.0000,,,,22.0937,,,,,,,,,,,,,,,,,,132,66
5,,,,26.3509,,17.3579,,,,,,,,,,,,,,,,,132,66
6,,,,,22.0937,,11.7547,,,,,,,,,,,,,,,,132,66
7,,,,,,17.3579,,9.5414,,,,,,,,,,,,,,,132,66
8,,,,,,,11.7547,,9.1127,,,,,,,,,,,,,,132,66
9,,,,,,,,9.5414,,5.9222,,,,,,,,,,,,,132,66
10,,,,,,,,,9.1127,,2.9910,,,,,,,,,,,,132,66
11,,,,,,,,,,5.9222,,2.4626,,,,,,,,,,,132,66
12,,,,,,,,,,,2.9910,,2.3829,,,,,,,,,,132,66
13,,,,,,,,,,,,2.4626,,2.3829,,,,,,,,,132,66
14,,,,,,,,,,,,,2.3829,,1.7149,,,,,,,,132,66
15,,,,,,,,,,,,,,2.3829,,1.6152,,,,,,,132,66
16,,,,,,,,,,,,,,,1.7149,,1.3858,,,,,,132,66
17,,,,,,,,,,,,,,,,1.6152,,1.1067,,,,,132,66
18,,,,,,,,,,,,,,,,,1.3858,,0.9272,,,,132,66
19,,,,,,,,,,,,,,,,,,1.1067,,,,0.2293,132,66
20,,,,,,,,,,,,,,,,,,,0.9272,,0.3689,,132,66
21,,,,,,,,,,,,,,,,,,,,0.5484,,0.2293,132,66
22,,,,,,,,,,,,,,,,,,,,0.5484,0.3689,,132,66
`;

// Split the CSV string by lines and then by commas
let rows = csvData
  .trim()
  .split("\n")
  .map((row) => row.split(","));

for (let row = 1; row < rows.length; row++) {
  const resourceId = rows[row][0];
  let resource_list = [];
  let resource_amounts = [];

  for (let col = 1; col < rows[row].length; col++) {
    const amount = rows[row][col];
    if (amount !== "") {
      resource_list.push(rows[0][col]); // push resource_id from header row
      resource_amounts.push(parseInt((Number(amount) * 1000) / 12)); // push resource_amount from current row
    }
  }

  let number_of_resources = resource_list.length;
  if (number_of_resources > 0) {
    console.log(`# resourceId: ${resourceId}`);
    console.log(
      `"sozo execute $CONFIG_SYSTEMS set_labor_cost_resources --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,${resourceId},${packResources(
        resource_list,
      )},${number_of_resources}"`,
    );

    for (let i = 0; i < resource_list.length; i++) {
      console.log(
        `"sozo execute $CONFIG_SYSTEMS set_labor_cost_amount --account-address $DOJO_ACCOUNT_ADDRESS --calldata $SOZO_WORLD,${resourceId},${resource_list[i]},${resource_amounts[i]}"`,
      );
    }
  }
}
