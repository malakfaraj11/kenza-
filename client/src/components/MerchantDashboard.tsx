import React, { useState, useEffect } from 'react';
import { MessageSquare, Bot, Package, AlertTriangle, RefreshCw, CheckCircle2, ArrowRight, Eye, X, Send, Loader2, Phone, MapPin, Truck } from 'lucide-react';

interface Stats {
  messagesRecus: number;
  reponsesLlm: number;
  produitsEnStock: number;
  escaladesEnAttente: number;
}

export function MerchantDashboard() {
  const [stats, setStats] = useState<Stats>({
    messagesRecus: 0,
    reponsesLlm: 0,
    produitsEnStock: 0,
    escaladesEnAttente: 0
  });

  const [escalades, setEscalades] = useState<any[]>([]);
  const [selectedEscalade, setSelectedEscalade] = useState<any | null>(null);

  // Modal Form States
  const [fraisLivraison, setFraisLivraison] = useState<number>(35);
  const [ville, setVille] = useState<string>('Fès');
  const [adresse, setAdresse] = useState<string>('Centre ville, Fès');
  const [messageClient, setMessageClient] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchDashboardStats = async () => {
    try {
      const resStats = await fetch('/api/dashboard/stats');
      if (resStats.ok) {
        const data = await resStats.json();
        setStats(data);
      }

      const resEscalades = await fetch('/api/dashboard/escalades');
      if (resEscalades.ok) {
        const dataEscalades = await resEscalades.json();
        setEscalades(dataEscalades);
      }
    } catch (e) {
      // Fallback
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const handleOpenModal = (esc: any) => {
    setSelectedEscalade(esc);
    setFraisLivraison(35);
    setVille('Fès');
    setAdresse('Centre ville, Fès');
    setSuccessMsg(null);
  };

  useEffect(() => {
    if (selectedEscalade) {
      const total = 450 + (Number(fraisLivraison) || 0);
      setMessageClient(
        `Salam Amine 🌸\nBonne nouvelle ! Votre commande pour ${ville || 'votre ville'} a été validée par notre équipe Kenza SaaS.\nFrais de livraison : ${fraisLivraison} DH (Total : ${total} DH).\nLivraison prévue à l'adresse : ${adresse || 'adresse indiquée'}. Merci pour votre confiance !`
      );
    }
  }, [fraisLivraison, ville, adresse, selectedEscalade]);

  const handleResolveEscalade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEscalade) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/escalades/${selectedEscalade.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fraisLivraison: Number(fraisLivraison),
          ville,
          adresse,
          messageClient,
          validerCommande: true
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`✅ Commande ${data.commandeId || ''} validée et message WhatsApp envoyé au client !`);
        setTimeout(() => {
          setSelectedEscalade(null);
          fetchDashboardStats();
        }, 2000);
      } else {
        alert("Erreur lors de la validation de la commande.");
      }
    } catch (err) {
      alert("Erreur de connexion.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner Alert */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-700 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-2 bg-indigo-500/30 text-indigo-200 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border border-indigo-400/20 mb-2">
            <Bot className="w-3.5 h-3.5 text-emerald-400" /> Agent IA Vendeur Autonome
          </div>
          <h2 className="text-2xl font-bold">Tableau de bord Kenza SaaS</h2>
          <p className="text-indigo-200 text-xs sm:text-sm max-w-xl">
            Suivi en direct des échanges WhatsApp, des réponses automatiques générées par l'IA et de l'état de votre stock.
          </p>
        </div>
        
        <button
          onClick={fetchDashboardStats}
          className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-xl text-xs font-semibold backdrop-blur-md transition flex items-center gap-2 flex-shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Actualiser les Métriques
        </button>
      </div>

      {/* Analytics Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1: Messages Reçus */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Messages Clients Reçus</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-2">{stats.messagesRecus}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <MessageSquare className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-blue-600 font-medium">
            <span>Demandes entrantes sur WhatsApp</span>
          </div>
        </div>

        {/* Metric 2: Réponses Générées par l'IA */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Réponses Générées par l'IA</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-2">{stats.reponsesLlm}</h3>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Bot className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-indigo-600 font-medium">
            <span>Réponses automatiques selon stock</span>
          </div>
        </div>

        {/* Metric 3: Articles Référencés en Stock */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Articles en Stock</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-2">{stats.produitsEnStock}</h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Package className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-purple-600 font-medium">
            <span>Références disponibles pour l'IA</span>
          </div>
        </div>

        {/* Metric 4: Escalades Humaines */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Escalades Humaines</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-2">{stats.escaladesEnAttente}</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-amber-600 font-medium">
            <span>Demandes d'intervention vendeur</span>
          </div>
        </div>
      </div>

      {/* Recent Activity & Escalations Feed */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Suivi en Direct des Escalades &amp; Commandes en Attente</h3>
            <p className="text-xs text-gray-500">Consultez les détails, complétez les informations manquantes et envoyez la confirmation par l'Agent IA</p>
          </div>
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Direct
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {escalades.length > 0 ? (
            escalades.map((e) => (
              <div key={e.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/80 transition">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${e.statut === 'resolue' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {e.statut === 'resolue' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900">Ticket #{e.id} ({e.telephone})</span>
                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${e.statut === 'resolue' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-800'}`}>
                        {e.statut === 'resolue' ? 'Résolue / Validée' : 'Escalade en attente'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Motif : {e.raison || 'Confirmation commande / livraison'}</p>
                    <p className="text-xs text-gray-500 line-clamp-2 max-w-2xl">{e.contexte}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleOpenModal(e)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" /> Voir &amp; Compléter les Infos
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500 text-xs sm:text-sm">
              <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="font-semibold text-gray-700">Aucune escalade ou commande en attente pour l'instant.</p>
              <p className="text-xs text-gray-400 mt-1">Dès qu'un client demande une livraison particulière ou une confirmation, la demande s'affichera ici.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE RÉSOLUTION D'ESCALADE & DE COMPLÉTION DES INFOS */}
      {selectedEscalade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 p-4 sm:p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm sm:text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5 text-emerald-400 flex-shrink-0" /> Ticket #{selectedEscalade.id} - Compléter les Infos Client
                </h3>
                <p className="text-[11px] sm:text-xs text-indigo-200">Validation de la commande et envoi de confirmation par l'Agent IA</p>
              </div>
              <button
                onClick={() => setSelectedEscalade(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
              {/* Context Card */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 sm:p-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-amber-600 flex-shrink-0" /> Téléphone : {selectedEscalade.telephone}
                  </span>
                  <span className="px-2 py-0.5 bg-amber-200/60 text-amber-800 rounded font-semibold text-[11px] self-start sm:self-auto">
                    Motif : {selectedEscalade.raison}
                  </span>
                </div>
                <p className="text-xs text-amber-900/90 leading-relaxed bg-white/60 p-2.5 rounded-lg border border-amber-100 font-mono">
                  {selectedEscalade.contexte}
                </p>
              </div>

              {/* Resolution Form */}
              <form onSubmit={handleResolveEscalade} className="space-y-4">
                <h4 className="font-bold text-gray-900 text-xs sm:text-sm border-b pb-2 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-indigo-600 flex-shrink-0" /> Compléter les informations de livraison manquantes :
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1 text-xs">Frais de livraison (MAD) *</label>
                    <div className="flex flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2">
                      <input
                        type="number"
                        min="0"
                        value={fraisLivraison}
                        onChange={(e) => setFraisLivraison(Number(e.target.value))}
                        className="w-full sm:w-28 px-3 py-2 border border-gray-300 rounded-lg font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <button type="button" onClick={() => setFraisLivraison(25)} className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold">25 DH</button>
                      <button type="button" onClick={() => setFraisLivraison(35)} className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold">35 DH</button>
                      <button type="button" onClick={() => setFraisLivraison(50)} className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold">50 DH</button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1 text-xs">Ville de livraison *</label>
                    <input
                      type="text"
                      value={ville}
                      onChange={(e) => setVille(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-semibold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1 text-xs">Adresse complète de livraison</label>
                  <input
                    type="text"
                    value={adresse}
                    onChange={(e) => setAdresse(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1 text-xs">
                    Message de confirmation que l'Agent IA va envoyer sur WhatsApp :
                  </label>
                  <textarea
                    rows={4}
                    value={messageClient}
                    onChange={(e) => setMessageClient(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-sans focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed text-gray-800"
                  />
                </div>

                {successMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {successMsg}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setSelectedEscalade(null)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Valider la Commande &amp; Envoyer sur WhatsApp
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

