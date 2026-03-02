import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore'; // REMOVIDO onSnapshot, ADD getDocs
import { db } from '../services/firebase';
import { ArrowLeft, Megaphone, Copy, CheckCircle2, MessageCircle, Mail, Send, AlertCircle, Users, User } from 'lucide-react';
import { cronogramaAssincrono, cronogramaSincrono, getStatusData, getDiasRestantes } from '../data/cronogramaData';

// ==========================================
// 📖 DICIONÁRIO DE CONTATOS (WHATSAPP)
// ==========================================
const gerarTextoDinamicoPrazo = (diasRestantes, nomeModulo) => {
  if (diasRestantes >= 20) {
    return `Olá! 🌟 Passando para avisar que o ${nomeModulo} já está em andamento. Faltam ${diasRestantes} dias para o encerramento, então temos um bom tempo. Quem já quiser ir adiantando as atividades, desejo excelentes estudos!`;
  }
  if (diasRestantes >= 8) {
    return `Olá, pessoal! Nosso lembrete de acompanhamento sobre o ${nomeModulo}. O cronograma está avançando e entramos na fase intermediária da nossa atividade. Faltam ${diasRestantes} dias para o encerramento. Vamos aproveitar os próximos dias para colocar tudo em dia!`;
  }
  if (diasRestantes >= 1) {
    return `Olá, colegas! 🚨 Passando para alertar que entramos na reta final do ${nomeModulo}. Faltam apenas ${diasRestantes} dias para o encerramento! Solicitamos a regularização das tarefas pendentes o quanto antes para que ninguém fique prejudicado na nota oficial.`;
  }
  return `Olá! O prazo oficial para as atividades do ${nomeModulo} foi encerrado. Notei pendências no sistema. Por favor, regularize a sua entrega imediatamente para evitarmos problemas com a aprovação. Fico no aguardo.`;
};

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
  const [abaAtiva, setAbaAtiva] = useState('assincrono');
  const [alunosAtivos, setAlunosAtivos] = useState([]);
  const [pendenciasAgrupadas, setPendenciasAgrupadas] = useState({ assincrono: [], sincrono: [] });
  const [copiado, setCopiado] = useState(null);
  const [loading, setLoading] = useState(true); // NOVO: Estado de carregamento

  const moduloAtual = cronogramaAssincrono.find(m => getStatusData(m.inicio, m.fim) === 'atual');
  const semanaAtual = cronogramaSincrono.find(s => getStatusData(s.inicio, s.fim) === 'atual');

  useEffect(() => {
    async function fetchComunicacao() {
      setLoading(true);

      try {
        // 1. Busca os Alunos (Leitura Única)
        const alunosSnap = await getDocs(collection(db, 'alunos'));
        const alunosLista = alunosSnap.docs.map(d => d.data().nome);
        setAlunosAtivos(alunosLista);

        if (alunosLista.length === 0) {
          setLoading(false);
          return;
        }

        // 2. Busca as Atividades Entregues (Leitura Única)
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - 90);
        const qAtividades = query(collection(db, 'atividades'), where('dataCriacao', '>=', dataLimite));
        const ativSnap = await getDocs(qAtividades);
        const docs = ativSnap.docs.map(doc => doc.data());

        const entregas = new Set(docs.map(a => `${a.aluno}-${a.modulo}-${a.tarefa}`));
        let resultadoAssincrono = [];
        let resultadoSincrono = [];

        const alunosOrdenados = [...alunosLista].sort((a, b) => a.localeCompare(b));

        // --- BUSCA ASSÍNCRONA ---
        if (moduloAtual) {
          const nomeExatoMod = moduloAtual.modulo;
          // A CIRURGIA: Puxa as tarefas direto do Cronograma, não das entregas!
          const tarefasDoModulo = moduloAtual.tarefas || []; 

          const mapaAsync = {};
          alunosOrdenados.forEach(aluno => {
            const tarefasDevendo = [];
            tarefasDoModulo.forEach(tar => {
              if (!entregas.has(`${aluno}-${nomeExatoMod}-${tar}`)) {
                tarefasDevendo.push(tar);
              }
            });
            
            if (tarefasDevendo.length > 0) {
              tarefasDevendo.sort(); 
              const chaveCombinacao = tarefasDevendo.join('|');
              
              if (!mapaAsync[chaveCombinacao]) {
                mapaAsync[chaveCombinacao] = { modulo: nomeExatoMod, tarefas: tarefasDevendo, devedores: [] };
              }
              mapaAsync[chaveCombinacao].devedores.push(aluno);
            }
          });
          resultadoAssincrono = Object.values(mapaAsync);
        }

        // --- BUSCA SÍNCRONA ---
        if (semanaAtual) {
          const nomeSemanaOficial = `Semana ${semanaAtual.semana}`;
          // A CIRURGIA: Puxa os temas direto do Cronograma Síncrono
          const tarefasPossiveis = [];
          if (semanaAtual.tema1) tarefasPossiveis.push(semanaAtual.tema1);
          if (semanaAtual.tema2) tarefasPossiveis.push(semanaAtual.tema2);

          const mapaSync = {};
          alunosOrdenados.forEach(aluno => {
            const tarefasDevendo = [];
            tarefasPossiveis.forEach(tar => {
              if (!entregas.has(`${aluno}-${nomeSemanaOficial}-${tar}`)) {
                tarefasDevendo.push(tar);
              }
            });
            
            if (tarefasDevendo.length > 0) {
              tarefasDevendo.sort();
              const chaveCombinacao = tarefasDevendo.join('|');
              
              if (!mapaSync[chaveCombinacao]) {
                mapaSync[chaveCombinacao] = { modulo: nomeSemanaOficial, tarefas: tarefasDevendo, devedores: [] };
              }
              mapaSync[chaveCombinacao].devedores.push(aluno);
            }
          });
          resultadoSincrono = Object.values(mapaSync);
        }

        setPendenciasAgrupadas({ assincrono: resultadoAssincrono, sincrono: resultadoSincrono });

      } catch (error) {
        console.error("Erro ao buscar dados de comunicação:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchComunicacao();
  }, []); // Trava do useEffect para rodar só uma vez

  const formatarListaTarefas = (lista) => {
    if (lista.length === 1) return lista[0];
    if (lista.length === 2) return `${lista[0]} e ${lista[1]}`;
    return lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1];
  };

  const removerAcentos = (texto) => {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const handleCopiar = (texto, id) => {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  };

  const handleEnviarWhatsAppGeral = (texto) => {
    navigator.clipboard.writeText(texto);
    setCopiado('geral');
    setTimeout(() => setCopiado(null), 2000);
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const handleEnviarWhatsAppIndividual = (texto, nomeAluno, idCopia) => {
    navigator.clipboard.writeText(texto);
    setCopiado(idCopia);
    setTimeout(() => setCopiado(null), 2000);

    const nomeLimpo = removerAcentos(nomeAluno.toLowerCase());
    const chavesOrdenadas = Object.keys(contatosWhatsApp).sort((a, b) => b.length - a.length);
    
    const chaveEncontrada = chavesOrdenadas.find(chave => 
      nomeLimpo.includes(removerAcentos(chave.toLowerCase()))
    );
    
    const numero = chaveEncontrada ? contatosWhatsApp[chaveEncontrada] : "";
    const textoCodificado = encodeURIComponent(texto);
    
    const url = numero 
      ? `https://wa.me/${numero}?text=${textoCodificado}` 
      : `https://wa.me/?text=${textoCodificado}`;
      
    window.open(url, '_blank');
  };

  const gerarMensagemGeral = (itemAtivo, diasRestantes, tipo) => {
    if (!itemAtivo) return "Não há atividades oficiais em andamento neste momento.";
    const nome = tipo === 'assincrono' ? itemAtivo.modulo : `Semana ${itemAtivo.semana}`;
    return gerarTextoDinamicoPrazo(diasRestantes, nome);
  };

  const pendenciasAtuais = pendenciasAgrupadas[abaAtiva] || [];
  const multiplas = pendenciasAtuais.filter(p => p.tarefas.length > 1);
  const unicas = pendenciasAtuais.filter(p => p.tarefas.length === 1);

  const listaIndividualZap = [];
  pendenciasAtuais.forEach(grupo => {
    grupo.devedores.forEach(aluno => {
      listaIndividualZap.push({ aluno, tarefas: grupo.tarefas, modulo: grupo.modulo });
    });
  });
  listaIndividualZap.sort((a, b) => a.aluno.localeCompare(b.aluno));

  const itemAtivo = abaAtiva === 'assincrono' ? moduloAtual : semanaAtual;
  const diasRestantes = itemAtivo ? getDiasRestantes(itemAtivo.fim) : 0;
  const msgGeral = gerarMensagemGeral(itemAtivo, diasRestantes, abaAtiva);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-green-600 transition-colors"><ArrowLeft size={24} /></Link>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Megaphone className="text-green-600" /> Central de Comunicação
          </h2>
        </div>

        <div className="flex gap-2 mb-8 bg-gray-200/50 p-1.5 rounded-2xl">
          <button onClick={() => setAbaAtiva('assincrono')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all ${abaAtiva === 'assincrono' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
             ASSÍNCRONO
          </button>
          <button onClick={() => setAbaAtiva('sincrono')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all ${abaAtiva === 'sincrono' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
             SÍNCRONO
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-green-600 font-bold">
            Carregando mensagens de comunicação...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-4">
              
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-200">
                
                <div>
                  <h3 className="text-lg font-black text-green-900 mb-2 flex items-center gap-2">
                    <MessageCircle size={20} className="text-green-600"/> Grupo da Turma
                  </h3>
                  <p className="text-xs text-gray-600 mb-4">Mensagem geral gerada automaticamente com os prazos oficiais.</p>
                  
                  <div className="bg-green-50 p-3 rounded-xl text-xs text-gray-800 font-medium whitespace-pre-wrap border border-green-100 mb-3 shadow-inner">
                    {msgGeral}
                  </div>

                  <button 
                    onClick={() => handleEnviarWhatsAppGeral(msgGeral)}
                    disabled={!itemAtivo}
                    className="w-full bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors flex justify-center items-center gap-2 shadow-sm disabled:opacity-50 text-sm"
                  >
                    {copiado === 'geral' ? <><CheckCircle2 size={16}/> Abrindo WhatsApp...</> : <><Send size={16}/> Enviar para o Grupo</>}
                  </button>
                </div>

                <hr className="my-6 border-green-100" />

                <div>
                  <h3 className="text-lg font-black text-green-900 mb-2 flex items-center gap-2">
                    <User size={20} className="text-green-600"/> Cobrança Direta
                  </h3>
                  <p className="text-xs text-gray-600 mb-4">Envie mensagens privadas personalizadas para o WhatsApp de cada aluno.</p>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                    {listaIndividualZap.length === 0 ? (
                      <div className="text-center py-6 text-green-600 font-bold bg-green-50 rounded-xl text-sm">
                        Nenhuma pendência ativa.
                      </div>
                    ) : (
                      listaIndividualZap.map((pend, idx) => {
                        const tarefasTexto = formatarListaTarefas(pend.tarefas);
                        const idCopia = `zap-${idx}`;
                        
                        const msgIndZap = gerarTextoDinamicoPrazo(diasRestantes, pend.modulo);

                        return (
                          <div key={idx} className="bg-white border border-green-100 p-3 rounded-xl hover:border-green-300 transition-colors shadow-sm flex flex-col gap-2">
                            <div>
                              <span className="font-bold text-gray-900 text-sm block leading-tight">{pend.aluno}</span>
                              <span className="text-[10px] text-gray-500 line-clamp-1">Deve: {tarefasTexto}</span>
                            </div>
                            <button 
                              onClick={() => handleEnviarWhatsAppIndividual(msgIndZap, pend.aluno, idCopia)}
                              className={`w-full py-1.5 rounded-lg text-xs font-bold flex justify-center items-center gap-1.5 transition-colors ${copiado === idCopia ? 'bg-green-100 text-green-700' : 'bg-green-50 text-green-700 hover:bg-green-600 hover:text-white'}`}
                            >
                              {copiado === idCopia ? <CheckCircle2 size={14}/> : <Send size={14}/>} 
                              {copiado === idCopia ? 'Enviando...' : 'Enviar Zap'}
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
                  <Users size={20} className="text-blue-600"/> Envio em Lote (Plataforma do Governo)
                </h3>
                <p className="text-sm text-gray-600 mb-6">Alunos agrupados por tarefas pendentes (em ordem alfabética). Copie a mensagem neutra uma única vez e envie para todos do grupo.</p>

                {!itemAtivo ? (
                  <div className="text-center py-10 text-gray-500 font-bold bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    Nenhum módulo ativo no momento.
                  </div>
                ) : pendenciasAtuais.length === 0 ? (
                  <div className="text-center py-10 text-blue-600 font-bold bg-blue-50 rounded-xl border border-blue-200">
                    Uau! Todos os alunos já entregaram as atividades atuais.
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
                            
                            const msgLote = gerarTextoDinamicoPrazo(diasRestantes, grupo.modulo);
                            
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
                                  
                                  <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 italic">"{msgLote}"</p>
                                </div>
                                <button 
                                  onClick={() => handleCopiar(msgLote, idCopia)}
                                  className={`shrink-0 self-start md:self-center px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${copiado === idCopia ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'}`}
                                >
                                  {copiado === idCopia ? <CheckCircle2 size={18}/> : <Copy size={18}/>} 
                                  {copiado === idCopia ? 'Copiado!' : 'Copiar Texto Padrão'}
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
                            
                            const msgLote = gerarTextoDinamicoPrazo(diasRestantes, grupo.modulo);
                            
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

                                  <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 italic">"{msgLote}"</p>
                                </div>
                                <button 
                                  onClick={() => handleCopiar(msgLote, idCopia)}
                                  className={`shrink-0 self-start md:self-center px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${copiado === idCopia ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100'}`}
                                >
                                  {copiado === idCopia ? <CheckCircle2 size={18}/> : <Copy size={18}/>} 
                                  {copiado === idCopia ? 'Copiado!' : 'Copiar Texto Padrão'}
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
