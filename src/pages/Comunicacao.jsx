import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../services/firebase';
import { ArrowLeft, Megaphone, Copy, CheckCircle2, MessageCircle, Send, AlertCircle, Users, User, ChevronDown } from 'lucide-react';

// ==========================================
// 📖 DICIONÁRIO DE CONTATOS (WHATSAPP)
// ==========================================
const contatosWhatsApp = {
  "Guilherme": "556291203480",
  "Antônio Gabriel": "556499622132",
  "Ester": "556283103511",
  "Élida": "5511976727059",
  "Elienne": "556194345290",
  "Fellipy": "556499011276",
  "Hellen": "556299863592",
  "Anny": "556492553737",
  "Handel": "556281305502",
  "Beatriz": "556192263929",
  "Gabriel": "556183539993"
};

export default function Comunicacao() {
  const [unidadesAtivas, setUnidadesAtivas] = useState([]);
  const [unidadeSelecionadaId, setUnidadeSelecionadaId] = useState('');
  
  const [alunosAtivos, setAlunosAtivos] = useState([]);
  const [pendenciasDaUnidade, setPendenciasDaUnidade] = useState([]);
  const [copiado, setCopiado] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchComunicacao() {
      setLoading(true);
      try {
        // 1. Busca os Alunos
        const alunosSnap = await getDocs(collection(db, 'alunos'));
        const alunosLista = alunosSnap.docs.map(d => d.data().nome);
        setAlunosAtivos(alunosLista);

        if (alunosLista.length === 0) return;

        // 2. Busca as Unidades Ativas no Banco (NOVA ARQUITETURA)
        const modulosSnap = await getDocs(collection(db, 'modulos'));
        const modulosDB = modulosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const ativas = modulosDB
          .filter(mod => mod.status !== 'arquivado')
          .sort((a, b) => {
            const timeA = a.dataCriacao?.toMillis ? a.dataCriacao.toMillis() : 0;
            const timeB = b.dataCriacao?.toMillis ? b.dataCriacao.toMillis() : 0;
            return timeB - timeA; 
          });

        setUnidadesAtivas(ativas);
        if (ativas.length > 0) {
          setUnidadeSelecionadaId(ativas[0].id); // Seleciona a mais recente por padrão
        }

      } catch (error) {
        console.error("Erro ao buscar dados de comunicação:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchComunicacao();
  }, []);

  // Recalcula as pendências sempre que mudar a unidade selecionada
  useEffect(() => {
    async function calcularPendencias() {
      if (!unidadeSelecionadaId || alunosAtivos.length === 0) return;
      
      const unidadeAtual = unidadesAtivas.find(u => u.id === unidadeSelecionadaId);
      if (!unidadeAtual || !unidadeAtual.tarefas || unidadeAtual.tarefas.length === 0) {
        setPendenciasDaUnidade([]);
        return;
      }

      setLoading(true);
      try {
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - 90);
        const qAtividades = query(collection(db, 'atividades'), where('dataCriacao', '>=', dataLimite));
        const ativSnap = await getDocs(qAtividades);
        const docs = ativSnap.docs.map(doc => doc.data());
        const entregas = new Set(docs.map(a => `${a.aluno}-${a.modulo}-${a.tarefa}`));

        const mapaDevedores = {};
        const alunosOrdenados = [...alunosAtivos].sort((a, b) => a.localeCompare(b));

        alunosOrdenados.forEach(aluno => {
          const tarefasDevendo = [];
          unidadeAtual.tarefas.forEach(tar => {
            if (!entregas.has(`${aluno}-${unidadeAtual.nome}-${tar}`)) {
              tarefasDevendo.push(tar);
            }
          });
          
          if (tarefasDevendo.length > 0) {
            tarefasDevendo.sort(); 
            const chaveCombinacao = tarefasDevendo.join('|');
            
            if (!mapaDevedores[chaveCombinacao]) {
              mapaDevedores[chaveCombinacao] = { modulo: unidadeAtual.nome, tarefas: tarefasDevendo, devedores: [] };
            }
            mapaDevedores[chaveCombinacao].devedores.push(aluno);
          }
        });

        setPendenciasDaUnidade(Object.values(mapaDevedores));
      } catch (error) {
        console.error("Erro ao calcular pendências da unidade:", error);
      } finally {
        setLoading(false);
      }
    }
    calcularPendencias();
  }, [unidadeSelecionadaId, unidadesAtivas, alunosAtivos]);


  const formatarListaTarefas = (lista) => {
    if (lista.length === 1) return lista[0];
    if (lista.length === 2) return `${lista[0]} e ${lista[1]}`;
    return lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1];
  };

  const removerAcentos = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // LÓGICA DE FEEDBACK CONTEXTUAL (Avisos nos botões)
  const aplicarFeedback = (idCopia, acaoAposFeedback) => {
    setCopiado(idCopia);
    setTimeout(() => {
      setCopiado(null);
      if (acaoAposFeedback) acaoAposFeedback();
    }, 1500); // 1.5s de feedback visual antes da ação ou reset
  };

  const handleCopiar = (texto, id) => {
    navigator.clipboard.writeText(texto);
    aplicarFeedback(id);
  };

  const handleEnviarWhatsAppGeral = (texto) => {
    navigator.clipboard.writeText(texto);
    aplicarFeedback('geral', () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
    });
  };

  const handleEnviarWhatsAppIndividual = (texto, nomeAluno, idCopia) => {
    navigator.clipboard.writeText(texto);
    
    const nomeLimpo = removerAcentos(nomeAluno.toLowerCase());
    const chavesOrdenadas = Object.keys(contatosWhatsApp).sort((a, b) => b.length - a.length);
    const chaveEncontrada = chavesOrdenadas.find(chave => nomeLimpo.includes(removerAcentos(chave.toLowerCase())));
    const numero = chaveEncontrada ? contatosWhatsApp[chaveEncontrada] : "";
    const textoCodificado = encodeURIComponent(texto);
    const url = numero ? `https://wa.me/${numero}?text=${textoCodificado}` : `https://wa.me/?text=${textoCodificado}`;
      
    aplicarFeedback(idCopia, () => window.open(url, '_blank'));
  };

  // MENSAGEM GENÉRICA (Até definirmos como colocar o prazo final no banco)
  const gerarMensagem = (nomeUnidade) => {
    return `Olá! Passando para lembrar do nosso acompanhamento sobre o(a) ${nomeUnidade}. O cronograma está avançando! Solicitamos a regularização das tarefas pendentes o quanto antes para não acumular. Desejo excelentes estudos!`;
  };

  const unidadeAtualObj = unidadesAtivas.find(u => u.id === unidadeSelecionadaId);
  const msgPadrao = unidadeAtualObj ? gerarMensagem(unidadeAtualObj.nome) : '';

  const multiplas = pendenciasDaUnidade.filter(p => p.tarefas.length > 1);
  const unicas = pendenciasDaUnidade.filter(p => p.tarefas.length === 1);

  const listaIndividualZap = [];
  pendenciasDaUnidade.forEach(grupo => {
    grupo.devedores.forEach(aluno => {
      listaIndividualZap.push({ aluno, tarefas: grupo.tarefas, modulo: grupo.modulo });
    });
  });
  listaIndividualZap.sort((a, b) => a.aluno.localeCompare(b.aluno));

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-green-600 transition-colors"><ArrowLeft size={24} /></Link>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Megaphone className="text-green-600" /> Central de Comunicação
          </h2>
        </div>

        {/* NOVO SELETOR DE UNIDADE ATIVA */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-col md:flex-row items-center gap-4 justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Unidade em Foco</h3>
            <p className="text-xs text-gray-400">Selecione qual atividade deseja cobrar agora.</p>
          </div>
          <div className="relative w-full md:w-96">
            <select 
              className="w-full appearance-none bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-green-500 focus:border-green-500 block p-3 pr-10 font-bold"
              value={unidadeSelecionadaId}
              onChange={(e) => setUnidadeSelecionadaId(e.target.value)}
              disabled={unidadesAtivas.length === 0}
            >
              {unidadesAtivas.length === 0 ? (
                <option value="">Nenhuma unidade ativa</option>
              ) : (
                unidadesAtivas.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
              <ChevronDown size={18} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-green-600 font-bold animate-pulse">
            Carregando inteligência de comunicação...
          </div>
        ) : unidadesAtivas.length === 0 ? (
          <div className="text-center py-20 text-gray-500 font-bold bg-white rounded-2xl border border-dashed border-gray-200">
            Você não possui nenhuma unidade ativa no momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-200">
                
                <div>
                  <h3 className="text-lg font-black text-green-900 mb-2 flex items-center gap-2">
                    <MessageCircle size={20} className="text-green-600"/> Grupo da Turma
                  </h3>
                  <p className="text-xs text-gray-600 mb-4">Mensagem geral focada na unidade selecionada.</p>
                  
                  <div className="bg-green-50 p-3 rounded-xl text-xs text-gray-800 font-medium whitespace-pre-wrap border border-green-100 mb-3 shadow-inner">
                    {msgPadrao}
                  </div>

                  <button 
                    onClick={() => handleEnviarWhatsAppGeral(msgPadrao)}
                    className={`w-full font-bold py-2.5 rounded-xl transition-all flex justify-center items-center gap-2 shadow-sm text-sm ${copiado === 'geral' ? 'bg-green-200 text-green-900 scale-95' : 'bg-green-600 text-white hover:bg-green-700'}`}
                  >
                    {copiado === 'geral' ? <><CheckCircle2 size={16}/> Copiado! Abrindo...</> : <><Send size={16}/> Enviar para o Grupo</>}
                  </button>
                </div>

                <hr className="my-6 border-green-100" />

                <div>
                  <h3 className="text-lg font-black text-green-900 mb-2 flex items-center gap-2">
                    <User size={20} className="text-green-600"/> Cobrança Direta
                  </h3>
                  <p className="text-xs text-gray-600 mb-4">Envie mensagens privadas para o WhatsApp de cada aluno.</p>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                    {listaIndividualZap.length === 0 ? (
                      <div className="text-center py-6 text-green-600 font-bold bg-green-50 rounded-xl text-sm border border-green-100">
                        Ninguém devendo esta unidade! 🎉
                      </div>
                    ) : (
                      listaIndividualZap.map((pend, idx) => {
                        const tarefasTexto = formatarListaTarefas(pend.tarefas);
                        const idCopia = `zap-${idx}`;
                        
                        return (
                          <div key={idx} className="bg-white border border-green-100 p-3 rounded-xl hover:border-green-300 transition-colors shadow-sm flex flex-col gap-2">
                            <div>
                              <span className="font-bold text-gray-900 text-sm block leading-tight">{pend.aluno}</span>
                              <span className="text-[10px] text-gray-500 line-clamp-1">Deve: {tarefasTexto}</span>
                            </div>
                            <button 
                              onClick={() => handleEnviarWhatsAppIndividual(msgPadrao, pend.aluno, idCopia)}
                              className={`w-full py-1.5 rounded-lg text-xs font-bold flex justify-center items-center gap-1.5 transition-all ${copiado === idCopia ? 'bg-green-600 text-white scale-95' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                            >
                              {copiado === idCopia ? <><CheckCircle2 size={14}/> Abrindo...</> : <><Send size={14}/> Enviar Zap</>} 
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                  <Users size={20} className="text-blue-600"/> Envio em Lote (Plataforma)
                </h3>
                <p className="text-sm text-gray-600 mb-6">Alunos agrupados por pendências. Copie a mensagem e envie pela plataforma do governo.</p>

                {pendenciasDaUnidade.length === 0 ? (
                  <div className="text-center py-10 text-blue-600 font-bold bg-blue-50 rounded-xl border border-blue-200">
                    Uau! Todos os alunos já entregaram as tarefas desta unidade.
                  </div>
                ) : (
                  <div className="space-y-8">
                    
                    {multiplas.length > 0 && (
                      <div>
                        <h4 className="font-black text-red-800 mb-3 flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                          <AlertCircle size={18} className="text-red-500"/> Devem 2 ou mais tarefas
                        </h4>
                        <div className="grid gap-4">
                          {multiplas.map((grupo, i) => {
                            const idCopia = `multi-${i}`;
                            const tarefasTexto = formatarListaTarefas(grupo.tarefas);
                            
                            return (
                              <div key={i} className="flex flex-col md:flex-row gap-4 bg-white p-5 rounded-xl border-2 border-red-100 hover:border-red-300 transition-colors shadow-sm">
                                <div className="flex-1">
                                  <span className="text-xs font-black uppercase text-red-500 tracking-wider mb-2 block">
                                    Alunos que devem: {tarefasTexto}
                                  </span>
                                  
                                  <div className="flex flex-wrap gap-1.5 mb-3">
                                    {grupo.devedores.map((aluno, idx) => (
                                      <span key={idx} className="bg-red-50 border border-red-100 text-red-900 text-xs font-bold px-2.5 py-1.5 rounded-md">
                                        {aluno}
                                      </span>
                                    ))}
                                  </div>
                                  
                                  <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 italic">"{msgPadrao}"</p>
                                </div>
                                <button 
                                  onClick={() => handleCopiar(msgPadrao, idCopia)}
                                  className={`shrink-0 self-start md:self-center px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${copiado === idCopia ? 'bg-red-600 text-white scale-95 shadow-inner' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'}`}
                                >
                                  {copiado === idCopia ? <><CheckCircle2 size={18}/> Copiado!</> : <><Copy size={18}/> Copiar Texto Padrão</>} 
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {unicas.length > 0 && (
                      <div>
                        <h4 className="font-black text-yellow-800 mb-3 flex items-center gap-2 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-100">
                          <AlertCircle size={18} className="text-yellow-500"/> Devem 1 única tarefa
                        </h4>
                        <div className="grid gap-4">
                          {unicas.map((grupo, i) => {
                            const idCopia = `unica-${i}`;
                            const tarefasTexto = formatarListaTarefas(grupo.tarefas);
                            
                            return (
                              <div key={i} className="flex flex-col md:flex-row gap-4 bg-white p-5 rounded-xl border-2 border-yellow-100 hover:border-yellow-300 transition-colors shadow-sm">
                                <div className="flex-1">
                                  <span className="text-xs font-black uppercase text-yellow-600 tracking-wider mb-2 block">
                                    Alunos que devem: {tarefasTexto}
                                  </span>
                                  
                                  <div className="flex flex-wrap gap-1.5 mb-3">
                                    {grupo.devedores.map((aluno, idx) => (
                                      <span key={idx} className="bg-yellow-50 border border-yellow-100 text-yellow-900 text-xs font-bold px-2.5 py-1.5 rounded-md">
                                        {aluno}
                                      </span>
                                    ))}
                                  </div>

                                  <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 italic">"{msgPadrao}"</p>
                                </div>
                                <button 
                                  onClick={() => handleCopiar(msgPadrao, idCopia)}
                                  className={`shrink-0 self-start md:self-center px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${copiado === idCopia ? 'bg-yellow-500 text-white scale-95 shadow-inner' : 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100'}`}
                                >
                                  {copiado === idCopia ? <><CheckCircle2 size={18}/> Copiado!</> : <><Copy size={18}/> Copiar Texto Padrão</>} 
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
