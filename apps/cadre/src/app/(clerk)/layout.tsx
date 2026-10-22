import { ClerkProvider } from "@clerk/nextjs";

// Clerk's sign-in, sign-up and organisation screens in Cadre's dark tangerine look.
const appearance = {
  variables: {
    colorPrimary: "#ff6a33",
    colorPrimaryForeground: "#140802",
    colorBackground: "#17181d",
    colorForeground: "#ecedf1",
    colorMutedForeground: "#979daa",
    colorMuted: "#1f2127",
    colorInput: "#111216",
    colorInputForeground: "#ecedf1",
    colorBorder: "#3a3d46",
    colorDanger: "#ff6b6f",
    colorSuccess: "#3ccb85",
    colorRing: "#ff6a33",
    fontFamily: "var(--font-sans)",
    borderRadius: "10px",
  },
};

export default function ClerkLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider appearance={appearance}>{children}</ClerkProvider>;
}
