import { SideNavigation } from "@/components/modules/side-navigation";
import type { Meta, StoryObj } from "@storybook/react";
import "../index.css";

const meta = {
  title: "Modules/SideNavigation",
  component: SideNavigation,
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
} satisfies Meta<typeof SideNavigation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "players",
  },
};
