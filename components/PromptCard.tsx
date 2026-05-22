import React, { useState, useRef, useEffect } from 'react';
import { GeneratedPrompt } from '../types';

interface PromptCardProps {
  index: number;
  prompt: GeneratedPrompt;
  lang: 'en' | 'uz';
  aspectRatio?: string;
  onEditPrompt?: (id: number, newContent: string) => void;
}

const getCountryCode = (panel: any): string => {
  if (panel.countryCode && typeof panel.countryCode === 'string') {
    const code = panel.countryCode.trim();
    if (code.length === 2) {
      return code.toLowerCase();
    }
  }
  if (panel.flagEmoji && typeof panel.flagEmoji === 'string') {
    const emoji = panel.flagEmoji.trim();
    if (emoji.length === 2) {
      return emoji.toLowerCase();
    }
    try {
      const codePoints = Array.from(emoji).map((char: string) => char.codePointAt(0));
      if (codePoints.length >= 2 && codePoints.every(cp => cp && cp >= 127397 && cp <= 127487)) {
        return codePoints.map(cp => String.fromCharCode(cp! - 127397)).join('').toLowerCase();
      }
    } catch (e) {
      // Fallback
    }
  }
  return '';
};

/** Parse a follower/stat string to a rough numeric value for bar widths */
const parseStatToNumber = (stat: string): number => {
  const cleaned = stat.replace(/[^0-9.BMKTbmkt]/g, '');
  let num = parseFloat(cleaned) || 0;
  if (/[Tt]/i.test(stat)) num *= 1_000_000_000_000;
  else if (/[Bb]/i.test(stat)) num *= 1_000_000_000;
  else if (/[Mm]/i.test(stat)) num *= 1_000_000;
  else if (/[Kk]/i.test(stat)) num *= 1_000;
  return num;
};

export const PromptCard: React.FC<PromptCardProps> = ({ index, prompt, lang, aspectRatio = '16:9 Landscape', onEditPrompt }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'prompt'>('preview');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(prompt.content);
  const [isExpanded, setIsExpanded] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const element = document.createElement("a");
    const file = new Blob([prompt.content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `infographic-prompt-${index + 1}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadJson = () => {
    const element = document.createElement("a");
    const file = new Blob([JSON.stringify(prompt, null, 2)], { type: 'application/json;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `infographic-prompt-${index + 1}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleSaveEdit = () => {
    if (onEditPrompt) {
      onEditPrompt(prompt.id, editContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(prompt.content);
    setIsEditing(false);
  };

  const t = {
    en: {
      imagePrompt: `Image ${index + 1} of 15`,
      copy: 'Copy',
      copied: 'Copied!',
      visualPreview: 'Visual Draft',
      rawPrompt: 'Raw Prompt',
      shieldTooltip: 'Shield-shaped flag with silver metallic border',
      portraitFrame: 'Parchment Portrait Frame',
      hoverToSee: 'Hover over portraits to see detailed art descriptions',
      master: 'Template',
      downloadTxt: 'TXT',
      downloadJson: 'JSON',
      exports: 'Exports',
      edit: 'Edit',
      save: 'Save',
      cancel: 'Cancel',
      editing: 'Editing prompt...',
      modified: 'Modified',
      charCount: 'chars',
      rank: 'Rank'
    },
    uz: {
      imagePrompt: `${index + 1}-Rasm (15 dan)`,
      copy: "Nusxa",
      copied: 'Nusxalandi!',
      visualPreview: 'Vizual Andoza',
      rawPrompt: 'Matn',
      shieldTooltip: 'Kumush hoshiyali qalqonsimon bayroq',
      portraitFrame: "Qog'oz uslubidagi rasm",
      hoverToSee: "Tafsilotlarni ko'rish uchun rasm ustiga olib boring",
      master: 'Namuna',
      downloadTxt: 'TXT',
      downloadJson: 'JSON',
      exports: 'Eksport',
      edit: 'Tahrir',
      save: 'Saqlash',
      cancel: 'Bekor',
      editing: 'Prompt tahrirlanmoqda...',
      modified: "O'zgartirilgan",
      charCount: 'belgi',
      rank: "O'rin"
    }
  }[lang];

  // Safe fallback if panels are not generated or incomplete
  const panels = prompt.panels || [];

  // Calculate stat bar widths based on relative values within this card
  const statValues = panels.map(p => parseStatToNumber(p.statistic));
  const maxStat = Math.max(...statValues, 1);
  const barWidths = statValues.map(v => Math.max(8, (v / maxStat) * 100));

  // Rank numbers (each card has 3 panels: index*3+1, index*3+2, index*3+3)
  const rankStart = index * 3 + 1;

  // Aspect ratio class selection
  let containerAspectClass = "aspect-video w-full grid grid-cols-3 gap-1.5 p-2 bg-slate-950/80 rounded-xl border border-slate-800 shadow-inner";

  if (aspectRatio === '9:16 Portrait') {
    containerAspectClass = "aspect-[9/16] w-full max-w-xs mx-auto grid grid-cols-1 grid-rows-3 gap-1.5 p-2 bg-slate-950/80 rounded-xl border border-slate-800 shadow-2xl";
  } else if (aspectRatio === '1:1 Square') {
    containerAspectClass = "aspect-square w-full max-w-sm mx-auto grid grid-cols-3 gap-1.5 p-2 bg-slate-950/80 rounded-xl border border-slate-800 shadow-inner";
  }

  return (
    <div className={`glass-panel glass-panel-hover rounded-3xl overflow-hidden card-reveal card-reveal-delay-${Math.min(index + 1, 15)}`}>
      {/* Header with Switch Tabs */}
      <div className="bg-slate-900/60 px-5 py-3.5 border-b border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-extrabold text-sm shadow-lg shadow-indigo-500/20 flex-shrink-0">
            #{index + 1}
            {/* Tiny rank range indicator */}
            <span className="absolute -bottom-1 -right-1 bg-slate-900 border border-slate-700 text-[7px] text-slate-400 font-mono px-1 py-0.5 rounded">
              {rankStart}-{rankStart + 2}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-100 truncate">
              {t.imagePrompt}
            </h3>
            {panels.length > 0 && (
              <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                {panels.map((p, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-indigo-500 mx-1">→</span>}
                    <span>{p.flagEmoji || ''} {p.country}</span>
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-200 transition px-2 py-1.5 rounded-lg hover:bg-slate-800/60"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▲' : '▼'}
          </button>

          {/* Tab Button Toggles */}
          <div className="bg-slate-950/50 p-0.5 rounded-xl flex items-center text-[11px] font-bold border border-slate-800 shadow-inner">
            <button
              onClick={() => { setActiveTab('preview'); setIsEditing(false); }}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                activeTab === 'preview'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📊 {t.visualPreview}
            </button>
            <button
              onClick={() => setActiveTab('prompt')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                activeTab === 'prompt'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📝 {t.rawPrompt}
            </button>
          </div>

          <button
            onClick={handleCopy}
            className={`text-[11px] font-bold px-3 py-2 rounded-xl shadow-sm transition-all flex items-center space-x-1 ${
              copied
                ? 'bg-emerald-600 text-white neon-glow-emerald'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-95'
            }`}
          >
            <span>{copied ? '✓' : '📋'}</span>
            <span>{copied ? t.copied : t.copy}</span>
          </button>
        </div>
      </div>

      {/* Main Card View — Collapsible */}
      <div
        className={`transition-all duration-500 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-5 space-y-5">
          {activeTab === 'preview' ? (
            <div className="space-y-4">
              {/* Visual Frame mimicking chosen aspect ratio */}
              <div className={containerAspectClass}>

                {panels.map((panel, pIdx) => (
                  <div key={pIdx} className={`relative bg-slate-900 border border-slate-800 flex ${aspectRatio === '9:16 Portrait' ? 'flex-row items-center justify-between px-3 py-2' : 'flex-col'} overflow-hidden h-full rounded-lg group/panel transition-all duration-300 hover:border-indigo-500/30`}>

                    {aspectRatio === '9:16 Portrait' ? (
                      <>
                        {/* Left: Flag & Country (Stacked) */}
                        <div className="flex flex-col items-center justify-center space-y-1 w-16 flex-shrink-0">
                          <span className="text-[9px] font-black text-slate-400 tracking-wider uppercase truncate max-w-full">
                            {panel.country || `Country`}
                          </span>
                          <div className="relative w-8 h-8 bg-slate-800 border border-slate-700 rounded-b-[40%] flex items-center justify-center shadow-inner overflow-hidden shield-hover transition-transform duration-300">
                            {(() => {
                              const cCode = getCountryCode(panel);
                              return cCode ? (
                                <img
                                  src={`https://flagcdn.com/w80/${cCode}.png`}
                                  alt={panel.country}
                                  className="w-5 h-auto object-contain filter drop-shadow"
                                />
                              ) : (
                                <span className="text-xl select-none filter drop-shadow">
                                  {panel.flagEmoji || '🏳️'}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Center: Subject & Stat (Navy Box) */}
                        <div className="flex-1 bg-[#101b3d] border border-[#1b2b5d] rounded-lg mx-2 p-1.5 text-center flex flex-col justify-center min-w-0">
                          <div className="text-[10px] font-extrabold text-slate-100 truncate">
                            {panel.subject || 'Subject'}
                          </div>
                          <div className="text-[9px] font-black text-[#5c80ff] truncate mt-0.5">
                            {panel.statistic || '0'}
                          </div>
                        </div>

                        {/* Right: Portrait Mock Frame */}
                        <div className="relative w-12 h-12 bg-[#2d1c10]/40 rounded border border-amber-900/30 flex items-center justify-center flex-shrink-0 group/portrait overflow-hidden select-none">
                          <svg className="w-6 h-6 text-amber-500/20" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>

                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-slate-950/95 p-1.5 flex flex-col justify-center items-center text-center opacity-0 group-hover/portrait:opacity-100 transition-opacity duration-300">
                            <p className="text-[8px] leading-snug text-slate-300 italic line-clamp-3">
                              {panel.description || 'Portrait'}
                            </p>
                          </div>
                        </div>

                        {/* Rank badge */}
                        <div className="absolute top-1 right-1 bg-indigo-600/80 text-[8px] font-black text-white w-5 h-5 rounded-full flex items-center justify-center backdrop-blur-sm">
                          {rankStart + pIdx}
                        </div>
                      </>
                    ) : (
                      // Regular 16:9 / 1:1 layouts
                      <>
                        {/* Top Header Bar */}
                        <div className="bg-slate-950/80 py-1.5 px-2 text-center border-b border-slate-800 relative">
                          <span className="text-[9px] sm:text-[10px] font-black text-slate-300 tracking-wider block uppercase truncate">
                            {panel.country || `Country ${pIdx + 1}`}
                          </span>
                          {/* Rank Badge */}
                          <div className="absolute top-1 right-1 bg-gradient-to-br from-indigo-500 to-purple-600 text-[7px] font-black text-white w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shadow-md">
                            {rankStart + pIdx}
                          </div>
                        </div>

                        {/* Top Shield/Flag Area */}
                        <div className="flex-1 flex flex-col items-center justify-start pt-2 sm:pt-3 relative">
                          <div
                            title={t.shieldTooltip}
                            className="relative w-8 h-8 sm:w-11 sm:h-11 md:w-13 md:h-13 bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-700 rounded-b-[40%] flex items-center justify-center shadow-lg shield-hover transition-transform duration-300 cursor-help overflow-hidden"
                          >
                            {(() => {
                              const cCode = getCountryCode(panel);
                              return cCode ? (
                                <img
                                  src={`https://flagcdn.com/w80/${cCode}.png`}
                                  alt={panel.country}
                                  className="w-5 sm:w-7 md:w-9 h-auto object-contain filter drop-shadow"
                                />
                              ) : (
                                <span className="text-base sm:text-xl md:text-2xl select-none filter drop-shadow">
                                  {panel.flagEmoji || '🏳️'}
                                </span>
                              );
                            })()}
                            <div className="absolute inset-0 rounded-b-[40%] border border-white/10 pointer-events-none"></div>
                          </div>
                          {pIdx === 0 && (
                            <span className="absolute left-1 top-8 bg-indigo-600/80 text-[6px] font-extrabold text-white px-1 py-0.5 rounded uppercase tracking-wider backdrop-blur-sm">
                              {t.master}
                            </span>
                          )}
                        </div>

                        {/* Middle Navy Blue Banner */}
                        <div className="bg-[#101b3d] py-1 sm:py-1.5 px-1 text-center border-t border-b border-[#1b2b5d] relative">
                          <div className="text-[8px] sm:text-[9px] font-extrabold text-slate-200 tracking-tight uppercase truncate">
                            {panel.subject || 'Subject'}
                          </div>
                          <div className="text-[7px] sm:text-[8px] font-black text-[#5c80ff] tracking-tight truncate mt-0.5">
                            {panel.statistic || '0'}
                          </div>
                        </div>

                        {/* Stat Comparison Bar */}
                        <div className="px-1 py-0.5 bg-slate-950/60">
                          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full stat-bar-fill"
                              style={{ '--bar-width': `${barWidths[pIdx]}%` } as React.CSSProperties}
                            ></div>
                          </div>
                        </div>

                        {/* Bottom Character Frame */}
                        <div className="flex-1 bg-[#1a120b] m-1 rounded border border-amber-950/40 flex flex-col items-center justify-center p-1 relative overflow-hidden group/portrait select-none">
                          <svg className="w-7 h-7 sm:w-9 sm:h-9 text-amber-500/20" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>

                          {/* Hover Visual Description Overlay */}
                          <div className="absolute inset-0 bg-slate-950/95 p-1.5 flex flex-col justify-center items-center text-center opacity-0 group-hover/portrait:opacity-100 transition-opacity duration-300">
                            <p className="text-[7px] sm:text-[8px] leading-snug text-slate-300 italic px-0.5 line-clamp-3 sm:line-clamp-4">
                              {panel.description || 'Illustration render instructions.'}
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                  </div>
                ))}
              </div>

              {/* Quick Instruction Footer */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span>🎯</span>
                  <span>{t.hoverToSee}</span>
                </span>
                <span className="font-mono text-[9px] bg-slate-900 text-indigo-400 border border-slate-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {t.rank} {rankStart}–{rankStart + 2}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                      ✏️ {t.editing}
                    </span>
                    {editContent !== prompt.content && (
                      <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                        {t.modified}
                      </span>
                    )}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full text-xs text-slate-300 font-mono bg-slate-950 p-4 rounded-xl border border-indigo-500/30 focus:ring-1 focus:ring-indigo-500 max-h-96 overflow-y-auto leading-relaxed resize-none"
                    style={{ minHeight: '150px' }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-mono">{editContent.length} {t.charCount}</span>
                    <div className="flex gap-2">
                      <button onClick={handleCancelEdit} className="text-[11px] font-bold px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition">
                        {t.cancel}
                      </button>
                      <button onClick={handleSaveEdit} className="text-[11px] font-bold px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-lg">
                        {t.save}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-72 overflow-y-auto leading-relaxed">
                    {prompt.content}
                  </pre>
                  <div className="absolute right-3 bottom-3 flex gap-2">
                    {onEditPrompt && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="bg-slate-900/90 border border-slate-700 text-indigo-400 text-[10px] font-bold px-2.5 py-1 rounded-lg hover:bg-slate-800 transition"
                      >
                        ✏️ {t.edit}
                      </button>
                    )}
                    <span className="bg-slate-900/90 border border-slate-800 text-slate-400 text-[9px] font-mono font-black px-2 py-1 rounded-lg uppercase tracking-wider">
                      Raw Text
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dynamic Downloader Section */}
          <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <span>⚙️</span> {t.exports}
            </span>
            <div className="flex space-x-2">
              <button
                onClick={handleDownloadTxt}
                className="text-[10px] font-bold px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition flex items-center space-x-1 hover:-translate-y-0.5 active:scale-95"
              >
                <span>📥</span>
                <span>{t.downloadTxt}</span>
              </button>
              <button
                onClick={handleDownloadJson}
                className="text-[10px] font-bold px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg transition flex items-center space-x-1 hover:-translate-y-0.5 active:scale-95"
              >
                <span>💻</span>
                <span>{t.downloadJson}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
