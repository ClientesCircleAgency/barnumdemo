import { format, addDays, subDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { useClinic } from '@/context/ClinicContext';
import type { AppointmentStatus } from '@/types/clinic';

export type CalendarView = 'day' | 'week' | 'month';

interface CalendarToolbarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedProfessional: string;
  onProfessionalChange: (id: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
}

export function CalendarToolbar({
  currentDate,
  onDateChange,
  view,
  onViewChange,
  searchQuery,
  onSearchChange,
  selectedProfessional,
  onProfessionalChange,
  selectedStatus,
  onStatusChange,
}: CalendarToolbarProps) {
  const { professionals } = useClinic();

  const handlePrevious = () => {
    if (view === 'day') {
      onDateChange(subDays(currentDate, 1));
    } else if (view === 'week') {
      onDateChange(subDays(currentDate, 7));
    } else {
      onDateChange(subDays(currentDate, 30));
    }
  };

  const handleNext = () => {
    if (view === 'day') {
      onDateChange(addDays(currentDate, 1));
    } else if (view === 'week') {
      onDateChange(addDays(currentDate, 7));
    } else {
      onDateChange(addDays(currentDate, 30));
    }
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const getDateLabel = () => {
    if (view === 'day') {
      return format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt });
    } else if (view === 'week') {
      const weekEnd = addDays(currentDate, 6);
      if (currentDate.getMonth() === weekEnd.getMonth()) {
        return `${format(currentDate, 'd', { locale: pt })} - ${format(weekEnd, "d 'de' MMMM", { locale: pt })}`;
      }
      return `${format(currentDate, "d 'de' MMM", { locale: pt })} - ${format(weekEnd, "d 'de' MMM", { locale: pt })}`;
    } else {
      return format(currentDate, "MMMM 'de' yyyy", { locale: pt });
    }
  };

  const statusOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'Todos os estados' },
    { value: 'scheduled', label: 'Marcadas' },
    { value: 'confirmed', label: 'Confirmadas' },
    { value: 'waiting', label: 'Em espera' },
    { value: 'in_progress', label: 'Em atendimento' },
    { value: 'completed', label: 'Concluídas' },
    { value: 'cancelled', label: 'Canceladas' },
    { value: 'no_show', label: 'Não compareceu' },
  ];

  return (
    <div className="space-y-4">
      {/* Linha 1: Navegação e Views */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleToday}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 font-semibold text-lg hidden md:inline capitalize">
            {getDateLabel()}
          </span>
        </div>

        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && onViewChange(v as CalendarView)}
          className="border rounded-lg"
        >
          <ToggleGroupItem value="day" aria-label="Vista de dia" className="px-4">
            Dia
          </ToggleGroupItem>
          <ToggleGroupItem value="week" aria-label="Vista de semana" className="px-4">
            Semana
          </ToggleGroupItem>
          <ToggleGroupItem value="month" aria-label="Vista de mês" className="px-4">
            Mês
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Data label mobile */}
      <div className="md:hidden">
        <p className="font-semibold text-lg capitalize">{getDateLabel()}</p>
      </div>

      {/* Linha 2: Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Pesquisa */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nome, telefone ou NIF..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Profissional */}
        <Select value={selectedProfessional} onValueChange={onProfessionalChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Profissional" />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            <SelectItem value="all">Todos os profissionais</SelectItem>
            {professionals.map((prof) => (
              <SelectItem key={prof.id} value={prof.id}>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: prof.color }} />
                  {prof.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Estado */}
        <Select value={selectedStatus} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
