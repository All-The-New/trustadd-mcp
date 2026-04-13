import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import Landing from "@/pages/landing";
import Directory from "@/pages/directory";
import AgentProfile from "@/pages/agent-profile";
import Analytics from "@/pages/analytics";
import ApiDocs from "@/pages/api-docs";
import StatusPage from "@/pages/status";
import About from "@/pages/about";
import Economy from "@/pages/economy";
import Protocols from "@/pages/protocols";
import Quality from "@/pages/quality";
import Skills from "@/pages/skills";
import Bazaar from "@/pages/bazaar";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/agents" component={Directory} />
      <Route path="/agent/:id" component={AgentProfile} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/quality" component={Quality} />
      <Route path="/api-docs" component={ApiDocs} />
      <Route path="/status" component={StatusPage} />
      <Route path="/about" component={About} />
      <Route path="/economy" component={Economy} />
      <Route path="/protocols" component={Protocols} />
      <Route path="/skills" component={Skills} />
      <Route path="/bazaar" component={Bazaar} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
