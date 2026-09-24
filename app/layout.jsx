import "./globals.css";

export const metadata = {
  title: "Thryve Growth wardrobe app",
  description: "Upload your space, shape the design, and get a quote from the studio that builds it.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
