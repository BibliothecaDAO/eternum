import { TopNavigation } from "@/components/modules/top-navigation";
import type { Meta, StoryObj } from "@storybook/react";
import "../index.css";

const meta = {
  title: "Modules/TopNavigation",
  component: TopNavigation,
  parameters: {
    layout: "fullscreen",
    backgrounds: {
      default: "dark",
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TopNavigation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
