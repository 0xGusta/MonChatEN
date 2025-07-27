import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ReactTogether } from 'react-together';
import { createAppKit } from '@reown/appkit/react';
import { WagmiProvider } from 'wagmi';
import { monadTestnet } from 'viem/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

const queryClient = new QueryClient();

const projectId = import.meta.env.VITE_PROJECT_ID;

const metadata = {
  name: 'MonChat',
  description: 'Real time chat application on Monad',
  url: 'https://monchaten.vercel.app',
  icons: ['https://ipfs.io/ipfs/bafkreievdtfwyy5ixtyjt4aemzyevjeeza5yfwbifnnzbxueiommukwwfa']
};

const chains = [monadTestnet];

const wagmiAdapter = new WagmiAdapter({
  networks: chains,
  projectId,
  ssr: false
});

createAppKit({
  adapters: [wagmiAdapter],
  networks: chains,
  projectId,
  metadata,
  features: {
    connectMethodsOrder: ['wallet'],
    analytics: true
  }
  
});

function Providers({ children }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ReactTogether
          sessionParams={{
            apiKey: import.meta.env.VITE_MULTISYNQ_APP_ID,
            name: 'monchat-global-room',
            password: 'monchatglobal'
          }}
        >
          {children}
        </ReactTogether>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
);
