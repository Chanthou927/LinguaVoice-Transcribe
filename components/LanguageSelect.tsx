import React from 'react';
import { Language } from '../types';
import { Check } from 'lucide-react';

interface LanguageSelectProps {
  selected: Language;
  onSelect: (lang: Language) => void;
  disabled: boolean;
}

const LanguageSelect: React.FC<LanguageSelectProps> = ({ selected, onSelect, disabled }) => {
  return (
    <div className="flex gap-3 justify-center mb-6">
      {[Language.ENGLISH, Language.KHMER].map((lang) => (
        <button
          key={lang}
          onClick={() => onSelect(lang)}
          disabled={disabled}
          className={`
            relative px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-2
            ${selected === lang 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105' 
              : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {lang === Language.KHMER ? 'ភាសាខ្មែរ' : 'English'}
          {selected === lang && <Check size={16} className="animate-in fade-in zoom-in duration-300" />}
        </button>
      ))}
    </div>
  );
};

export default LanguageSelect;