import ControllerConnector from "@cartridge/connector/controller";

export const cartridgeController = new ControllerConnector({

    rpc: "https://api.cartridge.gg/x/starknet/sepolia",
    // Uncomment to use a custom theme
    // theme: "dope-wars",
    // colorMode: "light"
    });