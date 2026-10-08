use ark_ff::{BigInteger, PrimeField, Zero};
use node_first_stark_vrf_math::{generate_public_key, BaseField, ScalarField, StarkVRF};
use std::{panic::catch_unwind, slice, thread};

const FELT_BYTES: usize = 32;
const PROOF_BYTES: usize = 6 * FELT_BYTES;
const MAX_BATCH: usize = 4096;

fn bytes<T: PrimeField>(field: T) -> [u8; FELT_BYTES] {
    let encoded = field.into_bigint().to_bytes_be();
    let mut result = [0_u8; FELT_BYTES];
    result[FELT_BYTES - encoded.len()..].copy_from_slice(&encoded);
    result
}

fn secret(input: &[u8]) -> Result<ScalarField, u32> {
    let key = ScalarField::from_be_bytes_mod_order(input);
    if key.is_zero() || bytes(key).as_slice() != input {
        return Err(2);
    }
    Ok(key)
}

fn prove(key: ScalarField, seeds: &[u8], output: &mut [u8]) -> Result<(), u32> {
    let prover = StarkVRF::new(generate_public_key(key)).map_err(|_| 3_u32)?;
    for (input, result) in seeds.chunks_exact(FELT_BYTES).zip(output.chunks_exact_mut(PROOF_BYTES)) {
        let seed = BaseField::from_be_bytes_mod_order(input);
        if bytes(seed).as_slice() != input {
            return Err(4);
        }
        let proof = prover.prove(&key, &[seed]).map_err(|_| 5_u32)?;
        let hint = prover.hash_to_sqrt_ratio_hint(&[seed]);
        let root = prover.proof_to_hash(&proof).map_err(|_| 6_u32)?;
        for (field, target) in [
            bytes(proof.0.x), bytes(proof.0.y), bytes(proof.1), bytes(proof.2), bytes(hint), bytes(root),
        ]
        .iter()
        .zip(result.chunks_exact_mut(FELT_BYTES))
        {
            target.copy_from_slice(field);
        }
    }
    Ok(())
}

fn parallel_proofs(key: ScalarField, seeds: &[u8], output: &mut [u8], threads: usize) -> Result<(), u32> {
    if threads == 1 {
        return prove(key, seeds, output);
    }
    let count = seeds.len() / FELT_BYTES;
    let chunk = count.div_ceil(threads);
    thread::scope(|scope| {
        let jobs: Vec<_> = seeds
            .chunks(chunk * FELT_BYTES)
            .zip(output.chunks_mut(chunk * PROOF_BYTES))
            .map(|(input, target)| scope.spawn(move || prove(key, input, target)))
            .collect();
        for job in jobs {
            job.join().map_err(|_| 7_u32)??;
        }
        Ok(())
    })
}

/// Writes the public Stark-curve point for a private scalar; never writes the scalar.
///
/// # Safety
/// `key` points to 32 initialized bytes. `output` points to 64 writable bytes,
/// disjoint from `key`; both buffers remain alive for this synchronous call.
#[no_mangle]
pub unsafe extern "C" fn node_first_vrf_public_key(key: *const u8, output: *mut u8) -> u32 {
    if key.is_null() || output.is_null() {
        return 1;
    }
    catch_unwind(|| {
        // SAFETY: caller guarantees valid, disjoint byte buffers of the documented lengths.
        let (input, result) = unsafe { (slice::from_raw_parts(key, 32), slice::from_raw_parts_mut(output, 64)) };
        let key = secret(input)?;
        let point = generate_public_key(key);
        result[..32].copy_from_slice(&bytes(point.x));
        result[32..].copy_from_slice(&bytes(point.y));
        Ok::<(), u32>(())
    })
    .map_or(7, |result| result.err().unwrap_or(0))
}

/// Produces five proof felts plus the root per seed; thread startup is included.
///
/// # Safety
/// `key` points to 32 initialized bytes; `seeds` to `count * 32` initialized bytes;
/// `output` to `count * 192` writable bytes. All three regions are disjoint and
/// remain alive until this synchronous call and its joined threads return.
#[no_mangle]
pub unsafe extern "C" fn node_first_vrf_prove(
    key: *const u8,
    seeds: *const u8,
    count: usize,
    threads: usize,
    output: *mut u8,
) -> u32 {
    if key.is_null() || seeds.is_null() || output.is_null() || count == 0 || count > MAX_BATCH || !matches!(threads, 1 | 2 | 4) {
        return 1;
    }
    catch_unwind(|| {
        // SAFETY: nonzero bounded count avoids arithmetic overflow; caller guarantees
        // the documented live, initialized, nonaliasing byte buffers. Threads join here.
        let (input, values, result) = unsafe {
            (
                slice::from_raw_parts(key, FELT_BYTES),
                slice::from_raw_parts(seeds, count * FELT_BYTES),
                slice::from_raw_parts_mut(output, count * PROOF_BYTES),
            )
        };
        parallel_proofs(secret(input)?, values, result, threads)
    })
    .map_or(7, |result| result.err().unwrap_or(0))
}
