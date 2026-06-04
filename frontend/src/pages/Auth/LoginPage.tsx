import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Plane } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useState } from 'react';

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});
type FormData = z.infer<typeof schema>;

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setApiError('');
      await login(data.email, data.password);
      navigate('/');
    } catch (err: any) {
      setApiError(err.response?.data?.error || 'Une erreur est survenue');
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
          <p className="text-primary-200 mt-1">Organisez vos aventures</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Connexion</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Email" type="email" placeholder="vous@example.com" {...register('email')} error={errors.email?.message} />
            <Input label="Mot de passe" type="password" placeholder="••••••••" {...register('password')} error={errors.password?.message} />

            {apiError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{apiError}</p>}

            <Button type="submit" loading={isSubmitting} className="w-full justify-center py-3">
              Se connecter
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">S'inscrire</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
