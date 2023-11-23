### Table of Contents

- [Installation](#Installation)
- [Contributing](#Contributing)
- [License](#License)

# Installation

Eternum is built using dojo engine. You can install the dojo toolchain by:

```
curl -L https://install.dojoengine.org | bash
```

Read the dojo book [here](https://book.dojoengine.org/index.html) to discover the toolchain in depth.

# Contributing

## Updating the remote eternum world

1. In contracts directory, add your new models/systems
2. Build your new contracts: `sozo build`
3. In Scarb.toml comment out account_address and private_key in dev and uncomment in prod
4. Update remote eternum world: `sozo migrate rpc-url https://api.cartridge.gg/x/eternum2/katana`
