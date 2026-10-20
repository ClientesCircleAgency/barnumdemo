import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Mail, Search } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useContactMessages, useMarkContactMessageAsRead, type ContactMessage } from '@/hooks/useContactMessages';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function MessagesPage() {
  const { data: messages = [], isLoading, isError, refetch } = useContactMessages();
  const markRead = useMarkContactMessageAsRead();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'read'>('all');
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const unread = messages.filter(message => !message.is_read).length;
  const visible = messages.filter(message =>
    (filter === 'all' || (filter === 'read' ? message.is_read : !message.is_read)) &&
    [message.name, message.email, message.phone, message.message].some(value => value?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
  );
  const openMessage = async (message: ContactMessage) => {
    setSelected(message);
    if (!message.is_read) {
      try { await markRead.mutateAsync(message.id); }
      catch { toast.error('Não foi possível marcar a mensagem como lida.'); }
    }
  };

  return <div className="space-y-5">
    <PageHeader title="Mensagens" subtitle={`${unread} por ler · ${messages.length} mensagens recebidas`} />
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Pesquisar mensagens" value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar nome, contacto ou mensagem..." className="h-11 rounded-2xl pl-10" />
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Filtrar mensagens">
        {([{ key: 'all', label: 'Todas' }, { key: 'new', label: 'Por ler' }, { key: 'read', label: 'Lidas' }] as const).map(item =>
          <Button key={item.key} type="button" variant={filter === item.key ? 'default' : 'outline'} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}</Button>,
        )}
      </div>
    </div>
    {isLoading ? <p role="status">A carregar mensagens...</p> : isError ? (
      <div role="alert" className="rounded-2xl border p-6"><p>Não foi possível carregar as mensagens.</p><Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button></div>
    ) : visible.length === 0 ? <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">Nenhuma mensagem encontrada.</p> : (
      <div className="grid gap-3">
        {visible.map(message => <button key={message.id} type="button" onClick={() => openMessage(message)}
          className={cn('w-full rounded-2xl border bg-card p-4 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', !message.is_read && 'border-l-4 border-l-blue-500 bg-blue-50/50')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0" /><span className="break-words font-semibold">{message.name}</span>{!message.is_read && <Badge className="bg-blue-100 text-blue-900">Nova</Badge>}</div>
            <span className="text-xs text-muted-foreground">{format(parseISO(message.created_at), 'd MMM yyyy HH:mm', { locale: pt })}</span>
          </div>
          <p className="mt-2 line-clamp-2 break-words text-sm text-muted-foreground">{message.message}</p>
        </button>)}
      </div>
    )}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>Mensagem de contacto</DialogTitle><DialogDescription>Recebida através do formulário do site.</DialogDescription></DialogHeader>
        {selected && <>
          <p className="break-words font-semibold">{selected.name}</p>
          <div className="flex flex-col gap-2 text-sm">
            <a className="break-all text-primary underline" href={`mailto:${selected.email}`}>{selected.email}</a>
            <a className="text-primary underline" href={`tel:${selected.phone}`}>{selected.phone}</a>
          </div>
          <p className="whitespace-pre-wrap break-words rounded-xl bg-secondary/50 p-4">{selected.message}</p>
          <DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button><Button asChild><a href={`mailto:${selected.email}`}><Mail className="h-4 w-4" />Responder por email</a></Button></DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
