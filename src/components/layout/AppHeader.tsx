import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Plus, Bell } from 'lucide-react';

interface AppHeaderProps {
  title: string;
  onNewTransaction?: () => void;
}

export function AppHeader({ title, onNewTransaction }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
        </Button>

        {onNewTransaction && (
          <Button onClick={onNewTransaction} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Transação</span>
          </Button>
        )}
      </div>
    </header>
  );
}
