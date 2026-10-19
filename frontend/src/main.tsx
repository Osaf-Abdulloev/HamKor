import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { LanguageProvider } from './i18n/LanguageContext'
import { ThemeProvider } from './theme/ThemeContext'
import { ErrorBoundary } from './components/common/ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
