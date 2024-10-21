import { SeasonPassRow } from "@/components/modules/season-pass-row";
import type { Meta, StoryObj } from "@storybook/react";
import "../index.css";

const meta = {
  title: "Modules/SeasonPassRow",
  component: SeasonPassRow,
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "dark",
    },
  },
  decorators: [
    (Story) => (
      <div className="flex items-center justify-center min-h-screen w-screen">
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof SeasonPassRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    seasonPasses: [],
  },
};
