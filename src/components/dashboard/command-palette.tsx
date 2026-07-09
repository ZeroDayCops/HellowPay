'use client';

/**
 * HollowPay — Command Palette (⌘K)
 *
 * A premium, keyboard-driven search overlay for instant navigation
 * across all dashboard entities: orders, claims, customers, pages.
 *
 * Activation: ⌘K (macOS) / Ctrl+K (Windows/Linux)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useEnvironment } from '@/lib/contexts/environment-context';
import styles from './command-palette.module.css';

interface SearchResult {
  type: 'order' | 'customer' | 'claim' | 'payment_page' | 'navigation';
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
}

export function CommandPalette() {
  const router = useRouter();
  const { environment } = useEnvironment();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [navigation, setNavigation] = useState<SearchResult[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // All visible items (navigation + results)
  const allItems = [...navigation, ...results];

  // ── Keyboard shortcut to open ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Focus input when opened ──
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      // Fetch default navigation items
      fetchResults('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // ── Debounced search ──
  const fetchResults = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/search?q=${encodeURIComponent(q)}&env=${environment}`);
      if (res.ok) {
        const data = await res.json();
        setNavigation(data.navigation || []);
        setResults(data.results || []);
        setActiveIndex(0);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [environment]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(value), 200);
  };

  // ── Navigate to selected item ──
  const selectItem = (item: SearchResult) => {
    setIsOpen(false);
    router.push(item.href);
  };

  // ── Keyboard navigation ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[activeIndex]) {
        selectItem(allItems[activeIndex]);
      }
    }
  };

  if (!isOpen) {
    return (
      <button
        className={styles.triggerBtn}
        onClick={() => setIsOpen(true)}
        aria-label="Open command palette"
      >
        <span className={styles.triggerIcon}>🔍</span>
        <span className="triggerLabel">Search</span>
        <kbd className={styles.triggerShortcut}>⌘K</kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop overlay */}
      <div className={styles.overlay} onClick={() => setIsOpen(false)}>
        {/* Palette container */}
        <div
          className={styles.palette}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Command palette"
        >
          {/* Search input */}
          <div className={styles.inputWrapper}>
            <svg
              className={styles.searchIcon}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              className={styles.input}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search orders, customers, claims, or navigate…"
              autoComplete="off"
              spellCheck={false}
            />
            <span className={styles.shortcut}>ESC</span>
          </div>

          {/* Results list */}
          <div className={styles.results}>
            {loading ? (
              <div className={styles.loading}>
                <div className={styles.loadingDots}>
                  <div className={styles.loadingDot} />
                  <div className={styles.loadingDot} />
                  <div className={styles.loadingDot} />
                </div>
              </div>
            ) : allItems.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🔎</div>
                <div className={styles.emptyText}>
                  No results found for &ldquo;{query}&rdquo;
                </div>
              </div>
            ) : (
              <>
                {/* Navigation group */}
                {navigation.length > 0 && (
                  <>
                    <div className={styles.groupLabel}>
                      {query ? 'Pages' : 'Quick Navigation'}
                    </div>
                    {navigation.map((item, idx) => (
                      <button
                        key={item.id}
                        className={styles.resultItem}
                        data-active={activeIndex === idx}
                        onClick={() => selectItem(item)}
                        onMouseEnter={() => setActiveIndex(idx)}
                      >
                        <div className={styles.resultIcon}>{item.icon}</div>
                        <div className={styles.resultText}>
                          <div className={styles.resultTitle}>{item.title}</div>
                          <div className={styles.resultSubtitle}>{item.subtitle}</div>
                        </div>
                        <span className={styles.resultArrow}>↵</span>
                      </button>
                    ))}
                  </>
                )}

                {/* Data results group */}
                {results.length > 0 && (
                  <>
                    <div className={styles.groupLabel}>Data Results</div>
                    {results.map((item, idx) => {
                      const globalIdx = navigation.length + idx;
                      return (
                        <button
                          key={item.id}
                          className={styles.resultItem}
                          data-active={activeIndex === globalIdx}
                          onClick={() => selectItem(item)}
                          onMouseEnter={() => setActiveIndex(globalIdx)}
                        >
                          <div className={styles.resultIcon}>{item.icon}</div>
                          <div className={styles.resultText}>
                            <div className={styles.resultTitle}>{item.title}</div>
                            <div className={styles.resultSubtitle}>{item.subtitle}</div>
                          </div>
                          <span className={styles.resultArrow}>↵</span>
                        </button>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer with keyboard hints */}
          <div className={styles.footer}>
            <div className={styles.footerKeys}>
              <span className={styles.footerKey}>
                <kbd>↑</kbd><kbd>↓</kbd> navigate
              </span>
              <span className={styles.footerKey}>
                <kbd>↵</kbd> select
              </span>
              <span className={styles.footerKey}>
                <kbd>esc</kbd> close
              </span>
            </div>
            <span>HollowPay Search</span>
          </div>
        </div>
      </div>

      {/* Hidden trigger (open state renders overlay instead) */}
      <button
        className={styles.triggerBtn}
        onClick={() => setIsOpen(true)}
        aria-label="Open command palette"
        style={{ visibility: 'hidden', position: 'absolute' }}
      >
        <span className={styles.triggerIcon}>🔍</span>
      </button>
    </>
  );
}
