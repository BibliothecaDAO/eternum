// Generated fixture from the pinned preset resource tables; validated against the oracle by the parity run.
use dojo::model::ModelStorageTest;
use dojo::world::WorldStorage;
use crate::models::config::{BuildingCategoryConfig, ResourceFactoryConfig, WeightConfig};
use crate::models::resource::resource::ResourceList;
pub fn configure(ref world: WorldStorage) {
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 1, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 2, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 3, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 4, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 5, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 6, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 7, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 8, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 9, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 10, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 11, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 12, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 13, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 14, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 15, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 16, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 17, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 18, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 19, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 20, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 21, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 22, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 23, weight_gram: 1000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 24, weight_gram: 100 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 25, weight_gram: 0 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 26, weight_gram: 5000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 27, weight_gram: 5000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 28, weight_gram: 5000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 29, weight_gram: 5000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 30, weight_gram: 5000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 31, weight_gram: 5000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 32, weight_gram: 5000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 33, weight_gram: 5000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 34, weight_gram: 5000 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 35, weight_gram: 100 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 36, weight_gram: 100 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 37, weight_gram: 0 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 38, weight_gram: 100 });
    world.write_model_test(@WeightConfig { preset_id: 1, resource_type: 57, weight_gram: 0 });
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 1,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 11000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 3,
                complex_input_list_id: 4,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 2,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 12000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 5,
                complex_input_list_id: 6,
                simple_input_list_count: 3,
                complex_input_list_count: 4,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 3,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 10000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 7,
                complex_input_list_id: 8,
                simple_input_list_count: 3,
                complex_input_list_count: 4,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 4,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 14000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 9,
                complex_input_list_id: 10,
                simple_input_list_count: 3,
                complex_input_list_count: 4,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 5,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 16000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 11,
                complex_input_list_id: 12,
                simple_input_list_count: 3,
                complex_input_list_count: 4,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 6,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 15000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 13,
                complex_input_list_id: 14,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 7,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 16000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 15,
                complex_input_list_id: 16,
                simple_input_list_count: 3,
                complex_input_list_count: 4,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 8,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 16000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 17,
                complex_input_list_id: 18,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 9,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 30000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 19,
                complex_input_list_id: 20,
                simple_input_list_count: 3,
                complex_input_list_count: 4,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 10,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 30000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 21,
                complex_input_list_id: 22,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 11,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 16000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 23,
                complex_input_list_id: 24,
                simple_input_list_count: 3,
                complex_input_list_count: 4,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 12,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 25000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 25,
                complex_input_list_id: 26,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 13,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 25000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 27,
                complex_input_list_id: 28,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 14,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 20000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 29,
                complex_input_list_id: 30,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 15,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 20000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 31,
                complex_input_list_id: 32,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 16,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 30000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 33,
                complex_input_list_id: 34,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 17,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 30000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 35,
                complex_input_list_id: 36,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 18,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 30000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 37,
                complex_input_list_id: 38,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 19,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 30000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 39,
                complex_input_list_id: 40,
                simple_input_list_count: 3,
                complex_input_list_count: 4,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 20,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 20000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 41,
                complex_input_list_id: 42,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 21,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 30000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 43,
                complex_input_list_id: 44,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 22,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 30000000000,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 45,
                complex_input_list_id: 46,
                simple_input_list_count: 3,
                complex_input_list_count: 4,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 23,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 47,
                complex_input_list_id: 48,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 24,
                realm_output_per_second: 3000000000,
                village_output_per_second: 1500000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 3000000000,
                output_per_complex_input: 3000000000,
                simple_input_list_id: 49,
                complex_input_list_id: 50,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 25,
                realm_output_per_second: 3000000000,
                village_output_per_second: 1500000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 3000000000,
                output_per_complex_input: 3000000000,
                simple_input_list_id: 51,
                complex_input_list_id: 52,
                simple_input_list_count: 0,
                complex_input_list_count: 2,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 26,
                realm_output_per_second: 5000000000,
                village_output_per_second: 2500000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 5000000000,
                output_per_complex_input: 5000000000,
                simple_input_list_id: 53,
                complex_input_list_id: 54,
                simple_input_list_count: 3,
                complex_input_list_count: 3,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 27,
                realm_output_per_second: 5000000000,
                village_output_per_second: 2500000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 5000000000,
                output_per_complex_input: 5000000000,
                simple_input_list_id: 55,
                complex_input_list_id: 56,
                simple_input_list_count: 0,
                complex_input_list_count: 6,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 28,
                realm_output_per_second: 5000000000,
                village_output_per_second: 2500000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 5000000000,
                output_per_complex_input: 5000000000,
                simple_input_list_id: 57,
                complex_input_list_id: 58,
                simple_input_list_count: 0,
                complex_input_list_count: 6,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 29,
                realm_output_per_second: 5000000000,
                village_output_per_second: 2500000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 5000000000,
                output_per_complex_input: 5000000000,
                simple_input_list_id: 59,
                complex_input_list_id: 60,
                simple_input_list_count: 3,
                complex_input_list_count: 3,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 30,
                realm_output_per_second: 5000000000,
                village_output_per_second: 2500000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 5000000000,
                output_per_complex_input: 5000000000,
                simple_input_list_id: 61,
                complex_input_list_id: 62,
                simple_input_list_count: 0,
                complex_input_list_count: 6,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 31,
                realm_output_per_second: 5000000000,
                village_output_per_second: 2500000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 5000000000,
                output_per_complex_input: 5000000000,
                simple_input_list_id: 63,
                complex_input_list_id: 64,
                simple_input_list_count: 0,
                complex_input_list_count: 6,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 32,
                realm_output_per_second: 5000000000,
                village_output_per_second: 2500000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 5000000000,
                output_per_complex_input: 5000000000,
                simple_input_list_id: 65,
                complex_input_list_id: 66,
                simple_input_list_count: 3,
                complex_input_list_count: 3,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 33,
                realm_output_per_second: 5000000000,
                village_output_per_second: 2500000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 5000000000,
                output_per_complex_input: 5000000000,
                simple_input_list_id: 67,
                complex_input_list_id: 68,
                simple_input_list_count: 0,
                complex_input_list_count: 6,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 34,
                realm_output_per_second: 5000000000,
                village_output_per_second: 2500000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 5000000000,
                output_per_complex_input: 5000000000,
                simple_input_list_id: 69,
                complex_input_list_id: 70,
                simple_input_list_count: 0,
                complex_input_list_count: 6,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 35,
                realm_output_per_second: 6000000000,
                village_output_per_second: 3000000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 6000000000,
                output_per_complex_input: 6000000000,
                simple_input_list_id: 71,
                complex_input_list_id: 72,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 36,
                realm_output_per_second: 6000000000,
                village_output_per_second: 3000000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 6000000000,
                output_per_complex_input: 6000000000,
                simple_input_list_id: 73,
                complex_input_list_id: 74,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 37,
                realm_output_per_second: 0,
                village_output_per_second: 0,
                labor_output_per_resource: 0,
                output_per_simple_input: 0,
                output_per_complex_input: 0,
                simple_input_list_id: 75,
                complex_input_list_id: 76,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 38,
                realm_output_per_second: 10000000000,
                village_output_per_second: 5000000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 10000000000,
                output_per_complex_input: 10000000000,
                simple_input_list_id: 77,
                complex_input_list_id: 78,
                simple_input_list_count: 0,
                complex_input_list_count: 0,
            },
        );
    world
        .write_model_test(
            @ResourceFactoryConfig {
                preset_id: 1,
                resource_type: 57,
                realm_output_per_second: 1000000000,
                village_output_per_second: 500000000,
                labor_output_per_resource: 0,
                output_per_simple_input: 1000000000,
                output_per_complex_input: 1000000000,
                simple_input_list_id: 79,
                complex_input_list_id: 80,
                simple_input_list_count: 0,
                complex_input_list_count: 3,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 0,
                complex_erection_cost_id: 81,
                complex_erection_cost_count: 0,
                simple_erection_cost_id: 82,
                simple_erection_cost_count: 0,
                population_cost: 0,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 1,
                complex_erection_cost_id: 83,
                complex_erection_cost_count: 2,
                simple_erection_cost_id: 84,
                simple_erection_cost_count: 1,
                population_cost: 0,
                capacity_grant: 6,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 3,
                complex_erection_cost_id: 85,
                complex_erection_cost_count: 1,
                simple_erection_cost_id: 86,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 4,
                complex_erection_cost_id: 87,
                complex_erection_cost_count: 2,
                simple_erection_cost_id: 88,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 5,
                complex_erection_cost_id: 89,
                complex_erection_cost_count: 1,
                simple_erection_cost_id: 90,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 6,
                complex_erection_cost_id: 91,
                complex_erection_cost_count: 3,
                simple_erection_cost_id: 92,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 7,
                complex_erection_cost_id: 93,
                complex_erection_cost_count: 4,
                simple_erection_cost_id: 94,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 8,
                complex_erection_cost_id: 95,
                complex_erection_cost_count: 2,
                simple_erection_cost_id: 96,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 9,
                complex_erection_cost_id: 97,
                complex_erection_cost_count: 4,
                simple_erection_cost_id: 98,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 10,
                complex_erection_cost_id: 99,
                complex_erection_cost_count: 4,
                simple_erection_cost_id: 100,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 11,
                complex_erection_cost_id: 101,
                complex_erection_cost_count: 5,
                simple_erection_cost_id: 102,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 12,
                complex_erection_cost_id: 103,
                complex_erection_cost_count: 4,
                simple_erection_cost_id: 104,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 13,
                complex_erection_cost_id: 105,
                complex_erection_cost_count: 4,
                simple_erection_cost_id: 106,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 14,
                complex_erection_cost_id: 107,
                complex_erection_cost_count: 4,
                simple_erection_cost_id: 108,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 15,
                complex_erection_cost_id: 109,
                complex_erection_cost_count: 4,
                simple_erection_cost_id: 110,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 16,
                complex_erection_cost_id: 111,
                complex_erection_cost_count: 4,
                simple_erection_cost_id: 112,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 17,
                complex_erection_cost_id: 113,
                complex_erection_cost_count: 4,
                simple_erection_cost_id: 114,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 18,
                complex_erection_cost_id: 115,
                complex_erection_cost_count: 4,
                simple_erection_cost_id: 116,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 19,
                complex_erection_cost_id: 117,
                complex_erection_cost_count: 4,
                simple_erection_cost_id: 118,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 20,
                complex_erection_cost_id: 119,
                complex_erection_cost_count: 4,
                simple_erection_cost_id: 120,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 21,
                complex_erection_cost_id: 121,
                complex_erection_cost_count: 5,
                simple_erection_cost_id: 122,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 22,
                complex_erection_cost_id: 123,
                complex_erection_cost_count: 4,
                simple_erection_cost_id: 124,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 23,
                complex_erection_cost_id: 125,
                complex_erection_cost_count: 4,
                simple_erection_cost_id: 126,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 24,
                complex_erection_cost_id: 127,
                complex_erection_cost_count: 5,
                simple_erection_cost_id: 128,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 25,
                complex_erection_cost_id: 129,
                complex_erection_cost_count: 0,
                simple_erection_cost_id: 130,
                simple_erection_cost_count: 0,
                population_cost: 0,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 26,
                complex_erection_cost_id: 131,
                complex_erection_cost_count: 0,
                simple_erection_cost_id: 132,
                simple_erection_cost_count: 0,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 27,
                complex_erection_cost_id: 133,
                complex_erection_cost_count: 2,
                simple_erection_cost_id: 134,
                simple_erection_cost_count: 1,
                population_cost: 3,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 28,
                complex_erection_cost_id: 135,
                complex_erection_cost_count: 3,
                simple_erection_cost_id: 136,
                simple_erection_cost_count: 1,
                population_cost: 3,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 29,
                complex_erection_cost_id: 137,
                complex_erection_cost_count: 5,
                simple_erection_cost_id: 138,
                simple_erection_cost_count: 0,
                population_cost: 3,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 30,
                complex_erection_cost_id: 139,
                complex_erection_cost_count: 5,
                simple_erection_cost_id: 140,
                simple_erection_cost_count: 0,
                population_cost: 3,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 31,
                complex_erection_cost_id: 141,
                complex_erection_cost_count: 3,
                simple_erection_cost_id: 142,
                simple_erection_cost_count: 1,
                population_cost: 3,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 32,
                complex_erection_cost_id: 143,
                complex_erection_cost_count: 5,
                simple_erection_cost_id: 144,
                simple_erection_cost_count: 0,
                population_cost: 3,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 33,
                complex_erection_cost_id: 145,
                complex_erection_cost_count: 5,
                simple_erection_cost_id: 146,
                simple_erection_cost_count: 0,
                population_cost: 3,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 34,
                complex_erection_cost_id: 147,
                complex_erection_cost_count: 3,
                simple_erection_cost_id: 148,
                simple_erection_cost_count: 1,
                population_cost: 3,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 35,
                complex_erection_cost_id: 149,
                complex_erection_cost_count: 5,
                simple_erection_cost_id: 150,
                simple_erection_cost_count: 0,
                population_cost: 3,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 36,
                complex_erection_cost_id: 151,
                complex_erection_cost_count: 5,
                simple_erection_cost_id: 152,
                simple_erection_cost_count: 0,
                population_cost: 3,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 37,
                complex_erection_cost_id: 153,
                complex_erection_cost_count: 1,
                simple_erection_cost_id: 154,
                simple_erection_cost_count: 1,
                population_cost: 1,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 38,
                complex_erection_cost_id: 155,
                complex_erection_cost_count: 1,
                simple_erection_cost_id: 156,
                simple_erection_cost_count: 1,
                population_cost: 1,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @BuildingCategoryConfig {
                preset_id: 1,
                category: 40,
                complex_erection_cost_id: 157,
                complex_erection_cost_count: 3,
                simple_erection_cost_id: 158,
                simple_erection_cost_count: 1,
                population_cost: 2,
                capacity_grant: 0,
            },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 1, index: 0, resource_type: 35, amount: 1000000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 1, index: 1, resource_type: 36, amount: 1000000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 1, index: 2, resource_type: 23, amount: 1200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 1, index: 3, resource_type: 3, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 1, index: 4, resource_type: 2, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 1, index: 5, resource_type: 4, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 1, index: 6, resource_type: 25, amount: 200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 1, index: 7, resource_type: 26, amount: 1500000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 1, index: 8, resource_type: 29, amount: 1500000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 1, index: 9, resource_type: 32, amount: 1500000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 2, index: 0, resource_type: 35, amount: 500000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 2, index: 1, resource_type: 36, amount: 500000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 2, index: 2, resource_type: 23, amount: 600000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 2, index: 3, resource_type: 3, amount: 90000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 2, index: 4, resource_type: 2, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 2, index: 5, resource_type: 4, amount: 30000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 2, index: 6, resource_type: 25, amount: 100000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 2, index: 7, resource_type: 26, amount: 500000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 2, index: 8, resource_type: 29, amount: 500000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 2, index: 9, resource_type: 32, amount: 500000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 5, index: 0, resource_type: 35, amount: 1000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 5, index: 1, resource_type: 36, amount: 1000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 5, index: 2, resource_type: 23, amount: 1000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 6, index: 0, resource_type: 35, amount: 1000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 6, index: 1, resource_type: 36, amount: 1000000000 },
        );
    world.write_model_test(@ResourceList { preset_id: 1, entity_id: 6, index: 2, resource_type: 3, amount: 300000000 });
    world.write_model_test(@ResourceList { preset_id: 1, entity_id: 6, index: 3, resource_type: 4, amount: 200000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 7, index: 0, resource_type: 35, amount: 1000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 7, index: 1, resource_type: 36, amount: 1000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 7, index: 2, resource_type: 23, amount: 500000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 8, index: 0, resource_type: 35, amount: 1000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 8, index: 1, resource_type: 36, amount: 1000000000 },
        );
    world.write_model_test(@ResourceList { preset_id: 1, entity_id: 8, index: 2, resource_type: 2, amount: 200000000 });
    world.write_model_test(@ResourceList { preset_id: 1, entity_id: 8, index: 3, resource_type: 4, amount: 200000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 9, index: 0, resource_type: 35, amount: 1000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 9, index: 1, resource_type: 36, amount: 1000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 9, index: 2, resource_type: 23, amount: 1000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 10, index: 0, resource_type: 35, amount: 1000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 10, index: 1, resource_type: 36, amount: 1000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 10, index: 2, resource_type: 3, amount: 300000000 });
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 10, index: 3, resource_type: 2, amount: 200000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 11, index: 0, resource_type: 35, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 11, index: 1, resource_type: 36, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 11, index: 2, resource_type: 23, amount: 2500000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 12, index: 0, resource_type: 35, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 12, index: 1, resource_type: 36, amount: 2000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 12, index: 2, resource_type: 2, amount: 600000000 });
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 12, index: 3, resource_type: 4, amount: 400000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 15, index: 0, resource_type: 35, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 15, index: 1, resource_type: 36, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 15, index: 2, resource_type: 23, amount: 2500000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 16, index: 0, resource_type: 35, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 16, index: 1, resource_type: 36, amount: 2000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 16, index: 2, resource_type: 2, amount: 600000000 });
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 16, index: 3, resource_type: 4, amount: 400000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 19, index: 0, resource_type: 35, amount: 4000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 19, index: 1, resource_type: 36, amount: 4000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 19, index: 2, resource_type: 23, amount: 10000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 20, index: 0, resource_type: 35, amount: 3000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 20, index: 1, resource_type: 36, amount: 3000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 20, index: 2, resource_type: 2, amount: 900000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 20, index: 3, resource_type: 11, amount: 600000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 23, index: 0, resource_type: 35, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 23, index: 1, resource_type: 36, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 23, index: 2, resource_type: 23, amount: 2500000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 24, index: 0, resource_type: 35, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 24, index: 1, resource_type: 36, amount: 2000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 24, index: 2, resource_type: 2, amount: 600000000 });
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 24, index: 3, resource_type: 4, amount: 400000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 39, index: 0, resource_type: 35, amount: 4000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 39, index: 1, resource_type: 36, amount: 4000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 39, index: 2, resource_type: 23, amount: 10000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 40, index: 0, resource_type: 35, amount: 3000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 40, index: 1, resource_type: 36, amount: 3000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 40, index: 2, resource_type: 2, amount: 900000000 });
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 40, index: 3, resource_type: 5, amount: 600000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 45, index: 0, resource_type: 35, amount: 4000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 45, index: 1, resource_type: 36, amount: 4000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 45, index: 2, resource_type: 23, amount: 10000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 46, index: 0, resource_type: 35, amount: 3000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 46, index: 1, resource_type: 36, amount: 3000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 46, index: 2, resource_type: 2, amount: 900000000 });
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 46, index: 3, resource_type: 7, amount: 600000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 52, index: 0, resource_type: 35, amount: 3000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 52, index: 1, resource_type: 36, amount: 3000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 53, index: 0, resource_type: 35, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 53, index: 1, resource_type: 36, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 53, index: 2, resource_type: 23, amount: 500000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 54, index: 0, resource_type: 35, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 54, index: 1, resource_type: 36, amount: 2000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 54, index: 2, resource_type: 4, amount: 400000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 56, index: 0, resource_type: 35, amount: 3000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 56, index: 1, resource_type: 36, amount: 3000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 56, index: 2, resource_type: 26, amount: 10000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 56, index: 3, resource_type: 4, amount: 200000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 56, index: 4, resource_type: 11, amount: 600000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 56, index: 5, resource_type: 38, amount: 1000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 58, index: 0, resource_type: 35, amount: 4000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 58, index: 1, resource_type: 36, amount: 4000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 58, index: 2, resource_type: 27, amount: 10000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 58, index: 3, resource_type: 11, amount: 400000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 58, index: 4, resource_type: 9, amount: 800000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 58, index: 5, resource_type: 38, amount: 3000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 59, index: 0, resource_type: 35, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 59, index: 1, resource_type: 36, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 59, index: 2, resource_type: 23, amount: 500000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 60, index: 0, resource_type: 35, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 60, index: 1, resource_type: 36, amount: 2000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 60, index: 2, resource_type: 4, amount: 400000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 62, index: 0, resource_type: 35, amount: 3000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 62, index: 1, resource_type: 36, amount: 3000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 62, index: 2, resource_type: 29, amount: 10000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 62, index: 3, resource_type: 4, amount: 200000000 });
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 62, index: 4, resource_type: 5, amount: 600000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 62, index: 5, resource_type: 38, amount: 1000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 64, index: 0, resource_type: 35, amount: 4000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 64, index: 1, resource_type: 36, amount: 4000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 64, index: 2, resource_type: 30, amount: 10000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 64, index: 3, resource_type: 5, amount: 400000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 64, index: 4, resource_type: 19, amount: 800000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 64, index: 5, resource_type: 38, amount: 3000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 65, index: 0, resource_type: 35, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 65, index: 1, resource_type: 36, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 65, index: 2, resource_type: 23, amount: 500000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 66, index: 0, resource_type: 35, amount: 2000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 66, index: 1, resource_type: 36, amount: 2000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 66, index: 2, resource_type: 4, amount: 400000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 68, index: 0, resource_type: 35, amount: 3000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 68, index: 1, resource_type: 36, amount: 3000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 68, index: 2, resource_type: 32, amount: 10000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 68, index: 3, resource_type: 4, amount: 200000000 });
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 68, index: 4, resource_type: 7, amount: 600000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 68, index: 5, resource_type: 38, amount: 1000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 70, index: 0, resource_type: 35, amount: 4000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 70, index: 1, resource_type: 36, amount: 4000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 70, index: 2, resource_type: 33, amount: 10000000000 },
        );
    world
        .write_model_test(@ResourceList { preset_id: 1, entity_id: 70, index: 3, resource_type: 7, amount: 400000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 70, index: 4, resource_type: 22, amount: 800000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 70, index: 5, resource_type: 38, amount: 3000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 80, index: 0, resource_type: 36, amount: 15000000000 },
        );
    world.write_model_test(@ResourceList { preset_id: 1, entity_id: 80, index: 1, resource_type: 37, amount: 1000000 });
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 80, index: 2, resource_type: 24, amount: 500000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 83, index: 0, resource_type: 23, amount: 20000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 83, index: 1, resource_type: 3, amount: 20000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 84, index: 0, resource_type: 23, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 85, index: 0, resource_type: 23, amount: 30000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 86, index: 0, resource_type: 23, amount: 30000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 87, index: 0, resource_type: 23, amount: 30000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 87, index: 1, resource_type: 3, amount: 30000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 88, index: 0, resource_type: 23, amount: 90000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 89, index: 0, resource_type: 23, amount: 30000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 90, index: 0, resource_type: 23, amount: 30000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 91, index: 0, resource_type: 23, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 91, index: 1, resource_type: 3, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 91, index: 2, resource_type: 2, amount: 30000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 92, index: 0, resource_type: 23, amount: 300000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 93, index: 0, resource_type: 23, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 93, index: 1, resource_type: 3, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 93, index: 2, resource_type: 2, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 93, index: 3, resource_type: 4, amount: 30000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 94, index: 0, resource_type: 23, amount: 720000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 95, index: 0, resource_type: 23, amount: 30000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 95, index: 1, resource_type: 3, amount: 30000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 96, index: 0, resource_type: 23, amount: 90000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 97, index: 0, resource_type: 23, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 97, index: 1, resource_type: 3, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 97, index: 2, resource_type: 2, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 97, index: 3, resource_type: 4, amount: 30000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 98, index: 0, resource_type: 23, amount: 720000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 99, index: 0, resource_type: 23, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 99, index: 1, resource_type: 3, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 99, index: 2, resource_type: 2, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 99, index: 3, resource_type: 4, amount: 30000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 100, index: 0, resource_type: 23, amount: 720000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 101, index: 0, resource_type: 23, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 101, index: 1, resource_type: 3, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 101, index: 2, resource_type: 4, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 101, index: 3, resource_type: 11, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 101, index: 4, resource_type: 38, amount: 600000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 102, index: 0, resource_type: 23, amount: 2400000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 103, index: 0, resource_type: 23, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 103, index: 1, resource_type: 3, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 103, index: 2, resource_type: 2, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 103, index: 3, resource_type: 4, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 104, index: 0, resource_type: 23, amount: 1800000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 105, index: 0, resource_type: 23, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 105, index: 1, resource_type: 3, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 105, index: 2, resource_type: 2, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 105, index: 3, resource_type: 4, amount: 30000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 106, index: 0, resource_type: 23, amount: 720000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 107, index: 0, resource_type: 23, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 107, index: 1, resource_type: 3, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 107, index: 2, resource_type: 2, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 107, index: 3, resource_type: 4, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 108, index: 0, resource_type: 23, amount: 1800000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 109, index: 0, resource_type: 23, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 109, index: 1, resource_type: 3, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 109, index: 2, resource_type: 2, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 109, index: 3, resource_type: 4, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 110, index: 0, resource_type: 23, amount: 1200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 111, index: 0, resource_type: 23, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 111, index: 1, resource_type: 3, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 111, index: 2, resource_type: 2, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 111, index: 3, resource_type: 4, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 112, index: 0, resource_type: 23, amount: 1200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 113, index: 0, resource_type: 23, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 113, index: 1, resource_type: 3, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 113, index: 2, resource_type: 2, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 113, index: 3, resource_type: 4, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 114, index: 0, resource_type: 23, amount: 1200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 115, index: 0, resource_type: 23, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 115, index: 1, resource_type: 3, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 115, index: 2, resource_type: 2, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 115, index: 3, resource_type: 4, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 116, index: 0, resource_type: 23, amount: 1800000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 117, index: 0, resource_type: 23, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 117, index: 1, resource_type: 3, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 117, index: 2, resource_type: 2, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 117, index: 3, resource_type: 4, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 118, index: 0, resource_type: 23, amount: 1800000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 119, index: 0, resource_type: 23, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 119, index: 1, resource_type: 3, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 119, index: 2, resource_type: 2, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 119, index: 3, resource_type: 4, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 120, index: 0, resource_type: 23, amount: 1800000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 121, index: 0, resource_type: 23, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 121, index: 1, resource_type: 3, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 121, index: 2, resource_type: 4, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 121, index: 3, resource_type: 5, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 121, index: 4, resource_type: 38, amount: 600000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 122, index: 0, resource_type: 23, amount: 2400000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 123, index: 0, resource_type: 23, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 123, index: 1, resource_type: 3, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 123, index: 2, resource_type: 2, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 123, index: 3, resource_type: 4, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 124, index: 0, resource_type: 23, amount: 1200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 125, index: 0, resource_type: 23, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 125, index: 1, resource_type: 3, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 125, index: 2, resource_type: 2, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 125, index: 3, resource_type: 4, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 126, index: 0, resource_type: 23, amount: 1800000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 127, index: 0, resource_type: 23, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 127, index: 1, resource_type: 3, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 127, index: 2, resource_type: 4, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 127, index: 3, resource_type: 7, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 127, index: 4, resource_type: 38, amount: 600000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 128, index: 0, resource_type: 23, amount: 2400000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 133, index: 0, resource_type: 23, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 133, index: 1, resource_type: 3, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 134, index: 0, resource_type: 23, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 135, index: 0, resource_type: 23, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 135, index: 1, resource_type: 3, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 135, index: 2, resource_type: 4, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 136, index: 0, resource_type: 23, amount: 1200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 137, index: 0, resource_type: 23, amount: 360000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 137, index: 1, resource_type: 3, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 137, index: 2, resource_type: 4, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 137, index: 3, resource_type: 11, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 137, index: 4, resource_type: 38, amount: 600000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 139, index: 0, resource_type: 23, amount: 540000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 139, index: 1, resource_type: 3, amount: 360000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 139, index: 2, resource_type: 11, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 139, index: 3, resource_type: 9, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 139, index: 4, resource_type: 38, amount: 1200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 141, index: 0, resource_type: 23, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 141, index: 1, resource_type: 3, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 141, index: 2, resource_type: 4, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 142, index: 0, resource_type: 23, amount: 1200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 143, index: 0, resource_type: 23, amount: 360000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 143, index: 1, resource_type: 3, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 143, index: 2, resource_type: 4, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 143, index: 3, resource_type: 5, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 143, index: 4, resource_type: 38, amount: 600000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 145, index: 0, resource_type: 23, amount: 540000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 145, index: 1, resource_type: 3, amount: 360000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 145, index: 2, resource_type: 5, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 145, index: 3, resource_type: 19, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 145, index: 4, resource_type: 38, amount: 1200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 147, index: 0, resource_type: 23, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 147, index: 1, resource_type: 3, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 147, index: 2, resource_type: 4, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 148, index: 0, resource_type: 23, amount: 1200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 149, index: 0, resource_type: 23, amount: 360000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 149, index: 1, resource_type: 3, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 149, index: 2, resource_type: 4, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 149, index: 3, resource_type: 7, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 149, index: 4, resource_type: 38, amount: 600000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 151, index: 0, resource_type: 23, amount: 540000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 151, index: 1, resource_type: 3, amount: 360000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 151, index: 2, resource_type: 7, amount: 240000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 151, index: 3, resource_type: 22, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 151, index: 4, resource_type: 38, amount: 1200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 153, index: 0, resource_type: 23, amount: 10000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 154, index: 0, resource_type: 23, amount: 10000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 155, index: 0, resource_type: 23, amount: 10000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 156, index: 0, resource_type: 23, amount: 10000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 157, index: 0, resource_type: 23, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 157, index: 1, resource_type: 3, amount: 120000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 157, index: 2, resource_type: 4, amount: 60000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 158, index: 0, resource_type: 23, amount: 360000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 159, index: 0, resource_type: 23, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 159, index: 1, resource_type: 35, amount: 1200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 159, index: 2, resource_type: 36, amount: 1200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 159, index: 3, resource_type: 38, amount: 200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 160, index: 0, resource_type: 23, amount: 360000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 160, index: 1, resource_type: 35, amount: 2400000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 160, index: 2, resource_type: 36, amount: 2400000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 160, index: 3, resource_type: 38, amount: 600000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 160, index: 4, resource_type: 3, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 161, index: 0, resource_type: 23, amount: 720000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 161, index: 1, resource_type: 35, amount: 4800000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 161, index: 2, resource_type: 36, amount: 4800000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 161, index: 3, resource_type: 38, amount: 1200000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 161, index: 4, resource_type: 3, amount: 360000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 161, index: 5, resource_type: 2, amount: 180000000000 },
        );
    world
        .write_model_test(
            @ResourceList { preset_id: 1, entity_id: 161, index: 6, resource_type: 4, amount: 180000000000 },
        );
}
