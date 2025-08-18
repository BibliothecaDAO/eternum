# Storybook Implementation Plan for Eternum

## 🎯 Overview

This plan outlines a progressive approach to implementing Storybook in the Eternum game client, focusing on rapid UI
iteration, component documentation, and visual testing. The implementation is designed to provide immediate value while
avoiding disruption to ongoing development.

## 🚀 Goals

1. **Accelerate UI Development**: Develop components in isolation without running the full game
2. **Living Documentation**: Create an interactive component library
3. **Visual Testing**: Catch UI regressions early
4. **Design Collaboration**: Enable designers to review and test components
5. **Component Reusability**: Encourage building reusable components

## 📊 Implementation Phases

### Phase 0: Setup & Infrastructure (Day 1-2)

#### Installation and Configuration

```bash
# Install Storybook
npx storybook@latest init

# Additional addons for better DX
npm install -D @storybook/addon-essentials \
  @storybook/addon-interactions \
  @storybook/addon-a11y \
  @storybook/addon-viewport \
  storybook-addon-designs \
  storybook-tailwind-dark-mode
```

#### Basic Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx|mdx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-a11y",
    "storybook-addon-designs",
    "storybook-tailwind-dark-mode",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    builder: "@storybook/builder-vite",
  },
  viteFinal: async (config) => {
    // Merge with existing Vite config
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          "@": "/src",
          "@config": "../../../config/utils/utils",
          "@contracts": "../../../contracts/utils/utils",
        },
      },
    };
  },
};

export default config;
```

#### Theme Configuration

```typescript
// .storybook/preview.tsx
import '../src/index.css';
import { themes } from '@storybook/theming';
import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    darkMode: {
      dark: { ...themes.dark, appBg: '#14100D' },
      light: { ...themes.normal, appBg: '#FFF5EA' },
      current: 'dark',
    },
    backgrounds: {
      default: 'game-dark',
      values: [
        { name: 'game-dark', value: '#14100D' },
        { name: 'game-light', value: '#FFF5EA' },
        { name: 'white', value: '#ffffff' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-brown text-gold">
        <Story />
      </div>
    ),
  ],
};

export default preview;
```

### Phase 1: Design System Components (Week 1)

Start with the most reusable, standalone components that have no external dependencies.

#### 1.1 Atoms (Days 1-2)

```typescript
// src/ui/design-system/atoms/button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import Button from './button';

const meta: Meta<typeof Button> = {
  title: 'Design System/Atoms/Button',
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'Base button component with multiple variants for the game UI',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'gold', 'danger', 'outline'],
    },
    size: {
      control: 'radio',
      options: ['xs', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Click me',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="gold">Gold</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="outline">Outline</Button>
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    children: 'Interactive Button',
    onClick: () => alert('Button clicked!'),
  },
};

export const Loading: Story = {
  args: {
    children: 'Loading...',
    isLoading: true,
  },
};
```

**Components to implement first**:

- [ ] Button (all variants)
- [ ] Input fields (text, number)
- [ ] Select dropdowns
- [ ] Checkbox
- [ ] Tabs
- [ ] Avatar
- [ ] NavigationButton

#### 1.2 Molecules (Days 3-4)

```typescript
// src/ui/design-system/molecules/resource-cost.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ResourceCost } from './resource-cost';

const meta: Meta<typeof ResourceCost> = {
  title: 'Design System/Molecules/ResourceCost',
  component: ResourceCost,
  decorators: [
    (Story) => (
      <div className="p-4 bg-dark-brown rounded">
        <Story />
      </div>
    ),
  ],
};

export default meta;

export const SingleResource: Story = {
  args: {
    resourceId: 1,
    amount: 100,
  },
};

export const MultipleResources: Story = {
  render: () => (
    <div className="space-y-2">
      <ResourceCost resourceId={1} amount={100} />
      <ResourceCost resourceId={2} amount={250} />
      <ResourceCost resourceId={3} amount={500} />
    </div>
  ),
};
```

**Components to implement**:

- [ ] ResourceIcon
- [ ] ResourceCost
- [ ] ArmyCapacity
- [ ] LoadingAnimation
- [ ] Tooltip
- [ ] BasePopup

### Phase 2: Feature Components (Week 2)

Focus on components that are used frequently but have some dependencies.

#### 2.1 Military Components

```typescript
// src/ui/features/military/components/army-chip.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ArmyChip } from './army-chip';
import { mockArmy } from '../../../__mocks__/army.mock';

const meta: Meta<typeof ArmyChip> = {
  title: 'Features/Military/ArmyChip',
  component: ArmyChip,
  parameters: {
    docs: {
      description: {
        component: 'Displays army information in a compact chip format',
      },
    },
  },
};

export default meta;

export const Default: Story = {
  args: {
    army: mockArmy,
  },
};

export const DifferentStates: Story = {
  render: () => (
    <div className="space-y-2">
      <ArmyChip army={{ ...mockArmy, health: 100 }} />
      <ArmyChip army={{ ...mockArmy, health: 50 }} />
      <ArmyChip army={{ ...mockArmy, health: 20 }} />
      <ArmyChip army={{ ...mockArmy, isMoving: true }} />
    </div>
  ),
};
```

#### 2.2 Economy Components

```typescript
// src/ui/features/economy/trading/market-modal.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { MarketModal } from './market-modal';
import { MockProviders } from '../../../__mocks__/providers';

const meta: Meta<typeof MarketModal> = {
  title: 'Features/Economy/MarketModal',
  component: MarketModal,
  decorators: [
    (Story) => (
      <MockProviders>
        <Story />
      </MockProviders>
    ),
  ],
};

export default meta;

export const Default: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Close modal'),
  },
};
```

### Phase 3: Complex Workflows (Week 3)

Create stories that demonstrate complete user flows.

#### 3.1 Interaction Testing

```typescript
// src/ui/features/settlement/construction-flow.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { within, userEvent, expect } from "@storybook/test";
import { ConstructionPanel } from "./components/construction-panel";

const meta: Meta<typeof ConstructionPanel> = {
  title: "Workflows/Construction",
  component: ConstructionPanel,
};

export default meta;

export const BuildingConstruction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Select a building type
    await userEvent.click(canvas.getByText("Farm"));

    // Check resource requirements
    await expect(canvas.getByText("Wood: 100")).toBeInTheDocument();

    // Click construct
    await userEvent.click(canvas.getByText("Construct"));

    // Verify confirmation
    await expect(canvas.getByText("Building in progress")).toBeInTheDocument();
  },
};
```

### Phase 4: Documentation & Testing (Week 4)

#### 4.1 Component Documentation

````typescript
// src/ui/design-system/atoms/button.mdx
import { Meta, Story, Canvas, ArgsTable } from '@storybook/addon-docs';
import Button from './button';

<Meta title="Design System/Atoms/Button/Documentation" />

# Button Component

The Button component is the primary interactive element in the Eternum UI.

## Usage

```tsx
import Button from '@/ui/design-system/atoms/button';

function MyComponent() {
  return (
    <Button variant="primary" onClick={() => console.log('clicked')}>
      Click me
    </Button>
  );
}
````

## Variants

<Canvas>
  <Story id="design-system-atoms-button--all-variants" />
</Canvas>

## Props

<ArgsTable of={Button} />

## Design Guidelines

- Use `primary` variant for main actions
- Use `danger` variant for destructive actions
- Use `outline` variant for secondary actions
- Always provide clear, action-oriented labels

````

#### 4.2 Visual Testing Setup

```typescript
// .storybook/test-runner.ts
import { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  async postRender(page, context) {
    // Visual snapshot testing
    await page.screenshot({
      path: `__screenshots__/${context.id}.png`,
      fullPage: true,
    });
  },
};

export default config;
````

### Phase 5: Team Integration (Week 5)

#### 5.1 CI/CD Integration

```yaml
# .github/workflows/storybook.yml
name: Storybook Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build-storybook
      - run: npm run test-storybook
```

#### 5.2 Team Workflows

1. **Component Development Workflow**:
   - Create component
   - Write stories
   - Test in isolation
   - Review in Storybook
   - Integrate into app

2. **Design Review Process**:
   - Deploy Storybook to Vercel/Netlify
   - Share links for design review
   - Collect feedback
   - Iterate

## 📋 Progressive Implementation Checklist

### Week 1: Foundation

- [ ] Install and configure Storybook
- [ ] Set up theme and global styles
- [ ] Create first 5 atom component stories
- [ ] Set up mock providers
- [ ] Configure addons

### Week 2: Expansion

- [ ] Add 10 molecule component stories
- [ ] Create interaction tests
- [ ] Add viewport addon for responsive testing
- [ ] Document component APIs

### Week 3: Feature Integration

- [ ] Add stories for 5 feature components
- [ ] Create workflow stories
- [ ] Set up visual regression tests
- [ ] Add accessibility checks

### Week 4: Polish

- [ ] Write MDX documentation
- [ ] Create usage guidelines
- [ ] Set up CI/CD
- [ ] Performance optimization

### Week 5: Team Adoption

- [ ] Team training session
- [ ] Create contribution guidelines
- [ ] Set up automated deployment
- [ ] Establish review process

## 🎨 Best Practices

1. **Story Organization**:

   ```
   Component.stories.tsx
   ├── Default story (minimal props)
   ├── Playground story (all controls)
   ├── State variations
   └── Edge cases
   ```

2. **Mock Data**:

   ```typescript
   // src/__mocks__/game-data.ts
   export const mockPlayer = {
     id: "1",
     name: "TestPlayer",
     resources: { gold: 1000, wood: 500 },
   };
   ```

3. **Decorators for Context**:

   ```typescript
   // .storybook/decorators/game-context.tsx
   export const withGameContext = (Story) => (
     <GameProvider initialState={mockGameState}>
       <Story />
     </GameProvider>
   );
   ```

4. **Component Categories**:
   - Design System (atoms, molecules)
   - Features (domain-specific)
   - Workflows (user journeys)
   - Pages (full layouts)

## 🚀 Quick Start Commands

```bash
# Run Storybook locally
npm run storybook

# Build static Storybook
npm run build-storybook

# Run interaction tests
npm run test-storybook

# Run visual tests
npm run test-storybook:visual

# Check accessibility
npm run test-storybook:a11y
```

## 📈 Success Metrics

1. **Development Speed**: 50% faster component development
2. **Bug Reduction**: 30% fewer UI bugs in production
3. **Design Consistency**: 100% component compliance with design system
4. **Documentation Coverage**: 100% of public components documented
5. **Team Adoption**: All developers using Storybook within 6 weeks

## 🔗 Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Component Story Format](https://storybook.js.org/docs/react/api/csf)
- [Interaction Testing](https://storybook.js.org/docs/react/writing-tests/interaction-testing)
- [Visual Testing Handbook](https://storybook.js.org/tutorials/visual-testing-handbook/)

## 🎯 Long-term Vision

1. **Component Marketplace**: Share components across Realms ecosystem
2. **Design Tokens Integration**: Sync with design tools
3. **Performance Benchmarks**: Track component performance
4. **A11y Compliance**: WCAG 2.1 AA compliance
5. **Component Analytics**: Usage tracking and deprecation
