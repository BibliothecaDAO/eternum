mod invoke;
use ark_ff::{BigInteger, PrimeField, Zero};
use realms_stark_vrf_math::{BaseField, ScalarField, StarkVRF, generate_public_key};
use std::{panic::catch_unwind, slice, sync::Once};

fn silence_native_panics() {
    static INIT: Once = Once::new();
    // Native failures cross FFI as a fixed status, never as a diagnostic containing proof values.
    INIT.call_once(|| std::panic::set_hook(Box::new(|_| {})));
}

fn encode<F: PrimeField>(value: F) -> [u8; 32] {
    let bytes = value.into_bigint().to_bytes_be();
    let mut out = [0u8; 32];
    out[32 - bytes.len()..].copy_from_slice(&bytes);
    out
}
fn scalar(bytes: &[u8]) -> Result<ScalarField, u32> {
    let value = ScalarField::from_be_bytes_mod_order(bytes);
    if value.is_zero() || encode(value).as_slice() != bytes {
        return Err(2);
    }
    Ok(value)
}
fn field(bytes: &[u8]) -> Result<BaseField, u32> {
    let value = BaseField::from_be_bytes_mod_order(bytes);
    if encode(value).as_slice() != bytes {
        return Err(2);
    }
    Ok(value)
}

/// # Safety
/// key:32 initialized bytes; output:64 disjoint writable bytes. Both live until return; no pointer retained.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn realms_vrf_public_key(key: *const u8, output: *mut u8) -> u32 {
    if key.is_null() || output.is_null() {
        return 1;
    }
    silence_native_panics();
    catch_unwind(|| {
        // SAFETY: caller supplies the documented live, disjoint fixed-width buffers.
        let (key, out) = unsafe {
            (
                slice::from_raw_parts(key, 32),
                slice::from_raw_parts_mut(output, 64),
            )
        };
        let point = generate_public_key(scalar(key)?);
        out[..32].copy_from_slice(&encode(point.x));
        out[32..].copy_from_slice(&encode(point.y));
        Ok::<(), u32>(())
    })
    .map_or(4, |result| result.err().unwrap_or(0))
}
/// # Safety
/// raw:len initialized bytes,1..1MiB; key:32, chain:32 initialized bytes; output:192 writable bytes.
/// All regions must be disjoint and remain live for this synchronous call. No pointer is retained.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn realms_vrf_stamp(
    raw: *const u8,
    len: usize,
    key: *const u8,
    chain: *const u8,
    output: *mut u8,
) -> u32 {
    if raw.is_null()
        || key.is_null()
        || chain.is_null()
        || output.is_null()
        || len == 0
        || len > 1024 * 1024
    {
        return 1;
    }
    silence_native_panics();
    catch_unwind(|| {
        // SAFETY: caller supplies bounded, live, initialized, nonaliasing byte regions.
        let (raw, key, chain, out) = unsafe {
            (
                slice::from_raw_parts(raw, len),
                slice::from_raw_parts(key, 32),
                slice::from_raw_parts(chain, 32),
                slice::from_raw_parts_mut(output, 192),
            )
        };
        let key = scalar(key)?;
        let hash = invoke::invoke_hash(raw, chain)?;
        let seed = field(&hash)?;
        let prover = StarkVRF::new(generate_public_key(key)).map_err(|_| 3u32)?;
        let proof = prover.prove(&key, &[seed]).map_err(|_| 3u32)?;
        let hint = prover.hash_to_sqrt_ratio_hint(&[seed]);
        for (target, value) in out.chunks_exact_mut(32).zip([
            hash,
            encode(proof.0.x),
            encode(proof.0.y),
            encode(proof.1),
            encode(proof.2),
            encode(hint),
        ]) {
            target.copy_from_slice(&value);
        }
        Ok::<(), u32>(())
    })
    .map_or(4, |result| result.err().unwrap_or(0))
}
