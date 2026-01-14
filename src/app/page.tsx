import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background gradients */}
      <div className="fixed inset-0 gradient-radial pointer-events-none" />
      <div className="fixed inset-0 gradient-spotlight pointer-events-none" />

      {/* Subtle grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(212, 165, 116, 0.5) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(212, 165, 116, 0.5) 1px, transparent 1px)`,
          backgroundSize: "100px 100px",
        }}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-4xl flex flex-col items-center text-center px-4">
          {/* Logo */}
          <div
            className="opacity-0 animate-scale-in mb-14"
            style={{ animationDelay: "100ms" }}
          >
            <div className="relative animate-pulse-glow">
              <Image
                src="https://ryoxcarpentry.wordifysites.com/wp-content/uploads/2015/04/33333.png"
                alt="Ryox Carpentry"
                width={600}
                height={300}
                className="w-[45vw] max-w-[550px] min-w-[300px] h-auto"
                priority
              />
            </div>
          </div>

          {/* Divider */}
          <div
            className="w-48 h-px bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 animate-fade-in mb-10"
            style={{ animationDelay: "300ms" }}
          />

          {/* Tagline */}
          <p
            className="text-[var(--foreground-muted)] text-lg tracking-wide opacity-0 animate-fade-in-up mb-12"
            style={{
              animationDelay: "400ms",
              fontFamily: "var(--font-body)",
            }}
          >
            Carpentry Business Management
          </p>

          {/* Buttons */}
          <div
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto opacity-0 animate-fade-in-up"
            style={{ animationDelay: "500ms" }}
          >
            <Link
              href="/sign-in"
              className="btn-primary text-center min-w-[160px]"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="btn-secondary text-center min-w-[160px]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="relative z-10 py-8 text-center opacity-0 animate-fade-in"
        style={{ animationDelay: "700ms" }}
      >
        <p
          className="text-sm tracking-wider"
          style={{ color: "var(--foreground-muted)", opacity: 0.5 }}
        >
          &copy; {new Date().getFullYear()} Ryox Carpentry and Building
          Solutions
        </p>
      </footer>

      {/* Decorative corner elements */}
      <div className="fixed top-0 left-0 w-32 h-32 pointer-events-none opacity-0 animate-fade-in delay-500">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ color: "var(--border)" }}
        >
          <path
            d="M0 0 L30 0 L30 2 L2 2 L2 30 L0 30 Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="fixed top-0 right-0 w-32 h-32 pointer-events-none opacity-0 animate-fade-in delay-500">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ color: "var(--border)" }}
        >
          <path
            d="M100 0 L70 0 L70 2 L98 2 L98 30 L100 30 Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="fixed bottom-0 left-0 w-32 h-32 pointer-events-none opacity-0 animate-fade-in delay-500">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ color: "var(--border)" }}
        >
          <path
            d="M0 100 L30 100 L30 98 L2 98 L2 70 L0 70 Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="fixed bottom-0 right-0 w-32 h-32 pointer-events-none opacity-0 animate-fade-in delay-500">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ color: "var(--border)" }}
        >
          <path
            d="M100 100 L70 100 L70 98 L98 98 L98 70 L100 70 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
  );
}
