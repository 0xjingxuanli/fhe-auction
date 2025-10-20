import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'FHE Auction House',
  projectId: '9f1829c9c1f0489ea1e9dd0dc7e2f45a',
  chains: [sepolia],
  ssr: false,
});
