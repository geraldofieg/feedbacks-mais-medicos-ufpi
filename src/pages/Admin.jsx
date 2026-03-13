import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
// NOVO: Adicionei o getDoc para a lógica de renovação inteligente
import { collection, query, getDocs, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
// NOVO: Adicionei CalendarPlus e Infinity para os botões de cobrança
import { ShieldCheck, Crown, Trash2, UserCog, User, AlertTriangle, RefreshCw, Mail, Zap, CalendarPlus, Infinity } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Admin() {
  const { currentUser, userProfile } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  // Proteção de Acesso: Só Admins entram aqui
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  useEffect(() => {
    async function fetchUsuarios() {
      if (!isAdmin) return;
      try {
        const q = query(collection(db, 'usuarios'));
        const snap = await getDocs(q);
        
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Ordenação: Admins primeiro, depois ordem alfabética
        lista.sort((a, b) => {
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;
          return (a.nome || '').localeCompare(b.nome || '');
        });
        
        setUsuarios(lista);
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    }
    fetchUsuarios();
  }, [isAdmin]);

  // FUNÇÃO: MUDAR CARGO (Professor <-> Admin)
  async function handleMudarCargo(id, cargoAtual) {
    const novoCargo = cargoAtual === 'admin' ? 'professor' : 'admin';
    if (!window.confirm(`Deseja alterar o acesso deste usuário para ${novoCargo.toUpperCase()}?`)) return;

    try {
      await updateDoc(doc(db, 'usuarios', id), { role: novoCargo });
      setUsuarios(usuarios.map(u => u.id === id ? { ...u, role: novoCargo } : u));
    } catch (e) { alert("Erro ao mudar cargo."); }
  }

  // FUNÇÃO: MUDAR PLANO SAAS (Tiers)
  async function handleMudarPlano(id, novoPlano) {
    try {
      await updateDoc(doc(db, 'usuarios', id), { plano: novoPlano });
      setUsuarios(usuarios.map(u => u.id === id ? { ...u, plano: novoPlano } : u));
    } catch (e) { alert("Erro ao mudar plano."); }
  }

  // =========================================================================
  // NOVAS FUNÇÕES: GESTÃO DE ASSINATURA E TEMPO DE ACESSO
  // =========================================================================

  // FUNÇÃO: ESTENDER ASSINATURA (Inteligente: a partir de hoje ou do fim do plano atual)
  async function estenderAssinatura(id, diasAdicionais) {
    try {
      const userData = usuarios.find(u => u.id === id);
      let dataBase = new Date(); // Começa assumindo que vai renovar a partir de hoje

      if (userData && userData.dataExpiracao) {
        const currentExp = userData.dataExpiracao.toDate ? userData.dataExpiracao.toDate() : new Date(userData.dataExpiracao.seconds * 1000);
        // Se a assinatura ainda está no futuro, soma os dias na data futura (não rouba dias do cliente)
        if (currentExp > dataBase) {
          dataBase = currentExp;
        }
      }

      const novaData = new Date(dataBase);
      novaData.setDate(novaData.getDate() + diasAdicionais);

      await updateDoc(doc(db, 'usuarios', id), {
        dataExpiracao: novaData,
        isVitalicio: false // Tira o vitalício se ele tiver voltado a pagar mensal/anual
      });

      setUsuarios(usuarios.map(u => u.id === id ? { ...u, dataExpiracao: novaData, isVitalicio: false } : u));
      alert(`Assinatura estendida por ${diasAdicionais} dias com sucesso!`);
    } catch (error) {
      alert("Erro ao estender assinatura.");
      console.error(error);
    }
  }

  // FUNÇÃO: DAR ACESSO VITALÍCIO
  async function tornarVitalicio(id) {
    if (!window.confirm("Deseja conceder acesso permanente e vitalício a este cliente?")) return;
    try {
      await updateDoc(doc(db, 'usuarios', id), { isVitalicio: true });
      setUsuarios(usuarios.map(u => u.id === id ? { ...u, isVitalicio: true } : u));
      alert("Acesso Vitalício concedido com sucesso!");
    } catch (error) {
      alert("Erro ao conceder acesso vitalício.");
      console.error(error);
    }
  }

  // FUNÇÃO: EXCLUIR USUÁRIO (Hard Delete)
  async function handleExcluirUsuario(id, nome) {
    if (!window.confirm(`PERIGO: Excluir permanentemente a conta de "${nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteDoc(doc(db, 'usuarios', id));
      setUsuarios(usuarios.filter(u => u.id !== id));
    } catch (e) { alert("Erro ao excluir."); }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <AlertTriangle className="mx-auto text-red-500 mb-6" size={64}/>
        <h1 className="text-3xl font-black text-slate-800">Acesso Restrito</h1>
        <p className="text-slate-500 text-lg mt-2">Você não possui permissão para acessar o painel de gestão do SaaS.</p>
      </div>
    );
  }

  if (loading) return <div className="p-20 text-center font-black text-slate-400 animate-pulse">Carregando usuários...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Painel SaaS' }]} />

      <div className="flex items-center gap-4 mt-6 mb-10">
        <div className="bg-slate-900 text-yellow-400 p-4 rounded-3xl shadow-xl">
          <ShieldCheck size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Painel SaaS (Super Admin)</h1>
          <p className="text-slate-500 font-medium">Gestão de assinaturas, acessos e faturamento.</p>
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-6 text-sm font-black text-slate-800 uppercase tracking-widest">Professor / Usuário</th>
                <th className="p-6 text-sm font-black text-slate-800 uppercase tracking-widest">Nível de Acesso</th>
                <th className="p-6 text-sm font-black text-slate-800 uppercase tracking-widest">Plano de Assinatura</th>
                {/* NOVO: Coluna de Vencimento e Botões Financeiros */}
                <th className="p-6 text-sm font-black text-slate-800 uppercase tracking-widest">Assinatura (SaaS)</th>
                <th className="p-6 text-sm font-black text-slate-800 uppercase tracking-widest text-right">Gestão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {usuarios.map(user => {
                
                // NOVO: Lógica Visual do Vencimento
                let statusVisual = "Ativo";
                let corStatus = "text-green-700 bg-green-100";
                let textoValidade = "";

                if (user.isVitalicio) {
                  statusVisual = "Vitalício";
                  corStatus = "text-purple-700 bg-purple-100";
                  textoValidade = "Sem data de expiração";
                } else if (user.dataExpiracao) {
                  const dataVencimento = user.dataExpiracao.toDate ? user.dataExpiracao.toDate() : new Date(user.dataExpiracao.seconds * 1000);
                  const hoje = new Date();
                  
                  textoValidade = `Vence em: ${dataVencimento.toLocaleDateString('pt-BR')}`;
                  
                  if (hoje > dataVencimento) {
                    statusVisual = "Vencido";
                    corStatus = "text-red-700 bg-red-100";
                  } else if ((dataVencimento - hoje) / (1000 * 60 * 60 * 24) <= 5) {
                    statusVisual = "Vence em breve";
                    corStatus = "text-orange-700 bg-orange-100";
                  }
                } else {
                   statusVisual = "Sem Trial";
                   corStatus = "text-gray-700 bg-gray-100";
                   textoValidade = "Data não definida";
                }

                return (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                    
                    {/* IDENTIFICAÇÃO */}
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${user.role === 'admin' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                          {user.role === 'admin' ? <Crown size={22}/> : <User size={22}/>}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-lg leading-tight">{user.nome || 'Sem Nome'}</p>
                          <p className="text-sm text-slate-400 font-medium flex items-center gap-1"><Mail size={12}/> {user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* CARGO (ADMIN/PROFESSOR) */}
                    <td className="p-6">
                      <button 
                        onClick={() => handleMudarCargo(user.id, user.role)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                          user.role === 'admin' 
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' 
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                        }`}
                      >
                        {user.role === 'admin' ? <><Crown size={14}/> Super Admin</> : <><UserCog size={14}/> Professor</>}
                      </button>
                    </td>

                    {/* PLANO SAAS */}
                    <td className="p-6">
                      <div className="relative inline-block">
                        <Zap className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${user.plano === 'premium' ? 'text-yellow-500' : 'text-slate-300'}`} size={16} />
                        <select 
                          value={user.plano || 'basico'} 
                          onChange={(e) => handleMudarPlano(user.id, e.target.value)}
                          className="bg-slate-50 border-2 border-slate-100 text-slate-700 text-sm rounded-xl py-2.5 pl-10 pr-4 font-black outline-none focus:border-blue-500 appearance-none cursor-pointer shadow-sm min-w-[200px]"
                        >
                          <option value="trial">Trial de 30 Dias</option>
                          <option value="basico">Tier 1: Básico</option>
                          <option value="intermediario">Tier 2: Intermediário</option>
                          <option value="premium">Tier 3: Premium (IA)</option>
                        </select>
                      </div>
                    </td>

                    {/* NOVO: STATUS DA ASSINATURA & RENOVAÇÃO */}
                    <td className="p-6">
                      <div className="flex flex-col items-start gap-2">
                        <div>
                          <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider mb-1 ${corStatus}`}>
                            {statusVisual}
                          </span>
                          <p className="text-xs text-slate-500 font-medium">{textoValidade}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <button 
                            onClick={() => estenderAssinatura(user.id, 30)}
                            className="flex items-center gap-1 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-[11px] font-bold py-1.5 px-2 rounded-lg shadow-sm transition-colors"
                            title="Adicionar 1 Mês"
                          >
                            <CalendarPlus size={14} /> +30d
                          </button>
                          <button 
                            onClick={() => estenderAssinatura(user.id, 365)}
                            className="flex items-center gap-1 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-[11px] font-bold py-1.5 px-2 rounded-lg shadow-sm transition-colors"
                            title="Adicionar 1 Ano"
                          >
                            <CalendarPlus size={14} /> +1a
                          </button>
                          <button 
                            onClick={() => tornarVitalicio(user.id)}
                            className="flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 text-[11px] font-bold py-1.5 px-2 rounded-lg shadow-sm transition-colors"
                            title="Tornar Vitalício"
                          >
                            <Infinity size={14} /> Vitalício
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* AÇÕES (EXCLUIR) */}
                    <td className="p-6 text-right">
                      <button 
                        onClick={() => handleExcluirUsuario(user.id, user.nome)}
                        className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all opacity-20 group-hover:opacity-100"
                        title="Excluir Definitivamente"
                      >
                        <Trash2 size={20} />
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
