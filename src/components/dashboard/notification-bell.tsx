'use client';

/**
 * HollowPay — Notification Bell Component
 *
 * Implements a top-bar interactive notification bell. Toggles a glassmorphic
 * popover showing the latest notifications, mark-all-as-read triggers, and unread badges.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './notification-bell.module.css';

interface DbNotification {
  id: number;
  publicId: string;
  userId: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load notifications from API
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/dashboard/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  // Poll notifications periodically
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000); // Poll every 20 seconds
    return () => clearInterval(interval);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        fetchNotifications();
      }
      return next;
    });
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/notifications/read-all', {
        method: 'POST',
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (notif: DbNotification) => {
    setOpen(false);
    
    // Mark as read in state and database if unread
    if (!notif.readAt) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await fetch(`/api/dashboard/notifications/${notif.id}/read`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Failed to mark notification read:', error);
      }
    }

    // Redirect to link if present
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMin = Math.floor(diffMs / 1000 / 60);
      const diffHrs = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHrs / 24);

      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className={styles.bellContainer} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className={styles.bellBtn}
        onClick={handleToggle}
        aria-label="View Notifications"
      >
        <span className={styles.bellIcon}>🔔</span>
        {unreadCount > 0 && (
          <span className={styles.unreadBadge}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Card */}
      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <span className={styles.title}>Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className={styles.markAllBtn}
                onClick={handleMarkAllRead}
                disabled={loading}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className={styles.dropdownBody}>
            {notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📭</span>
                <p className="body-sm text-muted-foreground">You are all caught up!</p>
              </div>
            ) : (
              <div className={styles.notifList}>
                {notifications.map((notif) => {
                  const isUnread = !notif.readAt;
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleItemClick(notif)}
                      className={`${styles.notifItem} ${isUnread ? styles.unreadItem : ''}`}
                    >
                      <div className={styles.itemHeader}>
                        <span className={styles.itemTitle}>{notif.title}</span>
                        {isUnread && <span className={styles.unreadDot} />}
                      </div>
                      {notif.body && (
                        <p className={`${styles.itemBody} body-xs text-muted-foreground`}>
                          {notif.body}
                        </p>
                      )}
                      <span className={styles.itemTime}>
                        {formatTime(notif.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
