import { ChainId } from "./chains";

export enum Collections {
  REALMS = "realms",
  BEASTS = "beasts",
  GOLDEN_TOKEN = "goldentoken",
  BLOBERT = "blobert",
  BANNERS = "banners",
  ETERNUM_0 = "eternum-0",
}

export const CollectionAddresses: Readonly<
  Record<Collections, Partial<Record<ChainId, `0x${string}`>>>
> = {
  [Collections.REALMS]: {
    [ChainId.MAINNET]: "0x07afe30cb3e53dba6801aa0ea647a0ecea7cbe18d",
    [ChainId.SEPOLIA]: "0x0A642270Cc73B2FC1605307F853712F944394564",
    [ChainId.SN_SEPOLIA]:
      "0x03e64aa2c669ffd66a1c78d120812005d8f7e03b75696dd9c0f06e8def143844",
    [ChainId.SN_MAIN]:
      "0x07ae27a31bb6526e3de9cf02f081f6ce0615ac12a6d7b85ee58b8ad7947a2809",
  },
  [Collections.BEASTS]: {
    [ChainId.SN_MAIN]:
      "0x0158160018d590d93528995b340260e65aedd76d28a686e9daa5c4e8fad0c5dd",
    [ChainId.SN_SEPOLIA]:
      "0x03065c1db93be057c40fe92c9cba7f898de8d3622693d128e4e97fdc957808a3",
  },
  [Collections.GOLDEN_TOKEN]: {
    [ChainId.SN_MAIN]:
      "0x04f5e296c805126637552cf3930e857f380e7c078e8f00696de4fc8545356b1d",
    [ChainId.SN_SEPOLIA]:
      "0x024f21982680442892d2f7ac4cee98c7d62708b04fdf9f8a0453415baca4b16f",
  },
  [Collections.BLOBERT]: {
    [ChainId.SN_MAIN]:
      "0x00539f522b29ae9251dbf7443c7a950cf260372e69efab3710a11bf17a9599f1",
    [ChainId.SN_SEPOLIA]:
      "0x007075083c7f643a2009cf1dfa28dfec9366f7d374743c2e378e03c01e16c3af",
  },
  [Collections.BANNERS]: {
    [ChainId.SN_MAIN]:
      "0x02d66679de61a5c6d57afd21e005a8c96118bd60315fd79a4521d68f5e5430d1",
    //[ChainId.SN_SEPOLIA]: "",
  },
  [Collections.ETERNUM_0]: {
    [ChainId.SN_MAIN]:
      "0x057675b9c0bd62b096a2e15502a37b290fa766ead21c33eda42993e48a714b80",
  },
};

class Token {
  public readonly decimals: number;
  public readonly symbol?: string;
  public readonly name?: string;
  public readonly chainId: ChainId;
  public readonly address: string;

  public constructor(
    chainId: ChainId,
    address: string,
    decimals: number,
    symbol?: string,
    name?: string,
  ) {
    this.chainId = chainId;
    this.address = address;
    this.decimals = decimals;
    this.symbol = symbol;
    this.name = name;
  }
}

export const LORDS: Partial<Record<ChainId, Token>> = {
  [ChainId.MAINNET]: new Token(
    ChainId.MAINNET,
    "0x686f2404e77ab0d9070a46cdfb0b7fecdd2318b0",
    18,
    "LORDS",
    "Lords",
  ),
  [ChainId.SEPOLIA]: new Token(
    ChainId.SEPOLIA,
    "0x9f091D72A7E9677272A502fb6b3e8A7755F50224",
    18,
    "LORDS",
    "Lords",
  ),
  [ChainId.SN_MAIN]: new Token(
    ChainId.SN_MAIN,
    "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
    18,
    "LORDS",
    "Lords",
  ),
  [ChainId.SN_SEPOLIA]: new Token(
    ChainId.SN_SEPOLIA,
    "0x019c92fa87f4d5e3be25c3dd6a284f30282a07e87cd782f5fd387b82c8142017",
    18,
    "LORDS",
    "Lords",
  ),
};

export enum StakingContracts {
  GALLEON = "galleon",
  CARRACK = "carrack",
  PAYMENT_POOL = "paymentpool",
  PAYMENT_POOL_V2 = "paymentpoolv2",
  VE_LORDS = "velords",
  REWARD_POOL = "rewardpool",
  LEGACY_REWARD = "legacyreward",
}

export const StakingAddresses: Readonly<
  Record<StakingContracts, Partial<Record<ChainId, string>>>
> = {
  [StakingContracts.GALLEON]: {
    [ChainId.MAINNET]: "0x17963290db8c30552d0cfa2a6453ff20a28c31a2",
    [ChainId.SEPOLIA]: "0x7cb8c2a2e635b8518a3d8e6d70480583c85a7297",
  },
  [StakingContracts.CARRACK]: {
    [ChainId.MAINNET]: "0xcdFe3d7eBFA793675426F150E928CD395469cA53",
    [ChainId.SEPOLIA]: "",
  },
  [StakingContracts.PAYMENT_POOL]: {
    [ChainId.MAINNET]: "0x55A69A21C44B1922D3F96B961AE567C789c4399e",
    [ChainId.SEPOLIA]: "",
  },
  [StakingContracts.PAYMENT_POOL_V2]: {
    [ChainId.MAINNET]: "0x8428aad84594b6b78da13e773d902f5c44b93f17",
    [ChainId.SEPOLIA]: "",
  },
  [StakingContracts.VE_LORDS]: {
    [ChainId.SN_MAIN]:
      "0x47230028629128ac5bfbb384d32f925e70e329b624fc5d82e9c60f5746795cd",
    [ChainId.SN_SEPOLIA]:
      "0x38306182f5f04496efc0db2e533874d41c9ae298af9a42405218bf58f8e57d2",
  },
  [StakingContracts.REWARD_POOL]: {
    [ChainId.SN_MAIN]:
      "0x91b13b83e5c34112aa066a844d4cbe6af99b3d134293829ca1730ea4869a71",
    [ChainId.SN_SEPOLIA]:
      "0x5d748db07d5d307a9ba2ada904209278eb50816cf238f8195dfbc266113a703",
  },
  [StakingContracts.LEGACY_REWARD]: {
    [ChainId.MAINNET]: "0x7Ad94e71308Bb65c6bc9dF35cc69Cc9f953D69E5",
    [ChainId.SEPOLIA]: "0x5C209C96733BA71Fb09772D22d12Fc6f8CB980cA",
    [ChainId.SN_MAIN]:
      "0x38862e1b15526eda31ed6fd26805c40748458db8e420cb3be3bc65c332c023b",
    [ChainId.SN_SEPOLIA]:
      "0x48c774a0f71120aeffcb520fa4a08e1659c17abb46a792ea1e1bbbcf5ef38f3",
  },
};
