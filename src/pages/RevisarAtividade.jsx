import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCircle, FileText, ExternalLink, User, Copy, Trash2, CheckCheck, Send, RotateCcw } from 'lucide-react';

export default function RevisarAtividade() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth(); // Pegamos o usuário logado
  const [atividade, setAtividade] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [feedbackEditado, setFeedbackEditado] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [marcandoPostado, setMarcandoPostado] = useState(false);

  // === CRACHÁ DE IDENTIFICAÇÃO ===
  // Substitua pelo SEU e-mail exato de login mantendo as aspas!
  const isAdmin = currentUser?.email === 'geraldofieg@gmail.com'; 

  useEffect(() => {
    async function buscarAtividade() {
      try {
        const docRef = doc(db, 'atividades', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const dados = docSnap.data();
          setAtividade({ id: docSnap.id, ...dados });
          setFeedbackEditado(dados.feedbackSugerido || '');
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }
    buscarAtividade();
  }, [id]);

  async function handleAprovar() {
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'atividades', id), {
        feedbackFinal: feedbackEditado,
        status: 'aprovado',
        postado: false,
        dataAprovacao: new Date() // Grava a data e hora do clique dela
      });
      // Se for a professora, manda pro Histórico, se for o gestor, vai pra fila de postar
      navigate(isAdmin ? '/lista/falta-postar' : '/lista/finalizados'); 
    } catch (error) { alert("Erro ao salvar."); setSalvando(false); }
  }

  async function handleExcluir() {
    if (window.confirm("Atenção: Tem certeza que deseja excluir esta atividade para sempre?")) {
      setExcluindo(true);
      try { await deleteDoc(doc(db, 'atividades', id)); navigate(-1); } 
      catch (error) { alert("Erro ao excluir."); setExcluindo(false); }
    }
  }

  function handleCopiar() {
    navigator.clipboard.writeText(atividade.feedbackFinal || atividade.feedbackSugerido);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function handleMarcarPostado() {
    setMarcandoPostado(true);
    try {
      await updateDoc(doc(db, 'atividades', id), { postado: true });
      navigate('/lista/finalizados'); 
    } catch (error) { alert("Erro ao marcar."); setMarcandoPostado(false); }
  }

  async function handleReverterPostagem() {
    if (window.confirm("Desfazer postagem? A atividade voltará para a lista de 'Falta Postar'.")) {
      try { await updateDoc(doc(db, 'atividades', id), { postado: false }); navigate('/lista/falta-postar'); } 
      catch (error) { alert("Erro ao reverter."); }
    }
  }

  async function handleReverterRevisao() {
    if (window.confirm("Devolver para Revisão? A atividade voltará para a caixa de 'Aguardando Revisão'.")) {
      try { await updateDoc(doc(db, 'atividades', id), { status: 'pendente', postado: false }); navigate('/lista/pendente'); } 
      catch (error) { alert("Erro ao reverter."); }
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div></div>;
  if (!atividade) return <div className="text-center p-10 font-bold">Atividade não encontrada.</div>;

  const linkVoltar = atividade.status === 'pendente' ? '/lista/pendente' : !atividade.postado ? (isAdmin ? '/lista/falta-postar' : '/lista/finalizados') : '/lista/finalizados';

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to={linkVoltar} className="text-gray-500 hover:text-blue-600"><ArrowLeft size={24} /></Link>
            <h2 className="text-2xl font-black text-gray-800">{atividade.status === 'pendente' ? 'Revisão de Feedback' : !atividade.postado ? 'Aprovado' : 'Feedback Concluído'}</h2>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-bold border uppercase ${atividade.status === 'pendente' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : !atividade.postado ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
            {atividade.status === 'pendente' ? 'Pendente' : !atividade.postado ? 'Aprovado' : 'Finalizado'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                <div className="bg-blue-100 p-3 rounded-full text-blue-600"><User size={24} /></div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{atividade.aluno}</h3>
                  <p className="text-sm font-bold text-gray-500">{atividade.modulo} • {atividade.tarefa}</p>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">1. Enunciado</h4>
                {atividade.enunciado && <p className="text-gray-700 bg-gray-50 p-4 rounded-xl text-sm border border-gray-100">{atividade.enunciado}</p>}
                {atividade.urlEnunciado && <a href={atividade.urlEnunciado} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-3 rounded-lg font-bold text-sm hover:bg-blue-100 border border-blue-200"><FileText size={20} /> Ver Arquivo <ExternalLink size={16} /></a>}
              </div>

              <div className="mt-6 border-t border-gray-100 pt-6">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">2. Resposta do Aluno</h4>
                {atividade.resposta && <p className="text-gray-800 bg-green-50 p-4 rounded-xl text-sm border border-green-100 font-medium">{atividade.resposta}</p>}
                {atividade.urlResposta && <a href={atividade.urlResposta} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-lg font-bold text-sm hover:bg-green-100 border border-green-200"><FileText size={20} /> Ver Arquivo <ExternalLink size={16} /></a>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            
            {atividade.status === 'pendente' ? (
              <div className="bg-blue-600 p-6 rounded-2xl shadow-md text-white">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2 border-b border-blue-500 pb-2"><CheckCircle size={20} />3. Aprovar Feedback</h3>
                <textarea rows="8" className="w-full p-4 rounded-xl text-gray-800 font-medium mb-4 shadow-inner" value={feedbackEditado} onChange={(e) => setFeedbackEditado(e.target.value)}></textarea>
                <button onClick={handleAprovar} disabled={salvando} className="w-full bg-white text-blue-700 font-black text-lg py-4 rounded-xl hover:bg-gray-100 active:scale-95 transition-all shadow-lg">{salvando ? 'Aprovando...' : 'Aprovar e Salvar'}</button>
              </div>
            ) : (
              <div className="bg-gray-800 p-6 rounded-2xl shadow-md text-white">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2 border-b border-gray-600 pb-2"><CheckCircle size={20} />Feedback Aprovado</h3>
                <div className="bg-white text-gray-800 p-4 rounded-xl text-sm mb-4 min-h-[150px] whitespace-pre-wrap font-medium shadow-inner">
                  {atividade.feedbackFinal || atividade.feedbackSugerido}
                </div>
                
                {/* O botão de Copiar fica visível para ambos, pode ser útil pra ela revisar */}
                <button onClick={handleCopiar} className="w-full bg-white text-gray-800 font-black text-lg py-4 rounded-xl hover:bg-gray-100 active:scale-95 transition-all shadow-lg flex justify-center items-center gap-2 mb-4">
                  <Copy size={24} /> {copiado ? 'Texto Copiado!' : 'Copiar Feedback'}
                </button>

                {/* BOTÃO PERIGOSO: SÓ O GERALDO VÊ */}
                {isAdmin && !atividade.postado && (
                  <button onClick={handleMarcarPostado} disabled={marcandoPostado} className="w-full bg-blue-600 text-white font-black text-md py-4 rounded-xl hover:bg-blue-700 transition-all border border-blue-500 flex justify-center items-center gap-2">
                    {marcandoPostado ? 'Salvando...' : <><Send size={20}/> Marcar como Postado</>}
                  </button>
                )}
                
                {atividade.postado && (
                  <div className="w-full bg-green-900 text-green-100 font-bold text-sm py-3 rounded-xl flex justify-center items-center gap-2 border border-green-700">
                    <CheckCheck size={18} /> Postado no Mais Médicos
                  </div>
                )}
              </div>
            )}

            {/* ZONA DE GERENCIAMENTO: SÓ O GERALDO VÊ */}
            {isAdmin && (
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 text-center border-b border-gray-100 pb-2">Gerenciamento Gestor</h4>
                
                {atividade.postado && (
                  <button onClick={handleReverterPostagem} className="w-full flex items-center justify-center gap-2 text-orange-600 hover:bg-orange-50 py-3 rounded-xl font-bold transition-colors text-sm">
                    <RotateCcw size={18} /> Desfazer Postagem
                  </button>
                )}
                
                {atividade.status !== 'pendente' && (
                  <button onClick={handleReverterRevisao} className="w-full flex items-center justify-center gap-2 text-yellow-600 hover:bg-yellow-50 py-3 rounded-xl font-bold transition-colors text-sm">
                    <RotateCcw size={18} /> Devolver p/ Revisão
                  </button>
                )}

                <button onClick={handleExcluir} disabled={excluindo} className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 py-3 rounded-xl font-bold transition-colors text-sm">
                  <Trash2 size={18} /> Excluir Atividade
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
