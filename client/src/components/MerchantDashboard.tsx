import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Bot,
  Package,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Eye,
  X,
  Send,
  Loader2,
  Phone,
  MapPin,
  Truck,
  ShoppingBag,
  Clock,
  Search,
  Check,
  Ban,
  Receipt
} from 'lucide-react';

interface Stats {
  messagesRecus: number;
  reponsesLlm: number;
  produitsEnStock: number;
  escaladesEnAttente: number;
  totalCommandes?: number;
  chiffreAffaires?: number;
  enPreparation?: number;
}

interface OrderArticle {
  ref: string;
  modele: string;
  taille: string;
  quantite: number;
  prix_unitaire_mad: number;
}

interface Order {
  id: string;
  date_commande: string;
  statut: string;
  total_mad: number | string;
  total_articles_mad?: number | string;
  frais_livraison_mad?: number | string;
  ville_livraison: string;
  adresse_livraison?: string;
  mode_paiement: string;
  client_nom?: string;
  telephone: string;
  articles?: OrderArticle[];
}

export function MerchantDashboard() {
  const [stats, setStats] = useState<Stats>({
    messagesRecus: 0,
    reponsesLlm: 0,
    produitsEnStock: 0,
    escaladesEnAttente: 0,
    totalCommandes: 0,
    chiffreAffaires: 0,
    enPreparation: 0
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [escalades, setEscalades] = useState<any[]>([]);
  const [selectedEscalade, setSelectedEscalade] = useState<any | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Modal Escalade Form States
  const [fraisLivraison, setFraisLivraison] = useState<number>(35);
  const [ville, setVille] = useState<string>('Fès');
  const [adresse, setAdresse] = useState<string>('Centre ville, Fès');
  const [messageClient, setMessageClient] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      // 1. Statistiques globales
      const resStats = await fetch('/api/dashboard/stats');
      if (resStats.ok) {
        const data = await resStats.json();
        setStats(data);
      }

      // 2. Commandes confirmées
      const resOrders = await fetch('/api/dashboard/orders');
      if (resOrders.ok) {
        const dataOrders = await resOrders.json();
        setOrders(dataOrders);
      }

      // 3. Escalades en attente
      const resEscalades = await fetch('/api/dashboard/escalades');
      if (resEscalades.ok) {
        const dataEscalades = await resEscalades.json();
        setEscalades(dataEscalades);
      }
    } catch (e) {
      console.error("Erreur chargement dashboard:", e);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
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
        `Salam Amine 🌸\nBonne nouvelle ! Votre commande pour ${ville || 'votre ville'} a été validée par notre équipe Kenza SaaS.\nFrais de livraison : ${fraisLivraison} DH (Total : ${total} DH).\nLivraison prévue à l'adresse : ${adresse || 'adresse indiquée'}. Le paiement se fera en espèces à la livraison. Merci pour votre confiance !`
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
        setSuccessMsg(`✅ Commande ${data.commandeId || ''} validée et confirmation envoyée au client !`);
        setTimeout(() => {
          setSelectedEscalade(null);
          fetchDashboardData();
        }, 1800);
      } else {
        alert("Erreur lors de la validation de la commande.");
      }
    } catch (err) {
      alert("Erreur de connexion.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/dashboard/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatus })
      });
      if (res.ok) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Filtrage des commandes
  const filteredOrders = orders.filter((o) => {
    const isToday = o.date_commande && new Date(o.date_commande).toDateString() === new Date().toDateString();
    const matchesDate = dateFilter === 'today' ? isToday : true;

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'en_preparation'
        ? o.statut === 'en préparation' || o.statut === 'en_attente'
        : o.statut === statusFilter;

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      o.id.toLowerCase().includes(q) ||
      (o.client_nom && o.client_nom.toLowerCase().includes(q)) ||
      (o.telephone && o.telephone.includes(q)) ||
      (o.ville_livraison && o.ville_livraison.toLowerCase().includes(q));

    return matchesDate && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-700 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-2 bg-indigo-500/30 text-indigo-200 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border border-indigo-400/20 mb-2">
            <Bot className="w-3.5 h-3.5 text-emerald-400" /> Agent IA Vendeur Autonome
          </div>
          <h2 className="text-2xl font-bold">Tableau de bord Kenza SaaS</h2>
          <p className="text-indigo-200 text-xs sm:text-sm max-w-xl">
            Gestion centralisée de vos commandes WhatsApp en direct de PostgreSQL, catalogue et escalades humaines.
          </p>
        </div>

        <button
          onClick={fetchDashboardData}
          className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-xl text-xs font-semibold backdrop-blur-md transition flex items-center gap-2 flex-shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Actualiser en direct
        </button>
      </div>

      {/* Analytics Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1: Commandes Confirmées */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Commandes Confirmées</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-2">
                {stats.totalCommandes ?? orders.length}
              </h3>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-indigo-600 font-semibold gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
            <span>{stats.enPreparation ?? 0} commande(s) en préparation</span>
          </div>
        </div>

        {/* Metric 2: Chiffre d'Affaires Réalisé */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Chiffre d'Affaires Réalisé</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-2">
                {Number(stats.chiffreAffaires || 0).toLocaleString('fr-FR')} <span className="text-base font-semibold text-emerald-800">DH</span>
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Receipt className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-emerald-600 font-medium">
            <span>Paiement cash à la livraison</span>
          </div>
        </div>

        {/* Metric 3: Articles Référencés en Stock */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Catalogue Actif</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-2">{stats.produitsEnStock}</h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Package className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-purple-600 font-medium">
            <span>Références vendues par l'IA</span>
          </div>
        </div>

        {/* Metric 4: Escalades Humaines */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Escalades en Attente</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-2">{stats.escaladesEnAttente}</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-amber-600 font-medium">
            <span>{stats.escaladesEnAttente > 0 ? "Action requise du vendeur" : "Aucune intervention requise"}</span>
          </div>
        </div>
      </div>

      {/* SECTION 1 : COMMANDES CONFIRMÉES (POSTGRESQL SAAS EN DIRECT) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-gray-900 text-lg">Commandes Clients En Direct</h3>
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-200">
                {orders.length} total
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Toutes les commandes générées par l'Agent IA WhatsApp et enregistrées dans votre base PostgreSQL.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* Toggle Aujourd'hui vs Historique */}
            <div className="flex items-center gap-1 bg-indigo-50/90 p-1 rounded-xl text-xs font-semibold border border-indigo-100">
              <button
                onClick={() => setDateFilter('today')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  dateFilter === 'today'
                    ? 'bg-indigo-600 text-white shadow-sm font-bold'
                    : 'text-indigo-800 hover:text-indigo-950 hover:bg-white/50'
                }`}
              >
                <span>⚡ Aujourd'hui en direct</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${dateFilter === 'today' ? 'bg-white/20 text-white' : 'bg-indigo-200/60 text-indigo-900'}`}>
                  {orders.filter(o => o.date_commande && new Date(o.date_commande).toDateString() === new Date().toDateString()).length}
                </span>
              </button>

              <button
                onClick={() => setDateFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  dateFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm font-bold'
                    : 'text-indigo-800 hover:text-indigo-950 hover:bg-white/50'
                }`}
              >
                <span>📚 Tout l'historique</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${dateFilter === 'all' ? 'bg-white/20 text-white' : 'bg-indigo-200/60 text-indigo-900'}`}>
                  {orders.length}
                </span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par N°, client, ville..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-xl w-full sm:w-56 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg transition ${statusFilter === 'all' ? 'bg-white text-gray-900 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Toutes
              </button>
              <button
                onClick={() => setStatusFilter('en_preparation')}
                className={`px-3 py-1 rounded-lg transition ${statusFilter === 'en_preparation' ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                En préparation
              </button>
              <button
                onClick={() => setStatusFilter('livrée')}
                className={`px-3 py-1 rounded-lg transition ${statusFilter === 'livrée' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Livrées
              </button>
              <button
                onClick={() => setStatusFilter('annulée')}
                className={`px-3 py-1 rounded-lg transition ${statusFilter === 'annulée' ? 'bg-white text-red-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Annulées
              </button>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          {filteredOrders.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 text-gray-500 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">N° Commande</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Client &amp; Contact</th>
                  <th className="py-3.5 px-4">Destination</th>
                  <th className="py-3.5 px-4">Articles</th>
                  <th className="py-3.5 px-4">Total Net</th>
                  <th className="py-3.5 px-4">Statut</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredOrders.map((order) => {
                  const isPrep = order.statut === 'en préparation' || order.statut === 'en_attente';
                  const isDelivered = order.statut === 'livrée';
                  const isCancelled = order.statut === 'annulée';

                  const dateStr = order.date_commande
                    ? new Date(order.date_commande).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'N/A';

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 px-4 sm:px-6 font-bold text-gray-900 whitespace-nowrap">
                        <span className="font-mono text-indigo-700">{order.id}</span>
                      </td>

                      <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {dateStr}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{order.client_nom || 'Client WhatsApp'}</div>
                        <div className="text-gray-500 flex items-center gap-1 font-mono text-[11px]">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          {order.telephone}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
                          {order.ville_livraison || 'Maroc'}
                        </div>
                        {order.adresse_livraison && (
                          <div className="text-gray-500 text-[11px] truncate max-w-[180px]" title={order.adresse_livraison}>
                            {order.adresse_livraison}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {order.articles && order.articles.length > 0 ? (
                          <div className="space-y-0.5">
                            {order.articles.map((art, idx) => (
                              <div key={idx} className="text-gray-800 text-[11px]">
                                <span className="font-semibold">{art.quantite}x</span> {art.modele} ({art.taille || 'TU'})
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Articles enregistrés</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-gray-900 whitespace-nowrap">
                        <span className="text-sm text-indigo-950">{order.total_mad} DH</span>
                        <div className="text-[10px] text-emerald-700 font-normal">À la livraison</div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isDelivered
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isPrep
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : isCancelled
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isDelivered ? 'bg-emerald-500' : isPrep ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                          ></span>
                          {order.statut}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                          title="Voir le détail de la commande"
                        >
                          <Eye className="w-3.5 h-3.5" /> Détails
                        </button>

                        {isPrep && (
                          <button
                            disabled={updatingOrderId === order.id}
                            onClick={() => handleUpdateOrderStatus(order.id, 'livrée')}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1 shadow-sm"
                            title="Marquer comme livrée"
                          >
                            <Check className="w-3.5 h-3.5" /> Livrée
                          </button>
                        )}

                        {isPrep && (
                          <button
                            disabled={updatingOrderId === order.id}
                            onClick={() => handleUpdateOrderStatus(order.id, 'annulée')}
                            className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition inline-flex items-center"
                            title="Annuler la commande"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-bold text-gray-800 text-sm">Aucune commande ne correspond aux filtres.</p>
              <p className="text-xs text-gray-400 mt-1">Dès qu'un client passe commande via WhatsApp, elle apparaît instantanément ici.</p>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2 : ESCALADES HUMAINES EN ATTENTE */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-gray-900 text-base">Demandes d'Escalade &amp; Cas Particuliers</h3>
              <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                {escalades.filter((e) => e.statut !== 'resolue').length} en attente
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Clients nécessitant une confirmation de frais de livraison sur-mesure ou une intervention humaine.
            </p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {escalades.length > 0 ? (
            escalades.map((e) => (
              <div key={e.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/80 transition">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      e.statut === 'resolue' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                    }`}
                  >
                    {e.statut === 'resolue' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900">
                        Ticket #{e.id} ({e.telephone})
                      </span>
                      <span
                        className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                          e.statut === 'resolue' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
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
              <p className="font-semibold text-gray-700">Aucune escalade en attente pour l'instant.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DETAIL COMMANDE */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-400" /> Commande {selectedOrder.id}
                </h3>
                <p className="text-xs text-indigo-200 mt-0.5">Enregistrée dans PostgreSQL</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Client :</span>
                  <span className="font-bold text-gray-900">{selectedOrder.client_nom || 'Client WhatsApp'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Téléphone :</span>
                  <span className="font-mono font-bold text-gray-900">{selectedOrder.telephone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ville :</span>
                  <span className="font-bold text-gray-900">{selectedOrder.ville_livraison}</span>
                </div>
                {selectedOrder.adresse_livraison && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Adresse :</span>
                    <span className="font-medium text-gray-900 text-right max-w-xs">{selectedOrder.adresse_livraison}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-500">Mode de paiement :</span>
                  <span className="font-semibold text-emerald-700">Paiement à la livraison 💵</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 mb-2">Articles commandés :</h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden divide-y">
                  {selectedOrder.articles && selectedOrder.articles.length > 0 ? (
                    selectedOrder.articles.map((art, idx) => (
                      <div key={idx} className="p-3 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-gray-900">{art.modele}</div>
                          <div className="text-[11px] text-gray-500">
                            Ref: {art.ref} | Taille: {art.taille || 'Unique'} | Qté: {art.quantite}
                          </div>
                        </div>
                        <div className="font-bold text-gray-900">{art.prix_unitaire_mad * art.quantite} DH</div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-gray-400 italic">Détails de commande standards</div>
                  )}
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex justify-between items-center text-sm">
                <span className="font-bold text-indigo-950">Total à encaisser :</span>
                <span className="text-xl font-extrabold text-indigo-700">{selectedOrder.total_mad} MAD</span>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RÉSOLUTION D'ESCALADE */}
      {selectedEscalade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
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

            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
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

              <form onSubmit={handleResolveEscalade} className="space-y-4">
                <h4 className="font-bold text-gray-900 text-xs sm:text-sm border-b pb-2 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-indigo-600 flex-shrink-0" /> Compléter les informations de livraison :
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
                    Message de confirmation envoyé sur WhatsApp :
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
