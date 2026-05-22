import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, X, FileEdit, AlertTriangle } from 'lucide-react';

interface PromptEditorProps {
  originalContent: string;
  onSave: (newContent: string) => void;
  onCancel: () => void;
  lang: 'uz' | 'en';
}

export const PromptEditor: React.FC<PromptEditorProps> = ({ originalContent, onSave, onCancel, lang }) => {
  const [content, setContent] = useState(originalContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isModified = content !== originalContent;
  const charCount = content.length;

  const t = {
    uz: {
      title: 'Promptni tahrirlash',
      save: 'Saqlash',
      cancel: 'Bekor qilish',
      modified: 'O\'zgartirilgan',
      unchanged: 'O\'zgarishsiz',
      characters: 'belgi',
      unsavedWarning: 'Saqlanmagan o\'zgarishlar mavjud',
    },
    en: {
      title: 'Edit Prompt',
      save: 'Save',
      cancel: 'Cancel',
      modified: 'Modified',
      unchanged: 'Unchanged',
      characters: 'characters',
      unsavedWarning: 'You have unsaved changes',
    },
  }[lang];

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 384)}px`; // max-h-96 = 384px
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [content, adjustHeight]);

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(0, 0);
    }
  }, []);

  const handleSave = () => {
    onSave(content);
  };

  const handleCancel = () => {
    onCancel();
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden transition-all duration-300 w-full">
      {/* Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20">
            <FileEdit className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-100 tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
            {t.title}
          </h3>
        </div>

        {/* Modified badge */}
        <div className="flex items-center gap-3">
          <span
            className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full border transition-all duration-300 flex items-center gap-1.5 ${
              isModified
                ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                : 'bg-slate-900/60 text-slate-500 border-slate-800/60'
            }`}
          >
            {isModified && <AlertTriangle className="w-3 h-3" />}
            {isModified ? t.modified : t.unchanged}
          </span>
        </div>
      </div>

      {/* Editor body */}
      <div className="p-4 sm:p-5">
        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm leading-relaxed p-4 sm:p-5 rounded-xl border border-slate-800/80 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none resize-none transition-all duration-300 max-h-96 overflow-y-auto"
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              minHeight: '120px',
            }}
            spellCheck={false}
          />

          {/* Character count */}
          <div className="absolute right-3 bottom-3 pointer-events-none">
            <span className="bg-slate-900/90 border border-slate-800 text-slate-400 text-[9px] sm:text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg">
              {charCount.toLocaleString()} {t.characters}
            </span>
          </div>
        </div>

        {/* Unsaved warning */}
        {isModified && (
          <div className="mt-3 flex items-center gap-2 text-amber-400/70 transition-all duration-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-[11px] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t.unsavedWarning}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons footer */}
      <div className="px-5 sm:px-6 py-4 border-t border-slate-800/80 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
        {/* Cancel button */}
        <button
          onClick={handleCancel}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <X className="w-4 h-4" />
          <span>{t.cancel}</span>
        </button>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/20 shimmer-btn"
          style={{
            fontFamily: 'Inter, sans-serif',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          }}
        >
          <Save className="w-4 h-4" />
          <span>{t.save}</span>
        </button>
      </div>
    </div>
  );
};
