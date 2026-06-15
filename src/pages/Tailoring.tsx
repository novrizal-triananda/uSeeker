import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { generateLocalDiff, generateAiSuggestions } from '../lib/resumeDiff';
import type { MasterResume, JobEntry, TailorSuggestion } from '../types';

export default function Tailoring() {
  const [resume, setResume] = useState<MasterResume | null>(null);
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [diffResult, setDiffResult] = useState<{ keywordMatch: string[]; skillGaps: string[] } | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<TailorSuggestion[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Load saved suggestions when job selection changes
  useEffect(() => {
    async function loadSavedSuggestions() {
      if (!selectedJobId) {
        setAiSuggestions(null);
        return;
      }
      const saved = await db.tailoredResumes.where('jobId').equals(selectedJobId).first();
      if (saved) {
        setAiSuggestions(saved.suggestions);
      } else {
        setAiSuggestions(null);
      }
    }
    loadSavedSuggestions();
  }, [selectedJobId]);

  async function loadData() {
    const master = await db.masterResume.toCollection().first();
    if (master) setResume(master);
    const allJobs = await db.jobEntries.toArray();
    setJobs(allJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  }

  async function handleDiff() {
    if (!resume || !selectedJobId) return;
    const job = jobs.find(j => j.id === selectedJobId);
    if (!job) return;
    const result = generateLocalDiff(resume, job.jobDescription || '');
    setDiffResult(result);
    setAiSuggestions(null);
  }

  async function handleAiTailor() {
    if (!resume || !selectedJobId) return;
    setAiLoading(true);
    try {
      const job = jobs.find(j => j.id === selectedJobId);
      if (!job) return;
      const suggestions = await generateAiSuggestions(resume, job.jobDescription || '', selectedJobId);
      setAiSuggestions(suggestions);
      // Persist AI suggestions to DB
      if (suggestions && suggestions.length > 0) {
        const existing = await db.tailoredResumes.where('jobId').equals(selectedJobId).first();
        const resumeData = {
          jobId: selectedJobId,
          masterResumeId: resume.id,
          suggestions: suggestions,
          createdAt: existing?.createdAt || new Date(),
        };
        if (existing) {
          await db.tailoredResumes.update(existing.id, resumeData);
        } else {
          await db.tailoredResumes.add({ id: crypto.randomUUID(), ...resumeData });
        }
      }
    } finally {
      setAiLoading(false);
    }
  }

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  return (
    <section style={{ padding: 'var(--space-6)', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
        ✂️ Tailoring
      </h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
        Bandingkan CV dengan lowongan, dapatkan saran tailoring.
      </p>

      {/* CV Status — read-only, imported from Triage */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        marginBottom: 'var(--space-6)',
      }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
          📄 Master CV
        </h3>
        {resume ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <span style={{ color: 'var(--color-status-green)', fontWeight: 600 }}>✓ CV tersedia</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                {resume.sections.length} sections • {resume.sections.reduce((acc, s) => acc + s.items.length, 0)} items
              </span>
            </div>
            {/* Section preview */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {resume.sections.map((s) => (
                <span
                  key={s.type}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {s.title} ({s.items.length})
                </span>
              ))}
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-3)' }}>
              Import CV melalui tab <strong>Triage</strong> untuk mengubah data master.
            </p>
          </div>
        ) : (
          <div style={{
            padding: 'var(--space-4)',
            background: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: 'var(--radius-md)',
            color: '#92400E',
            fontSize: 'var(--font-size-sm)',
          }}>
            ⚠️ Belum ada CV. Import CV melalui tab <strong>Triage</strong> terlebih dahulu.
          </div>
        )}
      </div>

      {/* Empty state */}
      {!resume && (
        <div style={{
          textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}>
          <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)' }}>
            Import CV terlebih dahulu
          </p>
          <p>Upload CV di tab Triage untuk memulai analisis dan tailoring.</p>
        </div>
      )}

      {/* Diff View - Select Job */}
      {resume && jobs.length > 0 && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          marginBottom: 'var(--space-6)',
        }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
            🔄 Resume vs Job Description
          </h3>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
            <select
              value={selectedJobId}
              onChange={(e) => {
                setSelectedJobId(e.target.value);
                setDiffResult(null);
              }}
              style={{
                flex: 1, minWidth: 200, padding: 'var(--space-3)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-base)', fontFamily: 'var(--font-family)',
                background: 'var(--color-surface)',
              }}
            >
              <option value="">-- Pilih Lowongan --</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>
                  {job.company} — {job.roleTitle}
                </option>
              ))}
            </select>
            <button
              onClick={handleDiff}
              disabled={!selectedJobId}
              style={{
                padding: 'var(--space-2) var(--space-5)',
                background: 'var(--color-primary)', color: '#FFFFFF',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontWeight: 600, cursor: 'pointer',
                opacity: !selectedJobId ? 0.5 : undefined,
              }}
            >
              Bandingkan
            </button>
            <button
              onClick={handleAiTailor}
              disabled={!selectedJobId || aiLoading}
              style={{
                padding: 'var(--space-2) var(--space-5)',
                background: '#7C3AED', color: '#FFFFFF',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontWeight: 600, cursor: 'pointer',
                opacity: (!selectedJobId || aiLoading) ? 0.5 : undefined,
              }}
            >
              {aiLoading ? '⏳ AI...' : '🤖 AI Tailor'}
            </button>
          </div>

          {/* Side-by-side diff result */}
          {diffResult && selectedJob && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--space-4)',
              marginTop: 'var(--space-4)',
            }}>
              <div style={{
                padding: 'var(--space-4)',
                background: '#F0FDF4',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #BBF7D0',
              }}>
                <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-3)', color: 'var(--color-status-green)' }}>
                  ✅ Keyword Cocok ({diffResult.keywordMatch.length})
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {diffResult.keywordMatch.slice(0, 20).map(kw => (
                    <span key={kw} style={{
                      padding: 'var(--space-1) var(--space-3)',
                      background: '#DCFCE7', borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-sm)',
                    }}>{kw}</span>
                  ))}
                </div>
              </div>

              <div style={{
                padding: 'var(--space-4)',
                background: '#FEF2F2',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #FECACA',
              }}>
                <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-3)', color: 'var(--color-status-red)' }}>
                  ❌ Skill Gap ({diffResult.skillGaps.length})
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {diffResult.skillGaps.slice(0, 20).map(kw => (
                    <span key={kw} style={{
                      padding: 'var(--space-1) var(--space-3)',
                      background: '#FEE2E2', borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-sm)',
                    }}>{kw}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Suggestions */}
      {aiSuggestions && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
        }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
            🤖 Saran AI untuk Tailoring
          </h3>
          {aiSuggestions.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)' }}>Tidak ada saran tailoring dari AI.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {aiSuggestions.map((s, i) => (
                <div key={i} style={{
                  padding: 'var(--space-4)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <span style={{
                    display: 'inline-block', padding: 'var(--space-1) var(--space-3)',
                    background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-2)',
                  }}>{s.section}</span>
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-status-red)', textDecoration: 'line-through' }}>
                      ❌ {s.original}
                    </p>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-status-green)', marginTop: 'var(--space-1)' }}>
                      ✅ {s.suggested}
                    </p>
                  </div>
                  {s.reason && (
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                      💡 {s.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {resume && jobs.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}>
          <p>Belum ada lowongan. Tambah lowongan di tab <strong>Triage</strong> untuk melakukan perbandingan.</p>
        </div>
      )}
    </section>
  );
}
