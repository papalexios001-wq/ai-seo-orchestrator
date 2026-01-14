// App.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR AI v13.0 - Enterprise-Grade SEO Analysis Platform
// State-of-the-Art Analysis Pipeline with Progressive Results & Intelligent Caching
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Component Imports
// ─────────────────────────────────────────────────────────────────────────────
import { Header } from './components/Header';
import { ErrorMessage } from './components/ErrorMessage';
import { HistoryPanel } from './components/HistoryPanel';
import { CrawlingAnimation } from './components/CrawlingAnimation';
import { GuidedAnalysisWizard, type WizardSubmitData } from './components/GuidedAnalysisWizard';
import { Modal } from './components/Modal';
import { GoogleSearchConsoleConnect } from './components/GoogleSearchConsoleConnect';
import { AiConfiguration } from './components/AiConfiguration';
import { ActionPlanDashboard } from './components/ActionPlanDashboard';

// ─────────────────────────────────────────────────────────────────────────────
// Service Imports
// ─────────────────────────────────────────────────────────────────────────────
import {
  generateSitewideAudit,
  generateSeoAnalysis,
  generateExecutiveSummary,
} from './services/aiService';
import { rankUrls } from './utils/seoScoring';
import { crawlSitemap } from './services/crawlingService';
import { createActionPlan } from './services/actionPlanService';
import { cacheService } from './services/cacheService';

// ─────────────────────────────────────────────────────────────────────────────
// Type Imports
// ─────────────────────────────────────────────────────────────────────────────
import type { 
  HistoricalAnalysis, 
  CrawlProgress, 
  GscSite, 
  GscTokenResponse, 
  AiConfig,
  SitewideAnalysis,
  SeoAnalysisResult,
  ExecutiveSummary,
  DailyActionPlan,
  GroundingSource,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export type PipelineStageStatus = 'pending' | 'running' | 'complete' | 'error' | 'skipped';

export interface PipelineStage {
  id: string;
  name: string;
  description: string;
  status: PipelineStageStatus;
  progress: number;
  itemsProcessed?: number;
  totalItems?: number;
  currentTask?: string;
  startTime?: number;
  endTime?: number;
}

export interface ActivityLogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'ai';
  stage?: string;
}

export interface PartialResults {
  sitewideAnalysis?: SitewideAnalysis;
  seoAnalysis?: SeoAnalysisResult;
  executiveSummary?: ExecutiveSummary;
  actionPlan?: DailyActionPlan[];
  urlsDiscovered?: number;
  urlsAnalyzed?: number;
}

const PIPELINE_STAGE_DEFINITIONS: Omit<PipelineStage, 'status' | 'progress'>[] = [
  { 
    id: 'crawl', 
    name: 'Sitemap Discovery', 
    description: 'Crawling sitemaps in parallel to extract all page URLs' 
  },
  { 
    id: 'rank', 
    name: 'URL Prioritization', 
    description: 'Scoring and ranking URLs by strategic SEO value' 
  },
  { 
    id: 'competitor', 
    name: 'Competitor Intelligence', 
    description: 'Analyzing competitor content gaps and strategies' 
  },
  { 
    id: 'technical', 
    name: 'Technical Health Scan', 
    description: 'Auditing site architecture, speed, and crawlability' 
  },
  { 
    id: 'content', 
    name: 'Content Analysis', 
    description: 'Evaluating on-page SEO factors and content quality' 
  },
  { 
    id: 'actionplan', 
    name: 'Action Plan Generation', 
    description: 'Creating prioritized implementation roadmap' 
  },
  { 
    id: 'summary', 
    name: 'Executive Synthesis', 
    description: 'Generating 80/20 executive summary with top priorities' 
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE KEYS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const HISTORY_STORAGE_KEY = 'seo-analyzer-history-v13';
const AI_CONFIG_STORAGE_KEY = 'seo-analyzer-ai-config-v13';
const MAX_URLS_FOR_ANALYSIS = 100;

type AppState = 'idle' | 'loading' | 'results' | 'error' | 'configure_ai';
type LoadingPhase = 'crawling' | 'analyzing';

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════════

const SpinnerIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const ErrorIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
  </svg>
);

const AIIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE VISUALIZATION COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ 
  percentage, 
  size = 120, 
  strokeWidth = 8 
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-700/50"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#14B8A6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400">
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
};

const PulsingDot: React.FC<{ color?: string }> = ({ color = 'bg-blue-500' }) => (
  <span className="relative flex h-3 w-3">
    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />
    <span className={`relative inline-flex rounded-full h-3 w-3 ${color}`} />
  </span>
);

interface StageCardProps {
  stage: PipelineStage;
  index: number;
  isActive: boolean;
}

const StageCard: React.FC<StageCardProps> = ({ stage, index, isActive }) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (stage.status === 'running' && stage.startTime) {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - stage.startTime!);
      }, 1000);
      return () => clearInterval(interval);
    }
    if (stage.status === 'complete' && stage.startTime && stage.endTime) {
      setElapsedTime(stage.endTime - stage.startTime);
    }
  }, [stage.status, stage.startTime, stage.endTime]);

  const statusConfig = {
    pending: {
      bg: 'bg-gray-800/40',
      border: 'border-gray-700/40',
      iconBg: 'bg-gray-700',
      iconColor: 'text-gray-500',
    },
    running: {
      bg: 'bg-blue-900/20',
      border: 'border-blue-500/50',
      iconBg: 'bg-blue-500',
      iconColor: 'text-white',
    },
    complete: {
      bg: 'bg-green-900/20',
      border: 'border-green-500/40',
      iconBg: 'bg-green-500',
      iconColor: 'text-white',
    },
    error: {
      bg: 'bg-red-900/20',
      border: 'border-red-500/40',
      iconBg: 'bg-red-500',
      iconColor: 'text-white',
    },
    skipped: {
      bg: 'bg-gray-800/30',
      border: 'border-gray-600/40',
      iconBg: 'bg-gray-600',
      iconColor: 'text-gray-400',
    },
  };

  const config = statusConfig[stage.status];

  return (
    <div 
      className={`rounded-xl border transition-all duration-300 ${config.bg} ${config.border} ${
        isActive ? 'ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10' : ''
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.iconBg} ${config.iconColor}`}>
            {stage.status === 'running' ? (
              <SpinnerIcon className="w-5 h-5" />
            ) : stage.status === 'complete' ? (
              <CheckIcon className="w-5 h-5" />
            ) : stage.status === 'error' ? (
              <ErrorIcon className="w-5 h-5" />
            ) : stage.status === 'skipped' ? (
              <span className="text-xs">⏭</span>
            ) : (
              <span className="text-sm font-bold">{index + 1}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className={`font-semibold ${
                stage.status === 'running' ? 'text-blue-300' : 
                stage.status === 'complete' ? 'text-green-300' :
                stage.status === 'error' ? 'text-red-300' :
                stage.status === 'skipped' ? 'text-gray-500' :
                'text-gray-400'
              }`}>
                {stage.name}
              </h4>
              
              {(stage.status === 'running' || stage.status === 'complete') && (
                <span className={`text-xs font-mono ${
                  stage.status === 'complete' ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {stage.status === 'complete' && '✓ '}
                  {formatDuration(elapsedTime)}
                </span>
              )}
            </div>

            {stage.status === 'running' && stage.currentTask && (
              <div className="mt-2 flex items-center gap-2">
                <PulsingDot />
                <p className="text-sm text-gray-400 truncate animate-pulse">
                  {stage.currentTask}
                </p>
              </div>
            )}

            {stage.itemsProcessed !== undefined && stage.totalItems !== undefined && stage.totalItems > 0 && (
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                <span>{stage.itemsProcessed.toLocaleString()} / {stage.totalItems.toLocaleString()} items</span>
              </div>
            )}

            {stage.status === 'running' && (
              <div className="mt-3 w-full bg-gray-700/30 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-400 transition-all duration-300"
                  style={{ 
                    width: `${stage.progress}%`,
                    boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ActivityLogProps {
  entries: ActivityLogEntry[];
}

const ActivityLog: React.FC<ActivityLogProps> = ({ entries }) => {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [entries]);

  const getEntryStyles = (type: ActivityLogEntry['type']) => {
    switch (type) {
      case 'success':
        return { icon: <CheckIcon className="w-4 h-4" />, color: 'text-green-400', bg: 'bg-green-400/10' };
      case 'warning':
        return { icon: <ErrorIcon className="w-4 h-4" />, color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
      case 'error':
        return { icon: <ErrorIcon className="w-4 h-4" />, color: 'text-red-400', bg: 'bg-red-400/10' };
      case 'ai':
        return { icon: <AIIcon className="w-4 h-4" />, color: 'text-purple-400', bg: 'bg-purple-400/10' };
      default:
        return { icon: <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />, color: 'text-blue-400', bg: '' };
    }
  };

  return (
    <div 
      ref={logRef}
      className="h-48 overflow-y-auto bg-gray-950/50 rounded-lg border border-gray-800 p-3 font-mono text-xs space-y-1"
    >
      {entries.length === 0 ? (
        <div className="h-full flex items-center justify-center text-gray-600">
          <span>Initializing analysis engine...</span>
        </div>
      ) : (
        entries.map((entry, i) => {
          const styles = getEntryStyles(entry.type);
          return (
            <div key={i} className={`flex items-start gap-2 py-1 px-2 rounded ${styles.bg} animate-fade-in`}>
              <span className="text-gray-600 shrink-0">{formatTime(entry.timestamp)}</span>
              <span className={`shrink-0 mt-0.5 ${styles.color}`}>{styles.icon}</span>
              <span className={`${styles.color} break-words`}>{entry.message}</span>
            </div>
          );
        })
      )}
      <div className="flex items-center gap-2 py-1">
        <span className="text-gray-600 animate-pulse">▌</span>
      </div>
    </div>
  );
};

interface AnalysisPipelineProps {
  stages: PipelineStage[];
  activityLog: ActivityLogEntry[];
  startTime: number;
}

const AnalysisPipeline: React.FC<AnalysisPipelineProps> = ({ 
  stages,
  activityLog,
  startTime
}) => {
  const [totalElapsed, setTotalElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTotalElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const overallProgress = useMemo(() => {
    return stages.reduce((acc, s) => acc + s.progress, 0) / stages.length;
  }, [stages]);

  const completedCount = useMemo(() => {
    return stages.filter(s => s.status === 'complete').length;
  }, [stages]);

  const runningStage = useMemo(() => {
    return stages.find(s => s.status === 'running');
  }, [stages]);

  const estimatedRemaining = useMemo(() => {
    if (overallProgress <= 0) return null;
    const elapsed = totalElapsed;
    const estimated = (elapsed / overallProgress) * (100 - overallProgress);
    return Math.max(0, Math.round(estimated / 1000));
  }, [overallProgress, totalElapsed]);

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-xl animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/30 to-teal-900/30 border-b border-gray-800 p-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <CircularProgress percentage={overallProgress} />
            <div className="text-center lg:text-left">
              <h2 className="text-2xl font-bold text-gray-200">Analysis in Progress</h2>
              <p className="text-gray-400 mt-1">
                {runningStage?.description || 'Initializing...'}
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-gray-500">
                  Stage {completedCount + 1} of {stages.length}
                </span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-500">
                  Elapsed: {formatDuration(totalElapsed)}
                </span>
                {estimatedRemaining !== null && estimatedRemaining > 0 && (
                  <>
                    <span className="text-gray-600">•</span>
                    <span className="text-teal-400">
                      ~{formatDuration(estimatedRemaining * 1000)} remaining
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-xl">
            <AIIcon className="w-6 h-6 text-purple-400 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-purple-300">AI Engine Active</p>
              <p className="text-xs text-purple-400/70">Processing your data</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Stages List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Pipeline Stages
            </h3>
            {stages.map((stage, index) => (
              <StageCard 
                key={stage.id} 
                stage={stage} 
                index={index}
                isActive={stage.status === 'running'}
              />
            ))}
          </div>

          {/* Activity Log */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              Live Activity Feed
            </h3>
            <ActivityLog entries={activityLog} />

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-400">
                  {stages.filter(s => s.status === 'complete').length}
                </p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-teal-400">
                  {runningStage?.itemsProcessed?.toLocaleString() || '—'}
                </p>
                <p className="text-xs text-gray-500">Items Processed</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-400">
                  {activityLog.filter(e => e.type === 'ai').length}
                </p>
                <p className="text-xs text-gray-500">AI Operations</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESSIVE RESULTS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

interface ProgressiveResultsPanelProps {
  results: PartialResults;
}

const ProgressiveResultsPanel: React.FC<ProgressiveResultsPanelProps> = ({ results }) => {
  const hasAnyResults = Object.keys(results).length > 0 && (
    results.urlsDiscovered ||
    results.sitewideAnalysis ||
    results.seoAnalysis
  );

  if (!hasAnyResults) return null;

  return (
    <div className="mt-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
          <CheckIcon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-green-400">Early Insights Available</h3>
          <p className="text-sm text-gray-400">Results are appearing as analysis completes</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {results.urlsDiscovered !== undefined && (
          <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/20 text-blue-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">URLs Discovered</p>
                <p className="text-2xl font-bold text-blue-400">{results.urlsDiscovered.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {results.urlsAnalyzed !== undefined && (
          <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-teal-500/20 text-teal-400">
                <AIIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">URLs Analyzed</p>
                <p className="text-2xl font-bold text-teal-400">{results.urlsAnalyzed.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {results.seoAnalysis?.pageActions && (
          <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-orange-500/20 text-orange-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">High-Priority Pages</p>
                <p className="text-2xl font-bold text-orange-400">
                  {results.seoAnalysis.pageActions.filter(p => p.priority === 'high').length}
                </p>
              </div>
            </div>
          </div>
        )}

        {results.seoAnalysis?.keywords && (
          <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-500/20 text-purple-400">
                <AIIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Keyword Opportunities</p>
                <p className="text-2xl font-bold text-purple-400">{results.seoAnalysis.keywords.length}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Strategic Mission */}
      {results.sitewideAnalysis?.strategicRoadmap?.missionStatement && (
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl p-5 border border-gray-700/50">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400 shrink-0">
              <AIIcon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-teal-400">Strategic Mission Identified</h4>
              <p className="text-gray-300 mt-1">{results.sitewideAnalysis.strategicRoadmap.missionStatement}</p>
            </div>
          </div>
        </div>
      )}

      {/* Technical Health */}
      {results.sitewideAnalysis?.technicalHealth && (
        <div className="flex items-center gap-4 p-4 bg-gray-800/60 rounded-xl border border-gray-700/50">
          <div className={`p-3 rounded-lg ${
            results.sitewideAnalysis.technicalHealth.status === 'good' 
              ? 'bg-green-500/20 text-green-400' 
              : results.sitewideAnalysis.technicalHealth.status === 'needs_improvement'
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-400">Technical Health Status</p>
            <p className={`text-lg font-semibold capitalize ${
              results.sitewideAnalysis.technicalHealth.status === 'good' 
                ? 'text-green-400' 
                : results.sitewideAnalysis.technicalHealth.status === 'needs_improvement'
                ? 'text-yellow-400'
                : 'text-red-400'
            }`}>
              {results.sitewideAnalysis.technicalHealth.status.replace('_', ' ')}
            </p>
          </div>
        </div>
      )}

      {/* Content Gap Preview */}
      {results.sitewideAnalysis?.contentGaps && results.sitewideAnalysis.contentGaps.length > 0 && (
        <div className="bg-gradient-to-r from-teal-900/30 to-blue-900/30 rounded-xl p-5 border border-teal-500/30">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <h4 className="font-semibold text-teal-300">Top Content Gap Identified</h4>
              <p className="text-lg text-gray-200 mt-1">{results.sitewideAnalysis.contentGaps[0].topic}</p>
              <p className="text-sm text-gray-400 mt-2">{results.sitewideAnalysis.contentGaps[0].rationale}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const App: React.FC = () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // Core State
  // ─────────────────────────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<HistoricalAnalysis[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  
  const [appState, setAppState] = useState<AppState>('idle');
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('crawling');
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState<boolean>(false);
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // Pipeline State
  // ─────────────────────────────────────────────────────────────────────────────
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(
    PIPELINE_STAGE_DEFINITIONS.map(s => ({ ...s, status: 'pending' as const, progress: 0 }))
  );
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [partialResults, setPartialResults] = useState<PartialResults>({});
  const [analysisStartTime, setAnalysisStartTime] = useState<number>(Date.now());

  // ─────────────────────────────────────────────────────────────────────────────
  // GSC & AI Config State
  // ─────────────────────────────────────────────────────────────────────────────
  const [gscToken, setGscToken] = useState<GscTokenResponse | null>(null);
  const [gscSites, setGscSites] = useState<GscSite[]>([]);
  const [isGscModalOpen, setIsGscModalOpen] = useState<boolean>(false);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Computed State
  // ─────────────────────────────────────────────────────────────────────────────
  const isGscConnected = useMemo(() => !!gscToken, [gscToken]);

  const analysisToDisplay = useMemo(() => {
    if (!selectedAnalysisId) return null;
    return analysisHistory.find(h => h.id === selectedAnalysisId) ?? null;
  }, [selectedAnalysisId, analysisHistory]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Pipeline Helpers
  // ─────────────────────────────────────────────────────────────────────────────
  const updateStage = useCallback((stageId: string, updates: Partial<PipelineStage>) => {
    setPipelineStages(prev => prev.map(s => 
      s.id === stageId ? { ...s, ...updates } : s
    ));
  }, []);

  const addLog = useCallback((message: string, type: ActivityLogEntry['type'] = 'info', stage?: string) => {
    setActivityLog(prev => [...prev, { 
      timestamp: Date.now(), 
      message, 
      type,
      stage 
    }]);
  }, []);

  const resetPipeline = useCallback(() => {
    setPipelineStages(PIPELINE_STAGE_DEFINITIONS.map(s => ({ ...s, status: 'pending' as const, progress: 0 })));
    setActivityLog([]);
    setPartialResults({});
    setAnalysisStartTime(Date.now());
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // History Helpers
  // ─────────────────────────────────────────────────────────────────────────────
  const updateAnalysisInHistory = useCallback((id: string, updatedAnalysis: Partial<HistoricalAnalysis>) => {
    setAnalysisHistory(prev => {
      const updated = prev.map(h => h.id === id ? { ...h, ...updatedAnalysis } : h);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleToggleTaskComplete = useCallback((actionItemId: string) => {
    if (!analysisToDisplay || !analysisToDisplay.actionPlan) return;

    const newActionPlan = analysisToDisplay.actionPlan.map(day => ({
      ...day,
      actions: day.actions.map(action =>
        action.id === actionItemId
          ? { ...action, completed: !action.completed }
          : action
      ),
    }));

    updateAnalysisInHistory(analysisToDisplay.id, { actionPlan: newActionPlan });
  }, [analysisToDisplay, updateAnalysisInHistory]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const storedConfig = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
      if (storedConfig) {
        setAiConfig(JSON.parse(storedConfig));
      } else {
        setAppState('configure_ai');
      }

      const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (storedHistory) {
        const history = JSON.parse(storedHistory) as HistoricalAnalysis[];
        setAnalysisHistory(history);
        if (history.length > 0 && storedConfig) {
          setSelectedAnalysisId(history[0].id);
          setAppState('results');
        }
      }
    } catch (e) {
      console.error("Failed to parse from localStorage", e);
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      localStorage.removeItem(AI_CONFIG_STORAGE_KEY);
      setAppState('configure_ai');
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Navigation Handlers
  // ─────────────────────────────────────────────────────────────────────────────
  const handleNewAnalysis = useCallback(() => {
    setSelectedAnalysisId(null);
    setAppState(aiConfig ? 'idle' : 'configure_ai');
    setError(null);
    resetPipeline();
  }, [aiConfig, resetPipeline]);
  
  const handleAiConfigChange = useCallback((config: AiConfig) => {
    setAiConfig(config);
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
    setAppState('idle');
  }, []);
  
  const handleAiSettingsChange = useCallback(() => {
    setAiConfig(null);
    localStorage.removeItem(AI_CONFIG_STORAGE_KEY);
    setAppState('configure_ai');
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Main Analysis Handler
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (data: WizardSubmitData) => {
    if (!data.sitemapUrl) {
      setError('Please enter your sitemap.xml URL.');
      setAppState('error');
      return;
    }
    if (!aiConfig) {
      setError('AI Provider is not configured.');
      setAppState('configure_ai');
      return;
    }
    
    let initialSitemapUrl: URL;
    try {
      initialSitemapUrl = new URL(data.sitemapUrl);
    } catch (_) {
      setError('Please enter a valid sitemap URL (e.g., https://example.com/sitemap.xml).');
      setAppState('error');
      return;
    }
    
    const competitorUrls = data.competitorSitemaps.split('\n').map(u => u.trim()).filter(Boolean);

    // Initialize state
    abortControllerRef.current = new AbortController();
    setAppState('loading');
    setLoadingPhase('crawling');
    setError(null);
    setSelectedAnalysisId(null);
    setCrawlProgress(null);
    resetPipeline();
    setAnalysisStartTime(Date.now());
    
    try {
      // ═══════════════════════════════════════════════════════════════════════
      // STAGE 1: CRAWL SITEMAP
      // ═══════════════════════════════════════════════════════════════════════
      addLog('Starting sitemap discovery...', 'info', 'crawl');
      updateStage('crawl', { 
        status: 'running', 
        startTime: Date.now(),
        currentTask: 'Initializing parallel crawler...'
      });
      
      const allPageUrls = await crawlSitemap(initialSitemapUrl.toString(), (progress: CrawlProgress) => {
        requestAnimationFrame(() => {
          setCrawlProgress(progress);
          const progressPercent = progress.total > 0 ? (progress.count / progress.total) * 100 : 0;
          updateStage('crawl', { 
            progress: progressPercent,
            itemsProcessed: progress.count,
            totalItems: progress.total,
            currentTask: `Processing ${progress.currentSitemap || 'sitemap'}...`
          });
        });
      });
      
      updateStage('crawl', { status: 'complete', progress: 100, endTime: Date.now() });
      addLog(`Discovered ${allPageUrls.size} URLs`, 'success', 'crawl');
      setPartialResults(prev => ({ ...prev, urlsDiscovered: allPageUrls.size }));

      const urlsFromSitemap = Array.from(allPageUrls);
      if (urlsFromSitemap.length === 0) {
        throw new Error("Crawl complete, but no URLs were found. Your sitemap might be empty or in a format that could not be parsed.");
      }
      
      // Switch to analysis phase
      setLoadingPhase('analyzing');
      setCrawlProgress(null);

      // ═══════════════════════════════════════════════════════════════════════
      // CACHE CHECK: Try to use cached results
      // ═══════════════════════════════════════════════════════════════════════
      addLog('Checking for cached analysis...', 'info');
      const cachedAnalysis = await cacheService.getAnalysis(data.url, urlsFromSitemap);
      
      if (cachedAnalysis) {
        addLog('🚀 Cache hit! Using cached analysis...', 'success');
        
        // Fast-forward completed stages
        ['rank', 'competitor', 'technical', 'content'].forEach(stageId => {
          updateStage(stageId, { status: 'complete', progress: 100, endTime: Date.now() });
        });
        
        setPartialResults({
          urlsDiscovered: urlsFromSitemap.length,
          sitewideAnalysis: cachedAnalysis.sitewide,
          seoAnalysis: cachedAnalysis.seo,
        });
        
        // Generate fresh action plan
        addLog('Generating fresh action plan from cache...', 'ai', 'actionplan');
        updateStage('actionplan', { status: 'running', startTime: Date.now(), currentTask: 'Creating implementation roadmap...' });
        
        const actionPlan = await createActionPlan(
          aiConfig, 
          cachedAnalysis.sitewide, 
          cachedAnalysis.seo, 
          (msg) => {
            updateStage('actionplan', { currentTask: msg });
            addLog(msg, 'ai', 'actionplan');
          }
        );
        
        updateStage('actionplan', { status: 'complete', progress: 100, endTime: Date.now() });
        addLog('Action plan generated', 'success', 'actionplan');
        setPartialResults(prev => ({ ...prev, actionPlan }));
        
        // Generate executive summary
        addLog('Synthesizing executive summary...', 'ai', 'summary');
        updateStage('summary', { status: 'running', startTime: Date.now(), currentTask: 'Creating 80/20 analysis...' });
        
        const executiveSummary = await generateExecutiveSummary(aiConfig, cachedAnalysis.sitewide, cachedAnalysis.seo);
        
        updateStage('summary', { status: 'complete', progress: 100, endTime: Date.now() });
        addLog('Executive summary complete', 'success', 'summary');
        setPartialResults(prev => ({ ...prev, executiveSummary }));
        
        // Build and save final analysis
        const newAnalysis: HistoricalAnalysis = {
          id: new Date().toISOString(),
          date: new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          sitemapUrl: data.url,
          competitorSitemaps: competitorUrls,
          sitewideAnalysis: cachedAnalysis.sitewide,
          analysis: cachedAnalysis.seo,
          sources: [],
          analysisType: data.analysisType,
          location: data.targetLocation,
          actionPlan: actionPlan,
          executiveSummary: executiveSummary,
        };
        
        const updatedHistory = [newAnalysis, ...analysisHistory].slice(0, 10);
        setAnalysisHistory(updatedHistory);
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
        setSelectedAnalysisId(newAnalysis.id);
        setAppState('results');
        return;
      }
      
      addLog('No valid cache found, running full analysis...', 'info');

      // ═══════════════════════════════════════════════════════════════════════
      // STAGE 2: RANK URLS
      // ═══════════════════════════════════════════════════════════════════════
      addLog('Prioritizing URLs by SEO value...', 'info', 'rank');
      updateStage('rank', { status: 'running', startTime: Date.now(), currentTask: 'Scoring URL importance...' });
      
      const rankedUrls = rankUrls(urlsFromSitemap);
      const inputUrls = rankedUrls.slice(0, MAX_URLS_FOR_ANALYSIS);
      
      updateStage('rank', { status: 'complete', progress: 100, endTime: Date.now() });
      addLog(`Ranked ${rankedUrls.length} URLs, analyzing top ${inputUrls.length}`, 'success', 'rank');
      setPartialResults(prev => ({ ...prev, urlsAnalyzed: inputUrls.length }));

      // ═══════════════════════════════════════════════════════════════════════
      // STAGES 3-5: PARALLEL ANALYSIS (Competitor + Technical + Content)
      // ═══════════════════════════════════════════════════════════════════════
      addLog('Starting parallel AI analysis engines...', 'ai');
      
      // Mark all parallel stages as running
      updateStage('competitor', { status: 'running', startTime: Date.now(), currentTask: 'Analyzing competitor sitemaps...' });
      updateStage('technical', { status: 'running', startTime: Date.now(), currentTask: 'Auditing technical health...' });
      updateStage('content', { status: 'running', startTime: Date.now(), currentTask: 'Evaluating content quality...' });
      
      const [sitewideAnalysis, { analysis, sources }] = await Promise.all([
        generateSitewideAudit(
          aiConfig,
          inputUrls, 
          competitorUrls, 
          data.analysisType, 
          data.targetLocation, 
          (msg) => {
            if (msg.toLowerCase().includes('competitor')) {
              updateStage('competitor', { currentTask: msg });
              addLog(msg, 'ai', 'competitor');
            } else {
              updateStage('technical', { currentTask: msg });
              addLog(msg, 'ai', 'technical');
            }
          }
        ),
        generateSeoAnalysis(
          aiConfig,
          inputUrls, 
          data.analysisType, 
          data.targetLocation,
          [],
          (msg) => {
            updateStage('content', { currentTask: msg });
            addLog(msg, 'ai', 'content');
          }
        )
      ]);
      
      // Mark parallel stages complete
      updateStage('competitor', { status: 'complete', progress: 100, endTime: Date.now() });
      updateStage('technical', { status: 'complete', progress: 100, endTime: Date.now() });
      updateStage('content', { status: 'complete', progress: 100, endTime: Date.now() });
      
      addLog('Sitewide audit complete', 'success', 'technical');
      addLog('Content analysis complete', 'success', 'content');
      
      // Surface partial results immediately
      setPartialResults(prev => ({ 
        ...prev, 
        sitewideAnalysis,
        seoAnalysis: analysis 
      }));

      // ═══════════════════════════════════════════════════════════════════════
      // CACHE: Store results for future use
      // ═══════════════════════════════════════════════════════════════════════
      addLog('Caching analysis for future use...', 'info');
      await cacheService.setAnalysis(data.url, urlsFromSitemap, sitewideAnalysis, analysis);

      // ═══════════════════════════════════════════════════════════════════════
      // STAGE 6: ACTION PLAN
      // ═══════════════════════════════════════════════════════════════════════
      addLog('Generating implementation roadmap...', 'ai', 'actionplan');
      updateStage('actionplan', { 
        status: 'running', 
        startTime: Date.now(),
        currentTask: 'Creating daily action items...'
      });
      
      const actionPlan = await createActionPlan(
        aiConfig, 
        sitewideAnalysis, 
        analysis, 
        (msg) => {
          updateStage('actionplan', { currentTask: msg });
          addLog(msg, 'ai', 'actionplan');
        }
      );
      
      updateStage('actionplan', { status: 'complete', progress: 100, endTime: Date.now() });
      addLog('Action plan generated successfully', 'success', 'actionplan');
      setPartialResults(prev => ({ ...prev, actionPlan }));

      // ═══════════════════════════════════════════════════════════════════════
      // STAGE 7: EXECUTIVE SUMMARY
      // ═══════════════════════════════════════════════════════════════════════
      addLog('Synthesizing executive summary...', 'ai', 'summary');
      updateStage('summary', { 
        status: 'running', 
        startTime: Date.now(),
        currentTask: 'Generating 80/20 analysis...'
      });
      
      const executiveSummary = await generateExecutiveSummary(aiConfig, sitewideAnalysis, analysis);
      
      updateStage('summary', { status: 'complete', progress: 100, endTime: Date.now() });
      addLog('Executive summary complete', 'success', 'summary');
      setPartialResults(prev => ({ ...prev, executiveSummary }));

      // ═══════════════════════════════════════════════════════════════════════
      // FINALIZE
      // ═══════════════════════════════════════════════════════════════════════
      addLog('🎉 Analysis complete! Building final report...', 'success');
      
      const newAnalysis: HistoricalAnalysis = {
        id: new Date().toISOString(),
        date: new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        sitemapUrl: data.url,
        competitorSitemaps: competitorUrls,
        sitewideAnalysis: sitewideAnalysis,
        analysis: analysis,
        sources: sources,
        analysisType: data.analysisType,
        location: data.targetLocation,
        actionPlan: actionPlan,
        executiveSummary: executiveSummary,
      };
      
      const updatedHistory = [newAnalysis, ...analysisHistory].slice(0, 10);
      setAnalysisHistory(updatedHistory);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));

      setSelectedAnalysisId(newAnalysis.id);
      setAppState('results');

    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred.';
      setError(errorMessage);
      addLog(`❌ Analysis failed: ${errorMessage}`, 'error');
      
      // Mark current running stage as error
      setPipelineStages(prev => prev.map(s => 
        s.status === 'running' ? { ...s, status: 'error' as const } : s
      ));
      
      setAppState('error');
    }
  }, [aiConfig, analysisHistory, updateStage, addLog, resetPipeline]);

  // ─────────────────────────────────────────────────────────────────────────────
  // GSC Handlers
  // ─────────────────────────────────────────────────────────────────────────────
  const handleGscConnect = useCallback((token: GscTokenResponse, sites: GscSite[]) => {
    setGscToken(token);
    setGscSites(sites);
    setIsGscModalOpen(false);
  }, []);

  const handleGscDisconnect = useCallback(() => {
    setGscToken(null);
    setGscSites([]);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render Content
  // ─────────────────────────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (appState) {
      case 'configure_ai':
        return (
          <div className="max-w-3xl mx-auto mt-10">
            <AiConfiguration
              onConfigured={handleAiConfigChange}
              currentConfig={aiConfig}
            />
          </div>
        );
        
      case 'loading':
        // Show crawling animation during crawl phase
        if (loadingPhase === 'crawling' && crawlProgress) {
          return <CrawlingAnimation progress={crawlProgress} />;
        }
        
        // Show pipeline + progressive results during analysis phase
        return (
          <div className="mt-8 space-y-6 animate-fade-in">
            <AnalysisPipeline 
              stages={pipelineStages} 
              activityLog={activityLog}
              startTime={analysisStartTime}
            />
            <ProgressiveResultsPanel results={partialResults} />
          </div>
        );
        
      case 'results':
        if (analysisToDisplay && aiConfig) {
          return (
            <div className="mt-8 animate-fade-in">
              <ActionPlanDashboard
                analysis={analysisToDisplay}
                onToggleTaskComplete={handleToggleTaskComplete}
                aiConfig={aiConfig}
                isGscConnected={isGscConnected}
                onConnectGscClick={() => setIsGscModalOpen(true)}
                gscToken={gscToken}
              />
            </div>
          );
        }
        handleNewAnalysis(); 
        return (
          <GuidedAnalysisWizard 
            isLoading={false} 
            onSubmit={handleSubmit} 
            gscSites={gscSites} 
            isGscConnected={isGscConnected} 
            isAiConfigured={!!aiConfig} 
            aiConfig={aiConfig} 
            onAiSettingsClick={handleAiSettingsChange} 
          />
        );
        
      case 'error':
        return (
          <div className="mt-8 animate-fade-in">
            {error && <ErrorMessage message={error} />}
            
            {/* Show pipeline state on error for debugging */}
            <div className="mt-6">
              <AnalysisPipeline 
                stages={pipelineStages} 
                activityLog={activityLog}
                startTime={analysisStartTime}
              />
            </div>
            
            {/* Show any partial results that were gathered */}
            {Object.keys(partialResults).length > 0 && (
              <div className="mt-6">
                <ProgressiveResultsPanel results={partialResults} />
              </div>
            )}
            
            <div className="text-center mt-8">
              <button
                onClick={handleNewAnalysis}
                className="text-sm font-semibold px-6 py-2.5 rounded-lg transition-all duration-200 bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-600/30"
              >
                Start New Analysis
              </button>
            </div>
          </div>
        );

      case 'idle':
      default:
        return (
          <GuidedAnalysisWizard 
            isLoading={false}
            onSubmit={handleSubmit}
            gscSites={gscSites}
            isGscConnected={isGscConnected}
            isAiConfigured={!!aiConfig}
            aiConfig={aiConfig}
            onAiSettingsClick={handleAiSettingsChange}
          />
        );
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-300 font-sans">
      {/* GSC Modal */}
      {isGscModalOpen && (
        <Modal title="Connect Google Search Console" onClose={() => setIsGscModalOpen(false)}>
          <GoogleSearchConsoleConnect 
            onConnect={handleGscConnect}
            onDisconnect={handleGscDisconnect}
            isConnected={isGscConnected}
          />
        </Modal>
      )}
      
      <div className="flex">
        {/* History Sidebar */}
        <HistoryPanel
          history={analysisHistory}
          selectedId={selectedAnalysisId}
          isOpen={isHistoryPanelOpen}
          onClose={() => setIsHistoryPanelOpen(false)}
          onSelect={(id) => {
            if (aiConfig) {
              setSelectedAnalysisId(id);
              setAppState('results');
              setError(null);
              setIsHistoryPanelOpen(false);
            } else {
              setAppState('configure_ai');
            }
          }}
          onClear={() => {
            setAnalysisHistory([]);
            setSelectedAnalysisId(null);
            localStorage.removeItem(HISTORY_STORAGE_KEY);
            cacheService.clearCache('*');
            handleGscDisconnect();
            handleNewAnalysis();
          }}
        />
        
        {/* Main Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto" style={{ height: '100vh' }}>
          <div className="max-w-7xl mx-auto">
            <Header 
              onMenuClick={() => setIsHistoryPanelOpen(true)}
              showNewAnalysisButton={appState === 'results'}
              onNewAnalysisClick={handleNewAnalysis}
              isGscConnected={isGscConnected}
              onConnectClick={() => setIsGscModalOpen(true)}
              isAiConfigured={!!aiConfig}
              onAiSettingsClick={handleAiSettingsChange}
            />
            <main>
              {renderContent()}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
