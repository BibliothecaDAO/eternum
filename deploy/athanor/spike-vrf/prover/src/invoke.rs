use serde::Deserialize;
use starknet_crypto::{poseidon_hash_many, Felt};

#[derive(Deserialize)]
struct Bound {
    max_amount: String,
    max_price_per_unit: String,
}
#[derive(Deserialize)]
struct Bounds {
    l1_gas: Bound,
    l2_gas: Bound,
    l1_data_gas: Bound,
}
#[derive(Deserialize)]
struct Invoke {
    #[serde(rename = "type")]
    kind: String,
    version: String,
    sender_address: String,
    nonce: String,
    tip: String,
    calldata: Vec<String>,
    paymaster_data: Vec<String>,
    account_deployment_data: Vec<String>,
    resource_bounds: Bounds,
    nonce_data_availability_mode: String,
    fee_data_availability_mode: String,
}
fn felt(value: &str) -> Result<Felt, u32> {
    if value.starts_with("0x") {
        Felt::from_hex(value).map_err(|_| 9)
    } else {
        Felt::from_dec_str(value).map_err(|_| 9)
    }
}
fn hash(values: &[String]) -> Result<Felt, u32> {
    let input = values
        .iter()
        .map(|value| felt(value))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(poseidon_hash_many(&input))
}
fn resource(name: &[u8], bound: &Bound) -> Result<Felt, u32> {
    let amount = felt(&bound.max_amount)?.to_bytes_be();
    let price = felt(&bound.max_price_per_unit)?.to_bytes_be();
    if amount[..24].iter().any(|&v| v != 0) || price[..16].iter().any(|&v| v != 0) {
        return Err(10);
    }
    let mut encoded = [0u8; 32];
    encoded[8 - name.len()..8].copy_from_slice(name);
    encoded[8..16].copy_from_slice(&amount[24..]);
    encoded[16..].copy_from_slice(&price[16..]);
    Ok(Felt::from_bytes_be(&encoded))
}
fn mode(value: &str) -> Result<u64, u32> {
    match value {
        "L1" => Ok(0),
        "L2" => Ok(1),
        _ => Err(11),
    }
}
/// Starknet V3 INVOKE hash, matching the SDK; the signature is not hashed.
pub(crate) fn invoke_hash(data: &[u8], chain: &[u8]) -> Result<[u8; 32], u32> {
    let tx: Invoke = serde_json::from_slice(data).map_err(|_| 8u32)?;
    if tx.kind != "INVOKE" || felt(&tx.version)? != Felt::from(3u64) {
        return Err(12);
    }
    let fee = poseidon_hash_many(&[
        felt(&tx.tip)?,
        resource(b"L1_GAS", &tx.resource_bounds.l1_gas)?,
        resource(b"L2_GAS", &tx.resource_bounds.l2_gas)?,
        resource(b"L1_DATA", &tx.resource_bounds.l1_data_gas)?,
    ]);
    let availability =
        (mode(&tx.nonce_data_availability_mode)? << 32) | mode(&tx.fee_data_availability_mode)?;
    let chain_bytes = <[u8; 32]>::try_from(chain).map_err(|_| 9u32)?;
    let chain = Felt::from_bytes_be(&chain_bytes);
    let mut prefix = [0u8; 32];
    prefix[26..].copy_from_slice(b"invoke");
    Ok(poseidon_hash_many(&[
        Felt::from_bytes_be(&prefix),
        Felt::from(3u64),
        felt(&tx.sender_address)?,
        fee,
        hash(&tx.paymaster_data)?,
        chain,
        felt(&tx.nonce)?,
        Felt::from(availability),
        hash(&tx.account_deployment_data)?,
        hash(&tx.calldata)?,
    ])
    .to_bytes_be())
}
