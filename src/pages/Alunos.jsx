import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc, query, onSnapshot, serverTimestamp, orderBy, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Plus, Trash2, Users, MonitorPlay, MessageCircle, Mail } from 'lucide-react';

export default function Alunos() {
  // Agora a tela Ouve as mudanças do menu em tempo real
  const [turmaSelecionada, setTurmaSelecionada] = useState(localStorage.getItem('saas_turma'));

  useEffect(() => {
    const atualizaWorkspace = () => setTurmaSelecionada(localStorage.getItem('saas_turma'));
    window.addEventListener('workspaceChanged', atualizaWorkspace);
    return () => window.removeEventListener('workspaceChanged', atualizaWorkspace);
  }, []);

  const [alunos, setAlunos] = useState([]);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  // Busca os Alunos da Turma
  useEffect(() => {
    if (!turmaSelecionada) return;
    const qAlunos = query(collection(db, 'saas_alunos'), where('idTurma', '==', turmaSelecionada), orderBy('nome', 'asc'));
    const unsubAlunos = onSnapshot(qAlunos, (snap) => {
      setAlunos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Erro ao buscar alunos: ", error));
    return () => unsubAlunos();
  }, [turmaSelecionada]);

  const formatarZap = (numero) => numero ? numero.replace(/\D/g, '') : '';

  async function handleAddAluno(e) {
    e.preventDefault();
    if (salvando || !nome.trim() || !turmaSelecionada) return;
    setSalvando(true);
    try {
      await addDoc(collection(db, 'saas_alunos'), { 
        idTurma: turmaSelecionada, nome: nome.trim(), email: email.trim() || '', whatsapp: whatsapp.trim() || '', status: 'ativo', dataCriacao: serverTimestamp()
      });
      setNome(''); setEmail(''); setWhatsapp('');
      setMensagem('Aluno cadastrado!'); setTimeout(() => setMensagem(''), 3000);
    } catch (error) { console.error(error); setMensagem('Erro ao cadastrar.'); } finally { setSalvando(false); }
  }

  async function handleExcluirAluno(id) {
    if (window.confirm('Remover aluno?')) {
      setSalvando(true);
      try { await deleteDoc(doc(db, 'saas_alunos', id)); } finally { setSalvando(false); }
    }
  }

  if (!turmaSelecionada) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-lg w-full p-10 rounded-3xl shadow-sm border border-gray-200 text-center flex flex-col items-center">
          <div className="bg-indigo-50 text-indigo-500 w-20 h-20 rounded-full flex items-center justify-center mb-6"><MonitorPlay size={40} /></div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">Central de Alunos Bloqueada</h2>
          <p className="text-gray-500">Para gerenciar matrículas, por favor, <b>selecione uma Instituição e uma Turma no menu superior</b>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-indigo-600"><ArrowLeft size={24} /></Link>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Users className="text-indigo-600" /> Gestão de Alunos</h2>
        </div>

        {mensagem && <div className="p-4 rounded-lg bg-green-100 text-green-800 font-bold text-center border border-green-200">{mensagem}</div>}

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-black text-indigo-900 mb-6 border-b pb-4">Matricular Novo Aluno</h3>
          <form onSubmit={handleAddAluno} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div><label className="block text-xs font-bold text-gray-600 uppercase mb-2">Nome *</label><input required type="text" className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={nome} onChange={e => setNome(e.target.value)} /></div>
            <div><label className="block text-xs font-bold text-gray-600 uppercase mb-2">E-mail</label><input type="email" className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><label className="block text-xs font-bold text-gray-600 uppercase mb-2">WhatsApp</label><input type="tel" className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} /></div>
            <button type="submit" disabled={salvando} className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 font-bold disabled:opacity-50 flex items-center justify-center gap-2"><Plus size={20} /> Adicionar</button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-6 border-b pb-4"><h3 className="text-lg font-black text-gray-800">Alunos Matriculados</h3><span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">{alunos.length}</span></div>
          {alunos.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100"><p className="text-gray-500 font-medium">Nenhum aluno matriculado.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alunos.map(aluno => (
                <div key={aluno.id} className="border border-gray-200 bg-white p-4 rounded-xl shadow-sm flex flex-col justify-between hover:border-indigo-300">
                  <div className="mb-4">
                    <span className="font-black text-gray-800 block text-lg">{aluno.nome}</span>
                    <div className="flex flex-col gap-1 mt-2">
                      {aluno.email && <span className="text-xs text-gray-500 flex items-center gap-1.5"><Mail size={14} className="text-gray-400"/> {aluno.email}</span>}
                      {aluno.whatsapp && <span className="text-xs text-gray-500 flex items-center gap-1.5"><MessageCircle size={14} className="text-green-500"/> {aluno.whatsapp}</span>}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-auto">
                    {aluno.whatsapp ? <a href={`https://wa.me/55${formatarZap(aluno.whatsapp)}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg flex items-center gap-1">Chamar</a> : <span className="text-xs text-gray-300 italic">Sem WhatsApp</span>}
                    <button onClick={() => handleExcluirAluno(aluno.id)} disabled={salvando} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
