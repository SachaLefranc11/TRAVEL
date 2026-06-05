import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plane, CheckCircle2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authService } from '../../services/auth.service';

const schema = z.object({
  password: z.string().min(8, 'Minimum 8 caractères'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirm'],
});
type FormData = z.infer<typeof schema>;

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [apiError, setApiError] = useState('');
  const redirectTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => { if (redirectTimer.current) clearTimeout(redirectTimer.current); }, []);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setApiError('');
      await authService.resetPassword(token, data.password);
      setDone(true);
      redirectTimer.current = setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      setApiError(err.response?.data?.error || 'Lien invalide ou expiré. Refaites une demande.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700 to-accent-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <Plane size={32} className="text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">Travel</h1>
          <p className="text-primary-200 mt-1">Nouveau mot de passe</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-50 rounded-full">
                <CheckCircle2 size={28} className="text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Mot de passe réinitialisé</h2>
              <p className="text-sm text-gray-500">Redirection vers la connexion…</p>
            </div>
          ) : !token ? (
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Lien invalide</h2>
              <p className="text-sm text-gray-500">Ce lien de réinitialisation est incomplet ou a expiré.</p>
              <Link to="/forgot-password" className="inline-block text-primary-600 font-medium hover:underline text-sm">
                Refaire une demande
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Choisissez un nouveau mot de passe</h2>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input label="Nouveau mot de passe" type="password" placeholder="Minimum 8 caractères" {...register('password')} error={errors.password?.message} />
                <Input label="Confirmer le mot de passe" type="password" placeholder="••••••••" {...register('confirm')} error={errors.confirm?.message} />

                {apiError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{apiError}</p>}

                <Button type="submit" loading={isSubmitting} className="w-full justify-center py-3">
                  Réinitialiser
                </Button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                <Link to="/login" className="text-primary-600 font-medium hover:underline">Retour à la connexion</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
