const realms = require('./realms_raw.json');
const fs = require('fs');

const newfile = () => {
  let n = [];
  for (let i = 1; i <= 8000; i++) {
    n.push({
      id: i,
      order: realms[i].attributes.find((a) => a.trait_type === 'Order').value,
    });
  }
  return n;
};

fs.writeFile('realms_raw.json', JSON.stringify(newfile()), (err) => {
  if (err) {
    console.error(err);
    // eslint-disable-next-line sonarjs/no-redundant-jump
    return;
  }
});
