import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, deleteField, increment } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, CheckCircle, User, Copy, 
  Send, Sparkles, GraduationCap, Search, RefreshCw, CheckCheck, Eraser,
  Lock, Settings, CalendarDays, RotateCcw, Trash2, MousePointer2, Paperclip, FileUp, FileCheck, ExternalLink, Brain
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { GoogleGenAI } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';

// Configurar o worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;


export default function RevisarAtividade() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [tarefa, setTarefa] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [atividadesMap, setAtividadesMap] = useState({});
  
  const [alunoSelecionadoId, setAlunoSelecionadoId] = useState(location.state?.alunoId || '');
  const [novaResposta, setNovaResposta] = useState('');
  const [feedbackEditado, setFeedbackEditado] = useState('');
  const [notaAluno, setNotaAluno] = useState(''); 
  
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [salvoFeedback, setSalvoFeedback] = useState(false);
  const [gerandoIA, setGerandoIA] = useState(false);
  const [marcandoPostado, setMarcandoPostado] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [arquivoUrl, setArquivoUrl] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState('');

  // 🔒 REGRAS PERMANENTES — nunca modificadas pelo aprendizado automático
  const [regrasPermanentes, setRegrasPermanentes] = useState('');

  // 📄 EXTRAÇÃO DE TEXTO DE WORD
  const [textoExtraidoDoc, setTextoExtraidoDoc] = useState('');
  const [erroLeituraDoc, setErroLeituraDoc] = useState(false); // true para .doc legado que não conseguimos ler

  // 🧠 APRENDIZADO DE ESTILO
  const [estiloAprendido, setEstiloAprendido] = useState('');
  const [promptAtivo, setPromptAtivo] = useState(''); // prompt unificado: base + estilo aprendido
  const [edicoesPendentes, setEdicoesPendentes] = useState(0);
  const [totalEdicoesIncorporadas, setTotalEdicoesIncorporadas] = useState(0);
  const [analisandoEstilo, setAnalisandoEstilo] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';
  const isPremium = userProfile?.plano === 'premium' || isAdmin;
  const isTier2 = userProfile?.plano === 'intermediario';
  const isTier1 = !isPremium && !isTier2;
  const respostaEstaVazia = novaResposta.trim().length === 0 && !arquivoUrl;

  const [promptVivo, setPromptVivo] = useState(userProfile?.promptPersonalizado || localStorage.getItem('@SaaS_PromptVivo') || '');
  
  useEffect(() => {
    if (location.state?.alunoId) {
      setAlunoSelecionadoId(location.state.alunoId);
    }
  }, [location.state?.alunoId]);

  useEffect(() => {
    async function buscarDadosDaEstacao() {
      setLoading(true);
      try {
        const snapTarefa = await getDoc(doc(db, 'tarefas', id));
        if (!snapTarefa.exists()) return navigate('/');
        const tarefaData = snapTarefa.data();
        setTarefa({ id: snapTarefa.id, ...tarefaData });

        const qAlunos = query(collection(db, 'alunos'), where('turmaId', '==', tarefaData.turmaId));
        const snapAlunos = await getDocs(qAlunos);
   
        let listaAlunos = snapAlunos.docs.map(d => ({ 
          id: d.id, ...d.data() 
        })).filter(a => a.status !== 'lixeira').sort((a, b) => a.nome.localeCompare(b.nome));

        if (tarefaData.atribuicaoEspecifica && Array.isArray(tarefaData.alunosSelecionados) && tarefaData.alunosSelecionados.length > 0) {
            listaAlunos = listaAlunos.filter(a => tarefaData.alunosSelecionados.includes(a.id));
        }

        setAlunos(listaAlunos);

        const qAtividades = query(collection(db, 'atividades'), 
where('tarefaId', '==', id));
        const snapAtividades = await getDocs(qAtividades);
        const mapa = {};
        snapAtividades.docs.forEach(d => { mapa[d.data().alunoId] = { id: d.id, ...d.data() }; });
        
        setAtividadesMap(mapa);

        // 🧠 Carregar dados de estilo aprendido do usuário
        const docRefUser = doc(db, 'usuarios', currentUser.uid);
        const docSnapUser = await getDoc(docRefUser);
        if (docSnapUser.exists()) {
          const dadosUser = docSnapUser.data();
          setEstiloAprendido(dadosUser?.estiloAprendido || '');
          setPromptAtivo(dadosUser?.promptAtivo || '');
          setRegrasPermanentes(dadosUser?.regrasPermanentes || '');
          setEdicoesPendentes(dadosUser?.edicoesPendentesAnalise || 0);
          setTotalEdicoesIncorporadas(dadosUser?.totalEdicoesIncorporadas || 0);
        }
      } catch (error) { 
        console.error(error);
      } 
      finally { setLoading(false); }
    }
    buscarDadosDaEstacao();
  }, [id, navigate]);

  useEffect(() => {
    if (userProfile?.promptPersonalizado) {
      setPromptVivo(userProfile.promptPersonalizado);
      localStorage.setItem('@SaaS_PromptVivo', userProfile.promptPersonalizado);
    }

    const sincronizarPrompt = (e) => {
      if (e.key === '@SaaS_PromptVivo' && e.newValue) {
        setPromptVivo(e.newValue);
        // Quando a professora edita o prompt base manualmente, o promptAtivo é resetado
        // para que seja gerado novamente na próxima destilação de estilo
        setPromptAtivo('');
      }
    };

    window.addEventListener('storage', sincronizarPrompt);
    return () => window.removeEventListener('storage', sincronizarPrompt);
  }, [userProfile]);

  const alunoAtual = alunoSelecionadoId ? alunos.find(a => a.id === alunoSelecionadoId) : null;
  const atividadeAtual = alunoAtual ? atividadesMap[alunoAtual.id] : null;

  useEffect(() => {
    setNovaResposta(atividadeAtual?.resposta || '');
    setFeedbackEditado(atividadeAtual?.feedbackFinal || atividadeAtual?.feedbackSugerido || '');
    setNotaAluno(atividadeAtual?.nota || '');
    setArquivoUrl(atividadeAtual?.arquivoUrl || '');
    setNomeArquivo(atividadeAtual?.nomeArquivo || '');
  }, [alunoSelecionadoId, atividadeAtual]);

  const renderizarComLinks = (texto) => {
    if (!texto) return "Sem enunciado.";
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const partes = texto.split(urlRegex);

    return partes.map((parte, i) => {
      if (parte.match(urlRegex)) {
        return (
          <a key={i} href={parte} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline break-all">
            {parte}
          </a>
        );
      }
      return parte;
    });
  };

  const extrairLinksDaResposta = (texto) => {
    if (!texto) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return texto.match(urlRegex) || [];
  };
  const linksNaResposta = extrairLinksDaResposta(novaResposta);

  async function handleUploadArquivo(e) {
    const file = e.target.files[0];
    if (!file || !alunoAtual) return;
    setUploading(true);
    setTextoExtraidoDoc('');
    setErroLeituraDoc(false);

    // 📄 Extração de texto de .docx diretamente no browser (mammoth)
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'docx') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const resultado = await mammoth.extractRawText({ arrayBuffer });
        setTextoExtraidoDoc(resultado.value || '');
      } catch (err) {
        console.error('Erro ao extrair texto do DOCX:', err);
        setTextoExtraidoDoc('');
      }
    } else if (ext === 'doc' || ext === 'rtf') {
      // .doc legado (binário) e .rtf não são legíveis no browser
      setErroLeituraDoc(true);
    }

    const storageRef = ref(storage, `atividades/${currentUser.uid}/${alunoAtual.id}_${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on('state_changed', null, (error) => { console.error(error); setUploading(false); }, 
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setArquivoUrl(url);
        setNomeArquivo(file.name);
        setUploading(false);
      }
    );
  }

  async function extractTextFromPdf(url) {
    try {
      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }
      return fullText;
    } catch (error) {
      console.error("Erro ao extrair texto do PDF:", error);
      return "[Não foi possível extrair o texto deste PDF]";
    }
  }

  async function handleGerarIA() {
    if (isTier1) {
      if (window.confirm("🔒 Deseja conhecer o Plano Premium para usar a IA?")) navigate('/planos');
      return;
    }
    if (!promptVivo) {
      if (window.confirm("Configure as suas instruções de correção antes.")) navigate('/configuracoes');
      return;
    }
    if (respostaEstaVazia) return;
    setGerandoIA(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      let textoEnunciado = tarefa?.enunciado || "";
      if (tarefa?.enunciadoArquivoUrl && tarefa?.enunciadoArquivoUrl.toLowerCase().includes('.pdf')) {
        const pdfText = await extractTextFromPdf(tarefa.enunciadoArquivoUrl);
        textoEnunciado += `\n\n[Conteúdo do PDF do Enunciado]:\n${pdfText}`;
      }

      let textoResposta = novaResposta || "";
      if (arquivoUrl) {
        const urlLower = arquivoUrl.toLowerCase();
        if (urlLower.includes('.pdf')) {
          const pdfText = await extractTextFromPdf(arquivoUrl);
          textoResposta += `\n\n[Conteúdo do PDF da Resposta]:\n${pdfText}`;
        } else if (textoExtraidoDoc) {
          // .docx extraído pelo mammoth durante o upload
          textoResposta += `\n\n[Conteúdo do documento Word da Resposta]:\n${textoExtraidoDoc}`;
        }
      }

      // 🎯 Usa o prompt unificado se existir, senão usa o prompt base — nunca os dois juntos
      const instrucoes = promptAtivo || promptVivo;
      // 🔒 Regras permanentes sempre vêm primeiro — imunes ao aprendizado automático
      const blocoRegras = regrasPermanentes.trim()
        ? `REGRAS PERMANENTES (prioridade máxima, nunca ignore):\n${regrasPermanentes.trim()}\n\n`
        : '';
      const promptCompleto = `Aja como um preceptor médico.
${blocoRegras}${instrucoes}

QUESTÃO: ${textoEnunciado}
RESPOSTA DO ALUNO: "${textoResposta}"

Gere um feedback pedagógico direto.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: promptCompleto,
      });
      setFeedbackEditado(response.text);
    } catch (e) { 
      console.error(e);
      alert("Erro ao ligar com a IA da Google. Verifique se os PDFs são muito grandes ou tente novamente.");
    }
    finally { setGerandoIA(false);
    }
  }

  // 📊 CÁLCULO DE SIMILARIDADE JACCARD — local, zero custo de token
  function calcularSimilaridadeJaccard(textoA, textoB) {
    if (!textoA || !textoB) return null;
    const tokenizar = (t) => new Set(
      t.toLowerCase()
       .replace(/[.,!?;:()\[\]"']/g, ' ')
       .split(/\s+/)
       .filter(w => w.length > 1)
    );
    const setA = tokenizar(textoA);
    const setB = tokenizar(textoB);
    if (setA.size === 0 || setB.size === 0) return null;
    const intersecao = new Set([...setA].filter(w => setB.has(w)));
    const uniao = new Set([...setA, ...setB]);
    return Math.round((intersecao.size / uniao.size) * 100);
  }

  // 🧠 ANÁLISE DE ESTILO EM BACKGROUND — roda a cada 3 edições reais da professora
  async function dispararAnaliseEstilo(feedbackOriginalIA, feedbackAprovado) {
    try {
      const docRefUser = doc(db, 'usuarios', currentUser.uid);
      const docSnap = await getDoc(docRefUser);
      const dadosUser = docSnap.data() || {};

      const edicoesRecentes = dadosUser.edicoesRecentes || [];
      const novoPar = {
        sugerido: feedbackOriginalIA || '',
        aprovado: feedbackAprovado,
      };
      const edicoesAtualizadas = [...edicoesRecentes, novoPar].slice(-3);
      const novoContador = (dadosUser.edicoesPendentesAnalise || 0) + 1;

      if (novoContador < 3) {
        // Acumula silenciosamente, sem chamar a IA ainda
        await updateDoc(docRefUser, {
          edicoesRecentes: edicoesAtualizadas,
          edicoesPendentesAnalise: novoContador,
        });
        setEdicoesPendentes(novoContador);
        return;
      }

      // Chegou a 3 edições: hora de destilar o estilo
      setAnalisandoEstilo(true);
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const estiloAtual = dadosUser.estiloAprendido || '';

      const promptAnalise = `Você é um analisador de estilo pedagógico.
Sua tarefa é atualizar um documento de "Estilo Aprendido" com base nos padrões de edição de uma professora de medicina.

ESTILO ATUAL REGISTRADO:
${estiloAtual || '(Nenhum estilo registrado ainda — crie do zero.)'}

PARES DE EDIÇÃO — feedback gerado pela IA versus versão final aprovada pela professora:
${edicoesAtualizadas.map((par, i) => `
--- Par ${i + 1} ---
IA sugeriu: "${par.sugerido}"
Professora aprovou: "${par.aprovado}"
`).join('')}

TAREFA: Analise o que a professora adicionou, removeu ou reformulou em cada par. Atualize o documento de estilo para capturar esses padrões.

REGRAS RÍGIDAS DE RESPOSTA:
• Máximo absoluto de 300 palavras
• Use bullet points curtos (•)
• Organize em tópicos: Tom, Estrutura, Expressões Preferidas, Expressões Evitadas, Comprimento
• Preserve o que estava correto no estilo anterior
• Adicione ou corrija apenas o que as novas edições ensinaram
• Responda SOMENTE o documento de estilo atualizado, sem explicações, sem preâmbulo`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: promptAnalise,
      });

      const novoEstilo = response.text.trim();
      const totalAnterior = dadosUser.totalEdicoesIncorporadas || 0;

      // 🔀 SEGUNDA CHAMADA: gerar o prompt unificado (base + estilo aprendido fundidos)
      // O prompt original da professora fica como âncora. O promptAtivo é o que a IA realmente usa.
      const promptOriginal = dadosUser.promptPersonalizado || promptVivo || '';
      let novoPromptAtivo = promptOriginal; // fallback seguro

      if (promptOriginal.trim()) {
        const promptFusao = `Você é um especialista em instrução pedagógica médica.

Você receberá dois inputs:
1. INSTRUÇÕES BASE: as diretrizes que a professora escreveu manualmente
2. ESTILO APRENDIDO: padrões detectados a partir das edições reais que ela fez nos feedbacks

Sua tarefa é criar um ÚNICO conjunto de instruções coerente, sem contradições, que incorpore os dois.

INSTRUÇÕES BASE DA PROFESSORA:
${promptOriginal}

ESTILO APRENDIDO DAS EDIÇÕES:
${novoEstilo}

REGRAS DE RESPOSTA:
• Escreva na segunda pessoa dirigida à IA que vai gerar os feedbacks ("Você deve...", "Sempre...", "Evite...")
• Máximo de 400 palavras
• Se houver contradição entre os dois inputs, o ESTILO APRENDIDO tem prioridade (ele reflete o comportamento real da professora)
• Preserve todas as instruções de conteúdo das INSTRUÇÕES BASE que não conflitem
• Responda SOMENTE as instruções unificadas, sem explicações, sem preâmbulo`;

        const responseFusao = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: promptFusao,
        });
        novoPromptAtivo = responseFusao.text.trim();
      }

      // ─── 3ª CHAMADA: gerar resumo do ciclo em linguagem simples ───────────
      const promptResumoCiclo = `Você é um assistente de análise pedagógica.
Analise o que foi aprendido neste ciclo de treinamento de IA e explique em 3-4 frases simples, na terceira pessoa, como se estivesse explicando para o professor o que a IA entendeu.

PARES DE EDIÇÃO ANALISADOS:
${edicoesAtualizadas.map((par, i) => `
Par ${i + 1}:
IA sugeriu: "${par.sugerido}"
Professor aprovou: "${par.aprovado}"
`).join('')}

NOVO ESTILO APRENDIDO:
${novoEstilo}

Escreva um resumo curto (máx 4 frases) explicando:
- O que a IA percebeu nas edições
- O que foi ajustado no estilo
- Em que direção o prompt evoluiu

Responda SOMENTE o resumo, sem título, sem preâmbulo.`;

      let resumoCiclo = 'Ciclo de aprendizado concluído.';
      try {
        const responseResumo = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: promptResumoCiclo,
        });
        resumoCiclo = responseResumo.text.trim();
      } catch (e) {
        console.error('Erro ao gerar resumo do ciclo:', e);
      }

      // ─── Salvar no histórico (máx 10 entradas) ─────────────────────────────
      const novaEntradaHistorico = {
        data: new Date().toISOString(),
        promptAtivo: novoPromptAtivo,
        estiloAprendido: novoEstilo,
        resumoCiclo,
        totalEdicoesNoCiclo: edicoesAtualizadas.length,
        avaliacaoUsuario: null, // null | 'aprovado' | 'rejeitado'
      };
      const historicoAtual = dadosUser.historicoPrompts || [];
      const novoHistorico = [novaEntradaHistorico, ...historicoAtual].slice(0, 10);

      await updateDoc(docRefUser, {
        estiloAprendido: novoEstilo,
        promptAtivo: novoPromptAtivo,
        historicoPrompts: novoHistorico,
        edicoesRecentes: [],
        edicoesPendentesAnalise: 0,
        totalEdicoesIncorporadas: totalAnterior + edicoesAtualizadas.length,
        ultimaAtualizacaoEstilo: serverTimestamp(),
      });

      setEstiloAprendido(novoEstilo);
      setPromptAtivo(novoPromptAtivo);
      setEdicoesPendentes(0);
      setTotalEdicoesIncorporadas(totalAnterior + edicoesAtualizadas.length);
    } catch (error) {
      console.error('Erro na análise de estilo:', error);
    } finally {
      setAnalisandoEstilo(false);
    }
  }

  async function handleSalvarRascunho() {
    if (salvando || !alunoAtual) return;
    setSalvando(true);
    try {
      const payload = { 
        resposta: novaResposta.trim(),
        arquivoUrl: arquivoUrl,
        nomeArquivo: nomeArquivo,
        feedbackFinal: feedbackEditado.trim(), 
        feedbackSugerido: atividadeAtual?.feedbackSugerido ||
(isPremium || isTier2 ? feedbackEditado.trim() : ''),
        nota: notaAluno.trim() ||
null, 
        status: atividadeAtual?.status === 'aprovado' ?
'aprovado' : 'pendente',
        nomeAluno: alunoAtual.nome, 
        nomeTarefa: tarefa.nomeTarefa,
        aluno: alunoAtual.nome,
        tarefa: tarefa.nomeTarefa,
        modulo: tarefa.nomeTarefa,
        revisadoPor: userProfile?.nome ||
currentUser?.email || 'Professor'
      };

      if (atividadeAtual?.status === 'aprovado') {
          payload.dataAprovacao = atividadeAtual.dataAprovacao;
      } else {
          if (atividadeAtual) {
              payload.dataAprovacao = deleteField();
          }
      }

      if (atividadeAtual) {
        await updateDoc(doc(db, 'atividades', atividadeAtual.id), payload);
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], ...payload, dataAprovacao: null } }));
      } else {
        const novaAtiv = { alunoId: alunoAtual.id, turmaId: tarefa.turmaId, instituicaoId: tarefa.instituicaoId, tarefaId: tarefa.id, dataCriacao: serverTimestamp(), postado: false, ...payload };
        const docRef = await addDoc(collection(db, 'atividades'), novaAtiv);
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { id: docRef.id, ...novaAtiv } }));
      }
      
      setSalvoFeedback(true);
      setTimeout(() => setSalvoFeedback(false), 2000);
    } catch (error) { console.error(error); } finally { setSalvando(false); }
  }

  async function handleAprovar(copiarAoAprovar = false) {
    if (salvando || !alunoAtual) return;
    setSalvando(true);
    try {
      const payload = { 
        resposta: novaResposta.trim(),
        feedbackFinal: feedbackEditado.trim(), 
        status: 'aprovado', 
        dataAprovacao: serverTimestamp(),
        aluno: alunoAtual.nome,
        tarefa: tarefa.nomeTarefa,
        modulo: tarefa.nomeTarefa,
        revisadoPor: userProfile?.nome ||
currentUser?.email || 'Professor'
      };

      // 📊 Calcular e salvar similaridade Jaccard
      const feedbackSugeridoParaSimilaridade = atividadeAtual?.feedbackSugerido || '';
      if (feedbackSugeridoParaSimilaridade.trim() !== '') {
        const score = calcularSimilaridadeJaccard(feedbackSugeridoParaSimilaridade, feedbackEditado.trim());
        if (score !== null) payload.similaridadeIA = score;
      }
      
      if (atividadeAtual) {
        await updateDoc(doc(db, 'atividades', atividadeAtual.id), payload);
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], ...payload } }));
      } else {
        const novaAtiv = { 
          alunoId: alunoAtual.id, 
          turmaId: tarefa.turmaId, 
          instituicaoId: tarefa.instituicaoId, 
          tarefaId: tarefa.id, 
          dataCriacao: serverTimestamp(), 
          postado: false, 
          ...payload 
   
        };
        const docRef = await addDoc(collection(db, 'atividades'), novaAtiv);
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { id: docRef.id, ...novaAtiv } }));
      }

      if (copiarAoAprovar) { 
        navigator.clipboard.writeText(feedbackEditado.trim()); 
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }

      // 🧠 Disparar análise de estilo em background se a professora editou o feedback da IA
      const feedbackSugerido = atividadeAtual?.feedbackSugerido || '';
      const foiEditadoPelaProf = feedbackSugerido.trim() !== '' && feedbackEditado.trim() !== feedbackSugerido.trim();
      if (foiEditadoPelaProf && (isPremium || isTier2)) {
        dispararAnaliseEstilo(feedbackSugerido, feedbackEditado.trim());
      }
    } catch (error) { console.error(error); } finally { setSalvando(false);
    }
  }

  async function handleMarcarPostado() {
    if (marcandoPostado || !atividadeAtual) return;
    setMarcandoPostado(true);
    try {
      await updateDoc(doc(db, 'atividades', atividadeAtual.id), { postado: true, dataPostagem: serverTimestamp() });
      setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], postado: true } }));
    } catch (error) { console.error(error); } finally { setMarcandoPostado(false);
    }
  }

  async function handleDevolverRevisao() {
    if (!window.confirm("Deseja devolver esta atividade para a fase de revisão?")) return;
    setSalvando(true);
    try {
        await updateDoc(doc(db, 'atividades', atividadeAtual.id), { status: 'pendente', postado: false, dataAprovacao: deleteField() });
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], status: 'pendente', postado: false, dataAprovacao: null } }));
    } catch (e) { console.error(e);
    } finally { setSalvando(false); }
  }

  async function handleExcluirAtividade() {
    if (!window.confirm("ATENÇÃO: Vai excluir a resposta do aluno. Continuar?")) return;
    setSalvando(true);
    try {
        await deleteDoc(doc(db, 'atividades', atividadeAtual.id));
        setAtividadesMap(prev => { const newMap = { ...prev }; delete newMap[alunoAtual.id]; return newMap; });
        setNovaResposta(''); setFeedbackEditado(''); setNotaAluno(''); setArquivoUrl('');
    } catch (e) { console.error(e); } finally { setSalvando(false); }
  }

  const isStep1Done = !!(novaResposta || arquivoUrl);
  const isStep2Done = atividadeAtual?.status === 'aprovado' || atividadeAtual?.postado;
  const isStep3Done = atividadeAtual?.postado;
  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans">
      
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 self-start md:self-auto">
             <Link to="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><ArrowLeft size={20} /></Link>
    
             
            <div>
               <h2 className="text-lg font-black text-slate-900 line-clamp-2 leading-tight max-w-[280px] sm:max-w-full">{tarefa?.nomeTarefa}</h2>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Estação de Trabalho</p>
             </div>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-2xl w-full md:w-[450px]">
  
            <Search size={16} className="text-blue-500" />
            <select 
              className="bg-transparent font-black text-slate-700 outline-none w-full cursor-pointer text-xs md:text-sm"
              value={alunoSelecionadoId}
              onChange={(e) => setAlunoSelecionadoId(e.target.value)}
            >
           
               <option value="">Buscar Aluno na Lista...</option>
              {alunos.map(a => {
                const registro = atividadesMap[a.id];
                let icone = '🔴'; 
                
                if (registro) {
                  if (registro.postado) {
                    icone = '✅';
                  } else if (registro.status === 'aprovado') {
                    icone = '🟡';
                  } else {
                    const temConteudo = (registro.resposta && registro.resposta.trim() !== '') ||
registro.arquivoUrl;
                    icone = temConteudo ? '🟡' : '🔴';
                  }
                }
                return <option key={a.id} value={a.id}>{icone} {a.nome}</option>;
              })}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6 md:mt-10">
        
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-8 mb-6">
          <div className="flex items-center justify-between relative px-4 md:px-12">
            <div 
className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-1 bg-slate-100 -z-10 rounded-full"></div>
            
            <div className={`absolute left-10 top-1/2 -translate-y-1/2 h-1 transition-all duration-500 -z-10 rounded-full ${
              isStep2Done ?
'w-[calc(100%-5rem)] bg-green-500' : (isStep1Done ? 'w-1/2 bg-green-500' : 'w-0')
            }`}></div>

            <div className={`flex flex-col items-center gap-2 bg-white px-3 ${!alunoAtual ?
'text-slate-400' : (isStep1Done ? 'text-green-600' : 'text-blue-600')}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-colors ${!alunoAtual ?
'bg-slate-100 text-slate-400 border-2 border-slate-200' : (isStep1Done ? 'bg-green-500 text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-50')}`}>
                {isStep1Done ?
'✓' : '1'}
              </div>
              <span className="text-[10px] md:text-xs uppercase font-black tracking-widest text-center leading-tight">1.
Resposta do Aluno</span>
            </div>

            <div className={`flex flex-col items-center gap-2 bg-white px-3 ${!isStep1Done ?
'text-slate-400' : (isStep2Done ? 'text-green-600' : 'text-amber-500')}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-colors ${!isStep1Done ?
'bg-slate-100 text-slate-400 border-2 border-slate-200' : (isStep2Done ? 'bg-green-500 text-white shadow-lg' : 'bg-amber-400 text-white shadow-lg ring-4 ring-amber-50')}`}>
                {isStep2Done ?
'✓' : '2'}
              </div>
              <span className="text-[10px] md:text-xs uppercase font-black tracking-widest text-center leading-tight">2.
Área de Feedback</span>
            </div>

            <div className={`flex flex-col items-center gap-2 bg-white px-3 ${!isStep2Done ?
'text-slate-400' : (isStep3Done ? 'text-green-600' : 'text-blue-600')}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-colors ${!isStep2Done ?
'bg-slate-100 text-slate-400 border-2 border-slate-200' : (isStep3Done ? 'bg-green-500 text-white shadow-lg' : 'bg-blue-500 text-white shadow-lg ring-4 ring-blue-50')}`}>
                {isStep3Done ?
'✓' : '3'}
              </div>
              <span className="text-[10px] md:text-xs uppercase font-black tracking-widest text-center leading-tight">3.
Pronto p/ Postar</span>
            </div>
          </div>
        </div>

        {!alunoAtual ?
(
          <div className="bg-white p-12 md:p-24 rounded-[48px] border-2 border-dashed border-slate-200 shadow-sm flex flex-col items-center">
            <div className="flex flex-col items-center mb-10 text-center animate-in fade-in slide-in-from-top-4 duration-700">
              <div className="bg-blue-100 text-blue-600 p-4 rounded-full mb-4">
                <MousePointer2 size={32} />
              </div>
       
               <h3 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mb-4">A esteira de revisão está vazia</h3>
              <div className="text-slate-600 max-w-md text-left space-y-3 bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm text-lg font-medium">
                {/* 🔥 TEXTO ATUALIZADO AQUI 🔥 */}
                <p><strong className="text-blue-600">1.</strong> Selecione um aluno pendente no menu acima.</p>
          
               <p><strong className="text-amber-500">2.</strong> Cole a resposta dele aqui no sistema.</p>
                <p><strong className="text-green-600">3.</strong> Avalie e aprove para movê-lo para a lista final.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 
gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-6 md:p-10 space-y-12">
                  <section>
                    <h4 className="text-xs font-black text-slate-900 uppercase mb-4">1. Enunciado</h4>
                    <div className="bg-slate-50 p-6 md:p-8 rounded-2xl text-slate-700 leading-relaxed font-medium text-lg whitespace-pre-wrap">
                      {tarefa?.enunciado ? renderizarComLinks(tarefa.enunciado) : (!tarefa?.enunciadoArquivoUrl && "Sem enunciado.")}
                      
                      {tarefa?.enunciadoArquivoUrl && (
                        <div className="mt-4">
                          <a href={tarefa.enunciadoArquivoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider hover:bg-blue-100 transition-colors border border-blue-200">
                            <Paperclip size={16}/> {tarefa.enunciadoArquivoNome || 'Ver Anexo do Enunciado'} <ExternalLink size={14}/>
                          </a>
                        </div>
                      )}
                    </div>
                  </section>
           
                  <section>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase">2. Resposta do Aluno</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                          Cole o texto ou anexe um arquivo (Máx: 5MB). 
                          <a href="https://www.ilovepdf.com/pt/comprimir_pdf" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 hover:underline inline-flex items-center gap-0.5 ml-1 transition-colors" title="Abrir site para reduzir o tamanho do PDF">
                            <ExternalLink size={10} /> Reduzir PDF
                          </a>
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {arquivoUrl ? (
                          <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-200 shadow-sm">
                            <a href={arquivoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline cursor-pointer" title="Clique para visualizar/baixar o arquivo">
                              <FileCheck size={14}/>
                              <span className="text-[10px] font-black uppercase truncate max-w-[100px]">{nomeArquivo || "Arquivo Anexado"}</span>
                            </a>
                            <button onClick={() => { setArquivoUrl(''); setNomeArquivo(''); }} className="hover:text-red-500 ml-1 border-l border-green-200 pl-2" title="Remover anexo"><Trash2 size={14}/></button>
                          </div>
                        ) : (
                          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${uploading ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}>
                            {uploading ? <RefreshCw size={14} className="animate-spin"/> : <FileUp size={14}/>}
                            <span className="text-[10px] font-black uppercase">{uploading ? 'Subindo...' : 'Anexar PDF/DOC'}</span>
                            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.rtf,.txt" onChange={handleUploadArquivo} disabled={uploading}/>
                          </label>
                        )}
              
                        <button onClick={() => { setNovaResposta(''); setArquivoUrl(''); setNomeArquivo(''); setTextoExtraidoDoc(''); setErroLeituraDoc(false); }} className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1">
                          <Eraser size={14}/> Limpar
                        </button>
                      </div>
                    </div>
                    
                    <textarea rows="14" placeholder="Cole a resposta aqui..." className="w-full p-6 md:p-8 rounded-[24px] border-2 border-slate-100 bg-white text-slate-800 font-medium focus:border-blue-500 outline-none text-lg" value={novaResposta} onChange={(e) => setNovaResposta(e.target.value)}/>
                    
                    {/* ⚠️ Aviso para .doc/.rtf legado que não conseguimos ler */}
                    {erroLeituraDoc && (
                      <div className="mt-4 p-5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <span className="text-amber-500 text-lg shrink-0">⚠️</span>
                          <div>
                            <p className="text-xs font-black text-amber-800 uppercase tracking-widest mb-1">Formato não suportado para leitura automática</p>
                            <p className="text-xs font-medium text-amber-700 leading-relaxed">
                              Arquivos <strong>.doc</strong> e <strong>.rtf</strong> (Word antigo) não podem ser lidos automaticamente pela IA neste formato.
                              Para que a IA consiga analisar a resposta do aluno, converta o arquivo para <strong>PDF ou .docx</strong> antes de anexar.
                            </p>
                            <div className="mt-3 flex flex-col gap-2">
                              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Como converter:</p>
                              <div className="flex flex-wrap gap-2">
                                <a href="https://www.ilovepdf.com/pt/word_para_pdf" target="_blank" rel="noopener noreferrer"
                                   className="inline-flex items-center gap-1.5 bg-white text-amber-700 border border-amber-300 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-amber-100 transition-colors">
                                  <ExternalLink size={10}/> 1. Abrir iLovePDF — Word para PDF
                                </a>
                              </div>
                              <p className="text-[10px] text-amber-600 font-medium leading-relaxed">
                                Acesse o link → arraste o arquivo .doc → clique em "Converter para PDF" → baixe o PDF → anexe aqui no lugar do arquivo atual.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ✅ Confirmação de leitura bem-sucedida de .docx */}
                    {textoExtraidoDoc && !erroLeituraDoc && (
                      <div className="mt-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                        <span className="text-emerald-600 text-sm">✅</span>
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                          Texto do Word extraído com sucesso — a IA conseguirá ler a resposta
                        </p>
                      </div>
                    )}

                    {linksNaResposta.length > 0 && (
                      <div className="mt-4 p-5 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col gap-3 shadow-inner">
                        <span className="text-[10px] font-black text-indigo-800 uppercase tracking-widest flex items-center gap-2">
                          <ExternalLink size={14} /> Links detectados na resposta do aluno:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {linksNaResposta.map((link, idx) => (
                            <a key={idx} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-white hover:bg-indigo-600 bg-white px-4 py-2 rounded-xl border border-indigo-200 shadow-sm transition-all truncate max-w-full">
                               Abrir Link {linksNaResposta.length > 1 ? idx + 1 : ''} <ArrowLeft size={14} className="rotate-180"/>
                            </a>
                          ))}
                        </div>
                        <p className="text-[9px] text-indigo-400 font-bold italic">Nota: Caixas de texto não permitem cliques diretos. Use os botões acima para abrir os arquivos do aluno.</p>
                      </div>
                    )}
                  </section>
              </div>
            </div>

     
        <div className="lg:col-span-4 lg:sticky lg:top-24">
              <div className="bg-slate-900 rounded-[32px] p-6 md:p-8 text-white shadow-2xl">
                <div className="mb-6">
                  <h3 className="text-xl font-black flex items-center gap-3 mb-6"><CheckCircle className="text-green-400" size={24}/>Avaliação</h3>
                  <button onClick={handleGerarIA} disabled={gerandoIA ||
respostaEstaVazia} className="w-full py-4 rounded-2xl font-black text-sm bg-gradient-to-r from-indigo-600 to-blue-600 mb-4 flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/20 active:scale-95 transition-transform">
                    {gerandoIA ?
<RefreshCw className="animate-spin" size={18}/> : <Sparkles size={18}/>} Gerar Feedback IA
                  </button>

                  {/* 🧠 Badge de Aprendizado de Estilo */}
                  {(isPremium || isTier2) && (
                    <div className={`mb-4 px-4 py-3 rounded-2xl border flex items-center gap-3 text-xs font-bold transition-all ${
                      analisandoEstilo
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 animate-pulse'
                        : estiloAprendido
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}>
                      <Brain size={14} className="shrink-0" />
                      <span className="leading-tight">
                        {analisandoEstilo
                          ? 'Atualizando instruções da IA...'
                          : promptAtivo
                          ? `Instruções otimizadas ativas · ${totalEdicoesIncorporadas} edições incorporadas${edicoesPendentes > 0 ? ` · ${3 - edicoesPendentes} p/ próx. atualização` : ''}`
                          : estiloAprendido
                          ? `Estilo aprendido · gerando instruções unificadas...`
                          : `IA usando instruções base · ${edicoesPendentes > 0 ? `${3 - edicoesPendentes} edições p/ otimizar` : 'edite e aprove 3 feedbacks p/ otimizar'}`
                        }
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-6">
                  <textarea rows="10" placeholder="Feedback aparecerá aqui..." className="w-full bg-slate-800 rounded-2xl p-5 text-sm text-slate-100 outline-none resize-none focus:ring-2 focus:ring-indigo-500 transition-all" value={feedbackEditado} onChange={e => setFeedbackEditado(e.target.value)}/>
    

                   <input type="text" placeholder="Nota" className="bg-slate-800 p-4 rounded-2xl font-black text-white w-full outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={notaAluno} onChange={e => setNotaAluno(e.target.value)}/>
                  
                  {atividadeAtual?.postado ?
(
                      <div className="w-full bg-green-500/20 text-green-400 py-4 rounded-2xl text-xs font-black flex justify-center items-center gap-2 border border-green-500/30"><CheckCheck size={18}/> LANÇADO OFICIALMENTE</div>
                  ) : atividadeAtual?.status === 'aprovado' ?
(
                        <div className="pt-4 border-t border-slate-800 space-y-4">
                          <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="bg-green-500 text-white rounded-full p-1.5 shrink-0 
mt-0.5">
                              <CheckCircle size={18} />
                            </div>
                            <div>
            
                  <h4 className="text-green-400 font-black text-sm tracking-wide">PASSO 3 LIBERADO!</h4>
                              <p className="text-green-500/80 text-xs font-bold mt-1 leading-snug">Feedback aprovado. Copie o texto abaixo e encerre a tarefa.</p>
                            </div>
    
                      </div>

                          <div className="space-y-3">
                            <button onClick={() => handleAprovar(true)} className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl text-sm flex justify-center items-center gap-2 hover:bg-slate-100 transition-colors"><Copy size={18}/> {copiado ?
'Copiado!' : '1. Copiar Feedback'}</button>
                            <button onClick={handleMarcarPostado} disabled={marcandoPostado} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl text-sm flex justify-center items-center gap-2 shadow-xl hover:bg-indigo-700 transition-colors"><Send size={18}/> 2. Marcar Oficial (Move p/ Histórico)</button>
                          </div>
                   
     </div>
                  ) : (
                        <div className="grid grid-cols-2 gap-3">
                           <button onClick={handleSalvarRascunho} disabled={salvando || (!feedbackEditado && !novaResposta && !arquivoUrl)} className="bg-slate-800 py-3.5 rounded-2xl text-xs font-black border border-slate-700 hover:bg-slate-700 transition-colors leading-tight px-2">
  
                            {salvoFeedback ? '✅ Salvo!' : '💾 Salvar (Mantém na Revisão)'}
                           </button>

                          <button onClick={() => handleAprovar(true)} disabled={salvando ||
!feedbackEditado} className="bg-blue-600 py-3.5 rounded-2xl text-xs font-black hover:bg-blue-700 transition-colors leading-tight px-2">🚀 Aprovar (Move p/ Postar)</button>
                        </div>
                  )}

                  {atividadeAtual && (
                    <div className="mt-8 border-t border-slate-800 pt-8 
space-y-3">
                       <button onClick={handleDevolverRevisao} disabled={salvando} className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-amber-500 py-2 hover:bg-amber-500/10 rounded-lg transition-colors"><RotateCcw size={14}/> Devolver p/ Revisão</button>
                        <button onClick={handleExcluirAtividade} disabled={salvando} className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-red-500 py-2 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={14}/> Excluir Resposta</button>
                  
  </div>
                 )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
