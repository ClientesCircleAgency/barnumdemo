import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo-barnum-new.png';
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
  const {
    register,
    handleSubmit,
    formState: {
      errors
    }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

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

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="admin@barnum.pt" {...register('email')} className={errors.email ? 'border-destructive' : ''} disabled={isSubmitting} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
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

        {/* Back link */}
        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            ← Voltar ao site
          </a>
        </div>
      </div>
    </div>
  </div>;
}