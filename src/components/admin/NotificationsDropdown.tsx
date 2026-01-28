import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

export function NotificationsDropdown() {
    const { notifications, unreadCount } = useNotifications();
    const markAsRead = useMarkNotificationAsRead();
    const markAllAsRead = useMarkAllNotificationsAsRead();

    const handleNotificationClick = (notificationId: string, isRead: boolean) => {
        if (!isRead) {
            markAsRead.mutate(notificationId);
        }
    };

    const handleMarkAllAsRead = () => {
        markAllAsRead.mutate();
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground font-mono text-[10px] flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="font-semibold text-sm">Notificações</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-primary hover:text-primary"
                            onClick={handleMarkAllAsRead}
                        >
                            <Check className="h-3 w-3 mr-1" />
                            Marcar todas como lidas
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[400px]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4">
                            <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground text-center">
                                Sem notificações
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {notifications.map((notification) => (
                                <button
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification.id, notification.is_read)}
                                    className={cn(
                                        'w-full px-4 py-3 text-left transition-colors hover:bg-accent/50',
                                        !notification.is_read && 'bg-accent/30'
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={cn(
                                                'w-2 h-2 rounded-full shrink-0 mt-1.5',
                                                !notification.is_read ? 'bg-primary' : 'bg-transparent'
                                            )}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className={cn(
                                                'text-sm mb-1',
                                                !notification.is_read ? 'font-medium text-foreground' : 'text-foreground'
                                            )}>
                                                {notification.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                                                {notification.body}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {formatDistanceToNow(new Date(notification.created_at), {
                                                    addSuffix: true,
                                                    locale: pt,
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
