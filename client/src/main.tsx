import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { setup } from './dojo/setup';
import { DojoProvider } from './DojoContext';

const setupResult = await setup();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
      <DojoProvider value={setupResult}>
        <App />
      </DojoProvider>
  </React.StrictMode>,
)
