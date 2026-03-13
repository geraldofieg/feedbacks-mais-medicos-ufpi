async function handleGerarIA() {
    if (respostaEstaVazia) return;
    setGerandoIA(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // MUDANÇA 1: Usando o modelo de produção oficial do Google
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash", 
        // MUDANÇA 2: Comentei a ferramenta de busca temporariamente para testarmos
        // tools: [{ googleSearch: {} }] 
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
      // MUDANÇA 3: Mostrando a mensagem real de erro do Google na tela
      alert("A API recusou o pedido. Erro: " + e.message); 
    }
    finally { setGerandoIA(false); }
  }
