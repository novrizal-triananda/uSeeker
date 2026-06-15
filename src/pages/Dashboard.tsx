import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import type { JobEntry, FitScore, Application } from '../types';

interface DashboardData {
  jobCount: number;
  scoredCount: number;
  avgFitScore: number;
  applicationCount: number;
  intelCount: number;
  recentJobs: { job: JobEntry; fitScore: FitScore | null }[];
  recentApplications: Application[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [jobs, fitScores, applications, intel] = await Promise.all([
        db.jobEntries.toArray(),
        db.fitScores.toArray(),
        db.applications.toArray(),
        db.companyIntel.toArray(),
      ]);

      const scoresByJob = new Map<string, FitScore>();
      for (const score of fitScores) {
        scoresByJob.set(score.jobId, score);
      }

      const scored = fitScores.length;
      const avgFit = scored > 0
        ? Math.round(fitScores.reduce((acc, s) => acc + s.overallScore, 0) / scored)
        : 0;

      const recentJobs = jobs
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5)
        .map(job => ({ job, fitScore: scoresByJob.get(job.id) || null }));

      const recentApps = applications
        .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
        .slice(0, 5);

      setData({
        jobCount: jobs.length,
        scoredCount: scored,
        avgFitScore: avgFit,
        applicationCount: applications.length,
        intelCount: intel.length,
        recentJobs,
        recentApplications: recentApps,
      });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <section style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Memuat...
      </section>
    );
  }

  if (!data) {
    return (
      <section style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Gagal memuat data.
      </section>
    );
  }

  return (
    <section style={{ padding: 'var(--space-6)', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-6)' }}>
        📊 Dashboard
      </h2>

      {/* ── Stats Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <StatCard icon="💼" label="Lowongan" value={data.jobCount} sub={`${data.scoredCount} sudah discoring`} />
        <StatCard icon="🎯" label="Rata-rata Skor" value={data.avgFitScore} sub={data.scoredCount > 0 ? `${data.scoredCount} lowongan` : 'Belum ada skor'} />
        <StatCard icon="📋" label="Lamaran" value={data.applicationCount} sub="ter tracking" />
        <StatCard icon="🔍" label="Company Intel" value={data.intelCount} sub="kartu riset" />
      </div>

      {/* ── Quick Actions ── */}
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
          ⚡ Mulai dari mana?
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <QuickAction
            icon="📄"
            label="Import CV"
            description="Upload CV untuk mulai scoring"
            href="/triage"
            highlight={data.jobCount === 0}
          />
          <QuickAction
            icon="💼"
            label="Tambah Lowongan"
            description="Paste deskripsi pekerjaan"
            href="/triage"
            highlight={data.jobCount > 0 && data.scoredCount === 0}
          />
          <QuickAction
            icon="🔍"
            label="Riset Perusahaan"
            description="Kumpulkan intel perusahaan"
            href="/research"
          />
          <QuickAction
            icon="📋"
            label="Track Lamaran"
            description="Pantau status lamaran"
            href="/visibility"
            highlight={data.applicationCount === 0 && data.jobCount > 0}
          />
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        {/* Recent Jobs */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
          }}
        >
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
            💼 Lowongan Terbaru
          </h3>
          {data.recentJobs.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              Belum ada lowongan. <a href="/triage" style={{ color: 'var(--color-primary)' }}>Tambahkan →</a>
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {data.recentJobs.map(({ job, fitScore }) => (
                <div key={job.id} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{job.roleTitle}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{job.company}</div>
                  {fitScore && (
                    <div style={{ marginTop: 'var(--space-1)' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: fitScore.overallScore >= 70 ? '#DCFCE7' : fitScore.overallScore >= 50 ? '#FEF3C7' : '#FEE2E2',
                          color: fitScore.overallScore >= 70 ? '#166534' : fitScore.overallScore >= 50 ? '#92400E' : '#991B1B',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 600,
                        }}
                      >
                        Skor: {fitScore.overallScore}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Applications */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
          }}
        >
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
            📋 Lamaran Terbaru
          </h3>
          {data.recentApplications.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              Belum ada lamaran. <a href="/visibility" style={{ color: 'var(--color-primary)' }}>Tambahkan →</a>
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {data.recentApplications.map((app) => (
                <div key={app.id} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{app.roleTitle}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{app.company}</div>
                  <div style={{ marginTop: 'var(--space-1)' }}>
                    <StatusBadge status={app.status} />
                    {app.outcome && <OutcomeBadge outcome={app.outcome} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Sub-components ──

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: number; sub: string }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)' }}>{icon}</div>
      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text)' }}>{value}</div>
      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)', marginTop: 'var(--space-1)' }}>{label}</div>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{sub}</div>
    </div>
  );
}

function QuickAction({ icon, label, description, href, highlight }: {
  icon: string; label: string; description: string; href: string; highlight?: boolean;
}) {
  return (
    <a
      href={href}
      style={{
        display: 'block',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${highlight ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: highlight ? '#EFF6FF' : 'var(--color-bg)',
        textDecoration: 'none',
        color: 'var(--color-text)',
        flex: '1 1 200px',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-1)' }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{label}</div>
      <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{description}</div>
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    applied: { bg: '#DBEAFE', text: '#1E40AF' },
    screen: { bg: '#FEF3C7', text: '#92400E' },
    interview: { bg: '#E0E7FF', text: '#3730A3' },
    offer: { bg: '#DCFCE7', text: '#166534' },
    rejected: { bg: '#FEE2E2', text: '#991B1B' },
  };
  const c = colors[status] || { bg: '#F3F4F6', text: '#374151' };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: c.bg, color: c.text, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
      {status}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    accepted: { bg: '#DCFCE7', text: '#166534' },
    rejected: { bg: '#FEE2E2', text: '#991B1B' },
    ghosted: { bg: '#F3F4F6', text: '#6B7280' },
    withdrawn: { bg: '#FEF3C7', text: '#92400E' },
  };
  const c = colors[outcome] || { bg: '#F3F4F6', text: '#374151' };
  return (
    <span style={{ display: 'inline-block', marginLeft: 'var(--space-2)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: c.bg, color: c.text, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
      {outcome}
    </span>
  );
}
