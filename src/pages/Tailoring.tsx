import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { generateSkillAnalysis } from '../lib/resumeDiff';
import type { SkillAnalysis } from '../lib/resumeDiff';
import type { MasterResume, JobEntry } from '../types';

export default function Tailoring() {
  const [resume, setResume] = useState<MasterResume | null>(null);
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [skillAnalysis, setSkillAnalysis] = useState<SkillAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  // Load saved suggestions when job selection changes
  useEffect(() => {
    async function loadSavedSuggestions() {
      if (!selectedJobId) {
        setSkillAnalysis(null);
        return;
      }
      const saved = await db.tailoredResumes.where('jobId').equals(selectedJobId).first();
      if (saved) {
        // Load skill analysis from saved data if available
        if (saved.matchedSkills && saved.gapSkills) {
          setSkillAnalysis({
            fundamentalFit: { experienceLevel: 'partial', note: '' },
            matchedSkills: saved.matchedSkills,
            gapSkills: saved.gapSkills || [],
            requiredGapSkills: saved.requiredGapSkills || saved.gapSkills || [],
            niceToHaveGapSkills: saved.niceToHaveGapSkills || [],
            confidence: saved.confidence ?? 0.5,
            suggestions: saved.suggestions || [],
          });
        }
      } else {
        setSkillAnalysis(null);
      }
    }
    loadSavedSuggestions();
  }, [selectedJobId]);

  async function loadData() {
    try {
      const master = await db.masterResume.toCollection().first();
      if (master) setResume(master);
      const allJobs = await db.jobEntries.toArray();
      setJobs(allJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } catch (err) {
      console.error('Failed to load tailoring data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!resume || !selectedJobId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const job = jobs.find(j => j.id === selectedJobId);
      if (!job) return;
      // Run AI skill analysis (async, slower)
      let analysis: SkillAnalysis | null = null;
      try {
        analysis = await generateSkillAnalysis(resume, job.jobDescription || '', selectedJobId);
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.error('AI skill analysis error:', errMsg);
        setAiError('AI Error: ' + errMsg);
      }
      setSkillAnalysis(analysis);
      // Persist to DB
      const existing = await db.tailoredResumes.where('jobId').equals(selectedJobId).first();
      const resumeData = {
        jobId: selectedJobId,
        masterResumeId: resume.id,
        suggestions: analysis?.suggestions || [],
        fundamentalFit: analysis?.fundamentalFit || { experienceLevel: 'partial', note: '' },
        matchedSkills: analysis?.matchedSkills || [],
        gapSkills: analysis?.gapSkills || [],
        requiredGapSkills: analysis?.requiredGapSkills || analysis?.gapSkills || [],
        niceToHaveGapSkills: analysis?.niceToHaveGapSkills || [],
        confidence: analysis?.confidence ?? 0.5,
        createdAt: existing?.createdAt || new Date(),
      };
      if (existing) {
        await db.tailoredResumes.update(existing.id, resumeData);
      } else {
        await db.tailoredResumes.add({ id: crypto.randomUUID(), ...resumeData });
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error('Analysis failed:', errMsg);
      setAiError('Analysis Error: ' + errMsg);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <section style={{ padding: 'var(--space-6)', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
        ✂️ Tailoring
      </h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
        Bandingkan CV dengan lowongan, dapatkan saran tailoring.
      </p>

      {loading ? (
        <div className="loading-state" style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}>
          <div className="loading-spinner" />
          <p style={{ fontSize: 'var(--font-size-lg)' }}>Loading...</p>
        </div>
      ) : (<>
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
            background: 'var(--color-warning-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-warning-text)',
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
              }}
              style={{
                flex: 1, minWidth: 200, padding: 'var(--space-3)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-base)', fontFamily: 'var(--font-family)',
                background: 'var(--color-input-bg)',
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
              onClick={handleAnalyze}
              disabled={!selectedJobId || aiLoading}
              style={{
                padding: 'var(--space-2) var(--space-5)',
                background: '#7C3AED', color: '#FFFFFF',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontWeight: 600, cursor: 'pointer',
                opacity: (!selectedJobId || aiLoading) ? 0.5 : undefined,
              }}
            >
              {aiLoading ? '⏳ Menganalisis...' : '🤖 Analyze'}
            </button>
          </div>

          {/* AI Error Message */}
          {aiError && (
            <div style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-warning-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-warning-text)',
              fontSize: 'var(--font-size-sm)',
              marginBottom: 'var(--space-4)',
            }}>
              ⚠️ {aiError}
            </div>
          )}


        </div>
      )}

      {/* AI Skill Analysis */}
      {skillAnalysis && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
        }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
            🤖 Hasil Analisis & Saran Tailoring
          </h3>
          
          {/* Matched Skills */}
          {skillAnalysis.matchedSkills.length > 0 && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-3)', color: 'var(--color-status-green)' }}>
                ✅ Skill Cocok ({skillAnalysis.matchedSkills.length})
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {skillAnalysis.matchedSkills.map((skill, i) => (
                  <span key={i} style={{
                    padding: 'var(--space-1) var(--space-3)',
                    background: 'var(--color-success-bg)', borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-sm)',
                  }}>{skill}</span>
                ))}
              </div>
            </div>
          )}

          {/* Gap Skills */}
          {skillAnalysis.gapSkills.length > 0 && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-3)', color: 'var(--color-status-red)' }}>
                ❌ Skill Gap ({skillAnalysis.gapSkills.length})
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {skillAnalysis.gapSkills.map((skill, i) => (
                  <span key={i} style={{
                    padding: 'var(--space-1) var(--space-3)',
                    background: 'var(--color-error-bg)', borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-sm)',
                  }}>{skill}</span>
                ))}
              </div>
            </div>
          )}

          {/* Tailoring Suggestions */}
          {skillAnalysis.suggestions.length > 0 && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>
                💡 Saran Tailoring
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {skillAnalysis.suggestions.map((s, i) => (
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
            </div>
          )}

          {skillAnalysis.matchedSkills.length === 0 && skillAnalysis.gapSkills.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)' }}>Tidak ada analisis skill dari AI.</p>
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
      </>
      )}
    </section>
  );
}
