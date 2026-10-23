'use client';

import { V4Portfolio } from '@/components/v4/V4Portfolio';
import { V4NearOnlyNotice } from '@/components/v4/V4NearOnlyNotice';

export default function V4PortfolioPage() {
  return (
    <>
      <V4NearOnlyNotice what="The DEX portfolio" />
      <V4Portfolio />
    </>
  );
}
