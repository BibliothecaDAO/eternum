//! Starknet Poseidon for Herald's entity ids, compiled to WebAssembly: a native row's id is Poseidon over its key felts.
//! The host writes big-endian felts into `buffer()`, calls `poseidon_hash(count)`, and reads the hash from the buffer.
#![no_std]
extern crate alloc;

use alloc::vec::Vec;
use core::ptr::addr_of_mut;
use starknet_crypto::poseidon_hash_many;
use starknet_types_core::felt::Felt;

const MAX_FELTS: usize = 64;
static mut BUFFER: [u8; 32 * MAX_FELTS] = [0; 32 * MAX_FELTS];

#[global_allocator]
static ALLOCATOR: lol_alloc::AssumeSingleThreaded<lol_alloc::FreeListAllocator> =
    unsafe { lol_alloc::AssumeSingleThreaded::new(lol_alloc::FreeListAllocator::new()) };

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

/// Where the host writes the felts and reads the hash.
#[no_mangle]
pub extern "C" fn buffer() -> *mut u8 {
    addr_of_mut!(BUFFER) as *mut u8
}

/// Hashes the first `count` felts of the buffer into its first 32 bytes; 0 when count is out of range.
#[no_mangle]
pub extern "C" fn poseidon_hash(count: usize) -> u32 {
    if count == 0 || count > MAX_FELTS {
        return 0;
    }
    let bytes = unsafe { &mut *addr_of_mut!(BUFFER) };
    let felts: Vec<Felt> = bytes[..32 * count]
        .chunks_exact(32)
        .map(|chunk| Felt::from_bytes_be_slice(chunk))
        .collect();
    bytes[..32].copy_from_slice(&poseidon_hash_many(&felts).to_bytes_be());
    1
}
