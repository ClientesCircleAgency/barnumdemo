import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo-dashboard-v2.png';
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Password deve ter pelo menos 6 caracteres')
});
type LoginFormData = z.infer<typeof loginSchema>;
export default function AdminLogin() {
  const navigate = useNavigate();
  const {
    login,
    isAuthenticated,
    isLoading
  } = useAuth();
  const {
    toast
  } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: {
      errors
    }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
      toast({ title: 'Email inválido', description: 'Insira um email válido.', variant: 'destructive' });
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/admin/login`,
    });
    setResetLoading(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setResetSent(true);
    }
  };

  // Redirect if already authenticated (using useEffect to avoid render-loop)
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/admin', {
        replace: true
      });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Show loading while checking auth state
  if (isLoading) {
    return <div className="min-h-screen bg-secondary/30 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>;
  }

  // Don't render form if authenticated (will redirect)
  if (isAuthenticated) {
    return null;
  }
  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    const result = await login(data.email, data.password);
    if (result.success) {
      toast({
        title: 'Login efetuado',
        description: 'Bem-vindo à área de administração.'
      });
      navigate('/admin');
    } else {
      toast({
        title: 'Erro de autenticação',
        description: result.error || 'Email ou password incorretos.',
        variant: 'destructive'
      });
    }
    setIsSubmitting(false);
  };
  return <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      <div className="bg-background rounded-2xl p-8 shadow-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative inline-block mx-auto mb-4">
            <img alt="Barnun" src={logo} className="h-16 w-auto opacity-0" />
            <div
              className="absolute inset-0 bg-primary-gradient"
              style={{
                maskImage: `url(${logo})`,
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskImage: `url(${logo})`,
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center'
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Área de Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Faça login para aceder ao painel de gestão
          </p>
        </div>

        {forgotMode ? (
          /* Forgot Password Form */
          resetSent ? (
            <div className="text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground">Email enviado</h2>
              <p className="text-sm text-muted-foreground">
                Se o email <strong>{resetEmail}</strong> estiver registado, receberá um link para redefinir a palavra-passe.
              </p>
              <Button variant="outline" onClick={() => { setForgotMode(false); setResetSent(false); setResetEmail(''); }} className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email da conta</Label>
                <Input 
                  id="reset-email" 
                  type="email" 
                  placeholder="email@exemplo.pt" 
                  value={resetEmail} 
                  onChange={(e) => setResetEmail(e.target.value)} 
                  disabled={resetLoading} 
                />
              </div>
              <Button type="submit" disabled={resetLoading} className="w-full bg-primary hover:bg-primary/90" size="lg">
                {resetLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />A enviar...</>
                ) : (
                  'Enviar link de recuperação'
                )}
              </Button>
              <button type="button" onClick={() => setForgotMode(false)} className="w-full text-sm text-muted-foreground hover:text-primary transition-colors">
                <ArrowLeft className="w-3 h-3 inline mr-1" />
                Voltar ao login
              </button>
            </form>
          )
        ) : (
          /* Login Form */
          <>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="admin@barnum.pt" {...register('email')} className={errors.email ? 'border-destructive' : ''} disabled={isSubmitting} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button type="button" onClick={() => setForgotMode(true)} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    Esqueci a password
                  </button>
                </div>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...register('password')} className={errors.password ? 'border-destructive pr-10' : 'pr-10'} disabled={isSubmitting} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" disabled={isSubmitting}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90" size="lg">
                {isSubmitting ? <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A entrar...
                </> : <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Entrar
                </>}
              </Button>
            </form>
          </>
        )}

        {/* Back link */}
        {!forgotMode && (
          <div className="mt-6 text-center">
            <a href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              ← Voltar ao site
            </a>
          </div>
        )}
      </div>
    </div>
  </div>;
}