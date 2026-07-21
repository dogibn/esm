import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/ui/Logo";
import { strings } from "@/app/strings";
import { LoginForm } from "@/features/auth";

export const metadata: Metadata = { title: strings.auth.login.title };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo width={56} height={56} />
          <div className="flex flex-col">
            <span className="text-lg font-semibold">
              {strings.brand.schoolName}
            </span>
            <span className="text-sm text-muted-foreground">
              {strings.brand.portalName}
            </span>
          </div>
        </div>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{strings.auth.login.title}</CardTitle>
            <CardDescription>{strings.auth.login.subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
