import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-links">
        <Link href="/official-rules">Official Rules</Link>
        <span aria-hidden="true">·</span>
        <Link href="/login">Sign in</Link>
      </nav>
      <p>
        Free to play. No purchase necessary. 18+ US residents. Void where
        prohibited.
      </p>
      <p>Part of the TiltCheck ecosystem</p>
    </footer>
  );
}
