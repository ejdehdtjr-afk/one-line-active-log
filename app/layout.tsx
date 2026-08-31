import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '오늘의 한 줄 기록',
  description: '능동 작업시간을 안전하게 기록하고 검증하는 개인 기록기',
  openGraph: {
    title: '오늘의 한 줄 기록',
    description: '능동 작업시간을 안전하게 기록하고 검증하는 개인 기록기',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '오늘의 한 줄 기록' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '오늘의 한 줄 기록',
    description: '능동 작업시간을 안전하게 기록하고 검증하는 개인 기록기',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
