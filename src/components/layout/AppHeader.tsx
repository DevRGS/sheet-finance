import { ReactNode } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ThemeToggleIcon } from '@/components/ThemeToggle';

interface AppHeaderProps {
  title: string;
  onNewTransaction?: () => void;
  extra?: ReactNode;
}

export function AppHeader({ title, onNewTransaction, extra }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-1">
        {extra}
        <ThemeToggleIcon />
        {onNewTransaction && (
          <Button onClick={onNewTransaction} className="gap-2 ml-1">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Transação</span>
          </Button>
        )}
      </div>
    </header>
  );
}
