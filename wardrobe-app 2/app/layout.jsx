import "./globals.css";

export const metadata = {
  title: "Boston Wardrobes — design your fitted wardrobe",
  description: "Upload your space, shape the design, and get a quote from the studio that builds it.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
