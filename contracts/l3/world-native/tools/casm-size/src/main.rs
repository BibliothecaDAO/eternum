use anyhow::{Context, Result, bail};
use cairo_lang_starknet_classes::contract_class::ContractClass;
use serde_json::{Value, json};
use std::{collections::BTreeMap, env, fs, path::Path};

fn main() -> Result<()> {
    let paths: Vec<_> = env::args().skip(1).collect();
    if paths.len() != 2 {
        bail!("usage: native-casm-size CONTRACT_CLASS COMPILED_CONTRACT_CLASS");
    }
    let report = measure(Path::new(&paths[0]), Path::new(&paths[1]))?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}

fn measure(sierra_path: &Path, casm_path: &Path) -> Result<Value> {
    let class: ContractClass = serde_json::from_slice(&fs::read(sierra_path)?)?;
    let program = class.extract_sierra_program()?;
    let casm: Value = serde_json::from_slice(&fs::read(casm_path)?)?;
    let lengths = casm["bytecode_segment_lengths"]
        .as_array()
        .context("missing CASM segments")?;
    let total = casm["bytecode"]
        .as_array()
        .context("missing CASM bytecode")?
        .len();
    let mut functions: Vec<_> = program.funcs.iter().collect();
    functions.sort_by_key(|function| function.entry_point.0);
    if lengths.len() != functions.len() {
        bail!("segment/function count mismatch; constant segments require explicit attribution");
    }
    let mut modules = BTreeMap::<String, u64>::new();
    let mut breakdown = Vec::new();
    let mut offset = 0;
    for (function, length) in functions.iter().zip(lengths) {
        let name = function
            .id
            .debug_name
            .as_ref()
            .context("missing function name")?
            .to_string();
        let size = length
            .as_u64()
            .context("nested segment requires explicit attribution")?;
        let module = module_name(&name);
        *modules.entry(module.to_owned()).or_default() += size;
        breakdown
            .push(json!({"function": name, "module": module, "offset": offset, "felts": size}));
        offset += size;
    }
    if offset != total as u64 {
        bail!("segment lengths do not cover bytecode");
    }
    for entries in casm["entry_points_by_type"]
        .as_object()
        .context("missing CASM entrypoints")?
        .values()
    {
        for entry in entries.as_array().context("invalid entrypoint list")? {
            if !breakdown
                .iter()
                .any(|function| function["offset"] == entry["offset"])
            {
                bail!("entrypoint is not a function boundary");
            }
        }
    }
    Ok(
        json!({"schema": 1, "compiler": casm["compiler_version"], "totalFelts": total,
        "limitFelts": 81920, "withinLimit": total <= 81920,
        "attribution": "CASM segments in decoded Sierra function-entry order; generics attributed to their defining module",
        "modules": modules, "functions": breakdown}),
    )
}

fn module_name(function: &str) -> &str {
    let mut parts = function.split("::");
    let package = parts.next().unwrap_or(function);
    if package == "world_native" {
        parts.next().unwrap_or(package)
    } else {
        package
    }
}
