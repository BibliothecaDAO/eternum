// Generated from the permanent wire registry and production Story ABI.
use crate::ownership::Story;

pub impl StorySerde of Serde<Story> {
    fn serialize(self: @Story, ref output: Array<felt252>) {
        match self {
            Story::StructureLevelUpStory(value) => {
                output.append(1);
                Serde::serialize(value, ref output);
            },
            Story::RealmCreatedStory(value) => {
                output.append(2);
                Serde::serialize(value, ref output);
            },
            Story::GuardAddStory(value) => {
                output.append(3);
                Serde::serialize(value, ref output);
            },
            Story::ResourceBurnStory(value) => {
                output.append(4);
                Serde::serialize(value, ref output);
            },
            Story::ResourceTransferStory(value) => {
                output.append(5);
                Serde::serialize(value, ref output);
            },
            Story::ResourceReceiveArrivalStory(value) => {
                output.append(6);
                Serde::serialize(value, ref output);
            },
            Story::ProductionStory(value) => {
                output.append(7);
                Serde::serialize(value, ref output);
            },
            Story::BuildingPlacementStory(value) => {
                output.append(8);
                Serde::serialize(value, ref output);
            },
            Story::BuildingPaymentStory(value) => {
                output.append(9);
                Serde::serialize(value, ref output);
            },
            Story::BitcoinAwardStory(value) => {
                output.append(10);
                Serde::serialize(value, ref output);
            },
            Story::StructureCapturedStory(value) => {
                output.append(11);
                Serde::serialize(value, ref output);
            },
            Story::HyperstructurePoints(value) => {
                output.append(17);
                Serde::serialize(value, ref output);
            },
            Story::RelicChestOpened(value) => {
                output.append(18);
                Serde::serialize(value, ref output);
            },
            Story::ExplorationReward(value) => {
                output.append(19);
                Serde::serialize(value, ref output);
            },
            Story::SeasonEnded(value) => {
                output.append(20);
                Serde::serialize(value, ref output);
            },
            Story::BlitzFinalized(value) => {
                output.append(23);
                Serde::serialize(value, ref output);
            },
            Story::RelicCrafted(value) => {
                output.append(24);
                Serde::serialize(value, ref output);
            },
            Story::ExplorerCreateStory(value) => {
                output.append(25);
                Serde::serialize(value, ref output);
            },
            Story::ExplorerAddStory(value) => {
                output.append(26);
                Serde::serialize(value, ref output);
            },
            Story::ExplorerDeleteStory(value) => {
                output.append(27);
                Serde::serialize(value, ref output);
            },
            Story::GuardDeleteStory(value) => {
                output.append(28);
                Serde::serialize(value, ref output);
            },
            Story::TroopsTransferred(value) => {
                output.append(29);
                Serde::serialize(value, ref output);
            },
            Story::LordsWithdrawn(value) => {
                output.append(30);
                Serde::serialize(value, ref output);
            },
            Story::SkillPointSpent(value) => {
                output.append(31);
                Serde::serialize(value, ref output);
            },
            Story::SitePayout(value) => {
                output.append(32);
                Serde::serialize(value, ref output);
            },
            Story::SpireDiscovered(value) => {
                output.append(33);
                Serde::serialize(value, ref output);
            },
            Story::RewardChestOpened(value) => {
                output.append(34);
                Serde::serialize(value, ref output);
            },
            Story::RelicActivated(value) => {
                output.append(35);
                Serde::serialize(value, ref output);
            },
            Story::SiteUsed(value) => {
                output.append(36);
                Serde::serialize(value, ref output);
            },
        }
    }

    fn deserialize(ref serialized: Span<felt252>) -> Option<Story> {
        let tag: u32 = Serde::deserialize(ref serialized)?;
        match tag {
            0 => None,
            1 => Some(Story::StructureLevelUpStory(Serde::deserialize(ref serialized)?)),
            2 => Some(Story::RealmCreatedStory(Serde::deserialize(ref serialized)?)),
            3 => Some(Story::GuardAddStory(Serde::deserialize(ref serialized)?)),
            4 => Some(Story::ResourceBurnStory(Serde::deserialize(ref serialized)?)),
            5 => Some(Story::ResourceTransferStory(Serde::deserialize(ref serialized)?)),
            6 => Some(Story::ResourceReceiveArrivalStory(Serde::deserialize(ref serialized)?)),
            7 => Some(Story::ProductionStory(Serde::deserialize(ref serialized)?)),
            8 => Some(Story::BuildingPlacementStory(Serde::deserialize(ref serialized)?)),
            9 => Some(Story::BuildingPaymentStory(Serde::deserialize(ref serialized)?)),
            10 => Some(Story::BitcoinAwardStory(Serde::deserialize(ref serialized)?)),
            11 => Some(Story::StructureCapturedStory(Serde::deserialize(ref serialized)?)),
            12 => None,
            13 => None,
            14 => None,
            15 => None,
            16 => None,
            17 => Some(Story::HyperstructurePoints(Serde::deserialize(ref serialized)?)),
            18 => Some(Story::RelicChestOpened(Serde::deserialize(ref serialized)?)),
            19 => Some(Story::ExplorationReward(Serde::deserialize(ref serialized)?)),
            20 => Some(Story::SeasonEnded(Serde::deserialize(ref serialized)?)),
            21 => None,
            22 => None,
            23 => Some(Story::BlitzFinalized(Serde::deserialize(ref serialized)?)),
            24 => Some(Story::RelicCrafted(Serde::deserialize(ref serialized)?)),
            25 => Some(Story::ExplorerCreateStory(Serde::deserialize(ref serialized)?)),
            26 => Some(Story::ExplorerAddStory(Serde::deserialize(ref serialized)?)),
            27 => Some(Story::ExplorerDeleteStory(Serde::deserialize(ref serialized)?)),
            28 => Some(Story::GuardDeleteStory(Serde::deserialize(ref serialized)?)),
            29 => Some(Story::TroopsTransferred(Serde::deserialize(ref serialized)?)),
            30 => Some(Story::LordsWithdrawn(Serde::deserialize(ref serialized)?)),
            31 => Some(Story::SkillPointSpent(Serde::deserialize(ref serialized)?)),
            32 => Some(Story::SitePayout(Serde::deserialize(ref serialized)?)),
            33 => Some(Story::SpireDiscovered(Serde::deserialize(ref serialized)?)),
            34 => Some(Story::RewardChestOpened(Serde::deserialize(ref serialized)?)),
            35 => Some(Story::RelicActivated(Serde::deserialize(ref serialized)?)),
            36 => Some(Story::SiteUsed(Serde::deserialize(ref serialized)?)),
            _ => None,
        }
    }
}
