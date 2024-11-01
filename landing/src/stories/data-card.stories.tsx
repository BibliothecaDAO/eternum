import { DataCard } from "@/components/modules/data-card";
import type { Meta, StoryObj } from "@storybook/react";
import { UsersIcon } from "lucide-react";
import "../index.css";

const meta = {
  title: "Modules/DataCard",
  component: DataCard,
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
} satisfies Meta<typeof DataCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "players",
    value: "1000",
    description: "season 1 active players",
    icon: <UsersIcon />,
  },
};
