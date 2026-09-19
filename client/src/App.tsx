import React, { useState } from 'react';
import { LayoutDashboard, Package, MessageCircle, LogOut, Bot, Store, ArrowRight, Bell } from 'lucide-react';
import { MerchantDashboard } from './components/MerchantDashboard.js';
import { CatalogueView } from './components/CatalogueView.js';
import { WhatsAppConnectionView } from './components/WhatsAppConnectionView.js';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'stock' | 'whatsapp'>('whatsapp');

  // Vendor Account Form State
  const [vendorAuth, setVendorAuth] = useState({
    storeName: 'Ma Boutique Mode',
    email: 'vendeur@kenza.ma',
    password: ''
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticated(true);
    setCurrentTab('whatsapp');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentTab('whatsapp');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col md:flex-row antialiased">
      {/* 1. AUTHENTICATION VIEW (If not logged in) */}
      {!isAuthenticated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 p-4">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-emerald-400"></div>

            <div className="text-center mb-8 mt-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/10 text-indigo-600 mb-3 shadow-inner">
                <Bot className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Kenza SaaS Vendeur</h1>
              <p className="text-xs text-slate-500 mt-1">
                {isLoginView ? 'Connectez-vous à votre espace de gestion' : 'Créez votre compte vendeur multi-tenant'}
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {!isLoginView && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nom de la boutique *</label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={vendorAuth.storeName}
                      onChange={(e) => setVendorAuth({ ...vendorAuth, storeName: e.target.value })}
                      placeholder="ex: Caftan Luxe Casablanca"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Adresse E-mail *</label>
                <input
                  type="email"
                  required
                  value={vendorAuth.email}
                  onChange={(e) => setVendorAuth({ ...vendorAuth, email: e.target.value })}
                  placeholder="vendeur@boutique.ma"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mot de passe *</label>
                <input
                  type="password"
                  required
                  value={vendorAuth.password}
                  onChange={(e) => setVendorAuth({ ...vendorAuth, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none transition"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-indigo-600/30 flex justify-center items-center gap-2 text-sm mt-2"
              >
                <span>{isLoginView ? 'Se connecter à l\'espace Vendeur' : 'Créer mon compte Vendeur'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
              <span>{isLoginView ? 'Nouveau vendeur ?' : 'Déjà inscrit ?'}</span>
              <button
                type="button"
                onClick={() => setIsLoginView(!isLoginView)}
                className="text-indigo-600 font-bold hover:underline ml-1"
              >
                {isLoginView ? 'S\'inscrire ici' : 'Se connecter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. AUTHENTICATED VENDOR DASHBOARD LAYOUT */}
      {isAuthenticated && (
        <div className="flex h-screen w-full overflow-hidden">
          {/* SIDEBAR NAVIGATION */}
          <aside className="w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col hidden md:flex z-20 flex-shrink-0">
            <div className="h-16 flex items-center px-6 border-b border-slate-800">
              <div className="flex items-center gap-3 text-indigo-400">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black">
                  K
                </div>
                <div>
                  <span className="font-extrabold text-base text-white tracking-tight">Kenza SaaS</span>
                  <span className="text-[10px] block text-indigo-400 font-medium">Espace Vendeur</span>
                </div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
              <button
                onClick={() => setCurrentTab('dashboard')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all text-sm font-semibold text-left ${
                  currentTab === 'dashboard'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                Tableau de bord
              </button>

              <button
                onClick={() => setCurrentTab('stock')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all text-sm font-semibold text-left ${
                  currentTab === 'stock'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Package className="w-5 h-5" />
                Mon Stock &amp; Fichiers
              </button>

              <button
                onClick={() => setCurrentTab('whatsapp')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all text-sm font-semibold text-left ${
                  currentTab === 'whatsapp'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <MessageCircle className="w-5 h-5" />
                WhatsApp IA (QR Code)
              </button>
            </nav>

            {/* Vendor Profile Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-3 mb-4 px-1">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-sm">
                  {vendorAuth.storeName.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-white truncate">{vendorAuth.storeName}</p>
                  <p className="text-[10px] text-slate-400 truncate">{vendorAuth.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 rounded-lg transition text-left"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </aside>

          {/* MAIN WORKSPACE CONTENT */}
          <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-10 shadow-sm">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-800 capitalize truncate">
                  {currentTab === 'stock'
                    ? 'Gestion du Stock'
                    : currentTab === 'whatsapp'
                    ? 'WhatsApp QR Code'
                    : 'Tableau de bord'}
                </h2>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  onClick={() => setCurrentTab(currentTab === 'whatsapp' ? 'dashboard' : 'whatsapp')}
                  className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{currentTab === 'whatsapp' ? 'Dashboard' : 'QR Code'}</span>
                </button>

                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Agent IA En Ligne</span>
                </span>
              </div>
            </header>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-auto p-4 sm:p-8 pb-20 md:pb-8">
              {currentTab === 'dashboard' && <MerchantDashboard />}
              {currentTab === 'stock' && <CatalogueView />}
              {currentTab === 'whatsapp' && <WhatsAppConnectionView />}
            </div>

            {/* Mobile Fixed Bottom Navigation Bar (Visible on all mobile screens) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 flex justify-around items-center py-2 px-2 shadow-2xl text-slate-400">
              <button
                onClick={() => setCurrentTab('dashboard')}
                className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition ${
                  currentTab === 'dashboard' ? 'text-indigo-400 font-bold bg-slate-800' : 'hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-[10px]">Dashboard</span>
              </button>

              <button
                onClick={() => setCurrentTab('stock')}
                className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition ${
                  currentTab === 'stock' ? 'text-indigo-400 font-bold bg-slate-800' : 'hover:text-white'
                }`}
              >
                <Package className="w-5 h-5" />
                <span className="text-[10px]">Stock</span>
              </button>

              <button
                onClick={() => setCurrentTab('whatsapp')}
                className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition ${
                  currentTab === 'whatsapp' ? 'text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30' : 'hover:text-white'
                }`}
              >
                <MessageCircle className="w-5 h-5 text-emerald-400" />
                <span className="text-[10px] text-emerald-300 font-bold">WhatsApp QR</span>
              </button>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
