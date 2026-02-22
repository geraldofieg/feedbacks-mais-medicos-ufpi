import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, CheckCircle, FileText, ExternalLink, User } from 'lucide-react';

export default function RevisarAtividade() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [atividade, setAtividade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedbackEditado, setFeedbackEditado] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function buscarAtividade() {
      try {
        const docRef = doc(db, 'atividades', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const dados = docSnap.data();
          setAtividade({ id: docSnap.id, ...dados });
          setFeedbackEditado(dados.feedbackSugerido || '');
        } else {
          console.log("Atividade não encontrada!");
        }
      } catch (error) {
        console.error("Erro ao buscar:", error);
      } finally {
        setLoading(false);
      }
    }
    buscarAtividade();
  }, [id]);

  async function handleAprovar() {
    setSalvando(true);
    try {
      const docRef = doc(db, 'atividades', id);
      await updateDoc(docRef, {
        feedbackFinal: feedbackEditado,
        status: 'aprovado',
        dataAprovacao: new Date()
      });
      navigate
      
