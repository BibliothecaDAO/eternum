import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import type { Meta, StoryObj } from "@storybook/react";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import "../index.css";

import { routeTree } from "../routeTree.gen";

const meta = {
  title: "Layouts/DashboardLayout",
  component: DashboardLayout,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      const router = createRouter({ routeTree });

      return <RouterProvider router={router} />;
    },
  ],
} satisfies Meta<typeof DashboardLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <div>Hello</div>,
  },
};
