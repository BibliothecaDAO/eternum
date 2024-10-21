import { SeasonPass } from "@/components/modules/season-pass";
import type { Meta, StoryObj } from "@storybook/react";
import "../index.css";

const meta = {
  title: "Modules/SeasonPass",
  component: SeasonPass,
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
} satisfies Meta<typeof SeasonPass>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Season Pass",
    description: "Description",
  },
};
