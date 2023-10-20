## Eternum SDK

These packages are designed to allow for easy client integration into the Eternum world

### Packages

- [eternum](./packages/eternum)


### Enviroment setup

We are using [bun](https://bun.sh/) in this repo install it by:

```console
curl -fsSL https://bun.sh/install | bash
```

### Development

From the root to install all the packages deps
```
bun install
``` 

### Building packages

Navigate to a package and run the following. This will launch bun and watch for local changes, automatically compiling and updating.

```
bun run build --watch
```

### Examples

To run the example which has the linked packages: