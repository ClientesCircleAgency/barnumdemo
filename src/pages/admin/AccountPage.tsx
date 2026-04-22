import { useState, useEffect, useRef } from 'react';
import { User as UserIcon, Mail, Lock, Palette, Save, Loader2, Eye, EyeOff, Camera, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/admin/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const PROFILE_PHOTOS_BUCKET = 'profile-photos';
const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function AccountPage() {
  const { user, userRole } = useAuth();

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Loading states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Load current data
  useEffect(() => {
    if (!user) return;
    setEmail(user.email || '');

    // Load profile name
    supabase
      .from('user_profiles')
      .select('full_name, color, photo_url')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.full_name) setFullName(data.full_name);
        if (data?.color) setColor(data.color);
        if (data?.photo_url) setPhotoUrl(data.photo_url);
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
      const { error } = await supabase
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

  const removeStoredProfilePhotos = async () => {
    if (!user) return;

    const { data: files, error: listError } = await supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .list(user.id);

    if (listError) throw listError;
    if (!files?.length) return;

    const paths = files.map((file) => `${user.id}/${file.name}`);
    const { error: removeError } = await supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .remove(paths);

    if (removeError) throw removeError;
  };

  const handlePhotoUpload = async (file: File | null) => {
    if (!user || !file) return;

    if (!ALLOWED_PROFILE_PHOTO_TYPES.includes(file.type)) {
      toast.error('Use uma imagem JPG, PNG, WebP ou GIF.');
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_SIZE) {
      toast.error('A imagem deve ter no maximo 5 MB.');
      return;
    }

    setSavingPhoto(true);
    try {
      await removeStoredProfilePhotos();

      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/profile.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(PROFILE_PHOTOS_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from(PROFILE_PHOTOS_BUCKET)
        .getPublicUrl(path);

      const nextPhotoUrl = `${data.publicUrl}?v=${Date.now()}`;

      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          full_name: fullName.trim() || user.email || 'Utilizador',
          color,
          photo_url: nextPhotoUrl,
        }, { onConflict: 'user_id' });

      if (profileError) throw profileError;

      if (professionalId) {
        const { error: professionalError } = await supabase
          .from('professionals')
          .update({ avatar_url: nextPhotoUrl })
          .eq('id', professionalId);

        if (professionalError) throw professionalError;
      }

      setPhotoUrl(nextPhotoUrl);
      toast.success('Foto atualizada');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar foto');
    } finally {
      setSavingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!user) return;

    setSavingPhoto(true);
    try {
      await removeStoredProfilePhotos();

      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          full_name: fullName.trim() || user.email || 'Utilizador',
          color,
          photo_url: null,
        }, { onConflict: 'user_id' });

      if (profileError) throw profileError;

      if (professionalId) {
        const { error: professionalError } = await supabase
          .from('professionals')
          .update({ avatar_url: null })
          .eq('id', professionalId);

        if (professionalError) throw professionalError;
      }

      setPhotoUrl(null);
      toast.success('Foto removida');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao remover foto');
    } finally {
      setSavingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
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
      const { error: professionalError } = await supabase
        .from('professionals')
        .update({ color })
        .eq('id', professionalId);

      if (professionalError) throw professionalError;

      if (user?.id) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert({ user_id: user.id, color }, { onConflict: 'user_id' });

        if (profileError) throw profileError;
      }

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

  const initials = (fullName || user?.email || 'U')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
            <Avatar className="h-10 w-10 border border-border">
              {photoUrl && <AvatarImage src={photoUrl} alt={fullName || user?.email || 'Perfil'} />}
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {initials || <UserIcon className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground">{roleLabelMap[userRole || ''] || 'Sem role'}</p>
            </div>
          </div>
        </div>

        {/* Profile photo */}
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 border border-border">
              {photoUrl && <AvatarImage src={photoUrl} alt={fullName || user?.email || 'Perfil'} />}
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {initials || <Camera className="h-6 w-6" />}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Foto de perfil</h3>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Usada para identificar medicos e secretarias no sistema.
                </p>
              </div>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event) => handlePhotoUpload(event.target.files?.[0] || null)}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={savingPhoto}
                >
                  {savingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Carregar foto
                </Button>

                {photoUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleRemovePhoto}
                    disabled={savingPhoto}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                )}
              </div>
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
