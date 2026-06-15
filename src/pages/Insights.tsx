import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import {
  getOutcomeDistribution,
  getStageBocor,
  getSkillGapFrequency,
  getSampleWarning,
  getLearningPoints,
} from '../lib/insights';
import type { Application, FitScore } from '../types';
import type { OutcomeDistribution, StageBocor, SkillGapEntry, LearningPoint } from '../lib/insights';

export default function Insights() {
  const [, setApplications] = useState<Application[]>([]);
  const [, setFitScores] = useState<FitScore[]>([]);
  const [distribution, setDistribution] = useState<OutcomeDistribution>({ accepted: 0, rejected: 0, ghosted: 0, withdrawn: 0 });
  const [stageBocor, setStageBocor] = useState<StageBocor | null>(null);
  const [skillGaps, setSkillGaps] = useState<SkillGapEntry[]>([]);
  const [learningPoints, setLearningPoints] = useState<LearningPoint[]>([]);
  const [sampleWarning, setSampleWarning] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const apps = await db.applications.toArray();
    setApplications(apps);

    const scores = await db.fitScores.toArray();
    setFitScores(scores);

    setDistribution(getOutcomeDistribution(apps));
    setStageBocor(getStageBocor(apps));
    setSkillGaps(getSkillGapFrequency(apps, scores));
    setLearningPoints(getLearningPoints(apps));

    const warning = getSampleWarning(apps);
    setSampleWarning(warning ? warning.message : null);
  }

  const totalOutcomes = distribution.accepted + distribution.rejected + distribution.ghosted + distribution.withdrawn;
  const hasData = totalOutcomes > 0;

  const barColors: Record<string, string> = {
    accepted: 'var(--color-status-green)',
    rejected: 'var(--color-status-red)',
    ghosted: 'var(--color-status-amber)',
    withdrawn: 'var(--color-text-muted)',
  };

  const barLabels: Record<string, string> = {
    accepted: 'Diterima',
    rejected: 'Ditolak',
    ghosted: 'Ghosted',
    withdrawn: 'Ditarik',
  };

  return (
    <section style={{ padding: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
        💡 Insights & Analisis
      </h2>

      {!hasData ? (
        <div style={{
          textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}>
          <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)' }}>
            Belum cukup data untuk analisis
          </p>
          <p>Minimal butuh 10 outcome untuk menghasilkan insight yang berguna.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Sample Warning */}
          {sampleWarning && (
            <div style={{
              padding: 'var(--space-4)',
              background: '#FEF3C7', border: '1px solid #FCD34D',
              borderRadius: 'var(--radius-md)',
              color: '#92400E', fontSize: 'var(--font-size-sm)',
            }}>
              ⚠️ {sampleWarning}
            </div>
          )}

          {/* Outcome Distribution Chart */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
          }}>
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
              📊 Distribusi Outcome
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {(Object.keys(distribution) as (keyof OutcomeDistribution)[]).map((key) => {
                const count = distribution[key];
                const pct = totalOutcomes > 0 ? Math.round((count / totalOutcomes) * 100) : 0;
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ width: 100, fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                      {barLabels[key]}
                    </span>
                    <div style={{ flex: 1, height: 24, background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: barColors[key],
                        borderRadius: 'var(--radius-sm)',
                        transition: 'width 0.5s ease',
                        minWidth: pct > 0 ? 4 : 0,
                      }} />
                    </div>
                    <span style={{ width: 60, textAlign: 'right', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stage Bocor */}
          {stageBocor && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                🔍 Analisis Stage Bocor
              </h3>
              <div style={{
                padding: 'var(--space-4)',
                background: '#FEF2F2',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #FECACA',
              }}>
                <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                  Stage dengan rejection rate tertinggi:
                </p>
                <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-status-red)' }}>
                  {stageBocor.stage} — {stageBocor.rejectionRate}%
                </p>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
                  {stageBocor.rejectionRate >= 50
                    ? '⚠️ Lebih dari setengah kandidat ditolak di stage ini.'
                    : 'Tingkat rejection cukup signifikan di stage ini.'}
                </p>
              </div>
            </div>
          )}

          {/* Skill Gap Frequency */}
          {skillGaps.length > 0 && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                🎯 Frekuensi Skill Gap
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {skillGaps.slice(0, 15).map((entry) => (
                  <div key={entry.skill} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--color-bg)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{entry.skill}</span>
                    <span style={{
                      padding: 'var(--space-1) var(--space-2)',
                      background: 'var(--color-status-red)', color: '#FFFFFF',
                      borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600,
                    }}>{entry.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Learning Points */}
          {learningPoints.length > 0 && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                💡 Poin Pembelajaran
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {learningPoints.map((point, i) => {
                  const icon = point.category === 'stage' ? '🎯' : point.category === 'skill' ? '🛠️' : '📈';
                  return (
                    <div key={i} style={{
                      padding: 'var(--space-4)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                        <span style={{ fontSize: 'var(--font-size-xl)' }}>{icon}</span>
                        <div>
                          <p style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>{point.insight}</p>
                          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>
                            💡 {point.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
