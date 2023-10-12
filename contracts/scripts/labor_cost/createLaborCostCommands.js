const { packResources, unpackResources } = require("../pack_resources.js");

// Replace with your CSV string
let csvData = `
,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22
254,2.0585,1.6177,1.5733,,,,,,,,,,,,,,,,,,,
255,,,,3.4770,2.9152,2.2903,,,,,,,,,,,,,,,,
1,,39.2921,38.2154,,,,,,,,,,,,,,,,,,,
2,50.0000,,38.2154,,,,,,,,,,,,,,,,,,,
3,,39.2921,,26.3509,,,,,,,,,,,,,,,,,,
4,50.0000,,,,22.0937,,,,,,,,,,,,,,,,,
5,,,,26.3509,,17.3579,,,,,,,,,,,,,,,,
6,,,,,22.0937,,11.7547,,,,,,,,,,,,,,,
7,,,,,,17.3579,,9.5414,,,,,,,,,,,,,,
8,,,,,,,11.7547,,9.1127,,,,,,,,,,,,,
9,,,,,,,,9.5414,,5.9222,,,,,,,,,,,,
10,,,,,,,,,9.1127,,2.9910,,,,,,,,,,,
11,,,,,,,,,,5.9222,,2.4626,,,,,,,,,,
12,,,,,,,,,,,2.9910,,2.3829,,,,,,,,,
13,,,,,,,,,,,,2.4626,,2.3829,,,,,,,,
14,,,,,,,,,,,,,2.3829,,1.7149,,,,,,,
15,,,,,,,,,,,,,,2.3829,,1.6152,,,,,,
16,,,,,,,,,,,,,,,1.7149,,1.3858,,,,,
17,,,,,,,,,,,,,,,,1.6152,,1.1067,,,,
18,,,,,,,,,,,,,,,,,1.3858,,0.9272,,,
19,,,,,,,,,,,,,,,,,,1.1067,,,,0.2293
20,,,,,,,,,,,,,,,,,,,0.9272,,0.3689,
21,,,,,,,,,,,,,,,,,,,,0.5484,,0.2293
22,,,,,,,,,,,,,,,,,,,,0.5484,0.3689,
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
      `"sozo execute --world "$world" SetLaborCostResources --account-address $DOJO_ACCOUNT_ADDRESS --calldata ${resourceId},${packResources(
        resource_list
      )},${number_of_resources}"`
    );

    for (let i = 0; i < resource_list.length; i++) {
      console.log(
        `"sozo execute --world "$world" SetLaborCostAmount --account-address $DOJO_ACCOUNT_ADDRESS --calldata ${resourceId},${resource_list[i]},${resource_amounts[i]}"`
      );
    }
  }
}
