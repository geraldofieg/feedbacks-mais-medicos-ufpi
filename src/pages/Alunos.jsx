import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc, query, onSnapshot, serverTimestamp, orderBy, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Plus, Trash2, Users, MonitorPlay, MessageCircle, Mail } from 'lucide-react';

export default function Alunos() {
  // Lê a Turma Selecionada no Menu Global (Workspace)
  const turmaSelecionada = localStorage.getItem('saas_turma');

  const [alunos, setAlunos] = useState([]);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  // Busca os Alunos apenas da Turma Selecionada (Isolamento de Dados)
  useEffect(() => {
    if (!turmaSelecionada) return;

    const qAlunos = query(
      collection(db, 'saas_alunos'), 
      where('idTurma', '==', turmaSelecionada),
      orderBy('nome', 'asc') // O Firestore pode pedir para você criar um índice para essa busca composta depois
    );

    const unsubAlunos = onSnapshot(qAlunos, (snap) => {
      setAlunos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      // Se o Firebase pedir criação de índice (Index), ele vai logar um erro com o link aqui.
      // Em testes iniciais com poucos dados, tirar o orderBy evita a exigência imediata do índice.
      console.error("Erro ao buscar alunos: ", error);
    });

    return () => unsubAlunos();
  }, [turmaSelecionada]);

  // Função para formatar o número pro Link do WhatsApp
  const formatarZap = (numero) => {
    if (!numero) return '';
    return numero.replace(/\D/g, ''); // Arranca parênteses e traços, deixa só os números
  };

  async function handleAddAluno(e) {
    e.preventDefault();
    if (salvando || !nome.trim()) return;
    setSalvando(true);
    setMensagem('');

    try {
      await addDoc(collection(db, 'saas_alunos'), { 
        idTurma: turmaSelecionada,
        nome: nome.trim(),
        email: email.trim() || '',
        whatsapp: whatsapp.trim() || '',
        status: 'ativo',
        dataCriacao: serverTimestamp()
      });
      setNome('');
      setEmail('');
      setWhatsapp('');
      setMensagem('Aluno cadastrado com sucesso!');
      setTimeout(() => setMensagem(''), 3000);
    } catch (error) { 
      console.error("Erro:", error); 
      setMensagem('Erro ao cadastrar aluno.');
    } finally { 
      setSalvando(false); 
    }
  }

  async function handleExcluirAluno(id) {
    if (window.confirm('Tem certeza que deseja remover este aluno da turma? (O histórico de atividades dele poderá ficar órfão)')) {
      setSalvando(true);
      try { 
        await deleteDoc(doc(db, 'saas_alunos', id)); 
      } finally { 
        setSalvando(false); 
      }
    }
  }

  // ========== TELA DE BLOQUEIO (SEM TURMA SELECIONADA) ==========
  if (!turmaSelecionada) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-lg w-full p-10 rounded-3xl shadow-sm border border-gray-200 text-center flex flex-col items-center">
          <div className="bg-indigo-50 text-indigo-500 w-20 h-20 rounded-full flex items-center justify-center mb-6">
            <MonitorPlay size={40} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">Central de Alunos Bloqueada</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Para gerenciar matrículas, por favor, <b>selecione uma Instituição e uma Turma no menu superior</b>.
          </p>
        </div>
      </div>
    );
  }

  // ========== TELA DE GESTÃO DE ALUNOS ==========
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-indigo-600 transition-colors"><ArrowLeft size={24} /></Link>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-indigo-600" /> Gestão de Alunos da Turma
          </h2>
        </div>

        {mensagem && (
          <div className="p-4 rounded-lg bg-green-100 text-green-800 font-bold text-center border border-green-200">
            {mensagem}
          </div>
        )}

        {/* Formulário de Cadastro Rápido */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-black text-indigo-900 mb-6 border-b pb-4">Matricular Novo Aluno</h3>
          
          <form onSubmit={handleAddAluno} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Nome Completo *</label>
              <input required type="text" placeholder="Ex: Ana Silva" className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">E-mail</label>
              <input type="email" placeholder="ana@email.com" className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">WhatsApp</label>
              <input type="tel" placeholder="(11) 98888-7777" className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
            </div>

            <div className="md:col-span-1">
              <button type="submit" disabled={salvando} className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                <Plus size={20} /> Adicionar
              </button>
            </div>
          </form>
        </div>

        {/* Lista de Alunos (A Visão Mestre) */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h3 className="text-lg font-black text-gray-800">Alunos Matriculados</h3>
            <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">{alunos.length} alunos</span>
          </div>

          {alunos.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-gray-500 font-medium">Nenhum aluno matriculado nesta turma ainda.</p>
              <p className="text-sm text-gray-400 mt-1">Use o formulário acima para começar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alunos.map(aluno => (
                <div key={aluno.id} className="border border-gray-200 bg-white p-4 rounded-xl shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-colors">
                  <div className="mb-4">
                    <span className="font-black text-gray-800 block text-lg truncate" title={aluno.nome}>{aluno.nome}</span>
                    <div className="flex flex-col gap-1 mt-2">
                      {aluno.email && <span className="text-xs text-gray-500 flex items-center gap-1.5"><Mail size={14} className="text-gray-400"/> {aluno.email}</span>}
                      {aluno.whatsapp && <span className="text-xs text-gray-500 flex items-center gap-1.5"><MessageCircle size={14} className="text-green-500"/> {aluno.whatsapp}</span>}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-auto">
                    {/* Botão Ação Rápida WhatsApp */}
                    {aluno.whatsapp ? (
                      <a href={`https://wa.me/55${formatarZap(aluno.whatsapp)}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                        Chamar
                      </a>
                    ) : (
                      <span className="text-xs text-gray-300 italic">Sem WhatsApp</span>
                    )}
                    
                    {/* Botão Excluir */}
                    <button onClick={() => handleExcluirAluno(aluno.id)} disabled={salvando} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded transition-colors" title="Remover Aluno">
                      <Trash2 size={16}/>
                    </button>
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
