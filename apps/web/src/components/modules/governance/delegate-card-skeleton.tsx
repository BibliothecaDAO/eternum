import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DelegateCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-7 w-40" />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {/* Votes count skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-28" />
        </div>

        {/* Interest badges skeleton */}
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-14" />
        </div>

        {/* Statement skeleton */}
        <div className="mt-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>

        {/* Social media icons skeleton */}
        <div className="mt-2 flex items-center gap-4">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-5" />
        </div>
      </CardContent>
      <CardFooter>
        <Skeleton className="h-10 w-36" />
      </CardFooter>
    </Card>
  );
}
