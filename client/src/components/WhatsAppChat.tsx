import React, { useState, useRef, useEffect } from 'react';
import { Send, Phone, Video, MoreVertical, CheckCheck, Sparkles, UserCheck, AlertCircle } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  time: string;
}

const SAMPLE_CLIENTS = [
  { nom: 'Nouveau Client WhatsApp', telephone: '+212612345678', ville: 'Casablanca' },
  { nom: 'Nadia Bennani (Fidèle)', telephone: '+212697691176', ville: 'Tanger' },
  { nom: 'Meryem Fassi (Régulier)', telephone: '+212636319460', ville: 'Agadir' },
];

const SUGGESTIONS = [
  { label: '🇲🇦 Prix chemise (Darija)', text: 'salam, chhal taman dyal had chemise vert olive ?' },
  { label: '📦 Rupture stock (Caftan S)', text: 'Je veux commander le Caftan beige en taille S. Est-il dispo ?' },
  { label: '💰 Négociation remise (20%)', text: 'C\'est un peu cher, vous pouvez me faire 20% de remise ?' },
  { label: '🚚 Frais livraison Fès', text: 'Combien coûte la livraison à Fès et sous quel délai ?' },
  { label: '🚨 Facture société (Escalade)', text: 'Pouvez-vous m\'émettre une facture au nom de ma société SARL MAROC ?' },
];

export const WhatsAppChat: React.FC = () => {
  const [selectedClient, setSelectedClient] = useState(SAMPLE_CLIENTS[0]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'agent',
      text: 'Salam ! Marhba bik chez notre boutique. Ana Kenza, votre conseillère commerciale. Kifach n9der n3awnek lyoum ? 😊',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Synchronisation en arrière-plan (polling) pour afficher les relances automatiques (BullMQ)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/sync?phone=${encodeURIComponent(selectedClient.telephone)}`);
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          // Extraire seulement le contenu affichable
          const chatHistory = data.messages.filter((m: any) => 
            m.type === 'human' || 
            (m.type === 'ai' && typeof m.content === 'string' && m.content.trim() !== '')
          );
          
          setMessages((prev) => {
            if (chatHistory.length > prev.length - 1) {
              const newMessages: Message[] = chatHistory.map((m: any, i: number) => ({
                id: `sync-${Date.now()}-${i}`,
                sender: m.type === 'human' ? 'user' : 'agent',
                text: m.content,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }));
              return [prev[0], ...newMessages]; // Conserver le message de bienvenue initial
            }
            return prev;
          });
        }
      } catch (err) {
        // Silencieux
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedClient.telephone]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          phone: selectedClient.telephone,
        }),
      });

      const data = await res.json();
      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: data.reply || 'Désolée, une erreur est survenue.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: 'Erreur de connexion avec le serveur Kenza.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', maxWidth: '900px', margin: '0 auto', background: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
      {/* Top Bar : Client Switcher */}
      <div style={{ background: '#f8fafc', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserCheck size={16} color="#008069" />
          <span style={{ fontWeight: 600, color: '#334155' }}>Tester avec le client :</span>
          <select
            value={selectedClient.telephone}
            onChange={(e) => {
              const c = SAMPLE_CLIENTS.find((cl) => cl.telephone === e.target.value);
              if (c) setSelectedClient(c);
            }}
            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '13px' }}
          >
            {SAMPLE_CLIENTS.map((c) => (
              <option key={c.telephone} value={c.telephone}>
                {c.nom} ({c.telephone}) - {c.ville}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* WhatsApp Header */}
      <div style={{ background: '#008069', color: '#ffffff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#008069', fontSize: '18px' }}>
            K
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Kenza · Conseillère Commerciale
              <span style={{ fontSize: '10px', background: '#25D366', color: '#ffffff', padding: '1px 6px', borderRadius: '8px' }}>IA Agent</span>
            </div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>en ligne (Darija / Français / Arabe)</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', opacity: 0.9 }}>
          <Phone size={20} />
          <Video size={20} />
          <MoreVertical size={20} />
        </div>
      </div>

      {/* Chat Conversation Area */}
      <div
        style={{
          flex: 1,
          background: '#efeae2',
          backgroundImage: 'radial-gradient(#008069 0.4px, transparent 0.4px)',
          backgroundSize: '12px 12px',
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '75%',
              background: m.sender === 'user' ? '#d9fdd3' : '#ffffff',
              padding: '10px 14px',
              borderRadius: '12px',
              borderTopRightRadius: m.sender === 'user' ? '2px' : '12px',
              borderTopLeftRadius: m.sender === 'agent' ? '2px' : '12px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              position: 'relative',
              fontSize: '14px',
              lineHeight: '1.45',
              whiteSpace: 'pre-wrap',
            }}
          >
            <div>{m.text}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '11px', color: '#667781' }}>
              <span>{m.time}</span>
              {m.sender === 'user' && <CheckCheck size={14} color="#53bdeb" />}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ alignSelf: 'flex-start', background: '#ffffff', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', color: '#008069', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
            <Sparkles size={16} className="animate-spin" />
            <span>Kenza consulte les stocks et réfléchit...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div style={{ background: '#f8fafc', padding: '8px 12px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {SUGGESTIONS.map((s, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(s.text)}
            disabled={loading}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '20px',
              padding: '6px 12px',
              fontSize: '12px',
              color: '#334155',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div style={{ padding: '12px 16px', background: '#f0f2f5', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Écrivez un message en Darija, Français ou Arabe..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '12px 18px',
            borderRadius: '24px',
            border: 'none',
            outline: 'none',
            fontSize: '14px',
            background: '#ffffff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !inputText.trim()}
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: inputText.trim() ? '#00a884' : '#cbd5e1',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};
