## Quickly Build

in root path

```
 bun install

 bun run build-packages

 bun run build-client  

 cd client && bun run dev
```

## build contracts

```
cd contracts/
```

run katana:

```
katana --disable-fee --invoke-max-steps 4294967295
```

build & deploy contract

```
sozo build 

sozo migrate
```

run indexer:

```
 torii --world 0x57abdb7a9b7d35a4c628ba0a0d1209bd5793b78f1efce4bb3a405ef3f9ad383
```

auth:

```
cd scripts/cc  && sh cc_auth.sh
```
