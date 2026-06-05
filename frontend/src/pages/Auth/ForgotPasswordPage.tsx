import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Plane, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authService } from '../../services/auth.service';

const schema = z.object({ email: z.string().email('Email invalide') });
type FormData = z.infer<typeof schema>;

export const ForgotPasswordPage = () => {
  const [sent, setSent] = useState(false);
  const [apiError, setApiError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setApiError('');
      await authService.forgotPassword(data.email);
      setSent(true);
    } catch {
      setApiError('Une erreur est survenue. Réessayez.');
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
          <p className="text-primary-200 mt-1">Récupération de compte</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-50 rounded-full">
                <MailCheck size={28} className="text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Vérifiez vos emails</h2>
              <p className="text-sm text-gray-500">
                Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé.
                Le lien expire dans 15 minutes.
              </p>
              <Link to="/login" className="inline-block text-primary-600 font-medium hover:underline text-sm">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Mot de passe oublié</h2>
              <p className="text-sm text-gray-500 mb-6">
                Entrez votre email, nous vous enverrons un lien de réinitialisation.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input label="Email" type="email" placeholder="vous@example.com" {...register('email')} error={errors.email?.message} />

                {apiError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{apiError}</p>}

                <Button type="submit" loading={isSubmitting} className="w-full justify-center py-3">
                  Envoyer le lien
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
