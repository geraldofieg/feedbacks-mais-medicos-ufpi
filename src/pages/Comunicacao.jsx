import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Megaphone, Copy, CheckCircle2, MessageCircle, Mail } from 'lucide-react';
import { cronogramaAssincrono, cronogramaSincrono, getStatusData, getDiasRestantes } from '../data/cronogramaData';

export default function Comunicacao() {
  const [abaAtiva, setAbaAtiva] = useState('assincrono');
  const [alunosAtivos, setAlunosAtivos] = useState([]);
  const [pendencias, setPendencias] = useState([]);
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
        const resultado = [];

        if (moduloAtual) {
          const tarefasDoModulo = new Set(docs.filter(a => a.modulo === moduloAtual.modulo).map(a => a.tarefa));
          tarefasDoModulo.forEach(tar => {
            const devedores = alunosAtivos.filter(al => !entregas.has(`${al}-${moduloAtual.modulo}-${tar}`));
            if(devedores.length > 0) resultado.push({ tipo: 'assincrono', modulo: moduloAtual.modulo, tarefa: tar, devedores });
          });
        }

        if (semanaAtual) {
          const nomeSemana = `Semana ${semanaAtual.semana}`;
          const tarefas = [semanaAtual.tema1, semanaAtual.tema2];
          
          tarefas.forEach(tar => {
            const devedores = alunosAtivos.filter(al => !entregas.has(`${al}-${nomeSemana}-${tar}`));
            const tarefaJaIniciada = docs.some(a => a.modulo === nomeSemana && a.tarefa === tar);
            
            if(devedores.length > 0 && tarefaJaIniciada) {
              resultado.push({ tipo: 'sincrono', modulo: nomeSemana, tarefa: tar, devedores });
            }
          });
        }
        setPendencias(resultado);
      }
    });

    return () => { unsubAlunos(); unsubAtividades(); };
  }, [alunosAtivos, moduloAtual, semanaAtual]);

  // FUNÇÃO INTELIGENTE DO DIA DA SEMANA
  const getMensagemDia = () => {
    const dia = new Date().getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
    if (dia === 5 || dia === 6) return "aproveite o final de semana.";
    if (dia === 0 || dia === 1 || dia === 2) return "desejo uma semana produtiva para colocar tudo em dia.";
    return "aproveite estes dias para colocar tudo em dia.";
  };

  const handleCopiar = (texto, id) => {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  };

  const gerarMensagemGeral = (itemAtivo, diasRestantes, tipo) => {
    if (!itemAtivo) return "Não há atividades oficiais em andamento neste momento.";
    const nome = tipo === 'assincrono' ? itemAtivo.modulo : `Semana ${itemAtivo.semana}`;
    
    return `Olá, colegas! 🌟 Passando para lembrar que estamos na reta final de ${nome}. Faltam apenas ${diasRestantes} dias para o encerramento! Quem ainda tem atividades pendentes, ${getMensagemDia()} Solicitamos a regularização da tarefa, para que você não fique prejudicado em sua nota. Qualquer dúvida, estou à disposição.`;
  };

  const pendenciasVisiveis = pendencias.filter(p => p.tipo === abaAtiva);
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

        {/* Abas Superiores */}
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
                onClick={() => handleCopiar(msgGeral, 'geral')}
                disabled={!itemAtivo}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors flex justify-center items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {copiado === 'geral' ? <><CheckCircle2 size={18}/> Copiado!</> : <><Copy size={18}/> Copiar para WhatsApp</>}
              </button>
            </div>
          </div>

          {/* COLUNA 2: Mensagens Individuais (Plataforma) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                <Mail size={20} className="text-blue-600"/> Cobrança Individual (Plataforma)
              </h3>
              <p className="text-sm text-gray-600 mb-6">Textos personalizados prontos para envio privado aos alunos pendentes.</p>

              {!itemAtivo ? (
                <div className="text-center py-10 text-gray-500 font-bold bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  Nenhum módulo ativo no momento.
                </div>
              ) : pendenciasVisiveis.length === 0 ? (
                <div className="text-center py-10 text-green-600 font-bold bg-green-50 rounded-xl border border-green-200">
                  Uau! Todos os alunos já entregaram as atividades atuais.
                </div>
              ) : (
                <div className="space-y-6">
                  {pendenciasVisiveis.map((pend, idx) => (
                    <div key={idx}>
                      <h4 className="font-bold text-gray-700 mb-3 bg-gray-100 px-3 py-1.5 rounded-lg inline-block text-sm">
                        Pendência: {pend.tarefa}
                      </h4>
                      <div className="grid gap-3">
                        {pend.devedores.map((aluno, i) => {
                          const idCopia = `${pend.tarefa}-${i}`;
                          // TEXTO INDIVIDUAL EXATAMENTE COMO SOLICITADO
                          const msgIndividual = `Prezado(a) ${aluno}, estou acompanhando aqui o nosso sistema e consta a pendência da tarefa '${pend.tarefa}' referente à ${pend.modulo}. O prazo oficial encerra em ${diasRestantes} dias. Solicitamos a regularização da tarefa, para que você não fique prejudicado em sua nota. Qualquer dúvida, estou à disposição.`;
                          
                          return (
                            <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 hover:border-blue-300 transition-colors group">
                              <div>
                                <span className="font-bold text-gray-900 block mb-1">{aluno}</span>
                                <p className="text-xs text-gray-500 line-clamp-2 md:line-clamp-1" title={msgIndividual}>{msgIndividual}</p>
                              </div>
                              <button 
                                onClick={() => handleCopiar(msgIndividual, idCopia)}
                                className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${copiado === idCopia ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'}`}
                              >
                                {copiado === idCopia ? <CheckCircle2 size={16}/> : <Copy size={16}/>} 
                                {copiado === idCopia ? 'Copiado' : 'Copiar'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
