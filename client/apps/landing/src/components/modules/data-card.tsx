import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import React from "react";
import { TypeH1 } from "../typography/type-h1";
import { TypeP } from "../typography/type-p";

export interface DataCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  backgroundImage?: string;
}

const DataCard = ({ title, value, description, icon, backgroundImage }: DataCardProps) => {
  return (
    <Card className="w-full relative overflow-hidden h-full">
      {backgroundImage && (
        <div
          className="absolute inset-0 z-0 opacity-10"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <div className="relative z-10 h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 uppercase ">
            {icon && <span>{icon}</span>}
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="mt-auto">
          <TypeH1 className="font-number">{value}</TypeH1>
          {description && (
            <CardDescription>
              <TypeP>{description}</TypeP>
            </CardDescription>
          )}
        </CardContent>
      </div>
    </Card>
  );
};
