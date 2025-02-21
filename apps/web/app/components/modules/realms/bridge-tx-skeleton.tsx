import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";
import { ArrowRight } from "lucide-react";

const BridgeTransactionHistorySkeleton: React.FC = () => {
  return (
    <Accordion type="single" collapsible>
      {[...Array(3)].map((_, index) => (
        <AccordionItem key={index} value={`skeleton-${index}`}>
          <AccordionTrigger className="flex w-full items-center justify-between hover:no-underline">
            <div className="flex w-full justify-between px-2">
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-300" />
                </div>
                <span className="text-muted-foreground text-sm">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-300" />
                </span>
              </div>
              <div className="flex flex-col items-end justify-end">
                <div className="flex gap-1">
                  {[...Array(3)].map((_, idx) => (
                    <Badge
                      variant="outline"
                      className="h-4 w-8 animate-pulse bg-gray-300"
                      key={idx}
                    />
                  ))}
                  <Badge
                    key="more"
                    className="h-4 w-8 animate-pulse bg-gray-300"
                  />
                </div>
                <span className="text-muted-foreground">
                  <div className="h-4 w-20 animate-pulse rounded bg-gray-300" />
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col space-y-1 py-2">
              <span className={cn("text-yellow-500")}>
                <div className="h-4 w-20 animate-pulse rounded bg-gray-300" />
              </span>
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-300" />
                <ArrowRight />
                <div className="h-4 w-24 animate-pulse rounded bg-gray-300" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                {[...Array(2)].map((_, idx) => (
                  <Button
                    variant="outline"
                    className="h-8 w-24 animate-pulse bg-gray-300"
                    key={idx}
                  />
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export default BridgeTransactionHistorySkeleton;
