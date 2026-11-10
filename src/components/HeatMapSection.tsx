import React, { useState, useEffect, useRef } from 'react';
import {
  Droplets,
  CloudRain,
  TrendingDown,
  Sprout,
  Search,
  Send,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  BookOpen,
  Calculator,
  Map as MapIcon,
  Grid,
  Volume2,
  VolumeX,
  Loader2,
  MessageSquare,
  Smartphone,
  Share2,
  Users,
  UserCheck,
  Info,
  BellRing,
  X,
} from 'lucide-react';
import {
  evaluateWaterStress,
  calculateIrrigationAdvisory,
  filterAndSortTalukas,
  formatNotificationPayloads,
  evaluateTalukaHighPriorityAlert,
  type TalukaRecord,
  type Language,
  type CropType,
  type IrrigationMethod,
  type StressLevel,
  type NotificationChannel,
  type HighPriorityTalukaAlert,
} from '../utils/waterEngine';
import type { UITranslations } from '../data/translations';

interface HeatMapSectionProps {
  talukas: TalukaRecord[];
  selectedTaluka: TalukaRecord;
  onSelectTaluka: (taluka: TalukaRecord) => void;
  lang: Language;
  t: UITranslations;
  diagnosticOverrideNote: string | null;
}

type HeatMetricMode = 'stress' | 'moisture' | 'groundwater' | 'rainfall';

interface DispatchedNotificationLog {
  id: string;
  talukaName: string;
  recipientLabel: string;
  channel: NotificationChannel;
  langCode: Language;
  timestamp: string;
  messagePreview: string;
}

const CROP_OPTIONS: { value: CropType; label: Record<Language, string> }[] = [
  { value: 'cotton', label: { en: 'Cotton (कापूस)', mr: 'कापूस (Cotton)', hi: 'कपास (Cotton)' } },
  { value: 'sugarcane', label: { en: 'Sugarcane (ऊस)', mr: 'ऊस (Sugarcane)', hi: 'गन्ना (Sugarcane)' } },
  { value: 'soybean', label: { en: 'Soybean (सोयाबीन)', mr: 'सोयाबीन (Soybean)', hi: 'सोयाबीन (Soybean)' } },
  { value: 'onion', label: { en: 'Onion (कांदा)', mr: 'कांदा (Onion)', hi: 'प्याज (Onion)' } },
  { value: 'tur', label: { en: 'Tur / Pigeon Pea (तूर)', mr: 'तूर (Pigeon Pea)', hi: 'तूर / अरहर (Pigeon Pea)' } },
  { value: 'pomegranate', label: { en: 'Pomegranate (डाळिंब)', mr: 'डाळिंब (Pomegranate)', hi: 'अनार (Pomegranate)' } },
];

const DAY_LABELS: Record<Language, string[]> = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  mr: ['सोम', 'मंगळ', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'],
  hi: ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'],
};

const TOAST_ACTION_LABELS: Record<Language, string> = {
  en: 'Prepare SMS / WhatsApp Alert',
  mr: 'SMS / WhatsApp सल्ला तयार करा',
  hi: 'SMS / WhatsApp अलर्ट तैयार करें',
};

const TOAST_DISMISS_LABELS: Record<Language, string> = {
  en: 'Dismiss alert',
  mr: 'सूचना बंद करा',
  hi: 'अलर्ट बंद करें',
};

export const HeatMapSection: React.FC<HeatMapSectionProps> = ({
  talukas,
  selectedTaluka,
  onSelectTaluka,
  lang,
  t,
  diagnosticOverrideNote,
}) => {
  const [viewMode, setViewMode] = useState<'map' | 'matrix'>('map');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [stressFilter, setStressFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [heatMetric, setHeatMetric] = useState<HeatMetricMode>('stress');
  const [hoveredTaluka, setHoveredTaluka] = useState<TalukaRecord | null>(null);

  // Subtle Toast Notification state for incoming high-priority weather or drought alerts
  const [activeToastAlert, setActiveToastAlert] = useState<HighPriorityTalukaAlert | null>(() =>
    evaluateTalukaHighPriorityAlert(selectedTaluka)
  );
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [toastInteractionCount, setToastInteractionCount] = useState<number>(0);
  const toastTimerRef = useRef<number | null>(null);

  const triggerTalukaAlertToast = (taluka: TalukaRecord) => {
    const evaluatedAlert = evaluateTalukaHighPriorityAlert(taluka);
    if (evaluatedAlert) {
      setActiveToastAlert(evaluatedAlert);
      setToastVisible(true);
      setToastInteractionCount((c) => c + 1);
    } else {
      setToastVisible(false);
    }
  };

  useEffect(() => {
    if (!toastVisible) return;
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, 9000);
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [toastVisible, toastInteractionCount]);

  // Calculator state
  const [selectedCrop, setSelectedCrop] = useState<CropType>(selectedTaluka.dominantCrop);
  const [acres, setAcres] = useState<number>(3);
  const [irrigationMethod, setIrrigationMethod] = useState<IrrigationMethod>('flood');
  const [advisoryPreviewLang, setAdvisoryPreviewLang] = useState<Language | 'sync'>('sync');
  const [speechActive, setSpeechActive] = useState(false);
  const [speechLoading, setSpeechLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop any active audio playback when taluka or advisory language changes
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeechActive(false);
      setSpeechLoading(false);
    };
  }, [selectedTaluka.id, advisoryPreviewLang]);

  // SMS & WhatsApp Notification Hub state
  const [channel, setChannel] = useState<NotificationChannel>('both');
  const [recipientMode, setRecipientMode] = useState<'cohort' | 'single'>('cohort');
  const [farmerName, setFarmerName] = useState<string>('Rameshwar Patil');
  const [farmerPhone, setFarmerPhone] = useState<string>('9823415678');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [dispatchedLogs, setDispatchedLogs] = useState<DispatchedNotificationLog[]>([
    {
      id: 'seed-log-1',
      talukaName: 'Ausa, Latur',
      recipientLabel: '1,840 Farmers (Cohort)',
      channel: 'both',
      langCode: 'mr',
      timestamp: '08:30 AM',
      messagePreview:
        'जलमित्र [औसा]: ओलावा 21%, भूजल -14.5%. सिंचन 3 दिवस थांबवा (गुरुवारी 18 मिमी पाऊस). सोयाबीन साठी ठिबकने 83k L पाणी द्या; 121k L वाचवा.',
    },
  ]);

  const effectiveAdvisoryLang = advisoryPreviewLang === 'sync' ? lang : advisoryPreviewLang;

  const filteredTalukas = filterAndSortTalukas(talukas, regionFilter, stressFilter, searchQuery);

  const activeStress = evaluateWaterStress(
    selectedTaluka.soilMoisturePct,
    selectedTaluka.groundwaterDepletionPct,
    selectedTaluka.rainForecast7dMm,
    selectedTaluka.ndviScore
  );

  const advisoryResult = calculateIrrigationAdvisory(
    selectedTaluka,
    selectedCrop,
    acres,
    irrigationMethod
  );

  const notificationPayloads = formatNotificationPayloads(
    selectedTaluka,
    advisoryResult,
    diagnosticOverrideNote
  );

  const handleTalukaPick = (taluka: TalukaRecord) => {
    onSelectTaluka(taluka);
    setSelectedCrop(taluka.dominantCrop);
    triggerTalukaAlertToast(taluka);
  };

  const handleLegendBandClick = (level: StressLevel) => {
    const nextFilter = stressFilter === level ? 'all' : level;
    setStressFilter(nextFilter);
    if (nextFilter !== 'all') {
      const matching = talukas.find(
        (tlk) =>
          evaluateWaterStress(
            tlk.soilMoisturePct,
            tlk.groundwaterDepletionPct,
            tlk.rainForecast7dMm,
            tlk.ndviScore
          ).level === nextFilter
      );
      if (matching) {
        onSelectTaluka(matching);
        setSelectedCrop(matching.dominantCrop);
        triggerTalukaAlertToast(matching);
      }
    }
  };

  const handleDispatchAdvisory = () => {
    if (recipientMode === 'single') {
      const cleanedPhone = farmerPhone.replace(/\D/g, '');
      if (cleanedPhone.length !== 10) {
        setPhoneError(t.phoneValidationError);
        return;
      }
    }
    setPhoneError(null);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgText =
      channel === 'sms'
        ? notificationPayloads.smsText[effectiveAdvisoryLang]
        : notificationPayloads.whatsappText[effectiveAdvisoryLang];

    const recipientLabel =
      recipientMode === 'cohort'
        ? `${selectedTaluka.farmersEnrolled.toLocaleString()} Farmers (${selectedTaluka.name[lang]})`
        : `${farmerName.trim() || 'Farmer'} (+91 ${farmerPhone.replace(/\D/g, '')})`;

    setDispatchedLogs((prev) => [
      {
        id: `${selectedTaluka.id}-${Date.now()}`,
        talukaName: `${selectedTaluka.name[lang]}, ${selectedTaluka.district[lang]}`,
        recipientLabel,
        channel,
        langCode: effectiveAdvisoryLang,
        timestamp: timeStr,
        messagePreview: msgText,
      },
      ...prev.slice(0, 4),
    ]);
  };

  const handleSpeakAdvisory = () => {
    // If currently playing or loading, stop playback
    if (speechActive || speechLoading) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeechActive(false);
      setSpeechLoading(false);
      return;
    }

    const text = advisoryResult.vernacularAdvisory[effectiveAdvisoryLang];
    if (!text) return;

    setSpeechLoading(true);

    const playOfflineFallback = () => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setSpeechLoading(false);
        setSpeechActive(false);
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const findVoice = (prefix: string) =>
          voices.find((v) =>
            v.lang.toLowerCase().replace('_', '-').startsWith(prefix.toLowerCase())
          );

        if (effectiveAdvisoryLang === 'mr') {
          // Native Marathi voice if available, or Hindi (shares Devanagari script phonetics)
          const mrVoice = findVoice('mr');
          const hiVoice = findVoice('hi');
          utterance.voice = mrVoice || hiVoice || null;
          utterance.lang = mrVoice ? 'mr-IN' : (hiVoice ? 'hi-IN' : 'mr-IN');
        } else if (effectiveAdvisoryLang === 'hi') {
          const hiVoice = findVoice('hi');
          utterance.voice = hiVoice || null;
          utterance.lang = 'hi-IN';
        } else {
          const enVoice = findVoice('en-in') || findVoice('en');
          utterance.voice = enVoice || null;
          utterance.lang = 'en-IN';
        }

        utterance.rate = 0.9;
        utterance.onstart = () => {
          setSpeechLoading(false);
          setSpeechActive(true);
        };
        utterance.onend = () => {
          setSpeechActive(false);
          setSpeechLoading(false);
        };
        utterance.onerror = () => {
          setSpeechActive(false);
          setSpeechLoading(false);
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        setSpeechActive(false);
        setSpeechLoading(false);
      }
    };

    // Try backend high-quality Marathi/Hindi audio stream first
    try {
      const audioUrl = `/api/tts?text=${encodeURIComponent(text)}&lang=${effectiveAdvisoryLang}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.oncanplaythrough = () => {
        setSpeechLoading(false);
        setSpeechActive(true);
        audio.play().catch(() => {
          playOfflineFallback();
        });
      };

      audio.onended = () => {
        setSpeechActive(false);
        setSpeechLoading(false);
        audioRef.current = null;
      };

      audio.onerror = () => {
        // Fall back to SpeechSynthesis (e.g. offline PWA mode)
        playOfflineFallback();
      };
    } catch {
      playOfflineFallback();
    }
  };

  const renderStatusIcon = (level: StressLevel) => {
    switch (level) {
      case 'low':
        return <CheckCircle2 className="w-4 h-4 text-[#059605] shrink-0" aria-hidden="true" />;
      case 'mild':
        return <Sprout className="w-4 h-4 text-[#4d8c0f] shrink-0" aria-hidden="true" />;
      case 'moderate':
        return <Clock className="w-4 h-4 text-[#9a7b1c] shrink-0" aria-hidden="true" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-[#c25e14] shrink-0" aria-hidden="true" />;
      case 'critical':
        return <ShieldAlert className="w-4 h-4 text-[#c92a2a] shrink-0" aria-hidden="true" />;
    }
  };

  const getMetricValueDisplay = (taluka: TalukaRecord) => {
    const st = evaluateWaterStress(
      taluka.soilMoisturePct,
      taluka.groundwaterDepletionPct,
      taluka.rainForecast7dMm,
      taluka.ndviScore
    );
    switch (heatMetric) {
      case 'moisture':
        return `${taluka.soilMoisturePct}%`;
      case 'groundwater':
        return `-${taluka.groundwaterDepletionPct}%`;
      case 'rainfall':
        return `${taluka.rainForecast7dMm}mm`;
      default:
        return `${st.score}/100`;
    }
  };

  const inspectedTooltipTaluka = hoveredTaluka || selectedTaluka;
  const inspectedTooltipStress = evaluateWaterStress(
    inspectedTooltipTaluka.soilMoisturePct,
    inspectedTooltipTaluka.groundwaterDepletionPct,
    inspectedTooltipTaluka.rainForecast7dMm,
    inspectedTooltipTaluka.ndviScore
  );

  const whatsappShareHref = `https://wa.me/${
    recipientMode === 'single' ? `91${farmerPhone.replace(/\D/g, '')}` : ''
  }?text=${encodeURIComponent(notificationPayloads.whatsappText[effectiveAdvisoryLang])}`;

  return (
    <section id="heatmap-section" className="py-8 border-b border-[#182218]/10">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#182218] text-balance">
            {t.heatMapSectionTitle}
          </h2>
          <p className="mt-1.5 text-sm sm:text-base text-[#182218]/75 max-w-3xl">
            {t.heatMapSectionSubtitle}
          </p>
        </div>

        {/* View Mode Toggle (Map vs Matrix) */}
        <div
          className="inline-flex items-center p-1 bg-[#EFECE3] border border-[#182218]/15 rounded-lg self-start lg:self-auto"
          role="group"
          aria-label="Heat map visualization mode"
        >
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              viewMode === 'map'
                ? 'bg-[#182218] text-[#F9F8F3]'
                : 'text-[#182218]/75 hover:text-[#182218]'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            {t.viewModeMap}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              viewMode === 'matrix'
                ? 'bg-[#182218] text-[#F9F8F3]'
                : 'text-[#182218]/75 hover:text-[#182218]'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            {t.viewModeMatrix}
          </button>
        </div>
      </div>

      {/* Accessible 5-Band Color Spectrum & Interactive Legend Bar */}
      <div className="mb-6 p-4 bg-white border border-[#182218]/12 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <div className="text-xs font-bold text-[#182218]">{t.legendTitle}</div>
            <div className="text-[11px] text-[#182218]/65 mt-0.5">{t.legendSubtitle}</div>
          </div>
          {stressFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setStressFilter('all')}
              className="text-xs font-semibold text-[#182218] underline cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0"
            >
              {t.filterStressAll}
            </button>
          )}
        </div>

        {/* Continuous Color Spectrum Bar (#06ce06 -> #74c328 -> #d3b44a -> #e07a2a -> #c92a2a) */}
        <div
          className="h-2.5 w-full rounded-full mb-3 border border-[#182218]/15"
          style={{
            background:
              'linear-gradient(90deg, #06ce06 0%, #74c328 26%, #d3b44a 52%, #e07a2a 78%, #c92a2a 100%)',
          }}
          aria-hidden="true"
        />

        {/* 5 Interactive Accessible Legend Bands */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {(
            [
              {
                level: 'low' as StressLevel,
                hex: '#06ce06',
                bg: '#ecfdf3',
                label: t.legendLow,
                range: '0–22',
              },
              {
                level: 'mild' as StressLevel,
                hex: '#74c328',
                bg: '#f4fce3',
                label: t.legendMild,
                range: '23–38',
              },
              {
                level: 'moderate' as StressLevel,
                hex: '#d3b44a',
                bg: '#fefce8',
                label: t.legendModerate,
                range: '39–55',
              },
              {
                level: 'high' as StressLevel,
                hex: '#e07a2a',
                bg: '#fff7ed',
                label: t.legendHigh,
                range: '56–74',
              },
              {
                level: 'critical' as StressLevel,
                hex: '#c92a2a',
                bg: '#fef2f2',
                label: t.legendCritical,
                range: '75–100',
              },
            ]
          ).map((band) => {
            const isBandActive = stressFilter === band.level;
            return (
              <button
                key={band.level}
                type="button"
                onClick={() => handleLegendBandClick(band.level)}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                  isBandActive
                    ? 'ring-2 ring-[#182218] font-bold'
                    : 'hover:border-[#182218]/40'
                }`}
                style={{
                  backgroundColor: band.bg,
                  borderColor: band.hex,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-xs shrink-0 border border-[#182218]/25"
                    style={{ backgroundColor: band.hex }}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium text-[#182218] truncate">
                    {band.label}
                  </span>
                </div>
                <span className="text-[10px] font-mono-tabular font-semibold text-[#182218]/70 shrink-0">
                  {band.range}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6">
        <div className="md:col-span-4 relative">
          <label htmlFor="taluka-search" className="sr-only">
            {t.searchPlaceholder}
          </label>
          <Search className="w-4 h-4 text-[#182218]/50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="taluka-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#182218]/15 rounded-lg text-sm text-[#182218] placeholder:text-[#182218]/45 focus:outline-none focus:ring-2 focus:ring-[#d3b44a]"
          />
        </div>

        <div className="md:col-span-3">
          <label htmlFor="region-filter" className="sr-only">
            {t.filterRegionAll}
          </label>
          <select
            id="region-filter"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-[#182218]/15 rounded-lg text-sm font-medium text-[#182218] focus:outline-none focus:ring-2 focus:ring-[#d3b44a]"
          >
            <option value="all">{t.filterRegionAll}</option>
            <option value="Marathwada">{t.regionMarathwada}</option>
            <option value="Vidarbha">{t.regionVidarbha}</option>
            <option value="Western Maharashtra">{t.regionWesternMh}</option>
            <option value="Khandesh">{t.regionKhandesh}</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="stress-filter" className="sr-only">
            {t.filterStressAll}
          </label>
          <select
            id="stress-filter"
            value={stressFilter}
            onChange={(e) => setStressFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-[#182218]/15 rounded-lg text-sm font-medium text-[#182218] focus:outline-none focus:ring-2 focus:ring-[#d3b44a]"
          >
            <option value="all">{t.filterStressAll}</option>
            <option value="low">{t.legendLow}</option>
            <option value="mild">{t.legendMild}</option>
            <option value="moderate">{t.legendModerate}</option>
            <option value="high">{t.legendHigh}</option>
            <option value="critical">{t.legendCritical}</option>
          </select>
        </div>

        {/* Heat Overlay Metric Selector */}
        <div className="md:col-span-3 flex items-center gap-1 p-1 bg-[#EFECE3] border border-[#182218]/15 rounded-lg">
          {(
            [
              { id: 'stress', label: t.metricTabStress },
              { id: 'moisture', label: t.metricTabSoil },
              { id: 'groundwater', label: t.metricTabAquifer },
              { id: 'rainfall', label: t.metricTabRain },
            ] as { id: HeatMetricMode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setHeatMetric(m.id)}
              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                heatMetric === m.id
                  ? 'bg-white text-[#182218] shadow-xs'
                  : 'text-[#182218]/70 hover:text-[#182218]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-Column Split: Left = Interactive Heat Map / Matrix + Tooltip, Right = Vernacular Advisory + SMS/WhatsApp Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column (7 cols): Interactive Map or Heat Matrix */}
        <div className="lg:col-span-7 bg-white border border-[#182218]/12 rounded-xl p-5 flex flex-col gap-4">
          {viewMode === 'map' ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="text-xs font-medium text-[#182218]/70">
                  <span>{t.mapHeaderSubtitle}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono-tabular">
                    {filteredTalukas.length} {t.talukasActiveSuffix}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {activeToastAlert && (
                    <button
                      type="button"
                      onClick={() => {
                        setToastVisible(true);
                        setToastInteractionCount((c) => c + 1);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#182218] text-[#F9F8F3] border border-[#182218] hover:bg-[#182218]/90 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                        style={{ backgroundColor: activeToastAlert.accentHex }}
                        aria-hidden="true"
                      />
                      <span>{activeToastAlert.metricChip[lang]}</span>
                    </button>
                  )}
                  <div className="text-xs font-mono-tabular text-[#182218]/70">
                    {t.activeTalukaPrefix}{' '}
                    <strong className="text-[#182218]">{selectedTaluka.name[lang]}</strong>
                  </div>
                </div>
              </div>

              {/* Interactive SVG Choropleth & Heat Node Map of Maharashtra */}
              <div className="relative w-full bg-[#F5F3EB] border border-[#182218]/10 rounded-lg overflow-hidden">
                <svg
                  viewBox="0 0 760 540"
                  className="w-full h-auto max-h-[450px] select-none"
                  role="img"
                  aria-label={t.heatMapSectionTitle}
                >
                  <defs>
                    {/* Radial heat gradients for all 5 stress bands (#06ce06, #74c328, #d3b44a, #e07a2a, #c92a2a) */}
                    <radialGradient id="heat-low" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#06ce06" stopOpacity="0.48" />
                      <stop offset="70%" stopColor="#06ce06" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#06ce06" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="heat-mild" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#74c328" stopOpacity="0.50" />
                      <stop offset="70%" stopColor="#74c328" stopOpacity="0.16" />
                      <stop offset="100%" stopColor="#74c328" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="heat-moderate" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#d3b44a" stopOpacity="0.58" />
                      <stop offset="70%" stopColor="#d3b44a" stopOpacity="0.20" />
                      <stop offset="100%" stopColor="#d3b44a" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="heat-high" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#e07a2a" stopOpacity="0.58" />
                      <stop offset="70%" stopColor="#e07a2a" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#e07a2a" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="heat-critical" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#c92a2a" stopOpacity="0.62" />
                      <stop offset="70%" stopColor="#c92a2a" stopOpacity="0.24" />
                      <stop offset="100%" stopColor="#c92a2a" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Topographic Coordinate Grid Lines */}
                  {[100, 200, 300, 400, 500, 600, 700].map((x) => (
                    <line
                      key={`vx-${x}`}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={540}
                      stroke="#182218"
                      strokeOpacity="0.05"
                      strokeDasharray="3 3"
                    />
                  ))}
                  {[90, 180, 270, 360, 450].map((y) => (
                    <line
                      key={`hy-${y}`}
                      x1={0}
                      y1={y}
                      x2={760}
                      y2={y}
                      stroke="#182218"
                      strokeOpacity="0.05"
                      strokeDasharray="3 3"
                    />
                  ))}

                  {/* Stylized Regional Sub-Basin Polygons of Maharashtra */}
                  <polygon
                    points="115,85 435,65 445,215 135,235"
                    fill="#EAE6D7"
                    stroke="#182218"
                    strokeOpacity="0.22"
                    strokeWidth="1.5"
                  />
                  <polygon
                    points="435,65 725,65 710,305 445,245"
                    fill="#E5E1D1"
                    stroke="#182218"
                    strokeOpacity="0.22"
                    strokeWidth="1.5"
                  />
                  <polygon
                    points="310,225 605,245 615,465 395,465 305,345"
                    fill="#ECE8D9"
                    stroke="#182218"
                    strokeOpacity="0.25"
                    strokeWidth="1.5"
                  />
                  <polygon
                    points="135,235 310,225 395,465 335,525 145,510"
                    fill="#E7E3D4"
                    stroke="#182218"
                    strokeOpacity="0.22"
                    strokeWidth="1.5"
                  />

                  {/* Major River Traces */}
                  <path
                    d="M 175 205 Q 365 265 585 335"
                    fill="none"
                    stroke="#0284c7"
                    strokeOpacity="0.32"
                    strokeWidth="2.5"
                    strokeDasharray="6 3"
                  />
                  <path
                    d="M 195 365 Q 335 420 485 455"
                    fill="none"
                    stroke="#0284c7"
                    strokeOpacity="0.32"
                    strokeWidth="2"
                    strokeDasharray="6 3"
                  />

                  {/* Multilingual Regional Basin Labels */}
                  <text x="155" y="108" fill="#182218" fillOpacity="0.50" fontSize="11" fontWeight="700">
                    {t.basinKhandesh}
                  </text>
                  <text x="485" y="92" fill="#182218" fillOpacity="0.50" fontSize="11" fontWeight="700">
                    {t.basinVidarbha}
                  </text>
                  <text x="365" y="250" fill="#182218" fillOpacity="0.50" fontSize="11" fontWeight="700">
                    {t.basinMarathwada}
                  </text>
                  <text x="152" y="268" fill="#182218" fillOpacity="0.50" fontSize="11" fontWeight="700">
                    {t.basinWesternMh}
                  </text>

                  {/* Heat Aura Plumes for Filtered Talukas */}
                  {filteredTalukas.map((taluka) => {
                    const st = evaluateWaterStress(
                      taluka.soilMoisturePct,
                      taluka.groundwaterDepletionPct,
                      taluka.rainForecast7dMm,
                      taluka.ndviScore
                    );
                    return (
                      <circle
                        key={`aura-${taluka.id}`}
                        cx={taluka.mapX}
                        cy={taluka.mapY}
                        r={56}
                        fill={`url(#heat-${st.level})`}
                        pointerEvents="none"
                      />
                    );
                  })}

                  {/* Interactive Taluka Nodes with Hover & Focus Tooltip Triggers */}
                  {filteredTalukas.map((taluka) => {
                    const st = evaluateWaterStress(
                      taluka.soilMoisturePct,
                      taluka.groundwaterDepletionPct,
                      taluka.rainForecast7dMm,
                      taluka.ndviScore
                    );
                    const isSelected = taluka.id === selectedTaluka.id;
                    const isDarkText =
                      st.level === 'low' || st.level === 'mild' || st.level === 'moderate';

                    return (
                      <g
                        key={taluka.id}
                        transform={`translate(${taluka.mapX}, ${taluka.mapY})`}
                        onClick={() => handleTalukaPick(taluka)}
                        onMouseEnter={() => setHoveredTaluka(taluka)}
                        onMouseLeave={() => setHoveredTaluka(null)}
                        onFocus={() => setHoveredTaluka(taluka)}
                        onBlur={() => setHoveredTaluka(null)}
                        className="cursor-pointer group"
                        role="button"
                        tabIndex={0}
                        aria-label={`${taluka.name[lang]}, ${taluka.district[lang]} - ${st.badgeText[lang]}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleTalukaPick(taluka);
                          }
                        }}
                      >
                        {isSelected && (
                          <circle
                            r={23}
                            fill="none"
                            stroke="#182218"
                            strokeWidth="2.5"
                            strokeDasharray="4 2"
                          />
                        )}

                        <circle
                          r={isSelected ? 16 : 13.5}
                          fill={st.colorHex}
                          stroke="#182218"
                          strokeWidth={isSelected ? 2.5 : 1.5}
                        />

                        <text
                          y={3.5}
                          textAnchor="middle"
                          fontSize="9.5"
                          fontWeight="700"
                          fill={isDarkText ? '#182218' : '#FFFFFF'}
                        >
                          {heatMetric === 'moisture'
                            ? `${taluka.soilMoisturePct}%`
                            : heatMetric === 'rainfall'
                            ? `${taluka.rainForecast7dMm}`
                            : st.score}
                        </text>

                        <g transform="translate(0, 27)">
                          <rect
                            x={-48}
                            y={-10}
                            width={96}
                            height={18}
                            rx={4}
                            fill={isSelected ? '#182218' : '#FFFFFF'}
                            fillOpacity={isSelected ? '0.95' : '0.90'}
                            stroke="#182218"
                            strokeOpacity="0.2"
                          />
                          <text
                            y={2}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="600"
                            fill={isSelected ? '#F9F8F3' : '#182218'}
                          >
                            {taluka.name[lang]}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          ) : (
            /* Block Heat Matrix View for Immediate Non-Technical Comparison */
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[#182218]/70">
                  {t.legendSubtitle}
                </span>
                <span className="text-xs font-mono-tabular text-[#182218]/70">
                  {filteredTalukas.length} {t.talukasActiveSuffix}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-1">
                {filteredTalukas.map((taluka) => {
                  const st = evaluateWaterStress(
                    taluka.soilMoisturePct,
                    taluka.groundwaterDepletionPct,
                    taluka.rainForecast7dMm,
                    taluka.ndviScore
                  );
                  const isSelected = taluka.id === selectedTaluka.id;
                  return (
                    <button
                      key={taluka.id}
                      type="button"
                      onClick={() => handleTalukaPick(taluka)}
                      onMouseEnter={() => setHoveredTaluka(taluka)}
                      onMouseLeave={() => setHoveredTaluka(null)}
                      className={`text-left p-3.5 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#182218] text-[#F9F8F3] border-[#182218]'
                          : 'bg-[#F9F8F3] text-[#182218] border-[#182218]/15 hover:border-[#182218]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-sm truncate">
                          {taluka.name[lang]} · {taluka.district[lang]}
                        </div>
                        <span
                          className="px-2 py-0.5 text-xs font-mono-tabular font-bold rounded-xs shrink-0"
                          style={{
                            backgroundColor: st.colorHex,
                            color:
                              st.level === 'low' || st.level === 'mild' || st.level === 'moderate'
                                ? '#182218'
                                : '#FFFFFF',
                          }}
                        >
                          {getMetricValueDisplay(taluka)}
                        </span>
                      </div>
                      <div
                        className={`mt-2 flex items-center gap-2 text-xs font-mono-tabular ${
                          isSelected ? 'text-[#F9F8F3]/80' : 'text-[#182218]/70'
                        }`}
                      >
                        <span>
                          {t.metricTabSoil}: {taluka.soilMoisturePct}%
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {t.metricTabAquifer}: -{taluka.groundwaterDepletionPct}%
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {t.metricTabRain}: {taluka.rainForecast7dMm}mm
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Accessible Non-Technical Interactive Tooltip Panel (Updates on Hover/Focus or Active Selection) */}
          <div
            role="tooltip"
            aria-live="polite"
            className="p-3.5 rounded-lg border transition-colors"
            style={{
              backgroundColor: inspectedTooltipStress.bgTintHex,
              borderColor: inspectedTooltipStress.borderHex,
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#182218]/10">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-xs shrink-0 border border-[#182218]/30"
                  style={{ backgroundColor: inspectedTooltipStress.colorHex }}
                  aria-hidden="true"
                />
                <span className="text-sm font-bold text-[#182218]">
                  {inspectedTooltipTaluka.name[lang]}, {inspectedTooltipTaluka.district[lang]}
                </span>
                <span className="text-xs font-semibold text-[#182218]/80">
                  — {inspectedTooltipStress.badgeText[lang]} ({inspectedTooltipStress.score}/100)
                </span>
              </div>
              <span className="text-[11px] font-medium text-[#182218]/65 flex items-center gap-1">
                <Info className="w-3 h-3" />
                {hoveredTaluka ? t.tooltipClickToInspect : t.activeTalukaPrefix}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs">
              <div>
                <span className="text-[#182218]/65">{t.tooltipSoilMoisture}: </span>
                <strong className="font-mono-tabular text-[#182218]">
                  {inspectedTooltipTaluka.soilMoisturePct}%
                </strong>
              </div>
              <div>
                <span className="text-[#182218]/65">{t.tooltipGwDrop}: </span>
                <strong className="font-mono-tabular text-[#182218]">
                  -{inspectedTooltipTaluka.groundwaterDepletionPct}% (
                  {inspectedTooltipTaluka.groundwaterDepthMeters}m)
                </strong>
              </div>
              <div>
                <span className="text-[#182218]/65">{t.tooltipRain7d}: </span>
                <strong className="font-mono-tabular text-[#182218]">
                  {inspectedTooltipTaluka.rainForecast7dMm}mm (
                  {inspectedTooltipTaluka.rainExpectedDay[lang]})
                </strong>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-[#182218]/10 text-xs text-[#182218]">
              <strong>{t.tooltipActionLabel}: </strong>
              <span>{inspectedTooltipStress.shortAction[lang]}</span>
            </div>
          </div>

          {/* Quick-Select Taluka Strip Below Map */}
          <div className="pt-2 border-t border-[#182218]/10">
            <div className="text-xs font-semibold text-[#182218]/70 mb-2">
              {t.quickSelectLabel} ({filteredTalukas.length}):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filteredTalukas.map((taluka) => {
                const st = evaluateWaterStress(
                  taluka.soilMoisturePct,
                  taluka.groundwaterDepletionPct,
                  taluka.rainForecast7dMm,
                  taluka.ndviScore
                );
                const isSelected = taluka.id === selectedTaluka.id;
                return (
                  <button
                    key={`pill-${taluka.id}`}
                    type="button"
                    onClick={() => handleTalukaPick(taluka)}
                    onMouseEnter={() => setHoveredTaluka(taluka)}
                    onMouseLeave={() => setHoveredTaluka(null)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
                      isSelected
                        ? 'bg-[#182218] text-[#F9F8F3] border-[#182218]'
                        : 'bg-[#F9F8F3] text-[#182218] border-[#182218]/15 hover:bg-[#EFECE3]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: st.colorHex }}
                      aria-hidden="true"
                    />
                    <span>{taluka.name[lang]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Regional Sub-Basin Groundwater & Moisture Summary Table */}
          <div className="pt-3 border-t border-[#182218]/10">
            <div className="text-xs font-semibold text-[#182218]/75 mb-2">
              {t.subBasinTableTitle}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#182218]/10 text-[11px] text-[#182218]/65">
                    <th className="py-1.5 pr-2">{t.subBasinColRegion}</th>
                    <th className="py-1.5 px-2 text-right">{t.subBasinColMoisture}</th>
                    <th className="py-1.5 px-2 text-right">{t.subBasinColGwDrop}</th>
                    <th className="py-1.5 pl-2 text-right">{t.subBasinColRain}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#182218]/10 font-mono-tabular">
                  <tr>
                    <td className="py-2 pr-2 font-sans font-semibold text-[#182218]">
                      {t.regionMarathwada}
                    </td>
                    <td className="py-2 px-2 text-right">23.4%</td>
                    <td className="py-2 px-2 text-right text-[#e07a2a] font-semibold">-13.9%</td>
                    <td className="py-2 pl-2 text-right">15.0 mm</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-sans font-semibold text-[#182218]">
                      {t.regionVidarbha}
                    </td>
                    <td className="py-2 px-2 text-right">37.3%</td>
                    <td className="py-2 px-2 text-right text-[#74c328] font-semibold">-7.0%</td>
                    <td className="py-2 pl-2 text-right text-[#059605] font-semibold">28.0 mm</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-sans font-semibold text-[#182218]">
                      {t.regionWesternMh}
                    </td>
                    <td className="py-2 px-2 text-right">26.4%</td>
                    <td className="py-2 px-2 text-right text-[#e07a2a] font-semibold">-12.7%</td>
                    <td className="py-2 pl-2 text-right">11.4 mm</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-sans font-semibold text-[#182218]">
                      {t.regionKhandesh}
                    </td>
                    <td className="py-2 px-2 text-right">38.5%</td>
                    <td className="py-2 px-2 text-right text-[#74c328] font-semibold">-6.8%</td>
                    <td className="py-2 pl-2 text-right text-[#059605] font-semibold">20.5 mm</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Selected Taluka Telemetry, Vernacular Nugen Advisory & SMS/WhatsApp Gateway */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Selected Taluka Telemetry & Vernacular Advisory Card */}
          <div className="bg-white border border-[#182218]/12 rounded-xl p-5">
            <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-[#182218]/10">
              <div>
                <div className="text-xs text-[#182218]/65">
                  <span>{selectedTaluka.district[lang]}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono-tabular">{selectedTaluka.kvkCitationCode}</span>
                </div>
                <h3 className="text-xl font-bold text-[#182218] mt-0.5">
                  {selectedTaluka.name[lang]}, {selectedTaluka.district[lang]}
                </h3>
              </div>

              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-bold shrink-0"
                style={{
                  backgroundColor: activeStress.bgTintHex,
                  borderColor: activeStress.borderHex,
                  color: '#182218',
                }}
              >
                {renderStatusIcon(activeStress.level)}
                <span>{activeStress.badgeText[lang]}</span>
                <span className="font-mono-tabular">({activeStress.score}/100)</span>
              </div>
            </div>

            {/* 4-Metric Public Data Telemetry Strip (2x2 for zero truncation across languages) */}
            <div className="grid grid-cols-2 gap-3.5 py-3.5 border-b border-[#182218]/10">
              <div className="p-2.5 rounded-lg bg-[#F9F8F3]">
                <div className="flex items-center gap-1.5 text-xs text-[#182218]/75">
                  <Droplets className="w-3.5 h-3.5 text-[#0284c7] shrink-0" />
                  <span>{t.metricSoilMoisture}</span>
                </div>
                <div className="mt-1 text-lg font-bold font-mono-tabular text-[#182218]">
                  {selectedTaluka.soilMoisturePct}%
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#F9F8F3]">
                <div className="flex items-center gap-1.5 text-xs text-[#182218]/75">
                  <TrendingDown className="w-3.5 h-3.5 text-[#e07a2a] shrink-0" />
                  <span>{t.metricGwDepletion}</span>
                </div>
                <div className="mt-1 text-lg font-bold font-mono-tabular text-[#182218]">
                  -{selectedTaluka.groundwaterDepletionPct}%
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#F9F8F3]">
                <div className="flex items-center gap-1.5 text-xs text-[#182218]/75">
                  <CloudRain className="w-3.5 h-3.5 text-[#0284c7] shrink-0" />
                  <span>{t.metricRainForecast}</span>
                </div>
                <div className="mt-1 text-lg font-bold font-mono-tabular text-[#182218]">
                  {selectedTaluka.rainForecast7dMm} mm
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#F9F8F3]">
                <div className="flex items-center gap-1.5 text-xs text-[#182218]/75">
                  <Sprout className="w-3.5 h-3.5 text-[#06ce06] shrink-0" />
                  <span>{t.metricNdvi}</span>
                </div>
                <div className="mt-1 text-lg font-bold font-mono-tabular text-[#182218]">
                  {selectedTaluka.ndviScore.toFixed(2)}
                </div>
              </div>
            </div>

            {/* 7-Day IMD Daily Rainfall Mini Bar Chart */}
            <div className="py-3 border-b border-[#182218]/10">
              <div className="flex items-center justify-between text-xs text-[#182218]/70 mb-2">
                <span>
                  {t.rainWindowHeader} ({selectedTaluka.name[lang]})
                </span>
                <span className="font-mono-tabular font-semibold text-[#0284c7]">
                  {t.rainPeakPrefix} {selectedTaluka.rainExpectedDay[lang]}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-2 items-end h-14 pt-2">
                {selectedTaluka.dailyRainMm.map((mm, idx) => {
                  const heightPct = Math.max(12, Math.min(100, (mm / 16) * 100));
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-mono-tabular text-[#182218]/75">
                        {mm}m
                      </span>
                      <div className="w-full bg-[#EFECE3] rounded-xs h-7 flex items-end overflow-hidden">
                        <div
                          className="w-full transition-all"
                          style={{
                            height: `${heightPct}%`,
                            backgroundColor:
                              mm >= 8 ? '#06ce06' : mm >= 3 ? '#74c328' : mm > 0 ? '#d3b44a' : '#cbd5e1',
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-[#182218]/65">
                        {DAY_LABELS[lang][idx]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Nugen LLM Vernacular Advisory Box */}
            <div
              id="advisory-section"
              className="mt-3.5 p-3.5 rounded-lg bg-[#F9F8F3] border border-[#d3b44a]/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-[#182218]">
                  {t.nugenAdvisoryHeading}
                </span>
                <div className="flex items-center gap-1">
                  {(['mr', 'hi', 'en'] as Language[]).map((lCode) => (
                    <button
                      key={lCode}
                      type="button"
                      onClick={() => setAdvisoryPreviewLang(lCode)}
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        effectiveAdvisoryLang === lCode
                          ? 'bg-[#182218] text-[#d3b44a]'
                          : 'bg-[#EFECE3] text-[#182218]/75 hover:text-[#182218]'
                      }`}
                    >
                      {lCode === 'mr' ? 'मराठी' : lCode === 'hi' ? 'हिन्दी' : 'English'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleSpeakAdvisory}
                    title={
                      speechActive
                        ? effectiveAdvisoryLang === 'mr'
                          ? 'आवाज थांबवा'
                          : effectiveAdvisoryLang === 'hi'
                          ? 'आवाज़ रोकें'
                          : 'Stop voice'
                        : effectiveAdvisoryLang === 'mr'
                        ? 'मराठी आवाज ऐका'
                        : effectiveAdvisoryLang === 'hi'
                        ? 'हिन्दी आवाज़ सुनें'
                        : 'Listen to voice'
                    }
                    aria-label="Listen to vernacular voice advisory"
                    className={`p-1 rounded-xs border border-[#182218]/15 cursor-pointer transition-all flex items-center justify-center ${
                      speechActive
                        ? 'bg-[#06ce06] text-[#182218] animate-pulse ring-2 ring-[#06ce06]/50'
                        : speechLoading
                        ? 'bg-[#EFECE3] text-[#182218] opacity-80'
                        : 'bg-white text-[#182218] hover:bg-[#EFECE3]'
                    }`}
                  >
                    {speechLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : speechActive ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <p className="text-sm font-medium text-[#182218] leading-relaxed">
                “{advisoryResult.vernacularAdvisory[effectiveAdvisoryLang]}”
              </p>

              {diagnosticOverrideNote && (
                <div className="mt-2.5 pt-2.5 border-t border-[#182218]/10 text-xs font-medium text-[#182218]">
                  <strong className="text-[#e07a2a]">+ {t.diagnosticsTitle}: </strong>
                  {diagnosticOverrideNote}
                </div>
              )}

              <div className="mt-3 pt-2.5 border-t border-[#182218]/10 flex items-start gap-2 text-xs text-[#182218]/80">
                <BookOpen className="w-4 h-4 text-[#9a7b1c] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[#182218]">{t.kvkGroundedHeading}: </span>
                  <span>{advisoryResult.kvkReferenceNote[effectiveAdvisoryLang]}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Farm-Level Water Budget & SMS / WhatsApp Notification Gateway Card */}
          <div className="bg-white border border-[#182218]/12 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-[#182218]" />
              <h3 className="text-base font-bold text-[#182218]">{t.calculatorTitle}</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3.5">
              <div>
                <label htmlFor="calc-crop" className="block text-xs font-medium text-[#182218]/75 mb-1">
                  {t.selectCropLabel}
                </label>
                <select
                  id="calc-crop"
                  value={selectedCrop}
                  onChange={(e) => setSelectedCrop(e.target.value as CropType)}
                  className="w-full px-2.5 py-2 bg-[#F9F8F3] border border-[#182218]/20 rounded-lg text-xs font-semibold text-[#182218]"
                >
                  {CROP_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label[lang]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="calc-acres" className="block text-xs font-medium text-[#182218]/75 mb-1">
                  {t.fieldAreaAcresLabel}
                </label>
                <input
                  id="calc-acres"
                  type="number"
                  min={0.5}
                  max={50}
                  step={0.5}
                  value={acres}
                  onChange={(e) => setAcres(Math.max(0.5, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-[#F9F8F3] border border-[#182218]/20 rounded-lg text-xs font-mono-tabular font-semibold text-[#182218]"
                />
              </div>

              <div>
                <label htmlFor="calc-method" className="block text-xs font-medium text-[#182218]/75 mb-1">
                  {t.currentMethodLabel}
                </label>
                <select
                  id="calc-method"
                  value={irrigationMethod}
                  onChange={(e) => setIrrigationMethod(e.target.value as IrrigationMethod)}
                  className="w-full px-2.5 py-2 bg-[#F9F8F3] border border-[#182218]/20 rounded-lg text-xs font-semibold text-[#182218]"
                >
                  <option value="flood">{t.methodFlood}</option>
                  <option value="sprinkler">{t.methodSprinkler}</option>
                  <option value="drip">{t.methodDrip}</option>
                </select>
              </div>
            </div>

            {/* Concrete Before / After Numbers */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#F9F8F3] border border-[#182218]/10 mb-4">
              <div>
                <div className="text-xs text-[#182218]/65">{t.beforeWaterLabel}</div>
                <div className="text-sm font-bold font-mono-tabular text-[#182218] mt-0.5">
                  {advisoryResult.baselineLitersPerCycle.toLocaleString()} L
                </div>
              </div>
              <div>
                <div className="text-xs text-[#182218]/65">{t.afterWaterLabel}</div>
                <div className="text-sm font-bold font-mono-tabular text-[#059605] mt-0.5">
                  {advisoryResult.optimizedLitersPerCycle.toLocaleString()} L (-{advisoryResult.waterSavedPct}%)
                </div>
              </div>
              <div className="pt-2 border-t border-[#182218]/10">
                <div className="text-xs text-[#182218]/65">{t.seasonSavingsLabel}</div>
                <div className="text-sm font-bold font-mono-tabular text-[#182218] mt-0.5">
                  {advisoryResult.litersSavedSeason.toLocaleString()} L
                </div>
              </div>
              <div className="pt-2 border-t border-[#182218]/10">
                <div className="text-xs text-[#182218]/65">{t.droughtBufferLabel}</div>
                <div className="text-sm font-bold font-mono-tabular text-[#182218] mt-0.5">
                  +{advisoryResult.droughtBufferDaysAdded}d · ₹{advisoryResult.costSavedInr.toLocaleString()}
                </div>
              </div>
            </div>

            {/* SMS & WhatsApp Vernacular Notification Gateway */}
            <div className="pt-3.5 border-t border-[#182218]/12">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-[#059605]" />
                <h4 className="text-sm font-bold text-[#182218]">{t.notificationHubTitle}</h4>
              </div>
              <p className="text-xs text-[#182218]/70 mb-3">{t.notificationHubSubtitle}</p>

              {/* Channel Selector Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#EFECE3] border border-[#182218]/15 rounded-lg mb-3">
                {(
                  [
                    { id: 'whatsapp', label: t.channelWhatsapp },
                    { id: 'sms', label: t.channelSms },
                    { id: 'both', label: t.channelBoth },
                  ] as { id: NotificationChannel; label: string }[]
                ).map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setChannel(ch.id)}
                    className={`py-1.5 px-2 text-[11px] font-semibold rounded-md transition-colors cursor-pointer truncate ${
                      channel === ch.id
                        ? 'bg-[#182218] text-[#d3b44a]'
                        : 'text-[#182218]/75 hover:text-[#182218]'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>

              {/* Recipient Mode Toggle (Taluka Cohort vs Individual Farmer Mobile) */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setRecipientMode('cohort');
                    setPhoneError(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                    recipientMode === 'cohort'
                      ? 'bg-[#F9F8F3] border-[#182218] text-[#182218]'
                      : 'bg-white border-[#182218]/15 text-[#182218]/65'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="truncate">{t.recipientModeCohort}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientMode('single')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                    recipientMode === 'single'
                      ? 'bg-[#F9F8F3] border-[#182218] text-[#182218]'
                      : 'bg-white border-[#182218]/15 text-[#182218]/65'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span className="truncate">{t.recipientModeSingle}</span>
                </button>
              </div>

              {recipientMode === 'single' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                  <div>
                    <label
                      htmlFor="farmer-name-input"
                      className="block text-[11px] font-medium text-[#182218]/75 mb-1"
                    >
                      {t.farmerNameInputLabel}
                    </label>
                    <input
                      id="farmer-name-input"
                      type="text"
                      value={farmerName}
                      onChange={(e) => setFarmerName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#F9F8F3] border border-[#182218]/20 rounded-md text-xs text-[#182218]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="farmer-phone-input"
                      className="block text-[11px] font-medium text-[#182218]/75 mb-1"
                    >
                      {t.farmerPhoneInputLabel}
                    </label>
                    <input
                      id="farmer-phone-input"
                      type="tel"
                      value={farmerPhone}
                      onChange={(e) => setFarmerPhone(e.target.value)}
                      placeholder="9823415678"
                      className="w-full px-2.5 py-1.5 bg-[#F9F8F3] border border-[#182218]/20 rounded-md text-xs font-mono-tabular text-[#182218]"
                    />
                  </div>
                </div>
              )}

              {phoneError && (
                <p className="text-xs font-semibold text-[#c92a2a] mb-2" role="alert">
                  {phoneError}
                </p>
              )}

              {/* Live Vernacular SMS / WhatsApp Message Preview Box */}
              <div className="p-3 rounded-lg bg-[#ecfdf3]/70 border border-[#06ce06]/40 mb-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#182218] mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-[#059605]" />
                    {channel === 'sms' ? t.smsPreviewHeading : t.phonePreviewHeading}
                  </span>
                  <span className="font-mono-tabular text-[#182218]/70">
                    {channel === 'sms'
                      ? `${notificationPayloads.smsText[effectiveAdvisoryLang].length} chars`
                      : effectiveAdvisoryLang.toUpperCase()}
                  </span>
                </div>
                <pre className="text-xs font-sans whitespace-pre-wrap text-[#182218] leading-relaxed">
                  {channel === 'sms'
                    ? notificationPayloads.smsText[effectiveAdvisoryLang]
                    : notificationPayloads.whatsappText[effectiveAdvisoryLang]}
                </pre>
              </div>

              {/* Action Buttons: Gateway Dispatch + Direct WhatsApp Deep Link */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleDispatchAdvisory}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#06ce06] hover:bg-[#05b505] text-[#182218] font-bold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {t.sendWhatsappBtn} (
                    {recipientMode === 'cohort'
                      ? selectedTaluka.farmersEnrolled.toLocaleString()
                      : '+91'}
                    )
                  </span>
                </button>

                <a
                  href={whatsappShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-lg bg-[#182218] hover:bg-[#182218]/90 text-[#d3b44a] font-bold text-xs transition-colors whitespace-nowrap shrink-0"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{t.openWhatsappDirectBtn}</span>
                </a>
              </div>

              {/* Delivery Receipt Log */}
              {dispatchedLogs.length > 0 && (
                <div className="mt-3.5 pt-3 border-t border-[#182218]/10">
                  <div className="text-[11px] font-bold text-[#182218]/70 mb-2">
                    {t.deliveryHistoryTitle}
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {dispatchedLogs.map((log) => (
                      <div
                        key={log.id}
                        className="text-xs text-[#182218] bg-[#F9F8F3] border border-[#182218]/15 rounded-md p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2 font-semibold">
                          <span className="text-[#059605] truncate">
                            ✓ {t.whatsappDispatchedMsg} {log.recipientLabel}
                          </span>
                          <span className="font-mono-tabular text-[10px] text-[#182218]/65 shrink-0">
                            {log.channel.toUpperCase()} · {log.timestamp}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#182218]/80 line-clamp-2">
                          {log.messagePreview}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Floating Toast Notification for High-Priority Weather or Drought Alerts */}
      {toastVisible && activeToastAlert && (
        <div
          id="taluka-priority-toast"
          role="status"
          aria-live="polite"
          onMouseEnter={() => {
            if (toastTimerRef.current) {
              window.clearTimeout(toastTimerRef.current);
            }
          }}
          onMouseLeave={() => {
            toastTimerRef.current = window.setTimeout(() => {
              setToastVisible(false);
            }, 6000);
          }}
          className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2rem)] sm:w-[450px] rounded-xl bg-[#182218] text-[#F9F8F3] shadow-xl border-l-4 border border-[#F9F8F3]/15 p-4 transition-all duration-300"
          style={{ borderLeftColor: activeToastAlert.accentHex }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
                style={{ backgroundColor: `${activeToastAlert.accentHex}26` }}
              >
                <BellRing
                  className="w-3.5 h-3.5"
                  style={{ color: activeToastAlert.accentHex }}
                  aria-hidden="true"
                />
              </span>
              <span
                className="text-[10px] font-mono-tabular font-bold tracking-wider uppercase truncate"
                style={{ color: activeToastAlert.accentHex }}
              >
                {activeToastAlert.badgeText[lang]}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setToastVisible(false)}
              aria-label={TOAST_DISMISS_LABELS[lang]}
              className="p-1 rounded-md text-[#F9F8F3]/65 hover:text-[#F9F8F3] hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-2">
            <div className="text-xs font-bold text-[#F9F8F3] leading-snug">
              {activeToastAlert.title[lang]}
            </div>
            <p className="mt-1 text-xs text-[#F9F8F3]/85 leading-relaxed">
              {activeToastAlert.message[lang]}
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono-tabular text-[#d3b44a] font-semibold truncate">
              {activeToastAlert.metricChip[lang]}
            </span>
            <a
              href="#advisory-section"
              onClick={() => setToastVisible(false)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#06ce06] hover:bg-[#05b505] text-[#182218] text-[11px] font-bold transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-3 h-3" />
              <span>{TOAST_ACTION_LABELS[lang]}</span>
            </a>
          </div>
        </div>
      )}
    </section>
  );
};

