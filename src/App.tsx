import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Shell } from './components/Shell';
import { AccountPage } from './pages/Account';
import { LoginPage, SignupPage } from './pages/AuthScreen';
import { CashflowPage } from './pages/Cashflow';
import { DashboardPage } from './pages/Dashboard';
import { GoalDetailPage } from './pages/GoalDetail';
import { GoalsPage } from './pages/Goals';
import { LoanDetailPage } from './pages/LoanDetail';
import { LoanFormPage } from './pages/LoanForm';
import { LoansPage } from './pages/Loans';
import { OnboardingPage } from './pages/Onboarding';
import { useLedger } from './state/store';

function Guest({ children }: { children: ReactNode }) {
  const { user } = useLedger();
  if (!user) return children;
  if (!user.onboardingComplete) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/" replace />;
}

function OnboardingGate() {
  const { user } = useLedger();
  if (!user) return <Navigate to="/login" replace />;
  if (user.onboardingComplete) return <Navigate to="/" replace />;
  return <OnboardingPage />;
}

function Ready() {
  const { user } = useLedger();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.onboardingComplete) return <Navigate to="/onboarding" replace />;
  return <Shell />;
}

function KeyedGoal() {
  const { id } = useParams();
  return <GoalDetailPage key={id} />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Guest><LoginPage /></Guest>} />
      <Route path="/signup" element={<Guest><SignupPage /></Guest>} />
      <Route path="/onboarding" element={<OnboardingGate />} />
      <Route element={<Ready />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/loans" element={<LoansPage />} />
        <Route path="/loans/new" element={<LoanFormPage />} />
        <Route path="/loans/:id/edit" element={<LoanFormPage />} />
        <Route path="/loans/:id" element={<LoanDetailPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/goals/:id" element={<KeyedGoal />} />
        <Route path="/income" element={<CashflowPage />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
