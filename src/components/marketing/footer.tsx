import Link from "next/link";

const footerLinks = {
  product: [
    { href: "#how-it-works", label: "How it works" },
    { href: "#agents", label: "AI Agents" },
    { href: "#byok", label: "BYOK" },
    { href: "#pricing", label: "Pricing" },
  ],
  resources: [
    { href: "/docs", label: "Documentation" },
    { href: "/blog", label: "Blog" },
    { href: "/changelog", label: "Changelog" },
    { href: "/status", label: "Status" },
  ],
  company: [
    { href: "/about", label: "About" },
    { href: "/careers", label: "Careers" },
    { href: "/contact", label: "Contact" },
    { href: "/privacy", label: "Privacy" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-bg-base">
      <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-primary to-accent-glow text-sm font-bold text-[#0a0b0f]">
                B
              </div>
              <span className="text-lg font-semibold tracking-tight text-text-primary">Bizweave</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-text-secondary">
              AI agents that build, run, and market your web business while you sleep.
            </p>
            
            {/* Social links */}
            <div className="mt-6 flex items-center gap-4">
              <a
                href="https://twitter.com/bizweave"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
                aria-label="Twitter"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M13.3174 10.7749L19.1457 4H17.7646L12.6839 9.88256L8.61193 4H4L9.9995 12.8955L4 20H5.38119L10.6316 13.7878L14.8442 20H19.4561L13.3171 10.7749H13.3174ZM11.3115 12.9738L10.7074 12.0881L5.89034 5.03974H7.96149L11.8495 10.568L12.4535 11.4537L17.7653 19.0105H15.6942L11.3115 12.9741V12.9738Z" />
                </svg>
              </a>
              <a
                href="https://github.com/bizweave"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
                aria-label="GitHub"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.338c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com/company/bizweave"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
                aria-label="LinkedIn"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-primary">
              Product
            </h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary transition-colors hover:text-accent-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-primary">
              Resources
            </h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary transition-colors hover:text-accent-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-primary">
              Company
            </h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary transition-colors hover:text-accent-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-text-muted">
              © {new Date().getFullYear()} Bizweave. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="/terms"
                className="text-sm text-text-muted transition-colors hover:text-text-secondary"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-text-muted transition-colors hover:text-text-secondary"
              >
                Privacy
              </Link>
              <Link
                href="/cookies"
                className="text-sm text-text-muted transition-colors hover:text-text-secondary"
              >
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
