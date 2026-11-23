import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../utils/apiClient';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Database,
  RefreshCw,
  X,
  FileCode2
} from 'lucide-react';

interface TableHealthItem {
  table: string;
  ok: boolean;
  count: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface DeepHealthResponse {
  ok: boolean;
  storage: 'supabase' | 'local';
  serviceRoleConfigured: boolean;
  urlHost?: string | null;
  connected?: boolean;
  writable?: boolean;
  activeMode?: 'supabase' | 'local_fallback';
  hint?: string;
  tables?: TableHealthItem[];
}

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  showSnackbar: (msg: string) => void;
}

const EXPECTED_TABLES = [
  { name: 'app_settings', label: 'Configurações da Igreja' },
  { name: 'ministries', label: 'Departamentos / Ministérios' },
  { name: 'members', label: 'Voluntários' },
  { name: 'services', label: 'Cultos Regulares' },
  { name: 'schedules', label: 'Escalas' },
  { name: 'leaders', label: 'Acessos / Líderes' },
  { name: 'password_resets', label: 'Recuperação de Senha' },
  { name: 'notifications', label: 'Notificações' }
];

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({
  isOpen,
  onClose,
  isDark,
  showSnackbar
}) => {
  const [health, setHealth] = useState<DeepHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sqlText, setSqlText] = useState<string | null>(null);
  const [isLoadingSql, setIsLoadingSql] = useState(false);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const checkConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/health?deep=1');
      if (res.ok) {
        const data = (await res.json()) as DeepHealthResponse;
        setHealth(data);
      } else {
        showSnackbar('Não foi possível consultar a conexão com o Supabase.');
      }
    } catch {
      showSnackbar('Erro de rede ao testar conexão com o Supabase.');
    } finally {
      setIsLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    if (isOpen) {
      void checkConnection();
    }
  }, [isOpen, checkConnection]);

  const loadSqlScript = async (): Promise<string | null> => {
    if (sqlText) return sqlText;
    setIsLoadingSql(true);
    try {
      const res = await apiFetch('/api/admin/supabase-sql');
      if (!res.ok) {
        showSnackbar('Não foi possível carregar o script SQL.');
        return null;
      }
      const data = (await res.json()) as { sql?: string };
      if (data.sql) {
        setSqlText(data.sql);
        return data.sql;
      }
      return null;
    } catch {
      showSnackbar('Erro ao carregar o script SQL.');
      return null;
    } finally {
      setIsLoadingSql(false);
    }
  };

  const handleCopySql = async () => {
    const script = await loadSqlScript();
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setCopiedSql(true);
      showSnackbar('Script SQL completo copiado! Cole no SQL Editor do seu Supabase.');
      window.setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      setShowSqlPreview(true);
      showSnackbar('Abra a visualização abaixo para copiar o script SQL.');
    }
  };

  const handleToggleSqlPreview = async () => {
    if (!showSqlPreview) {
      await loadSqlScript();
    }
    setShowSqlPreview((prev) => !prev);
  };

  if (!isOpen) return null;

  const isSupabaseActive = Boolean(health?.activeMode === 'supabase' && health?.writable);
  const isConnectedReadOnly = Boolean(health?.connected && !isSupabaseActive);
  const tableMap = new Map((health?.tables || []).map((t) => [t.table, t]));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="supabase-modal-title"
        className={`w-full max-w-2xl max-h-[92vh] flex flex-col rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden border-t sm:border ${
          isDark
            ? 'bg-zinc-900 text-zinc-100 border-zinc-800'
            : 'bg-white text-slate-800 border-emerald-100'
        }`}
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center w-full bg-inherit">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700" />
        </div>

        <div
          className={`px-4 sm:px-5 py-3.5 border-b flex items-center justify-between ${
            isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-[#2F9B45]/20 bg-emerald-50/50'
          }`}
        >
          <h2
            id="supabase-modal-title"
            className="text-base font-bold text-[#1B7A32] dark:text-[#42bb5b] flex items-center gap-2"
          >
            <Database className="w-4 h-4 text-[#2F9B45]" />
            <span>Integração Supabase (Banco na Nuvem)</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela do Supabase"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Status Summary */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isSupabaseActive
                ? isDark
                  ? 'bg-emerald-950/30 border-emerald-800/60'
                  : 'bg-emerald-50 border-emerald-200'
                : isDark
                ? 'bg-amber-950/25 border-amber-800/60'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {isSupabaseActive ? (
                <CheckCircle2 className="w-5 h-5 text-[#2F9B45] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-[#F7B13D] shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {isLoading
                    ? 'Verificando conexão com o Supabase...'
                    : isSupabaseActive
                    ? `Conectado e gravando no Supabase (${health?.urlHost || 'nuvem'})`
                    : isConnectedReadOnly
                    ? `Tabelas encontradas em ${health?.urlHost || 'Supabase'}, mas gravação bloqueada`
                    : 'Operando com armazenamento local (Supabase pendente)'}
                </p>
                {health?.hint && (
                  <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                    {health.hint}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={checkConnection}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:border-[#2F9B45] disabled:opacity-60 transition shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#2F9B45] ${isLoading ? 'animate-spin' : ''}`} />
              <span>Testar Conexão</span>
            </button>
          </div>

          {/* 8 Required Tables Checklist */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
              Tabelas Necessárias no Supabase (8)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXPECTED_TABLES.map((item) => {
                const status = tableMap.get(item.name);
                const ready = Boolean(status?.ok);
                return (
                  <div
                    key={item.name}
                    className={`px-3 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                      isDark
                        ? 'bg-zinc-800/50 border-zinc-700/80'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-slate-800 dark:text-zinc-100 truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                        {item.label}
                      </p>
                    </div>
                    {status ? (
                      ready ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1B7A32] dark:text-[#42bb5b] shrink-0 tabular-nums">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{status.count ?? 0} reg.</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                          Pendente
                        </span>
                      )
                    ) : (
                      <span className="text-[11px] text-slate-400 shrink-0">Aguardando chaves</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Setup Guide & SQL Copy */}
          <div
            className={`p-4 rounded-2xl border space-y-3 ${
              isDark ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200">
              Passo a Passo para Ficar no Ar com Supabase
            </h3>
            <ol className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-300 list-decimal list-inside leading-relaxed">
              <li>
                Copie o script SQL completo abaixo e execute no <strong>SQL Editor</strong> do seu projeto Supabase (cria as 8 tabelas, índices, segurança RLS e os 6 acessos iniciais por departamento).
              </li>
              <li>
                Nos <strong>Segredos (Secrets)</strong> do projeto, defina <code className="font-mono">SUPABASE_URL</code>, <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>, <code className="font-mono">SUPABASE_ANON_KEY</code> e <code className="font-mono">SESSION_SECRET</code>.
              </li>
              <li>
                Clique em <strong>Testar Conexão</strong> acima para confirmar a gravação em nuvem.
              </li>
            </ol>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isLoadingSql}
                onClick={handleCopySql}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#2F9B45] hover:bg-[#258239] disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-4 h-4 text-[#F7B13D]" />
                    <span>Script SQL Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#F7B13D]" />
                    <span>{isLoadingSql ? 'Carregando SQL...' : 'Copiar Script SQL (8 Tabelas)'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isLoadingSql}
                onClick={handleToggleSqlPreview}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold inline-flex items-center gap-1.5 hover:border-[#2F9B45] transition"
              >
                <FileCode2 className="w-4 h-4 text-[#2F9B45]" />
                <span>{showSqlPreview ? 'Ocultar SQL' : 'Visualizar Script SQL'}</span>
              </button>
            </div>

            {showSqlPreview && sqlText && (
              <textarea
                readOnly
                value={sqlText}
                aria-label="Script SQL de criação das tabelas no Supabase"
                rows={10}
                onFocus={(e) => e.currentTarget.select()}
                className={`w-full p-3 rounded-xl border font-mono text-[11px] leading-relaxed outline-none ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
