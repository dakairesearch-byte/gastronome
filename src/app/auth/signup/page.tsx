'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Sign up user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Create profile
        const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            username,
            display_name: username,
          });

        if (profileError) {
          setError('Failed to create profile: ' + profileError.message);
          setLoading(false);
          return;
        }

        // Redirect to home
        router.push('/');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-widest text-amber-500 mb-2">GASTRONOME</h1>
          <p className="text-neutral-400">Join our food community</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignUp} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-neutral-300 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="foodlover123"
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 text-white rounded-lg focus:outline-none focus:border-amber-500 transition-colors"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-300 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 text-white rounded-lg focus:outline-none focus:border-amber-500 transition-colors"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 text-white rounded-lg focus:outline-none focus:border-amber-500 transition-colors"
              required
            />
            <p className="text-xs text-neutral-500 mt-2">
              Password must be at least 6 characters
            </p>
          </div>

          {/* Sign Up Button */}
          <button
            type="submit"
            disabled={loading || password.length < 6}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-neutral-950 rounded-lg font-bold transition-colors"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-800" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-neutral-950 text-neutral-500">or</span>
          </div>
        </div>

        {/* Sign In Link */}
        <div className="text-center">
          <p className="text-neutral-400 mb-4">Already have an account?</p>
          <Link
            href="/auth/login"
            className="inline-block px-6 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white rounded-lg transition-colors font-medium"
          >
            Sign In
          </Link>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-8">
          <Link href="/" className="text-amber-500 hover:text-amber-400 text-sm transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
