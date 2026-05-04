/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ANONYMOUS_ACCESS_PERMISSION_PATH?: string;
  readonly VITE_ACCESS_SESSION_URL_TEMPLATE?: string;
  readonly VITE_GUEST_QR_TOKENS_BASE_PATH?: string;
  readonly VITE_GUEST_ACCESS_PERMISSION_PATH?: string;
  readonly VITE_GUEST_SCAN_AUTH_URL?: string;
  readonly VITE_GUEST_APPROVAL_POLL_URL_TEMPLATE?: string;
  readonly VITE_ADMIN_GUEST_REQUESTS_LIST_URL?: string;
  readonly VITE_GUEST_DEVICE_API_KEY?: string;
  /** POST guest session exchange; default `/api/access/guest-session`. */
  readonly VITE_GUEST_SESSION_EXCHANGE_URL?: string;
  /** Guest Bearer API prefix; default `/api/guest`. */
  readonly VITE_GUEST_API_BASE_PATH?: string;
}

