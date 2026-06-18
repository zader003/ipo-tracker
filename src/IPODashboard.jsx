import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-800 rounded-lg ${className}`} />;
}

function StatCard({ label, value, valueClass = 'text-white' }) {
  return (
    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60 flex flex-col gap-1">
      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{label}</p>
      {value
        ? <p className={`text-lg font-black mt-0.5 ${valueClass}`}>{value}</p>
        : <Skeleton className="h-6 w-24 mt-0.5" />}
    </div>
  );
}

function SentimentBar({ score }) {
  const s = score ?? 5;
  const color = s >= 8 ? 'bg-emerald-500' : s >= 5 ? 'bg-indigo-500' : 'bg-rose-500';
  return (
    <section className="bg-slate-950 p-5 rounded-xl border border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400">🔥 Teckningsgrad-Orakel</h3>
        <span className="text-sm font-black text-indigo-400">{s}/10 i tryck</span>
      </div>
      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all duration-700`} style={{ width: `${s * 10}%` }} />
      </div>
    </section>
  );
}

export default function IPODashboard() {
  const [emissions, setEmissions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const { data, error: dbError } = await supabase
          .from('emissions')
          .select('*, companies (*), ai_analyses (*), emission_guarantors (*, guarantors(*))')
          .order('created_at', { ascending: false });
        if (dbError) throw dbError;
        setEmissions(data ?? []);
        if (data && data.length > 0) setSelected(data[0]);
      } catch (err) {
        setError(err.message ?? 'Okänt databasfel');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row">
      <aside className="w-full md:w-72 bg-slate-950 border-r border-slate-800 p-4 space-y-2">
        <Skeleton className="h-8 w-40 mb-6" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
      </aside>
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-10">
      <div className="bg-rose-950/40 border border-rose-800 rounded-2xl p-8 max-w-md text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <h2 className="text-lg font-bold text-rose-300 mb-2">Databasanslutning misslyckades</h2>
        <p className="text-sm text-slate-400 mb-4">{error}</p>
      </div>
    </div>
  );

  if (emissions.length === 0) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-10">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-10 max-w-md text-center">
        <p className="text-5xl mb-4">📭</p>
        <h2 className="text-xl font-black text-white mb-2">Databasen är tom</h2>
        <p className="text-sm text-slate-400 mb-6">Kör analysskriptet för att lägga till en emission:</p>
        <code className="block bg-slate-800 text-indigo-300 text-sm p-3 rounded-xl">node scripts/analyze.mjs</code>
      </div>
    </div>
  );

  const comp = selected?.companies;
  const ai = selected?.ai_analyses;
  const guarantors = selected?.emission_guarantors ?? [];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased flex flex-col md:flex-row">
      <aside className="w-full md:w-72 bg-slate-950 border-b md:border-b-0 md:border-r border-slate-800 p-4 shrink-0">
        <div className="mb-6">
          <h2 className="text-xl font-black text-indigo-400 tracking-wider">IPO-AKUTEN</h2>
          <p className="text-[10px] text-slate-500 uppercase font-bold">100% AI-Beslutsstöd</p>
        </div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Aktuella Analyser</h3>
        <div className="space-y-1">
          {emissions.map((e) => (
            <button key={e.id} onClick={() => setSelected(e)}
              className={`w-full text-left p-3 rounded-xl text-sm font-semibold transition flex flex-col gap-0.5 ${selected?.id === e.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-900'}`}>
              <span>{e.companies?.name ?? '—'}</span>
              <span className={`text-[10px] ${selected?.id === e.id ? 'text-indigo-200' : 'text-slate-500'}`}>{e.type}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-y-auto">
        <header className="bg-slate-950/50 backdrop-blur-md border-b border-slate-800 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">{selected?.type}</span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider border ${selected?.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : selected?.status === 'upcoming' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                {selected?.status === 'active' ? 'ÖPPEN' : selected?.status === 'upcoming' ? 'KOMMANDE' : 'STÄNGD'}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white mt-1">{comp?.name}{' '}<span className="text-slate-500 font-medium text-xl">({comp?.ticker ?? 'N/A'})</span></h1>
            <p className="text-xs text-slate-400 uppercase font-bold mt-0.5">{comp?.sector}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selected?.avanza_url && <a href={selected.avanza_url} target="_blank" rel="noreferrer" className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/10">Teckna på Avanza</a>}
            {selected?.nordnet_url && <a href={selected.nordnet_url} target="_blank" rel="noreferrer" className="px-4 py-2 text-xs font-bold bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition shadow-lg shadow-cyan-600/10">Teckna på Nordnet</a>}
            {selected?.source_url && <a href={selected.source_url} target="_blank" rel="noreferrer" className="px-4 py-2 text-xs font-medium bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition border border-slate-700">Originalprospekt</a>}
          </div>
        </header>

        <main className="p-6 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Volym" value={selected?.amount_msek ? `${selected.amount_msek} MSEK` : null} />
              <StatCard label="Teckningskurs" value={selected?.subscription_price ? `${selected.subscription_price} SEK` : null} />
              <StatCard label="Emissionskostnad" value={ai?.emission_cost_percent != null ? `${ai.emission_cost_percent}%` : null} valueClass="text-amber-400" />
              <StatCard label="Sista Dag" value={selected?.subscription_end ?? 'Info saknas'} valueClass="text-indigo-400" />
            </div>

            <SentimentBar score={ai?.sentiment_score} />

            <section className="bg-slate-950 p-5 rounded-xl border border-slate-800">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 mb-2">💡 AI-Analys i korthet</h3>
              {ai?.short_summary ? <p className="text-sm text-slate-300 leading-relaxed">{ai.short_summary}</p> : <Skeleton className="h-16 w-full" />}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ai?.valuation_analysis && (
                <section className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-400 mb-1">📊 Slaktmarginal (Värdering)</h4>
                  <p className="text-lg font-black text-white">{ai.valuation_analysis.discount_percent}% rabatt/premie</p>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{ai.valuation_analysis.explanation}</p>
                </section>
              )}
              {ai?.dilution_calculation && (
                <section className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-amber-500 mb-1">🚨 Småsparskyddet (Utspädning)</h4>
                  <p className="text-lg font-black text-white">{ai.dilution_calculation.dilution_percent}% max utspädning</p>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{ai.dilution_calculation.impact_text}</p>
                </section>
              )}
            </div>

            <section className="bg-slate-950 p-5 rounded-xl border border-slate-800">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 mb-3">💰 Vart går pengarna?</h3>
              {ai?.capital_allocation?.length > 0 ? (
                <div className="space-y-3">
                  {ai.capital_allocation.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-slate-300">{item.syfte}</span>
                        <span className="text-indigo-400 font-bold">{item.procent}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full transition-all duration-700" style={{ width: `${item.procent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : <Skeleton className="h-24 w-full" />}
            </section>

            {ai?.options_calculation?.has_options && (
              <section className="bg-indigo-950/40 border border-indigo-900/60 p-5 rounded-xl">
                <h3 className="font-bold text-sm uppercase tracking-wider text-indigo-400 mb-1">🎁 Dolda Värden (Teckningsoptioner)</h3>
                <p className="text-2xl font-black text-white">{ai.options_calculation.value_sek} SEK <span className="text-xs font-normal text-indigo-300">teoretiskt värde per TO</span></p>
                <p className="text-xs text-indigo-200/80 leading-relaxed mt-1.5">{ai.options_calculation.explanation}</p>
              </section>
            )}

            {ai?.lock_up_analysis && (
              <section className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 mb-2">🔒 Lock-up & Ägaranalys</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {ai.lock_up_percentage != null && (
                    <div className="bg-slate-900 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Låst kapital</p>
                      <p className="text-base font-black text-amber-400">{ai.lock_up_percentage}%</p>
                    </div>
                  )}
                  {ai.lock_up_expiry_date && (
                    <div className="bg-slate-900 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Låst till</p>
                      <p className="text-base font-black text-white">{ai.lock_up_expiry_date}</p>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{ai.lock_up_analysis}</p>
                {ai.owner_exit_risk && (
                  <div className={`mt-3 p-3 rounded-lg border text-xs ${ai.owner_exit_risk.sponsor_backed ? 'bg-rose-950/40 border-rose-900/60 text-rose-300' : 'bg-emerald-950/30 border-emerald-900/40 text-emerald-300'}`}>
                    {ai.owner_exit_risk.sponsor_backed ? '⚠️ PE-exit risk: ' : '✅ '}{ai.owner_exit_risk.description}
                  </div>
                )}
              </section>
            )}

            <section className="bg-slate-950 p-5 rounded-xl border border-slate-800">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 mb-3">📅 Tidslinje</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-l-2 border-slate-800 pl-4 text-xs">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Teckningsperiod</p>
                  <p className="text-slate-300 mt-0.5">{selected?.subscription_start} – {selected?.subscription_end}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Handelsstart</p>
                  <p className="text-slate-300 mt-0.5">{selected?.trading_start ?? 'Ej fastställt'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">BTA-Omvandling</p>
                  <p className="text-slate-400 mt-0.5 leading-relaxed">{selected?.bta_conversion_info}</p>
                </div>
              </div>
            </section>

          </div>

          <div className="lg:col-span-1 space-y-6">
            <section className="bg-rose-950/30 border border-rose-900/60 p-5 rounded-xl">
              <h3 className="font-bold text-sm uppercase tracking-wider text-rose-400 mb-3">⚠️ Röda Flaggor ({ai?.red_flags?.length ?? 0})</h3>
              {ai?.red_flags?.length > 0 ? (
                <div className="space-y-3">
                  {ai.red_flags.map((flag, idx) => {
                    const colonIdx = flag.indexOf(':');
                    const title = colonIdx > -1 ? flag.slice(0, colonIdx) : flag;
                    const desc = colonIdx > -1 ? flag.slice(colonIdx + 1).trim() : null;
                    return (
                      <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-rose-950">
                        <h4 className="text-xs font-bold text-rose-300">{title}</h4>
                        {desc && <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{desc}</p>}
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-xs text-slate-500 italic">Inga flaggor identifierade.</p>}
            </section>

            {ai?.sector_thermometer && (
              <section className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 mb-3">🌡️ Sektor-Termometer</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-xl font-black text-white">{ai.sector_thermometer.trend}</span>
                  <span className="text-xs text-slate-500">{ai.sector_thermometer.score}/10</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{ai.sector_thermometer.description}</p>
              </section>
            )}

            <section className="bg-slate-950 p-5 rounded-xl border border-slate-800">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 mb-3">🛡️ Garanter & Dump-risk</h3>
              {guarantors.length === 0 ? <p className="text-xs text-slate-500 italic">Inga externa garanter registrerade.</p> : (
                <div className="space-y-3">
                  {guarantors.map((g, idx) => (
                    <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                      <div className="flex justify-between items-baseline">
                        <h4 className="text-xs font-bold text-white">{g.guarantors?.name}</h4>
                        <span className={`text-[10px] font-bold ${(g.guarantors?.average_day_one_return ?? 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>Dag 1: {g.guarantors?.average_day_one_return ?? 0}%</span>
                      </div>
                      {g.guarantors?.warning_text && <p className="text-[10px] text-amber-400 font-medium mt-2 pt-2 border-t border-slate-800">⚠️ {g.guarantors.warning_text}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
