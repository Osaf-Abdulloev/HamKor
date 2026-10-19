/**
 * Telegram link parser & opener helper.
 * Resolves blocked t.me links into native tg:// protocol deep links and mirror URLs.
 */

export interface TelegramUrlInfo {
  appUrl: string;
  webUrl: string;
  mirrorUrl: string;
}

export const getTelegramUrls = (url: string): TelegramUrlInfo => {
  if (!url) {
    return { appUrl: '', webUrl: '', mirrorUrl: '' };
  }

  const cleanUrl = url.trim();

  // Already a tg:// deep link
  if (cleanUrl.startsWith('tg://')) {
    return {
      appUrl: cleanUrl,
      webUrl: cleanUrl,
      mirrorUrl: cleanUrl
    };
  }

  try {
    const target = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
    const parsed = new URL(target);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('t.me') || host.includes('telegram.me') || host.includes('tg.me')) {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        const domain = pathParts[0];
        const postId = pathParts.length > 1 ? pathParts[1] : undefined;
        const startParam = parsed.searchParams.get('start');

        if (domain && domain.toLowerCase() !== 's') {
          let appUrl = `tg://resolve?domain=${domain}`;
          if (postId) {
            appUrl += `&post=${postId}`;
          }
          if (startParam) {
            appUrl += `&start=${encodeURIComponent(startParam)}`;
          }

          const qStr = parsed.search ? parsed.search : (startParam ? `?start=${encodeURIComponent(startParam)}` : '');
          const mirrorUrl = postId
            ? `https://telegram.me/${domain}/${postId}${qStr}`
            : `https://telegram.me/${domain}${qStr}`;
          const webUrl = postId
            ? `https://t.me/${domain}/${postId}${qStr}`
            : `https://t.me/${domain}${qStr}`;

          return { appUrl, webUrl, mirrorUrl };
        }
      }
    }
  } catch (e) {
    // URL parse fallback
  }

  // Regex fallback
  const match = cleanUrl.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me|tg\.me)\/([A-Za-z0-9_]+)(?:\/(\d+))?/i);
  if (match) {
    const domain = match[1];
    const postId = match[2];
    const startMatch = cleanUrl.match(/[?&]start=([A-Za-z0-9_-]+)/i);
    const startParam = startMatch ? startMatch[1] : undefined;

    if (domain && domain.toLowerCase() !== 's') {
      let appUrl = `tg://resolve?domain=${domain}`;
      if (postId) appUrl += `&post=${postId}`;
      if (startParam) appUrl += `&start=${encodeURIComponent(startParam)}`;

      const startQuery = startParam ? `?start=${encodeURIComponent(startParam)}` : '';
      const mirrorUrl = postId ? `https://telegram.me/${domain}/${postId}${startQuery}` : `https://telegram.me/${domain}${startQuery}`;
      const webUrl = postId ? `https://t.me/${domain}/${postId}${startQuery}` : `https://t.me/${domain}${startQuery}`;

      return { appUrl, webUrl, mirrorUrl };
    }
  }

  return {
    appUrl: `tg://msg_url?url=${encodeURIComponent(cleanUrl)}`,
    webUrl: cleanUrl,
    mirrorUrl: cleanUrl
  };
};

/**
 * Safely opens Telegram link via native app protocol first (tg://),
 * bypassing browser DNS blocks on t.me domain.
 * Graceful fallback to telegram.me mirror in a new tab.
 */
export const openTelegramLink = (e: React.MouseEvent | null, url: string) => {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  const { appUrl, mirrorUrl, webUrl } = getTelegramUrls(url);

  if (appUrl) {
    // 1. Launch native Telegram Desktop/Mobile client app via tg:// protocol
    window.location.href = appUrl;
  }

  // 2. Open telegram.me web mirror in a new tab after a brief delay
  setTimeout(() => {
    window.open(mirrorUrl || webUrl, '_blank', 'noopener,noreferrer');
  }, 400);
};
