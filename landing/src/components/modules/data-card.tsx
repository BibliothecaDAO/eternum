import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import React from "react";
import { TypeH1 } from "../typography/type-h1";
import { TypeP } from "../typography/type-p";

interface DataCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
}

export const DataCard = ({ title, value, description, icon }: DataCardProps) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 uppercase">
          {icon && <span>{icon}</span>}
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TypeH1>{value}</TypeH1>
        {description && (
          <CardDescription>
            <TypeP>{description}</TypeP>
          </CardDescription>
        )}
      </CardContent>
    </Card>
  );
};
