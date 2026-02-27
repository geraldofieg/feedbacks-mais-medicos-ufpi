import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Megaphone, Copy, CheckCircle2, MessageCircle, Mail, Send } from 'lucide-react';
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

        // BUSCA INTELIGENTE DO MÓDULO ASSÍNCRONO
        if (moduloAtual) {
          // Extrai apenas o número do cronograma oficial (Ex: "Módulo 7" -> "7")
          const numModuloOficial = moduloAtual.modulo.match(/\d+/)?.[0];
          
          const tarefasDoModulo = new Set();
          const nomeBanco = {}; // Guarda o nome exatamente como o Geraldo digitou no Firebase

          // Varre o banco procurando atividades que tenham esse mesmo número
          docs.forEach(a => {
            const numDoc = a.modulo.match(/\d+/)?.[0];
            const isAssincrono = !a.modulo.toLowerCase().includes('semana');
            
            // Se o número bater (7 = 7), nós assumimos que é o mesmo módulo, independente de como foi digitado!
            if (numModuloOficial && numDoc === numModuloOficial && isAssincrono) {
              tarefasDoModulo.add(a.tarefa);
              nomeBanco[a.tarefa] = a.modulo; 
            }
          });

          // Agora checa quem deve essas tarefas
          tarefasDoModulo.forEach(tar => {
            const nomeExatoMod = nomeBanco[tar];
            const devedores = alunosAtivos.filter(al => !entregas.has(`${al}-${nomeExatoMod}-${tar}`));
            if(devedores.length > 0) {
              resultado.push({ tipo: 'assincrono', modulo: nomeExatoMod, tarefa: tar, devedores });
            }
          });
        }

        // BUSCA DO MÓDULO SÍNCRONO
        if (semanaAtual) {
          const numSemanaOficial = semanaAtual.semana.toString();
          const tarefas = [semanaAtual.tema1, semanaAtual.tema2];
          
          tarefas.forEach(tar => {
             // Encontra o nome exato da semana que foi salvo no Firebase
             const atividadeFirebase = docs.find(a => a.modulo.includes(numSemanaOficial) && a.modulo.toLowerCase().includes('semana') && a.tarefa === tar);
             
             if (atividadeFirebase) {
               const nomeSemanaDB = atividadeFirebase.modulo;
               const devedores = alunosAtivos.filter(al => !entregas.has(`${al}-${nomeSemanaDB}-${tar}`));
               
               if(devedores.length > 0) {
                 resultado.push({ tipo: 'sincrono', modulo: nomeSemanaDB, tarefa: tar, devedores });
               }
             }
          });
        }
        setPendencias(resultado);
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

        <div className="flex gap-2 mb-8 bg-gray-200/50 p-1.5 rounded-2xl">
          <button onClick={() => setAbaAtiva('assincrono')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all ${abaAtiva === 'assincrono' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
             ASSÍNCRONO
          </button>
          <button onClick={() => setAbaAtiva('sincrono')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all ${abaAtiva === 'sincrono' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
             SÍNCRONO
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
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
                          // REFERENCIA EXATA AO NOME DO MÓDULO (Ex: "ao Módulo 7")
                          const prefixo = pend.modulo.toLowerCase().includes('semana') ? 'à' : 'ao';
                          const msgIndividual = `Prezado(a) ${aluno}, estou acompanhando aqui o nosso sistema e consta a pendência da tarefa '${pend.tarefa}' referente ${prefixo} ${pend.modulo}. O prazo oficial encerra em ${diasRestantes} dias. Solicitamos a regularização da tarefa, para que você não fique prejudicado em sua nota. Qualquer dúvida, estou à disposição.`;
                          
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
