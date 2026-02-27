import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Megaphone, Copy, CheckCircle2, MessageCircle, Mail, Send, AlertCircle } from 'lucide-react';
import { cronogramaAssincrono, cronogramaSincrono, getStatusData, getDiasRestantes } from '../data/cronogramaData';

export default function Comunicacao() {
  const [abaAtiva, setAbaAtiva] = useState('assincrono');
  const [alunosAtivos, setAlunosAtivos] = useState([]);
  const [pendenciasAgrupadas, setPendenciasAgrupadas] = useState({ assincrono: [], sincrono: [] });
  const [copiado, setCopiado] = useState(null);

  const moduloAtual = cronogramaAssincrono.find(m => getStatusData(m.inicio, m.fim) === 'atual');
  const semanaAtual = cronogramaSincrono.find(s => getStatusData(s.inicio, s.fim) === 'atual');

  useEffect(() => {
    const unsubAlunos = onSnapshot(collection(db, 'alunos'), (snap) => {
      setAlunosAtivos(snap.docs.map(d => d.data().nome));
    });

    const unsubAtividades = onSnapshot(collection(db, 'atividades'), (snap) => {
      const docs = snap.docs.map(doc => doc.data());
      
      if (alunosAtivos.length > 0) {
        const entregas = new Set(docs.map(a => `${a.aluno}-${a.modulo}-${a.tarefa}`));
        const resultadoAssincrono = [];
        const resultadoSincrono = [];

        // BUSCA INTELIGENTE AGRUPADA DO MÓDULO ASSÍNCRONO
        if (moduloAtual) {
          const numModuloOficial = moduloAtual.modulo.match(/\d+/)?.[0];
          const tarefasDoModulo = new Set();
          let nomeExatoMod = moduloAtual.modulo;

          docs.forEach(a => {
            const numDoc = a.modulo.match(/\d+/)?.[0];
            const isAssincrono = !a.modulo.toLowerCase().includes('semana');
            if (numModuloOficial && numDoc === numModuloOficial && isAssincrono) {
              tarefasDoModulo.add(a.tarefa);
              nomeExatoMod = a.modulo; 
            }
          });

          // Agrupa as tarefas por ALUNO
          alunosAtivos.forEach(aluno => {
            const tarefasDevendo = [];
            tarefasDoModulo.forEach(tar => {
              if (!entregas.has(`${aluno}-${nomeExatoMod}-${tar}`)) {
                tarefasDevendo.push(tar);
              }
            });
            if (tarefasDevendo.length > 0) {
              resultadoAssincrono.push({ aluno, tarefas: tarefasDevendo, modulo: nomeExatoMod });
            }
          });
        }

        // BUSCA INTELIGENTE AGRUPADA DO MÓDULO SÍNCRONO
        if (semanaAtual) {
          const numSemanaOficial = semanaAtual.semana.toString();
          const tarefasPossiveis = [semanaAtual.tema1, semanaAtual.tema2];
          let nomeSemanaDB = `Semana ${semanaAtual.semana}`;
          const tarefasIniciadas = new Set();
          
          docs.forEach(a => {
             if (a.modulo.includes(numSemanaOficial) && a.modulo.toLowerCase().includes('semana')) {
                 nomeSemanaDB = a.modulo;
                 if (tarefasPossiveis.includes(a.tarefa)) tarefasIniciadas.add(a.tarefa);
             }
          });

          alunosAtivos.forEach(aluno => {
            const tarefasDevendo = [];
            tarefasIniciadas.forEach(tar => {
              if (!entregas.has(`${aluno}-${nomeSemanaDB}-${tar}`)) {
                tarefasDevendo.push(tar);
              }
            });
            if (tarefasDevendo.length > 0) {
              resultadoSincrono.push({ aluno, tarefas: tarefasDevendo, modulo: nomeSemanaDB });
            }
          });
        }

        setPendenciasAgrupadas({ assincrono: resultadoAssincrono, sincrono: resultadoSincrono });
      }
    });

    return () => { unsubAlunos(); unsubAtividades(); };
  }, [alunosAtivos, moduloAtual, semanaAtual]);

  const getMensagemDia = () => {
    const dia = new Date().getDay(); 
    if (dia === 5 || dia === 6) return "aproveite o final de semana para colocar em dia.";
    if (dia === 0 || dia === 1 || dia === 2) return "desejo uma semana produtiva para colocar tudo em dia.";
    return "aproveite estes dias para colocar tudo em dia.";
  };

  // Transforma array ["Fórum", "Desafio"] em "Fórum e Desafio"
  const formatarListaTarefas = (lista) => {
    if (lista.length === 1) return lista[0];
    if (lista.length === 2) return `${lista[0]} e ${lista[1]}`;
    return lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1];
  };

  const handleCopiar = (texto, id) => {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  };

  const handleEnviarWhatsApp = (texto) => {
    navigator.clipboard.writeText(texto);
    setCopiado('geral');
    setTimeout(() => setCopiado(null), 2000);
    const textoCodificado = encodeURIComponent(texto);
    window.open(`https://wa.me/?text=${textoCodificado}`, '_blank');
  };

  const gerarMensagemGeral = (itemAtivo, diasRestantes, tipo) => {
    if (!itemAtivo) return "Não há atividades oficiais em andamento neste momento.";
    const nome = tipo === 'assincrono' ? itemAtivo.modulo : `Semana ${itemAtivo.semana}`;
    return `Olá, colegas! 🌟 Passando para lembrar que estamos na reta final de ${nome}. Faltam apenas ${diasRestantes} dias para o encerramento! Quem ainda tem atividades pendentes, ${getMensagemDia()} Solicitamos a regularização da tarefa, para que você não fique prejudicado em sua nota. Qualquer dúvida, estou à disposição.`;
  };

  const pendenciasAtuais = pendenciasAgrupadas[abaAtiva] || [];
  const multiplas = pendenciasAtuais.filter(p => p.tarefas.length > 1);
  const unicas = pendenciasAtuais.filter(p => p.tarefas.length === 1);

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUNA 1: Mensagem Geral (WhatsApp) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-200 sticky top-4">
              <h3 className="text-lg font-black text-green-900 mb-4 flex items-center gap-2 border-b border-green-100 pb-2">
                <MessageCircle size={20} className="text-green-600"/> Grupo do WhatsApp
              </h3>
              <p className="text-sm text-gray-600 mb-4">Mensagem geral gerada automaticamente com os prazos oficiais em andamento.</p>
              
              <div className="bg-green-50 p-4 rounded-xl text-sm text-gray-800 font-medium whitespace-pre-wrap border border-green-100 mb-4 shadow-inner">
                {msgGeral}
              </div>

              <button 
                onClick={() => handleEnviarWhatsApp(msgGeral)}
                disabled={!itemAtivo}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors flex justify-center items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {copiado === 'geral' ? <><CheckCircle2 size={18}/> Abrindo WhatsApp...</> : <><Send size={18}/> Enviar via WhatsApp</>}
              </button>
            </div>
          </div>

          {/* COLUNA 2: Mensagens Individuais (Plataforma) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                <Mail size={20} className="text-blue-600"/> Cobrança Individual (Plataforma)
              </h3>
              <p className="text-sm text-gray-600 mb-6">Textos dinâmicos agrupados por aluno para otimizar os seus envios.</p>

              {!itemAtivo ? (
                <div className="text-center py-10 text-gray-500 font-bold bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  Nenhum módulo ativo no momento.
                </div>
              ) : pendenciasAtuais.length === 0 ? (
                <div className="text-center py-10 text-green-600 font-bold bg-green-50 rounded-xl border border-green-200">
                  Uau! Todos os alunos já entregaram as atividades atuais.
                </div>
              ) : (
                <div className="space-y-8">
                  
                  {/* SESSÃO 1: MÚLTIPLAS PENDÊNCIAS */}
                  {multiplas.length > 0 && (
                    <div>
                      <h4 className="font-black text-red-800 mb-3 flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                        <AlertCircle size={18} className="text-red-500"/> Alunos com Múltiplas Pendências ({multiplas.length})
                      </h4>
                      <div className="grid gap-3">
                        {multiplas.map((pend, i) => {
                          const idCopia = `multi-${pend.aluno}`;
                          const prefixo = pend.modulo.toLowerCase().includes('semana') ? 'à' : 'ao';
                          const tarefasTexto = formatarListaTarefas(pend.tarefas);
                          const msgIndividual = `Prezado(a) ${pend.aluno}, estou acompanhando aqui o nosso sistema e consta a pendência das tarefas '${tarefasTexto}' referente ${prefixo} ${pend.modulo}. O prazo oficial encerra em ${diasRestantes} dias. Solicitamos a regularização das atividades, para que você não fique prejudicado em sua nota. Qualquer dúvida, estou à disposição.`;
                          
                          return (
                            <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border-2 border-red-100 hover:border-red-300 transition-colors shadow-sm">
                              <div>
                                <span className="font-black text-gray-900 block">{pend.aluno}</span>
                                <span className="text-[10px] font-black uppercase text-red-500 tracking-wider mb-1 block">Deve: {tarefasTexto}</span>
                                <p className="text-xs text-gray-500 line-clamp-2 md:line-clamp-1" title={msgIndividual}>{msgIndividual}</p>
                              </div>
                              <button 
                                onClick={() => handleCopiar(msgIndividual, idCopia)}
                                className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${copiado === idCopia ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'}`}
                              >
                                {copiado === idCopia ? <CheckCircle2 size={16}/> : <Copy size={16}/>} 
                                {copiado === idCopia ? 'Copiado' : 'Copiar'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SESSÃO 2: PENDÊNCIA ÚNICA */}
                  {unicas.length > 0 && (
                    <div>
                      <h4 className="font-black text-yellow-800 mb-3 flex items-center gap-2 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-100">
                        <AlertCircle size={18} className="text-yellow-500"/> Alunos com 1 Pendência ({unicas.length})
                      </h4>
                      <div className="grid gap-3">
                        {unicas.map((pend, i) => {
                          const idCopia = `unica-${pend.aluno}`;
                          const prefixo = pend.modulo.toLowerCase().includes('semana') ? 'à' : 'ao';
                          const tarefasTexto = formatarListaTarefas(pend.tarefas);
                          const msgIndividual = `Prezado(a) ${pend.aluno}, estou acompanhando aqui o nosso sistema e consta a pendência da tarefa '${tarefasTexto}' referente ${prefixo} ${pend.modulo}. O prazo oficial encerra em ${diasRestantes} dias. Solicitamos a regularização da tarefa, para que você não fique prejudicado em sua nota. Qualquer dúvida, estou à disposição.`;
                          
                          return (
                            <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border-2 border-yellow-100 hover:border-yellow-300 transition-colors shadow-sm">
                              <div>
                                <span className="font-black text-gray-900 block">{pend.aluno}</span>
                                <span className="text-[10px] font-black uppercase text-yellow-600 tracking-wider mb-1 block">Deve: {tarefasTexto}</span>
                                <p className="text-xs text-gray-500 line-clamp-2 md:line-clamp-1" title={msgIndividual}>{msgIndividual}</p>
                              </div>
                              <button 
                                onClick={() => handleCopiar(msgIndividual, idCopia)}
                                className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${copiado === idCopia ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100'}`}
                              >
                                {copiado === idCopia ? <CheckCircle2 size={16}/> : <Copy size={16}/>} 
                                {copiado === idCopia ? 'Copiado' : 'Copiar'}
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
      </div>
    </div>
  );
}
