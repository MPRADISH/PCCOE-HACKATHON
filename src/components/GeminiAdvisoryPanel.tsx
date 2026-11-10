/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GeminiAdvisoryPanel — AI-generated irrigation advisory from Gemini
 */

import React, { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, BookOpen } from 'lucide-react';
import { generateAdvisory, type AdvisoryResponse } from '../utils/apiClient';
import type { Language, CropType, IrrigationMethod } from '../utils/waterEngine';

interface GeminiAdvisoryPanelProps {
  talukaId: string;
  crop: CropType;
  acres: number;
  currentMethod: IrrigationMethod;
  lang: Language;
  diagnosticNote?: string | null;
}

const LABELS: Record<Language, {
  title: string;
  subtitle: string;
  generateBtn: string;
  generating: string;
  kvkRef: string;
  actions: string;
  savings: string;
  errorMsg: string;
  retryBtn: string;
  poweredBy: string;
}> = {
  en: {
    title: 'Gemini AI Irrigation Advisory',
    subtitle: 'Generate a personalized, KVK-grounded advisory using satellite telemetry and IMD forecasts.',
    generateBtn: 'Generate AI Advisory',
    generating: 'Generating advisory...',
    kvkRef: 'KVK Science Reference',
    actions: 'Recommended Actions',
    savings: 'Estimated Water Savings',
    errorMsg: 'Advisory generation failed. Please try again.',
    retryBtn: 'Retry',
    poweredBy: 'Powered by Google Gemini AI + KVK RAG',
  },
  mr: {
    title: 'Gemini AI सिंचन सल्ला',
    subtitle: 'उपग्रह माहिती आणि IMD अंदाज वापरून वैयक्तिक KVK-प्रमाणित सल्ला तयार करा.',
    generateBtn: 'AI सल्ला तयार करा',
    generating: 'सल्ला तयार होत आहे...',
    kvkRef: 'कृषी विज्ञान केंद्र संदर्भ',
    actions: 'शिफारस केलेल्या कृती',
    savings: 'अंदाजे पाणी बचत',
    errorMsg: 'सल्ला तयार करता आला नाही. कृपया पुन्हा प्रयत्न करा.',
    retryBtn: 'पुन्हा प्रयत्न करा',
    poweredBy: 'Google Gemini AI + KVK RAG द्वारे संचालित',
  },
  hi: {
    title: 'Gemini AI सिंचाई सलाह',
    subtitle: 'उपग्रह डेटा और IMD पूर्वानुमान के आधार पर व्यक्तिगत KVK-प्रमाणित सलाह बनाएं।',
    generateBtn: 'AI सलाह बनाएं',
    generating: 'सलाह तैयार हो रही है...',
    kvkRef: 'कृषि विज्ञान केंद्र संदर्भ',
    actions: 'अनुशंसित कदम',
    savings: 'अनुमानित जल बचत',
    errorMsg: 'सलाह तैयार करने में विफल। कृपया पुनः प्रयास करें।',
    retryBtn: 'पुनः प्रयास करें',
    poweredBy: 'Google Gemini AI + KVK RAG द्वारा संचालित',
  },
};

export function GeminiAdvisoryPanel({
  talukaId,
  crop,
  acres,
  currentMethod,
  lang,
  diagnosticNote,
}: GeminiAdvisoryPanelProps) {
  const [loading, setLoading] = useState(false);
  const [advisory, setAdvisory] = useState<AdvisoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = LABELS[lang];

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateAdvisory({
        talukaId,
        crop,
        acres,
        currentMethod,
        language: lang,
        diagnosticNote: diagnosticNote || undefined,
      });
      setAdvisory(result);
    } catch (err: any) {
      console.error('[GeminiAdvisoryPanel]', err);
      setError(err.message || t.errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 p-5 bg-white border border-[#182218]/12 rounded-xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-[#d3b44a]" />
        <h3 className="text-sm font-extrabold text-[#182218]">{t.title}</h3>
      </div>
      <p className="text-xs text-[#182218]/65 mb-4">{t.subtitle}</p>

      {/* Generate Button */}
      {!advisory && (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            loading
              ? 'bg-[#182218]/30 text-[#182218]/60 cursor-wait'
              : 'bg-[#06ce06] text-[#182218] hover:bg-[#05b505]'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t.generating}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {t.generateBtn}
            </>
          )}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-red-700 font-medium">{error}</p>
            <button
              type="button"
              onClick={handleGenerate}
              className="mt-2 text-xs font-bold text-red-700 underline underline-offset-2 cursor-pointer"
            >
              {t.retryBtn}
            </button>
          </div>
        </div>
      )}

      {/* Advisory Result */}
      {advisory && (
        <div className="mt-4 space-y-4">
          {/* Advisory Text */}
          <div className="p-4 bg-[#ecfdf3] border border-[#06ce06]/30 rounded-lg">
            <p className="text-sm text-[#182218] leading-relaxed whitespace-pre-line">
              {advisory.advisoryText}
            </p>
          </div>

          {/* Action Items */}
          {(advisory.actionItems as string[]).length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[#182218]/70 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#06ce06]" />
                {t.actions}
              </h4>
              <ul className="space-y-1.5">
                {(advisory.actionItems as string[]).map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-[#182218]/85"
                  >
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#06ce06] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* KVK Reference */}
          {advisory.kvkReference && (
            <div className="p-3 bg-[#EFECE3] border border-[#d3b44a]/30 rounded-lg">
              <h4 className="text-xs font-bold text-[#9a7b1c] mb-1 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                {t.kvkRef}
              </h4>
              <p className="text-xs text-[#182218]/80">{advisory.kvkReference}</p>
            </div>
          )}

          {/* Water Savings */}
          {advisory.waterSavingEstimate && (
            <div className="flex items-center gap-2 text-xs font-semibold text-[#059605]">
              <span className="w-2 h-2 rounded-full bg-[#06ce06]" />
              {t.savings}: {String(advisory.waterSavingEstimate)}
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-[#182218]/8 flex items-center justify-between">
            <span className="text-[10px] text-[#182218]/50">{t.poweredBy}</span>
            <button
              type="button"
              onClick={() => { setAdvisory(null); setError(null); }}
              className="text-[10px] font-bold text-[#182218]/50 hover:text-[#182218] underline underline-offset-2 cursor-pointer"
            >
              {t.retryBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

