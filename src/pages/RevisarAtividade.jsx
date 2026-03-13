async function handleGerarIA() {
    if (respostaEstaVazia) return;
    setGerandoIA(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Adicionamos o sufixo "-latest" para o Google reconhecer o modelo em qualquer região e evitar o Erro 404
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash-latest", 
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
      alert("A API recusou o pedido. Erro: " + e.message); 
    }
    finally { setGerandoIA(false); }
  }
