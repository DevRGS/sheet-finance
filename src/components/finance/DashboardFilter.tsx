import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFinanceContext } from '@/contexts/FinanceContext';
import { getPresetPeriod, DashboardPreset, DashboardPeriod } from '@/hooks/useFinance';

const PRESETS: { value: Exclude<DashboardPreset, 'custom'>; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Esta Semana' },
  { value: 'month', label: 'Este Mês' },
  { value: 'year', label: 'Esse Ano' },
];

export function DashboardFilter() {
  const { dashboardPeriod, setDashboardPeriod } = useFinanceContext();

  const [customStart, setCustomStart] = useState(dashboardPeriod.start);
  const [customEnd, setCustomEnd] = useState(dashboardPeriod.end);

  const handlePreset = (preset: Exclude<DashboardPreset, 'custom'>) => {
    setDashboardPeriod(getPresetPeriod(preset));
  };

  const handleCustomActivate = () => {
    const period: DashboardPeriod = { preset: 'custom', start: customStart, end: customEnd };
    setDashboardPeriod(period);
  };

  const handleCustomStart = (value: string) => {
    setCustomStart(value);
    if (dashboardPeriod.preset === 'custom') {
      setDashboardPeriod({ preset: 'custom', start: value, end: customEnd });
    }
  };

  const handleCustomEnd = (value: string) => {
    setCustomEnd(value);
    if (dashboardPeriod.preset === 'custom') {
      setDashboardPeriod({ preset: 'custom', start: customStart, end: value });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />

      {PRESETS.map((p) => (
        <Button
          key={p.value}
          variant={dashboardPeriod.preset === p.value ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs sm:text-sm"
          onClick={() => handlePreset(p.value)}
        >
          {p.label}
        </Button>
      ))}

      <Button
        variant={dashboardPeriod.preset === 'custom' ? 'default' : 'outline'}
        size="sm"
        className="h-8 text-xs sm:text-sm"
        onClick={handleCustomActivate}
      >
        Personalizado
      </Button>

      {dashboardPeriod.preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={customStart}
            onChange={(e) => handleCustomStart(e.target.value)}
            className="h-8 text-xs w-36"
          />
          <span className="text-muted-foreground text-xs">até</span>
          <Input
            type="date"
            value={customEnd}
            onChange={(e) => handleCustomEnd(e.target.value)}
            className="h-8 text-xs w-36"
          />
        </div>
      )}
    </div>
  );
}
