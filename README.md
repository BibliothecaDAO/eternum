

<!-- <picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/mark-dark.svg">
  <img alt="Dojo logo" align="right" width="120" src=".github/mark-light.svg">
</picture> -->

<a href="https://twitter.com/lootrealms">
<img src="https://img.shields.io/twitter/follow/lootrealms?style=social"/>
</a>
<a href="https://twitter.com/BibliothecaDAO">
<img src="https://img.shields.io/twitter/follow/BibliothecaDAO?style=social"/>
</a>


[![discord](https://img.shields.io/badge/join-bibliothecadao-black?logo=discord&logoColor=white)](https://discord.gg/bibliothecadao)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

![background](./bg.png)

# Realms: Eternum
Eternum is the first mod of the Realms Autonomous World built on [dojo](https://github.com/dojoengine/dojo). It will form the base economic layer of the Autonomous World.

### Table of Contents
- [Installation](#Installation)
- [Contributing](#Contributing)
- [License](#License)

# Development

## Prerequisites
You will require an understanding of Cairo 1.0 and smart contracts in order to contribute to the code base.

## Cairo development setup guide

### Linux

#### 1. Install Rust and Dependencies

Start by installing Rust and running the test suite to confirm your setup:

```bash
rustup override set stable && rustup update
```

> Note: Depending on your Linux distribution, you may need to install additional dependencies. Make sure to install any suggested or missing dependencies that arise during the setup process.

#### 2. Install Scarb Package Manager

Next, install the [Scarb](https://docs.swmansion.com/scarb) package manager by running:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh
```

#### 3. Setup Cairo VSCode Extension

For proper linting and syntax highlighting, you should install the Cairo 1.0 extension for Visual Studio Code.

- Clone the Cairo repository somewhere on your machine (make sure not to clone within the Eternum directory).

```bash
git clone https://github.com/starkware-libs/cairo.git
```

- Install the Cairo Language Server extension. Here's a step-by-step guide, or you can follow the [official instructions](https://github.com/starkware-libs/cairo/blob/main/vscode-cairo/README.md).

Navigate to the vscode-cairo directory:

```bash
cd cairo/vscode-cairo
```

Install the required packages:

```bash
sudo npm install --global @vscode/vsce
npm install
```

Package the extension:

```bash
vsce package
```

Install the extension:

```bash
code --install-extension cairo1*.vsix
```

The Cairo language server should now be installed globally in your Visual Studio Code. If you have the server enabled, Scarb should automatically pick this up and start linting your Cairo files.

#### 4. Dojo

Eternum is built using dojo engine. You can install the dojo toolchain by:

```
curl -L https://install.dojoengine.org | bash
```

Read the dojo book [here](https://book.dojoengine.org/index.html) to discover the toolchain in depth.

---
## Contributing
We welcome contributions from the community! Please read the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on how to contribute to the project. 

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.