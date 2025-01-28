export enum ChainId {
    MAINNET = 1,
    SEPOLIA = 11155111,
    MISSISSIPPI_TESTNET = 33784,
  
    SN_MAIN = "0x534e5f4d41494e",
    SN_SEPOLIA = "0x534e5f5345504f4c4941",
  
    REALMS_L3 = "420",
  
    SLOT_TESTNET = 555, // TODO: update with the real value
  
    SN_DEVNET = 556, // TODO: update with the real value
  }
  

export enum Collections {
    REALMS = "realms",
    BEASTS = "beasts",
    GOLDEN_TOKEN = "goldentoken",
    BLOBERT = "blobert",
    BANNERS = "banners",
    ETERNUM_0 = "eternum-0",
  }
  
  export const CollectionAddresses: {
    readonly [key in Collections]: Partial<{ [key in ChainId]: string }>;
  } = {
    [Collections.REALMS]: {
      [ChainId.MAINNET]: "0x07afe30cb3e53dba6801aa0ea647a0ecea7cbe18d",
      [ChainId.SEPOLIA]: "0x0A642270Cc73B2FC1605307F853712F944394564",
      [ChainId.SN_SEPOLIA]:
        "0x3e64aa2c669ffd66a1c78d120812005d8f7e03b75696dd9c0f06e8def143844",
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
      [ChainId.SN_SEPOLIA]: "",
    },
    [Collections.ETERNUM_0]: {
      [ChainId.SN_MAIN]:
        "0x057675b9c0bd62b096a2e15502a37b290fa766ead21c33eda42993e48a714b80",
    },
  };