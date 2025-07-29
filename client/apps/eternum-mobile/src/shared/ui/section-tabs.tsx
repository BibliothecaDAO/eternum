import { ScrollArea, ScrollBar } from "@/shared/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";

interface SectionTabsProps {
  sections: Array<{ id: string; name: string }>;
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
}

export const SectionTabs = ({ sections, activeSection, onSectionChange }: SectionTabsProps) => {
  return (
    <Tabs value={activeSection} onValueChange={onSectionChange} className="w-full">
      <ScrollArea className="w-full">
        <TabsList className="inline-flex h-12 items-center justify-start rounded-none border-b bg-transparent p-0 w-max min-w-full">
          {sections.map((section) => (
            <TabsTrigger
              key={section.id}
              value={section.id}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-none border-b-2 border-b-transparent bg-transparent px-4 py-3 text-sm font-medium ring-offset-background transition-all hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {section.name}
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Tabs>
  );
};
