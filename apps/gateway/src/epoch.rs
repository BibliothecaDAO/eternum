use crate::protocol::{epoch_commitment, epoch_root, root_limbs};
use anyhow::{ensure, Context};
use serde::{Deserialize, Serialize};
use starknet_types_core::felt::Felt;
use std::{
    fs::{File, OpenOptions},
    io::Write,
    os::unix::fs::OpenOptionsExt,
    path::Path,
};

/// Only this secret survives restart. Tickets, assigned orders and roots do not.
#[derive(Serialize, Deserialize)]
pub(crate) struct EpochSecret {
    pub epoch: u64,
    secret: [u8; 32],
}

impl EpochSecret {
    pub fn create(epoch: u64) -> anyhow::Result<Self> {
        ensure!(epoch > 0, "invalid epoch");
        let mut secret = [0; 32];
        let filled = rustix::rand::getrandom(&mut secret, rustix::rand::GetRandomFlags::empty())?;
        ensure!(filled == secret.len(), "incomplete epoch entropy");
        Ok(Self { epoch, secret })
    }

    pub fn commitment(&self) -> Felt {
        epoch_commitment(self.secret)
    }

    pub fn root(&self, game: Felt, order: u64) -> [u8; 32] {
        epoch_root(self.secret, game, order)
    }

    pub fn reveal(&self) -> [Felt; 2] {
        let (low, high) = root_limbs(self.secret);
        [low.into(), high.into()]
    }

    pub fn load(path: &Path) -> anyhow::Result<Self> {
        serde_json::from_slice(&std::fs::read(path).context("read randomness epoch secret")?)
            .context("decode randomness epoch secret")
    }

    /// Persist before publishing the commitment. Rename plus directory sync covers either
    /// side of a crash without retaining any per-ticket data or a second transaction log.
    pub fn save(&self, path: &Path) -> anyhow::Result<()> {
        let parent = path.parent().context("epoch secret path needs a parent")?;
        std::fs::create_dir_all(parent)?;
        let temporary = path.with_extension("pending");
        let mut file = OpenOptions::new().write(true).create(true).truncate(true).mode(0o600).open(&temporary)?;
        file.write_all(&serde_json::to_vec(self)?)?;
        file.sync_all()?;
        std::fs::rename(&temporary, path)?;
        File::open(parent)?.sync_all()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retained_secret_reconstructs_every_root_of_every_game() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("epoch.json");
        let epoch = EpochSecret::create(3).unwrap();
        epoch.save(&path).unwrap();
        let restored = EpochSecret::load(&path).unwrap();
        assert_eq!((restored.epoch, restored.commitment(), restored.reveal()), (3, epoch.commitment(), epoch.reveal()));
        for game in [Felt::ONE, Felt::TWO] {
            for order in 1..=4 {
                assert_eq!(epoch.root(game, order), restored.root(game, order));
            }
        }
        assert_ne!(epoch.root(Felt::ONE, 1), epoch.root(Felt::TWO, 1));
        let next = EpochSecret::create(4).unwrap();
        next.save(&path).unwrap();
        assert_eq!(EpochSecret::load(&path).unwrap().commitment(), next.commitment());
        assert_ne!(next.commitment(), epoch.commitment());
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(std::fs::metadata(path).unwrap().permissions().mode() & 0o777, 0o600);
    }
}
