import "./globals.css";
import { client } from "../lib/client";

export const metadata = {
  title: client.title,
  description: client.description,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
