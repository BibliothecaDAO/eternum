import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { useQuery } from "../../../../packages/react/src/hooks/helpers/use-query";

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("urlChanged"));
}

it("keeps the world inspector selected through scene navigation and later UI ticks", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  function Inspector({ tick }: { tick: number }) {
    const query = useQuery();
    return (
      <div data-tick={tick}>
        {query.isMapView ? "world" : "local"}:{query.hexPosition.col},{query.hexPosition.row}
      </div>
    );
  }
  try {
    navigate("/play/madara/blitz-daily-0001/map?col=2&row=9");
    await act(async () => root.render(<Inspector tick={0} />));
    expect(container.textContent).toBe("world:2,9");
    await act(async () => navigate("/play/madara/blitz-daily-0001/hex?col=2&row=9"));
    expect(container.textContent).toBe("local:2,9");
    await act(async () => navigate("/play/madara/blitz-daily-0001/map?col=12&row=0"));
    expect(container.textContent).toBe("world:12,0");
    await act(async () => root.render(<Inspector tick={1} />));
    expect(container.textContent).toBe("world:12,0");
  } finally {
    await act(async () => root.unmount());
    navigate("/");
  }
});
