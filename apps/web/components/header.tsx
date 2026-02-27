import { UserButton } from "@clerk/nextjs";

interface HeaderProps {
  workspaceName: string;
  /** Optional slot rendered between workspace name and UserButton. */
  children?: React.ReactNode;
}

export function Header({ workspaceName, children }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <span className="text-sm font-medium text-muted-foreground">{workspaceName}</span>
      <div className="flex items-center gap-3">
        {children}
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
