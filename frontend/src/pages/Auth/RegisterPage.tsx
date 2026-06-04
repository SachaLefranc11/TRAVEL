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
  name: z.string().min(2, 'Minimum 2 caractères'),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
});
type FormData = z.infer<typeof schema>;

export const RegisterPage = () => {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setApiError('');
      await registerUser(data.name, data.email, data.password);
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
          <p className="text-primary-200 mt-1">Commencez à explorer</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Créer un compte</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Nom complet" placeholder="Jean Dupont" {...register('name')} error={errors.name?.message} />
            <Input label="Email" type="email" placeholder="vous@example.com" {...register('email')} error={errors.email?.message} />
            <Input label="Mot de passe" type="password" placeholder="Minimum 8 caractères" {...register('password')} error={errors.password?.message} />

            {apiError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{apiError}</p>}

            <Button type="submit" loading={isSubmitting} className="w-full justify-center py-3">
              Créer mon compte
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
