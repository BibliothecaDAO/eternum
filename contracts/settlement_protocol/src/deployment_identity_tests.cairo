use settlement_protocol::deployment_identity_spike::{
    ComponentClassEntry, ComponentSaltEntry, KatanaGenesisArtifactCommitment, appchain_settlement_config_hash,
    assert_canonical_shell_constructor, build_shell_constructor, calculate_shell_address, component_classes_hash,
    component_salts_hash, deployment_address_recipe_hash, deployment_manifest_hash, deployment_release_identity_hash,
    derive_component_salt, katana_genesis_artifact_hash, katana_genesis_profile_hash, shell_constructor_schema_hash,
    validate_component_vectors,
};
use settlement_protocol::deterministic_shell_deployer_spike::{
    IDeterministicShellDeployerSpikeDispatcher, IDeterministicShellDeployerSpikeDispatcherTrait,
};
use settlement_protocol::deterministic_shell_spike::{
    IDeterministicShellSpikeDispatcher, IDeterministicShellSpikeDispatcherTrait, IDeterministicShellSpikeSafeDispatcher,
    IDeterministicShellSpikeSafeDispatcherTrait,
};
use settlement_protocol::resolved_identity_coordinator_spike::{
    IResolvedIdentityCoordinatorSpikeDispatcher, IResolvedIdentityCoordinatorSpikeDispatcherTrait,
    IResolvedIdentityCoordinatorSpikeSafeDispatcher, IResolvedIdentityCoordinatorSpikeSafeDispatcherTrait,
};
use settlement_protocol::types::{AppchainSettlementConfig, DeploymentAddressRecipe, DeploymentManifest};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, get_class_hash, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::syscalls::get_class_hash_at_syscall;
use starknet::{ContractAddress, SyscallResultTrait};

const SHELL_CLASS_HASH: felt252 = 2975336112983838011537474479977222012469309290043603504937302646832571648430;
const EXPECTED_L1_CLASSES_HASH: felt252 = 2448275967979786194446676491712999101319068555184201719877204393275639858673;
const EXPECTED_L1_SALTS_HASH: felt252 = 3505253797174767541063694165096144900280934432863788529130817487557344958;
const EXPECTED_L2_CLASSES_HASH: felt252 = 2420648184806320996417893022820794234055592229478250173659637938242157489214;
const EXPECTED_L2_SALTS_HASH: felt252 = 2077297084164227048684413603765498862529704097244154474133001967931489281212;
const EXPECTED_SCHEMA_HASH: felt252 = 142648721382604452984239347845075407126174041554110301600940990593375580740;
const EXPECTED_RECIPE_HASH: felt252 = 2556113502109001342135143997708332696022132882327418628510877076606391017500;
const EXPECTED_CONFIG_HASH: felt252 = 2440349802411679907900717044100784412691507455391586121564891824609497530747;
const EXPECTED_GENESIS_HASH: felt252 = 2755575012171324138925823736749554224397042542469021105241573385536245276253;
const EXPECTED_MANIFEST_HASH: felt252 = 551294526183067666271687852760780739369902242141807066680029688105150180696;
const EXPECTED_RELEASE_IDENTITY_HASH: felt252 =
    603758342404938525383757387010274700214909454470800171312210071446090206708;
const EXPECTED_GENESIS_PROFILE_HASH: felt252 =
    2511927115500608927782519141311620281530292891014038001403986071928731451902;

#[test]
fn cairo_reproduces_the_typescript_and_deployer_address_dag() {
    let l1_classes = l1_component_classes();
    let l2_classes = l2_component_classes();
    let l1_kinds = component_kinds(l1_classes.span());
    let l2_kinds = component_kinds(l2_classes.span());
    let l1_salts = component_salts(l1_kinds.span());
    let l2_salts = component_salts(l2_kinds.span());
    validate_component_vectors(1, 7001, l1_kinds.span(), l1_classes.span(), l1_salts.span());
    validate_component_vectors(1, 7001, l2_kinds.span(), l2_classes.span(), l2_salts.span());

    assert!(component_classes_hash(l1_classes.span()) == EXPECTED_L1_CLASSES_HASH);
    assert!(component_salts_hash(l1_salts.span()) == EXPECTED_L1_SALTS_HASH);
    assert!(component_classes_hash(l2_classes.span()) == EXPECTED_L2_CLASSES_HASH);
    assert!(component_salts_hash(l2_salts.span()) == EXPECTED_L2_SALTS_HASH);
    assert!(shell_constructor_schema_hash() == EXPECTED_SCHEMA_HASH);

    let recipe = recipe_fixture(10001, false, 11001);
    assert!(deployment_address_recipe_hash(@recipe) == EXPECTED_RECIPE_HASH);
    assert_shell_addresses(@recipe, l1_classes.span(), l1_salts.span(), expected_l1_addresses().span(), 10001);
    assert_shell_addresses(@recipe, l2_classes.span(), l2_salts.span(), expected_l2_addresses().span(), 0);
}

#[test]
fn cairo_reproduces_the_complete_genesis_manifest_and_seal_hashes() {
    assert!(appchain_settlement_config_hash(@genesis_config_fixture()) == EXPECTED_CONFIG_HASH);
    assert!(katana_genesis_artifact_hash(@genesis_artifact_fixture()) == EXPECTED_GENESIS_HASH);
    assert!(deployment_manifest_hash(@manifest_fixture()) == EXPECTED_MANIFEST_HASH);
    assert!(deployment_release_identity_hash(@manifest_fixture()) == EXPECTED_RELEASE_IDENTITY_HASH);
    assert!(katana_genesis_profile_hash(@genesis_artifact_fixture()) == EXPECTED_GENESIS_PROFILE_HASH);
}

#[test]
fn deployer_mode_and_primitive_are_recipe_inputs_without_downstream_cycles() {
    let canonical = recipe_fixture(10001, false, 11001);
    let wrong_deployer = recipe_fixture(10002, false, 11001);
    let wrong_mode = recipe_fixture(10001, true, 11001);
    let wrong_primitive = recipe_fixture(10001, false, 11002);
    let salt = derive_component_salt(1, 7001, 1);
    let canonical_address = shell_address(@canonical, 1, SHELL_CLASS_HASH, salt, 10001);

    assert!(deployment_address_recipe_hash(@wrong_deployer) != EXPECTED_RECIPE_HASH);
    assert!(shell_address(@wrong_deployer, 1, SHELL_CLASS_HASH, salt, 10002) != canonical_address);
    assert!(deployment_address_recipe_hash(@wrong_mode) != EXPECTED_RECIPE_HASH);
    assert!(shell_address(@wrong_mode, 1, SHELL_CLASS_HASH, salt, 0) != canonical_address);
    assert!(deployment_address_recipe_hash(@wrong_primitive) != EXPECTED_RECIPE_HASH);
    assert!(shell_address(@wrong_primitive, 1, SHELL_CLASS_HASH, salt, 10001) == canonical_address);
}

#[test]
#[feature("safe_dispatcher")]
fn every_protected_operation_is_inert_until_one_exact_identity_seal() {
    let operator = address(9901);
    let coordinator_address = deploy_coordinator(operator);
    let coordinator = IResolvedIdentityCoordinatorSpikeDispatcher { contract_address: coordinator_address };
    let safe_coordinator = IResolvedIdentityCoordinatorSpikeSafeDispatcher { contract_address: coordinator_address };
    let (all_component_kinds, shell_addresses) = deploy_all_shells(coordinator_address);
    let protected_operations = array![1_u8, 2_u8, 3_u8, 4_u8, 5_u8, 6_u8, 7_u8, 8_u8, 9_u8, 10_u8];

    for shell_address in shell_addresses.span() {
        let safe_shell = IDeterministicShellSpikeSafeDispatcher { contract_address: *shell_address };
        for operation in protected_operations.span() {
            assert!(safe_shell.guarded_operation(*operation, 2).is_err());
        }
        assert!(safe_shell.authenticated_component_call(2).is_err());
    }
    assert!(
        safe_coordinator
            .seal_resolved_identity(
                recipe_fixture(10002, false, 11001),
                l1_component_classes().span(),
                l1_component_salts().span(),
                l2_component_classes().span(),
                l2_component_salts().span(),
                genesis_config_fixture(),
                genesis_artifact_fixture(),
                manifest_fixture(),
            )
            .is_err(),
    );
    let rewritten_artifact = changed_state_root_genesis_artifact_fixture();
    let rewritten_manifest = DeploymentManifest {
        genesis_hash: katana_genesis_artifact_hash(@rewritten_artifact), ..manifest_fixture(),
    };
    assert!(
        safe_coordinator
            .seal_resolved_identity(
                recipe_fixture(10001, false, 11001),
                l1_component_classes().span(),
                l1_component_salts().span(),
                l2_component_classes().span(),
                l2_component_salts().span(),
                genesis_config_fixture(),
                rewritten_artifact,
                rewritten_manifest,
            )
            .is_err(),
    );
    let rewritten_config = AppchainSettlementConfig { timing_policy_hash: 991337, ..genesis_config_fixture() };
    let config_rewritten_artifact = KatanaGenesisArtifactCommitment {
        config_hash: appchain_settlement_config_hash(@rewritten_config), ..genesis_artifact_fixture(),
    };
    let config_rewritten_manifest = DeploymentManifest {
        config_snapshot_hash: appchain_settlement_config_hash(@rewritten_config),
        genesis_hash: katana_genesis_artifact_hash(@config_rewritten_artifact),
        ..manifest_fixture(),
    };
    assert!(
        safe_coordinator
            .seal_resolved_identity(
                recipe_fixture(10001, false, 11001),
                l1_component_classes().span(),
                l1_component_salts().span(),
                l2_component_classes().span(),
                l2_component_salts().span(),
                rewritten_config,
                config_rewritten_artifact,
                config_rewritten_manifest,
            )
            .is_err(),
    );
    assert!(
        safe_coordinator
            .seal_resolved_identity(
                recipe_fixture(10001, false, 11001),
                l1_component_classes().span(),
                l1_component_salts().span(),
                l2_component_classes().span(),
                l2_component_salts().span(),
                genesis_config_fixture(),
                changed_state_root_genesis_artifact_fixture(),
                manifest_fixture(),
            )
            .is_err(),
    );
    assert!(
        safe_coordinator
            .seal_resolved_identity(
                recipe_fixture(10001, false, 11001),
                permuted_l1_component_classes().span(),
                permuted_l1_component_salts().span(),
                l2_component_classes().span(),
                l2_component_salts().span(),
                genesis_config_fixture(),
                genesis_artifact_fixture(),
                manifest_fixture(),
            )
            .is_err(),
    );
    coordinator
        .seal_resolved_identity(
            recipe_fixture(10001, false, 11001),
            l1_component_classes().span(),
            l1_component_salts().span(),
            l2_component_classes().span(),
            l2_component_salts().span(),
            genesis_config_fixture(),
            genesis_artifact_fixture(),
            manifest_fixture(),
        );
    assert!(
        safe_coordinator
            .seal_resolved_identity(
                recipe_fixture(10001, false, 11001),
                l1_component_classes().span(),
                l1_component_salts().span(),
                l2_component_classes().span(),
                l2_component_salts().span(),
                genesis_config_fixture(),
                genesis_artifact_fixture(),
                manifest_fixture(),
            )
            .is_err(),
    );
    assert!(coordinator.is_identity_sealed());
    assert!(coordinator.resolved_identity() == (EXPECTED_RECIPE_HASH, EXPECTED_MANIFEST_HASH, EXPECTED_GENESIS_HASH));

    let authenticated_peer = *shell_addresses.at(1);
    let committed_l2_peer = *shell_addresses.at(14);
    for index in 0..shell_addresses.len() {
        let shell_address = *shell_addresses.at(index);
        let shell = IDeterministicShellSpikeDispatcher { contract_address: shell_address };
        let safe_shell = IDeterministicShellSpikeSafeDispatcher { contract_address: shell_address };
        assert!(coordinator.committed_component_address(*all_component_kinds.at(index)) == shell_address);
        if index < 14 {
            assert!(coordinator.component_address(*all_component_kinds.at(index)) == shell_address);
            start_cheat_caller_address(shell_address, authenticated_peer);
            assert!(safe_shell.guarded_operation(1, 1).is_err());
            for operation in protected_operations.span() {
                shell.guarded_operation(*operation, 2);
            }
            shell.authenticated_component_call(2);
            stop_cheat_caller_address(shell_address);
            assert!(shell.protected_call_count() == 11);
            assert!(shell.resolved_identity() == (EXPECTED_RECIPE_HASH, EXPECTED_MANIFEST_HASH, EXPECTED_GENESIS_HASH));
            start_cheat_caller_address(shell_address, committed_l2_peer);
            assert!(safe_shell.guarded_operation(1, 101).is_err());
            stop_cheat_caller_address(shell_address);
        } else {
            assert!(safe_coordinator.component_address(*all_component_kinds.at(index)).is_err());
            assert!(safe_shell.guarded_operation(1, 2).is_err());
            assert!(safe_shell.authenticated_component_call(2).is_err());
            assert!(safe_shell.resolved_identity().is_err());
            assert!(shell.protected_call_count() == 0);
        }
        assert!(shell.identity() == (coordinator_address, 1, 7001, 8001, *all_component_kinds.at(index)));
    }
}

#[test]
#[feature("safe_dispatcher")]
fn coordinator_abort_is_one_way_and_blocks_sealing() {
    let operator = address(9901);
    let coordinator_address = deploy_coordinator(operator);
    let coordinator = IResolvedIdentityCoordinatorSpikeDispatcher { contract_address: coordinator_address };
    let safe_coordinator = IResolvedIdentityCoordinatorSpikeSafeDispatcher { contract_address: coordinator_address };
    let (_, _) = deploy_all_shells(coordinator_address);

    assert!(safe_coordinator.abort_unsealed().is_err());
    start_cheat_caller_address(coordinator_address, operator);
    coordinator.abort_unsealed();
    stop_cheat_caller_address(coordinator_address);
    assert!(safe_coordinator.abort_unsealed().is_err());
    assert!(
        safe_coordinator
            .seal_resolved_identity(
                recipe_fixture(10001, false, 11001),
                l1_component_classes().span(),
                l1_component_salts().span(),
                l2_component_classes().span(),
                l2_component_salts().span(),
                genesis_config_fixture(),
                genesis_artifact_fixture(),
                manifest_fixture(),
            )
            .is_err(),
    );
}

#[test]
fn actual_deploy_syscall_matches_calculated_address_class_and_identity() {
    let coordinator_address = deploy_coordinator(address(9901));
    let shell_class = declare("DeterministicShellSpike").unwrap().contract_class();
    let shell_class_hash = *shell_class.class_hash;
    let shell_class_hash_felt: felt252 = shell_class_hash.into();
    let l1_deployer_address = deploy_shell_deployer_at(coordinator_address, address(10001), false);
    let l2_deployer_address = deploy_shell_deployer_at(coordinator_address, address(10002), true);
    let l1_deployer = IDeterministicShellDeployerSpikeDispatcher { contract_address: l1_deployer_address };
    let l2_deployer = IDeterministicShellDeployerSpikeDispatcher { contract_address: l2_deployer_address };
    let component_kinds = component_kinds_for_both_layers();
    let l1_addresses = expected_l1_addresses();
    let l2_addresses = expected_l2_addresses();

    for index in 0..component_kinds.len() {
        let component_kind = *component_kinds.at(index);
        let (deployed, expected) = if index < l1_addresses.len() {
            (l1_deployer.deploy_component(component_kind, shell_class_hash), *l1_addresses.at(index))
        } else {
            let l2_index = index - l1_addresses.len();
            (l2_deployer.deploy_component(component_kind, shell_class_hash), *l2_addresses.at(l2_index))
        };
        let salt = derive_component_salt(1, 7001, component_kind);
        let constructor = build_shell_constructor(coordinator_address, 1, 7001, 8001, component_kind);
        let effective_deployer: felt252 = if index < l1_addresses.len() {
            10001
        } else {
            0
        };
        assert!(
            calculate_shell_address(salt, shell_class_hash_felt, constructor.span(), effective_deployer) == expected,
        );
        assert!(deployed.into() == expected);
        assert!(get_class_hash(deployed) == shell_class_hash);
        let shell = IDeterministicShellSpikeDispatcher { contract_address: deployed };
        assert!(shell.identity() == (coordinator_address, 1, 7001, 8001, component_kind));
    }
}

#[test]
#[feature("safe_dispatcher")]
fn l1_seal_keeps_absent_l2_shells_as_commitments_only() {
    let coordinator_address = deploy_coordinator(address(9901));
    let coordinator = IResolvedIdentityCoordinatorSpikeDispatcher { contract_address: coordinator_address };
    let safe_coordinator = IResolvedIdentityCoordinatorSpikeSafeDispatcher { contract_address: coordinator_address };
    deploy_l1_shells(coordinator_address);

    coordinator
        .seal_resolved_identity(
            recipe_fixture(10001, false, 11001),
            l1_component_classes().span(),
            l1_component_salts().span(),
            l2_component_classes().span(),
            l2_component_salts().span(),
            genesis_config_fixture(),
            genesis_artifact_fixture(),
            manifest_fixture(),
        );

    let l2_addresses = expected_l2_addresses();
    for index in 0..l2_addresses.len() {
        let component_kind: felt252 = 101 + index.into();
        let expected = address(*l2_addresses.at(index));
        let absent_class_hash: felt252 = get_class_hash_at_syscall(expected).unwrap_syscall().into();
        assert!(absent_class_hash == 0);
        assert!(coordinator.committed_component_address(component_kind) == expected);
        assert!(safe_coordinator.component_address(component_kind).is_err());
    }
}

#[test]
#[feature("safe_dispatcher")]
fn l1_seal_rejects_a_missing_live_shell() {
    let coordinator_address = deploy_coordinator(address(9901));
    let safe_coordinator = IResolvedIdentityCoordinatorSpikeSafeDispatcher { contract_address: coordinator_address };
    deploy_l1_shells_except(coordinator_address, 14);

    assert!(
        safe_coordinator
            .seal_resolved_identity(
                recipe_fixture(10001, false, 11001),
                l1_component_classes().span(),
                l1_component_salts().span(),
                l2_component_classes().span(),
                l2_component_salts().span(),
                genesis_config_fixture(),
                genesis_artifact_fixture(),
                manifest_fixture(),
            )
            .is_err(),
    );
}

#[test]
#[should_panic(expected: "NONCANONICAL_SHELL_CONSTRUCTOR")]
fn peer_or_downstream_constructor_field_is_structurally_rejected() {
    assert_canonical_shell_constructor(
        address(8501), 1, 7001, 8001, 1, array![8501, 1, 7001, 8001, 1, EXPECTED_RECIPE_HASH].span(),
    );
}

#[test]
#[should_panic(expected: "CLASS_KIND_MISMATCH")]
fn missing_component_kind_rejects() {
    let kinds = array![1, 2];
    let classes = array![ComponentClassEntry { component_kind: 1, class_hash: 12001 }];
    let salts = component_salts(kinds.span());
    validate_component_vectors(1, 7001, kinds.span(), classes.span(), salts.span());
}

#[test]
#[should_panic(expected: "CLASS_KIND_MISMATCH")]
fn permuted_component_kind_rejects() {
    let kinds = array![1, 2];
    let classes = array![
        ComponentClassEntry { component_kind: 2, class_hash: 12002 },
        ComponentClassEntry { component_kind: 1, class_hash: 12001 },
    ];
    let salts = component_salts(kinds.span());
    validate_component_vectors(1, 7001, kinds.span(), classes.span(), salts.span());
}

#[test]
#[should_panic(expected: "DUPLICATE_COMPONENT_KIND")]
fn duplicate_component_kind_rejects() {
    let kinds = array![1, 1];
    let classes = array![
        ComponentClassEntry { component_kind: 1, class_hash: 12001 },
        ComponentClassEntry { component_kind: 1, class_hash: 12001 },
    ];
    let salts = component_salts(kinds.span());
    validate_component_vectors(1, 7001, kinds.span(), classes.span(), salts.span());
}

fn l1_component_classes() -> Array<ComponentClassEntry> {
    array![
        ComponentClassEntry { component_kind: 1, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 2, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 3, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 4, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 5, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 6, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 7, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 8, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 9, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 10, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 11, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 12, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 13, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 14, class_hash: SHELL_CLASS_HASH },
    ]
}

fn l2_component_classes() -> Array<ComponentClassEntry> {
    array![
        ComponentClassEntry { component_kind: 101, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 102, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 103, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 104, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 105, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 106, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 107, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 108, class_hash: SHELL_CLASS_HASH },
        ComponentClassEntry { component_kind: 109, class_hash: SHELL_CLASS_HASH },
    ]
}

fn permuted_l1_component_classes() -> Array<ComponentClassEntry> {
    let canonical = l1_component_classes();
    let mut permuted = array![*canonical.at(1), *canonical.at(0)];
    for index in 2..canonical.len() {
        permuted.append(*canonical.at(index));
    }
    permuted
}

fn component_kinds(classes: Span<ComponentClassEntry>) -> Array<felt252> {
    let mut kinds = array![];
    for component in classes {
        kinds.append(*component.component_kind);
    }
    kinds
}

fn component_kinds_for_both_layers() -> Array<felt252> {
    let l1 = l1_component_classes();
    let l2 = l2_component_classes();
    let mut kinds = component_kinds(l1.span());
    for component in l2.span() {
        kinds.append(*component.component_kind);
    }
    kinds
}

fn component_salts(kinds: Span<felt252>) -> Array<ComponentSaltEntry> {
    let mut salts = array![];
    for kind in kinds {
        salts.append(ComponentSaltEntry { component_kind: *kind, salt: derive_component_salt(1, 7001, *kind) });
    }
    salts
}

fn l1_component_salts() -> Array<ComponentSaltEntry> {
    let classes = l1_component_classes();
    let kinds = component_kinds(classes.span());
    component_salts(kinds.span())
}

fn l2_component_salts() -> Array<ComponentSaltEntry> {
    let classes = l2_component_classes();
    let kinds = component_kinds(classes.span());
    component_salts(kinds.span())
}

fn permuted_l1_component_salts() -> Array<ComponentSaltEntry> {
    let classes = permuted_l1_component_classes();
    let kinds = component_kinds(classes.span());
    component_salts(kinds.span())
}

fn expected_l1_addresses() -> Array<felt252> {
    array![
        2651000624954715355021701089790016833225256849400014161639306277742698013452,
        3547186964741653507151997300485229755013435522729924067547175513277711238067,
        1845275187025973330763987513169836241150381841184512603703453784525489864175,
        1728666039051148587139903499950387901873754906469937362060876436039372173224,
        817869184411296238914924339332191763491422008353552343766161013953822619337,
        3044826611152361576843212122078857494751086336818721979274481790897559221441,
        2682385083443533773704701400999487121129836808900424006837846741854000372834,
        2968637838925799723702079461931737360272048567902690602126840265781857470957,
        2412764875405982434680637062209797926412599299901271463216771941893179860379,
        2928170048484737238248307349558801325092572795026786385296595396001640331131,
        598792624322044711869209731561536752233344627172916277114111445882798520366,
        2084278082936875609003273970781349565560958337333077306973156684066567249154,
        1725853012036564709217672328120517917391104216476574602765282348486795733496,
        3207174158534843869578599036283596086660992596218888381154686642588728971291,
    ]
}

fn expected_l2_addresses() -> Array<felt252> {
    array![
        724758717509948920072703740412083216282470176685188583179531425237610428599,
        3382929303739851673036032218577794620693258036265096748219780763194402242793,
        3290951260215430532609563755075695508035684121351120127821011834499933020126,
        366719427334974554782864388342237195421116489330620141277191422817068936727,
        2064393244550935481926750005354740595290865988561122530560963651253137953339,
        650497219664918246889939367772248146195950306981090833778635725783269667657,
        2943998537876948329631482891178239207621789457639493269131129950696440030690,
        3222348840995391389495085211824055625916719868869316899066208115412814165242,
        1486545546682773172072796790801837051936018418823952727219265425313328276164,
    ]
}

fn assert_shell_addresses(
    recipe: @DeploymentAddressRecipe,
    classes: Span<ComponentClassEntry>,
    salts: Span<ComponentSaltEntry>,
    expected_addresses: Span<felt252>,
    effective_deployer: felt252,
) {
    assert!(classes.len() == salts.len() && classes.len() == expected_addresses.len());
    for index in 0..classes.len() {
        let component = classes.at(index);
        assert!(
            shell_address(
                recipe, *component.component_kind, *component.class_hash, *salts.at(index).salt, effective_deployer,
            ) == *expected_addresses
                .at(index),
        );
    }
}

fn shell_address(
    recipe: @DeploymentAddressRecipe,
    component_kind: felt252,
    class_hash: felt252,
    salt: felt252,
    effective_deployer: felt252,
) -> felt252 {
    let constructor = build_shell_constructor(
        address(8501), *recipe.protocol_version, *recipe.deployment_id, *recipe.ruleset_id, component_kind,
    );
    calculate_shell_address(salt, class_hash, constructor.span(), effective_deployer)
}

fn recipe_fixture(l1_deployer: felt252, l1_deploy_from_zero: bool, l1_primitive: felt252) -> DeploymentAddressRecipe {
    DeploymentAddressRecipe {
        protocol_version: 1,
        deployment_id: 7001,
        ruleset_id: 8001,
        l1_chain_id: 9001,
        appchain_chain_id: 9002,
        l1_deployer: address(l1_deployer),
        l1_deploy_from_zero,
        l1_deployment_primitive_hash: l1_primitive,
        l2_deployer: 10002,
        l2_deploy_from_zero: true,
        l2_deployment_primitive_hash: 11002,
        l1_component_count: 14,
        l1_component_classes_hash: EXPECTED_L1_CLASSES_HASH,
        l1_component_salts_hash: EXPECTED_L1_SALTS_HASH,
        l2_component_count: 9,
        l2_component_classes_hash: EXPECTED_L2_CLASSES_HASH,
        l2_component_salts_hash: EXPECTED_L2_SALTS_HASH,
        shell_constructor_schema_hash: EXPECTED_SCHEMA_HASH,
    }
}

fn genesis_config_fixture() -> AppchainSettlementConfig {
    let l1 = expected_l1_addresses();
    let l2 = expected_l2_addresses();
    AppchainSettlementConfig {
        protocol_version: 1,
        deployment_id: 7001,
        season_id: 7002,
        ruleset_id: 8001,
        release_bundle_hash: 13001,
        starknet_chain_id: 9001,
        appchain_chain_id: 9002,
        hardened_piltover_l1: address(*l1.at(0)),
        coordinator_l1: address(8501),
        funding_vault_l1: address(*l1.at(1)),
        root_inbox_l1: address(*l1.at(2)),
        claim_router_l1: address(*l1.at(3)),
        resource_gateway_l1: address(*l1.at(4)),
        scarce_bridge_l1: address(*l1.at(5)),
        entitlement_vault_l1: address(*l1.at(6)),
        outcome_portal_l1: address(*l1.at(7)),
        settlement_route_registry_l1: address(*l1.at(8)),
        archive_quorum_l1: address(*l1.at(9)),
        attestation_revocation_registry_l1: address(8502),
        hardened_inbox_runtime_l2: address(*l2.at(3)),
        season_ingress_l2: address(*l2.at(1)),
        season_settlement_hub_l2: address(*l2.at(2)),
        forced_exit_coordinator_l2: address(*l2.at(4)),
        season_finalizer_l2: address(*l2.at(5)),
        sealed_factory_l2: address(*l2.at(6)),
        sealed_world_policy_l2: address(*l2.at(7)),
        vrf_provider_l2: address(*l2.at(8)),
        vrf_public_key_hash: 13002,
        appchain_component_classes_hash: EXPECTED_L2_CLASSES_HASH,
        class_binding_count: 23,
        class_bindings_hash: 13004,
        schema_bundle_hash: 13005,
        asset_policy_count: 1,
        asset_policies_hash: 13006,
        backing_policy_count: 1,
        backing_policies_hash: 13007,
        payout_purpose_policy_count: 1,
        payout_purpose_policies_hash: 13008,
        writer_capability_count: 1,
        writer_capabilities_hash: 13009,
        capacity_entry_count: 1,
        capacity_root: 13010,
        sealed_game_recipe_hash: 13011,
        intended_start: 1800000000,
        intended_end: 1800005400,
        max_games: 1,
        initial_inbox_cursor: 0,
        initial_outbox_cursor: 0,
        timing_policy_hash: 13012,
        economics_policy_hash: 13013,
        vrf_policy_hash: 13014,
        recovery_policy_hash: 13015,
    }
}

fn genesis_artifact_fixture() -> KatanaGenesisArtifactCommitment {
    KatanaGenesisArtifactCommitment {
        katana_source_commit: 687986878424598322174429681878845625584443060374,
        chain_id: 9002,
        block_number: 0,
        parent_hash: 0,
        timestamp: 1800000000,
        sequencer_address: 8503,
        eth_gas_price: 1,
        strk_gas_price: 1,
        class_declaration_count: 1,
        class_declarations_hash: 746665023464242067091745042425691928964585107705329983346532590431228185103,
        contract_allocation_count: 9,
        contract_allocations_hash: 69322116767425656929645814644439289410493161300260256379746762746698852598,
        storage_write_count: 97,
        storage_writes_hash: 1976306452280871195301810793235159098274419508707640376920880681310192031782,
        config_hash: EXPECTED_CONFIG_HASH,
        state_root: 268091293760204763631382757931779078794118851212906591280343453994588570303,
    }
}

fn changed_state_root_genesis_artifact_fixture() -> KatanaGenesisArtifactCommitment {
    KatanaGenesisArtifactCommitment {
        state_root: 268091293760204763631382757931779078794118851212906591280343453994588570304,
        ..genesis_artifact_fixture(),
    }
}

fn manifest_fixture() -> DeploymentManifest {
    let l1 = expected_l1_addresses();
    let l2 = expected_l2_addresses();
    DeploymentManifest {
        protocol_version: 1,
        deployment_id: 7001,
        ruleset_id: 8001,
        release_bundle_hash: 13001,
        address_recipe_hash: EXPECTED_RECIPE_HASH,
        l1_chain_id: 9001,
        appchain_chain_id: 9002,
        hardened_piltover: address(*l1.at(0)),
        coordinator: address(8501),
        funding_vault: address(*l1.at(1)),
        root_inbox: address(*l1.at(2)),
        claim_router: address(*l1.at(3)),
        resource_gateway: address(*l1.at(4)),
        scarce_bridge: address(*l1.at(5)),
        entitlement_vault: address(*l1.at(6)),
        outcome_portal: address(*l1.at(7)),
        settlement_route_registry: address(*l1.at(8)),
        archive_quorum: address(*l1.at(9)),
        mmr_settlement_router: address(*l1.at(10)),
        mmr_settlement_module: address(*l1.at(11)),
        attestation_revocation_registry: address(8502),
        exit_verifier: address(*l1.at(12)),
        dormant_reserve: address(*l1.at(13)),
        settlement_config_l2: *l2.at(0),
        settlement_ingress_l2: *l2.at(1),
        settlement_hub_l2: *l2.at(2),
        hardened_inbox_runtime_l2: *l2.at(3),
        forced_exit_coordinator_l2: *l2.at(4),
        season_finalizer_l2: *l2.at(5),
        sealed_factory_l2: *l2.at(6),
        world_policy_l2: *l2.at(7),
        vrf_l2: *l2.at(8),
        world_class_hash: 13016,
        class_bundle_hash: 13017,
        schema_bundle_hash: 13005,
        authoritative_address_inputs_hash: 13018,
        external_counterpart_count: 0,
        external_counterparts_hash: 13019,
        privileged_mutation_paths_hash: 13020,
        expected_role_count: 1,
        expected_roles_hash: 13021,
        writer_graph_hash: 13022,
        config_snapshot_hash: EXPECTED_CONFIG_HASH,
        genesis_hash: EXPECTED_GENESIS_HASH,
    }
}

fn deploy_coordinator(operator: ContractAddress) -> ContractAddress {
    let manifest = manifest_fixture();
    let artifact = genesis_artifact_fixture();
    let coordinator = address(8501);
    declare("ResolvedIdentityCoordinatorSpike")
        .unwrap()
        .contract_class()
        .deploy_at(
            @array![
                operator.into(), EXPECTED_RECIPE_HASH, deployment_release_identity_hash(@manifest),
                katana_genesis_profile_hash(@artifact), EXPECTED_GENESIS_HASH,
            ],
            coordinator,
        )
        .unwrap();
    coordinator
}

fn deploy_all_shells(coordinator: ContractAddress) -> (Array<felt252>, Array<ContractAddress>) {
    let component_kinds = component_kinds_for_both_layers();
    let l1_addresses = expected_l1_addresses();
    let l2_addresses = expected_l2_addresses();
    let shell_class = declare("DeterministicShellSpike").unwrap().contract_class();
    let shell_class_hash: felt252 = (*shell_class.class_hash).into();
    assert!(shell_class_hash == SHELL_CLASS_HASH);
    let mut shell_addresses = array![];
    for index in 0..component_kinds.len() {
        let component_kind = *component_kinds.at(index);
        let expected_address = if index < l1_addresses.len() {
            address(*l1_addresses.at(index))
        } else {
            address(*l2_addresses.at(index - l1_addresses.len()))
        };
        shell_class.deploy_at(@array![coordinator.into(), 1, 7001, 8001, component_kind], expected_address).unwrap();
        shell_addresses.append(expected_address);
    }
    (component_kinds, shell_addresses)
}

fn deploy_l1_shells(coordinator: ContractAddress) {
    deploy_l1_shells_except(coordinator, 0);
}

fn deploy_l1_shells_except(coordinator: ContractAddress, omitted_component_kind: felt252) {
    let classes = l1_component_classes();
    let addresses = expected_l1_addresses();
    let shell_class = declare("DeterministicShellSpike").unwrap().contract_class();
    for index in 0..classes.len() {
        let component_kind = *classes.at(index).component_kind;
        if component_kind != omitted_component_kind {
            shell_class
                .deploy_at(@array![coordinator.into(), 1, 7001, 8001, component_kind], address(*addresses.at(index)))
                .unwrap();
        }
    }
}

fn deploy_shell_deployer_at(
    coordinator: ContractAddress, deployer_address: ContractAddress, deploy_from_zero: bool,
) -> ContractAddress {
    declare("DeterministicShellDeployerSpike")
        .unwrap()
        .contract_class()
        .deploy_at(@array![coordinator.into(), 1, 7001, 8001, if deploy_from_zero {
            1
        } else {
            0
        }], deployer_address)
        .unwrap();
    deployer_address
}

fn address(value: felt252) -> ContractAddress {
    value.try_into().unwrap()
}
