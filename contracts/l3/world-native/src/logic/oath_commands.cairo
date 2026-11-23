use crate::commands::Command;
use crate::troop_management::Army;

#[cfg(feature: "blitz")]
pub fn requires_answer(_game_id: u32, _command: Command) -> bool {
    false
}

#[cfg(not(feature: "blitz"))]
pub fn requires_answer(game_id: u32, command: Command) -> bool {
    match command {
        Command::BuySeal(_) => false,
        Command::BuyStamina(value) => waiting(game_id, value.explorer_id),
        Command::ChooseOath(_) => false,
        Command::RerollOath(_) => false,
        Command::ClaimDailyQuest(_) => false,
        Command::CreateExplorer(_) => false,
        Command::Explore(value) => waiting(game_id, value.explorer_id),
        Command::Battle(value) => waiting(game_id, value.attacker_id),
        Command::Move(value) => waiting(game_id, value.explorer_id),
        Command::ToggleAlternate(value) => waiting(game_id, value.explorer_id),
        Command::LevelUp(_) => false,
        Command::ProvisionRealm(_) => false,
        Command::SettleSeason(_) => false,
        Command::SettleVillage(_) => false,
        Command::ReceiveVillageArmy(_) => false,
        Command::BurnStructureResources(_) => false,
        Command::TransferExplorerResources(value) => waiting(game_id, value.from_entity_id)
            || waiting(game_id, value.to_entity_id),
        Command::OffloadArrival(_) => false,
        Command::SendResources(_) => false,
        Command::TransferExplorerResourcesToStructure(value) => waiting(game_id, value.from_entity_id),
        Command::BurnResourceForResourceProduction(_) => false,
        Command::CreateBuilding(_) => false,
        Command::DestroyBuilding(_) => false,
        Command::PauseBuildingProduction(_) => false,
        Command::ResumeBuildingProduction(_) => false,
        Command::BattleGuard(value) => waiting(game_id, value.attacker_id),
        Command::ApplyRelic(value) => waiting(game_id, value.entity_id),
        Command::CreateGuild(_) => false,
        Command::JoinGuild(_) => false,
        Command::LeaveGuild(_) => false,
        Command::SetGuildWhitelist(_) => false,
        Command::RemoveGuildMember(_) => false,
        Command::MarkGameSettled(_) => false,
        Command::ManageTroops(value) => match value {
            crate::troop_management::ManageTroops::RecruitExplorer(value) => waiting(game_id, value.explorer_id),
            crate::troop_management::ManageTroops::RemoveExplorer(id) => waiting(game_id, id),
            crate::troop_management::ManageTroops::Transfer(value) => managed_waiting(game_id, value.source)
                || managed_waiting(game_id, value.target),
            crate::troop_management::ManageTroops::RecruitGuard(_) |
            crate::troop_management::ManageTroops::RemoveGuard(_) => false,
        },
        Command::GuardAttack(_) => false,
        Command::ProvisionAndUpgradeRealm(_) => false,
        Command::SetEntityName(value) => waiting(game_id, value.entity_id),
        Command::EnterDepth(value) => waiting(game_id, value.explorer_id),
        Command::Research(_) => false,
        Command::InteractSite(value) => waiting(game_id, value.explorer_id),
    }
}

fn managed_waiting(game_id: u32, army: Army) -> bool {
    match army {
        Army::Explorer(id) => waiting(game_id, id),
        Army::Guard(_) => false,
    }
}

fn waiting(game_id: u32, explorer_id: u64) -> bool {
    match crate::logic::progression::read(crate::troops::ExplorerKey { game_id, explorer_id }) {
        Some(progress) => progress.oath_pick != 0,
        None => false,
    }
}
