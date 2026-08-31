# Dojo World Factory

Contract-first factory for deploying Dojo worlds directly on-chain, with built-in support for large projects that need
to spread setup work across many transactions. The factory keeps its own cursor state, so clients can keep hitting the
`deploy` entrypoint until everything is registered.

The source is heavily commented—start in `src/factory.cairo` for orchestration, `src/factory_models.cairo` for
configuration shape, and `src/world_models.cairo` for the data the factory publishes.

## Quick Start

- Install the Dojo toolchain (`sozo`, `katana`, `torii`).
- Build and deploy the factory:
  ```bash
  sozo -P <PROFILE> build
  sozo -P <PROFILE> migrate
  ```

## Factory Configuration

Configuration is stored on-chain in the `FactoryConfig` model. Each config version is keyed by `version`, so you can
keep multiple setups side-by-side.

| Field                          | What it controls                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `version`                      | Registry key for this config. Pass it to `deploy`.                                                    |
| `max_actions`                  | Safety valve for gas per call. Use `20` for most projects, bump down if you hit limits.               |
| `world_class_hash`             | Declared world contract class hash.                                                                   |
| `default_namespace`            | Namespace automatically registered for the world.                                                     |
| `default_namespace_writer_all` | When `true`, every contract listed below gets writer access to the namespace.                         |
| `contracts`                    | Array of `FactoryConfigContract` describing each Dojo contract to register and optionally initialize. |
| `models` / `events`            | Class hashes of the models and events you need live in the world.                                     |
| `libraries`                    | Array of `FactoryConfigLibrary` describing each Dojo library to register.                             |

`FactoryConfigContract` lets you tailor per-contract behavior:

- `selector`: Dojo selector used during registration.
- `class_hash`: Declared class hash to deploy.
- `init_args`: Arguments passed to the contract’s `dojo_init`.
- `writer_of_resources` / `owner_of_resources`: Extra granular permissions beyond the default namespace. You can ignore
  these if you are using `default_namespace_writer_all`.

`FactoryConfigLibrary` lets you tailor per-library behavior:

- `class_hash`: Declared class hash to register.
- `name`: Name of the library.
- `version`: Version of the library, without the prefix `v`.

### Setting the configuration

If you want to test your config, you can use the `sozo inspect --output-factory` command to produce the serialized
config string.

1. Produce the serialized config string, either manually or via `sozo inspect --output-factory` (sozo 1.7.2+). You will
   want to run `sozo inspect` inside your project directory, and not the factory directory.
2. Call the factory:
   ```bash
   sozo -P <PROFILE> execute factory set_config <VERSION> <...serialized config values...>
   ```
3. Double-check what is stored:
   ```bash
   sozo -P <PROFILE> model get FactoryConfig <VERSION>
   ```

### Current limitation

`FactoryConfig` is one large Dojo model. Because Dojo models are capped at ~300 felts, extremely large projects with
many contracts, models, or events may bump into that serialization ceiling. Until we split the config across multiple
models, keep an eye on growth and trim unused resources if you get close to the limit.

## Deploying a World once the configuration is set

```bash
# First transaction
sozo -P <PROFILE> execute factory deploy sstr:<WORLD_NAME> <VERSION>

# Repeat until the world is fully registered
sozo -P <PROFILE> execute factory deploy sstr:<WORLD_NAME> <VERSION>
```

The call sequence walks through these stages automatically: world deployment, namespace registration, contract
deployment, model/event registration, permission grants, and finally `dojo_init` for each contract. `max_actions`
governs how many of those actions happen per transaction.

Track progress with:

```bash
sozo -P <PROFILE> model get FactoryDeploymentCursor <VERSION>
```

Once `completed` is `true`, the factory also writes:

- `WorldDeployed` with block number and tx hash for auditing.
- `WorldContract` records mapping each contract selector back to the deployed address.

## Working on the Project

- Run `sozo build` before committing changes; it exercises the same pipeline the factory drives.
- Run `snforge test` to run the tests, main test file is `tests/lib.cairo`.
- The main contract lives in `src/factory.cairo`; configuration models are in `src/factory_models.cairo`; interfaces and
  storage helpers are in `src/interface.cairo` and `src/world_models.cairo`.
- Comments in the source explain the cursor mechanics, permission sequencing, and known optimization opportunities. If
  you add new behavior, keep those comments in sync.
