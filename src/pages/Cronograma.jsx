import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, MonitorPlay, BookOpen, Clock, CheckCircle2, FileText, X } from 'lucide-react';
import { cronogramaAssincrono, cronogramaSincrono, getStatusData, getDiasRestantes } from '../data/cronogramaData';

export default function Cronograma() {
  const [abaAtiva, setAbaAtiva] = useState('assincrono');
  const [esconderPassados, setEsconderPassados] = useState(true);
  
  const [detalhesAdm, setDetalhesAdm] = useState(null);

  const formatarData = (dataIso) => {
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano.substring(2)}`;
  };

  const listaAssincrona = esconderPassados 
    ? cronogramaAssincrono.filter(item => getStatusData(item.inicio, item.fim) !== 'passado')
    : cronogramaAssincrono;

  const listaSincrona = esconderPassados 
    ? cronogramaSincrono.filter(item => getStatusData(item.inicio, item.fim) !== 'passado')
    : cronogramaSincrono;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors"><ArrowLeft size={24} /></Link>
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <CalendarDays className="text-blue-600" /> Cronograma Oficial
            </h2>
          </div>
          
          <button 
            onClick={() => setEsconderPassados(!esconderPassados)}
            className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors self-start md:self-auto ${esconderPassados ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
          >
            {esconderPassados ? '👁️ Mostrar Módulos Passados' : '🙈 Ocultar Passados'}
          </button>
        </div>

        {/* Abas Superiores */}
        <div className="flex gap-2 mb-8 bg-gray-200/50 p-1.5 rounded-2xl">
          <button onClick={() => setAbaAtiva('assincrono')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all ${abaAtiva === 'assincrono' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <BookOpen size={20} /> ASSÍNCRONO
          </button>
          <button onClick={() => setAbaAtiva('sincrono')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all ${abaAtiva === 'sincrono' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <MonitorPlay size={20} /> SÍNCRONO
          </button>
        </div>

        {/* LINHA DO TEMPO (Timeline) */}
        <div className="relative border-l-2 border-gray-200 ml-4 md:ml-8 pl-6 md:pl-10 space-y-8">
          
          {abaAtiva === 'assincrono' && listaAssincrona.map((item) => {
            const status = getStatusData(item.inicio, item.fim);
            const isAtual = status === 'atual';
            const diasRestantes = isAtual ? getDiasRestantes(item.fim) : 0;

            return (
              <div key={`async-${item.id}`} className={`relative p-5 rounded-2xl border transition-all ${isAtual ? 'bg-blue-50 border-blue-300 shadow-md transform scale-[1.02]' : 'bg-white border-gray-200'}`}>
                
                <div className={`absolute -left-[35px] md:-left-[51px] top-6 w-6 h-6 rounded-full border-4 border-gray-50 z-10 ${isAtual ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : status === 'passado' ? 'bg-gray-300' : 'bg-gray-200'}`}></div>

                {/* Botão discreto para a planilha Excel */}
                <button 
                  onClick={() => setDetalhesAdm({ tipo: 'assincrono', dados: item })}
                  className="absolute top-4 right-4 text-gray-400 hover:text-blue-600 flex items-center gap-1 text-xs font-bold transition-colors bg-gray-50 hover:bg-blue-100 px-2 py-1 rounded"
                >
                  <FileText size={14} /> Detalhes Adm
                </button>

                {isAtual && (
                  <span className="absolute -top-3 left-6 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <Clock size={12}/> EM ANDAMENTO (Faltam {diasRestantes} dias)
                  </span>
                )}
                {status === 'passado' && <span className="absolute -top-3 right-6 md:right-auto md:left-6 bg-gray-200 text-gray-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Concluído</span>}

                <div className={`mt-2 pr-24 ${status === 'passado' ? 'opacity-60' : ''}`}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{item.eixo}</p>
                  <h3 className={`text-xl font-black mb-2 ${isAtual ? 'text-blue-900' : 'text-gray-800'}`}>{item.modulo}</h3>
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-500 bg-gray-100/50 inline-flex px-3 py-1.5 rounded-lg border border-gray-100">
                    <CalendarDays size={16} />
                    {formatarData(item.inicio)} até {formatarData(item.fim)}
                  </div>
                </div>
              </div>
            );
          })}

          {abaAtiva === 'sincrono' && listaSincrona.map((item) => {
            const status = getStatusData(item.inicio, item.fim);
            const isAtual = status === 'atual';
            const diasRestantes = isAtual ? getDiasRestantes(item.fim) : 0;

            return (
              <div key={`sync-${item.semana}`} className={`relative p-5 rounded-2xl border transition-all ${isAtual ? 'bg-purple-50 border-purple-300 shadow-md transform scale-[1.02]' : 'bg-white border-gray-200'}`}>
                
                <div className={`absolute -left-[35px] md:-left-[51px] top-6 w-6 h-6 rounded-full border-4 border-gray-50 z-10 ${isAtual ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : status === 'passado' ? 'bg-gray-300' : 'bg-gray-200'}`}></div>

                {/* Botão discreto para a planilha Excel */}
                <button 
                  onClick={() => setDetalhesAdm({ tipo: 'sincrono', dados: item })}
                  className="absolute top-4 right-4 text-gray-400 hover:text-purple-600 flex items-center gap-1 text-xs font-bold transition-colors bg-gray-50 hover:bg-purple-100 px-2 py-1 rounded"
                >
                  <FileText size={14} /> Detalhes Adm
                </button>

                {isAtual && (
                  <span className="absolute -top-3 left-6 bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <Clock size={12}/> SEMANA ATUAL (Faltam {diasRestantes} dias)
                  </span>
                )}

                <div className={`mt-2 pr-24 ${status === 'passado' ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className={`text-xl font-black ${isAtual ? 'text-purple-900' : 'text-gray-800'}`}>Semana {item.semana}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-100/50 inline-flex px-2 py-1 mb-4 rounded-lg border border-gray-100">
                    <CalendarDays size={14} /> {formatarData(item.inicio)} a {formatarData(item.fim)}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="bg-white p-3 rounded-xl border border-gray-100 text-sm">
                      <span className="font-bold text-gray-400 text-xs uppercase block mb-1">Encontro 1 (Vídeo)</span>
                      <span className="font-medium text-gray-700">{item.tema1}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-gray-100 text-sm">
                      <span className="font-bold text-gray-400 text-xs uppercase block mb-1">Encontro 2 (Sala Invertida)</span>
                      <span className="font-medium text-gray-700">{item.tema2}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* MODAL ADMINISTRATIVO */}
        {detalhesAdm && (
          <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setDetalhesAdm(null)}>
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
              
              <div className="bg-gray-800 p-4 flex justify-between items-center text-white">
                <h3 className="font-bold flex items-center gap-2"><FileText size={18}/> Ficha Técnica Oficial (PDF)</h3>
                <button onClick={() => setDetalhesAdm(null)} className="text-gray-400 hover:text-white transition-colors"><X size={24}/></button>
              </div>

              <div className="p-6">
                {detalhesAdm.tipo === 'assincrono' && (
                  <div className="space-y-4">
                    <div>
                      {/* TÍTULO CORRIGIDO COM QUEBRA DE LINHA */}
                      <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Eixo e Módulo Oficial</span>
                      <p className="font-medium text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-200 whitespace-pre-line leading-relaxed shadow-inner">
                        {detalhesAdm.dados.tituloCompleto}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center">
                        <span className="block text-[10px] font-black text-blue-500 uppercase">Carga Horária</span>
                        <span className="text-lg font-black text-blue-900">{detalhesAdm.dados.ch}h</span>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center">
                        <span className="block text-[10px] font-black text-blue-500 uppercase">Créditos</span>
                        <span className="text-lg font-black text-blue-900">{detalhesAdm.dados.creditos}</span>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center">
                        <span className="block text-[10px] font-black text-blue-500 uppercase">Semanas</span>
                        <span className="text-lg font-black text-blue-900">{detalhesAdm.dados.semanas}</span>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center">
                        <span className="block text-[10px] font-black text-blue-500 uppercase">Duração</span>
                        <span className="text-lg font-black text-blue-900">{detalhesAdm.dados.dias} <span className="text-xs">dias</span></span>
                      </div>
                    </div>
                  </div>
                )}

                {detalhesAdm.tipo === 'sincrono' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                       <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-center">
                        <span className="block text-[10px] font-black text-purple-500 uppercase">Carga Horária (Módulo)</span>
                        <span className="text-lg font-black text-purple-900">90h</span>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-center">
                        <span className="block text-[10px] font-black text-purple-500 uppercase">Créditos (Módulo)</span>
                        <span className="text-lg font-black text-purple-900">6</span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Encontro 1 - Texto Integral</span>
                      <p className="text-sm font-medium text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100">{detalhesAdm.dados.tema1Completo}</p>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Encontro 2 - Texto Integral</span>
                      <p className="text-sm font-medium text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100">{detalhesAdm.dados.tema2Completo}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
