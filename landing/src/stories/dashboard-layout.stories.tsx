import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import type { Meta, StoryObj } from "@storybook/react";
import "../index.css";

const meta = {
  title: "Layouts/DashboardLayout",
  component: DashboardLayout,
  parameters: {
    layout: "fullscreen",
    backgrounds: {
      default: "dark",
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DashboardLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
