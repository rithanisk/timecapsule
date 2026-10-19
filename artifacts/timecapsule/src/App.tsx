import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  CapturePage,
  ArchivePage,
  CreateBoothPage,
  BoothManagePage,
  HomePage,
  JoinPage,
  NotificationsPage,
  RevealPage,
} from '@/pages/timecapsule';
import { LoginPage, RegisterPage } from '@/pages/auth';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import {
  Route,
  Switch,
  useLocation,
  useParams,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function RequireSignIn({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      const destination = window.location.pathname + window.location.search;
      navigate(`/login?next=${encodeURIComponent(destination)}`, { replace: true });
    }
  }, [isLoading, user, navigate]);

  return user ? <>{children}</> : null;
}

function BoothStatusRedirect() {
  const { privateToken = '' } = useParams<{ privateToken: string }>();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (privateToken) navigate(`/booth/${privateToken}`, { replace: true });
  }, [privateToken, navigate]);
  return null;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/create"><RequireSignIn><CreateBoothPage /></RequireSignIn></Route>
        <Route path="/archive/:boothId/reveal" component={RevealPage} />
        <Route path="/archive"><RequireSignIn><ArchivePage /></RequireSignIn></Route>
        <Route path="/join/:privateToken/capture"><RequireSignIn><CapturePage /></RequireSignIn></Route>
        <Route path="/join/:privateToken" component={JoinPage} />
        <Route path="/booth/:privateToken/reveal" component={RevealPage} />
        <Route path="/booth/:privateToken/style" component={BoothStatusRedirect} />
        <Route path="/booth/:privateToken/edit" component={BoothStatusRedirect} />
        <Route path="/booth/:privateToken/notifications" component={NotificationsPage} />
        <Route path="/booth/:privateToken" component={BoothManagePage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
