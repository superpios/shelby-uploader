import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react'
import { Network } from '@aptos-labs/ts-sdk'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{ network: Network.MAINNET }}
      onError={(error) => console.log('Wallet error:', error)}
    >
      <App />
    </AptosWalletAdapterProvider>
  </StrictMode>,
)