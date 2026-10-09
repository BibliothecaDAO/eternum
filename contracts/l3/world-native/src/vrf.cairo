use realms_vrf_verifier::vendor::ecvrf::Point;
use realms_vrf_verifier::{IVrfVerifierLibraryDispatcher, IVrfVerifierDispatcherTrait};

/// The owned read-only library refuses invalid fees and stamps before returning a root.
pub fn checked_root(key: Point, l2_gas_bound: u64) -> u256 {
    let class_hash = crate::vrf_class::VRF_VERIFIER_CLASS_HASH.try_into().unwrap();
    IVrfVerifierLibraryDispatcher { class_hash }.verify(key, l2_gas_bound).into()
}
