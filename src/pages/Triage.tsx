import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/db';
import { generateFitScore } from '../lib/fitScoring';
import { importCVFile } from '../lib/fileImporter';
import type { JobEntry, FitScore, MasterResume } from '../types';

interface JobWithScore {
  job: JobEntry;
  fitScore: FitScore | null;
}

export default function Triage() {
  const [jobs, setJobs] = useState<JobWithScore[]>([]);
  const [masterResume, setMasterResume] = useState<MasterResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // CV Import state
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Job entry form state
  const [showJobForm, setShowJobForm] = useState(false);
  const [jobForm, setJobForm] = useState({
    company: '',
    roleTitle: '',
    sourceUrl: '',
    jobDescription: '',
    notes: '',
  });
  const [savingJob, setSavingJob] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [jobEntries, fitScores, resume] = await Promise.all([
        db.jobEntries.toArray(),
        db.fitScores.toArray(),
        db.masterResume.toCollection().first(),
      ]);

      const scoresByJob = new Map<string, FitScore>();
      for (const score of fitScores) {
        scoresByJob.set(score.jobId, score);
      }

      const jobList: JobWithScore[] = jobEntries
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((job) => ({
          job,
          fitScore: scoresByJob.get(job.id) || null,
        }));

      setJobs(jobList);
      setMasterResume(resume || null);
    } catch {
      setJobs([]);
      setMasterResume(null);
    } finally {
      setLoading(false);
    }
  }

  // ── CV Import Handlers ──
  async function handleFileImport(file: File) {
    setImporting(true);
    setImportError(null);
    setImportSuccess(false);
    try {
      const parsed = await importCVFile(file);
      // Save to DB (overwrite existing)
      const existing = await db.masterResume.toCollection().first();
      if (existing) {
        await db.masterResume.update(existing.id, {
          sections: parsed.sections,
          updatedAt: new Date(),
        });
      } else {
        await db.masterResume.add(parsed);
      }
      setMasterResume(parsed);
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (err: any) {
      setImportError(err.message || 'Gagal mengimport CV');
    } finally {
      setImporting(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileImport(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileImport(file);
  }

  // ── Job Entry Handlers ──
  async function handleAddJob(e: React.FormEvent) {
    e.preventDefault();
    if (!jobForm.company.trim() || !jobForm.roleTitle.trim()) return;
    // jobDescription is now optional - only company and roleTitle are required

    setSavingJob(true);
    try {
      const newJob: JobEntry = {
        id: crypto.randomUUID(),
        company: jobForm.company.trim(),
        roleTitle: jobForm.roleTitle.trim(),
        sourceUrl: jobForm.sourceUrl.trim() || undefined,
        jobDescription: jobForm.jobDescription.trim(),
        notes: jobForm.notes.trim() || undefined,
        createdAt: new Date(),
      };
      await db.jobEntries.add(newJob);
      setJobForm({ company: '', roleTitle: '', sourceUrl: '', jobDescription: '', notes: '' });
      setShowJobForm(false);
      await loadData();
    } catch (err) {
      console.error('Failed to add job:', err);
    } finally {
      setSavingJob(false);
    }
  }

  // ── Fit Score Generation ──
  async function handleGenerateScore(jobId: string) {
    if (!masterResume) {
      alert('Impor CV terlebih dahulu.');
      return;
    }
    setGeneratingId(jobId);
    try {
      const job = await db.jobEntries.get(jobId);
      if (!job) return;

      const fitScore = generateFitScore(masterResume, job.jobDescription || '', jobId);
      // Delete old score for this job to avoid duplicates
      await db.fitScores.where('jobId').equals(jobId).delete();
      await db.fitScores.add(fitScore);
      await loadData();
    } catch (err) {
      console.error('Failed to generate score:', err);
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleDeleteJob(jobId: string) {
    if (!confirm('Hapus lowongan ini?')) return;
    await db.jobEntries.delete(jobId);
    await db.fitScores.where('jobId').equals(jobId).delete();
    await loadData();
  }

  function getScoreColor(score: number): string {
    if (score >= 70) return 'var(--color-status-green)';
    if (score >= 50) return 'var(--color-status-amber)';
    return 'var(--color-status-red)';
  }

  if (loading) {
    return (
      <section style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Memuat...
      </section>
    );
  }

  return (
    <section style={{ padding: 'var(--space-6)', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
        📋 Triage Pekerjaan
      </h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
        Import CV, tambahkan lowongan, dan lihat skor kesesuaian.
      </p>

      {/* ── CV Import Section ── */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
          📄 CV / Resume
        </h3>

        {masterResume ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <span style={{ color: 'var(--color-status-green)', fontWeight: 600 }}>✓ CV sudah diimport</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                {masterResume.sections.length} sections • {masterResume.sections.reduce((acc, s) => acc + s.items.length, 0)} items
              </span>
            </div>
            {/* Section preview */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              {masterResume.sections.map((s) => (
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
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              Ganti CV
            </button>
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-8)',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragging ? '#EFF6FF' : 'transparent',
              transition: 'all 0.2s ease',
            }}
          >
            <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              {importing ? '⏳ Memproses...' : '📤 Import CV'}
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              Drag & drop file .txt/.md/.docx/.pdf atau klik untuk memilih
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.docx,.pdf"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />

        {importError && (
          <p style={{ color: 'var(--color-status-red)', marginTop: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
            ❌ {importError}
          </p>
        )}
        {importSuccess && (
          <p style={{ color: 'var(--color-status-green)', marginTop: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
            ✓ CV berhasil diimport!
          </p>
        )}
      </div>

      {/* ── Add Job Section ── */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
            💼 Lowongan
          </h3>
          <button
            onClick={() => setShowJobForm(!showJobForm)}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--color-primary)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
            }}
          >
            {showJobForm ? '✕ Batal' : '+ Tambah Lowongan'}
          </button>
        </div>

        {showJobForm && (
          <form onSubmit={handleAddJob} style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <input
                type="text"
                placeholder="Nama Perusahaan *"
                value={jobForm.company}
                onChange={(e) => setJobForm({ ...jobForm, company: e.target.value })}
                required
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="Judul Posisi *"
                value={jobForm.roleTitle}
                onChange={(e) => setJobForm({ ...jobForm, roleTitle: e.target.value })}
                required
                style={inputStyle}
              />
            </div>
            <input
              type="url"
              placeholder="URL Lowongan (opsional)"
              value={jobForm.sourceUrl}
              onChange={(e) => setJobForm({ ...jobForm, sourceUrl: e.target.value })}
              style={{ ...inputStyle, marginBottom: 'var(--space-3)', width: '100%' }}
            />
            <textarea
              placeholder="Deskripsi Posisi (Job Description) *"
              value={jobForm.jobDescription}
              onChange={(e) => setJobForm({ ...jobForm, jobDescription: e.target.value })}
              required
              rows={8}
              style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'var(--font-family)' }}
            />
            <textarea
              placeholder="Catatan tambahan (opsional)"
              value={jobForm.notes}
              onChange={(e) => setJobForm({ ...jobForm, notes: e.target.value })}
              rows={2}
              style={{ ...inputStyle, width: '100%', resize: 'vertical', marginTop: 'var(--space-3)', fontFamily: 'var(--font-family)' }}
            />
            <button
              type="submit"
              disabled={savingJob || !jobForm.company.trim() || !jobForm.roleTitle.trim()}
              style={{
                marginTop: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-5)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--color-primary)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                opacity: savingJob ? 0.6 : 1,
              }}
            >
              {savingJob ? 'Menyimpan...' : '✓ Simpan Lowongan'}
            </button>
          </form>
        )}
      </div>

      {/* ── Job List with Fit Scores ── */}
      {jobs.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-12)',
            color: 'var(--color-text-muted)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
          }}
        >
          <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)' }}>
            💼 Belum ada lowongan
          </p>
          <p>Tambahkan lowongan di atas untuk mulai tracking.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {jobs.map(({ job, fitScore }) => (
            <div
              key={job.id}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
                cursor: 'pointer',
                borderColor: selectedJobId === job.id ? 'var(--color-primary)' : undefined,
              }}
              onClick={() => setSelectedJobId(selectedJobId === job.id ? null : job.id)}
            >
              {/* Job header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>
                    {job.roleTitle}
                  </div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    {job.company}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  {fitScore ? (
                    <div
                      style={{
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: getScoreColor(fitScore.overallScore),
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 'var(--font-size-lg)',
                      }}
                    >
                      {fitScore.overallScore}
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateScore(job.id);
                      }}
                      disabled={generatingId === job.id || !masterResume}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-primary)',
                        background: 'transparent',
                        color: 'var(--color-primary)',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        opacity: !masterResume ? 0.5 : 1,
                      }}
                      title={!masterResume ? 'Import CV terlebih dahulu' : ''}
                    >
                      {generatingId === job.id ? '...' : '🎯 Hitung'}
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteJob(job.id);
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-status-red)',
                      background: 'transparent',
                      color: 'var(--color-status-red)',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* JD preview */}
              {selectedJobId === job.id && (
                <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
                  {/* Job Description */}
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                      Job Description
                    </h4>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {job.jobDescription.substring(0, 500)}{job.jobDescription.length > 500 ? '...' : ''}
                    </p>
                  </div>

                  {/* Fit Score Breakdown */}
                  {fitScore && (
                    <div>
                      <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                        Skor Kesesuaian
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                        <ScoreBar label="Skills" score={fitScore.skillMatch} color={getScoreColor(fitScore.skillMatch)} />
                        <ScoreBar label="Pengalaman" score={fitScore.experienceMatch} color={getScoreColor(fitScore.experienceMatch)} />
                        <ScoreBar label="Preferensi" score={fitScore.preferenceMatch} color={getScoreColor(fitScore.preferenceMatch)} />
                      </div>

                      {/* Matched Skills */}
                      {fitScore.matchedSkills.length > 0 && (
                        <div style={{ marginBottom: 'var(--space-3)' }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-status-green)' }}>
                            ✓ Match ({fitScore.matchedSkills.length}):
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
                            {fitScore.matchedSkills.slice(0, 15).map((skill) => (
                              <span
                                key={skill}
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: '#DCFCE7',
                                  color: '#166534',
                                  fontSize: 'var(--font-size-sm)',
                                }}
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Missing Skills */}
                      {fitScore.missingSkills.length > 0 && (
                        <div>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-status-red)' }}>
                            ✗ Missing ({fitScore.missingSkills.length}):
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
                            {fitScore.missingSkills.slice(0, 15).map((skill) => (
                              <span
                                key={skill}
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: '#FEE2E2',
                                  color: '#991B1B',
                                  fontSize: 'var(--font-size-sm)',
                                }}
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recalculate */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateScore(job.id);
                        }}
                        disabled={generatingId === job.id}
                        style={{
                          marginTop: 'var(--space-3)',
                          padding: 'var(--space-2) var(--space-4)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-bg)',
                          color: 'var(--color-text)',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-sm)',
                        }}
                      >
                        🔄 Hitung Ulang Skor
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Sub-components ──

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{label}</span>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{score}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--color-border)' }}>
        <div style={{ height: '100%', width: `${score}%`, borderRadius: 3, background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

// ── Shared styles ──
const inputStyle: React.CSSProperties = {
  padding: 'var(--space-3)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--font-size-base)',
  fontFamily: 'var(--font-family)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  outline: 'none',
};
