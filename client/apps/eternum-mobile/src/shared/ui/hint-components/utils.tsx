import { Button } from "@/shared/ui/button";

export const tableOfContents = (chapterTitles: string[]) => (
  <div className="space-y-2">
    {chapterTitles.map((title) => (
      <Button key={title} variant="ghost" size="sm" asChild className="w-full justify-start h-auto py-2 px-3">
        <a href={`#${title}`} className="flex items-center space-x-3 text-left">
          <span className="text-xs opacity-70">→</span>
          <span className="text-sm font-medium">{title}</span>
        </a>
      </Button>
    ))}
  </div>
);
