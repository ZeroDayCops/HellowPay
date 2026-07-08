'use client';

/**
 * HollowPay — Interactive Analytics Dashboard Console
 *
 * Implements summary telemetry grids, custom responsive SVG charting curves,
 * dynamic mouse coordinates hover tooltip tracking, and multi-day interval selectors.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useEnvironment } from '@/lib/contexts/environment-context';
import { Card, Badge, Button } from '@/components/ui';
import styles from './page.module.css';
import { formatCurrency } from '@/lib/utils/currency-formatter';

interface DailyStat {
  day: string;
  volume: number;
  count: number;
}

interface Summary {
  totalVolume: number;
  confirmedCount: number;
  averageTicketValue: number;
  activeCustomers: number;
  claims: {
    total: number;
    approved: number;
    rejected: number;
  };
}

export default function AnalyticsDashboardConsole() {
  const { environment } = useEnvironment();

  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [stats, setStats] = useState<DailyStat[]>([]);

  // Tooltip tracking states
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; data: DailyStat } | null>(null);
  const chartCardRef = useRef<HTMLDivElement>(null);

  // Fetch metrics data
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/analytics?env=${environment}&range=${range}`);
      const json = await res.json();
      if (res.ok) {
        setSummary(json.summary);
        setStats(json.stats || []);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [environment, range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatVolume = (minor: number, currency: string = 'INR') => {
    return formatCurrency(minor, currency);
  };

  // Coordinates Mapping for Responsive SVG Chart
  const svgWidth = 800;
  const svgHeight = 280;
  const paddingX = 60;
  const paddingY = 40;

  const maxVolume = Math.max(...stats.map((s) => s.volume), 100000); // at least 1000 INR scale

  const getPoints = () => {
    if (stats.length === 0) return [];
    return stats.map((stat, i) => {
      const x = paddingX + (i / (stats.length - 1)) * (svgWidth - 2 * paddingX);
      const y = svgHeight - paddingY - (stat.volume / maxVolume) * (svgHeight - 2 * paddingY);
      return { x, y, data: stat };
    });
  };

  const points = getPoints();

  // Create path command strings
  const getLinePath = () => {
    if (points.length === 0) return '';
    return points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');
  };

  const getAreaPath = () => {
    if (points.length === 0) return '';
    const linePath = getLinePath();
    const bottomY = svgHeight - paddingY;
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  // Claims approval rate percentage
  const getClaimApprovalRate = () => {
    if (!summary || summary.claims.total === 0) return '0%';
    const rate = Math.round((summary.claims.approved / summary.claims.total) * 100);
    return `${rate}%`;
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className="h2">
            <span>📊</span> Analytics
          </h1>
          <p className="body-sm text-muted-foreground mt-1">
            Observe transaction trends, ticket size volume indicators, and customer claims success reports.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchAnalytics}>
          🔄 Refresh
        </Button>
      </div>

      {loading && !summary ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p className="body-sm text-muted-foreground">Calculating analytics report...</p>
        </div>
      ) : (
        <>
          {/* Summary Telemetry Widgets */}
          {summary && (
            <div className={styles.metricsGrid}>
              {/* Total volume */}
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Gross Transaction Volume</div>
                <div className={styles.metricValue}>{formatVolume(summary.totalVolume)}</div>
                <div className={styles.metricSubtext}>
                  Confirmed payments in {environment} mode
                </div>
              </div>

              {/* Transactions Count */}
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Total confirmed transactions</div>
                <div className={styles.metricValue}>{summary.confirmedCount}</div>
                <div className={styles.metricSubtext}>
                  Successful peer-to-peer claims verified
                </div>
              </div>

              {/* Average ticket size */}
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Average Ticket Size</div>
                <div className={styles.metricValue}>{formatVolume(summary.averageTicketValue)}</div>
                <div className={styles.metricSubtext}>
                  Average order amount confirmed
                </div>
              </div>

              {/* Claims success rate */}
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Claim Verification Rate</div>
                <div className={styles.metricValue}>{getClaimApprovalRate()}</div>
                <div className={styles.metricSubtext}>
                  {summary.claims.approved} approved out of {summary.claims.total} claims
                </div>
              </div>
            </div>
          )}

          {/* SVG Trend Chart Card */}
          <div className={styles.chartCard} ref={chartCardRef}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Transaction Volume Trend</h3>
              <select
                className={styles.chartSelect}
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="7">Past 7 Days</option>
                <option value="30">Past 30 Days</option>
                <option value="90">Past 90 Days</option>
              </select>
            </div>

            <div className={styles.chartContainer}>
              {stats.length > 0 && (
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className={styles.svgChart}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <defs>
                    {/* Smooth fading color gradient beneath line */}
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                    const y = paddingY + ratio * (svgHeight - 2 * paddingY);
                    const labelVal = maxVolume - ratio * maxVolume;
                    return (
                      <g key={index}>
                        <line
                          x1={paddingX}
                          y1={y}
                          x2={svgWidth - paddingX}
                          y2={y}
                          className={styles.gridLine}
                        />
                        <text
                          x={paddingX - 10}
                          y={y + 4}
                          textAnchor="end"
                          className={styles.axisText}
                        >
                          {formatVolume(labelVal)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Date labels on X Axis */}
                  {points.length > 1 &&
                    [0, 0.5, 1].map((ratio, index) => {
                      const pointIndex = Math.min(
                        Math.round(ratio * (points.length - 1)),
                        points.length - 1
                      );
                      const p = points[pointIndex];
                      const dateObj = new Date(p.data.day);
                      const dateLabel = dateObj.toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      });
                      return (
                        <text
                          key={index}
                          x={p.x}
                          y={svgHeight - paddingY + 20}
                          textAnchor="middle"
                          className={styles.axisText}
                        >
                          {dateLabel}
                        </text>
                      );
                    })}

                  {/* Shaded Area */}
                  <path d={getAreaPath()} className={styles.chartArea} />

                  {/* Top Line Curve */}
                  <path d={getLinePath()} className={styles.chartLine} />

                  {/* Interactive Dot indicators */}
                  {points.map((p, index) => (
                    <circle
                      key={index}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredPoint?.data.day === p.data.day ? 6 : 4}
                      className={styles.chartDot}
                      onMouseEnter={() => setHoveredPoint(p)}
                    />
                  ))}
                </svg>
              )}

              {/* HOVER TOOLTIP POPUP */}
              {hoveredPoint && (
                <div
                  className={styles.tooltip}
                  style={{
                    left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                    top: `${(hoveredPoint.y / svgHeight) * 100 - 15}%`,
                    transform: 'translate(-50%, -100%)',
                  }}
                >
                  <span className={styles.tooltipDate}>
                    {new Date(hoveredPoint.data.day).toLocaleDateString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className={styles.tooltipValue}>
                    {formatVolume(hoveredPoint.data.volume)}
                  </span>
                  <span className="caption text-muted-foreground" style={{ fontSize: '0.65rem' }}>
                    {hoveredPoint.data.count} successful txs
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
