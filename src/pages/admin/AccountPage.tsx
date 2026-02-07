import { useState, useEffect } from 'react';
import { User as UserIcon, Mail, Lock, Palette, Save, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/admin/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function AccountPage() {
  const { user, userRole } = useAuth();

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Loading states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingColor, setSavingColor] = useState(false);

  // Load current data
  useEffect(() => {
    if (!user) return;
    setEmail(user.email || '');

    // Load profile name (table not in generated types yet)
    (supabase as any)
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.full_name) setFullName(data.full_name);
      });

    // Load professional color (for doctors)
    supabase
      .from('professionals')
      .select('id, color')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfessionalId(data.id);
          setColor(data.color || '#6366f1');
        }
      });
  }, [user]);

  const handleSaveName = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      // Upsert user_profiles (table not in generated types yet)
      const { error } = await (supabase as any)
        .from('user_profiles')
        .upsert({ user_id: user.id, full_name: fullName.trim() }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Nome atualizado');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao guardar nome');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Email inválido');
      return;
    }
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast.success('Email de confirmação enviado para o novo endereço');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar email');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('A password deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As passwords não coincidem');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password atualizada com sucesso');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveColor = async () => {
    if (!professionalId) return;
    setSavingColor(true);
    try {
      const { error } = await supabase
        .from('professionals')
        .update({ color })
        .eq('id', professionalId);

      if (error) throw error;
      toast.success('Cor atualizada');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar cor');
    } finally {
      setSavingColor(false);
    }
  };

  const roleLabelMap: Record<string, string> = {
    admin: 'Administrador',
    secretary: 'Secretária',
    doctor: 'Médico',
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Minha Conta"
        subtitle="Gerir dados pessoais e segurança"
      />

      <div className="max-w-xl space-y-4">
        {/* Role badge */}
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <UserIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground">{roleLabelMap[userRole || ''] || 'Sem role'}</p>
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5">
          <div className="flex items-center gap-2 mb-3">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Nome</h3>
          </div>
          <div className="flex gap-2">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="O seu nome completo"
              className="flex-1"
            />
            <Button size="sm" onClick={handleSaveName} disabled={savingProfile || !fullName.trim()}>
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Email */}
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Email</h3>
          </div>
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.pt"
              className="flex-1"
            />
            <Button size="sm" onClick={handleSaveEmail} disabled={savingEmail || email === user?.email}>
              {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Será enviado um email de confirmação para o novo endereço.
          </p>
        </div>

        {/* Password */}
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Alterar Password</h3>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nova password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar nova password"
            />
            <Button
              size="sm"
              onClick={handleSavePassword}
              disabled={savingPassword || !newPassword || newPassword !== confirmPassword}
              className="w-full"
            >
              {savingPassword ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />A guardar...</>
              ) : (
                'Atualizar password'
              )}
            </Button>
          </div>
        </div>

        {/* Color — only if user has a linked professional (doctors) */}
        {professionalId && (
          <div className="bg-card border border-border rounded-xl p-4 lg:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Cor na Agenda</h3>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <div
                className="h-9 flex-1 rounded-lg border border-border"
                style={{ backgroundColor: color }}
              />
              <Button size="sm" onClick={handleSaveColor} disabled={savingColor}>
                {savingColor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Esta cor é usada para identificar as suas consultas na agenda.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
