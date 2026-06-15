import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { createIntelCard, requestResearch, isBannedDomain } from '../lib/companyIntel';
import type { CompanyIntel } from '../types';

export default function Research() {
  const [cards, setCards] = useState<CompanyIntel[]>([]);
  const [company, setCompany] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadCards();
  }, []);

  async function loadCards() {
    const all = await db.companyIntel.toArray();
    setCards(all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;

    if (url.trim() && isBannedDomain(url)) {
      alert('Domain ini diblokir (review site/job board). Gunakan situs resmi perusahaan.');
      return;
    }

    await createIntelCard({ company: company.trim(), officialUrl: url.trim() || '', notes: notes.trim() || undefined });
    setCompany('');
    setUrl('');
    setNotes('');
    await loadCards();
  }

  async function handleResearch(id: string) {
    setResearchingId(id);
    try {
      await requestResearch(id);
      await loadCards();
    } finally {
      setResearchingId(null);
    }
  }

  async function handleDelete(id: string) {
    await db.companyIntel.delete(id);
    await loadCards();
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
          Tambah Kartu Intel Perusahaan
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
            {url && isBannedDomain(url) && (
              <p style={{ color: 'var(--color-status-red)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
                ⚠️ Domain ini diblokir. Gunakan situs resmi perusahaan.
              </p>
            )}
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
          <button
            type="submit"
            disabled={!company.trim() || (url.trim() && isBannedDomain(url))}
            style={{
              alignSelf: 'flex-start',
              padding: 'var(--space-3) var(--space-6)',
              background: 'var(--color-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)',
              opacity: (!company.trim() || (url.trim() && isBannedDomain(url))) ? 0.5 : 1,
            }}
          >
            + Tambah Kartu
          </button>
        </div>
      </form>

      {/* Intel Cards */}
      {cards.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}>
          <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)' }}>Belum ada riset perusahaan</p>
          <p>Tambahkan kartu intel perusahaan untuk memulai riset.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {cards.map((card) => {
            const isExpanded = expandedId === card.id;
            const hasIntel = Boolean(card.snapshot || card.products?.length || card.industry || card.redFlags?.length);
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
                    <a href={card.officialUrl} target="_blank" rel="noopener noreferrer" style={{
                      color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)', wordBreak: 'break-all',
                    }}>
                      {card.officialUrl}
                    </a>
                    {card.notes && (
                      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
                        {card.notes}
                      </p>
                    )}
                    {card.industry && (
                      <span style={{
                        display: 'inline-block', marginTop: 'var(--space-2)',
                        padding: 'var(--space-1) var(--space-3)',
                        background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)',
                      }}>
                        🏭 {card.industry}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleResearch(card.id)}
                      disabled={researchingId === card.id || isBannedDomain(card.officialUrl)}
                      style={{
                        padding: 'var(--space-2) var(--space-4)',
                        background: hasIntel ? 'var(--color-status-green)' : 'var(--color-primary)',
                        color: '#FFFFFF', border: 'none', borderRadius: 'var(--radius-md)',
                        fontWeight: 500, cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                      }}
                    >
                      {researchingId === card.id ? '⏳ Riset...' : hasIntel ? '🔄 Riset Ulang' : '🔍 Riset'}
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : card.id)}
                      style={{
                        padding: 'var(--space-2) var(--space-4)',
                        background: 'var(--color-bg)', color: 'var(--color-text)',
                        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                        cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                      }}
                    >
                      {isExpanded ? 'Tutup' : 'Detail'}
                    </button>
                    <button
                      onClick={() => handleDelete(card.id)}
                      style={{
                        padding: 'var(--space-2) var(--space-4)',
                        background: 'transparent', color: 'var(--color-status-red)',
                        border: '1px solid var(--color-status-red)', borderRadius: 'var(--radius-md)',
                        cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>

                {/* Expanded Intel Detail */}
                {isExpanded && hasIntel && (
                  <div style={{
                    marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)',
                    borderTop: '1px solid var(--color-border)',
                  }}>
                    {card.snapshot && (
                      <div style={{ marginBottom: 'var(--space-4)' }}>
                        <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>📋 Snapshot</h4>
                        <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{card.snapshot}</p>
                      </div>
                    )}
                    {card.products && card.products.length > 0 && (
                      <div style={{ marginBottom: 'var(--space-4)' }}>
                        <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>📦 Produk</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                          {card.products.map((p, i) => (
                            <span key={i} style={{
                              padding: 'var(--space-1) var(--space-3)',
                              background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                              fontSize: 'var(--font-size-sm)',
                            }}>{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {card.redFlags && card.redFlags.length > 0 && (
                      <div>
                        <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-status-red)' }}>
                          🚩 Red Flags
                        </h4>
                        <ul style={{ paddingLeft: 'var(--space-5)' }}>
                          {card.redFlags.map((flag, i) => (
                            <li key={i} style={{ color: 'var(--color-status-red)', marginBottom: 'var(--space-1)', fontSize: 'var(--font-size-sm)' }}>
                              {flag}
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
