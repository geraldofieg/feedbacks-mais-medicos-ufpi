import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export default function Breadcrumb({ items }) {
  return (
    <nav className="flex items-center text-xs sm:text-sm font-medium text-gray-500 mb-6 bg-gray-50/80 p-3 rounded-xl border border-gray-100 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden shadow-sm">
      
      {/* Ícone da Casinha (Início) */}
      <Link to="/" className="text-gray-400 hover:text-blue-600 transition-colors flex items-center justify-center shrink-0">
        <Home size={16} />
      </Link>

      {/* Rastro de Navegação (As migalhas) */}
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex items-center shrink-0">
            <ChevronRight size={16} className="text-gray-300 mx-1.5" />
            
            {/* Se for o último item da lista, fica em negrito e não é clicável. Se não, vira um link azul */}
            {isLast || !item.path ? (
              <span className="text-gray-800 font-bold">{item.label}</span>
            ) : (
              <Link to={item.path} className="hover:text-blue-600 transition-colors">
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
