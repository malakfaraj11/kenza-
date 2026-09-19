import React, { useState, useEffect } from 'react';
import { MessageCircle, QrCode, RefreshCw, CheckCircle2, ShieldCheck, Loader2, Power, Clock, Save, Sparkles } from 'lucide-react';

export function WhatsAppConnectionView() {
  const [waStatus, setWaStatus] = useState<'disconnected' | 'pending' | 'connected'>('disconnected');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [proposeAlternatives, setProposeAlternatives] = useState(true);
  const [enableDarija, setEnableDarija] = useState(true);

  // Relance & Tracking State
  const [relanceEnabled, setRelanceEnabled] = useState(true);
  const [relanceDelayMinutes, setRelanceDelayMinutes] = useState(120);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (res.ok) {
        const data = await res.json();
        if (data.status) {
          setWaStatus(data.status);
        }
        if (data.qrCode) {
          setQrCodeUrl(data.qrCode);
        }
      }
    } catch (e) {}
  };

  const fetchRelanceSettings = async () => {
    try {
      const res = await fetch('/api/settings/relance');
      if (res.ok) {
        const data = await res.json();
        setRelanceEnabled(data.enabled ?? true);
        setRelanceDelayMinutes(data.delayMinutes ?? 120);
      }
    } catch (e) {}
  };

  useEffect(() => {
    handleGenerateQR();
    fetchRelanceSettings();
    const interval = setInterval(() => {
      checkStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerateQR = async () => {
    setLoading(true);
    setWaStatus('pending');
    
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.qrCode) {
          setQrCodeUrl(data.qrCode);
        }
      }
    } catch (err) {
      console.log("Error fetching real QR code from Evolution API");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' });
    } catch (e) {}
    setWaStatus('disconnected');
    setQrCodeUrl(null);
    setLoading(false);
  };

  const handleSaveRelanceSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings/relance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: relanceEnabled,
          delayMinutes: Number(relanceDelayMinutes) || 120
        })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      alert("Erreur lors de la sauvegarde des paramètres de relance.");
    } finally {
      setSavingSettings(false);
    }
  };

  const simulateScanSuccess = () => {
    setWaStatus('connected');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Main Connection Box */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md mb-4 border border-white/20 shadow-inner">
            <MessageCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Connexion WhatsApp (Evolution API)</h2>
          <p className="text-indigo-200 max-w-lg mx-auto text-sm">
            Reliez votre numéro de téléphone professionnel pour que l'Agent IA Kenza réponde à vos clients 24/7 en fonction de votre stock.
          </p>
        </div>

        <div className="p-4 sm:p-8">
          {waStatus === 'disconnected' && (
            <div className="text-center py-4 sm:py-6">
              <div className="bg-blue-50 border border-blue-100 text-blue-900 rounded-xl p-4 sm:p-5 mb-6 sm:mb-8 text-xs sm:text-sm text-left max-w-xl mx-auto">
                <h4 className="font-bold flex items-center gap-2 text-blue-900 mb-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                  Procédure de liaison sécurisée (Mode Baileys / Evolution API)
                </h4>
                <ol className="list-decimal ml-5 space-y-1.5 text-blue-800 text-xs sm:text-sm">
                  <li>Cliquez sur <strong>"Générer le QR Code"</strong> ci-dessous.</li>
                  <li>Ouvrez l'application WhatsApp sur votre smartphone professionnel.</li>
                  <li>Allez dans <strong>Réglages &gt; Appareils connectés &gt; Connecter un appareil</strong>.</li>
                  <li>Scannez le QR Code qui apparaîtra à l'écran.</li>
                </ol>
              </div>

              <button
                onClick={handleGenerateQR}
                disabled={loading}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 sm:px-8 rounded-xl transition shadow-lg shadow-indigo-600/30 inline-flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
                Générer le QR Code de Connexion
              </button>
            </div>
          )}

          {waStatus === 'pending' && (
            <div className="flex flex-col items-center py-2 sm:py-4">
              <p className="font-semibold text-gray-900 text-sm sm:text-base mb-1 text-center">Scannez ce QR Code avec WhatsApp</p>
              <p className="text-xs text-gray-500 mb-4 sm:mb-6 text-center">Valable 60 secondes pour établir la session autonome</p>

              <div className="p-3 sm:p-4 border-2 border-indigo-100 rounded-2xl bg-white shadow-md mb-4 sm:mb-6 relative group max-w-full">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="QR Code WhatsApp" className="w-52 h-52 sm:w-64 sm:h-64 object-contain rounded-lg mx-auto" />
                ) : (
                  <div className="w-52 h-52 sm:w-64 sm:h-64 flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  </div>
                )}
                
                <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-2xl overflow-hidden pointer-events-none">
                  <div className="w-full h-1 bg-indigo-500/60 absolute top-0 shadow-[0_0_15px_rgba(79,70,229,0.8)] animate-pulse"></div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 mb-6 bg-indigo-50 px-3 sm:px-4 py-2 rounded-full text-center">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> En attente de détection du scan mobile...
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={() => setWaStatus('disconnected')}
                  className="w-full sm:w-auto px-5 py-2 border border-gray-300 text-gray-700 text-xs sm:text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={simulateScanSuccess}
                  className="w-full sm:w-auto px-5 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition text-xs"
                >
                  (Simulation : Valider le Scan)
                </button>
              </div>
            </div>
          )}

          {waStatus === 'connected' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 border-4 border-emerald-50">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">Agent IA Connecté &amp; En Ligne</h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-6 sm:mb-8 max-w-md mx-auto">
                L'Agent IA Kenza répond désormais à vos clients sur WhatsApp en consultant automatiquement votre stock.
              </p>

              {/* Agent Configuration Settings */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6 text-left border border-gray-200 mb-6 sm:mb-8 max-w-xl mx-auto">
                <h4 className="font-bold text-xs sm:text-sm text-gray-900 border-b border-gray-200 pb-3 mb-4">
                  Règles &amp; Comportement de l'Agent IA
                </h4>
                <div className="space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={proposeAlternatives}
                      onChange={(e) => setProposeAlternatives(e.target.checked)}
                      className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 flex-shrink-0"
                    />
                    <div>
                      <span className="text-xs sm:text-sm font-medium text-gray-900">Proposer des alternatives si stock épuisé</span>
                      <p className="text-[11px] sm:text-xs text-gray-500">Si une couleur/taille manque, l'IA suggère d'autres variantes existantes.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableDarija}
                      onChange={(e) => setEnableDarija(e.target.checked)}
                      className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 flex-shrink-0"
                    />
                    <div>
                      <span className="text-xs sm:text-sm font-medium text-gray-900">Activer le support Darija / Français mixte</span>
                      <p className="text-[11px] sm:text-xs text-gray-500">L'IA s'adapte à la langue du client (Lettres latines / Arabizi / FR / AR).</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button
                  onClick={handleGenerateQR}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 text-xs sm:text-sm font-medium rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Regénérer la session
                </button>
                <button
                  onClick={handleDisconnect}
                  className="w-full sm:w-auto px-5 py-2 bg-red-50 border border-red-200 text-red-600 text-xs sm:text-sm font-medium rounded-lg hover:bg-red-100 transition flex items-center justify-center gap-2"
                >
                  <Power className="w-4 h-4" /> Déconnecter le numéro
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CARD: RELANCE & TRACKING CLIENTS INACTIFS */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Tracking &amp; Relance Automatique des Clients Inactifs</h3>
              <p className="text-xs text-gray-500">L'IA envoie un message de suivi personnalisé si le client ne répond pas après le délai choisi (annulé dès réponse client).</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold self-start sm:self-auto ${relanceEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'}`}>
            {relanceEnabled ? '● Relance Active' : '○ Désactivée'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100/60 transition">
              <span className="text-sm font-semibold text-gray-900">Activer le message de suivi / relance</span>
              <input
                type="checkbox"
                checked={relanceEnabled}
                onChange={(e) => setRelanceEnabled(e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
            </label>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Délai d'inactivité avant relance (en minutes) *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={relanceDelayMinutes}
                  onChange={(e) => setRelanceDelayMinutes(parseInt(e.target.value, 10) || 1)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveRelanceSettings}
                  disabled={savingSettings}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition shadow-sm flex items-center gap-2"
                >
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer
                </button>
              </div>
              {saveSuccess && (
                <p className="text-xs text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Paramètres de relance enregistrés avec succès !
                </p>
              )}
            </div>
          </div>

          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 text-xs space-y-3 text-indigo-900">
            <p className="font-bold flex items-center gap-1.5 text-indigo-950">
              <Sparkles className="w-4 h-4 text-indigo-600" /> Choix rapide du délai :
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setRelanceDelayMinutes(2); setRelanceEnabled(true); }}
                className={`px-3 py-1.5 border rounded-lg font-medium transition ${relanceDelayMinutes === 2 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}
              >
                ⚡ 2 min (Test)
              </button>
              <button
                type="button"
                onClick={() => { setRelanceDelayMinutes(15); setRelanceEnabled(true); }}
                className={`px-3 py-1.5 border rounded-lg font-medium transition ${relanceDelayMinutes === 15 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}
              >
                ⏱️ 15 min
              </button>
              <button
                type="button"
                onClick={() => { setRelanceDelayMinutes(60); setRelanceEnabled(true); }}
                className={`px-3 py-1.5 border rounded-lg font-medium transition ${relanceDelayMinutes === 60 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}
              >
                ⌛ 60 min (1h)
              </button>
              <button
                type="button"
                onClick={() => { setRelanceDelayMinutes(120); setRelanceEnabled(true); }}
                className={`px-3 py-1.5 border rounded-lg font-medium transition ${relanceDelayMinutes === 120 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}
              >
                🌙 120 min (2h)
              </button>
            </div>
            <p className="text-[11px] text-indigo-700 italic">
              Remarque : Dès que le client envoie un message, le décompte est réinitialisé ou annulé automatiquement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
