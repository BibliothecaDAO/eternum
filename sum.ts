import donkeys from "./donkeys.json";

const total = donkeys.reduce((acc, donkey) => acc + Number(donkey.amount), 0);
