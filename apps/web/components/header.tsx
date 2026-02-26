import { UserButton } from "@clerk/nextjs";

interface HeaderProps {
  workspaceName: string;
}

export function Header({ workspaceName }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <span className="text-sm font-medium text-muted-foreground">{workspaceName}</span>
      <UserButton afterSignOutUrl="/sign-in" />
    </header>
  );
}
