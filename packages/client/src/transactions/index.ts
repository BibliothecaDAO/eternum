import { BankTransactions } from "./bank";
import { BuildingTransactions } from "./buildings";
import { CombatTransactions } from "./combat";
import { GuildTransactions } from "./guild";
import { HyperstructureTransactions } from "./hyperstructure";
import { RealmTransactions } from "./realm";
import { ResourceTransactions } from "./resources";
import { TradeTransactions } from "./trade";
import { TroopTransactions } from "./troops";

export class TransactionClient {
  readonly resources: ResourceTransactions;
  readonly troops: TroopTransactions;
  readonly combat: CombatTransactions;
  readonly trade: TradeTransactions;
  readonly buildings: BuildingTransactions;
  readonly bank: BankTransactions;
  readonly hyperstructure: HyperstructureTransactions;
  readonly guild: GuildTransactions;
  readonly realm: RealmTransactions;

  constructor(provider: any) {
    this.resources = new ResourceTransactions(provider);
    this.troops = new TroopTransactions(provider);
    this.combat = new CombatTransactions(provider);
    this.trade = new TradeTransactions(provider);
    this.buildings = new BuildingTransactions(provider);
    this.bank = new BankTransactions(provider);
    this.hyperstructure = new HyperstructureTransactions(provider);
    this.guild = new GuildTransactions(provider);
    this.realm = new RealmTransactions(provider);
  }
}

export { BankTransactions } from "./bank";
export { BuildingTransactions } from "./buildings";
export { CombatTransactions } from "./combat";
export { GuildTransactions } from "./guild";
export { HyperstructureTransactions } from "./hyperstructure";
export { RealmTransactions } from "./realm";
export { ResourceTransactions } from "./resources";
export { TradeTransactions } from "./trade";
export { TroopTransactions } from "./troops";
