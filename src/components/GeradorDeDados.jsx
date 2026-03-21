import { useState } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function GeradorDeDados() {
  const { currentUser, userProfile, setEscolaSelecionada } = useAuth();
  const [gerando, setGerando] = useState(false);

  async function handleGerarDadosFake() {
    // Trava de segurança: só funciona no seu e-mail de teste
    if (currentUser?.email?.toLowerCase().trim() !== 'geraldonetomkt@gmail.com') {
      alert("Este script só pode ser rodado na conta de teste (geraldonetomkt@gmail.com).");
      return;
    }

    if (!window.confirm("Deseja gerar a base de dados de demonstração agora?")) return;

    setGerando(true);
    try {
      const uid = currentUser.uid;
      const profNome = userProfile?.nome || 'Dr. Geraldo';
      const telefonePadrao = '62 98405-4418';

      // 1. Criar Instituição
      const instRef = await addDoc(collection(db, 'instituicoes'), {
        nome: "Universidade de Ciências Médicas (Simulação)",
        professorUid: uid,
        dataCriacao: serverTimestamp(),
        status: 'ativo'
      });

      // Seleciona a instituição automaticamente no seu cache
      setEscolaSelecionada({ id: instRef.id, nome: "Universidade de Ciências Médicas (Simulação)" });

      // 2. Criar Turma
      const turmaRef = await addDoc(collection(db, 'turmas'), {
        nome: "Medicina de Família e Comunidade - Turma APS",
        instituicaoId: instRef.id,
        professorUid: uid,
        dataCriacao: serverTimestamp(),
        status: 'ativo'
      });

      // 3. Criar Tarefa
      const enunciadoFake = "CASO CLÍNICO: Família Silva procura a UBS. O patriarca, Sr. João (78 anos), foi diagnosticado com Alzheimer há 2 meses. A filha Maria (50 anos) é a cuidadora principal e relata exaustão física e emocional, além de conflitos com o irmão que não ajuda. \n\nPERGUNTA: Descreva a abordagem familiar utilizando a ferramenta Genograma e Ecomapa neste contexto. Quais os principais riscos para a cuidadora principal e como a equipe de Saúde da Família (eSF) pode intervir?";
      
      const tarefaRef = await addDoc(collection(db, 'tarefas'), {
        nomeTarefa: "Estudo de Caso: Genograma e Cuidado Familiar (Alzheimer)",
        enunciado: enunciadoFake,
        turmaId: turmaRef.id,
        instituicaoId: instRef.id,
        professorUid: uid,
        dataInicio: serverTimestamp(), // Como se fosse hoje
        dataFim: new Date(new Date().setDate(new Date().getDate() + 5)), // Vence em 5 dias
        atribuicaoEspecifica: false,
        alunosSelecionados: [],
        dataCriacao: serverTimestamp(),
        status: 'ativo'
      });

      // 4. Criar Alunos
      const nomesAlunos = [
        "Ana Carolina Silva", "Bruno Costa Barros", "Carlos Eduardo Souza", 
        "Daniela Oliveira Mendes", "Eduardo Santos Ferreira", "Fernanda Lima Gomes", 
        "Gabriel Almeida Rocha", "Helena Pereira Martins", "Igor Carvalho Nunes", "Julia Albuquerque"
      ];

      const alunosCriados = [];
      for (const nome of nomesAlunos) {
        const alunoRef = await addDoc(collection(db, 'alunos'), {
          nome: nome,
          whatsapp: telefonePadrao,
          turmaId: turmaRef.id,
          instituicaoId: instRef.id,
          professorUid: uid,
          dataCriacao: serverTimestamp(),
          status: 'ativo'
        });
        alunosCriados.push({ id: alunoRef.id, nome: nome });
      }

      // 5. Criar Atividades (Situações Mistas para o Vídeo)
      const criarAtividade = async (aluno, resposta, status, postado, temArquivo = false, nota = null) => {
        const payload = {
          alunoId: aluno.id,
          turmaId: turmaRef.id,
          instituicaoId: instRef.id,
          tarefaId: tarefaRef.id,
          professorUid: uid,
          resposta: resposta,
          status: status,
          nota: nota,
          feedbackSugerido: status === 'aprovado' ? "Excelente análise do caso, abordando perfeitamente a sobrecarga do cuidador." : "",
          feedbackFinal: status === 'aprovado' ? "Excelente análise do caso, abordando perfeitamente a sobrecarga do cuidador. Parabéns!" : "",
          postado: postado,
          dataCriacao: serverTimestamp(),
          nomeAluno: aluno.nome,
          nomeTarefa: "Estudo de Caso: Genograma e Cuidado Familiar (Alzheimer)",
          aluno: aluno.nome,
          tarefa: "Estudo de Caso: Genograma e Cuidado Familiar (Alzheimer)",
          modulo: "Estudo de Caso: Genograma e Cuidado Familiar (Alzheimer)",
          revisadoPor: profNome
        };

        if (status === 'aprovado') payload.dataAprovacao = serverTimestamp();
        if (postado) payload.dataPostagem = serverTimestamp();
        if (temArquivo) {
          payload.arquivoUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
          payload.nomeArquivo = "genograma_familia_silva.pdf";
        }

        await addDoc(collection(db, 'atividades'), payload);
      };

      // Aluno 0 e 1: Lançados (Sucesso Total)
      await criarAtividade(alunosCriados[0], "O genograma mapeia a estrutura e histórico de doenças. O ecomapa ajuda a ver a rede de apoio fraca de Maria. A eSF deve acolher Maria para evitar o adoecimento da cuidadora.", 'aprovado', true, false, "100");
      await criarAtividade(alunosCriados[1], "Abordagem com foco na prevenção de burnout familiar. Inserção em grupo de apoio da UBS.", 'aprovado', true, false, "95");

      // Aluno 2 e 3: Aguardando Revisão (Textos bons)
      await criarAtividade(alunosCriados[2], "Devemos usar o Ecomapa para tentar reconectar o irmão afastado e dividir as tarefas do cuidado do Sr. João.", 'pendente', false);
      await criarAtividade(alunosCriados[3], "O risco principal é a Síndrome do Cuidador. A equipe precisa fazer Visita Domiciliar focada não só no idoso, mas na filha.", 'pendente', false);

      // Aluno 4: Aguardando Revisão (Texto Ruim - Para você gerar a IA no vídeo)
      await criarAtividade(alunosCriados[4], "Acho que tem que dar remédio pro idoso dormir e mandar a filha descansar mais.", 'pendente', false);

      // Aluno 5: Aguardando Revisão (Arquivo Fake anexado - Para você mostrar no vídeo)
      await criarAtividade(alunosCriados[5], "", 'pendente', false, true);

      // Alunos 6, 7, 8 e 9: Não enviaram nada. (Ficarão pendentes na cobrança).

      alert("🎉 Sucesso! Instituição, Turma, Tarefa, Alunos e Respostas geradas. Atualize a página e vá para o seu Painel!");
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar dados.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="p-4 bg-purple-100 border-2 border-purple-500 rounded-xl mb-6 flex items-center justify-between">
      <div>
        <h3 className="font-black text-purple-900">Modo Gravação de Vídeo</h3>
        <p className="text-sm text-purple-700">Clique no botão para criar a Turma de Medicina (APS) com 10 alunos e cenários mistos.</p>
      </div>
      <button 
        onClick={handleGerarDadosFake} 
        disabled={gerando}
        className="bg-purple-600 text-white px-6 py-3 rounded-xl font-black shadow-lg hover:bg-purple-700 disabled:opacity-50 transition-all"
      >
        {gerando ? "Gerando Mágica..." : "Gerar Dados Fake Agora"}
      </button>
    </div>
  );
          }
