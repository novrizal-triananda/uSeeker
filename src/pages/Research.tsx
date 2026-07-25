import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-shell';

function openUrl(url: string) {
  const full = /^https?:\/\//.test(url) ? url : `https://${url}`;
  open(full).catch((err) => console.error('Failed to open URL:', err));
}
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { createIntelCard, requestResearch } from '../lib/companyIntel';
import { logEvent } from '../lib/eventLog';
import type { CompanyIntel, JobEntry } from '../types';

export default function Research() {
  const { intelId } = useParams<{ intelId: string }>();
  const navigate = useNavigate();
  const [cards, setCards] = useState<CompanyIntel[]>([]);
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [company, setCompany] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [enrichmentUrlsText, setEnrichmentUrlsText] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');

  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Sync expandedId with URL param
  useEffect(() => {
    if (intelId) setExpandedId(intelId);
  }, [intelId]);

  async function loadData() {
    const [all, allJobs] = await Promise.all([
      db.companyIntel.toArray(),
      db.jobEntries.toArray(),
    ]);
    setCards(all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    setJobs(allJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;

    await createIntelCard({
      company: company.trim(),
      officialUrl: url.trim() || '',
      notes: notes.trim() || undefined,
      jobId: selectedJobId || undefined,
      ...(enrichmentUrlsText.trim() ? {
        enrichmentUrls: enrichmentUrlsText
          .split(/[\n,]+/)
          .map(u => u.trim())
          .filter(u => u.length > 0),
      } : {}),
    });
    await logEvent('create_intel', { company: company.trim(), jobId: selectedJobId || undefined });
    setCompany('');
    setUrl('');
    setNotes('');
    setEnrichmentUrlsText('');
    setSelectedJobId('');
    await loadData();
  }

  async function handleResearch(id: string) {
    setResearchingId(id);
    setResearchError(null);
    try {
      const card = cards.find(c => c.id === id);
      const enrichmentUrls = card?.enrichmentUrls;
      const result = await requestResearch(id, enrichmentUrls);
      if (result === null) {
        setResearchError('Server AI tidak tersedia. Pastikan API key AI sudah dikonfigurasi di Settings.');
      }
      await loadData();
    } catch {
      setResearchError('Gagal melakukan riset. Periksa koneksi dan API key.');
    } finally {
      setResearchingId(null);
    }
  }

  async function handleDelete(id: string) {
    await db.companyIntel.delete(id);
    await loadData();
  }

  // Check if card has new-format intel data
  function hasIntel(card: CompanyIntel): boolean {
    return Boolean(card.overview || card.values?.length || card.culture?.length || card.redFlags?.length);
  }

  return (
    <section style={{ padding: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
        🔍 Riset Perusahaan
      </h2>

      {/* Add Intel Card Form */}
      <form onSubmit={handleAdd} style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        marginBottom: 'var(--space-8)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
          Add Company Profile
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label htmlFor="company-name" style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
              Nama Perusahaan
            </label>
            <input
              id="company-name"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Contoh: Google Indonesia"
              required
              style={{
                width: '100%', padding: 'var(--space-3)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-base)', fontFamily: 'var(--font-family)',
              }}
            />
          </div>
          <div>
            <label htmlFor="company-url" style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
              URL Resmi
            </label>
            <input
              id="company-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://about.google (opsional)"
              style={{
                width: '100%', padding: 'var(--space-3)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-base)', fontFamily: 'var(--font-family)',
              }}
            />
            </div>
            <div>
            <label htmlFor="enrichment-urls" style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
              Additional Research URLs (optional)
            </label>
            <textarea
              id="enrichment-urls"
              value={enrichmentUrlsText}
              onChange={(e) => setEnrichmentUrlsText(e.target.value)}
              placeholder={'https://... (URL artikel, berita, atau sumber lain tentang perusahaan)\nSatu URL per baris, atau dipisah koma'}
              rows={3}
              style={{
                width: '100%', padding: 'var(--space-3)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-base)', fontFamily: 'var(--font-family)',
                resize: 'vertical',
              }}
            />
            </div>
          <div>
            <label htmlFor="company-notes" style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
              Catatan (opsional)
            </label>
            <textarea
              id="company-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tentang perusahaan ini..."
              rows={3}
              style={{
                width: '100%', padding: 'var(--space-3)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-base)', fontFamily: 'var(--font-family)',
                resize: 'vertical',
              }}
            />
          </div>
          {jobs.length > 0 && (
            <div>
              <label htmlFor="link-job" style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                Hubungkan ke Lowongan (opsional)
              </label>
              <select
                id="link-job"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                style={{
                  width: '100%', padding: 'var(--space-3)',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-base)', fontFamily: 'var(--font-family)',
                  background: 'var(--color-input-bg)',
                }}
              >
                <option value="">— Tidak dihubungkan —</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>{job.company} — {job.roleTitle}</option>
                ))}
              </select>
            </div>
          )}
          <button
            type="submit"
            disabled={!company.trim()}
            style={{
              alignSelf: 'flex-start',
              padding: 'var(--space-3) var(--space-6)',
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontWeight: 600, cursor: 'pointer', fontSize: 'var(--font-size-base)',
              opacity: !company.trim() ? 0.5 : undefined,
            }}
          >
            + Add Card
          </button>
        </div>
      </form>

      {researchError && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--color-error-bg)', border: '1px solid var(--color-error-bg)',
          borderRadius: 'var(--radius-md)', color: 'var(--color-status-red)',
          fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-6)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>❌ {researchError}</span>
          <button onClick={() => setResearchError(null)} style={{
            background: 'none', border: 'none', color: 'var(--color-status-red)',
            cursor: 'pointer', fontSize: 'var(--font-size-lg)',
          }}>✕</button>
        </div>
      )}
      {cards.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}>
          <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)' }}>Belum ada riset perusahaan</p>
          <p>Tambahkan profil perusahaan untuk memulai riset.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {cards.map((card) => {
            const isExpanded = expandedId === card.id;
            const intelAvailable = hasIntel(card);
            return (
              <div key={card.id} style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-5)',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                      {card.company}
                    </h3>
                    {card.officialUrl && (
                      <button
                        onClick={() => openUrl(card.officialUrl)}
                        style={{
                          color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)', wordBreak: 'break-all',
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        }}
                      >
                        {card.officialUrl}
                      </button>
                    )}
                    {card.notes && (
                      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
                        {card.notes}
                      </p>
                    )}
                    {card.overview && (
                      <span style={{
                        display: 'inline-block', marginTop: 'var(--space-2)',
                        padding: 'var(--space-1) var(--space-3)',
                        background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)',
                      }}>
                        🏭 {card.overview.slice(0, 80)}{card.overview.length > 80 ? '...' : ''}
                      </span>
                    )}
                    {card.jobId && (() => {
                      const linkedJob = jobs.find(j => j.id === card.jobId);
                      return linkedJob ? (
                        <span style={{
                          display: 'inline-block', marginTop: 'var(--space-2)', marginLeft: 'var(--space-2)',
                          padding: 'var(--space-1) var(--space-3)',
                          background: 'var(--color-info-bg)', borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)',
                          border: '1px solid var(--color-info-bg)',
                        }}>
                          🔗 {linkedJob.company} — {linkedJob.roleTitle}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleResearch(card.id)}
                      disabled={researchingId === card.id}
                      style={{
                        padding: 'var(--space-2) var(--space-4)',
                        background: intelAvailable ? 'var(--color-status-green)' : 'var(--color-primary)',
                        color: 'var(--color-surface)', border: 'none', borderRadius: 'var(--radius-md)',
                        fontWeight: 500, cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                      }}
                    >
                      {researchingId === card.id ? '⏳ Riset...' : intelAvailable ? '🔄 Riset Ulang' : '🔍 Riset'}
                    </button>
                    {intelAvailable && (
                    <button
                      onClick={() => {
                        const newId = isExpanded ? null : card.id;
                        setExpandedId(newId);
                        navigate(newId ? `/research/${newId}` : '/research', { replace: true });
                      }}
                      style={{
                        padding: 'var(--space-2) var(--space-4)',
                        background: 'var(--color-bg)', color: 'var(--color-text)',
                        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                        cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                      }}
                    >
                      {isExpanded ? 'Tutup' : 'Detail'}
                    </button>
                    )}
                    <button
                      onClick={() => handleDelete(card.id)}
                      style={{
                        padding: 'var(--space-2) var(--space-4)',
                        background: 'transparent', color: 'var(--color-status-red)',
                        border: '1px solid var(--color-status-red)', borderRadius: 'var(--radius-md)',
                        cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Expanded Intel Detail */}
                {isExpanded && intelAvailable && (
                  <div style={{
                    marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)',
                    borderTop: '1px solid var(--color-border)',
                  }}>
                    {card.overview && (
                      <Section title="📋 Overview" content={card.overview} />
                    )}
                    {card.values && card.values.length > 0 && (
                      <BulletList title="💎 Core Values & Visi Misi" items={card.values} />
                    )}
                    {card.workModel && (
                      <Section title="🏠 Work Model" content={card.workModel} />
                    )}
                    {card.compensation && (
                      <Section title="💰 Compensation & Benefits" content={card.compensation} />
                    )}
                    {card.careerGrowth && card.careerGrowth.length > 0 && (
                      <BulletList title="📈 Career Growth" items={card.careerGrowth} />
                    )}
                    {card.stability && (
                      <Section title="📊 Stability & Market Position" content={card.stability} />
                    )}
                    {card.culture && card.culture.length > 0 && (
                      <BulletList title="🏢 Budaya Kerja" items={card.culture} />
                    )}
                    {card.redFlags && card.redFlags.length > 0 && (
                      <BulletList title="🚩 Red Flags" items={card.redFlags} color="var(--color-status-red)" />
                    )}
                    {card.interviewTips && card.interviewTips.length > 0 && (
                      <BulletList title="💡 Tips Wawancara" items={card.interviewTips} />
                    )}
                    {card.sources && card.sources.length > 0 && (
                      <div style={{ marginTop: 'var(--space-4)' }}>
                        <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
                          🔗 Sumber
                        </h4>
                        <ul style={{ paddingLeft: 'var(--space-5)', listStyleType: 'none', padding: 0 }}>
                          {card.sources.map((src, i) => (
                            <li key={i} style={{ marginBottom: 'var(--space-1)', fontSize: 'var(--font-size-xs)' }}>
                              {src.startsWith('http') ? (
                                <button
                                  onClick={() => openUrl(src)}
                                  style={{
                                    color: 'var(--color-primary)', background: 'none', border: 'none',
                                    padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit',
                                    textDecoration: 'underline', textAlign: 'left',
                                  }}
                                >
                                  {src}
                                </button>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)' }}>{src}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Reusable sub-components ──

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>{title}</h4>
      <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, fontSize: 'var(--font-size-sm)' }}>{content}</p>
    </div>
  );
}

function BulletList({ title, items, color }: { title: string; items: string[]; color?: string }) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)', color: color || 'inherit' }}>{title}</h4>
      <ul style={{ paddingLeft: 'var(--space-5)' }}>
        {items.map((item, i) => (
          <li key={i} style={{
            marginBottom: 'var(--space-1)', fontSize: 'var(--font-size-sm)',
            color: color || 'var(--color-text-muted)',
          }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
