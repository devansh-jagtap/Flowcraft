import { SignIn, SignUp } from '@clerk/react';

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  return (
    <div className="auth-page">
      {mode === 'login' ? <SignIn routing="path" path="/login" /> : <SignUp routing="path" path="/register" />}
    </div>
  );
}
