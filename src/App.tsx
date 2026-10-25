import { lazy,Suspense } from "react";
import PageSkeleton from "./components/PageSkeleton";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProfileGate from "./components/ProfileGate";
import DeviceNavigation from "./components/DeviceNavigation";
const SourceCatalogPage=lazy(()=>import("./pages/SourceCatalogPage"));
const SourceDetailsPage=lazy(()=>import("./pages/SourceDetailsPage"));
const MyListPage=lazy(()=>import("./pages/MyListPage"));
import Index from "./pages/Index";
const SearchPage=lazy(()=>import("./pages/SearchPage"));
const DetailsPage=lazy(()=>import("./pages/DetailsPage"));
const CategoryPage=lazy(()=>import("./pages/CategoryPage"));
const TVPage=lazy(()=>import("./pages/TVPage"));
const AcervoPage=lazy(()=>import("./pages/AcervoPage"));
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" position="bottom-right" closeButton/>
      <BrowserRouter>
        <DeviceNavigation />
        <ProfileGate><Suspense fallback={<PageSkeleton/>}><Routes>
          <Route path="/" element={<Index />} />
          <Route path="/catalog" element={<SourceCatalogPage/>}/>
          <Route path="/source/:id" element={<SourceDetailsPage/>}/>
          <Route path="/my-list" element={<MyListPage/>}/>
          <Route path="/search" element={<SearchPage />} />
          <Route path="/details/:type/:id" element={<DetailsPage />} />
          <Route path="/category/:category" element={<CategoryPage />} />
          <Route path="/tv" element={<TVPage />} />
          <Route path="/acervo" element={<AcervoPage/>}/>
          <Route path="*" element={<NotFound />} />
        </Routes></Suspense></ProfileGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
