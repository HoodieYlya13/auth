import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { getDictionary, hasLocale } from "@/lib/dictionaries/dictionaries";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : "en";
  const dict = await getDictionary(locale);

  return {
    title: dict.metaTitle,
    description: dict.metaDescription,
  };
}

export async function generateStaticParams() {
  return [{ lang: "en" }, { lang: "fr" }];
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body>
        {children}
        <Toaster
          position="top-center"
          theme="system"
          toastOptions={{
            classNames: {
              error:
                "bg-destructive! text-white! border-destructive! [&_[data-icon]]:text-white!",
            },
          }}
        />
      </body>
    </html>
  );
}
