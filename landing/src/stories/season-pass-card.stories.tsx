import { SeasonPassCard } from "@/components/modules/season-pass-card";
import type { Meta, StoryObj } from "@storybook/react";
import "../index.css";

const meta = {
  title: "Modules/SeasonPass",
  component: SeasonPassCard,
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "dark",
    },
  },
  decorators: [
    (Story) => (
      <div className="flex items-center justify-center min-h-screen">
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof SeasonPassCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "1234",
    description: "A special season pass for realm #1234",
    owner: "0x1234...5678",
    isChecked: false,
    onCardClick: () => console.log("Card clicked"),
    lordsBalance: "1000",
    isLordsBalanceLoading: false,
    onAttachLords: async (amount: number) => {
      console.log(`Attaching ${amount} lords`);
    },
    isAttachLoading: false,
  },
};
