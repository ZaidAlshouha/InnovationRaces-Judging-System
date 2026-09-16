import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "حدث خطأ أثناء تحميل البيانات",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>{title}</AlertTitle>
      {(description || onRetry) && (
        <AlertDescription className="flex flex-col gap-3">
          {description && <span>{description}</span>}
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} className="w-fit">
              إعادة المحاولة
            </Button>
          )}
        </AlertDescription>
      )}
    </Alert>
  );
}
