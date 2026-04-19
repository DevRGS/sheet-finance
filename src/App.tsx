import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FinanceProvider } from "@/contexts/FinanceContext";
import { GoogleAuthProvider } from "@/contexts/GoogleAuthContext";
import Index from "./pages/Index";
import Transacoes from "./pages/Transacoes";
import Categorias from "./pages/Categorias";
import Configuracoes from "./pages/Configuracoes";
import Privacidade from "./pages/Privacidade";
import Dados from "./pages/Dados";
import Orcamentos from "./pages/Orcamentos";
import Contas from "./pages/Contas";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="financeflow-theme">
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GoogleAuthProvider>
      <FinanceProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/transacoes" element={<Transacoes />} />
            <Route path="/categorias" element={<Categorias />} />
            <Route path="/orcamentos" element={<Orcamentos />} />
            <Route path="/contas" element={<Contas />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="/dados" element={<Dados />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </FinanceProvider>
      </GoogleAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
