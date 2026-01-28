---
name: cairo-contract
description: Develop Cairo contracts for Eternum with strict TDD workflow - plan, test first, then implement
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep, TodoWrite]
---

# Cairo Contract Development (Eternum)

Develop Cairo contracts for the Eternum project using Test-Driven Development. This skill enforces a strict workflow:
**Plan -> Test First -> Implement -> Review**.

## When to Use This Skill

- "Create a new system for X"
- "Add a model for Y"
- "Implement feature Z in Cairo"
- "Develop a new contract"
- "Build game logic for W"

## Iron Law

**NO IMPLEMENTATION CODE WITHOUT A FAILING TEST FIRST.**

If you write implementation before tests, delete it and start over.

---

## Phase 1: Plan

### 1.1 Gather Requirements

Before writing any code, understand:

- What is the business logic? What should happen?
- What models are needed to store state?
- What systems will modify that state?
- What are the edge cases and failure modes?

### 1.2 Design Architecture

Create a design:

**Models Needed:**

```
[Model Name]
- #[key] field_name: type  <- what uniquely identifies this?
- data_field: type
```

**Systems Needed:**

```
[System Name]
- function_name(params) -> what it does
```

**Relationships:**

```
System X reads/writes Model A, B
```

### 1.3 Identify Existing Patterns

Search for similar implementations:

```bash
# Find similar models
Grep("similar_concept", "contracts/game/src/models")

# Find similar systems
Grep("similar_action", "contracts/game/src/systems")
```

### 1.4 Create Todo List

Track each piece with TodoWrite:

```
TodoWrite([
  {content: "Write tests for Model A", status: "pending", activeForm: "Writing tests for Model A"},
  {content: "Implement Model A (make tests pass)", status: "pending", activeForm: "Implementing Model A"},
  {content: "Write tests for System X", status: "pending", activeForm: "Writing tests for System X"},
  {content: "Implement System X (make tests pass)", status: "pending", activeForm: "Implementing System X"},
  {content: "Review code", status: "pending", activeForm: "Reviewing code"},
])
```

---

## Phase 2: TDD - Test First

### 2.1 Test File Location

```
contracts/game/src/systems/<feature>/tests/<test_name>.cairo
```

### 2.2 Eternum Test Template

```cairo
#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::WorldStorageTrait;
    use dojo_cairo_test::{ContractDef, ContractDefTrait, NamespaceDef, TestResource};
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR};

    // Import models (use m_ prefix for TEST_CLASS_HASH)
    use crate::models::your_feature::{YourModel, m_YourModel};

    // Import systems
    use crate::systems::your_feature::contracts::your_systems::{
        IYourSystemsDispatcher, IYourSystemsDispatcherTrait, your_systems,
    };

    // Import testing helpers
    use crate::utils::testing::helpers::{
        MOCK_TICK_CONFIG, MOCK_CAPACITY_CONFIG, tspawn_world,
        tstore_tick_config, tstore_capacity_config,
    };

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                // Models (use m_ prefix for TEST_CLASS_HASH)
                TestResource::Model(m_YourModel::TEST_CLASS_HASH),
                // Contracts
                TestResource::Contract(your_systems::TEST_CLASS_HASH),
            ].span(),
        }
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(DEFAULT_NS(), @"your_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ].span()
    }

    fn setup() -> (WorldStorage, IYourSystemsDispatcher) {
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // Store required configs
        tstore_tick_config(ref world, MOCK_TICK_CONFIG());
        tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());

        // Get system dispatcher
        let (system_addr, _) = world.dns(@"your_systems").unwrap();
        let dispatcher = IYourSystemsDispatcher { contract_address: system_addr };

        (world, dispatcher)
    }

    #[test]
    #[available_gas(3000000000000)]
    fn test_happy_path() {
        let (mut world, dispatcher) = setup();

        // Arrange
        let owner = starknet::contract_address_const::<'owner'>();
        starknet::testing::set_contract_address(owner);

        // Act
        dispatcher.your_action(/* params */);

        // Assert
        let result: YourModel = world.read_model(/* key */);
        assert!(result.field == expected_value, "wrong field value");
    }

    #[test]
    #[available_gas(3000000000000)]
    #[should_panic(expected: ('Expected error', 'ENTRYPOINT_FAILED'))]
    fn test_fails_when_unauthorized() {
        let (mut world, dispatcher) = setup();

        let unauthorized = starknet::contract_address_const::<'unauthorized'>();
        starknet::testing::set_contract_address(unauthorized);

        // This should panic
        dispatcher.your_action(/* params */);
    }
}
```

### 2.3 Watch Test Fail (RED)

Run the test to verify it fails:

```bash
cd contracts/game
scarb test test_your_feature
```

**MANDATORY**: Confirm the test fails because the feature is missing, not due to syntax errors.

---

## Phase 3: Implement (GREEN)

### 3.1 Model Template

```cairo
use starknet::ContractAddress;
use crate::alias::ID;

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct YourModel {
    #[key]
    pub entity_id: ID,
    pub owner: ContractAddress,
    pub value: u128,
}

#[generate_trait]
pub impl YourModelImpl of YourModelTrait {
    fn some_helper(self: @YourModel) -> u128 {
        *self.value * 2
    }

    fn assert_valid(self: @YourModel) {
        assert!(*self.value > 0, "value must be positive");
    }
}
```

### 3.2 System Template

```cairo
use crate::alias::ID;

#[starknet::interface]
pub trait IYourSystems<T> {
    fn your_action(ref self: T, entity_id: ID, param1: u128);
}

#[dojo::contract]
pub mod your_systems {
    use dojo::model::ModelStorage;
    use crate::alias::ID;
    use crate::constants::DEFAULT_NS;
    use crate::models::your_feature::{YourModel, YourModelTrait};
    use crate::models::owner::OwnerAddressTrait;
    use crate::models::structure::StructureOwnerStoreImpl;

    #[abi(embed_v0)]
    impl YourSystemsImpl of super::IYourSystems<ContractState> {
        fn your_action(ref self: ContractState, entity_id: ID, param1: u128) {
            let mut world = self.world(DEFAULT_NS());

            // Verify ownership
            let owner = StructureOwnerStoreImpl::retrieve(ref world, entity_id);
            owner.assert_caller_owner();

            // Read current state
            let mut model: YourModel = world.read_model(entity_id);

            // Validate
            model.assert_valid();

            // Modify state
            model.value = param1;

            // Write back
            world.write_model(@model);
        }
    }
}
```

### 3.3 Watch Test Pass (GREEN)

```bash
scarb test test_your_feature
```

All tests must pass before proceeding.

### 3.4 Refactor

Clean up code while keeping tests green. Run tests after each change.

---

## Phase 4: Review

### 4.1 Code Quality Checklist

**Models:**

- [ ] Has `#[derive(Introspect, Copy, Drop, Serde)]`
- [ ] Has `#[dojo::model]`
- [ ] Keys come before data fields
- [ ] Uses appropriate types (u8 vs u32 vs u128)

**Systems:**

- [ ] Has `#[starknet::interface]` trait
- [ ] Has `#[dojo::contract]` module
- [ ] Checks ownership/authorization
- [ ] Validates inputs
- [ ] Uses `assert!` with clear error messages

**Tests:**

- [ ] Tests happy path
- [ ] Tests failure cases with `#[should_panic]`
- [ ] Tests edge cases
- [ ] Uses proper setup

### 4.2 Security Review

Check for:

- Integer overflow/underflow
- Missing authorization checks
- State consistency issues

### 4.3 Run Full Test Suite

```bash
cd contracts/game
scarb test
```

---

## Integration with Dojo Skills

For reference on patterns:

```
# Model design patterns
Skill("book:dojo-model")

# System patterns
Skill("book:dojo-system")

# Test patterns
Skill("book:dojo-test")

# Code review
Skill("book:dojo-review")
```

---

## Quick Reference

### File Locations

```
contracts/game/src/
├── models/
│   └── your_feature.cairo          # Models
├── systems/
│   └── your_feature/
│       ├── contracts.cairo         # Systems
│       └── tests/
│           └── test_feature.cairo  # Tests
└── utils/testing/helpers.cairo     # Test helpers
```

### Test Commands

```bash
# Run specific test
scarb test test_your_feature

# Run all tests
scarb test

# Build only
scarb build
```

### Common Imports

```cairo
// Models
use dojo::model::{ModelStorage, ModelStorageTest};
use crate::alias::ID;

// Systems
use dojo::model::ModelStorage;
use crate::constants::DEFAULT_NS;

// Tests
use dojo_cairo_test::{NamespaceDef, TestResource, ContractDef, ContractDefTrait};
use crate::utils::testing::helpers::{tspawn_world, MOCK_TICK_CONFIG};
```

### Key Helper Functions

From `utils/testing/helpers.cairo`:

- `tspawn_world(namespace_def, contract_defs)` - Creates test world
- `MOCK_*_CONFIG()` - Config factory functions
- `tstore_*_config()` - Store config helpers
- `tgrant_resources()` - Grant resources to entity
- `tspawn_simple_realm()` - Create realm for testing
- `tspawn_explorer()` - Create explorer for testing

---

## Workflow Summary

```
1. PLAN
   - Understand requirements
   - Design models/systems
   - Create todo list

2. TEST FIRST (RED)
   - Create test file
   - Write failing tests
   - Verify tests fail

3. IMPLEMENT (GREEN)
   - Write minimal code
   - Verify tests pass

4. REFACTOR
   - Clean up code
   - Keep tests green

5. REVIEW
   - Code quality check
   - Security review
   - Full test suite
```

**Remember: Delete any implementation code written before tests.**
