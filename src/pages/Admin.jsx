import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, getDocs, doc, updateDoc, arrayUnion, where, writeBatch } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Crown, Trash2, UserCog, User, AlertTriangle, Mail, Zap, CalendarPlus, Infinity, Edit3, History, Ban, UserCheck, XCircle, Bell } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { Navigate } from 'react-router-dom';

export default function Admin() {
  const { currentUser, userProfile } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔥 SEGURANÇA PROFISSIONAL: Trava baseada exclusivamente no Role do banco de dados
  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    async function fetchUsuarios() {
      if (!isAdmin) return;
      try {
        const q = query(collection(db, 'usuarios'));
        const snap = await getDocs(q);
        
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

  // 🔥 FUNÇÃO ADICIONADA: Zera a notificação dos novos usuários
  async function handleMarcarTodosVistos() {
    try {
      const batch = writeBatch(db);
      const novos = usuarios.filter(u => u.vistoPeloAdmin === false);
      
      novos.forEach(u => {
        const ref = doc(db, 'usuarios', u.id);
        batch.update(ref, { vistoPeloAdmin: true });
      });

      await batch.commit();

      setUsuarios(usuarios.map(u => 
        u.vistoPeloAdmin === false ? { ...u, vistoPeloAdmin: true } : u
      ));
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar notificações.");
    }
  }

  async function handleMudarCargo(id, cargoAtual) {
    const novoCargo = cargoAtual === 'admin' ? 'professor' : 'admin';
    if (!window.confirm(`Deseja alterar o acesso deste usuário para ${novoCargo.toUpperCase()}?`)) return;

    try {
      await updateDoc(doc(db, 'usuarios', id), { role: novoCargo });
      setUsuarios(usuarios.map(u => u.id === id ? { ...u, role: novoCargo } : u));
    } catch (e) { alert("Erro ao mudar cargo."); }
  }

  async function handleMudarPlano(id, novoPlano) {
    try {
      await updateDoc(doc(db, 'usuarios', id), { plano: novoPlano });
      setUsuarios(usuarios.map(u => u.id === id ? { ...u, plano: novoPlano } : u));
    } catch (e) { alert("Erro ao mudar plano."); }
  }

  const criarLog = (acaoDetalhe) => ({
    dataOperacao: new Date().toISOString(),
    acao: acaoDetalhe,
    responsavel: currentUser.email
  });

  async function estenderAssinatura(id, diasAdicionais) {
    try {
      const userData = usuarios.find(u => u.id === id);
      let dataBase = new Date(); 

      if (userData && userData.dataExpiracao) {
        const currentExp = userData.dataExpiracao.toDate ? userData.dataExpiracao.toDate() : new Date(userData.dataExpiracao.seconds ? userData.dataExpiracao.seconds * 1000 : userData.dataExpiracao);
        if (currentExp > dataBase) {
          dataBase = currentExp;
        }
      }

      const novaData = new Date(dataBase);
      novaData.setDate(novaData.getDate() + diasAdicionais);

      const logAuditoria = criarLog(`Adicionado +${diasAdicionais} dias`);

      await updateDoc(doc(db, 'usuarios', id), {
        dataExpiracao: novaData,
        isVitalicio: false,
        historicoAssinatura: arrayUnion(logAuditoria)
      });

      setUsuarios(usuarios.map(u => u.id === id ? { 
        ...u, 
        dataExpiracao: novaData, 
        isVitalicio: false,
        historicoAssinatura: [...(u.historicoAssinatura || []), logAuditoria]
      } : u));

      alert(`Assinatura estendida por ${diasAdicionais} dias!`);
    } catch (error) {
      alert("Erro ao estender assinatura.");
      console.error(error);
    }
  }

  async function editarDataManual(id, dataAtualStr) {
    const input = window.prompt("Digite a nova data exata de vencimento (Formato: DD/MM/AAAA):", dataAtualStr);
    if (!input) return;

    const [dia, mes, ano] = input.split('/');
    if (!dia || !mes || !ano || ano.length !== 4) {
      return alert("Formato inválido. Por favor, use DD/MM/AAAA.");
    }

    const novaData = new Date(ano, mes - 1, dia, 23, 59, 59);

    if (isNaN(novaData.getTime())) {
      return alert("Data inválida. Tente novamente.");
    }

    try {
      const logAuditoria = criarLog(`Data alterada manualmente para ${input}`);

      await updateDoc(doc(db, 'usuarios', id), {
        dataExpiracao: novaData,
        isVitalicio: false,
        historicoAssinatura: arrayUnion(logAuditoria)
      });

      setUsuarios(usuarios.map(u => u.id === id ? { 
        ...u, 
        dataExpiracao: novaData, 
        isVitalicio: false,
        historicoAssinatura: [...(u.historicoAssinatura || []), logAuditoria]
      } : u));

      alert("Data de vencimento ajustada com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao editar data.");
    }
  }

  async function handleToggleVitalicio(user) {
    const isAtualVitalicio = user.isVitalicio === true;
    const acaoTexto = isAtualVitalicio ? "REVOGAR" : "conceder acesso permanente e";
    
    if (!window.confirm(`Deseja ${acaoTexto} vitalício a este cliente?`)) return;

    try {
      const logMsg = isAtualVitalicio ? "Acesso Vitalício REVOGADO" : "Acesso Vitalício concedido";
      const logAuditoria = criarLog(logMsg);
      const hoje = new Date();

      await updateDoc(doc(db, 'usuarios', user.id), { 
        isVitalicio: !isAtualVitalicio,
        dataExpiracao: isAtualVitalicio ? hoje : user.dataExpiracao || hoje,
        historicoAssinatura: arrayUnion(logAuditoria)
      });

      setUsuarios(usuarios.map(u => u.id === user.id ? { 
        ...u, 
        isVitalicio: !isAtualVitalicio,
        dataExpiracao: isAtualVitalicio ? hoje : u.dataExpiracao || hoje,
        historicoAssinatura: [...(u.historicoAssinatura || []), logAuditoria]
      } : u));

      alert(`Acesso Vitalício ${isAtualVitalicio ? 'revogado' : 'concedido'} com sucesso!`);
    } catch (error) {
      alert("Erro ao alterar acesso vitalício.");
      console.error(error);
    }
  }

  function exibirHistorico(user) {
    if (!user.historicoAssinatura || user.historicoAssinatura.length === 0) {
      return alert("Nenhum histórico financeiro encontrado para este cliente.");
    }
    
    const textoHistorico = user.historicoAssinatura.map((log, index) => {
      const dataLog = new Date(log.dataOperacao).toLocaleString('pt-BR');
      return `${index + 1}. [${dataLog}]\nAção: ${log.acao}\nPor: ${log.responsavel}\n`;
    }).join('\n');

    alert(`HISTÓRICO DE ASSINATURA: ${user.nome || user.email}\n\n${textoHistorico}`);
  }

  async function handleAlternarBloqueio(user) {
    const isAtualmenteBloqueado = user.status === 'bloqueado';
    const acao = isAtualmenteBloqueado ? 'reativar' : 'bloquear';
    
    if (!window.confirm(`Deseja ${acao.toUpperCase()} o acesso do usuário ${user.nome || user.email}?`)) return;

    try {
      const novoStatus = isAtualmenteBloqueado ? 'ativo' : 'bloqueado';
      const logAuditoria = criarLog(`Acesso alterado manualmente para ${novoStatus.toUpperCase()}`);

      await updateDoc(doc(db, 'usuarios', user.id), {
        status: novoStatus,
        historicoAssinatura: arrayUnion(logAuditoria)
      });

      setUsuarios(usuarios.map(u => u.id === user.id ? { 
        ...u, 
        status: novoStatus,
        historicoAssinatura: [...(u.historicoAssinatura || []), logAuditoria]
      } : u));

      alert(`Usuário ${novoStatus} com sucesso!`);
    } catch (error) {
      console.error(error);
      alert("Erro ao alterar o status do usuário.");
    }
  }

  async function handleExcluirUsuario(user) {
    const confirmacao = window.confirm(
      `CUIDADO EXTREMO!\n\nVocê está prestes a fazer um HARD DELETE na conta de:\n"${user.nome || user.email}".\n\nIsso irá APAGAR DE VEZ:\n- O Perfil do Usuário\n- Todas as Instituições\n- Todas as Turmas\n- Todos os Alunos\n- Todas as Tarefas e Respostas que este e-mail criou.\n\nEssa ação é irreversível e feita apenas para testes. Deseja DESTRUIR todos os dados deste usuário?`
    );

    if (!confirmacao) return;

    try {
      const uidParaApagar = user.id; 
      const batch = writeBatch(db);

      const ativSnap = await getDocs(query(collection(db, 'atividades'), where('professorUid', '==', uidParaApagar)));
      ativSnap.forEach(doc => batch.delete(doc.ref));

      const tarefasSnap = await getDocs(query(collection(db, 'tarefas'), where('professorUid', '==', uidParaApagar)));
      tarefasSnap.forEach(doc => batch.delete(doc.ref));

      const alunosSnap = await getDocs(query(collection(db, 'alunos'), where('professorUid', '==', uidParaApagar)));
      alunosSnap.forEach(doc => batch.delete(doc.ref));

      const turmasSnap = await getDocs(query(collection(db, 'turmas'), where('professorUid', '==', uidParaApagar)));
      turmasSnap.forEach(doc => batch.delete(doc.ref));

      const instSnap = await getDocs(query(collection(db, 'instituicoes'), where('professorUid', '==', uidParaApagar)));
      instSnap.forEach(doc => batch.delete(doc.ref));

      batch.delete(doc(db, 'usuarios', uidParaApagar));
      await batch.commit();

      setUsuarios(usuarios.filter(u => u.id !== uidParaApagar));
      alert("Operação concluída. O histórico inteiro do professor foi pulverizado do banco de dados.");

    } catch (e) { 
      alert("Erro ao tentar executar o Hard Delete. Veja o console.");
      console.error(e);
    }
  }

  if (!isAdmin) return <Navigate to="/" />;

  if (loading) return <div className="p-20 text-center font-black text-slate-400 animate-pulse">Carregando usuários...</div>;

  const qtdNovos = usuarios.filter(u => u.vistoPeloAdmin === false).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Painel SaaS' }]} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 text-yellow-400 p-4 rounded-3xl shadow-xl">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Painel SaaS (CEO)</h1>
            <p className="text-slate-500 font-medium">Gestão de assinaturas, acessos e faturamento.</p>
          </div>
        </div>

        {/* 🔥 BOTÃO PARA ZERAR NOTIFICAÇÕES */}
        {qtdNovos > 0 && (
          <button 
            onClick={handleMarcarTodosVistos}
            className="flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white px-5 py-2.5 rounded-xl text-sm font-black transition-all shadow-sm w-full md:w-auto"
          >
            <Bell size={18} />
            Marcar {qtdNovos} como lido{qtdNovos > 1 ? 's' : ''}
          </button>
        )}
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
        {/* A Mágica de Responsividade acontece aqui na Tabela */}
        <div className="overflow-hidden md:overflow-x-auto">
          <table className="w-full text-left border-collapse flex flex-col md:table">
            <thead className="hidden md:table-header-group">
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-6 text-sm font-black text-slate-800 uppercase tracking-widest">Professor / Usuário</th>
                <th className="p-6 text-sm font-black text-slate-800 uppercase tracking-widest">Nível de Acesso</th>
                <th className="p-6 text-sm font-black text-slate-800 uppercase tracking-widest">Plano de Assinatura</th>
                <th className="p-6 text-sm font-black text-slate-800 uppercase tracking-widest">Assinatura (SaaS)</th>
                <th className="p-6 text-sm font-black text-slate-800 uppercase tracking-widest text-right">Gestão e Bloqueio</th>
              </tr>
            </thead>
            <tbody className="flex flex-col md:table-row-group divide-y-[8px] md:divide-y md:divide-y-[1px] divide-slate-100 md:divide-slate-50">
              {usuarios.map(user => {
                
                let statusVisual = "Ativo";
                let corStatus = "text-green-700 bg-green-100";
                let textoValidade = "";
                let textoDiasRestantes = null; 
                let dataApenasString = "";

                if (user.status === 'bloqueado') {
                  statusVisual = "Bloqueado Manualmente";
                  corStatus = "text-red-700 bg-red-100";
                  textoValidade = "Acesso suspenso.";
                } else if (user.isVitalicio) {
                  statusVisual = "Vitalício";
                  corStatus = "text-purple-700 bg-purple-100";
                  textoValidade = "Sem data de expiração";
                } else if (user.dataExpiracao) {
                  const dataVencimento = user.dataExpiracao.toDate 
                    ? user.dataExpiracao.toDate() 
                    : new Date(user.dataExpiracao.seconds ? user.dataExpiracao.seconds * 1000 : user.dataExpiracao);
                  
                  const hoje = new Date();
                  dataApenasString = dataVencimento.toLocaleDateString('pt-BR');
                  textoValidade = `Vence em: ${dataApenasString}`;
                  
                  const diffTime = dataVencimento - hoje;
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                  if (diffDays < 0) {
                    statusVisual = "Vencido";
                    corStatus = "text-red-700 bg-red-100";
                    textoDiasRestantes = `Vencido há ${Math.abs(diffDays)} dias`;
                  } else {
                    textoDiasRestantes = `Restam ${diffDays} dias`;
                    if (diffDays <= 5) {
                      statusVisual = "Vence em breve";
                      corStatus = "text-orange-700 bg-orange-100";
                    }
                  }
                } else {
                   statusVisual = "Sem Trial";
                   corStatus = "text-gray-700 bg-gray-100";
                   textoValidade = "Data não definida";
                }

                return (
                  <tr key={user.id} className={`flex flex-col md:table-row hover:bg-slate-50/50 transition-colors group p-4 md:p-0 ${user.status === 'bloqueado' ? 'opacity-70' : ''}`}>
                    
                    <td className="p-2 md:p-6 flex flex-col md:table-cell border-b border-slate-100 md:border-none mb-4 md:mb-0 pb-4 md:pb-0 last:border-0 last:mb-0 last:pb-0">
                      <span className="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Professor / Usuário</span>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${user.role === 'admin' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                          {user.role === 'admin' ? <Crown size={22}/> : <User size={22}/>}
                        </div>
                        <div className="min-w-0 flex-1">
                          
                          {/* 🔥 SELO VISUAL DE NOVO USUÁRIO ADICIONADO AQUI */}
                          <div className="flex items-center gap-2">
                            <p className="font-black text-slate-900 text-lg leading-tight truncate">{user.nome || 'Sem Nome'}</p>
                            {user.vistoPeloAdmin === false && (
                              <span className="bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full animate-pulse shrink-0">Novo</span>
                            )}
                          </div>
                          
                          <p className="text-sm text-slate-400 font-medium flex items-center gap-1 break-all md:break-normal mt-0.5"><Mail size={12} className="shrink-0"/> {user.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-2 md:p-6 flex flex-col md:table-cell border-b border-slate-100 md:border-none mb-4 md:mb-0 pb-4 md:pb-0 last:border-0 last:mb-0 last:pb-0">
                      <span className="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Nível de Acesso</span>
                      <div>
                        <button 
                          onClick={() => handleMudarCargo(user.id, user.role)}
                          disabled={user.status === 'bloqueado'}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                            user.role === 'admin' 
                              ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' 
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                          } ${user.status === 'bloqueado' && 'cursor-not-allowed opacity-50'}`}
                        >
                          {user.role === 'admin' ? <><Crown size={14}/> Super Admin</> : <><UserCog size={14}/> Professor</>}
                        </button>
                      </div>
                    </td>

                    <td className="p-2 md:p-6 flex flex-col md:table-cell border-b border-slate-100 md:border-none mb-4 md:mb-0 pb-4 md:pb-0 last:border-0 last:mb-0 last:pb-0">
                      <span className="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Plano de Assinatura</span>
                      <div className="relative inline-block w-full md:w-auto">
                        <Zap className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${user.plano === 'premium' ? 'text-yellow-500' : 'text-slate-300'}`} size={16} />
                        <select 
                          value={user.plano || 'basico'} 
                          disabled={user.status === 'bloqueado'}
                          onChange={(e) => handleMudarPlano(user.id, e.target.value)}
                          className={`w-full md:w-auto bg-slate-50 border-2 border-slate-100 text-slate-700 text-sm rounded-xl py-2.5 pl-10 pr-4 font-black outline-none focus:border-blue-500 appearance-none shadow-sm min-w-[200px] ${user.status === 'bloqueado' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        >
                          <option value="trial">Trial de 30 Dias</option>
                          <option value="basico">Tier 1: Básico</option>
                          <option value="intermediario">Tier 2: Intermediário</option>
                          <option value="premium">Tier 3: Premium (IA)</option>
                        </select>
                      </div>
                    </td>

                    <td className="p-2 md:p-6 flex flex-col md:table-cell border-b border-slate-100 md:border-none mb-4 md:mb-0 pb-4 md:pb-0 last:border-0 last:mb-0 last:pb-0">
                      <span className="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Assinatura (SaaS)</span>
                      <div className="flex flex-col items-start gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider ${corStatus}`}>
                            {statusVisual}
                          </span>
                          <button onClick={() => exibirHistorico(user)} className="text-slate-400 hover:text-blue-600 transition-colors" title="Ver Histórico de Assinatura">
                            <History size={16} />
                          </button>
                        </div>
                        
                        <div className="flex flex-col items-start">
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-slate-500 font-medium">{textoValidade}</p>
                            {!user.isVitalicio && (
                              <button onClick={() => editarDataManual(user.id, dataApenasString)} className="text-slate-300 hover:text-blue-600 transition-colors" title="Editar Data Manualmente">
                                <Edit3 size={14} />
                              </button>
                            )}
                          </div>
                          {textoDiasRestantes && (
                            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${textoDiasRestantes.includes('Vencido') ? 'text-red-500' : 'text-orange-500'}`}>
                              {textoDiasRestantes}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <button onClick={() => estenderAssinatura(user.id, 30)} className="flex items-center gap-1 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-[11px] font-bold py-1.5 px-2 rounded-lg shadow-sm transition-colors" title="Adicionar 1 Mês">
                            <CalendarPlus size={14} /> +30d
                          </button>
                          <button onClick={() => estenderAssinatura(user.id, 365)} className="flex items-center gap-1 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-[11px] font-bold py-1.5 px-2 rounded-lg shadow-sm transition-colors" title="Adicionar 1 Ano">
                            <CalendarPlus size={14} /> +1a
                          </button>
                          
                          <button 
                            onClick={() => handleToggleVitalicio(user)} 
                            className={`flex items-center gap-1 text-[11px] font-bold py-1.5 px-2 rounded-lg shadow-sm transition-colors ${
                              user.isVitalicio 
                                ? 'bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100' 
                                : 'bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100'
                            }`} 
                            title={user.isVitalicio ? "Revogar Acesso Permanente" : "Tornar Vitalício"}
                          >
                            {user.isVitalicio ? <><XCircle size={14} /> Revogar</> : <><Infinity size={14} /> Vitalício</>}
                          </button>
                        </div>
                      </div>
                    </td>

                    <td className="p-2 md:p-6 flex flex-col md:table-cell last:border-0 last:mb-0 last:pb-0">
                      <span className="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Gestão e Bloqueio</span>
                      <div className="flex flex-col md:items-end gap-2 w-full">
                        
                        <button 
                          onClick={() => handleAlternarBloqueio(user)} 
                          className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm w-full md:w-auto justify-center border ${
                            user.status === 'bloqueado' 
                              ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-600 hover:text-white' 
                              : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-600 hover:text-white'
                          }`}
                          title={user.status === 'bloqueado' ? "Liberar Acesso do Usuário" : "Bloquear Acesso do Usuário"}
                        >
                          {user.status === 'bloqueado' ? <><UserCheck size={14}/> Reativar</> : <><Ban size={14}/> Suspender</>}
                        </button>

                        <button 
                          onClick={() => handleExcluirUsuario(user)} 
                          className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm w-full md:w-auto justify-center" 
                          title="Vaporizar Todos os Dados do Banco"
                        >
                          <Trash2 size={14} /> Excluir Dados
                        </button>
                        
                      </div>
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
