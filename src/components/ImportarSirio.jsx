import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Calendar, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export default function ImportarSirio() {
  const { currentUser, escolaSelecionada } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [turmaSelecionada, setTurmaSelecionada] = useState('');
  const [importando, setImportando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  // CRONOGRAMA TRADUZIDO E MASTIGADO PARA O FIREBASE
  const cronograma = [
    // --- ASSÍNCRONO ---
    { nome: "[Assíncrono] Módulo 1: Da teoria à prática", start: [9, 2, 2026], end: [8, 3, 2026] },
    { nome: "[Assíncrono] Módulo 1 - Fórum 01", start: [13, 2, 2026], end: [5, 4, 2026] },
    { nome: "[Assíncrono] Módulo 1 - Fórum 02", start: [27, 2, 2026], end: [5, 4, 2026] },
    { nome: "[Assíncrono] Módulo 1 - Tutoria 01 e 02", start: [26, 2, 2026], end: [26, 2, 2026] },

    { nome: "[Assíncrono] Módulo 2: Política Nacional de Regulação", start: [9, 3, 2026], end: [5, 4, 2026] },
    { nome: "[Assíncrono] Módulo 2 - Fórum 01", start: [13, 3, 2026], end: [5, 4, 2026] },
    { nome: "[Assíncrono] Módulo 2 - Fórum 02", start: [27, 3, 2026], end: [5, 4, 2026] },
    { nome: "[Assíncrono] Módulo 2 - Tutoria 01", start: [12, 3, 2026], end: [12, 3, 2026] },
    { nome: "[Assíncrono] Módulo 2 - Tutoria 02", start: [26, 3, 2026], end: [26, 3, 2026] },

    { nome: "[Assíncrono] Módulo 3: Processos do NIR", start: [6, 4, 2026], end: [3, 5, 2026] },
    { nome: "[Assíncrono] Módulo 3 - Fórum 01", start: [10, 4, 2026], end: [3, 5, 2026] },
    { nome: "[Assíncrono] Módulo 3 - Fórum 02", start: [24, 4, 2026], end: [3, 5, 2026] },
    { nome: "[Assíncrono] Módulo 3 - Tutoria 01", start: [9, 4, 2026], end: [9, 4, 2026] },
    { nome: "[Assíncrono] Módulo 3 - Tutoria 02", start: [23, 4, 2026], end: [23, 4, 2026] },

    { nome: "[Assíncrono] Módulo 4: Maturidade do NIR", start: [4, 5, 2026], end: [31, 5, 2026] },
    { nome: "[Assíncrono] Módulo 4 - Fórum 01", start: [8, 5, 2026], end: [31, 5, 2026] },
    { nome: "[Assíncrono] Módulo 4 - Fórum 02", start: [22, 5, 2026], end: [31, 5, 2026] },
    { nome: "[Assíncrono] Módulo 4 - Tutoria 01", start: [7, 5, 2026], end: [7, 5, 2026] },
    { nome: "[Assíncrono] Módulo 4 - Tutoria 02", start: [21, 5, 2026], end: [21, 5, 2026] },

    { nome: "[Assíncrono] Módulo 5: Informação e decisão", start: [1, 6, 2026], end: [28, 6, 2026] },
    { nome: "[Assíncrono] Módulo 5 - Fórum 01", start: [5, 6, 2026], end: [28, 6, 2026] },
    { nome: "[Assíncrono] Módulo 5 - Fórum 02", start: [19, 6, 2026], end: [28, 6, 2026] },
    { nome: "[Assíncrono] Módulo 5 - Tutoria 01", start: [4, 6, 2026], end: [4, 6, 2026] },
    { nome: "[Assíncrono] Módulo 5 - Tutoria 02", start: [18, 6, 2026], end: [18, 6, 2026] },

    { nome: "[Assíncrono] Módulo 6: Projetos", start: [29, 6, 2026], end: [26, 7, 2026] },
    { nome: "[Assíncrono] Módulo 6 - Fórum 01", start: [3, 7, 2026], end: [26, 7, 2026] },
    { nome: "[Assíncrono] Módulo 6 - Fórum 02", start: [17, 7, 2026], end: [26, 7, 2026] },
    { nome: "[Assíncrono] Módulo 6 - Tutoria 01", start: [2, 7, 2026], end: [2, 7, 2026] },
    { nome: "[Assíncrono] Módulo 6 - Tutoria 02", start: [16, 7, 2026], end: [16, 7, 2026] },

    { nome: "[Assíncrono] Atividade Final", start: [27, 7, 2026], end: [6, 8, 2026] },

    // --- SÍNCRONO ---
    { nome: "[Síncrono] Módulo 2: Política Nacional de Regulação", start: [9, 3, 2026], end: [5, 4, 2026] },
    { nome: "[Síncrono] Módulo 2 - Fórum 01", start: [13, 3, 2026], end: [5, 4, 2026] },
    { nome: "[Síncrono] Módulo 2 - Fórum 02", start: [27, 3, 2026], end: [5, 4, 2026] },
    { nome: "[Síncrono] Módulo 2 - Tutoria 01", start: [12, 3, 2026], end: [12, 3, 2026] },
    { nome: "[Síncrono] Módulo 2 - Tutoria 02", start: [26, 3, 2026], end: [26, 3, 2026] },

    { nome: "[Síncrono] Módulo 3: Processos do NIR", start: [6, 4, 2026], end: [3, 5, 2026] },
    { nome: "[Síncrono] Módulo 3 - Fórum 01", start: [10, 4, 2026], end: [3, 5, 2026] },
    { nome: "[Síncrono] Módulo 3 - Fórum 02", start: [24, 4, 2026], end: [3, 5, 2026] },
    { nome: "[Síncrono] Módulo 3 - Tutoria 01", start: [9, 4, 2026], end: [9, 4, 2026] },
    { nome: "[Síncrono] Módulo 3 - Tutoria 02", start: [23, 4, 2026], end: [23, 4, 2026] },

    { nome: "[Síncrono] Módulo 4: Maturidade do NIR", start: [4, 5, 2026], end: [31, 5, 2026] },
    { nome: "[Síncrono] Módulo 4 - Fórum 01", start: [8, 5, 2026], end: [31, 5, 2026] },
    { nome: "[Síncrono] Módulo 4 - Fórum 02", start: [22, 5, 2026], end: [31, 5, 2026] },
    { nome: "[Síncrono] Módulo 4 - Tutoria 01", start: [7, 5, 2026], end: [7, 5, 2026] },
    { nome: "[Síncrono] Módulo 4 - Tutoria 02", start: [21, 5, 2026], end: [21, 5, 2026] },

    { nome: "[Síncrono] Módulo 5: Informação e decisão", start: [1, 6, 2026], end: [28, 6, 2026] },
    { nome: "[Síncrono] Módulo 5 - Fórum 01", start: [5, 6, 2026], end: [28, 6, 2026] },
    { nome: "[Síncrono] Módulo 5 - Fórum 02", start: [19, 6, 2026], end: [28, 6, 2026] },
    { nome: "[Síncrono] Módulo 5 - Tutoria 01", start: [4, 6, 2026], end: [4, 6, 2026] },
    { nome: "[Síncrono] Módulo 5 - Tutoria 02", start: [18, 6, 2026], end: [18, 6, 2026] },

    { nome: "[Síncrono] Módulo 6: Projetos", start: [29, 6, 2026], end: [26, 7, 2026] },
    { nome: "[Síncrono] Módulo 6 - Fórum 01", start: [3, 7, 2026], end: [26, 7, 2026] },
    { nome: "[Síncrono] Módulo 6 - Fórum 02", start: [17, 7, 2026], end: [26, 7, 2026] },
    { nome: "[Síncrono] Módulo 6 - Tutoria 01", start: [2, 7, 2026], end: [2, 7, 2026] },
    { nome: "[Síncrono] Módulo 6 - Tutoria 02", start: [16, 7, 2026], end: [16, 7, 2026] },

    { nome: "[Síncrono] Atividade Final", start: [27, 7, 2026], end: [6, 8, 2026] },
    { nome: "[Síncrono] Correção da Atividade Final", start: [7, 8, 2026], end: [14, 8, 2026] }
  ];

  useEffect(() => {
    async function carregarTurmas() {
      if (!escolaSelecionada?.id) return;
      try {
        const qT = query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id));
        const snap = await getDocs(qT);
        setTurmas(snap.docs.map(t => ({ id: t.id, ...t.data() })).filter(t => t.status !== 'lixeira'));
      } catch (e) { console.error(e); }
    }
    carregarTurmas();
  }, [escolaSelecionada]);

  async function handleImportar() {
    if (!turmaSelecionada) return alert("Selecione a turma primeiro!");
    if (!window.confirm("Isso vai criar 57 tarefas para o Sírio-Libanês. Continuar?")) return;

    setImportando(true);
    try {
      const promessas = cronograma.map(item => {
        // Ajustando fuso horário: Hora 00:00:00 para início e 23:59:59 para fim
        const dataIn = new Date(item.start[2], item.start[1] - 1, item.start[0], 0, 0, 0);
        const dataFim = new Date(item.end[2], item.end[1] - 1, item.end[0], 23, 59, 59);

        return addDoc(collection(db, 'tarefas'), {
          nomeTarefa: item.nome,
          enunciado: `Atividade do curso Sírio-Libanês: ${item.nome}`,
          turmaId: turmaSelecionada,
          instituicaoId: escolaSelecionada.id,
          professorUid: currentUser.uid,
          dataInicio: Timestamp.fromDate(dataIn),
          dataFim: Timestamp.fromDate(dataFim),
          atribuicaoEspecifica: false,
          alunosSelecionados: [],
          dataCriacao: serverTimestamp(),
          status: 'ativo'
        });
      });

      await Promise.all(promessas);
      setSucesso(true);
    } catch (e) {
      console.error(e);
      alert("Erro ao importar.");
    } finally {
      setImportando(false);
    }
  }

  if (!escolaSelecionada) return <div className="p-20 text-center font-black">Nenhuma instituição selecionada no Painel. Volte ao início.</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-3xl shadow-xl max-w-lg w-full border border-slate-200">
        
        <div className="bg-green-100 text-green-700 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
          <Calendar size={32} />
        </div>

        <h1 className="text-2xl font-black text-slate-800 mb-2">Importação Sírio-Libanês</h1>
        <p className="text-slate-500 font-medium mb-8">
          Sua instituição ativa atual é: <strong className="text-slate-700">{escolaSelecionada.nome}</strong>
        </p>

        {sucesso ? (
          <div className="bg-green-50 p-6 rounded-2xl border border-green-200 text-center animate-in fade-in zoom-in">
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-black text-green-800 mb-2">Sucesso Absoluto!</h2>
            <p className="text-green-700 font-medium">Todas as 57 tarefas foram importadas com os prazos exatos.</p>
            <p className="text-xs font-bold text-green-600 mt-4 uppercase tracking-widest">Pode apagar esta página agora.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">1. Selecione a Turma "NIR"</label>
              <select 
                value={turmaSelecionada} 
                onChange={e => setTurmaSelecionada(e.target.value)}
                className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-green-500 outline-none font-medium bg-slate-50 cursor-pointer"
              >
                <option value="">Escolha a turma...</option>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>

            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 flex items-start gap-3">
              <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
              <p className="text-xs font-bold text-yellow-700 leading-relaxed">
                Este botão irá injetar as 57 tarefas no banco de dados. Tenha certeza de que a instituição e a turma estão corretas antes de clicar.
              </p>
            </div>

            <button 
              onClick={handleImportar} 
              disabled={importando || !turmaSelecionada}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2"
            >
              {importando ? "Injetando Dados..." : "Importar 57 Tarefas"} <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
