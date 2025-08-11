import cytoscape from "cytoscape";
import React, { useEffect, useRef } from "react";

// Minimal example to get started
export const EmpireGraphMinimal: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Sample data matching your mockup
    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        // Nodes
        { data: { id: "realm1", label: "Realm 1" }, position: { x: 100, y: 200 } },
        { data: { id: "realm2", label: "Realm 2" }, position: { x: 300, y: 300 } },
        { data: { id: "realm3", label: "Realm 3" }, position: { x: 300, y: 100 } },
        { data: { id: "structure1", label: "Structure" }, position: { x: 500, y: 200 } },

        // Edges (trades/automation)
        { data: { source: "realm1", target: "structure1" } },
        { data: { source: "realm2", target: "structure1" } },
        { data: { source: "realm3", target: "structure1" } },
        { data: { source: "realm1", target: "realm2" } },
      ],

      style: [
        {
          selector: "node",
          style: {
            "background-color": "#dfaa54",
            label: "data(label)",
            width: 60,
            height: 60,
            "text-valign": "center",
            "text-halign": "center",
            "font-size": "12px",
            color: "#14100D",
            "border-width": 2,
            "border-color": "#14100D",
          },
        },
        {
          selector: 'node[id="structure1"]',
          style: {
            shape: "rectangle",
            "background-color": "#582C4D",
            color: "#dfaa54",
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#776756",
            "target-arrow-color": "#776756",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
          },
        },
      ],

      layout: {
        name: "preset", // Use preset positions
      },
    });

    // Enable interactivity
    cy.on("tap", "node", function (evt) {
      const node = evt.target;
      console.log("Clicked on " + node.id());

      // Highlight selected node
      cy.nodes().style("border-color", "#14100D");
      node.style("border-color", "#FFA200");
      node.style("border-width", 4);
    });

    // Cleanup
    return () => {
      cy.destroy();
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-4 left-4 bg-brown/90 px-3 py-2 rounded text-gold text-sm">Empire Management</div>
      <div ref={containerRef} className="w-full h-full bg-brown/20" />
      <div className="absolute bottom-4 left-4 bg-brown/90 px-3 py-2 rounded text-gold text-sm">thing happening</div>
    </div>
  );
};
