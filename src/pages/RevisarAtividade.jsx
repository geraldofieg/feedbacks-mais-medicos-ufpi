async function handleGerarIA() {
    if (respostaEstaVazia) return;
    setGerandoIA(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // 1. Usando o modelo de produção oficial (muito rápido e com cota de 1.500/dia livre)
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash", 
      });

      const promptCompleto = `
        Aja como um preceptor médico. Estilo: ${userProfile?.promptPersonalizado || 'Direto e técnico.'}
        QUESTÃO: ${tarefa?.enunciado}
        RESPOSTA: "${novaResposta}"
        Gere um feedback direto ao aluno.
      `;

      const result = await model.generateContent(promptCompleto);
      setFeedbackEditado(result.response.text());
    } catch (e) { 
      console.error("ERRO COMPLETO DA API:", e);
      // 2. Agora o erro real do Google vai aparecer na tela para você ler
      alert("A API recusou o pedido. Erro: " + e.message); 
    }
    finally { setGerandoIA(false); }
  }
