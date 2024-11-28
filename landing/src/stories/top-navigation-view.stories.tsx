import { TopNavigationView } from "@/components/modules/top-navigation-view";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { Meta, StoryObj } from "@storybook/react";
import { uint256 } from "starknet";
import "../index.css";

const meta = {
  title: "Modules/TopNavigationView",
  component: TopNavigationView,
  parameters: {
    layout: "fullscreen",
    backgrounds: {
      default: "dark",
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <SidebarProvider>
        <div className="w-full">
          <Story />
        </div>
      </SidebarProvider>
    ),
  ],
} satisfies Meta<typeof TopNavigationView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    lordsBalance: uint256.bnToUint256(1000000000000000000n), // 1 LORDS
    onMintTestLords: async () => {
      console.log("Minting test LORDS");
    },
    connectors: [
      {
        id: "argentX",
        name: "Argent X",
        icon: "https://www.argent.xyz/favicon.ico",
      },
      {
        id: "braavos",
        name: "Braavos",
        icon: "https://braavos.app/favicon.ico",
      },
    ],
    onConnect: (connector: any) => {
      console.log("Connecting with", connector.name);
    },
    onDisconnect: () => {
      console.log("Disconnecting wallet");
    },
    accountAddress: "0x123...abc",
  },
};
