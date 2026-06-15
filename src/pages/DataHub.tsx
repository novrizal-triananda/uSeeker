import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import {
  getAllConsolidatedViews,
  getInterviewPrep,
  generateInterviewQuestions,
  getPipelineSummary,
} from '../lib/dataHub';
import type { ConsolidatedView, InterviewPrep, InterviewQuestion, PipelineSummary } from '../lib/dataHub';

const AI_API_BASE = 'http://127.0.0.1:8787';


export default function DataHub() {
  const [views, setViews] = useState<ConsolidatedView[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [interviewPrep, setInterviewPrep] = useState<InterviewPrep | null>(null);
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting'>('idle');
  const [exportError, setExportError] = useState<string | null>(null);
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
    } catch (err) {
      console.error('Failed to load DataHub data:', err);
    } finally {
      setLoading(false);
    }
  }

  const [prepLoading, setPrepLoading] = useState(false);

  async function handleShowPrep(jobId: string) {
    setSelectedJobId(jobId);
    setPrepLoading(true);
    // Check cache first for previously generated questions
    const cachedQuestions = questionsCache.get(jobId);
    try {
      const prep = await getInterviewPrep(jobId);
      setInterviewPrep(prep);
      setInterviewQuestions(cachedQuestions ?? prep?.interviewQuestions ?? []);
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
    } catch (err: any) {
      console.error('Failed to generate questions:', err);
      setQuestionsError('Gagal generate pertanyaan interview. Pastikan server AI berjalan.');
    } finally {
      setQuestionsLoading(false);
    }
  }
  async function handleExportPdf() {
    setExportStatus('exporting');
    setExportError(null);
    try {
      // Gather all data from views
      const allData = views.map((v) => ({
        company: v.jobEntry.company,
        role: v.jobEntry.roleTitle,
        status: v.application?.status ?? 'N/A',
        outcome: v.application?.outcome,
        fitScore: v.fitScore ? {
          overall: v.fitScore.overallScore,
          skill: v.fitScore.skillMatch,
          experience: v.fitScore.experienceMatch,
          matchedSkills: v.fitScore.matchedSkills,
          missingSkills: v.fitScore.missingSkills,
        } : null,
        companyIntel: v.companyIntel ? {
          snapshot: v.companyIntel.snapshot,
          industry: v.companyIntel.industry,
          products: v.companyIntel.products,
          redFlags: v.companyIntel.redFlags,
        } : null,
        tailoredResume: v.tailoredResume ? {
          acceptedCount: v.tailoredResume.suggestions.filter(s => s.accepted).length,
          pendingCount: v.tailoredResume.suggestions.filter(s => !s.accepted).length,
          suggestions: v.tailoredResume.suggestions.filter(s => s.accepted).map(s => s.suggested),
        } : null,
      }));

      // Get interview questions from cache for each view
      const interviewData: Record<string, InterviewQuestion[]> = {};
      for (const [jobId, qs] of questionsCache.entries()) {
        if (qs.length > 0) {
          interviewData[jobId] = qs;
        }
      }

      const pipelineSummary = pipeline ? {
        total: pipeline.total,
        responseRate: pipeline.responseRate,
        avgFitScore: pipeline.avgFitScore,
        byStatus: pipeline.byStatus,
      } : null;

      const systemPrompt = `Kamu adalah konsultan karir profesional Indonesia. Buat laporan ringkasan komprehensif dari data pelamar kerja berikut. Gunakan Bahasa Indonesia yang profesional dengan emoji untuk membuat laporan yang menarik dan mudah dibaca. Format output dalam HTML yang rapi dengan styling inline. Jangan menggunakan tag <html>, <head>, atau <body> — cukup konten HTML saja yang bisa di-embed langsung.`;

      const prompt = [
        'Buat laporan ringkasan komprehensif untuk pelamar kerja berikut:',
        '',
        '--- DATA APLIKASI ---',
        JSON.stringify(allData, null, 2),
        '',
      ];

      if (pipelineSummary) {
        prompt.push('--- RINGKASAN PIPELINE ---');
        prompt.push(JSON.stringify(pipelineSummary, null, 2));
        prompt.push('');
      }

      if (Object.keys(interviewData).length > 0) {
        prompt.push('--- PERTANYAAN INTERVIEW ---');
        prompt.push(JSON.stringify(interviewData, null, 2));
        prompt.push('');
      }

      prompt.push('--- INSTRUKSI LAPORAN ---');
      prompt.push('Laporan harus mencakup:');
      prompt.push('1. 📊 Ringkasan Executive — gambaran umum semua aplikasi');
      prompt.push('2. 🏢 Status Aplikasi — detail untuk setiap perusahaan (status, fit score, company intel)');
      prompt.push('3. 📈 Analisis Fit Score — breakdown skill match, experience, dan area yang perlu diperdalam');
      prompt.push('4. 💡 Rekomendasi Tailoring — saran berdasarkan data resume tailoring');
      prompt.push('5. 🎤 Persiapan Interview — ringkasan pertanyaan interview dan tips');
      prompt.push('6. ⚠️ Red Flags & Catatan — hal-hal yang perlu diperhatikan');
      prompt.push('7. 🎯 Action Items — langkah-langkah selanjutnya yang direkomendasikan');
      prompt.push('');
      prompt.push('Gunakan heading (<h2>, <h3>), bullet points, table, dan styling yang profesional.');
      prompt.push('Semua konten dalam Bahasa Indonesia.');

      const response = await fetch(`${AI_API_BASE}/api/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          prompt: prompt.join('\n'),
          task: 'export_summary',
        }),
      });

      if (!response.ok) {
        let errorMsg = `AI API error: ${response.status}`;
        if (response.status === 429) {
          errorMsg = 'Terlalu banyak permintaan ke AI server. Coba lagi dalam beberapa menit.';
        } else if (response.status >= 500) {
          errorMsg = 'AI server mengalami gangguan. Pastikan server berjalan.';
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();
      const aiContent: string = result.result || result.content || '';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>uSeeker — Laporan Ringkasan</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 11pt; line-height: 1.6; color: #1a1a1a;
              padding: 15mm; max-width: 210mm; margin: 0 auto;
            }
            h1 {
              font-size: 20pt; margin-bottom: 6mm;
              border-bottom: 3px solid #7C3AED; padding-bottom: 3mm;
              color: #7C3AED;
            }
            h2 { font-size: 14pt; color: #7C3AED; margin-top: 8mm; margin-bottom: 3mm; border-bottom: 1px solid #E5E7EB; padding-bottom: 2mm; }
            h3 { font-size: 12pt; color: #374151; margin-top: 5mm; margin-bottom: 2mm; }
            p { margin-bottom: 2mm; }
            ul, ol { margin-left: 5mm; margin-bottom: 3mm; }
            li { margin-bottom: 1mm; }
            table { width: 100%; border-collapse: collapse; margin: 3mm 0; font-size: 10pt; }
            th, td { border: 1px solid #E5E7EB; padding: 2mm 3mm; text-align: left; }
            th { background: #F3F4F6; font-weight: 600; }
            .meta { font-size: 9pt; color: #6B7280; margin-bottom: 5mm; }
            .footer { margin-top: 10mm; padding-top: 3mm; border-top: 1px solid #E5E7EB; font-size: 8pt; color: #9CA3AF; text-align: center; }
            @media print {
              body { padding: 10mm; }
              h2 { page-break-after: avoid; }
              table { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>📊 uSeeker — Laporan Ringkasan</h1>
          <p class="meta">📅 Generated: ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} | 📋 Total Aplikasi: ${views.length}</p>
          ${aiContent}
          <div class="footer">
            Generated by uSeeker AI 🤖 — ${new Date().toLocaleDateString('id-ID')}
          </div>
        </body>
        </html>`;

      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 500);
      }
    } catch (err: any) {
      console.error('PDF export failed:', err);
      const msg = err.message || 'Gagal membuat laporan PDF.';
      setExportError(msg);
    } finally {
      setExportStatus('idle');
    }
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

      {loading ? (
        <div style={{
          textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}>
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

          {/* Export Buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexDirection: 'column' }}>
            <button
              onClick={handleExportPdf}
              disabled={exportStatus === 'exporting'}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                background: exportStatus === 'exporting' ? '#7C3AED' : 'var(--color-primary)',
                color: '#FFFFFF',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontWeight: 600, cursor: exportStatus === 'exporting' ? 'wait' : 'pointer',
                opacity: exportStatus === 'exporting' ? 0.7 : 1,
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              }}
            >
              {exportStatus === 'exporting' ? '⏳ AI Sedang Membuat Laporan...' : '🖨️ Export PDF (AI-Powered)'}
            </button>
            {exportError && (
              <div style={{
                padding: 'var(--space-3) var(--space-4)',
                background: '#FEF3C7',
                border: '1px solid #FCD34D',
                borderRadius: 'var(--radius-md)',
                color: '#92400E',
                fontSize: 'var(--font-size-sm)',
              }}>
                ⚠️ {exportError}
              </div>
            )}
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
                      disabled={prepLoading}
                      style={{
                        padding: 'var(--space-2) var(--space-4)',
                        background: selectedJobId === view.jobEntry.id ? '#7C3AED' : 'var(--color-bg)',
                        color: selectedJobId === view.jobEntry.id ? '#FFFFFF' : 'var(--color-text)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        cursor: prepLoading ? 'wait' : 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 500,
                        opacity: prepLoading ? 0.6 : 1,
                      }}
                    >
                      {prepLoading && selectedJobId === view.jobEntry.id ? '⏳ Memuat...' : '🎯 Interview Prep'}
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
              position: 'relative',
            }}>
              <button
                onClick={() => setInterviewPrep(null)}
                style={{
                  position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)',
                  width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  fontSize: 'var(--font-size-lg)', color: 'var(--color-text-muted)',
                  lineHeight: 1,
                }}
                title="Tutup Interview Prep"
              >
                ✕
              </button>
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
                {interviewPrep.cvSections.length > 0 && (() => {
                  const contact = interviewPrep.cvSections.find(s => s.type === 'contact');
                  const skills = interviewPrep.cvSections.find(s => s.type === 'skills');
                  const experience = interviewPrep.cvSections.find(s => s.type === 'experience');
                  return (
                    <div>
                      <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>🎓 CV Summary</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {/* Contact Info */}
                        {contact && contact.items.length > 0 && (
                          <div style={{ fontSize: 'var(--font-size-sm)' }}>
                            <p style={{ fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--color-text)' }}>Kontak</p>
                            <div style={{ color: 'var(--color-text-muted)', paddingLeft: 'var(--space-2)' }}>
                              {contact.items.slice(0, 3).map((item, i) => (
                                <p key={i}>{item.text}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Top Skills */}
                        {skills && skills.items.length > 0 && (
                          <div style={{ fontSize: 'var(--font-size-sm)' }}>
                            <p style={{ fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--color-text)' }}>Top Skills</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                              {skills.items.slice(0, 10).map((item, i) => (
                                <span key={i} style={{
                                  padding: '2px var(--space-2)',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: 'var(--font-size-xs)',
                                  background: 'var(--color-bg)',
                                  border: '1px solid var(--color-border)',
                                  color: 'var(--color-text)',
                                }}>
                                  {item.text}
                                </span>
                              ))}
                              {skills.items.length > 10 && (
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                                  +{skills.items.length - 10} lainnya
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Experience */}
                        {experience && experience.items.length > 0 && (
                          <div style={{ fontSize: 'var(--font-size-sm)' }}>
                            <p style={{ fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--color-text)' }}>Pengalaman</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', paddingLeft: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
                              {experience.items.slice(0, 3).map((item, i) => (
                                <p key={i}>{item.text}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 🎤 Pertanyaan Interview */}
                <div>
                  <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>🎤 Pertanyaan Interview</h4>
                  {interviewQuestions.length === 0 && !questionsLoading && (
                    <button
                      onClick={handleGenerateQuestions}
                      style={{
                        padding: 'var(--space-2) var(--space-4)',
                        background: '#7C3AED', color: '#FFFFFF',
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
                      background: '#FEF3C7',
                      border: '1px solid #FCD34D',
                      borderRadius: 'var(--radius-md)',
                      color: '#92400E',
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
                                background: q.category === 'teknis' ? '#DBEAFE' : q.category === 'perilaku' ? '#D1FAE5' : '#FEF3C7',
                                color: q.category === 'teknis' ? '#1E40AF' : q.category === 'perilaku' ? '#065F46' : '#92400E',
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
      )}
    </section>
  );
}
