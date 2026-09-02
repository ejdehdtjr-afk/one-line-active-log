import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://one-line-active-log.ejdehdtjr.chatgpt.site'),
  title: 'FIVE / FIVE — 5일 계획 실험',
  description:
    '하나의 질문과 지표로 계획 규칙 변경 전후를 비교하는 개인 기록 앱',
  openGraph: {
    title: 'FIVE / FIVE',
    description: '5일 계획 실험',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FIVE / FIVE',
    description: '5일 계획 실험',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
