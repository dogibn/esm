import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { strings } from "@/app/strings";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-4 text-center">
      <h1 className="text-xl font-semibold">{strings.errors.notFoundTitle}</h1>
      <p className="text-sm text-muted-foreground">
        {strings.errors.notFoundDescription}
      </p>
      <Link href="/students" className={buttonVariants({ variant: "default" })}>
        {strings.errors.backHome}
      </Link>
    </div>
  );
}
