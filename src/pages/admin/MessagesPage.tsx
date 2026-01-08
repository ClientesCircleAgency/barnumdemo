import { useState } from 'react';
import { Search, Send, Bot, User, Phone, Calendar, FileText, ArrowLeft, Paperclip, Smile } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread?: boolean;
  isBot?: boolean;
}

interface Message {
  id: string;
  content: string;
  time: string;
  isOutgoing: boolean;
  status?: 'sent' | 'delivered' | 'read';
}

export default function MessagesPage() {
  const [conversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');

  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const handleBack = () => {
    setSelectedConversation(null);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-background">
      {/* Lista de conversas - hidden on mobile when conversation selected */}
      <div className={cn(
        'w-full md:w-80 lg:w-72 xl:w-80 border-r border-border bg-card flex flex-col shrink-0',
        selectedConversation && 'hidden md:flex'
      )}>
        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Procurar conversa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-muted/50 border-0 text-sm"
            />
          </div>
        </div>

        {/* Conversations list */}
        <ScrollArea className="flex-1">
          <div>
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Sem conversas
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={cn(
                    'w-full px-3 py-3 flex items-center gap-3 text-left transition-colors hover:bg-accent/50 border-b border-border/50',
                    selectedConversation?.id === conversation.id && 'bg-accent border-l-4 border-l-primary'
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {getInitials(conversation.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-foreground truncate">
                        {conversation.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {conversation.time}
                        </span>
                        {conversation.unread && (
                          <div className="w-2 h-2 rounded-full bg-destructive" />
                        )}
                      </div>
                    </div>
                    <p className={cn(
                      'text-sm truncate mt-0.5',
                      conversation.unread ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {conversation.lastMessage}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Área de chat */}
      {selectedConversation ? (
        <div className={cn(
          'flex-1 flex flex-col bg-[hsl(40,25%,94%)] min-w-0',
          !selectedConversation && 'hidden md:flex'
        )}>
          {/* Chat header */}
          <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden shrink-0"
                onClick={handleBack}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {getInitials(selectedConversation.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground text-sm truncate">{selectedConversation.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Bot className="h-3 w-3 shrink-0" />
                  <span className="truncate">Bot respondeu há 5 min</span>
                </div>
              </div>
            </div>
            <Button size="sm" className="shrink-0 text-xs h-8">
              Assumir Controlo
            </Button>
          </div>

          {/* Messages area */}
          <ScrollArea className="flex-1">
            <div className="p-4 md:p-6 space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex',
                    message.isOutgoing ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm',
                      message.isOutgoing
                        ? 'bg-[hsl(145,55%,90%)] text-foreground rounded-br-md'
                        : 'bg-card text-foreground rounded-bl-md border border-border'
                    )}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                    <div className={cn(
                      'flex items-center gap-1 mt-1',
                      message.isOutgoing ? 'justify-end' : 'justify-start'
                    )}>
                      <span className="text-[10px] text-muted-foreground">{message.time}</span>
                      {message.isOutgoing && message.status === 'read' && (
                        <svg className="h-3 w-3 text-primary" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                          <path d="M6.854 10.146a.5.5 0 0 1 0 .708l-.647.646.647-.646a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708l3.5 3.5z"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Message input */}
          <div className="bg-card border-t border-border p-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  placeholder="Escreva uma mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="pr-16 bg-muted/50 border-0 h-11 rounded-full text-sm"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button size="icon" className="h-11 w-11 rounded-full shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-muted/30">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Selecione uma conversa para começar</p>
          </div>
        </div>
      )}

      {/* Sidebar de contexto */}
      {selectedConversation && (
        <div className="w-64 border-l border-border bg-card p-4 hidden xl:flex flex-col shrink-0">
          <div className="text-center mb-6">
            <Avatar className="h-16 w-16 mx-auto mb-3">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                {getInitials(selectedConversation.name)}
              </AvatarFallback>
            </Avatar>
            <h3 className="font-semibold text-foreground text-sm">{selectedConversation.name}</h3>
            <p className="text-xs text-muted-foreground">Paciente desde 2023</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Telefone</p>
                <p className="text-sm text-foreground truncate">+351 912 345 678</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Próxima Consulta</p>
                <p className="text-sm text-foreground truncate">Amanhã, 10:00</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Última Consulta</p>
                <p className="text-sm text-foreground truncate">15 Dez 2025</p>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-border">
            <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-3">Ações Rápidas</h4>
            <div className="space-y-2">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-9 text-sm">
                <Calendar className="h-4 w-4" />
                Agendar Consulta
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-9 text-sm">
                <User className="h-4 w-4" />
                Ver Ficha
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
