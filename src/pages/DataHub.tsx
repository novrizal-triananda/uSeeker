import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-shell';

function openUrl(url: string) {
  const full = /^https?:\/\//.test(url) ? url : `https://${url}`;
  open(full).catch((err) => console.error('Failed to open URL:', err));
}
import { db } from '../lib/db';
import {
  getAllConsolidatedViews,
  getInterviewPrep,
  generateInterviewQuestions,
  getPipelineSummary,
} from '../lib/dataHub';
import type { ConsolidatedView, InterviewPrep, InterviewQuestion, PipelineSummary } from '../lib/dataHub';


export default function DataHub() {
  const [views, setViews] = useState<ConsolidatedView[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [interviewPrep, setInterviewPrep] = useState<InterviewPrep | null>(null);
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [questionsCache, setQuestionsCache] = useState<Map<string, InterviewQuestion[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const allViews = await getAllConsolidatedViews();
      setViews(allViews);

      const apps = await db.applications.toArray();
      if (apps.length > 0) {
        const summary = await getPipelineSummary(apps);
        setPipeline(summary);
      }

      // Load persisted interview questions from IndexedDB
      const persistedQuestions = await db.interviewQuestions.toArray();
      const questionsMap = new Map<string, InterviewQuestion[]>();
      for (const q of persistedQuestions) {
        const existing = questionsMap.get(q.jobId) || [];
        existing.push(q);
        questionsMap.set(q.jobId, existing);
      }
      setQuestionsCache(questionsMap);
    } catch (err) {
      console.error('Failed to load DataHub data:', err);
    } finally {
      setLoading(false);
    }
  }

  const [prepLoading, setPrepLoading] = useState(false);

  async function handleShowPrep(jobId: string) {
    // Toggle immediately for accordion UX
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      setInterviewPrep(null);
      return;
    }
    setExpandedJobId(jobId);
    setSelectedJobId(jobId);
    setPrepLoading(true);
    // Check cache first for previously generated questions
    const cachedQuestions = questionsCache.get(jobId);
    try {
      const prep = await getInterviewPrep(jobId);
      setInterviewPrep(prep);
      // Load from cache or IndexedDB
      let questions = cachedQuestions ?? [];
      if (questions.length === 0) {
        // Try loading from IndexedDB
        const dbQuestions = await db.interviewQuestions.where('jobId').equals(jobId).toArray();
        if (dbQuestions.length > 0) {
          questions = dbQuestions.map(q => ({
            question: q.question,
            tips: q.tips,
            category: q.category,
          }));
          // Update cache
          setQuestionsCache(prev => new Map(prev).set(jobId, questions));
        }
      }
      setInterviewQuestions(questions);
    } catch (err) {
      console.error('Failed to load interview prep:', err);
    } finally {
      setPrepLoading(false);
    }
  }

  async function handleGenerateQuestions() {
    if (!selectedJobId) return;
    setQuestionsLoading(true);
    setQuestionsError(null);
    try {
      const questions = await generateInterviewQuestions(selectedJobId);
      setInterviewQuestions(questions);
      // Persist in cache so they survive tab switches
      setQuestionsCache(prev => new Map(prev).set(selectedJobId, questions));
      // Persist to IndexedDB
      for (const q of questions) {
        await db.interviewQuestions.add({
          id: crypto.randomUUID(),
          jobId: selectedJobId,
          question: q.question,
          tips: q.tips,
          category: q.category,
          createdAt: new Date(),
        });
      }
    } catch (err: any) {
      console.error('Failed to generate questions:', err);
      setQuestionsError('Gagal generate pertanyaan interview. Pastikan server AI berjalan.');
    } finally {
      setQuestionsLoading(false);
    }
  }

  const statusColors: Record<string, string> = {
    applied: 'var(--color-status-blue)',
    screen: 'var(--color-status-amber)',
    interview: '#7C3AED',
    offer: 'var(--color-status-green)',
  };

  const statusLabels: Record<string, string> = {
    applied: 'Applied',
    screen: 'Screen',
    interview: 'Interview',
    offer: 'Offer',
  };

  return (
    <section style={{ padding: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
        📊 Data Hub
      </h2>

      {loading ? (
        <div className="loading-state" style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}>
          <div className="loading-spinner" />
          <p style={{ fontSize: 'var(--font-size-lg)' }}>Memuat data...</p>
        </div>
      ) : views.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}>
          <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)' }}>
            Data belum tersedia
          </p>
          <p>Belum ada data lowongan. Tambahkan lowongan untuk melihat konsolidasi data.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Pipeline Summary */}
          {pipeline && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                📈 Ringkasan Pipeline
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-4)',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {pipeline.total}
                  </p>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Total</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-status-green)' }}>
                    {pipeline.responseRate}%
                  </p>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Response Rate</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: '#7C3AED' }}>
                    {pipeline.avgFitScore}
                  </p>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Avg Fit Score</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                {(Object.keys(pipeline.byStatus) as (keyof typeof pipeline.byStatus)[]).map(status => (
                  <div key={status} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${statusColors[status]}`,
                    fontSize: 'var(--font-size-sm)',
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: statusColors[status],
                    }} />
                    <span>{statusLabels[status]}: {pipeline.byStatus[status]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consolidated Per-Role View */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
          }}>
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
              📋 Konsolidasi Per Lowongan
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {views.map(view => (
                <div key={view.jobEntry.id} style={{
                  padding: 'var(--space-4)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  background: selectedJobId === view.jobEntry.id ? 'var(--color-info-bg)' : 'var(--color-surface)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <div>
                      <h4 style={{ fontWeight: 600 }}>
                        {view.jobEntry.company} — {view.jobEntry.roleTitle}
                      </h4>
                      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {view.application && (
                          <span style={{
                            padding: 'var(--space-1) var(--space-3)',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${statusColors[view.application.status]}`,
                            color: statusColors[view.application.status],
                            fontSize: 'var(--font-size-sm)',
                          }}>
                            {statusLabels[view.application.status]}
                          </span>
                        )}
                        {view.fitScore && (
                          <span style={{
                            padding: 'var(--space-1) var(--space-3)',
                            background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-sm)', fontWeight: 600,
                          }}>
                            Fit: {view.fitScore.overallScore}/100
                          </span>
                        )}
                        {view.companyIntel?.industry && (
                          <span style={{
                            padding: 'var(--space-1) var(--space-3)',
                            background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-sm)',
                          }}>
                            {view.companyIntel.industry}
                          </span>
                        )}
                        {view.jobEntry.location && (
                          <span style={{
                            padding: 'var(--space-1) var(--space-3)',
                            background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-sm)',
                          }}>
                            📍 {view.jobEntry.location}
                          </span>
                        )}
                        {view.jobEntry.salaryRange && (
                          <span style={{
                            padding: 'var(--space-1) var(--space-3)',
                            background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-sm)',
                          }}>
                            💰 {view.jobEntry.salaryRange}
                          </span>
                        )}
                        {view.jobEntry.employmentType && (
                          <span style={{
                            padding: 'var(--space-1) var(--space-3)',
                            background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-sm)',
                          }}>
                            📄 {view.jobEntry.employmentType}
                          </span>
                        )}
                        {view.jobEntry.sourceUrl && (
                          <button
                            onClick={() => openUrl(view.jobEntry.sourceUrl!)}
                            style={{
                              padding: 'var(--space-1) var(--space-3)',
                              background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                              fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)',
                              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            🔗 Lihat Lowongan
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleShowPrep(view.jobEntry.id)}
                      disabled={false}
                      style={{
                        padding: 'var(--space-2) var(--space-4)',
                        background: expandedJobId === view.jobEntry.id ? '#7C3AED' : 'var(--color-bg)',
                        color: expandedJobId === view.jobEntry.id ? 'var(--color-surface)' : 'var(--color-text)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        cursor: prepLoading ? 'wait' : 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 500,
                        opacity: prepLoading ? 0.6 : 1,
                      }}
                    >
                      {expandedJobId === view.jobEntry.id ? '✕ Tutup' : '📋 Detail Lowongan'}
                    </button>
                  </div>
            {/* Detail Lowongan View */}
            {expandedJobId === view.jobEntry.id && interviewPrep && (
              <div style={{
                background: 'var(--color-surface)',
                border: '2px solid #7C3AED',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
                position: 'relative',
              }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', color: '#7C3AED' }}>
                  📋 Detail Lowongan
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

                  {/* Loading indicator for additional data */}
                  {prepLoading && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--color-text-muted)' }}>
                      ⏳ Memuat data tambahan...
                    </div>
                  )}

                  {/* Company Intel - only show if loaded */}
                  {interviewPrep?.companyIntel && (
                    <div>
                      <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>🏢 Company Overview</h4>
                      {interviewPrep.companyIntel.snapshot && (
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                          {interviewPrep.companyIntel.snapshot}
                        </p>
                      )}
                      {interviewPrep.companyIntel.products && interviewPrep.companyIntel.products.length > 0 && (
                        <div style={{ marginTop: 'var(--space-2)' }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Produk: </span>
                          {interviewPrep.companyIntel.products.join(', ')}
                        </div>
                      )}
                      {interviewPrep.companyIntel.redFlags && interviewPrep.companyIntel.redFlags.length > 0 && (
                        <div style={{ marginTop: 'var(--space-2)' }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-status-red)' }}>
                            Red Flags: 
                          </span>
                          <span style={{ fontSize: 'var(--font-size-sm)' }}>
                            {interviewPrep.companyIntel.redFlags.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Pipeline Summary */}
                  {interviewPrep.pipeline && (
                    <div>
                      <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>📈 Ringkasan Pipeline</h4>
                      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', fontSize: 'var(--font-size-sm)' }}>
                        <span>Total: <strong>{interviewPrep.pipeline.total}</strong></span>
                        <span>Response Rate: <strong>{interviewPrep.pipeline.responseRate}%</strong></span>
                        <span>Avg Fit Score: <strong>{interviewPrep.pipeline.avgFitScore}</strong></span>
                      </div>
                    </div>
                  )}
                  {interviewPrep.fitScore && (
                    <div>
                      <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>📊 Fit Score Breakdown</h4>
                      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <div>
                          <p style={{ fontWeight: 500 }}>Overall: {interviewPrep.fitScore.overallScore}/100</p>
                          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                            Skill: {interviewPrep.fitScore.skillMatch}% | Experience: {interviewPrep.fitScore.experienceMatch}%
                          </p>
                        </div>
                      </div>
                      {interviewPrep.gapSkills.length > 0 && (
                        <div style={{ marginTop: 'var(--space-2)' }}>
                          <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-status-red)' }}>
                            ⚠️ Skill yang perlu diperdalam:
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
                            {interviewPrep.gapSkills.map((skill, i) => (
                              <span key={i} style={{
                                padding: '2px var(--space-2)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 'var(--font-size-xs)',
                                background: 'var(--color-error-bg)',
                                border: '1px solid var(--color-error-bg)',
                                color: 'var(--color-error-text)',
                              }}>{skill}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}



                  {/* Job Description */}
                  {interviewPrep.jobDescription && (
                    <div>
                      <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>📄 Job Description</h4>
                      <p style={{
                        fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)',
                        whiteSpace: 'pre-wrap', maxHeight: '120px', overflow: 'auto',
                        padding: 'var(--space-3)', background: 'var(--color-bg)',
                        borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                      }}>
                        {interviewPrep.jobDescription}
                      </p>
                    </div>
                  )}

                  {/* Saran Tailoring */}
                  {interviewPrep.tailoringSuggestions.length > 0 && (
                    <div>
                      <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>💡 Saran Tailoring</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {interviewPrep.tailoringSuggestions.map((s, i) => (
                          <div key={i} style={{
                            padding: 'var(--space-3)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--color-bg)',
                          }}>
                            <span style={{
                              display: 'inline-block', padding: '2px var(--space-2)',
                              background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)',
                              fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)',
                            }}>{s.section}</span>
                            <div style={{ marginTop: 'var(--space-1)' }}>
                              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-status-red)', textDecoration: 'line-through' }}>
                                ❌ {s.original}
                              </p>
                              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-status-green)', marginTop: 'var(--space-1)' }}>
                                ✅ {s.suggested}
                              </p>
                            </div>
                            {s.reason && (
                              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)', fontStyle: 'italic' }}>
                                💡 {s.reason}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 🎤 Pertanyaan Interview */}
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>🎤 Pertanyaan Interview</h4>
                    {interviewQuestions.length === 0 && !questionsLoading && (
                      <button
                        onClick={handleGenerateQuestions}
                        style={{
                          padding: 'var(--space-2) var(--space-4)',
                          background: '#7C3AED', color: 'var(--color-surface)',
                          border: 'none', borderRadius: 'var(--radius-md)',
                          cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 600,
                        }}
                      >
                        ✨ Generate Pertanyaan
                      </button>
                    )}
                    {questionsLoading && (
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                        ⏳ Sedang membuat pertanyaan...
                      </p>
                    )}
                    {questionsError && !questionsLoading && (
                      <div style={{
                        padding: 'var(--space-3) var(--space-4)',
                        background: 'var(--color-warning-bg)',
                        border: '1px solid var(--color-warning-border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--color-warning-text)',
                        fontSize: 'var(--font-size-sm)',
                        marginBottom: 'var(--space-3)',
                      }}>
                        ⚠️ {questionsError}
                      </div>
                    )}
                    {interviewQuestions.length > 0 && !questionsLoading && (
                      <>
                        <button
                          onClick={handleGenerateQuestions}
                          style={{
                            padding: 'var(--space-1) var(--space-3)',
                            background: 'var(--color-bg)', color: 'var(--color-text)',
                            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                            cursor: 'pointer', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)',
                          }}
                        >
                          🔄 Regenerate
                        </button>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                          {interviewQuestions.map((q, idx) => (
                            <div key={idx} style={{
                              padding: 'var(--space-3) var(--space-4)',
                              background: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-md)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                                <span style={{
                                  padding: '2px var(--space-2)',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: 'var(--font-size-xs)', fontWeight: 600,
                                  background: q.category === 'teknis' ? 'var(--color-info-bg)' : q.category === 'perilaku' ? '#D1FAE5' : 'var(--color-warning-bg)',
                                  color: q.category === 'teknis' ? 'var(--color-info-text)' : q.category === 'perilaku' ? '#065F46' : 'var(--color-warning-text)',
                                }}>
                                  {q.category}
                                </span>
                              </div>
                              <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                                {q.question}
                              </p>
                              {q.tips && (
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                  💡 {q.tips}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </section>
  );
}