import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/plugin-shell';

function openUrl(url: string) {
  const full = /^https?:\/\//.test(url) ? url : `https://${url}`;
  open(full).catch((err) => console.error('Failed to open URL:', err));
}
import { db } from '../lib/db';
import { generateFitScore } from '../lib/fitScoring';
import { logEvent } from '../lib/eventLog';
import { confirmAsync } from '../lib/confirm';
import type { JobEntry, FitScore, MasterResume } from '../types';

interface JobWithScore {
  job: JobEntry;
  fitScore: FitScore | null;
}

export default function Triage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobWithScore[]>([]);
  const [masterResume, setMasterResume] = useState<MasterResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [scoreSuccess, setScoreSuccess] = useState<string | null>(null);

  // CV Import state
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dots, setDots] = useState('');

  // Job entry form state
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState({
    company: '',
    roleTitle: '',
    sourceUrl: '',
    jobDescription: '',
    location: '',
    salaryRange: '',
    employmentType: '',
    notes: '',
  });
  const [savingJob, setSavingJob] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Sync selectedJobId with URL param
  useEffect(() => {
    if (jobId) setSelectedJobId(jobId);
  }, [jobId]);

  // Animated dots during CV import (CSS content animation is non-standard in WebView2)
  useEffect(() => {
    if (!importing) { setDots(''); return; }
    const frames = ['', '.', '..', '...'];
    let i = 0;
    const id = setInterval(() => { i = (i + 1) % frames.length; setDots(frames[i]); }, 400);
    return () => clearInterval(id);
  }, [importing]);

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
      // Extract text from file first
      const { importFile } = await import('../lib/fileImporter');
      const text = await importFile(file);

      // Parse with AI (falls back to regex if server unavailable)
      const { parseResumeWithAI } = await import('../lib/aiParser');
      const parsed = await parseResumeWithAI(text);

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
      await loadData();
      await logEvent('import_cv', { sections: parsed.sections.length });
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
  function handleEditJob(job: JobEntry) {
    setEditingJobId(job.id);
    setJobForm({
      company: job.company,
      roleTitle: job.roleTitle,
      sourceUrl: job.sourceUrl || '',
      jobDescription: job.jobDescription,
      location: job.location || '',
      salaryRange: job.salaryRange || '',
      employmentType: job.employmentType || '',
      notes: job.notes || '',
    });
    setShowJobForm(true);
  }

  function handleCancelEdit() {
    setEditingJobId(null);
    setJobForm({ company: '', roleTitle: '', sourceUrl: '', jobDescription: '', location: '', salaryRange: '', employmentType: '', notes: '' });
    setShowJobForm(false);
  }

  async function handleSaveJob(e: React.FormEvent) {
    e.preventDefault();
    if (!jobForm.company.trim() || !jobForm.roleTitle.trim()) return;
    setSavingJob(true);
    try {
      if (editingJobId) {
        await db.jobEntries.update(editingJobId, {
          company: jobForm.company.trim(),
          roleTitle: jobForm.roleTitle.trim(),
          sourceUrl: jobForm.sourceUrl.trim() || undefined,
          jobDescription: jobForm.jobDescription.trim(),
          location: jobForm.location.trim() || undefined,
          employmentType: jobForm.employmentType || undefined,
          salaryRange: jobForm.salaryRange.trim() || undefined,
          notes: jobForm.notes.trim() || undefined,
        });
        await logEvent('edit_job', { jobId: editingJobId });
      } else {
        const newJob: JobEntry = {
          id: crypto.randomUUID(),
          company: jobForm.company.trim(),
          roleTitle: jobForm.roleTitle.trim(),
          sourceUrl: jobForm.sourceUrl.trim() || undefined,
          jobDescription: jobForm.jobDescription.trim(),
          location: jobForm.location.trim() || undefined,
          employmentType: jobForm.employmentType || undefined,
          salaryRange: jobForm.salaryRange.trim() || undefined,
          notes: jobForm.notes.trim() || undefined,
          createdAt: new Date(),
        };
        await db.jobEntries.add(newJob);
        await logEvent('add_job', { company: newJob.company, roleTitle: newJob.roleTitle });
      }
      setJobForm({ company: '', roleTitle: '', sourceUrl: '', jobDescription: '', location: '', salaryRange: '', employmentType: '', notes: '' });
      setEditingJobId(null);
      setShowJobForm(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save job:', err);
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
    const job = await db.jobEntries.get(jobId);
    if (!job) return;

    // Edge case: warn if job description is empty
    if (!job.jobDescription || job.jobDescription.trim().length === 0) {
      const proceed = await confirmAsync('Deskripsi pekerjaan kosong. Skor kesesuaian akan menjadi 0. Lanjutkan?');
      if (!proceed) return;
    }

    // Edge case: warn if CV has no experience section
    const hasExperience = masterResume.sections.some(
      s => s.type === 'experience' && s.items.length > 0
    );
    if (!hasExperience) {
      const proceed = await confirmAsync('CV tidak memiliki bagian pengalaman kerja. Skor pengalaman akan rendah. Lanjutkan?');
      if (!proceed) return;
    }

    setGeneratingId(jobId);
    try {
      const fitScore = generateFitScore(masterResume, job.jobDescription || '', jobId);
      // Delete old score for this job to avoid duplicates
      await db.fitScores.where('jobId').equals(jobId).delete();
      await db.fitScores.add(fitScore);
      await logEvent('generate_score', { jobId, score: fitScore.overallScore });
      await loadData();
      setScoreSuccess(jobId);
      setTimeout(() => setScoreSuccess(null), 2000);
    } catch (err) {
      console.error('Failed to generate score:', err);
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleDeleteJob(jobId: string) {
    if (!(await confirmAsync('Hapus lowongan ini?'))) return;
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
      <section className="loading-state">
        <div className="loading-spinner" />
        <p>Memuat...</p>
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
            importing ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-6)' }}>
                <svg className="cv-spinner" viewBox="0 0 36 36">
                  <circle className="cv-spinner-track" cx="18" cy="18" r="15" />
                  <circle className="cv-spinner-arc" cx="18" cy="18" r="15">
                    <animateTransform attributeName="transform" type="rotate" values="0 18 18;360 18 18" dur="0.8s" repeatCount="indefinite" />
                  </circle>
                </svg>
                <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
                  Memproses{dots}
                </p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Mengganti CV...
                </p>
              </div>
            ) : (
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
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-primary)',
                    background: 'var(--color-primary)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  Ganti CV
                </button>

              </div>
            </div>
          )
        ) : (
          <div
            onDragOver={importing ? undefined : handleDragOver}
            onDragLeave={importing ? undefined : handleDragLeave}
            onDrop={importing ? undefined : handleDrop}
            onClick={importing ? undefined : () => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${importing ? 'var(--color-text-muted)' : isDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-8)',
              textAlign: 'center',
              cursor: importing ? 'not-allowed' : 'pointer',
              background: importing ? 'var(--color-bg)' : isDragging ? 'var(--color-info-bg)' : 'transparent',
              transition: 'all 0.2s ease',
              opacity: importing ? 0.7 : 1,
            }}
          >
            {importing ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
                <svg className="cv-spinner" viewBox="0 0 36 36">
                  <circle className="cv-spinner-track" cx="18" cy="18" r="15" />
                  <circle className="cv-spinner-arc" cx="18" cy="18" r="15">
                    <animateTransform attributeName="transform" type="rotate" values="0 18 18;360 18 18" dur="0.8s" repeatCount="indefinite" />
                  </circle>
                </svg>
                <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text)' }}>
                  Memproses{dots}
                </p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Sedang membaca file CV...
                </p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                  📤 Import CV
                </p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Drag & drop file .docx / .pdf atau klik untuk memilih
                </p>
              </>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />

        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
          Format yang diterima: .docx, .pdf (termasuk scan/gambar via OCR)
        </p>

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
          {!editingJobId && (
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
          )}
        </div>

        {showJobForm && (
          <form onSubmit={handleSaveJob} style={{ marginBottom: 'var(--space-4)' }}>
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
              type="text"
              placeholder="URL Lowongan (opsional)"
              value={jobForm.sourceUrl}
              onChange={(e) => setJobForm({ ...jobForm, sourceUrl: e.target.value })}
              style={{ ...inputStyle, marginBottom: 'var(--space-3)', width: '100%' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <input
                type="text"
                placeholder="Lokasi (opsional)"
                value={jobForm.location}
                onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="Range Gaji, contoh: 8-12 juta/bulan"
                value={jobForm.salaryRange}
                onChange={(e) => setJobForm({ ...jobForm, salaryRange: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <select
                value={jobForm.employmentType}
                onChange={(e) => setJobForm({ ...jobForm, employmentType: e.target.value })}
                style={{ ...inputStyle, color: jobForm.employmentType ? 'var(--color-text)' : 'var(--color-text-muted)' }}
              >
                <option value="">Tipe Pekerjaan (opsional)</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Internship">Internship</option>
                <option value="Freelance">Freelance</option>
                <option value="Contract">Contract</option>
              </select>
              <div /> {/* spacer */}
            </div>
            <textarea
              placeholder="Deskripsi Posisi (Job Description)"
              value={jobForm.jobDescription}
              onChange={(e) => setJobForm({ ...jobForm, jobDescription: e.target.value })}
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
              {savingJob ? 'Menyimpan...' : editingJobId ? '✓ Update Lowongan' : '✓ Simpan Lowongan'}
            </button>
            {editingJobId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                style={{
                  marginTop: 'var(--space-3)',
                  marginLeft: 'var(--space-3)',
                  padding: 'var(--space-2) var(--space-5)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                ✕ Batal
              </button>
            )}
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
              onClick={() => {
                const newId = selectedJobId === job.id ? null : job.id;
                setSelectedJobId(newId);
                navigate(newId ? `/triage/${newId}` : '/triage', { replace: true });
              }}
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
                  {(job.location || job.salaryRange || job.employmentType) && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)', flexWrap: 'wrap' }}>
                      {job.location && (
                        <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                          📍 {job.location}
                        </span>
                      )}
                      {job.salaryRange && (
                        <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                          💰 {job.salaryRange}
                        </span>
                      )}
                      {job.employmentType && (
                        <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                          📄 {job.employmentType}
                        </span>
                      )}
                    </div>
                    )}
                    {job.notes && (
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', fontStyle: 'italic', marginTop: 'var(--space-1)' }}>
                      📝 {job.notes}
                    </p>
                    )}
                    {job.sourceUrl && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openUrl(job.sourceUrl!); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', textDecoration: 'none', marginTop: 'var(--space-1)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      🔗 Lihat Lowongan
                    </button>
                  )}
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
                      handleEditJob(job);
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      background: 'transparent',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-sm)',
                    }}
                    title="Edit lowongan"
                  >
                    ✏️
                  </button>
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
                  {/* Notes */}
                  {job.notes && (
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                      <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                        Catatan
                      </h4>
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', lineHeight: 1.6, fontStyle: 'italic' }}>
                        {job.notes}
                      </p>
                    </div>
                  )}
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
                                  background: 'var(--color-success-bg)',
                                  color: 'var(--color-success-text)',
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
                                  background: 'var(--color-error-bg)',
                                  color: 'var(--color-error-text)',
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
                      {scoreSuccess === job.id && (
                        <span style={{
                          marginLeft: 'var(--space-3)',
                          color: 'var(--color-status-green)',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 600,
                        }}>
                          ✓ Skor berhasil dihitung ulang
                        </span>
                      )}
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
  background: 'var(--color-input-bg)',
  color: 'var(--color-text)',
  outline: 'none',
};
