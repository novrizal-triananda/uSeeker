import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import {
  getAllConsolidatedViews,
  getExportData,
  getInterviewPrep,
  getPipelineSummary,
} from '../lib/dataHub';
import type { ConsolidatedView, InterviewPrep, PipelineSummary } from '../lib/dataHub';


export default function DataHub() {
  const [views, setViews] = useState<ConsolidatedView[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [interviewPrep, setInterviewPrep] = useState<InterviewPrep | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting'>('idle');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const allViews = await getAllConsolidatedViews();
    setViews(allViews);

    const apps = await db.applications.toArray();
    if (apps.length > 0) {
      const summary = await getPipelineSummary(apps);
      setPipeline(summary);
    }
  }

  async function handleExport(format: 'json' | 'text') {
    setExportStatus('exporting');
    try {
      const data = await getExportData(format);
      const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `useeker-export-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportStatus('idle');
    }
  }

  async function handleShowPrep(jobId: string) {
    setSelectedJobId(jobId);
    const prep = await getInterviewPrep(jobId);
    setInterviewPrep(prep);
  }

  const statusColors: Record<string, string> = {
    applied: 'var(--color-status-blue)',
    screen: 'var(--color-status-amber)',
    interview: '#7C3AED',
    offer: 'var(--color-status-green)',
    rejected: 'var(--color-status-red)',
  };

  const statusLabels: Record<string, string> = {
    applied: 'Applied',
    screen: 'Screen',
    interview: 'Interview',
    offer: 'Offer',
    rejected: 'Ditolak',
  };

  return (
    <section style={{ padding: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
        📊 Data Hub
      </h2>

      {views.length === 0 ? (
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

          {/* Export Buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button
              onClick={() => handleExport('json')}
              disabled={exportStatus === 'exporting'}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                background: 'var(--color-primary)', color: '#FFFFFF',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontWeight: 600, cursor: 'pointer',
                opacity: exportStatus === 'exporting' ? 0.5 : 1,
              }}
            >
              📥 Export JSON
            </button>
            <button
              onClick={() => handleExport('text')}
              disabled={exportStatus === 'exporting'}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                background: 'var(--color-surface)', color: 'var(--color-text)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                fontWeight: 600, cursor: 'pointer',
                opacity: exportStatus === 'exporting' ? 0.5 : 1,
              }}
            >
              📥 Export Teks
            </button>
          </div>

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
                  background: selectedJobId === view.jobEntry.id ? '#F0F9FF' : 'var(--color-surface)',
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
                      </div>
                    </div>
                    <button
                      onClick={() => handleShowPrep(view.jobEntry.id)}
                      style={{
                        padding: 'var(--space-2) var(--space-4)',
                        background: selectedJobId === view.jobEntry.id ? '#7C3AED' : 'var(--color-bg)',
                        color: selectedJobId === view.jobEntry.id ? '#FFFFFF' : 'var(--color-text)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 500,
                      }}
                    >
                      🎯 Interview Prep
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interview Prep View */}
          {interviewPrep && (
            <div style={{
              background: 'var(--color-surface)',
              border: '2px solid #7C3AED',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', color: '#7C3AED' }}>
                🎯 Persiapan Interview
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {interviewPrep.companyIntel && (
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>🏢 Company Intel</h4>
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
                    {interviewPrep.fitScore.missingSkills.length > 0 && (
                      <div style={{ marginTop: 'var(--space-2)' }}>
                        <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-status-red)' }}>
                          ⚠️ Skill yang perlu diperdalam:
                        </p>
                        <p style={{ fontSize: 'var(--font-size-sm)' }}>
                          {interviewPrep.fitScore.missingSkills.join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {interviewPrep.tailoredResume && (
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>📝 Resume Tailoring</h4>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                      {interviewPrep.tailoredResume.suggestions.filter(s => s.accepted).length} diterima,
                      {' '}{interviewPrep.tailoredResume.suggestions.filter(s => !s.accepted).length} pending
                    </p>
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

                {/* CV Summary */}
                {interviewPrep.cvSections.length > 0 && (
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>🎓 CV Summary</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      {interviewPrep.cvSections.map((section) => (
                        <span key={section.type} style={{
                          padding: 'var(--space-1) var(--space-3)',
                          background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-size-sm)', border: '1px solid var(--color-border)',
                        }}>
                          {section.title} ({section.items.length})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Event History */}
                {interviewPrep.eventHistory.length > 0 && (
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>📋 Riwayat Aktivitas</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {interviewPrep.eventHistory.slice(0, 10).map((event) => (
                        <div key={event.id} style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                          padding: 'var(--space-2) var(--space-3)',
                          background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-size-sm)', border: '1px solid var(--color-border)',
                        }}>
                          <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                            {event.timestamp.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                          <span>{event.type.replace(/_/g, ' ')}</span>
                          {event.metadata?.score !== undefined && (
                            <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#7C3AED' }}>
                              {event.metadata.score}/100
                            </span>
                          )}
                          {event.metadata?.status && (
                            <span style={{ marginLeft: 'auto', color: 'var(--color-status-amber)' }}>
                              {event.metadata.status}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
