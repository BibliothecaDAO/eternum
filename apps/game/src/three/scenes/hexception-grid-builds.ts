/** The steps of one realm grid build: its cells are laid out once the models load, the page is prepared off-thread. */
export interface GridBuildSteps<Layout, Page> {
  modelsLoaded: () => Promise<unknown>;
  layOut: () => Layout;
  preparePage: (layout: Layout) => Promise<Page>;
  present: (page: Page) => void;
  release: (layout: Layout) => void;
}

/**
 * A realm's grid builds, of which only the latest started may present. A level change or a tile update starts a new
 * build while an earlier one still waits on its page; that earlier page describes cells the new build has already
 * replaced, so it is dropped, as is every build of a realm that was left.
 */
export class RealmGridBuilds {
  private latest = 0;
  private built: Promise<void> = Promise.resolve();

  start<Layout, Page>(steps: GridBuildSteps<Layout, Page>): void {
    this.latest += 1;
    const build = this.latest;
    this.built = runGridBuild(steps, () => build === this.latest);
  }

  /** Drops every build still waiting: the realm is left. */
  supersede(): void {
    this.latest += 1;
  }

  /** Settles once the latest build has, however many were started while it waited. */
  async whenBuilt(): Promise<void> {
    let built: Promise<void>;
    do {
      built = this.built;
      await built;
    } while (built !== this.built);
  }
}

async function runGridBuild<Layout, Page>(steps: GridBuildSteps<Layout, Page>, isLatest: () => boolean) {
  await steps.modelsLoaded();
  if (!isLatest()) return;
  const layout = steps.layOut();
  try {
    const page = await steps.preparePage(layout);
    if (isLatest()) steps.present(page);
  } finally {
    steps.release(layout);
  }
}
