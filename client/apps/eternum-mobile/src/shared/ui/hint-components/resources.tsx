export const Resources = () => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Resources</h2>
        <p className="text-muted-foreground text-sm">The building blocks of your empire</p>
      </div>

      <div className="space-y-6">
        <div className="p-4 rounded-lg bg-muted/30">
          <h3 className="text-lg font-semibold mb-3 text-primary">Resource Types</h3>
          <p className="text-sm leading-relaxed text-foreground/90">
            Eternum features 22 different resource types, from basic materials like Wood and Stone to rare resources
            like Dragonhide and Mithral. Each resource has unique uses and production requirements.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/30">
          <h3 className="text-lg font-semibold mb-3 text-primary">Food Resources</h3>
          <p className="text-sm leading-relaxed text-foreground/90">
            Wheat and Fish are essential food resources that can be produced without inputs. They're vital for
            sustaining armies and enabling production in Simple mode.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/30">
          <h3 className="text-lg font-semibold mb-3 text-primary">Production Chains</h3>
          <p className="text-sm leading-relaxed text-foreground/90">
            Most resources require combinations of other resources to produce. Understanding production chains is
            crucial for efficient resource management and economic planning.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/30">
          <h3 className="text-lg font-semibold mb-3 text-primary">Storage & Weight</h3>
          <p className="text-sm leading-relaxed text-foreground/90">
            All resources have weight that affects storage capacity and transport requirements. Plan your resource
            stockpiles and transportation accordingly.
          </p>
        </div>
      </div>
    </div>
  );
};
