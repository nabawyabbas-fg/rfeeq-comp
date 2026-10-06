import { Link, Text } from "@react-email/components";

/**
 * Wordmark for transactional email.
 *
 * Text rather than an image: the previous version pulled a logo from an
 * external CDN that is not ours, so every email rendered another product's
 * branding — and would break outright once that host stopped serving it. A
 * wordmark needs no hosting and survives clients that block remote images,
 * which is most of them by default.
 */
export const Logo = () => {
  return (
    <Link
      href="https://rfeeq.ai"
      style={{
        color: "#111827",
        fontSize: "22px",
        fontWeight: 700,
        letterSpacing: "-0.01em",
        textDecoration: "none",
      }}
    >
      <Text style={{ margin: 0 }}>Rfeeq</Text>
    </Link>
  );
};
