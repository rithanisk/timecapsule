import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  CapturePage,
  CreateBoothPage,
  BoothManagePage,
  EditorPage,
  HomePage,
  JoinPage,
  NotificationsPage,
  RevealPage,
} from '@/pages/timecapsule';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/create" component={CreateBoothPage} />
        <Route path="/join/:privateToken/capture" component={CapturePage} />
        <Route path="/join/:privateToken" component={JoinPage} />
        <Route path="/booth/:privateToken/reveal" component={RevealPage} />
        <Route path="/booth/:privateToken/edit" component={EditorPage} />
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
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
