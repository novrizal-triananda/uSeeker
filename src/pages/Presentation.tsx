import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../lib/db';
import { parseResumeText } from '../lib/cvParser';
import { generateLocalDiff, generateAiSuggestions } from '../lib/resumeDiff';
import type { MasterResume, ResumeSection, JobEntry, TailorSuggestion } from '../types';

export default function Presentation() {
  const [resume, setResume] = useState<MasterResume | null>(null);
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [diffResult, setDiffResult] = useState<{ keywordMatch: string[]; skillGaps: string[] } | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<TailorSuggestion[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const master = await db.masterResume.toCollection().first();
    if (master) {
      // Never overwrite master resume - load it as read-only reference
      setResume(master);
    }
    const allJobs = await db.jobEntries.toArray();
    setJobs(allJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  }

  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = parseResumeText(text);
    // Store as a new master resume (first import only - never overwrite existing)
    const existing = await db.masterResume.toCollection().first();
    if (!existing) {
      await db.masterResume.add(parsed);
    }
    // Set display state from the parsed result
    setResume(parsed);
  }, []);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.txt') || file.name.endsWith('.pdf') || file.name.endsWith('.md'))) {
      handleFile(file);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleDiff() {
    if (!resume || !selectedJobId) return;
    const job = jobs.find(j => j.id === selectedJobId);
    if (!job) return;
    const result = generateLocalDiff(resume, job.jobDescription);
    setDiffResult(result);
    setAiSuggestions(null);
  }

  async function handleAiTailor() {
    if (!resume || !selectedJobId) return;
    setAiLoading(true);
    try {
      const job = jobs.find(j => j.id === selectedJobId);
      if (!job) return;
      const suggestions = await generateAiSuggestions(resume, job.jobDescription, selectedJobId);
      setAiSuggestions(suggestions);
    } finally {
      setAiLoading(false);
    }
  }

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  return (
    <section style={{ padding: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
        📝 Presentasi & Resume
      </h2>

      {/* CV Upload Area */}
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
          background: isDragging ? '#EFF6FF' : 'var(--color-surface)',
          marginBottom: 'var(--space-8)',
          transition: 'all 0.2s ease',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
          {resume ? '📂 CV sudah diimport' : '📤 Import CV'}
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          {resume
            ? 'Klik atau drag file baru untuk mengganti'
            : 'Drag & drop file .txt/.md atau klik untuk memilih'
          }
        </p>
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
          <p>Upload CV Anda untuk memulai analisis dan tailoring.</p>
        </div>
      )}

      {/* Parsed Resume Sections */}
      {resume && resume.sections.length > 0 && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          marginBottom: 'var(--space-8)',
        }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
            📋 Sektion Resume (Master)
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
            Master resume tidak akan ditimpa. Data ini hanya referensi.
          </p>
          {resume.sections.map((section: ResumeSection) => (
            <div key={section.type} style={{ marginBottom: 'var(--space-4)' }}>
              <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-primary)' }}>
                {section.title}
              </h4>
              <ul style={{ paddingLeft: 'var(--space-5)' }}>
                {section.items.map((item, i) => (
                  <li key={i} style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
                    {item.text}
                    {item.startDate && (
                      <span style={{ color: 'var(--color-text-muted)', marginLeft: 'var(--space-2)' }}>
                        ({item.startDate}{item.endDate ? ` – ${item.endDate}` : ''})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Diff View - Select Job */}
      {resume && jobs.length > 0 && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          marginBottom: 'var(--space-8)',
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
                setAiSuggestions(null);
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
                opacity: !selectedJobId ? 0.5 : 1,
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
                opacity: (!selectedJobId || aiLoading) ? 0.5 : 1,
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
              {/* Your Resume Keywords */}
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

              {/* Skill Gaps */}
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
          <p>Belum ada lowongan. Tambah lowongan terlebih dahulu untuk melakukan perbandingan.</p>
        </div>
      )}
    </section>
  );
}
