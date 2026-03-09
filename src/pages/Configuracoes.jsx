import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { User, Phone, Sparkles, Save, ShieldCheck, Mail, CheckCircle2 } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Configuracoes() {
  const { currentUser, userProfile } = useAuth();
  
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [promptIA, setPromptIA] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  // A MÁGICA DOS PLANOS: Libera a IA apenas para Premium (ou Admin)
  const isPremium = userProfile?.plano === 'premium';
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';
  const mostrarIA = isPremium || isAdmin;

  useEffect(() => {
    async function fetchPerfil() {
      if (!currentUser) return;
      try {
        const docRef = doc(db, 'usuarios', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setNome(data.nome || '');
          setWhatsapp(data.whatsapp || '');
          setPromptIA(data.promptPersonalizado || '');
        }
      } catch (error) {
        console.error("Erro ao buscar perfil:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPerfil();
  }, [currentUser]);

  async function handleSalvar(e) {
    e.preventDefault();
    setSalvando(true);
    setMensagem(null);
    try {
      const docRef = doc(db, 'usuarios', currentUser.uid);
      await updateDoc(docRef, {
        nome: nome.trim(),
        whatsapp: whatsapp.trim(),
        promptPersonalizado: promptIA.trim()
      });
      setMensagem({ tipo: 'sucesso', texto: 'Configurações salvas com sucesso!' });
      setTimeout(() => setMensagem(null), 3000);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar. Tente novamente.' });
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Configurações da Conta' }]} />
      
      <div className="flex items-center gap-4 mb-8 mt-4">
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg shrink-0">
          <ShieldCheck size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Minha Conta</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Gerencie seu perfil e preferências do sistema.</p>
        </div>
      </div>

      {mensagem && (
        <div className={`mb-6 p-4 rounded-xl font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 ${mensagem.tipo === 'sucesso' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {mensagem.tipo === 'sucesso' ? <CheckCircle2 size={20}/> : null}
          {mensagem.texto}
        </div>
      )}

      <form onSubmit={handleSalvar} className="space-y-6">
        
        {/* CARD 1: DADOS PESSOAIS */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-100 pb-4">
            <User size={20} className="text-blue-600" /> Perfil do Professor
          </h2>
          
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">E-mail de Acesso (Não editável)</label>
              <div className="flex items-center gap-3 w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-500 font-medium">
                <Mail size={18} className="text-gray-400 shrink-0"/>
                {currentUser?.email}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nome de Exibição</label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Ex: Prof. Silva"
                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800 transition-all"
                    value={nome} 
                    onChange={e => setNome(e.target.value)} 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">WhatsApp / Telefone</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Ex: 11999999999"
                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800 transition-all"
                    value={whatsapp} 
                    onChange={e => setWhatsapp(e.target.value)} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: CONFIGURAÇÃO DE IA (SÓ APARECE PARA PREMIUM E ADMIN) */}
        {mostrarIA && (
          <div className="bg-gradient-to-br from-purple-900 to-indigo-900 p-6 md:p-8 rounded-3xl shadow-lg border border-purple-700 relative overflow-hidden">
            {/* Efeito visual de fundo */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6 border-b border-purple-700/50 pb-4">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Sparkles size={20} className="text-yellow-400" /> Treinamento da IA (Premium)
                </h2>
                <span className="bg-yellow-400 text-yellow-900 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                  Exclusivo
                </span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-purple-200 uppercase tracking-widest mb-2 ml-1">
                    Instruções de Personalidade (Prompt de Sistema)
                  </label>
                  <p className="text-sm text-purple-300 mb-3 font-medium">
                    Defina como a Inteligência Artificial deve se comportar ao gerar os feedbacks. Ex: "Seja acolhedor, use emojis, chame o aluno pelo primeiro nome e seja rigoroso com erros de gramática."
                  </p>
                  <textarea 
                    rows="4" 
                    placeholder="Cole aqui suas instruções de comportamento da IA..."
                    className="w-full p-4 bg-purple-950/50 border border-purple-600 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none font-medium text-white placeholder-purple-400/50 transition-all resize-none shadow-inner"
                    value={promptIA} 
                    onChange={e => setPromptIA(e.target.value)} 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 flex justify-end">
          <button 
            type="submit" 
            disabled={salvando} 
            className="bg-blue-600 text-white font-black px-8 py-4 rounded-xl hover:bg-blue-700 transition-all shadow-md flex items-center gap-2 disabled:opacity-50 text-lg w-full sm:w-auto justify-center"
          >
            {salvando ? 'Salvando...' : <><Save size={20}/> Salvar Configurações</>}
          </button>
        </div>

      </form>
    </div>
  );
}
